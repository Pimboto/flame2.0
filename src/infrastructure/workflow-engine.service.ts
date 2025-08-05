import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
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
import { Cron, CronExpression } from '@nestjs/schedule';

// Configuración de concurrencia y performance
const WORKFLOW_CONFIG = {
  // Concurrencia por worker
  WORKER_CONCURRENCY: 10,
  
  // Número máximo de workers por tipo de workflow
  MAX_WORKERS_PER_WORKFLOW: 5,
  
  // Configuración de jobs
  JOB_ATTEMPTS: 3,
  JOB_BACKOFF_DELAY: 2000,
  
  // Limpieza automática de jobs completados (más agresiva)
  JOB_REMOVE_ON_COMPLETE_AGE: 300, // 5 minutos
  JOB_REMOVE_ON_COMPLETE_COUNT: 10, // Mantener solo los últimos 10
  JOB_REMOVE_ON_FAIL_AGE: 3600, // 1 hora
  JOB_REMOVE_ON_FAIL_COUNT: 50, // Mantener solo los últimos 50 fallidos
  
  // Límites del sistema
  MAX_QUEUE_SIZE: 10000,
  MEMORY_CHECK_INTERVAL: 60000, // Verificar memoria cada minuto
  MAX_MEMORY_USAGE_PERCENT: 80, // Alertar si la memoria supera 80%
  
  // Configuración de Redis
  REDIS_MAX_RETRIES: 3,
  REDIS_RETRY_DELAY: 50,
  REDIS_CONNECTION_POOL_SIZE: 10,
  
  // Limpieza de datos
  CLEANUP_INTERVAL: 300000, // Limpiar cada 5 minutos
  EXECUTION_RETENTION_DAYS: 7, // Mantener ejecuciones por 7 días
};

