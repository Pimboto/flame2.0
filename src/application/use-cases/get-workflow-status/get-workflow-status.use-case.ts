// src/application/use-cases/get-workflow-status/get-workflow-status.use-case.ts

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { GetWorkflowStatusQuery } from '../../queries/get-workflow-status.query';
import { WorkflowEngineService } from '../../../infrastructure/workflow-engine.service';
import { WorkflowStatusDto } from '../../dto/workflow-status.dto';

@Injectable()
export class GetWorkflowStatusUseCase {
  private readonly logger = new Logger(GetWorkflowStatusUseCase.name);

  constructor(private readonly workflowEngine: WorkflowEngineService) {}

  async execute(query: GetWorkflowStatusQuery): Promise<WorkflowStatusDto> {
    this.logger.log(`Getting status for workflow: ${query.executionId}`);

    const status = await this.workflowEngine.getWorkflowStatus(
      query.executionId,
    );

    if (!status) {
      throw new NotFoundException(
        `Workflow execution not found: ${query.executionId}`,
      );
    }

    return {
      executionId: status.id,
      workflowId: status.workflowId,
      status: status.status,
      currentStep: status.currentStep,
      progress: status.progress,
      data: status.data,
      error: status.error,
      createTime: status.createTime,
      lastUpdate: status.lastUpdate,
      finishedOn: status.finishedOn,
      iteration: status.iteration,
      messages: status.messages,
      history: query.includeHistory ? status.history : undefined,
    };
  }
}
