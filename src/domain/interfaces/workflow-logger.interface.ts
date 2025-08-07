// src/domain/interfaces/workflow-logger.interface.ts

export interface IWorkflowLogger {
  log(message: string, context?: string): void;
  error(message: string, error?: any, context?: string): void;
  warn(message: string, context?: string): void;
  debug(message: string, context?: string): void;
}
