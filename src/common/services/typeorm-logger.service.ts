import { Logger } from '@nestjs/common';
import { Logger as TypeOrmLogger } from 'typeorm';

export class CustomTypeOrmLogger implements TypeOrmLogger {
  private readonly logger = new Logger('TypeORM');
  private readonly logSql: boolean;
  private readonly logErrorOnly: boolean;

  constructor(logSql: boolean = false, logErrorOnly: boolean = true) {
    this.logSql = logSql;
    this.logErrorOnly = logErrorOnly;
  }

  logQuery(query: string, parameters?: any[]) {
    if (!this.logSql || this.logErrorOnly) return;

    const sql = this.formatQuery(query, parameters);
    this.logger.debug(sql);
  }

  logQueryError(error: string | Error, query: string, parameters?: any[]) {
    const sql = this.formatQuery(query, parameters);
    this.logger.error(`Query failed: ${error}`);
    this.logger.error(`Failed query: ${sql}`);
  }

  logQuerySlow(time: number, query: string, parameters?: any[]) {
    const sql = this.formatQuery(query, parameters);
    this.logger.warn(`Query is slow (${time}ms): ${sql}`);
  }

  logSchemaBuild(message: string) {
    if (!this.logSql || this.logErrorOnly) return;
    this.logger.log(`Schema: ${message}`);
  }

  logMigration(message: string) {
    this.logger.log(`Migration: ${message}`);
  }

  log(level: 'log' | 'info' | 'warn', message: any) {
    if (this.logErrorOnly && level !== 'warn') return;

    switch (level) {
      case 'log':
      case 'info':
        if (this.logSql) this.logger.log(message);
        break;
      case 'warn':
        this.logger.warn(message);
        break;
    }
  }

  private formatQuery(query: string, parameters?: any[]): string {
    // Simplificar queries para mejor legibilidad
    let sql = query
      .replace(/\s+/g, ' ')
      .replace(/SELECT .+ FROM/, 'SELECT ... FROM')
      .trim();

    // Limitar longitud
    if (sql.length > 150) {
      sql = sql.substring(0, 150) + '...';
    }

    if (parameters && parameters.length > 0) {
      return `${sql} [${parameters.length} params]`;
    }

    return sql;
  }
}
