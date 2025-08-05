// src/domain/interfaces/workflow-execution.repository.interface.ts
// INTERFACE - Contrato del repositorio (sin dependencias de infraestructura)

import { WorkflowExecution } from '../entities/workflow-execution';

export interface IWorkflowExecutionRepository {
  create(workflowExecution: WorkflowExecution): Promise<WorkflowExecution>;
  findById(id: string): Promise<WorkflowExecution | null>;
  findByJobId(jobId: string): Promise<WorkflowExecution | null>;
  update(workflowExecution: WorkflowExecution): Promise<void>;
  updateById(id: string, data: Partial<any>): Promise<void>;
  findAll(): Promise<WorkflowExecution[]>;
  findByWorkflowId(workflowId: string): Promise<WorkflowExecution[]>;
  deleteOldExecutions(cutoffDate: Date): Promise<number>;
  getActiveExecutionsCount(): Promise<number>;
}
