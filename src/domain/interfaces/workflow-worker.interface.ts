// src/domain/interfaces/workflow-worker.interface.ts

export interface WorkerJob {
  id: string;
  workflowId: string;
  stepId: string;
  data: any;
}

export interface IWorkflowWorker {
  createWorker(workflowId: string, stepId: string, config?: any): Promise<any>;
  stopWorker(queueName: string): Promise<void>;
  stopAllWorkers(): Promise<void>;
  getActiveJobsCount(): number;
  getWorkerCount(): number;
  getWorkerNames(): string[];
}
