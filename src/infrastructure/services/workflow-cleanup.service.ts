// src/infrastructure/services/workflow-cleanup.service.ts

import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  IWorkflowCleanup,
  CleanupConfig,
} from '../../domain/interfaces/workflow-cleanup.interface';
import { IWorkflowExecutionRepository } from '../../domain/interfaces/workflow-execution.repository.interface';
import { IQueueManager } from '../../domain/interfaces/queue-manager.interface';
import { IRedisConnection } from '../../domain/interfaces/redis-connection.interface';

@Injectable()
export class WorkflowCleanupService implements IWorkflowCleanup {
  private readonly logger = new Logger(WorkflowCleanupService.name);

  private readonly config: CleanupConfig = {
    executionRetentionDays: 7,
    jobRetentionMinutes: 5,
    redisKeyRetentionHours: 24,
  };

  constructor(
    @Inject('IWorkflowExecutionRepository')
    private readonly executionRepository: IWorkflowExecutionRepository,
    @Inject('IQueueManager')
    private readonly queueManager: IQueueManager,
    @Inject('IRedisConnection')
    private readonly redisConnection: IRedisConnection,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async performScheduledCleanup(): Promise<void> {
    this.logger.log('Starting scheduled cleanup...');
    await this.cleanupOldExecutions();
    await this.cleanupCompletedJobs();
    this.logger.log('Scheduled cleanup completed');
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async performDeepCleanup(): Promise<void> {
    this.logger.log('Starting deep cleanup...');
    await this.cleanupOldExecutions();
    await this.cleanupCompletedJobs();
    await this.cleanupRedisKeys();
    this.logger.log('Deep cleanup completed');
  }

  async cleanupOldExecutions(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(
        cutoffDate.getDate() - this.config.executionRetentionDays,
      );

      const deletedCount =
        await this.executionRepository.deleteOldExecutions(cutoffDate);

      if (deletedCount > 0) {
        this.logger.log(`Deleted ${deletedCount} old executions`);
      }

      return deletedCount;
    } catch (error) {
      this.logger.error('Error cleaning up old executions:', error);
      return 0;
    }
  }

  async cleanupCompletedJobs(): Promise<void> {
    try {
      const queues = this.queueManager.getActiveQueues();

      for (const queueName of queues) {
        const queue = this.queueManager.getQueue(queueName);
        if (!queue) continue;

        try {
          const completed = await queue.getCompleted();
          const now = Date.now();
          const retentionMs = this.config.jobRetentionMinutes * 60 * 1000;

          const toRemove = completed.filter((job: any) => {
            const age = now - (job.finishedOn || 0);
            return age > retentionMs;
          });

          for (const job of toRemove) {
            await job.remove();
          }

          if (toRemove.length > 0) {
            this.logger.debug(
              `Removed ${toRemove.length} completed jobs from ${queueName}`,
            );
          }
        } catch (error) {
          this.logger.error(`Error cleaning queue ${queueName}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error cleaning up completed jobs:', error);
    }
  }

  async cleanupRedisKeys(): Promise<void> {
    if (!this.redisConnection.isRedisAvailable) return;

    try {
      const connection = await this.redisConnection.getConnection('cleanup');
      if (!connection) return;

      const keys = await connection.keys('bull:*:completed:*');

      if (keys.length > 0) {
        for (let i = 0; i < keys.length; i += 100) {
          const batch = keys.slice(i, i + 100);
          await connection.del(...batch);
        }

        this.logger.log(`Cleaned ${keys.length} old Redis keys`);
      }
    } catch (error) {
      this.logger.error('Error cleaning Redis keys:', error);
    }
  }

  async forceCleanup(): Promise<void> {
    this.logger.log('Forcing immediate cleanup...');

    await this.cleanupOldExecutions();
    await this.cleanupCompletedJobs();
    await this.cleanupRedisKeys();

    await this.queueManager.cleanAllQueues(0);

    if (global.gc) {
      global.gc();
      this.logger.log('Garbage collection triggered');
    }

    this.logger.log('Forced cleanup completed');
  }

  async emergencyCleanup(): Promise<void> {
    this.logger.warn('EMERGENCY CLEANUP TRIGGERED');

    try {
      const queues = this.queueManager.getActiveQueues();
      for (const queueName of queues) {
        await this.queueManager.cleanQueue(queueName, 0);
      }

      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 1);
      await this.executionRepository.deleteOldExecutions(oldDate);

      if (global.gc) {
        global.gc();
      }

      this.logger.log('Emergency cleanup completed');
    } catch (error) {
      this.logger.error('Error during emergency cleanup:', error);
    }
  }

  setRetentionDays(days: number): void {
    this.config.executionRetentionDays = days;
    this.logger.log(`Execution retention set to ${days} days`);
  }

  getCleanupConfig(): CleanupConfig {
    return { ...this.config };
  }
}
