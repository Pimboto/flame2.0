// src/infrastructure/services/queue-manager.service.ts
// FIX para el error de duplicación de colas

import { Injectable, Logger, OnModuleDestroy, Inject } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import { IQueueManager } from '../../domain/interfaces/queue-manager.interface';
import { IRedisConnection } from '../../domain/interfaces/redis-connection.interface';

export interface QueueConfig {
  attempts?: number;
  backoffDelay?: number;
  removeOnCompleteAge?: number;
  removeOnCompleteCount?: number;
  removeOnFailAge?: number;
  removeOnFailCount?: number;
}

@Injectable()
export class QueueManagerService implements OnModuleDestroy, IQueueManager {
  private readonly logger = new Logger(QueueManagerService.name);
  private queues: Map<string, Queue> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();

  private readonly defaultConfig: QueueConfig = {
    attempts: 3,
    backoffDelay: 2000,
    removeOnCompleteAge: 300,
    removeOnCompleteCount: 10,
    removeOnFailAge: 3600,
    removeOnFailCount: 50,
  };

  constructor(
    @Inject('IRedisConnection')
    private readonly redisConnection: IRedisConnection,
  ) {}

  async onModuleDestroy() {
    await this.closeAll();
  }

  async createQueue(name: string, config?: QueueConfig): Promise<Queue | null> {
    // Check if queue already exists
    if (this.queues.has(name)) {
      this.logger.debug(
        `Queue ${name} already exists, returning existing instance`,
      );
      return this.queues.get(name)!;
    }

    if (!this.redisConnection.isRedisAvailable) {
      this.logger.warn(`Cannot create queue ${name}: Redis not available`);
      return null;
    }

    const connection = await this.redisConnection.getConnection('queue');
    if (!connection) {
      this.logger.error(`Cannot create queue ${name}: No Redis connection`);
      return null;
    }

    const mergedConfig = { ...this.defaultConfig, ...config };

    try {
      const queue = new Queue(name, {
        connection: connection.duplicate(),
        defaultJobOptions: {
          attempts: mergedConfig.attempts,
          backoff: {
            type: 'exponential',
            delay: mergedConfig.backoffDelay,
          },
          removeOnComplete: {
            age: mergedConfig.removeOnCompleteAge,
            count: mergedConfig.removeOnCompleteCount,
          },
          removeOnFail: {
            age: mergedConfig.removeOnFailAge,
            count: mergedConfig.removeOnFailCount,
          },
        },
      });

      this.queues.set(name, queue);
      this.logger.log(`Queue created: ${name}`);

      // Create queue events listener
      try {
        const queueEvents = new QueueEvents(name, {
          connection: connection.duplicate(),
        });
        this.queueEvents.set(name, queueEvents);
        this.logger.debug(`Queue events created for: ${name}`);
      } catch (eventsError) {
        this.logger.warn(
          `Failed to create queue events for ${name}:`,
          eventsError,
        );
        // Queue can work without events listener
      }

      return queue;
    } catch (error) {
      this.logger.error(`Failed to create queue ${name}:`, error);
      // Remove from map if creation failed
      this.queues.delete(name);
      return null;
    }
  }

  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  getQueueEvents(name: string): QueueEvents | undefined {
    return this.queueEvents.get(name);
  }

  async getQueueStats(name?: string): Promise<any> {
    if (name) {
      const queue = this.queues.get(name);
      if (!queue) {
        return null;
      }
      try {
        return await queue.getJobCounts();
      } catch (error) {
        this.logger.error(`Failed to get stats for queue ${name}:`, error);
        return { error: 'Failed to get stats' };
      }
    }

    const stats: any = {};
    for (const [queueName, queue] of this.queues) {
      try {
        stats[queueName] = await queue.getJobCounts();
      } catch (error) {
        this.logger.error(`Failed to get stats for queue ${queueName}:`, error);
        stats[queueName] = { error: 'Failed to get stats' };
      }
    }
    return stats;
  }

  async cleanQueue(name: string, grace: number = 0): Promise<void> {
    const queue = this.queues.get(name);
    if (!queue) {
      return;
    }

    try {
      await queue.clean(grace, 1000, 'completed');
      await queue.clean(grace, 1000, 'failed');
      this.logger.log(`Queue ${name} cleaned`);
    } catch (error) {
      this.logger.error(`Failed to clean queue ${name}:`, error);
    }
  }

  async cleanAllQueues(grace: number = 0): Promise<void> {
    const promises = Array.from(this.queues.keys()).map((name) =>
      this.cleanQueue(name, grace),
    );
    await Promise.all(promises);
  }

  async pauseQueue(name: string): Promise<void> {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.pause();
      this.logger.log(`Queue ${name} paused`);
    }
  }

  async resumeQueue(name: string): Promise<void> {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.resume();
      this.logger.log(`Queue ${name} resumed`);
    }
  }

  async closeQueue(name: string): Promise<void> {
    const queue = this.queues.get(name);
    const events = this.queueEvents.get(name);

    if (events) {
      try {
        await events.close();
        this.queueEvents.delete(name);
      } catch (error) {
        this.logger.error(`Error closing queue events for ${name}:`, error);
      }
    }

    if (queue) {
      try {
        await queue.close();
        this.queues.delete(name);
        this.logger.log(`Queue ${name} closed`);
      } catch (error) {
        this.logger.error(`Error closing queue ${name}:`, error);
      }
    }
  }

  async closeAll(): Promise<void> {
    this.logger.log('Closing all queues...');

    // Close events first
    const eventPromises = Array.from(this.queueEvents.entries()).map(
      async ([name, events]) => {
        try {
          await events.close();
          this.logger.debug(`Queue events closed: ${name}`);
        } catch (err) {
          this.logger.error(`Error closing queue events for ${name}:`, err);
        }
      },
    );
    await Promise.all(eventPromises);
    this.queueEvents.clear();

    // Then close queues
    const queuePromises = Array.from(this.queues.entries()).map(
      async ([name, queue]) => {
        try {
          await queue.close();
          this.logger.debug(`Queue closed: ${name}`);
        } catch (err) {
          this.logger.error(`Error closing queue ${name}:`, err);
        }
      },
    );
    await Promise.all(queuePromises);
    this.queues.clear();

    this.logger.log('All queues closed');
  }

  getActiveQueues(): string[] {
    return Array.from(this.queues.keys());
  }

  async getQueueSize(name: string): Promise<number> {
    const queue = this.queues.get(name);
    if (!queue) {
      return 0;
    }
    try {
      return await queue.count();
    } catch (error) {
      this.logger.error(`Failed to get size for queue ${name}:`, error);
      return 0;
    }
  }
}
