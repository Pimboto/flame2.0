// src/domain/interfaces/workflow-monitor.interface.ts

export interface WorkflowMetrics {
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    heapUsedPercent: number;
    rss: number;
    external: number;
  };
  workflowMetrics: {
    totalJobsProcessed: number;
    totalJobsFailed: number;
    activeWorkers: number;
    activeJobs: number;
  };
  performanceMetrics: {
    averageProcessingTime: number;
    successRate: number;
    throughput: number;
  };
  lastUpdated: Date;
}

export interface IWorkflowMonitor {
  getMetrics(): WorkflowMetrics;
  getMemoryInfo(): any;
  recordJobCompleted(workflowId: string, processingTime: number): void;
  recordJobFailed(workflowId: string): void;
  setActiveWorkers(count: number): void;
  setActiveJobs(count: number): void;
  isMemoryHealthy(): boolean;
  reset(): void;
}
