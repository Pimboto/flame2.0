import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  get isDevelopment(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  get redisUrl(): string {
    return process.env.REDIS_URL || 'redis://localhost:6379';
  }

  get databaseUrl(): string {
    return (
      process.env.DATABASE_URL ||
      'postgresql://postgres:password@localhost:5432/flamebot'
    );
  }

  get redisConfig() {
    try {
      const url = new URL(this.redisUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
        username: url.username || undefined,
      };
    } catch (error) {
      console.warn('Error parsing REDIS_URL, using default configuration');
      return {
        host: 'localhost',
        port: 6379,
      };
    }
  }

  get databaseConfig() {
    try {
      const url = new URL(this.databaseUrl);
      const isRailway =
        url.hostname.includes('rlwy.net') || url.hostname.includes('railway');

      return {
        type: 'postgres' as const,
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        username: url.username || 'postgres',
        password: url.password || 'password',
        database: url.pathname.slice(1) || 'railway',
        entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
        synchronize: this.isDevelopment,
        logging: this.isDevelopment,
        // Configuración específica para Railway
        ssl: isRailway ? { rejectUnauthorized: false } : false,
        retryAttempts: 10,
        retryDelay: 3000,
        // Configuraciones adicionales para estabilidad
        extra: {
          connectionLimit: 10,
          acquireTimeout: 60000,
          timeout: 60000,
        },
      };
    } catch (error) {
      console.warn('Error parsing DATABASE_URL, using default configuration');
      return {
        type: 'postgres' as const,
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'flamebot',
        entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
        synchronize: this.isDevelopment,
        logging: this.isDevelopment,
        retryAttempts: 10,
        retryDelay: 3000,
      };
    }
  }
}
