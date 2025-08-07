// src/application/queries/get-workflow-list.query.ts

export class GetWorkflowListQuery {
  constructor(
    public readonly active?: boolean,
    public readonly limit?: number,
  ) {}
}
