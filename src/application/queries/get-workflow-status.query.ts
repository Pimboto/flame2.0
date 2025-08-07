// src/application/queries/get-workflow-status.query.ts

export class GetWorkflowStatusQuery {
  constructor(
    public readonly executionId: string,
    public readonly includeHistory?: boolean,
  ) {}
}
