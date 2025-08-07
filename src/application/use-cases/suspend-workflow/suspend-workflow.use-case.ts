// src/application/use-cases/suspend-workflow/suspend-workflow.use-case.ts

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { WorkflowEngineService } from '../../../infrastructure/workflow-engine.service';

@Injectable()
export class SuspendWorkflowUseCase {
  private readonly logger = new Logger(SuspendWorkflowUseCase.name);

  constructor(private readonly workflowEngine: WorkflowEngineService) {}

  async execute(executionId: string): Promise<void> {
    this.logger.log(`Suspending workflow: ${executionId}`);

    try {
      await this.workflowEngine.suspendWorkflow(executionId);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundException(
          `Workflow execution not found: ${executionId}`,
        );
      }
      throw error;
    }
  }
}
