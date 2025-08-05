import { logger } from '../../common/services/logger.service';

export interface WorkflowStep {
  name: string;
  handler: (data: any) => Promise<any>;
  nextStep?: string;
  delay?: number;
  timeout?: number; // Timeout en milisegundos para el paso
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: number;
  steps: Map<string, WorkflowStep>;
  startStep: string;
}

// Clase base para los pasos del workflow
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

// Implementación de los pasos
export class ProcessDataStep extends StepBody {
  public run(context: StepExecutionContext): Promise<ExecutionResult> {
    logger.log('Procesando datos', 'ProcessDataStep');

    // Simulación de procesamiento
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
    logger.log('Validando datos', 'ValidateDataStep');

    // Validación simple
    if (!context.item || !context.item.processed) {
      throw new Error('Datos inválidos: faltan campos requeridos');
    }

    return Promise.resolve(ExecutionResult.next());
  }
}

export class SendNotificationStep extends StepBody {
  public run(_context: StepExecutionContext): Promise<ExecutionResult> {
    logger.log('Enviando notificación', 'SendNotificationStep');
    logger.log('Notificación enviada exitosamente', 'SendNotificationStep');

    return Promise.resolve(ExecutionResult.next());
  }
}

// Definiciones de workflows
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
        handler: async (data) => {
          logger.log('Procesando datos en workflow', 'SampleWorkflow');
          return { ...data, processed: true, timestamp: new Date() };
        },
        nextStep: 'validate-data',
      },
    ],
    [
      'validate-data',
      {
        name: 'Validate Data',
        handler: async (data) => {
          logger.log('Validando datos en workflow', 'SampleWorkflow');
          if (!data.processed) {
            throw new Error('Datos inválidos');
          }
          return data;
        },
        nextStep: 'send-notification',
        delay: 2000,
      },
    ],
    [
      'send-notification',
      {
        name: 'Send Notification',
        handler: async (data) => {
          logger.log('Enviando notificación en workflow', 'SampleWorkflow');
          return { ...data, notified: true };
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
        handler: async (data) => {
          logger.log('Procesando con reintentos', 'ErrorHandlingWorkflow');
          const retryCount = data.retryCount || 0;

          if (retryCount < 2 && Math.random() > 0.5) {
            throw new Error('Error simulado');
          }

          return { ...data, processed: true };
        },
        nextStep: 'complete',
      },
    ],
    [
      'complete',
      {
        name: 'Complete',
        handler: async (data) => {
          logger.log('Workflow completado', 'ErrorHandlingWorkflow');
          return { ...data, completed: true };
        },
      },
    ],
  ]),
};
