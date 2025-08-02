import { WorkflowDefinition } from '../sample.workflow';
import { logger } from '../../../common/services/logger.service';

// Ejemplo: Workflow de procesamiento de pedidos
export const orderProcessingWorkflow: WorkflowDefinition = {
  id: 'order-processing',
  name: 'Order Processing Workflow',
  version: 1,
  startStep: 'validate-order',
  steps: new Map([
    ['validate-order', {
      name: 'Validate Order',
      handler: async (data) => {
        logger.log('Validando pedido', 'OrderWorkflow');
        
        // Validar que tenga los campos necesarios
        if (!data.items || !data.customer) {
          throw new Error('Pedido inválido');
        }
        
        return {
          ...data,
          validated: true,
          validatedAt: new Date(),
        };
      },
      nextStep: 'calculate-total',
    }],
    
    ['calculate-total', {
      name: 'Calculate Total',
      handler: async (data) => {
        logger.log('Calculando total', 'OrderWorkflow');
        
        const total = data.items.reduce((sum: number, item: any) => 
          sum + (item.price * item.quantity), 0
        );
        
        return {
          ...data,
          total,
          tax: total * 0.16, // 16% IVA
          grandTotal: total * 1.16,
        };
      },
      nextStep: 'process-payment',
    }],
    
    ['process-payment', {
      name: 'Process Payment',
      handler: async (data) => {
        logger.log('Procesando pago', 'OrderWorkflow');
        
        // Aquí iría la integración con pasarela de pagos
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simular
        
        return {
          ...data,
          paid: true,
          paymentId: `PAY-${Date.now()}`,
          paidAt: new Date(),
        };
      },
      nextStep: 'send-confirmation',
      delay: 1000, // Esperar 1 segundo antes del siguiente paso
    }],
    
    ['send-confirmation', {
      name: 'Send Confirmation',
      handler: async (data) => {
        logger.log('Enviando confirmación', 'OrderWorkflow');
        
        // Aquí iría el envío de email
        logger.log(`Email enviado a ${data.customer.email}`, 'OrderWorkflow');
        
        return {
          ...data,
          confirmed: true,
          orderId: `ORD-${Date.now()}`,
          completedAt: new Date(),
        };
      },
    }],
  ]),
};

// Ejemplo: Workflow con decisiones condicionales
export const conditionalWorkflow: WorkflowDefinition = {
  id: 'conditional-workflow',
  name: 'Conditional Workflow Example',
  version: 1,
  startStep: 'check-condition',
  steps: new Map([
    ['check-condition', {
      name: 'Check Condition',
      handler: async (data) => {
        logger.log('Verificando condición', 'ConditionalWorkflow');
        
        // Decisión basada en los datos
        if (data.amount > 1000) {
          return {
            ...data,
            requiresApproval: true,
            nextStep: 'manager-approval',
          };
        } else {
          return {
            ...data,
            requiresApproval: false,
            nextStep: 'auto-approve',
          };
        }
      },
      // El siguiente paso se determina dinámicamente
      nextStep: undefined,
    }],
    
    ['manager-approval', {
      name: 'Manager Approval',
      handler: async (data) => {
        logger.log('Esperando aprobación del gerente', 'ConditionalWorkflow');
        
        // Simular aprobación
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        return {
          ...data,
          approved: true,
          approvedBy: 'manager@company.com',
        };
      },
      nextStep: 'process',
    }],
    
    ['auto-approve', {
      name: 'Auto Approve',
      handler: async (data) => {
        logger.log('Aprobación automática', 'ConditionalWorkflow');
        
        return {
          ...data,
          approved: true,
          approvedBy: 'system',
        };
      },
      nextStep: 'process',
    }],
    
    ['process', {
      name: 'Process',
      handler: async (data) => {
        logger.log('Procesando...', 'ConditionalWorkflow');
        
        return {
          ...data,
          processed: true,
          processedAt: new Date(),
        };
      },
    }],
  ]),
};
