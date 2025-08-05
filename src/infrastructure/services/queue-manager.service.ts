// src/infrastructure/services/queue-manager.service.ts
// SERVICIO DE GESTIÓN DE COLAS - Maneja las colas de BullMQ

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import { RedisConnectionService } from './redis-connection.service';

export interface QueueConfig {
  attempts?: number;
  backoffDelay?: number;
  removeOnCompleteAge?: number;
  removeOnCompleteCount?: number;
  removeOnFailAge?: number;
  removeOnFailCount?: number;
}

@Injectable()
export class QueueManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueManagerService.name);
  private queues: Map<string, Queue> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();

  private readonly defaultConfig: QueueConfig = {
    attempts: 3,
    backoffDelay: 2000,
    removeOnCompleteAge: 300, // 5 minutes
    removeOnCompleteCount: 10,
    removeOnFailAge: 3600, // 1 hour
    removeOnFailCount: 50,
  };

  constructor(private readonly redisConnection: RedisConnectionService) {}

  async onModuleDestroy() {
    await this.closeAll();
  }

  async createQueue(name: string, config?: QueueConfig): Promise<Queue | null> {
    if (!this.redisConnection.isRedisAvailable) {
      this.logger.warn(`Cannot create queue ${name}: Redis not available`);
      return null;
    }

    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const connection = await this.redisConnection.getConnection('queue');
    if (!connection) {
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

      // Create queue events for monitoring
      const queueEvents = new QueueEvents(name, {
        connection: connection.duplicate(),
      });

      this.queueEvents.set(name, queueEvents);

      return queue;
    } catch (error) {
      this.logger.error(`Failed to create queue ${name}:`, error);
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
      return await queue.getJobCounts();
    }

    // Get stats for all queues
    const stats: any = {};
    for (const [queueName, queue] of this.queues) {
      try {
        stats[queueName] = await queue.getJobCounts();
      } catch (error) {
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
      await events.close();
      this.queueEvents.delete(name);
    }

    if (queue) {
      await queue.close();
      this.queues.delete(name);
      this.logger.log(`Queue ${name} closed`);
    }
  }

  async closeAll(): Promise<void> {
    this.logger.log('Closing all queues...');

    // Close all queue events first
    const eventPromises = Array.from(this.queueEvents.values()).map((events) =>
      events
        .close()
        .catch((err) => this.logger.error('Error closing queue events:', err)),
    );
    await Promise.all(eventPromises);
    this.queueEvents.clear();

    // Close all queues
    const queuePromises = Array.from(this.queues.values()).map((queue) =>
      queue
        .close()
        .catch((err) => this.logger.error('Error closing queue:', err)),
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
    return await queue.count();
  }
}
