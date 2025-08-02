import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class AppLogger implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    const logLevel = process.env.LOG_LEVEL || 'info';
    
    // Formato más conciso para desarrollo
    const devFormat = winston.format.printf(({ timestamp, level, message, context }) => {
      const ctx = context ? `[${context}]` : '';
      return `${timestamp} ${ctx} ${level}: ${message}`;
    });

    // Formato completo para producción
    const prodFormat = winston.format.json();

    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.colorize(),
        process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
      ),
      transports: [
        new winston.transports.Console({
          silent: false,
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ],
    });
  }

  log(message: any, context?: string) {
    if (this.shouldLog('info')) {
      this.logger.info(message, { context });
    }
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: any, context?: string) {
    if (this.shouldLog('warn')) {
      this.logger.warn(message, { context });
    }
  }

  debug(message: any, context?: string) {
    if (this.shouldLog('debug')) {
      this.logger.debug(message, { context });
    }
  }

  verbose(message: any, context?: string) {
    if (this.shouldLog('verbose')) {
      this.logger.verbose(message, { context });
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug', 'verbose'];
    const currentLevelIndex = levels.indexOf(process.env.LOG_LEVEL || 'info');
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }
}

// Singleton para uso global
export const logger = new AppLogger();
