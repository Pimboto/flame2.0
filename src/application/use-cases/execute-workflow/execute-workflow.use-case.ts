// src/application/use-cases/execute-workflow/execute-workflow.use-case.ts

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ExecuteWorkflowCommand } from '../../commands/execute-workflow.command';
import { WorkflowEngineService } from '../../../infrastructure/workflow-engine.service';
import { WorkflowExecutionDto } from '../../dto/workflow-execution.dto';

@Injectable()
export class ExecuteWorkflowUseCase {
  private readonly logger = new Logger(ExecuteWorkflowUseCase.name);

  private readonly validWorkflows = [
    'safe-automation-workflow',
    'import-accounts-workflow',
  ];

  constructor(private readonly workflowEngine: WorkflowEngineService) {}

  async execute(
    command: ExecuteWorkflowCommand,
  ): Promise<WorkflowExecutionDto> {
    this.logger.log(`Executing workflow: ${command.workflowId}`);

    if (!this.isValidWorkflowId(command.workflowId)) {
      throw new BadRequestException(
        `Invalid workflow ID: ${command.workflowId}`,
      );
    }

    try {
      const executionId = await this.workflowEngine.startWorkflow(
        command.workflowId,
        command.data || {},
      );

      return {
        executionId,
        workflowId: command.workflowId,
        status: 'started',
        message: 'Workflow started successfully',
        createdAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Error executing workflow: ${error}`);
      throw error;
    }
  }

  private isValidWorkflowId(workflowId: string): boolean {
    return this.validWorkflows.includes(workflowId);
  }
}
