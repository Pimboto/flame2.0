import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { 
  sampleWorkflowDefinition, 
  errorHandlingWorkflowDefinition, 
  WorkflowDefinition 
} from '../domain/workflows/sample.workflow';
import { ConfigService } from '../common/services/config.service';

@Injectable()
export class WorkflowEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowEngineService.name);
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private redisConnection: IORedis | null = null;
  private isRedisAvailable = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeWorkflowEngine();
  }

  async onModuleDestroy() {
    await this.stopWorkflowEngine();
  }

  private async initializeWorkflowEngine() {
    try {
      // Intentar conectar a Redis
      await this.connectToRedis();
      
      // Registrar workflows predefinidos
      this.registerWorkflow(sampleWorkflowDefinition);
      this.registerWorkflow(errorHandlingWorkflowDefinition);
      
      this.logger.log('Workflow engine iniciado exitosamente');
    } catch (error) {
      this.logger.error('Error al iniciar workflow engine:', error);
      // No lanzar error para permitir que la app funcione sin Redis
    }
  }

  private async connectToRedis() {
    try {
      const redisConfig = this.configService.redisConfig;
      this.redisConnection = new IORedis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        username: redisConfig.username,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error('No se pudo conectar a Redis después de 3 intentos');
            return null;
          }
          return Math.min(times * 50, 2000);
        },
      });

      await this.redisConnection.ping();
      this.isRedisAvailable = true;
      this.logger.log('Conectado a Redis exitosamente');
    } catch (error) {
      this.logger.warn('No se pudo conectar a Redis. Funcionando en modo sin colas.');
      this.isRedisAvailable = false;
      if (this.redisConnection) {
        this.redisConnection.disconnect();
        this.redisConnection = null;
      }
    }
  }

  private async stopWorkflowEngine() {
    // Cerrar todos los workers
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    
    // Cerrar todas las colas
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    
    // Cerrar conexión a Redis
    if (this.redisConnection) {
      await this.redisConnection.disconnect();
    }
    
    this.logger.log('Workflow engine detenido');
  }

  private registerWorkflow(workflow: WorkflowDefinition) {
    this.workflows.set(workflow.id, workflow);
    
    // Solo crear colas si Redis está disponible
    if (!this.isRedisAvailable || !this.redisConnection) {
      this.logger.warn(`Workflow ${workflow.id} registrado en modo sin colas`);
      return;
    }
    
    // Crear cola para cada paso del workflow
    for (const [stepId, step] of workflow.steps) {
      const queueName = `${workflow.id}-${stepId}`;
      
      // Crear cola con conexión a Redis
      const queue = new Queue(queueName, {
        connection: this.redisConnection.duplicate(),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 3600, // 1 hora
            count: 100,
          },
          removeOnFail: {
            age: 24 * 3600, // 24 horas
          },
        },
      });
      
      this.queues.set(queueName, queue);
      
      // Crear worker
      const worker = new Worker(
        queueName,
        async (job: Job) => {
          try {
            this.logger.log(`Ejecutando paso ${stepId} del workflow ${workflow.id}`);
            const result = await step.handler(job.data);
            
            // Si hay siguiente paso, agregarlo a la cola
            if (step.nextStep) {
              const nextQueueName = `${workflow.id}-${step.nextStep}`;
              const nextQueue = this.queues.get(nextQueueName);
              
              if (nextQueue) {
                await nextQueue.add('execute', result, {
                  delay: step.delay || 0,
                });
              }
            }
            
            return result;
          } catch (error) {
            this.logger.error(`Error en paso ${stepId}:`, error);
            throw error;
          }
        },
        {
          connection: this.redisConnection.duplicate(),
          concurrency: 5, // Procesar hasta 5 jobs en paralelo
        },
      );

      // Escuchar eventos del worker
      worker.on('completed', (job) => {
        this.logger.log(`Job completado: ${job.id} en ${queueName}`);
      });

      worker.on('failed', (job, err) => {
        this.logger.error(`Job falló: ${job?.id} en ${queueName}`, err);
      });
      
      this.workers.set(queueName, worker);
    }
  }

  async startWorkflow(workflowId: string, data: any): Promise<string> {
    try {
      const workflow = this.workflows.get(workflowId);
      
      if (!workflow) {
        throw new Error(`Workflow no encontrado: ${workflowId}`);
      }
      
      // Si no hay Redis, ejecutar inmediatamente
      if (!this.isRedisAvailable) {
        this.logger.warn('Ejecutando workflow sin colas (Redis no disponible)');
        const result = await this.executeWorkflowSync(workflowId, data);
        return result.instanceId;
      }
      
      const startQueueName = `${workflowId}-${workflow.startStep}`;
      const startQueue = this.queues.get(startQueueName);
      
      if (!startQueue) {
        throw new Error(`Cola de inicio no encontrada: ${startQueueName}`);
      }
      
      const job = await startQueue.add('execute', data);
      
      this.logger.log(`Workflow iniciado: ${workflowId}, job: ${job.id}`);
      return job.id || '';
    } catch (error) {
      this.logger.error(`Error al iniciar workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async getWorkflowStatus(instanceId: string): Promise<any> {
    try {
      // Si no hay Redis, retornar estado simulado
      if (!this.isRedisAvailable) {
        return {
          id: instanceId,
          status: 'completed',
          data: {},
          createTime: new Date(),
          completeTime: new Date(),
        };
      }
      
      // Buscar el job en todas las colas
      for (const [queueName, queue] of this.queues) {
        const job = await queue.getJob(instanceId);
        if (job) {
          const state = await job.getState();
          return {
            id: instanceId,
            status: state,
            data: job.data,
            progress: job.progress,
            createTime: new Date(job.timestamp),
            processedOn: job.processedOn ? new Date(job.processedOn) : null,
            finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
          };
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Error obteniendo estado del workflow ${instanceId}:`, error);
      throw error;
    }
  }

  async suspendWorkflow(instanceId: string): Promise<void> {
    if (!this.isRedisAvailable) {
      this.logger.warn('No se puede suspender workflow sin Redis');
      return;
    }
    
    try {
      for (const queue of this.queues.values()) {
        const job = await queue.getJob(instanceId);
        if (job) {
          await queue.pause();
          this.logger.log(`Workflow suspendido: ${instanceId}`);
          return;
        }
      }
    } catch (error) {
      this.logger.error(`Error suspendiendo workflow ${instanceId}:`, error);
      throw error;
    }
  }

  async resumeWorkflow(instanceId: string): Promise<void> {
    if (!this.isRedisAvailable) {
      this.logger.warn('No se puede reanudar workflow sin Redis');
      return;
    }
    
    try {
      for (const queue of this.queues.values()) {
        const job = await queue.getJob(instanceId);
        if (job) {
          await queue.resume();
          this.logger.log(`Workflow reanudado: ${instanceId}`);
          return;
        }
      }
    } catch (error) {
      this.logger.error(`Error reanudando workflow ${instanceId}:`, error);
      throw error;
    }
  }

  async terminateWorkflow(instanceId: string): Promise<void> {
    if (!this.isRedisAvailable) {
      this.logger.warn('No se puede terminar workflow sin Redis');
      return;
    }
    
    try {
      for (const queue of this.queues.values()) {
        const job = await queue.getJob(instanceId);
        if (job) {
          await job.remove();
          this.logger.log(`Workflow terminado: ${instanceId}`);
          return;
        }
      }
    } catch (error) {
      this.logger.error(`Error terminando workflow ${instanceId}:`, error);
      throw error;
    }
  }

  async testWorkflow(workflowId: string, testData: any): Promise<any> {
    return this.executeWorkflowSync(workflowId, testData);
  }

  // Ejecutar workflow sincrónicamente (sin colas)
  private async executeWorkflowSync(workflowId: string, testData: any): Promise<any> {
    const workflow = this.workflows.get(workflowId);
    
    if (!workflow) {
      throw new Error(`Workflow no encontrado: ${workflowId}`);
    }
    
    let currentStep = workflow.startStep;
    let data = testData;
    
    while (currentStep) {
      const step = workflow.steps.get(currentStep);
      
      if (!step) {
        break;
      }
      
      this.logger.log(`Test: Ejecutando paso ${currentStep}`);
      
      // Simular delay si existe
      if (step.delay) {
        await new Promise(resolve => setTimeout(resolve, step.delay));
      }
      
      data = await step.handler(data);
      currentStep = step.nextStep || '';
    }
    
    return {
      success: true,
      instanceId: `test-${Date.now()}`,
      data,
      completedAt: new Date(),
    };
  }

  // Métodos de utilidad
  async getQueueStats(): Promise<any> {
    if (!this.isRedisAvailable) {
      return { message: 'Redis no disponible' };
    }
    
    const stats: any = {};
    
    for (const [name, queue] of this.queues) {
      const counts = await queue.getJobCounts();
      stats[name] = counts;
    }
    
    return stats;
  }
}
