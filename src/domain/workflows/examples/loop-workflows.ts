// src/domain/workflows/examples/loop-workflows.ts

import { WorkflowDefinition } from '../sample.workflow';

export const loopWorkflowDefinition: WorkflowDefinition = {
  id: 'loop-workflow',
  name: 'Loop Workflow with Waits',
  version: 1,
  startStep: 'initial-wait',
  steps: new Map([
    [
      'initial-wait',
      {
        name: 'Initial Wait',
        handler: async (context) => {
          context.logger.log(
            '🕐 Esperando 20 segundos antes de empezar...',
            'LoopWorkflow',
          );

          const iteration = context.data.iteration || 0;

          return {
            ...context.data,
            iteration: iteration + 1,
            startedAt: context.data.startedAt || new Date(),
            lastAction: 'initial-wait',
            _workflowActive: true,
          };
        },
        nextStep: 'print-hello',
        delay: 20000,
      },
    ],

    [
      'print-hello',
      {
        name: 'Print Hello World',
        handler: async (context) => {
          const message = `🌍 Hello World! (Iteración #${context.data.iteration})`;
          context.logger.log(message, 'LoopWorkflow');

          const messages = context.data.messages || [];
          messages.push({
            message,
            timestamp: new Date(),
            iteration: context.data.iteration,
          });

          return {
            ...context.data,
            messages,
            lastAction: 'print-hello',
            lastPrint: new Date(),
            _workflowActive: true,
          };
        },
        nextStep: 'wait-before-loop',
      },
    ],

    [
      'wait-before-loop',
      {
        name: 'Wait Before Loop',
        handler: async (context) => {
          context.logger.log(
            '⏳ Esperando 20 segundos antes de repetir...',
            'LoopWorkflow',
          );

          const maxIterations = context.data.maxIterations || Infinity;

          if (
            context.data.maxIterations &&
            context.data.iteration >= maxIterations
          ) {
            context.logger.log(
              '🛑 Alcanzado el máximo de iteraciones. Terminando workflow.',
              'LoopWorkflow',
            );
            return {
              ...context.data,
              completed: true,
              completedAt: new Date(),
              lastAction: 'completed',
              _workflowActive: false,
              _workflowCompleted: true,
            };
          }

          return {
            ...context.data,
            lastAction: 'wait-before-loop',
            shouldContinue: true,
            _workflowActive: true,
          };
        },
        nextStep: 'goto-loop',
        delay: 20000,
      },
    ],

    [
      'goto-loop',
      {
        name: 'Go To Loop Decision',
        handler: async (context) => {
          context.logger.log(
            '🔄 Volviendo al inicio del loop...',
            'LoopWorkflow',
          );

          if (context.data._workflowCompleted) {
            return {
              ...context.data,
              lastAction: 'completed',
              _workflowActive: false,
            };
          }

          return {
            ...context.data,
            lastAction: 'goto-loop',
            _workflowActive: true,
          };
        },
        nextStep: 'print-hello',
      },
    ],
  ]),
};

export const conditionalLoopWorkflow: WorkflowDefinition = {
  id: 'conditional-loop',
  name: 'Conditional Loop Workflow',
  version: 1,
  startStep: 'check-condition',
  steps: new Map([
    [
      'check-condition',
      {
        name: 'Check Condition',
        handler: async (context) => {
          const counter = context.data.counter || 0;
          context.logger.log(
            `🔍 Verificando condición. Counter: ${counter}`,
            'ConditionalLoop',
          );

          let nextPath: string;
          if (counter === 0) {
            nextPath = 'path-a';
          } else if (counter % 2 === 0) {
            nextPath = 'path-b';
          } else {
            nextPath = 'path-c';
          }

          return {
            ...context.data,
            counter: counter + 1,
            selectedPath: nextPath,
            lastCheck: new Date(),
            _workflowActive: true,
          };
        },
        nextStep: 'router',
      },
    ],

    [
      'router',
      {
        name: 'Route Decision',
        handler: async (context) => {
          context.logger.log(
            `🚦 Enrutando a: ${context.data.selectedPath}`,
            'ConditionalLoop',
          );

          return {
            ...context.data,
            _workflowActive: true,
          };
        },
        nextStep: 'execute-action',
      },
    ],

    [
      'execute-action',
      {
        name: 'Execute Action',
        handler: async (context) => {
          const actions = {
            'path-a': '🅰️ Ejecutando acción A - Proceso inicial',
            'path-b': '🅱️ Ejecutando acción B - Proceso par',
            'path-c': '🆎 Ejecutando acción C - Proceso impar',
          };

          const action =
            actions[context.data.selectedPath as keyof typeof actions] ||
            'Acción desconocida';
          context.logger.log(action, 'ConditionalLoop');

          const actionHistory = context.data.actionHistory || [];
          actionHistory.push({
            path: context.data.selectedPath,
            action,
            timestamp: new Date(),
            counter: context.data.counter,
          });

          return {
            ...context.data,
            actionHistory,
            lastAction: action,
            _workflowActive: true,
          };
        },
        nextStep: 'wait-and-decide',
        delay: 5000,
      },
    ],

    [
      'wait-and-decide',
      {
        name: 'Wait and Decide',
        handler: async (context) => {
          context.logger.log(
            '⏰ Esperando antes de decidir si continuar...',
            'ConditionalLoop',
          );

          if (context.data.counter >= 5) {
            context.logger.log(
              '✅ Workflow completado después de 5 iteraciones',
              'ConditionalLoop',
            );
            return {
              ...context.data,
              completed: true,
              completedAt: new Date(),
              _workflowActive: false,
              _workflowCompleted: true,
            };
          }

          return {
            ...context.data,
            _workflowActive: true,
          };
        },
        nextStep: 'check-condition',
        delay: 10000,
      },
    ],
  ]),
};
