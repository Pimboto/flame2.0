// src/domain/workflows/sample.workflow.ts

import { IWorkflowLogger } from '../interfaces/workflow-logger.interface';

export interface WorkflowStepContext {
  logger: IWorkflowLogger;
  executionId: string;
  workflowId: string;
  stepId: string;
  attempt: number;
  data: any;
}

export interface WorkflowStep {
  name: string;
  handler: (context: WorkflowStepContext) => Promise<any>;
  nextStep?: string;
  delay?: number;
  timeout?: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: number;
  steps: Map<string, WorkflowStep>;
  startStep: string;
}

export abstract class StepBody {
  abstract run(context: StepExecutionContext): Promise<ExecutionResult>;
}

export interface StepExecutionContext {
  item: any;
}

export class ExecutionResult {
  static next() {
    return { next: true };
  }
}

export class ProcessDataStep extends StepBody {
  public run(context: StepExecutionContext): Promise<ExecutionResult> {
    const processedData = {
      ...context.item,
      processed: true,
      timestamp: new Date(),
    };

    context.item = processedData;

    return Promise.resolve(ExecutionResult.next());
  }
}

export class ValidateDataStep extends StepBody {
  public run(context: StepExecutionContext): Promise<ExecutionResult> {
    if (!context.item || !context.item.processed) {
      throw new Error('Datos inválidos: faltan campos requeridos');
    }

    return Promise.resolve(ExecutionResult.next());
  }
}

export class SendNotificationStep extends StepBody {
  public run(_context: StepExecutionContext): Promise<ExecutionResult> {
    return Promise.resolve(ExecutionResult.next());
  }
}

export const sampleWorkflowDefinition: WorkflowDefinition = {
  id: 'sample-workflow',
  name: 'Sample Workflow',
  version: 1,
  startStep: 'process-data',
  steps: new Map([
    [
      'process-data',
      {
        name: 'Process Data',
        handler: async (context) => {
          context.logger.log('Procesando datos en workflow', 'SampleWorkflow');
          return { ...context.data, processed: true, timestamp: new Date() };
        },
        nextStep: 'validate-data',
      },
    ],
    [
      'validate-data',
      {
        name: 'Validate Data',
        handler: async (context) => {
          context.logger.log('Validando datos en workflow', 'SampleWorkflow');
          if (!context.data.processed) {
            throw new Error('Datos inválidos');
          }
          return context.data;
        },
        nextStep: 'send-notification',
        delay: 2000,
      },
    ],
    [
      'send-notification',
      {
        name: 'Send Notification',
        handler: async (context) => {
          context.logger.log(
            'Enviando notificación en workflow',
            'SampleWorkflow',
          );
          return { ...context.data, notified: true };
        },
      },
    ],
  ]),
};

export const errorHandlingWorkflowDefinition: WorkflowDefinition = {
  id: 'error-handling-workflow',
  name: 'Error Handling Workflow',
  version: 1,
  startStep: 'process-with-retry',
  steps: new Map([
    [
      'process-with-retry',
      {
        name: 'Process with Retry',
        handler: async (context) => {
          context.logger.log(
            'Procesando con reintentos',
            'ErrorHandlingWorkflow',
          );
          const retryCount = context.data.retryCount || 0;

          if (retryCount < 2 && Math.random() > 0.5) {
            throw new Error('Error simulado');
          }

          return { ...context.data, processed: true };
        },
        nextStep: 'complete',
      },
    ],
    [
      'complete',
      {
        name: 'Complete',
        handler: async (context) => {
          context.logger.log('Workflow completado', 'ErrorHandlingWorkflow');
          return { ...context.data, completed: true };
        },
      },
    ],
  ]),
};
