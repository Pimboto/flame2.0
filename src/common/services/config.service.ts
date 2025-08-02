import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

@Injectable()
export class ConfigService {
  get isDevelopment(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  get redisUrl(): string {
    return process.env.REDIS_URL || 'redis://localhost:6379';
  }

  get databaseUrl(): string {
    return process.env.DATABASE_URL || 'postgresql://localhost:5432/flamebot';
  }

  get logLevel(): string {
    return process.env.LOG_LEVEL || 'info';
  }

  get logSql(): boolean {
    return process.env.LOG_SQL === 'true';
  }

  get logSqlErrorOnly(): boolean {
    return process.env.LOG_SQL_ERROR_ONLY === 'true';
  }

  get redisConfig() {
    const url = new URL(this.redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port),
      password: url.password,
      username: url.username || 'default',
    };
  }

  get databaseConfig(): TypeOrmModuleOptions {
    const url = new URL(this.databaseUrl);
    return {
      type: 'postgres',
      host: url.hostname,
      port: parseInt(url.port),
      username: url.username,
      password: url.password,
      database: url.pathname.slice(1),
      entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: this.getLoggingConfig(),
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
  }

  private getLoggingConfig(): TypeOrmModuleOptions['logging'] {
    if (!this.logSql && !this.logSqlErrorOnly) {
      return false;
    }

    if (this.logSqlErrorOnly) {
      return ['error', 'warn'];
    }

    if (this.logSql) {
      return ['query', 'error', 'warn', 'info', 'log'];
    }

    return false;
  }
}
