export interface IWorkflow {
  id: string;
  name: string;
  description?: string;
  steps: IWorkflowStep[];
  status: WorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkflowStep {
  id: string;
  name: string;
  type: StepType;
  config: any;
  nextStepId?: string;
  errorStepId?: string;
}

export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum StepType {
  START = 'START',
  PROCESS = 'PROCESS',
  DECISION = 'DECISION',
  DELAY = 'DELAY',
  END = 'END',
}

export interface IWorkflowExecution {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  currentStepId?: string;
  context: any;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}
