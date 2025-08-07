// src/application/use-cases/terminate-workflow/terminate-workflow.use-case.ts

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { TerminateWorkflowCommand } from '../../commands/terminate-workflow.command';
import { WorkflowEngineService } from '../../../infrastructure/workflow-engine.service';

@Injectable()
export class TerminateWorkflowUseCase {
  private readonly logger = new Logger(TerminateWorkflowUseCase.name);

  constructor(private readonly workflowEngine: WorkflowEngineService) {}

  async execute(command: TerminateWorkflowCommand): Promise<void> {
    this.logger.log(`Terminating workflow: ${command.executionId}`);

    try {
      await this.workflowEngine.terminateWorkflow(command.executionId);
      this.logger.log(
        `Workflow terminated: ${command.executionId}, reason: ${command.reason}`,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundException(
          `Workflow execution not found: ${command.executionId}`,
        );
      }
      throw error;
    }
  }
}
