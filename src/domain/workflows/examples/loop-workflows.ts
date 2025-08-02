import { WorkflowDefinition } from '../sample.workflow';
import { logger } from '../../../common/services/logger.service';

// Workflow con loop infinito y waits
export const loopWorkflowDefinition: WorkflowDefinition = {
  id: 'loop-workflow',
  name: 'Loop Workflow with Waits',
  version: 1,
  startStep: 'initial-wait',
  steps: new Map([
    ['initial-wait', {
      name: 'Initial Wait',
      handler: async (data) => {
        logger.log('🕐 Esperando 20 segundos antes de empezar...', 'LoopWorkflow');
        
        // Mantener contador de iteraciones
        const iteration = data.iteration || 0;
        
        return {
          ...data,
          iteration: iteration + 1,
          startedAt: data.startedAt || new Date(),
          lastAction: 'initial-wait',
        };
      },
      nextStep: 'print-hello',
      delay: 20000, // 20 segundos
    }],
    
    ['print-hello', {
      name: 'Print Hello World',
      handler: async (data) => {
        const message = `🌍 Hello World! (Iteración #${data.iteration})`;
        logger.log(message, 'LoopWorkflow');
        
        // Guardar historial de mensajes
        const messages = data.messages || [];
        messages.push({
          message,
          timestamp: new Date(),
          iteration: data.iteration,
        });
        
        return {
          ...data,
          messages,
          lastAction: 'print-hello',
          lastPrint: new Date(),
        };
      },
      nextStep: 'wait-before-loop',
    }],
    
    ['wait-before-loop', {
      name: 'Wait Before Loop',
      handler: async (data) => {
        logger.log('⏳ Esperando 20 segundos antes de repetir...', 'LoopWorkflow');
        
        // Verificar si debemos continuar el loop
        const maxIterations = data.maxIterations || 10; // Por defecto 10 iteraciones
        
        if (data.iteration >= maxIterations) {
          logger.log('🛑 Alcanzado el máximo de iteraciones. Terminando workflow.', 'LoopWorkflow');
          return {
            ...data,
            completed: true,
            completedAt: new Date(),
            lastAction: 'completed',
          };
        }
        
        return {
          ...data,
          lastAction: 'wait-before-loop',
          shouldContinue: true,
        };
      },
      nextStep: 'goto-loop', // Ir al paso de decisión
      delay: 20000, // 20 segundos
    }],
    
    ['goto-loop', {
      name: 'Go To Loop Decision',
      handler: async (data) => {
        logger.log('🔄 Volviendo al inicio del loop...', 'LoopWorkflow');
        
        // Este paso simplemente pasa los datos al siguiente
        return {
          ...data,
          lastAction: 'goto-loop',
        };
      },
      nextStep: 'print-hello', // Volver a imprimir hello world
    }],
  ]),
};

// Workflow con condicionales y múltiples rutas
export const conditionalLoopWorkflow: WorkflowDefinition = {
  id: 'conditional-loop',
  name: 'Conditional Loop Workflow',
  version: 1,
  startStep: 'check-condition',
  steps: new Map([
    ['check-condition', {
      name: 'Check Condition',
      handler: async (data) => {
        const counter = data.counter || 0;
        logger.log(`🔍 Verificando condición. Counter: ${counter}`, 'ConditionalLoop');
        
        // Decidir qué camino tomar basado en el contador
        let nextPath: string;
        if (counter === 0) {
          nextPath = 'path-a';
        } else if (counter % 2 === 0) {
          nextPath = 'path-b';
        } else {
          nextPath = 'path-c';
        }
        
        return {
          ...data,
          counter: counter + 1,
          selectedPath: nextPath,
          lastCheck: new Date(),
        };
      },
      nextStep: 'router',
    }],
    
    ['router', {
      name: 'Route Decision',
      handler: async (data) => {
        logger.log(`🚦 Enrutando a: ${data.selectedPath}`, 'ConditionalLoop');
        
        // En un workflow real, aquí iríamos dinámicamente al paso correcto
        // Por limitaciones de la implementación actual, seguimos un flujo lineal
        return data;
      },
      nextStep: 'execute-action',
    }],
    
    ['execute-action', {
      name: 'Execute Action',
      handler: async (data) => {
        const actions = {
          'path-a': '🅰️ Ejecutando acción A - Proceso inicial',
          'path-b': '🅱️ Ejecutando acción B - Proceso par',
          'path-c': '🆎 Ejecutando acción C - Proceso impar',
        };
        
        const action = actions[data.selectedPath as keyof typeof actions] || 'Acción desconocida';
        logger.log(action, 'ConditionalLoop');
        
        // Guardar historial de acciones
        const actionHistory = data.actionHistory || [];
        actionHistory.push({
          path: data.selectedPath,
          action,
          timestamp: new Date(),
          counter: data.counter,
        });
        
        return {
          ...data,
          actionHistory,
          lastAction: action,
        };
      },
      nextStep: 'wait-and-decide',
      delay: 5000, // 5 segundos entre acciones
    }],
    
    ['wait-and-decide', {
      name: 'Wait and Decide',
      handler: async (data) => {
        logger.log('⏰ Esperando antes de decidir si continuar...', 'ConditionalLoop');
        
        // Terminar después de 5 iteraciones
        if (data.counter >= 5) {
          logger.log('✅ Workflow completado después de 5 iteraciones', 'ConditionalLoop');
          return {
            ...data,
            completed: true,
            completedAt: new Date(),
          };
        }
        
        return data;
      },
      nextStep: 'check-condition', // Volver al inicio
      delay: 10000, // 10 segundos
    }],
  ]),
};
