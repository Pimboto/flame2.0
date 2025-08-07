// src/application/commands/terminate-workflow.command.ts

export class TerminateWorkflowCommand {
  constructor(
    public readonly executionId: string,
    public readonly reason?: string,
    public readonly userId?: string,
  ) {}
}
