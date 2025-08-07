// src/application/dto/workflow-list.dto.ts

export interface WorkflowInfo {
  id: string;
  name: string;
  description: string;
  version: number;
  active: boolean;
}

export class WorkflowListDto {
  workflows!: WorkflowInfo[];
  total!: number;
}
