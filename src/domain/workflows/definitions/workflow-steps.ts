// src/domain/workflows/definitions/workflow-steps.ts

import { WorkflowStep } from '../sample.workflow';

export interface StepDefinition {
  name: string;
  timeout?: number;
  delay?: number;
  nextStep?: string;
}

export class WorkflowStepBuilder {
  static createStep(
    definition: StepDefinition,
    handler: (context: any) => Promise<any>,
  ): WorkflowStep {
    return {
      name: definition.name,
      timeout: definition.timeout,
      delay: definition.delay,
      nextStep: definition.nextStep,
      handler,
    };
  }

  static createConditionalStep(
    definition: StepDefinition,
    condition: (data: any) => boolean,
    trueHandler: (context: any) => Promise<any>,
    falseHandler: (context: any) => Promise<any>,
  ): WorkflowStep {
    return {
      name: definition.name,
      timeout: definition.timeout,
      delay: definition.delay,
      handler: async (context) => {
        if (condition(context.data)) {
          return await trueHandler(context);
        } else {
          return await falseHandler(context);
        }
      },
    };
  }

  static createLoopStep(
    definition: StepDefinition,
    maxIterations: number,
    iterationHandler: (context: any, iteration: number) => Promise<any>,
  ): WorkflowStep {
    return {
      name: definition.name,
      timeout: definition.timeout,
      delay: definition.delay,
      handler: async (context) => {
        const iteration = context.data.iteration || 0;

        if (iteration >= maxIterations) {
          return {
            ...context.data,
            _workflowCompleted: true,
            completionReason: 'Max iterations reached',
          };
        }

        const result = await iterationHandler(context, iteration);

        return {
          ...result,
          iteration: iteration + 1,
          _nextStep: definition.nextStep,
        };
      },
    };
  }
}
