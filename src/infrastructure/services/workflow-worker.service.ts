// src/infrastructure/services/workflow-worker.service.ts

import { Injectable, Logger, OnModuleDestroy, Inject } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { WorkflowExecutionRepository } from '../repositories/workflow-execution.repository';
import { IWorkflowExecutor } from '../../domain/interfaces/workflow-executor.interface';
import { IQueueManager } from '../../domain/interfaces/queue-manager.interface';
import { IWorkflowWorker } from '../../domain/interfaces/workflow-worker.interface';

export interface WorkerConfig {
  concurrency: number;
  maxStalledCount: number;
  stalledInterval: number;
}

@Injectable()
export class WorkflowWorkerService implements OnModuleDestroy, IWorkflowWorker {
  private readonly logger = new Logger(WorkflowWorkerService.name);
  private workers: Map<string, Worker> = new Map();
  private activeJobs: Map<string, Job> = new Map();

  private readonly defaultConfig: WorkerConfig = {
    concurrency: 100,
    maxStalledCount: 1,
    stalledInterval: 30000,
  };

  constructor(
    @Inject('IWorkflowExecutor')
    private readonly executorService: IWorkflowExecutor,
    @Inject('IWorkflowExecutionRepository')
    private readonly executionRepository: WorkflowExecutionRepository,
    @Inject('IQueueManager')
    private readonly queueManager: IQueueManager,
  ) {}

  async onModuleDestroy() {
    await this.stopAllWorkers();
  }

  async createWorker(
    workflowId: string,
    stepId: string,
    config?: Partial<WorkerConfig>,
  ): Promise<Worker | null> {
    const queueName = `${workflowId}-${stepId}`;

    if (this.workers.has(queueName)) {
      return this.workers.get(queueName)!;
    }

    const queue = this.queueManager.getQueue(queueName);
    if (!queue) {
      this.logger.error(`Queue not found: ${queueName}`);
      return null;
    }

    const mergedConfig = { ...this.defaultConfig, ...config };

    const worker = new Worker(
      queueName,
      async (job: Job) => {
        return await this.processJob(workflowId, stepId, job);
      },
      {
        connection: queue.opts.connection as any,
        concurrency: mergedConfig.concurrency,
        stalledInterval: mergedConfig.stalledInterval,
        maxStalledCount: mergedConfig.maxStalledCount,
        limiter: {
          max: 100,
          duration: 60000,
        },
      },
    );

    worker.on('error', (error) => {
      this.logger.error(`Worker error in ${queueName}:`, error);
    });

    worker.on('stalled', (jobId) => {
      this.logger.warn(`Job stalled: ${jobId} in ${queueName}`);
      this.activeJobs.delete(jobId);
    });

    worker.on('completed', (job) => {
      this.activeJobs.delete(job.id!);
    });

    worker.on('failed', (job) => {
      if (job) {
        this.activeJobs.delete(job.id!);
      }
    });

    this.workers.set(queueName, worker);
    this.logger.log(`Worker created for: ${queueName}`);

    return worker;
  }

  private async processJob(
    workflowId: string,
    stepId: string,
    job: Job,
  ): Promise<any> {
    const startTime = Date.now();

    try {
      this.activeJobs.set(job.id!, job);

      this.logger.log(
        `Processing step ${stepId} of workflow ${workflowId} - Job: ${job.id}`,
      );

      let execution = null;
      if (job.data.executionId) {
        execution = await this.executionRepository.findById(
          job.data.executionId,
        );
      } else {
        execution = await this.executionRepository.findByJobId(job.id!);
      }

      if (execution) {
        await this.executionRepository.updateById(execution.id.toString(), {
          status: 'running',
          outputData: {
            ...execution.outputData,
            currentStep: stepId,
            lastUpdate: new Date(),
          },
        });
      }

      const result = await this.executorService.executeStep(
        workflowId,
        stepId,
        job.data,
        execution?.id.toString() || job.id!,
      );

      if (execution) {
        result.executionId = execution.id.toString();
      }

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
        } else if (result._workflowCompleted === true) {
          updateData.status = 'completed';
        }

        await this.executionRepository.updateById(
          execution.id.toString(),
          updateData,
        );
      }

      const workflow = this.executorService.getWorkflow(workflowId);
      const step = workflow?.steps.get(stepId);
      const nextStepName = result._nextStep || step?.nextStep;

      if (nextStepName && result._workflowActive !== false) {
        const nextQueue = this.queueManager.getQueue(
          `${workflowId}-${nextStepName}`,
        );

        if (nextQueue) {
          const nextJob = await nextQueue.add(`step-${nextStepName}`, result, {
            delay: step?.delay || 0,
          });

          this.logger.log(
            `Next step queued: ${nextStepName}, Job ID: ${nextJob.id}`,
          );
        }
      } else if (!nextStepName || result._workflowCompleted === true) {
        if (execution) {
          await this.executionRepository.updateById(execution.id.toString(), {
            status: 'completed',
            outputData: result,
            completedAt: new Date(),
          });
        }

        setTimeout(async () => {
          try {
            await job.remove();
            this.logger.debug(`Job ${job.id} removed after completion`);
          } catch (error) {
            // Job already removed
          }
        }, 5000);
      }

      return result;
    } catch (error) {
      this.logger.error(`Error in step ${stepId}:`, error);

      const execution = await this.executionRepository.findByJobId(job.id!);
      if (execution) {
        await this.executionRepository.updateById(execution.id.toString(), {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      throw error;
    } finally {
      this.activeJobs.delete(job.id!);
    }
  }

  async stopWorker(queueName: string): Promise<void> {
    const worker = this.workers.get(queueName);
    if (worker) {
      await worker.close();
      this.workers.delete(queueName);
      this.logger.log(`Worker stopped: ${queueName}`);
    }
  }

  async stopAllWorkers(): Promise<void> {
    this.logger.log('Stopping all workers...');

    const promises = Array.from(this.workers.values()).map((worker) =>
      worker
        .close()
        .catch((err) => this.logger.error('Error closing worker:', err)),
    );

    await Promise.all(promises);
    this.workers.clear();
    this.activeJobs.clear();

    this.logger.log('All workers stopped');
  }

  getActiveJobsCount(): number {
    return this.activeJobs.size;
  }

  getWorkerCount(): number {
    return this.workers.size;
  }

  getWorkerNames(): string[] {
    return Array.from(this.workers.keys());
  }
}
