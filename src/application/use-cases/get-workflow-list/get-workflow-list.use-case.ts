// src/application/use-cases/get-workflow-list/get-workflow-list.use-case.ts

import { Injectable, Logger } from '@nestjs/common';
import { GetWorkflowListQuery } from '../../queries/get-workflow-list.query';
import { WorkflowListDto } from '../../dto/workflow-list.dto';

@Injectable()
export class GetWorkflowListUseCase {
  private readonly logger = new Logger(GetWorkflowListUseCase.name);

  async execute(query: GetWorkflowListQuery): Promise<WorkflowListDto> {
    this.logger.log('Getting workflow list');

    const workflows = [
      {
        id: 'safe-automation-workflow',
        name: 'Safe Automation Workflow',
        description:
          'Workflow with multiple control points and automatic stopping',
        version: 1,
        active: true,
      },
      {
        id: 'import-accounts-workflow',
        name: 'Import Tinder Accounts Workflow',
        description: 'Workflow to import Tinder accounts from external API',
        version: 1,
        active: true,
      },
    ];

    const filteredWorkflows =
      query.active !== undefined
        ? workflows.filter((w) => w.active === query.active)
        : workflows;

    const limitedWorkflows = query.limit
      ? filteredWorkflows.slice(0, query.limit)
      : filteredWorkflows;

    return {
      workflows: limitedWorkflows,
      total: limitedWorkflows.length,
    };
  }
}
