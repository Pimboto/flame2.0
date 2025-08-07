// src/infrastructure/services/workflow-executor.service.ts

import { Injectable, Logger } from '@nestjs/common';
import {
  WorkflowDefinition,
  WorkflowStepContext,
} from '../../domain/workflows/sample.workflow';
import { IWorkflowLogger } from '../../domain/interfaces/workflow-logger.interface';
import { IWorkflowExecutor } from '../../domain/interfaces/workflow-executor.interface';

@Injectable()
export class WorkflowExecutorService implements IWorkflowExecutor {
  private readonly logger = new Logger(WorkflowExecutorService.name);
  private workflows: Map<string, WorkflowDefinition> = new Map();

  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
    this.logger.log(
      `Workflow registered: ${workflow.id} with ${workflow.steps.size} steps`,
    );
  }

  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  async executeStep(
    workflowId: string,
    stepId: string,
    data: any,
    executionId: string,
  ): Promise<any> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const step = workflow.steps.get(stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId} in workflow ${workflowId}`);
    }

    const workflowLogger: IWorkflowLogger = {
      log: (message: string, context?: string) => {
        this.logger.log(message, context);
      },
      error: (message: string, error?: any, context?: string) => {
        this.logger.error(message, error, context);
      },
      warn: (message: string, context?: string) => {
        this.logger.warn(message, context);
      },
      debug: (message: string, context?: string) => {
        this.logger.debug(message, context);
      },
    };

    const context: WorkflowStepContext = {
      logger: workflowLogger,
      executionId,
      workflowId,
      stepId,
      attempt: 1,
      data,
    };

    return await this.executeWithTimeout(
      step.handler(context),
      step.timeout || 300000,
    );
  }

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), timeout),
      ),
    ]);
  }

  async executeWorkflowSync(workflowId: string, data: any): Promise<any> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    let currentStep = workflow.startStep;
    let currentData = data;
    let stepCount = 0;
    const maxSteps = 100;
    const executionId = `sync-${Date.now()}`;

    while (currentStep && stepCount < maxSteps) {
      const step = workflow.steps.get(currentStep);
      if (!step) {
        break;
      }

      this.logger.log(`Sync execution: Step ${currentStep}`);

      if (step.delay) {
        await new Promise((resolve) => setTimeout(resolve, step.delay));
      }

      currentData = await this.executeStep(
        workflowId,
        currentStep,
        currentData,
        executionId,
      );

      if (
        currentData._workflowCompleted === true ||
        currentData._workflowActive === false
      ) {
        break;
      }

      currentStep = currentData._nextStep || step.nextStep || '';
      stepCount++;
    }

    if (stepCount >= maxSteps) {
      this.logger.warn('Sync execution: Step limit reached');
    }

    return {
      success: true,
      instanceId: executionId,
      data: currentData,
      completedAt: new Date(),
      stepsExecuted: stepCount,
    };
  }

  getAllWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  getWorkflowIds(): string[] {
    return Array.from(this.workflows.keys());
  }
}
