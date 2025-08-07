// src/domain/workflows/examples/custom-workflows.ts

import { WorkflowDefinition } from '../sample.workflow';

export const orderProcessingWorkflow: WorkflowDefinition = {
  id: 'order-processing',
  name: 'Order Processing Workflow',
  version: 1,
  startStep: 'validate-order',
  steps: new Map([
    [
      'validate-order',
      {
        name: 'Validate Order',
        handler: async (context) => {
          context.logger.log('Validando pedido', 'OrderWorkflow');

          if (!context.data.items || !context.data.customer) {
            throw new Error('Pedido inválido');
          }

          return {
            ...context.data,
            validated: true,
            validatedAt: new Date(),
          };
        },
        nextStep: 'calculate-total',
      },
    ],

    [
      'calculate-total',
      {
        name: 'Calculate Total',
        handler: async (context) => {
          context.logger.log('Calculando total', 'OrderWorkflow');

          const total = context.data.items.reduce(
            (sum: number, item: any) => sum + item.price * item.quantity,
            0,
          );

          return {
            ...context.data,
            total,
            tax: total * 0.16,
            grandTotal: total * 1.16,
          };
        },
        nextStep: 'process-payment',
      },
    ],

    [
      'process-payment',
      {
        name: 'Process Payment',
        handler: async (context) => {
          context.logger.log('Procesando pago', 'OrderWorkflow');

          await new Promise((resolve) => setTimeout(resolve, 2000));

          return {
            ...context.data,
            paid: true,
            paymentId: `PAY-${Date.now()}`,
            paidAt: new Date(),
          };
        },
        nextStep: 'send-confirmation',
        delay: 1000,
      },
    ],

    [
      'send-confirmation',
      {
        name: 'Send Confirmation',
        handler: async (context) => {
          context.logger.log('Enviando confirmación', 'OrderWorkflow');
          context.logger.log(
            `Email enviado a ${context.data.customer.email}`,
            'OrderWorkflow',
          );

          return {
            ...context.data,
            confirmed: true,
            orderId: `ORD-${Date.now()}`,
            completedAt: new Date(),
          };
        },
      },
    ],
  ]),
};

export const conditionalWorkflow: WorkflowDefinition = {
  id: 'conditional-workflow',
  name: 'Conditional Workflow Example',
  version: 1,
  startStep: 'check-condition',
  steps: new Map([
    [
      'check-condition',
      {
        name: 'Check Condition',
        handler: async (context) => {
          context.logger.log('Verificando condición', 'ConditionalWorkflow');

          if (context.data.amount > 1000) {
            return {
              ...context.data,
              requiresApproval: true,
              nextStep: 'manager-approval',
            };
          } else {
            return {
              ...context.data,
              requiresApproval: false,
              nextStep: 'auto-approve',
            };
          }
        },
        nextStep: undefined,
      },
    ],

    [
      'manager-approval',
      {
        name: 'Manager Approval',
        handler: async (context) => {
          context.logger.log(
            'Esperando aprobación del gerente',
            'ConditionalWorkflow',
          );

          await new Promise((resolve) => setTimeout(resolve, 3000));

          return {
            ...context.data,
            approved: true,
            approvedBy: 'manager@company.com',
          };
        },
        nextStep: 'process',
      },
    ],

    [
      'auto-approve',
      {
        name: 'Auto Approve',
        handler: async (context) => {
          context.logger.log('Aprobación automática', 'ConditionalWorkflow');

          return {
            ...context.data,
            approved: true,
            approvedBy: 'system',
          };
        },
        nextStep: 'process',
      },
    ],

    [
      'process',
      {
        name: 'Process',
        handler: async (context) => {
          context.logger.log('Procesando...', 'ConditionalWorkflow');

          return {
            ...context.data,
            processed: true,
            processedAt: new Date(),
          };
        },
      },
    ],
  ]),
};
