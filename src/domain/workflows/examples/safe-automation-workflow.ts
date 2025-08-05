import { WorkflowDefinition, WorkflowStep } from '../sample.workflow';
import { logger } from '../../../common/services/logger.service';

// Interfaz para la respuesta del API de control
interface ControlApiResponse {
  shouldContinue: boolean;
  status: 'ok' | 'warning' | 'error' | 'stop';
  message?: string;
  metadata?: any;
}

// Simulación de llamada a API de control (en producción sería una llamada real)
async function checkWorkflowCondition(data: any): Promise<ControlApiResponse> {
  const iteration = data.iteration || 0;

  // HARDCODED para prueba: parar en la 3ra iteración
  if (iteration >= 3) {
    return {
      shouldContinue: false,
      status: 'stop',
      message: 'Condición de parada alcanzada: máximo de iteraciones',
    };
  }

  // En producción, esto sería algo como:
  // const response = await fetch('https://api.empresa.com/workflow-control', {
  //   method: 'POST',
  //   body: JSON.stringify({ workflowId: data.workflowId, context: data })
  // });
  // return await response.json();

  return {
    shouldContinue: true,
    status: 'ok',
    message: 'Workflow puede continuar',
  };
}

// Workflow seguro con controles y condiciones
export const safeAutomationWorkflow: WorkflowDefinition = {
  id: 'safe-automation-workflow',
  name: 'Safe Automation Workflow with Conditional Stops',
  version: 1,
  startStep: 'initialize',
  steps: new Map<string, WorkflowStep>([
    // PASO 1: Inicialización
    [
      'initialize',
      {
        name: 'Initialize Workflow',
        handler: async (data) => {
          logger.log(
            '🚀 Iniciando workflow de automatización segura',
            'SafeWorkflow',
          );

          const initialData = {
            ...data,
            workflowId: `safe-workflow-${Date.now()}`,
            startedAt: new Date(),
            iteration: 0,
            history: [],
            status: 'running',
            _workflowActive: true,
          };

          logger.log(`Workflow ID: ${initialData.workflowId}`, 'SafeWorkflow');

          return initialData;
        },
        nextStep: 'pre-condition-check',
        timeout: 5000, // 5 segundos máximo para inicializar
      },
    ],

    // PASO 2: Verificación de condición ANTES de cada paso
    [
      'pre-condition-check',
      {
        name: 'Pre-Condition Check',
        handler: async (data) => {
          logger.log(
            `🔍 Verificando condiciones (Iteración #${data.iteration})`,
            'SafeWorkflow',
          );

          try {
            // Llamada a API de control
            const controlResponse = await checkWorkflowCondition(data);

            logger.log(
              `Respuesta de control: ${JSON.stringify(controlResponse)}`,
              'SafeWorkflow',
            );

            // Agregar respuesta al historial
            const history = [...(data.history || [])];
            history.push({
              step: 'pre-condition-check',
              iteration: data.iteration,
              timestamp: new Date(),
              controlResponse,
            });

            // Si no debe continuar, marcar para detención
            if (
              !controlResponse.shouldContinue ||
              controlResponse.status === 'stop'
            ) {
              logger.warn(
                `⛔ DETENIENDO WORKFLOW: ${controlResponse.message}`,
                'SafeWorkflow',
              );

              return {
                ...data,
                history,
                status: 'stopped',
                stoppedAt: new Date(),
                stopReason: controlResponse.message,
                _workflowActive: false,
                _workflowCompleted: true,
              };
            }

            // Si todo está bien, continuar
            return {
              ...data,
              history,
              lastCheck: new Date(),
              lastCheckResult: controlResponse,
              _workflowActive: true,
            };
          } catch (error) {
            logger.error(
              `❌ Error en verificación de condición: ${error}`,
              'SafeWorkflow',
            );

            // En caso de error, detener por seguridad
            return {
              ...data,
              status: 'error',
              error:
                error instanceof Error ? error.message : 'Error desconocido',
              errorAt: new Date(),
              _workflowActive: false,
              _workflowCompleted: true,
            };
          }
        },
        nextStep: 'wait-step',
        timeout: 10000, // 10 segundos máximo para verificar condición
      },
    ],

    // PASO 3: Espera de 20 segundos
    [
      'wait-step',
      {
        name: 'Wait Step',
        handler: async (data) => {
          // Verificar si el workflow fue detenido
          if (!data._workflowActive) {
            logger.log('Workflow ya detenido, saltando espera', 'SafeWorkflow');
            return data;
          }

          logger.log('⏳ Esperando 20 segundos...', 'SafeWorkflow');

          return {
            ...data,
            lastWaitStarted: new Date(),
            _workflowActive: true,
          };
        },
        nextStep: 'post-wait-check',
        delay: 20000, // Esperar 20 segundos
      },
    ],

    // PASO 4: Verificación POST-espera (por si algo cambió durante la espera)
    [
      'post-wait-check',
      {
        name: 'Post-Wait Condition Check',
        handler: async (data) => {
          logger.log(
            '🔍 Verificando condiciones después de la espera',
            'SafeWorkflow',
          );

          try {
            const controlResponse = await checkWorkflowCondition(data);

            if (
              !controlResponse.shouldContinue ||
              controlResponse.status === 'stop'
            ) {
              logger.warn(
                `⛔ DETENIENDO WORKFLOW después de espera: ${controlResponse.message}`,
                'SafeWorkflow',
              );

              return {
                ...data,
                status: 'stopped',
                stoppedAt: new Date(),
                stopReason: controlResponse.message,
                _workflowActive: false,
                _workflowCompleted: true,
              };
            }

            return {
              ...data,
              _workflowActive: true,
            };
          } catch (error) {
            logger.error(
              `❌ Error en verificación post-espera: ${error}`,
              'SafeWorkflow',
            );

            return {
              ...data,
              status: 'error',
              error:
                error instanceof Error ? error.message : 'Error desconocido',
              errorAt: new Date(),
              _workflowActive: false,
              _workflowCompleted: true,
            };
          }
        },
        nextStep: 'execute-action',
        timeout: 10000,
      },
    ],

    // PASO 5: Ejecutar acción principal (Hello World)
    [
      'execute-action',
      {
        name: 'Execute Main Action',
        handler: async (data) => {
          // Verificación final antes de ejecutar
          if (!data._workflowActive) {
            logger.log(
              'Workflow detenido, no se ejecutará la acción',
              'SafeWorkflow',
            );
            return data;
          }

          const message = `🌍 Hello World! (Iteración #${data.iteration + 1})`;
          logger.log(message, 'SafeWorkflow');

          // Guardar mensaje en el historial
          const messages = [...(data.messages || [])];
          messages.push({
            message,
            timestamp: new Date(),
            iteration: data.iteration + 1,
          });

          // Actualizar datos e incrementar iteración
          return {
            ...data,
            messages,
            iteration: data.iteration + 1,
            lastAction: 'execute-action',
            lastActionAt: new Date(),
            _workflowActive: true,
          };
        },
        nextStep: 'decide-next-step',
        timeout: 5000,
      },
    ],

    // PASO 6: Decidir si continuar el loop o terminar
    [
      'decide-next-step',
      {
        name: 'Decide Next Step',
        handler: async (data) => {
          logger.log('🤔 Decidiendo siguiente paso...', 'SafeWorkflow');

          // Verificar límites adicionales (por seguridad)
          const maxIterations = data.maxIterations || 10; // Límite de seguridad

          if (data.iteration >= maxIterations) {
            logger.log(
              '🏁 Límite máximo de iteraciones alcanzado',
              'SafeWorkflow',
            );

            return {
              ...data,
              status: 'completed',
              completedAt: new Date(),
              completionReason: 'Límite máximo de iteraciones',
              _workflowActive: false,
              _workflowCompleted: true,
            };
          }

          // Si todo está bien, continuar con el loop
          logger.log(
            '↩️ Continuando con siguiente iteración...',
            'SafeWorkflow',
          );

          return {
            ...data,
            _workflowActive: true,
          };
        },
        nextStep: 'pre-condition-check', // VOLVER AL INICIO DEL LOOP
      },
    ],
  ]),
};

// Función helper para ejecutar el workflow con datos de prueba
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
