// src/application/use-cases/resume-workflow/resume-workflow.use-case.ts

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { WorkflowEngineService } from '../../../infrastructure/workflow-engine.service';

@Injectable()
export class ResumeWorkflowUseCase {
  private readonly logger = new Logger(ResumeWorkflowUseCase.name);

  constructor(private readonly workflowEngine: WorkflowEngineService) {}

  async execute(executionId: string): Promise<void> {
    this.logger.log(`Resuming workflow: ${executionId}`);

    try {
      await this.workflowEngine.resumeWorkflow(executionId);
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
