// src/domain/interfaces/workflow-cleanup.interface.ts

export interface CleanupConfig {
  executionRetentionDays: number;
  jobRetentionMinutes: number;
  redisKeyRetentionHours: number;
}

export interface IWorkflowCleanup {
  performScheduledCleanup(): Promise<void>;
  performDeepCleanup(): Promise<void>;
  cleanupOldExecutions(): Promise<number>;
  cleanupCompletedJobs(): Promise<void>;
  cleanupRedisKeys(): Promise<void>;
  forceCleanup(): Promise<void>;
  emergencyCleanup(): Promise<void>;
  getCleanupConfig(): CleanupConfig;
}
