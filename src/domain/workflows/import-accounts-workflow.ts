// src/domain/workflows/import-accounts-workflow.ts
// WORKFLOW DE DOMINIO - Sin dependencias de infraestructura

import { WorkflowDefinition, WorkflowStep } from './sample.workflow';
import { Account } from '../entities/account.entity';

// Interfaces para el workflow
export interface ImportAccountsData {
  accounts: Array<{
    account: string;
    class_info: {
      class_type: string;
      class_color: string;
    };
    account_origin: string;
  }>;
  apiToken: string;
  executionId?: string;
  taskId?: string;
  attemptCount?: number;
  maxAttempts?: number;
  successful_ids?: string[];
  failed_count?: number;
  successful_count?: number;
  importedAccounts?: any[];
  // Servicios inyectados
  services?: {
    tinderApi?: any;
    accountRepository?: any;
  };
}

// Factory function para crear el workflow con dependencias inyectadas
export function createImportAccountsWorkflow(
  tinderApiService: any,
  accountRepository: any,
  logger: any,
): WorkflowDefinition {
  // Paso 1: Importar cuentas a la API
  const importAccountsStep: WorkflowStep = {
    name: 'Import Accounts',
    timeout: 60000, // 1 minuto
    handler: async (data: ImportAccountsData) => {
      logger.log(
        `🚀 [ImportAccounts] Iniciando importación de ${data.accounts.length} cuentas`,
      );

      // Validar token
      if (!data.apiToken) {
        throw new Error('API token is required');
      }

      const response = await tinderApiService.importAccounts(
        data.accounts,
        data.apiToken,
      );

      logger.log(`✅ [ImportAccounts] Task creado: ${response.task_id}`);

      return {
        ...data,
        taskId: response.task_id,
        attemptCount: 0,
        maxAttempts: 150, // 150 * 4 segundos = 10 minutos máximo
        status: 'importing',
        _workflowActive: true,
      };
    },
    nextStep: 'poll-status',
  };

  // Paso 2: Hacer polling del estado
  const pollStatusStep: WorkflowStep = {
    name: 'Poll Status',
    timeout: 10000, // 10 segundos por intento
    delay: 4000, // Esperar 4 segundos antes de cada intento
    handler: async (data: ImportAccountsData) => {
      const currentAttempt = (data.attemptCount || 0) + 1;
      logger.log(
        `🔍 [PollStatus] Intento ${currentAttempt}/${data.maxAttempts} - Verificando estado de ${data.taskId}`,
      );

      const statusResponse = await tinderApiService.getTaskStatus(
        data.taskId,
        data.apiToken,
      );

      logger.log(
        `📊 [PollStatus] Estado: ${statusResponse.status}, Progreso: ${statusResponse.progress || 'N/A'}`,
      );

      // Actualizar datos
      const updatedData = {
        ...data,
        attemptCount: currentAttempt,
        status: statusResponse.status.toLowerCase(),
      };

      // Si está completado
      if (statusResponse.status === 'COMPLETED') {
        const successfulCount = statusResponse.successful || 0;
        const failedCount = statusResponse.failed || 0;

        logger.log(
          `🎉 [PollStatus] Importación completada - Exitosas: ${successfulCount}, Fallidas: ${failedCount}`,
        );

        // Si NO hay cuentas exitosas, terminar el workflow
        if (successfulCount === 0) {
          logger.log(
            `❌ [PollStatus] No se importó ninguna cuenta exitosamente`,
          );

          return {
            ...updatedData,
            successful_ids: [],
            successful_count: 0,
            failed_count: failedCount,
            _workflowActive: false,
            _workflowCompleted: true,
            status: 'completed_no_success',
            message: `Import completed but no accounts were successful. ${failedCount} accounts failed.`,
            summary: {
              totalProcessed: data.accounts.length,
              successful: 0,
              failed: failedCount,
              saved: 0,
              timestamp: new Date().toISOString(),
            },
          };
        }

        // Si SÍ hay cuentas exitosas, continuar
        return {
          ...updatedData,
          successful_ids: statusResponse.successful_ids || [],
          successful_count: successfulCount,
          failed_count: failedCount,
          _workflowActive: true,
          _nextStep: 'fetch-account-details',
        };
      }

      // Si falló
      if (statusResponse.status === 'FAILED') {
        logger.error(`❌ [PollStatus] Importación falló`);
        throw new Error('Import task failed');
      }

      // Si llegamos al máximo de intentos (timeout global)
      if (currentAttempt >= (data.maxAttempts || 150)) {
        logger.error(`⏰ [PollStatus] Timeout - Máximo de intentos alcanzado`);
        throw new Error('Polling timeout - task did not complete in time');
      }

      // Continuar haciendo polling
      logger.log(
        `⏳ [PollStatus] Estado: ${statusResponse.status} - Continuando polling...`,
      );
      return {
        ...updatedData,
        _workflowActive: true,
        _nextStep: 'poll-status', // Volver a este mismo paso
      };
    },
    nextStep: 'poll-status',
  };

  // Paso 3: Obtener detalles de las cuentas exitosas
  const fetchAccountDetailsStep: WorkflowStep = {
    name: 'Fetch Account Details',
    timeout: 30000, // 30 segundos
    handler: async (data: ImportAccountsData) => {
      const successfulIds = data.successful_ids || [];

      if (successfulIds.length === 0) {
        logger.log(`⚠️ [FetchDetails] No hay cuentas exitosas para procesar`);
        return {
          ...data,
          importedAccounts: [],
          _workflowActive: false,
          _workflowCompleted: true,
          status: 'completed_no_accounts',
          message: 'No successful accounts to process',
        };
      }

      logger.log(
        `🔍 [FetchDetails] Obteniendo detalles de ${successfulIds.length} cuentas exitosas`,
      );

      const detailsResponse = await tinderApiService.getAccountsByIds(
        successfulIds,
        data.apiToken,
      );

      if (!detailsResponse.success) {
        throw new Error('Failed to fetch account details');
      }

      logger.log(
        `✅ [FetchDetails] Obtenidos detalles de ${detailsResponse.accounts.length} cuentas`,
      );

      // Mapear los datos para las entidades de dominio
      const importedAccounts = detailsResponse.accounts.map(
        (accountDetail: any, index: number) => {
          // Buscar la cuenta original correspondiente (por índice por ahora)
          const originalAccount = data.accounts[index] || data.accounts[0];

          return {
            externalId: accountDetail.user_data.id,
            accountString: originalAccount?.account || '',
            accountOrigin: originalAccount?.account_origin || 'unknown',
            classInfo: {
              classType: accountDetail.user_data.class_info.class_type,
              classColor: accountDetail.user_data.class_info.class_color,
            },
            generalInformation: {
              name: accountDetail.user_data.general_information.name,
              age: accountDetail.user_data.general_information.age,
              phone: accountDetail.user_data.general_information.phone,
              email: accountDetail.user_data.general_information.email,
              accountTag:
                accountDetail.user_data.general_information.account_tag,
              image: accountDetail.user_data.general_information.image,
              location: accountDetail.user_data.general_information.location,
              isVerified:
                accountDetail.user_data.general_information.is_verified,
            },
            proxy: {
              https: accountDetail.user_data.proxy.https,
            },
            status: accountDetail.user_data.status,
          };
        },
      );

      return {
        ...data,
        importedAccounts,
        _workflowActive: true,
        _nextStep: 'save-accounts',
      };
    },
    nextStep: 'save-accounts',
  };

  // Paso 4: Guardar cuentas en la base de datos
  const saveAccountsStep: WorkflowStep = {
    name: 'Save Accounts',
    timeout: 30000, // 30 segundos
    handler: async (data: ImportAccountsData) => {
      const accountsToSave = data.importedAccounts || [];

      logger.log(
        `💾 [SaveAccounts] Guardando ${accountsToSave.length} cuentas en la base de datos`,
      );

      if (accountsToSave.length === 0) {
        logger.log(`⚠️ [SaveAccounts] No hay cuentas para guardar`);
        return {
          ...data,
          _workflowActive: false,
          _workflowCompleted: true,
          status: 'completed_no_save',
          message: 'No accounts to save',
        };
      }

      // Convertir a entidades de dominio
      const domainAccounts = accountsToSave.map((accountData) =>
        Account.create(
          accountData.externalId,
          accountData.accountString,
          accountData.accountOrigin,
          accountData.classInfo,
          accountData.generalInformation,
          accountData.proxy,
          accountData.status,
        ),
      );

      logger.log(
        `✅ [SaveAccounts] Preparadas ${domainAccounts.length} entidades de dominio`,
      );

      // Guardar usando el repositorio inyectado
      try {
        await accountRepository.saveMany(domainAccounts);
        logger.log(
          `✅ [SaveAccounts] ${domainAccounts.length} cuentas guardadas exitosamente`,
        );
      } catch (error) {
        logger.error(`❌ [SaveAccounts] Error guardando cuentas:`, error);
        throw new Error(
          `Failed to save accounts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      const summary = {
        totalProcessed: data.accounts.length,
        successful: data.successful_count || 0,
        failed: data.failed_count || 0,
        saved: domainAccounts.length,
        timestamp: new Date().toISOString(),
        accountsToSave: domainAccounts.map((acc) => acc.toPlainObject()),
      };

      logger.log(`🎯 [SaveAccounts] Resumen final:`, summary);

      return {
        ...data,
        summary,
        domainAccounts: domainAccounts.map((acc) => acc.toPlainObject()),
        _workflowActive: false,
        _workflowCompleted: true,
        status: 'completed',
        message: `Successfully saved ${domainAccounts.length} accounts`,
      };
    },
    nextStep: undefined, // Fin del workflow
  };

  // Retornar la definición del workflow
  return {
    id: 'import-accounts-workflow',
    name: 'Import Tinder Accounts Workflow',
    version: 1,
    startStep: 'import-accounts',
    steps: new Map([
      ['import-accounts', importAccountsStep],
      ['poll-status', pollStatusStep],
      ['fetch-account-details', fetchAccountDetailsStep],
      ['save-accounts', saveAccountsStep],
    ]),
  };
}

// Export adicional para compatibilidad (si es necesario)
export const importAccountsWorkflow = createImportAccountsWorkflow;
