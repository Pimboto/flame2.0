// src/infrastructure/workflow-engine.service.ts

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { WorkflowExecution } from '../domain/entities/workflow-execution';
import { safeAutomationWorkflow } from '../domain/workflows/examples/safe-automation-workflow';
import { createImportAccountsWorkflow } from '../domain/workflows/import-accounts-workflow'; // CORREGIDO
import { IWorkflowExecutor } from '../domain/interfaces/workflow-executor.interface';
import { IWorkflowWorker } from '../domain/interfaces/workflow-worker.interface';
import { IWorkflowMonitor } from '../domain/interfaces/workflow-monitor.interface';
import { IWorkflowCleanup } from '../domain/interfaces/workflow-cleanup.interface';
import { IQueueManager } from '../domain/interfaces/queue-manager.interface';
import { IRedisConnection } from '../domain/interfaces/redis-connection.interface';
import { IWorkflowExecutionRepository } from '../domain/interfaces/workflow-execution.repository.interface';

const WORKFLOW_CONFIG = {
  WORKER_CONCURRENCY: 100,
  MAX_WORKERS_PER_WORKFLOW: 5,
  JOB_ATTEMPTS: 3,
  JOB_BACKOFF_DELAY: 2000,
  MAX_QUEUE_SIZE: 10000,
};

