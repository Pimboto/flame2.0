// src/domain/interfaces/workflow-context.interface.ts

import { IWorkflowLogger } from './workflow-logger.interface';

export interface WorkflowContext {
  logger: IWorkflowLogger;
  executionId: string;
  workflowId: string;
  stepId: string;
  attempt: number;
}

export interface WorkflowStepContext extends WorkflowContext {
  data: any;
}
