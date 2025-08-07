// src/domain/interfaces/workflow-executor.interface.ts

import { WorkflowDefinition } from '../workflows/sample.workflow';

export interface IWorkflowExecutor {
  registerWorkflow(workflow: WorkflowDefinition): void;
  getWorkflow(workflowId: string): WorkflowDefinition | undefined;
  executeStep(
    workflowId: string,
    stepId: string,
    data: any,
    executionId: string,
  ): Promise<any>;
  executeWorkflowSync(workflowId: string, data: any): Promise<any>;
  getAllWorkflows(): WorkflowDefinition[];
  getWorkflowIds(): string[];
}
