import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import {
  sampleWorkflowDefinition,
  errorHandlingWorkflowDefinition,
  WorkflowDefinition,
} from '../domain/workflows/sample.workflow';
import {
  loopWorkflowDefinition,
  conditionalLoopWorkflow,
} from '../domain/workflows/examples/loop-workflows';
import { ConfigService } from '../common/services/config.service';
import { WorkflowExecutionRepository } from './repositories/workflow-execution.repository';
import { WorkflowExecution } from '../domain/entities/workflow-execution.entity';

@Injectable()
export class WorkflowEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowEngineService.name);
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private redisConnection: IORedis | null = null;
  private isRedisAvailable = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly executionRepository: WorkflowExecutionRepository,
  ) {}

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
      this.registerWorkflow(loopWorkflowDefinition);
      this.registerWorkflow(conditionalLoopWorkflow);

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
            this.logger.error(
              'No se pudo conectar a Redis después de 3 intentos',
            );
            return null;
          }
          return Math.min(times * 50, 2000);
        },
      });

      await this.redisConnection.ping();
      this.isRedisAvailable = true;
      this.logger.log('Conectado a Redis exitosamente');
    } catch (error) {
      this.logger.warn(
        'No se pudo conectar a Redis. Funcionando en modo sin colas.',
      );
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
        connection: {
          host: this.configService.redisConfig.host,
          port: this.configService.redisConfig.port,
          password: this.configService.redisConfig.password,
          username: this.configService.redisConfig.username,
        },
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
            this.logger.log(
              `Ejecutando paso ${stepId} del workflow ${workflow.id}`,
            );

            // Actualizar estado en BD
            const execution = await this.executionRepository.findByJobId(
              job.id!,
            );
            if (execution) {
              await this.executionRepository.update(execution.id, {
                status: 'running',
                outputData: { currentStep: stepId },
              });
            }

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
            } else {
              // Es el último paso, marcar como completado
              if (execution) {
                await this.executionRepository.update(execution.id, {
                  status: 'completed',
                  outputData: result,
                  completedAt: new Date(),
                });
              }
            }

            return result;
          } catch (error) {
            this.logger.error(`Error en paso ${stepId}:`, error);

            // Actualizar estado de error en BD
            const execution = await this.executionRepository.findByJobId(
              job.id!,
            );
            if (execution) {
              await this.executionRepository.update(execution.id, {
                status: 'failed',
                error:
                  error instanceof Error ? error.message : 'Error desconocido',
              });
            }

            throw error;
          }
        },
        {
          connection: {
            host: this.configService.redisConfig.host,
            port: this.configService.redisConfig.port,
            password: this.configService.redisConfig.password,
            username: this.configService.redisConfig.username,
          },
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

        // Guardar en BD incluso sin Redis
        const execution = await this.executionRepository.create({
          workflowId,
          jobId: result.instanceId,
          status: 'completed',
          inputData: data,
          outputData: result.data,
          completedAt: result.completedAt,
        });

        return execution.id;
      }

      const startQueueName = `${workflowId}-${workflow.startStep}`;
      const startQueue = this.queues.get(startQueueName);

      if (!startQueue) {
        throw new Error(`Cola de inicio no encontrada: ${startQueueName}`);
      }

      const job = await startQueue.add('execute', data);

      // Crear registro en BD
      const execution = await this.executionRepository.create({
        workflowId,
        jobId: job.id!,
        status: 'pending',
        inputData: data,
      });

      this.logger.log(
        `Workflow iniciado: ${workflowId}, job: ${job.id}, execution: ${execution.id}`,
      );
      return execution.id;
    } catch (error) {
      this.logger.error(`Error al iniciar workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async getWorkflowStatus(executionId: string): Promise<any> {
    try {
      // Primero buscar en BD
      const execution = await this.executionRepository.findById(executionId);

      if (!execution) {
        // Si no está en BD, puede ser un ID de job antiguo
        const byJob = await this.executionRepository.findByJobId(executionId);
        if (byJob) {
          return this.mapExecutionToStatus(byJob);
        }
        return null;
      }

      // Si hay Redis, actualizar con estado real del job
      if (this.isRedisAvailable && execution.jobId) {
        for (const [queueName, queue] of this.queues) {
          const job = await queue.getJob(execution.jobId);
          if (job) {
            const state = await job.getState();

            // Actualizar estado en BD si cambió
            if (state !== execution.status) {
              await this.executionRepository.update(execution.id, {
                status: this.mapJobStateToStatus(state),
              });
            }

            return {
              id: execution.id,
              jobId: execution.jobId,
              workflowId: execution.workflowId,
              status: state,
              data: execution.outputData || execution.inputData,
              progress: job.progress,
              createTime: execution.createdAt,
              processedOn: job.processedOn ? new Date(job.processedOn) : null,
              finishedOn: execution.completedAt,
            };
          }
        }
      }

      // Si no hay job activo, devolver info de BD
      return this.mapExecutionToStatus(execution);
    } catch (error) {
      this.logger.error(
        `Error obteniendo estado del workflow ${executionId}:`,
        error,
      );
      throw error;
    }
  }

  private mapExecutionToStatus(execution: WorkflowExecution): any {
    return {
      id: execution.id,
      jobId: execution.jobId,
      workflowId: execution.workflowId,
      status: execution.status,
      data: execution.outputData || execution.inputData,
      createTime: execution.createdAt,
      finishedOn: execution.completedAt,
      error: execution.error,
    };
  }

  private mapJobStateToStatus(state: string): string {
    switch (state) {
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'active':
      case 'waiting':
        return 'running';
      default:
        return 'pending';
    }
  }

  async suspendWorkflow(executionId: string): Promise<void> {
    const execution = await this.executionRepository.findById(executionId);

    if (!execution) {
      throw new Error('Ejecución no encontrada');
    }

    if (!this.isRedisAvailable) {
      this.logger.warn('No se puede suspender workflow sin Redis');
      return;
    }

    try {
      for (const queue of this.queues.values()) {
        const job = await queue.getJob(execution.jobId);
        if (job) {
          await queue.pause();
          await this.executionRepository.update(execution.id, {
            status: 'cancelled',
          });
          this.logger.log(`Workflow suspendido: ${executionId}`);
          return;
        }
      }
    } catch (error) {
      this.logger.error(`Error suspendiendo workflow ${executionId}:`, error);
      throw error;
    }
  }

  async resumeWorkflow(executionId: string): Promise<void> {
    const execution = await this.executionRepository.findById(executionId);

    if (!execution) {
      throw new Error('Ejecución no encontrada');
    }

    if (!this.isRedisAvailable) {
      this.logger.warn('No se puede reanudar workflow sin Redis');
      return;
    }

    try {
      for (const queue of this.queues.values()) {
        const job = await queue.getJob(execution.jobId);
        if (job) {
          await queue.resume();
          await this.executionRepository.update(execution.id, {
            status: 'running',
          });
          this.logger.log(`Workflow reanudado: ${executionId}`);
          return;
        }
      }
    } catch (error) {
      this.logger.error(`Error reanudando workflow ${executionId}:`, error);
      throw error;
    }
  }

  async terminateWorkflow(executionId: string): Promise<void> {
    const execution = await this.executionRepository.findById(executionId);

    if (!execution) {
      throw new Error('Ejecución no encontrada');
    }

    if (!this.isRedisAvailable) {
      await this.executionRepository.update(execution.id, {
        status: 'cancelled',
        completedAt: new Date(),
      });
      return;
    }

    try {
      for (const queue of this.queues.values()) {
        const job = await queue.getJob(execution.jobId);
        if (job) {
          await job.remove();
          await this.executionRepository.update(execution.id, {
            status: 'cancelled',
            completedAt: new Date(),
          });
          this.logger.log(`Workflow terminado: ${executionId}`);
          return;
        }
      }
    } catch (error) {
      this.logger.error(`Error terminando workflow ${executionId}:`, error);
      throw error;
    }
  }

  async testWorkflow(workflowId: string, testData: any): Promise<any> {
    const result = await this.executeWorkflowSync(workflowId, testData);

    // Guardar resultado del test en BD
    const execution = await this.executionRepository.create({
      workflowId,
      jobId: result.instanceId,
      status: 'completed',
      inputData: testData,
      outputData: result.data,
      completedAt: result.completedAt,
    });

    return {
      ...result,
      executionId: execution.id,
    };
  }

  // Ejecutar workflow sincrónicamente (sin colas)
  private async executeWorkflowSync(
    workflowId: string,
    testData: any,
  ): Promise<any> {
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
        await new Promise((resolve) => setTimeout(resolve, step.delay));
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

  async getExecutionHistory(): Promise<any[]> {
    const executions = await this.executionRepository.findAll();
    return executions.map((e) => this.mapExecutionToStatus(e));
  }
}
