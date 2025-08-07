// src/application/dto/execution-history.dto.ts

export interface ExecutionInfo {
  id: string;
  workflowId: string;
  status: string;
  createTime: Date;
  finishedOn?: Date;
  error?: string;
}

export class ExecutionHistoryDto {
  executions!: ExecutionInfo[];
  total!: number;
}
