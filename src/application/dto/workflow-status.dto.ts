// src/application/dto/workflow-status.dto.ts

export class WorkflowStatusDto {
  executionId!: string;
  workflowId!: string;
  status!: string;
  currentStep?: string;
  progress?: string;
  data?: any;
  error?: string;
  createTime!: Date;
  lastUpdate?: Date;
  finishedOn?: Date;
  iteration?: number;
  messages?: any[];
  history?: any[];
}
