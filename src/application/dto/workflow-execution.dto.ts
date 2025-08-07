// src/application/dto/workflow-execution.dto.ts

export class WorkflowExecutionDto {
  executionId!: string;
  workflowId!: string;
  status!: string;
  message!: string;
  createdAt!: Date;
}
