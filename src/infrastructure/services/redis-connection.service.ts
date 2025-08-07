// src/infrastructure/services/redis-connection.service.ts

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';
import { ConfigService } from '../../common/services/config.service';
import { IRedisConnection } from '../../domain/interfaces/redis-connection.interface';

@Injectable()
export class RedisConnectionService
  implements OnModuleDestroy, IRedisConnection
{
  private readonly logger = new Logger(RedisConnectionService.name);
  private connectionPool: Map<string, IORedis> = new Map();
  private isAvailable = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleDestroy() {
    await this.closeAll();
  }

  get isRedisAvailable(): boolean {
    return this.isAvailable;
  }

  async getConnection(name: string = 'default'): Promise<IORedis | null> {
    if (this.connectionPool.has(name)) {
      return this.connectionPool.get(name)!;
    }

    try {
      const connection = await this.createConnection(name);
      if (connection) {
        this.connectionPool.set(name, connection);
        return connection;
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to create connection ${name}:`, error);
      return null;
    }
  }

  private async createConnection(name: string): Promise<IORedis | null> {
    const redisConfig = this.configService.redisConfig;

    try {
      this.logger.log(`Creating Redis connection: ${name}`);

      const connection = new IORedis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        username: redisConfig.username,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: false,
        connectTimeout: 10000,
        lazyConnect: true,
        keepAlive: 10000,
        connectionName: `workflow-${name}`,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error(
              `Failed to connect to Redis after ${times} attempts`,
            );
            return null;
          }
          return Math.min(times * 50, 2000);
        },
      });

      connection.on('connect', () => {
        this.logger.debug(`Redis connection ${name} connecting...`);
      });

      connection.on('ready', () => {
        this.logger.log(`Redis connection ${name} ready`);
        this.isAvailable = true;
      });

      connection.on('error', (err) => {
        this.logger.error(`Redis connection ${name} error:`, err.message);
      });

      connection.on('close', () => {
        this.logger.warn(`Redis connection ${name} closed`);
      });

      await connection.connect();

      const pingResult = await connection.ping();
      this.logger.debug(`Redis ${name} ping: ${pingResult}`);

      return connection;
    } catch (error) {
      this.logger.error(`Failed to establish Redis connection ${name}:`, error);
      this.isAvailable = false;
      return null;
    }
  }

  async closeConnection(name: string): Promise<void> {
    const connection = this.connectionPool.get(name);
    if (connection) {
      await connection.disconnect();
      this.connectionPool.delete(name);
      this.logger.log(`Closed Redis connection: ${name}`);
    }
  }

  async closeAll(): Promise<void> {
    this.logger.log('Closing all Redis connections...');
    const promises = Array.from(this.connectionPool.entries()).map(
      async ([name, connection]) => {
        try {
          await connection.disconnect();
          this.logger.debug(`Closed connection: ${name}`);
        } catch (error) {
          this.logger.error(`Error closing connection ${name}:`, error);
        }
      },
    );
    await Promise.all(promises);
    this.connectionPool.clear();
    this.isAvailable = false;
    this.logger.log('All Redis connections closed');
  }

  async getConnectionInfo(): Promise<any> {
    const info: any = {};
    for (const [name, connection] of this.connectionPool) {
      try {
        const memoryInfo = await connection.info('memory');
        info[name] = {
          status: connection.status,
          memory:
            memoryInfo.match(/used_memory_human:([^\r\n]+)/)?.[1] || 'unknown',
        };
      } catch (error) {
        info[name] = {
          status: 'error',
          error: error instanceof Error ? error.message : 'unknown',
        };
      }
    }
    return info;
  }
}
