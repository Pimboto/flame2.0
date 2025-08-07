// src/application/commands/execute-workflow.command.ts

export class ExecuteWorkflowCommand {
  constructor(
    public readonly workflowId: string,
    public readonly data: any,
    public readonly userId?: string,
    public readonly priority?: number,
  ) {}
}
