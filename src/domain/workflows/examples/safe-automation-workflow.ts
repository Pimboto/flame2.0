// src/domain/workflows/examples/safe-automation-workflow.ts

import { WorkflowDefinition, WorkflowStep } from '../sample.workflow';
import { WorkflowStepBuilder } from '../definitions/workflow-steps';

export const safeAutomationWorkflow: WorkflowDefinition = {
  id: 'safe-automation-workflow',
  name: 'Safe Automation Workflow with Conditional Stops',
  version: 2,
  startStep: 'initialize',
  steps: new Map<string, WorkflowStep>([
    [
      'initialize',
      WorkflowStepBuilder.createStep(
        {
          name: 'Initialize Workflow',
          timeout: 5000,
          nextStep: 'check-conditions',
        },
        async (context) => {
          context.logger.log(
            'Initializing safe automation workflow',
            'SafeWorkflow',
          );

          return {
            ...context.data,
            workflowId: `safe-${Date.now()}`,
            startedAt: new Date(),
            iteration: 0,
            history: [],
            status: 'running',
            _workflowActive: true,
          };
        },
      ),
    ],

    [
      'check-conditions',
      WorkflowStepBuilder.createStep(
        {
          name: 'Check Conditions',
          timeout: 10000,
          nextStep: 'wait-step',
        },
        async (context) => {
          const iteration = context.data.iteration || 0;

          context.logger.log(
            `Checking conditions - Iteration ${iteration}`,
            'SafeWorkflow',
          );

          const history = [...(context.data.history || [])];
          history.push({
            step: 'check-conditions',
            iteration,
            timestamp: new Date(),
          });

          return {
            ...context.data,
            history,
            lastCheck: new Date(),
            _workflowActive: true,
            _requiresConditionCheck: true,
          };
        },
      ),
    ],

    [
      'wait-step',
      WorkflowStepBuilder.createStep(
        {
          name: 'Wait Step',
          delay: 20000,
          nextStep: 'execute-action',
        },
        async (context) => {
          if (!context.data._workflowActive) {
            return context.data;
          }

          context.logger.log('Waiting 20 seconds...', 'SafeWorkflow');

          return {
            ...context.data,
            lastWaitStarted: new Date(),
            _workflowActive: true,
          };
        },
      ),
    ],

    [
      'execute-action',
      WorkflowStepBuilder.createStep(
        {
          name: 'Execute Action',
          timeout: 5000,
          nextStep: 'increment-iteration',
        },
        async (context) => {
          if (!context.data._workflowActive) {
            return context.data;
          }

          const iteration = context.data.iteration || 0;
          const message = `Hello World! (Iteration #${iteration + 1})`;

          context.logger.log(message, 'SafeWorkflow');

          const messages = [...(context.data.messages || [])];
          messages.push({
            message,
            timestamp: new Date(),
            iteration: iteration + 1,
          });

          return {
            ...context.data,
            messages,
            lastAction: 'execute-action',
            lastActionAt: new Date(),
            _workflowActive: true,
          };
        },
      ),
    ],

    [
      'increment-iteration',
      WorkflowStepBuilder.createStep(
        {
          name: 'Increment Iteration',
          nextStep: 'check-completion',
        },
        async (context) => {
          const iteration = (context.data.iteration || 0) + 1;

          context.logger.log(
            `Incrementing to iteration ${iteration}`,
            'SafeWorkflow',
          );

          return {
            ...context.data,
            iteration,
            _workflowActive: true,
          };
        },
      ),
    ],

    [
      'check-completion',
      WorkflowStepBuilder.createStep(
        {
          name: 'Check Completion',
          nextStep: 'check-conditions',
        },
        async (context) => {
          const iteration = context.data.iteration || 0;
          const maxIterations = context.data.maxIterations || 10;

          if (iteration >= maxIterations) {
            context.logger.log('Maximum iterations reached', 'SafeWorkflow');

            return {
              ...context.data,
              status: 'completed',
              completedAt: new Date(),
              completionReason: 'Maximum iterations reached',
              _workflowActive: false,
              _workflowCompleted: true,
            };
          }

          context.logger.log('Continuing to next iteration', 'SafeWorkflow');

          return {
            ...context.data,
            _workflowActive: true,
          };
        },
      ),
    ],
  ]),
};

export function createSafeWorkflowTestData(maxIterations?: number) {
  return {
    testMode: true,
    maxIterations: maxIterations || 10,
    initialData: {
      company: 'Test Company',
      process: 'Automation Test',
    },
  };
}