@Injectable()
export class WorkflowEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowEngineService.name);
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private redisConnection: IORedis | null = null;
  private isRedisAvailable = false;
  
  // Control de memoria
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private activeJobs: Map<string, Job> = new Map();
  
  // Métricas de performance
  private metrics = {
    totalJobsProcessed: 0,
    totalJobsFailed: 0,
    activeWorkers: 0,
    memoryUsage: 0,
    redisMemoryUsage: 0,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly executionRepository: WorkflowExecutionRepository,
  ) {}

  async onModuleInit() {
    await this.initializeWorkflowEngine();
    this.startMemoryMonitoring();
    this.startCleanupRoutines();
  }

  async onModuleDestroy() {
    await this.stopWorkflowEngine();
    this.stopMemoryMonitoring();
    this.stopCleanupRoutines();
  }

  private async initializeWorkflowEngine() {
    try {
      await this.connectToRedis();

      // Registrar workflows predefinidos
      this.registerWorkflow(sampleWorkflowDefinition);
      this.registerWorkflow(errorHandlingWorkflowDefinition);
      this.registerWorkflow(loopWorkflowDefinition);
      this.registerWorkflow(conditionalLoopWorkflow);

      this.logger.log('Workflow engine iniciado exitosamente');
      this.logger.log(`Configuración: ${JSON.stringify({
        workerConcurrency: WORKFLOW_CONFIG.WORKER_CONCURRENCY,
        maxWorkersPerWorkflow: WORKFLOW_CONFIG.MAX_WORKERS_PER_WORKFLOW,
        maxThroughput: WORKFLOW_CONFIG.WORKER_CONCURRENCY * WORKFLOW_CONFIG.MAX_WORKERS_PER_WORKFLOW,
        memoryLimit: WORKFLOW_CONFIG.MAX_MEMORY_USAGE_PERCENT + '%',
      })}`);
    } catch (error) {
      this.logger.error('Error al iniciar workflow engine:', error);
    }
  }

  private async connectToRedis() {
    try {
      const redisConfig = this.configService.redisConfig;
      
      this.logger.log(`Intentando conectar a Redis: ${redisConfig.host}:${redisConfig.port}`);
      
      // Conexión principal con configuración optimizada
      this.redisConnection = new IORedis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        username: redisConfig.username,
        maxRetriesPerRequest: WORKFLOW_CONFIG.REDIS_MAX_RETRIES,
        enableReadyCheck: true,
        enableOfflineQueue: false,
        connectTimeout: 10000, // 10 segundos de timeout
        
        // Optimizaciones de memoria
        lazyConnect: false,
        keepAlive: 10000,
        connectionName: 'workflow-engine',
        
        retryStrategy: (times) => {
          if (times > WORKFLOW_CONFIG.REDIS_MAX_RETRIES) {
            this.logger.error('No se pudo conectar a Redis después de varios intentos');
            return null;
          }
          const delay = Math.min(times * WORKFLOW_CONFIG.REDIS_RETRY_DELAY, 2000);
          this.logger.warn(`Reintentando conexión a Redis (intento ${times}), esperando ${delay}ms`);
          return delay;
        },
      });

      // Manejar eventos de conexión
      this.redisConnection.on('connect', () => {
        this.logger.log('Conectando a Redis...');
      });

      this.redisConnection.on('ready', () => {
        this.logger.log('Redis listo para recibir comandos');
      });

      this.redisConnection.on('error', (err) => {
        this.logger.error('Error de Redis:', err.message || err);
      });

      this.redisConnection.on('close', () => {
        this.logger.warn('Conexión a Redis cerrada');
      });

      // Intentar ping
      const pingResult = await this.redisConnection.ping();
      this.logger.log(`Redis ping exitoso: ${pingResult}`);
      
      this.isRedisAvailable = true;
      
      this.logger.log('Conectado a Redis exitosamente');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error('Error completo al conectar a Redis:', errorMessage);
      
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        this.logger.error('Redis no está disponible en la dirección especificada');
      } else if (error instanceof Error && error.message.includes('WRONGPASS')) {
        this.logger.error('Error de autenticación - verifica las credenciales de Redis');
      }
      
      this.logger.warn('No se pudo conectar a Redis. Funcionando en modo sin colas.');
      this.isRedisAvailable = false;
      
      if (this.redisConnection) {
        try {
          this.redisConnection.disconnect();
        } catch {}
        this.redisConnection = null;
      }
    }
  }

  private startMemoryMonitoring() {
    this.memoryCheckInterval = setInterval(async () => {
      await this.checkMemoryUsage();
    }, WORKFLOW_CONFIG.MEMORY_CHECK_INTERVAL);
  }

  private stopMemoryMonitoring() {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  private startCleanupRoutines() {
    this.cleanupInterval = setInterval(async () => {
      await this.performCleanup();
    }, WORKFLOW_CONFIG.CLEANUP_INTERVAL);
  }

  private stopCleanupRoutines() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private async checkMemoryUsage() {
    try {
      // Verificar memoria del proceso Node.js
      const memUsage = process.memoryUsage();
      const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      this.metrics.memoryUsage = heapUsedPercent;

      if (heapUsedPercent > WORKFLOW_CONFIG.MAX_MEMORY_USAGE_PERCENT) {
        this.logger.warn(`⚠️ Uso de memoria alto: ${heapUsedPercent.toFixed(2)}%`);
        
        // Forzar garbage collection si está disponible
        if (global.gc) {
          global.gc();
          this.logger.log('Garbage collection ejecutado');
        }
        
        // Limpiar caches y datos antiguos
        await this.emergencyCleanup();
      }

      // Verificar memoria de Redis si está conectado
      if (this.redisConnection && this.isRedisAvailable) {
        try {
          const info = await this.redisConnection.info('memory');
          const usedMemoryMatch = info.match(/used_memory:(\d+)/);
          const usedMemoryHuman = info.match(/used_memory_human:([^\r\n]+)/);
          
          if (usedMemoryHuman) {
            this.logger.debug(`Memoria Redis: ${usedMemoryHuman[1]}`);
          }
          
          // Solo mostrar advertencia si tenemos valores para comparar
          if (usedMemoryMatch) {
            const usedBytes = parseInt(usedMemoryMatch[1]);
            // Considerar 1GB como límite de advertencia
            const warningThreshold = 1024 * 1024 * 1024; // 1GB
            
            if (usedBytes > warningThreshold) {
              this.logger.warn(`⚠️ Uso alto de memoria en Redis: ${usedMemoryHuman?.[1] || 'desconocido'}`);
              await this.cleanupRedisData();
            }
          }
        } catch (error) {
          // Ignorar errores de memoria Redis
          this.logger.debug('No se pudo obtener info de memoria de Redis');
        }
      }
    } catch (error) {
      this.logger.error('Error verificando memoria:', error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  private async performCleanup() {
    try {
      this.logger.debug('Iniciando limpieza rutinaria...');
      
      // 1. Limpiar jobs completados antiguos
      for (const [queueName, queue] of this.queues) {
        try {
          const completed = await queue.getCompleted();
          const toRemove = completed.filter(job => {
            const age = Date.now() - job.finishedOn!;
            return age > WORKFLOW_CONFIG.JOB_REMOVE_ON_COMPLETE_AGE * 1000;
          });
          
          for (const job of toRemove) {
            await job.remove();
            this.activeJobs.delete(job.id!);
          }
          
          if (toRemove.length > 0) {
            this.logger.debug(`Limpiados ${toRemove.length} jobs completados de ${queueName}`);
          }
        } catch (error) {
          this.logger.error(`Error limpiando cola ${queueName}:`, error instanceof Error ? error.message : 'Error desconocido');
        }
      }

      // 2. Limpiar ejecuciones antiguas de la BD
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - WORKFLOW_CONFIG.EXECUTION_RETENTION_DAYS);
      
      const deletedCount = await this.executionRepository.deleteOldExecutions(cutoffDate);
      if (deletedCount > 0) {
        this.logger.log(`Eliminadas ${deletedCount} ejecuciones antiguas de la BD`);
      }

      // 3. Limpiar referencias a jobs activos que ya no existen
      for (const [jobId, job] of this.activeJobs) {
        try {
          const state = await job.getState();
          if (state === 'completed' || state === 'failed') {
            this.activeJobs.delete(jobId);
          }
        } catch (error) {
          // Job ya no existe
          this.activeJobs.delete(jobId);
        }
      }

      this.logger.debug('Limpieza rutinaria completada');
    } catch (error) {
      this.logger.error('Error en limpieza rutinaria:', error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  private async emergencyCleanup() {
    this.logger.warn('Ejecutando limpieza de emergencia por memoria alta...');
    
    try {
      // 1. Limpiar TODOS los jobs completados
      for (const [queueName, queue] of this.queues) {
        await queue.clean(0, 1000, 'completed');
        await queue.clean(WORKFLOW_CONFIG.JOB_REMOVE_ON_FAIL_AGE * 1000, 1000, 'failed');
      }

      // 2. Limpiar mapas internos
      this.activeJobs.clear();

      // 3. Forzar limpieza de Redis
      await this.cleanupRedisData();

      this.logger.log('Limpieza de emergencia completada');
    } catch (error) {
      this.logger.error('Error en limpieza de emergencia:', error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  private async cleanupRedisData() {
    if (!this.redisConnection || !this.isRedisAvailable) return;

    try {
      // Limpiar keys antiguas de jobs completados
      const keys = await this.redisConnection.keys('bull:*:completed:*');
      
      if (keys.length > 0) {
        // Eliminar en lotes de 100
        for (let i = 0; i < keys.length; i += 100) {
          const batch = keys.slice(i, i + 100);
          await this.redisConnection.del(...batch);
        }
        
        this.logger.log(`Limpiadas ${keys.length} keys antiguas de Redis`);
      }
    } catch (error) {
      this.logger.error('Error limpiando datos de Redis:', error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  private async stopWorkflowEngine() {
    this.logger.log('Deteniendo workflow engine...');
    
    // Detener todos los workers primero
    const workerPromises = Array.from(this.workers.values()).map(worker => 
      worker.close().catch(err => this.logger.error('Error cerrando worker:', err))
    );
    await Promise.all(workerPromises);

    // Cerrar eventos
    const eventPromises = Array.from(this.queueEvents.values()).map(events =>
      events.close().catch(err => this.logger.error('Error cerrando eventos:', err))
    );
    await Promise.all(eventPromises);

    // Cerrar todas las colas
    const queuePromises = Array.from(this.queues.values()).map(queue => 
      queue.close().catch(err => this.logger.error('Error cerrando cola:', err))
    );
    await Promise.all(queuePromises);

    // Limpiar mapas
    this.workers.clear();
    this.queues.clear();
    this.queueEvents.clear();
    this.activeJobs.clear();
    this.workflows.clear();

    // Cerrar conexión a Redis
    if (this.redisConnection) {
      await this.redisConnection.disconnect();
      this.redisConnection = null;
    }

    this.logger.log('Workflow engine detenido');
    this.logger.log(`Métricas finales: ${JSON.stringify(this.metrics)}`);
  }

  private registerWorkflow(workflow: WorkflowDefinition) {
    this.workflows.set(workflow.id, workflow);

    if (!this.isRedisAvailable || !this.redisConnection) {
      this.logger.warn(`Workflow ${workflow.id} registrado en modo sin colas`);
      return;
    }

    // Crear cola para cada paso del workflow
    for (const [stepId, step] of workflow.steps) {
      const queueName = `${workflow.id}-${stepId}`;

      // Crear cola con conexión a Redis y configuración optimizada
      const queue = new Queue(queueName, {
        connection: {
          host: this.configService.redisConfig.host,
          port: this.configService.redisConfig.port,
          password: this.configService.redisConfig.password,
          username: this.configService.redisConfig.username,
        },
        defaultJobOptions: {
          attempts: WORKFLOW_CONFIG.JOB_ATTEMPTS,
          backoff: {
            type: 'exponential',
            delay: WORKFLOW_CONFIG.JOB_BACKOFF_DELAY,
          },
          removeOnComplete: {
            age: WORKFLOW_CONFIG.JOB_REMOVE_ON_COMPLETE_AGE,
            count: WORKFLOW_CONFIG.JOB_REMOVE_ON_COMPLETE_COUNT,
          },
          removeOnFail: {
            age: WORKFLOW_CONFIG.JOB_REMOVE_ON_FAIL_AGE,
            count: WORKFLOW_CONFIG.JOB_REMOVE_ON_FAIL_COUNT,
          },
        },
      });

      this.queues.set(queueName, queue);

      // Crear eventos para monitoreo
      const queueEvents = new QueueEvents(queueName, {
        connection: {
          host: this.configService.redisConfig.host,
          port: this.configService.redisConfig.port,
          password: this.configService.redisConfig.password,
          username: this.configService.redisConfig.username,
        },
      });

      // Escuchar eventos para limpieza
      queueEvents.on('completed', async ({ jobId }) => {
        this.activeJobs.delete(jobId);
        this.metrics.totalJobsProcessed++;
      });

      queueEvents.on('failed', async ({ jobId }) => {
        this.activeJobs.delete(jobId);
        this.metrics.totalJobsFailed++;
      });

      this.queueEvents.set(queueName, queueEvents);

      // Crear worker
      const worker = new Worker(
        queueName,
        async (job: Job) => {
          const startTime = Date.now();
          
          try {
            // Registrar job activo
            this.activeJobs.set(job.id!, job);
            this.metrics.activeWorkers++;

            this.logger.log(`Ejecutando paso ${stepId} del workflow ${workflow.id} - Job: ${job.id}`);

            // Actualizar estado en BD
            const execution = await this.executionRepository.findByJobId(job.id!);
            if (execution) {
              await this.executionRepository.update(execution.id, {
                status: 'running',
                outputData: { 
                  ...execution.outputData,
                  currentStep: stepId,
                  lastUpdate: new Date(),
                },
              });
            }

            // Ejecutar el handler del paso con timeout
            const result = await this.executeWithTimeout(
              step.handler(job.data),
              step.timeout || 300000 // 5 minutos por defecto
            );
            
            // Actualizar progreso en BD
            if (execution) {
              const updateData: any = {
                outputData: {
                  ...result,
                  currentStep: stepId,
                  lastUpdate: new Date(),
                  processingTime: Date.now() - startTime,
                },
              };
              
              if (result._workflowActive !== false) {
                updateData.status = 'running';
              }
              
              await this.executionRepository.update(execution.id, updateData);
            }

            // Si hay siguiente paso, agregarlo a la cola
            if (step.nextStep && result._workflowActive !== false) {
              const nextQueueName = `${workflow.id}-${step.nextStep}`;
              const nextQueue = this.queues.get(nextQueueName);

              if (nextQueue) {
                const nextJob = await nextQueue.add(
                  `step-${step.nextStep}`,
                  result,
                  {
                    delay: step.delay || 0,
                  }
                );
                
                this.logger.log(`Siguiente paso agregado: ${step.nextStep}, Job ID: ${nextJob.id}`);
              }
            } else if (!step.nextStep || result._workflowCompleted === true) {
              // Workflow completado - limpiar datos
              if (execution) {
                await this.executionRepository.update(execution.id, {
                  status: 'completed',
                  outputData: result,
                  completedAt: new Date(),
                });

                // Programar limpieza del job completado
                setTimeout(async () => {
                  try {
                    await job.remove();
                    this.logger.debug(`Job ${job.id} removido después de completar`);
                  } catch (error) {
                    // Job ya fue removido
                  }
                }, 5000); // Esperar 5 segundos antes de limpiar
              }
            }

            return result;
          } catch (error) {
            this.logger.error(`Error en paso ${stepId}:`, error);

            const execution = await this.executionRepository.findByJobId(job.id!);
            if (execution) {
              await this.executionRepository.update(execution.id, {
                status: 'failed',
                error: error instanceof Error ? error.message : 'Error desconocido',
              });
            }

            throw error;
          } finally {
            // Siempre limpiar el job de la lista activa
            this.activeJobs.delete(job.id!);
            this.metrics.activeWorkers--;
          }
        },
        {
          connection: {
            host: this.configService.redisConfig.host,
            port: this.configService.redisConfig.port,
            password: this.configService.redisConfig.password,
            username: this.configService.redisConfig.username,
          },
          concurrency: WORKFLOW_CONFIG.WORKER_CONCURRENCY,
          limiter: {
            max: 100,
            duration: 60000,
          },
          // Configuración para prevenir memory leaks
          stalledInterval: 30000,
          maxStalledCount: 1,
        },
      );

      // Manejar errores del worker
      worker.on('error', (error) => {
        this.logger.error(`Error en worker ${queueName}:`, error);
      });

      worker.on('stalled', (jobId) => {
        this.logger.warn(`Job estancado: ${jobId} en ${queueName}`);
        this.activeJobs.delete(jobId);
      });

      this.workers.set(queueName, worker);
    }
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout de ejecución')), timeout)
      ),
    ]);
  }

  async startWorkflow(workflowId: string, data: any): Promise<string> {
    try {
      const workflow = this.workflows.get(workflowId);

      if (!workflow) {
        throw new Error(`Workflow no encontrado: ${workflowId}`);
      }

      // Verificar memoria antes de iniciar
      const memUsage = process.memoryUsage();
      const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      if (heapUsedPercent > WORKFLOW_CONFIG.MAX_MEMORY_USAGE_PERCENT) {
        throw new Error('Sistema con memoria alta. Intente más tarde.');
      }

      if (!this.isRedisAvailable) {
        this.logger.warn('Ejecutando workflow sin colas (Redis no disponible)');
        const result = await this.executeWorkflowSync(workflowId, data);

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

      // Verificar tamaño de la cola
      const queueSize = await startQueue.count();
      if (queueSize > WORKFLOW_CONFIG.MAX_QUEUE_SIZE) {
        throw new Error(`Cola saturada: ${queueSize} jobs en espera`);
      }

      const job = await startQueue.add(
        `start-${workflow.startStep}`,
        data,
        {
          priority: 1,
        }
      );

      const execution = await this.executionRepository.create({
        workflowId,
        jobId: job.id!,
        status: 'pending',
        inputData: data,
      });

      this.logger.log(`Workflow iniciado: ${workflowId}, job: ${job.id}, execution: ${execution.id}`);
      
      return execution.id;
    } catch (error) {
      this.logger.error(`Error al iniciar workflow ${workflowId}:`, error);
      throw error;
    }
  }

  // Resto de métodos permanecen igual...

  async getWorkflowStatus(executionId: string): Promise<any> {
    try {
      const execution = await this.executionRepository.findById(executionId);

      if (!execution) {
        const byJob = await this.executionRepository.findByJobId(executionId);
        if (byJob) {
          return this.mapExecutionToStatus(byJob);
        }
        return null;
      }

      if (this.isRedisAvailable && execution.jobId) {
        for (const [queueName, queue] of this.queues) {
          const job = await queue.getJob(execution.jobId);
          if (job) {
            const state = await job.getState();

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

      return this.mapExecutionToStatus(execution);
    } catch (error) {
      this.logger.error(`Error obteniendo estado del workflow ${executionId}:`, error);
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
      // Encontrar y eliminar todos los jobs relacionados
      for (const [queueName, queue] of this.queues) {
        const job = await queue.getJob(execution.jobId);
        if (job) {
          // Eliminar job inmediatamente
          await job.remove();
          this.activeJobs.delete(job.id!);
          
          await this.executionRepository.update(execution.id, {
            status: 'cancelled',
            completedAt: new Date(),
          });
          
          this.logger.log(`Workflow terminado y limpiado: ${executionId}`);
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
    let stepCount = 0;
    const maxSteps = 100;

    while (currentStep && stepCount < maxSteps) {
      const step = workflow.steps.get(currentStep);

      if (!step) {
        break;
      }

      this.logger.log(`Test: Ejecutando paso ${currentStep}`);

      if (step.delay) {
        await new Promise((resolve) => setTimeout(resolve, step.delay));
      }

      data = await step.handler(data);
      
      if (data._workflowCompleted === true || data._workflowActive === false) {
        break;
      }
      
      currentStep = step.nextStep || '';
      stepCount++;
    }

    if (stepCount >= maxSteps) {
      this.logger.warn('Test: Límite de pasos alcanzado, deteniendo ejecución');
    }

    return {
      success: true,
      instanceId: `test-${Date.now()}`,
      data,
      completedAt: new Date(),
      stepsExecuted: stepCount,
    };
  }

  async getQueueStats(): Promise<any> {
    if (!this.isRedisAvailable) {
      return { message: 'Redis no disponible' };
    }

    const stats: any = {
      queues: {},
      system: {
        totalJobsProcessed: this.metrics.totalJobsProcessed,
        totalJobsFailed: this.metrics.totalJobsFailed,
        activeWorkers: this.metrics.activeWorkers,
        activeJobs: this.activeJobs.size,
        memoryUsage: `${this.metrics.memoryUsage.toFixed(2)}%`,
        redisMemoryUsage: `${this.metrics.redisMemoryUsage.toFixed(2)}%`,
        maxConcurrency: WORKFLOW_CONFIG.WORKER_CONCURRENCY,
      },
    };

    for (const [name, queue] of this.queues) {
      const counts = await queue.getJobCounts();
      stats.queues[name] = counts;
    }

    return stats;
  }

  async getExecutionHistory(): Promise<any[]> {
    const executions = await this.executionRepository.findAll();
    return executions.map((e) => this.mapExecutionToStatus(e));
  }

  getCapacityInfo(): any {
    const totalWorkers = this.workers.size;
    const maxThroughput = totalWorkers * WORKFLOW_CONFIG.WORKER_CONCURRENCY;
    const memUsage = process.memoryUsage();
    
    return {
      configuration: {
        workerConcurrency: WORKFLOW_CONFIG.WORKER_CONCURRENCY,
        maxWorkersPerWorkflow: WORKFLOW_CONFIG.MAX_WORKERS_PER_WORKFLOW,
        maxQueueSize: WORKFLOW_CONFIG.MAX_QUEUE_SIZE,
        jobRetention: {
          completedAge: `${WORKFLOW_CONFIG.JOB_REMOVE_ON_COMPLETE_AGE} segundos`,
          completedCount: WORKFLOW_CONFIG.JOB_REMOVE_ON_COMPLETE_COUNT,
          failedAge: `${WORKFLOW_CONFIG.JOB_REMOVE_ON_FAIL_AGE} segundos`,
          failedCount: WORKFLOW_CONFIG.JOB_REMOVE_ON_FAIL_COUNT,
        },
      },
      current: {
        totalWorkers,
        activeJobs: this.metrics.activeWorkers,
        maxThroughput,
        utilizationPercent: (this.metrics.activeWorkers / maxThroughput) * 100,
      },
      memory: {
        heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsagePercent: `${this.metrics.memoryUsage.toFixed(2)}%`,
        redisUsagePercent: `${this.metrics.redisMemoryUsage.toFixed(2)}%`,
        maxAllowed: `${WORKFLOW_CONFIG.MAX_MEMORY_USAGE_PERCENT}%`,
      },
      metrics: this.metrics,
      capacity: {
        message: `Sistema puede procesar hasta ${maxThroughput} jobs en paralelo`,
        perWorkflowCapacity: WORKFLOW_CONFIG.WORKER_CONCURRENCY * WORKFLOW_CONFIG.MAX_WORKERS_PER_WORKFLOW,
      },
    };
  }

  // Limpieza manual bajo demanda
  async forceCleanup(): Promise<void> {
    this.logger.log('Ejecutando limpieza manual...');
    await this.performCleanup();
    await this.checkMemoryUsage();
  }

  // Método para cron job
  @Cron(CronExpression.EVERY_HOUR)
  async hourlyCleanup() {
    this.logger.log('Ejecutando limpieza horaria programada...');
    await this.performCleanup();
  }
}
