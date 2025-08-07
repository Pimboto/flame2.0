// src/application/use-cases/workflow-control/check-workflow-condition.use-case.ts

import { Injectable, Logger } from '@nestjs/common';

export interface WorkflowConditionCommand {
  workflowId: string;
  iteration: number;
  data: any;
  maxIterations?: number;
}

export interface WorkflowControlResponse {
  shouldContinue: boolean;
  status: 'ok' | 'warning' | 'error' | 'stop';
  message?: string;
  metadata?: any;
}

@Injectable()
export class CheckWorkflowConditionUseCase {
  private readonly logger = new Logger(CheckWorkflowConditionUseCase.name);

  async execute(
    command: WorkflowConditionCommand,
  ): Promise<WorkflowControlResponse> {
    // Business logic for checking workflow conditions
    const { iteration, maxIterations = 10, workflowId } = command;

    // Check iteration limit
    if (iteration >= maxIterations) {
      return {
        shouldContinue: false,
        status: 'stop',
        message: `Maximum iterations (${maxIterations}) reached`,
      };
    }

    // Check specific workflow conditions
    if (workflowId === 'safe-automation-workflow') {
      // Hardcoded for demo: stop at 3rd iteration
      if (iteration >= 3) {
        return {
          shouldContinue: false,
          status: 'stop',
          message: 'Demo limit: stopping at 3rd iteration',
        };
      }
    }

    // Check system health (could be expanded)
    const memUsage = process.memoryUsage();
    const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (heapPercent > 90) {
      return {
        shouldContinue: false,
        status: 'error',
        message: 'System memory critical',
        metadata: { heapPercent },
      };
    }

    if (heapPercent > 75) {
      return {
        shouldContinue: true,
        status: 'warning',
        message: 'System memory high',
        metadata: { heapPercent },
      };
    }

    // All checks passed
    return {
      shouldContinue: true,
      status: 'ok',
      message: 'All conditions met, workflow can continue',
    };
  }
}