@Injectable()
export class WorkflowEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowEngineService.name);
  private isInitialized = false;

  constructor(
    @Inject('IWorkflowExecutor')
    private readonly executorService: IWorkflowExecutor,
    @Inject('IWorkflowWorker')
    private readonly workerService: IWorkflowWorker,
    @Inject('IWorkflowMonitor')
    private readonly monitorService: IWorkflowMonitor,
    @Inject('IWorkflowCleanup')
    private readonly cleanupService: IWorkflowCleanup,
    @Inject('IQueueManager')
    private readonly queueManager: IQueueManager,
    @Inject('IRedisConnection')
    private readonly redisConnection: IRedisConnection,
    @Inject('IWorkflowExecutionRepository')
    private readonly executionRepository: IWorkflowExecutionRepository,
  ) {}

  async onModuleInit() {
    await this.initializeWorkflowEngine();
  }

  async onModuleDestroy() {
    await this.stopWorkflowEngine();
  }

  private async initializeWorkflowEngine() {
    try {
      const connection = await this.redisConnection.getConnection();

      if (!connection) {
        this.logger.warn(
          'Redis not available, workflows will run in sync mode',
        );
        this.isInitialized = false;
        return;
      }

      this.registerWorkflows();
      await this.initializeQueuesAndWorkers();

      this.isInitialized = true;
      this.logger.log('Workflow engine initialized successfully');
      this.logger.log(
        `Configuration: ${JSON.stringify({
          workerConcurrency: WORKFLOW_CONFIG.WORKER_CONCURRENCY,
          maxWorkersPerWorkflow: WORKFLOW_CONFIG.MAX_WORKERS_PER_WORKFLOW,
        })}`,
      );
    } catch (error) {
      this.logger.error('Error initializing workflow engine:', error);
      this.isInitialized = false;
    }
  }

  private registerWorkflows(): void {
    // Register pure workflow definitions
    this.executorService.registerWorkflow(safeAutomationWorkflow);
    this.executorService.registerWorkflow(createImportAccountsWorkflow()); // CORREGIDO - llamar la función

    this.logger.log('Workflows registered');
  }

  private async initializeQueuesAndWorkers(): Promise<void> {
    const workflows = this.executorService.getAllWorkflows();

    for (const workflow of workflows) {
      for (const [stepId] of workflow.steps) {
        const queueName = `${workflow.id}-${stepId}`;

        const queue = await this.queueManager.createQueue(queueName, {
          attempts: WORKFLOW_CONFIG.JOB_ATTEMPTS,
          backoffDelay: WORKFLOW_CONFIG.JOB_BACKOFF_DELAY,
        });

        if (queue) {
          await this.workerService.createWorker(workflow.id, stepId, {
            concurrency: WORKFLOW_CONFIG.WORKER_CONCURRENCY,
          });
        }
      }

      this.logger.log(
        `Initialized ${workflow.steps.size} queues and workers for ${workflow.id}`,
      );
    }
  }

  // ... resto del código sin cambios ...

  private async stopWorkflowEngine() {
    this.logger.log('Stopping workflow engine...');

    await this.workerService.stopAllWorkers();
    await this.queueManager.closeAll();
    await this.redisConnection.closeAll();

    this.isInitialized = false;
    this.logger.log('Workflow engine stopped');
  }

  async startWorkflow(workflowId: string, data: any): Promise<string> {
    try {
      const workflow = this.executorService.getWorkflow(workflowId);

      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      if (!this.monitorService.isMemoryHealthy()) {
        throw new Error(
          'System memory usage is too high. Please try again later.',
        );
      }

      if (!this.isInitialized || !this.redisConnection.isRedisAvailable) {
        this.logger.warn('Running workflow in sync mode (Redis not available)');
        const result = await this.executorService.executeWorkflowSync(
          workflowId,
          data,
        );

        const execution = WorkflowExecution.create(
          workflowId,
          result.instanceId,
          data,
        );
        execution.complete(result.data);

        const savedExecution = await this.executionRepository.create(execution);
        return savedExecution.id.toString();
      }

      const startQueueName = `${workflowId}-${workflow.startStep}`;
      const startQueue = this.queueManager.getQueue(startQueueName);

      if (!startQueue) {
        throw new Error(`Start queue not found: ${startQueueName}`);
      }

      const queueSize = await startQueue.count();
      if (queueSize > WORKFLOW_CONFIG.MAX_QUEUE_SIZE) {
        throw new Error(`Queue is full: ${queueSize} jobs waiting`);
      }

      const execution = WorkflowExecution.create(workflowId, 'pending', data);
      const savedExecution = await this.executionRepository.create(execution);

      const jobData = {
        ...data,
        executionId: savedExecution.id.toString(),
      };

      const job = await startQueue.add(`start-${workflow.startStep}`, jobData, {
        priority: 1,
      });

      await this.executionRepository.updateById(savedExecution.id.toString(), {
        jobId: job.id!,
      });

      this.logger.log(
        `Workflow started: ${workflowId}, job: ${job.id}, execution: ${savedExecution.id.toString()}`,
      );

      return savedExecution.id.toString();
    } catch (error) {
      this.logger.error(`Error starting workflow ${workflowId}:`, error);
      throw error;
    }
  }

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

      const outputData = execution.outputData || {};
      const inputData = execution.inputData || {};
      const fullData = { ...inputData, ...outputData };

      return {
        id: execution.id.toString(),
        jobId: execution.jobId,
        workflowId: execution.workflowId,
        status: execution.status,
        data: fullData,
        currentStep: outputData.currentStep || 'initialize',
        iteration: fullData.iteration || 0,
        messages: fullData.messages || [],
        history: fullData.history || [],
        createTime: execution.createdAt,
        lastUpdate: outputData.lastUpdate || execution.updatedAt,
        finishedOn: execution.completedAt,
        error: execution.error,
        isLooping: execution.workflowId === 'safe-automation-workflow',
        progress: this.calculateProgress(fullData, execution.workflowId),
      };
    } catch (error) {
      this.logger.error(`Error getting workflow status ${executionId}:`, error);
      throw error;
    }
  }

  private calculateProgress(data: any, workflowId: string): string {
    if (workflowId === 'safe-automation-workflow') {
      const iteration = data.iteration || 0;
      const maxIterations = data.maxIterations || 10;
      const percentage = Math.min((iteration / maxIterations) * 100, 100);
      return `${percentage.toFixed(0)}% (Iteration ${iteration}/${maxIterations})`;
    }
    return 'N/A';
  }

  private mapExecutionToStatus(execution: WorkflowExecution): any {
    return {
      id: execution.id.toString(),
      jobId: execution.jobId,
      workflowId: execution.workflowId,
      status: execution.status,
      data: execution.outputData || execution.inputData,
      createTime: execution.createdAt,
      finishedOn: execution.completedAt,
      error: execution.error,
    };
  }

  async suspendWorkflow(executionId: string): Promise<void> {
    const execution = await this.executionRepository.findById(executionId);

    if (!execution) {
      throw new Error('Execution not found');
    }

    if (!this.isInitialized) {
      this.logger.warn('Cannot suspend workflow without Redis');
      return;
    }

    const queue = this.queueManager.getQueue(`${execution.workflowId}-*`);
    if (queue) {
      await queue.pause();
      await this.executionRepository.updateById(execution.id.toString(), {
        status: 'cancelled',
      });
      this.logger.log(`Workflow suspended: ${executionId}`);
    }
  }

  async resumeWorkflow(executionId: string): Promise<void> {
    const execution = await this.executionRepository.findById(executionId);

    if (!execution) {
      throw new Error('Execution not found');
    }

    if (!this.isInitialized) {
      this.logger.warn('Cannot resume workflow without Redis');
      return;
    }

    const queue = this.queueManager.getQueue(`${execution.workflowId}-*`);
    if (queue) {
      await queue.resume();
      await this.executionRepository.updateById(execution.id.toString(), {
        status: 'running',
      });
      this.logger.log(`Workflow resumed: ${executionId}`);
    }
  }

  async terminateWorkflow(executionId: string): Promise<void> {
    const execution = await this.executionRepository.findById(executionId);

    if (!execution) {
      throw new Error('Execution not found');
    }

    await this.executionRepository.updateById(execution.id.toString(), {
      status: 'cancelled',
      completedAt: new Date(),
    });

    if (this.isInitialized) {
      const queue = this.queueManager.getQueue(`${execution.workflowId}-*`);
      if (queue) {
        const job = await queue.getJob(execution.jobId);
        if (job) {
          await job.remove();
        }
      }
    }

    this.logger.log(`Workflow terminated: ${executionId}`);
  }

  async testWorkflow(workflowId: string, testData: any): Promise<any> {
    const result = await this.executorService.executeWorkflowSync(
      workflowId,
      testData,
    );

    const execution = WorkflowExecution.create(
      workflowId,
      result.instanceId,
      testData,
    );
    execution.complete(result.data);

    const savedExecution = await this.executionRepository.create(execution);

    return {
      ...result,
      executionId: savedExecution.id.toString(),
    };
  }

  async getQueueStats(): Promise<any> {
    if (!this.isInitialized) {
      return { message: 'Redis not available' };
    }

    const stats: any = {
      queues: {},
      system: this.monitorService.getMetrics(),
    };

    const queueNames = this.queueManager.getActiveQueues();
    for (const name of queueNames) {
      stats.queues[name] = await this.queueManager.getQueueStats(name);
    }

    return stats;
  }

  async getExecutionHistory(): Promise<any[]> {
    const executions = await this.executionRepository.findAll();
    return executions.map((e) => this.mapExecutionToStatus(e));
  }

  getCapacityInfo(): any {
    const metrics = this.monitorService.getMetrics();
    const workerCount = this.workerService.getWorkerCount();
    const maxThroughput = workerCount * WORKFLOW_CONFIG.WORKER_CONCURRENCY;

    return {
      configuration: {
        workerConcurrency: WORKFLOW_CONFIG.WORKER_CONCURRENCY,
        maxWorkersPerWorkflow: WORKFLOW_CONFIG.MAX_WORKERS_PER_WORKFLOW,
        maxQueueSize: WORKFLOW_CONFIG.MAX_QUEUE_SIZE,
      },
      current: {
        totalWorkers: workerCount,
        activeJobs: this.workerService.getActiveJobsCount(),
        maxThroughput,
        utilizationPercent:
          (this.workerService.getActiveJobsCount() / maxThroughput) * 100,
      },
      memory: this.monitorService.getMemoryInfo(),
      metrics: metrics,
    };
  }

  async forceCleanup(): Promise<void> {
    await this.cleanupService.forceCleanup();
  }
}
