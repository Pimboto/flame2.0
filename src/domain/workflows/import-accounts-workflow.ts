import { WorkflowDefinition, WorkflowStep } from './sample.workflow';

// Interfaces para el workflow
interface ImportAccountsData {
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
}

interface ApiTaskResponse {
  task_id: string;
  status: 'PENDING' | 'STARTED' | 'COMPLETED' | 'FAILED';
  progress?: string;
  successful?: number;
  failed?: number;
  successful_ids?: string[];
}

interface AccountDetailsResponse {
  success: boolean;
  accounts: Array<{
    user_data: {
      id: string;
      general_information: {
        name: string;
        age?: number;
        phone?: string;
        email?: string;
        account_tag?: string;
        image?: string;
        location?: string;
        is_verified?: boolean;
      };
      class_info: {
        class_type: string;
        class_color: string;
      };
      status: string;
      proxy: {
        https: string;
      };
    };
  }>;
  total: number;
}

// Función auxiliar para hacer HTTP requests
async function makeHttpRequest(
  url: string,
  options: RequestInit,
): Promise<any> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(
        `HTTP Error: ${response.status} - ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    throw new Error(
      `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

// Paso 1: Importar cuentas a la API
const importAccountsStep: WorkflowStep = {
  name: 'Import Accounts',
  timeout: 60000, // 1 minuto
  handler: async (data: ImportAccountsData) => {
    console.log(
      `🚀 [ImportAccounts] Iniciando importación de ${data.accounts.length} cuentas`,
    );

    const payload = {
      accounts: data.accounts,
    };

    const response: ApiTaskResponse = await makeHttpRequest(
      'https://api.flamebot-tin.com/api/add-tinder-cards',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.apiToken}`,
        },
        body: JSON.stringify(payload),
      },
    );

    console.log(`✅ [ImportAccounts] Task creado: ${response.task_id}`);

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
    console.log(
      `🔍 [PollStatus] Intento ${currentAttempt}/${data.maxAttempts} - Verificando estado de ${data.taskId}`,
    );

    const statusResponse: ApiTaskResponse = await makeHttpRequest(
      `https://api.flamebot-tin.com/api/get-add-tinder-cards-status/${data.taskId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${data.apiToken}`,
        },
      },
    );

    console.log(
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
      
      console.log(
        `🎉 [PollStatus] Importación completada - Exitosas: ${successfulCount}, Fallidas: ${failedCount}`,
      );

      // Si NO hay cuentas exitosas, terminar el workflow completamente
      if (successfulCount === 0) {
        console.log(`❌ [PollStatus] No se importó ninguna cuenta exitosamente - Terminando workflow`);
        
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
            timestamp: new Date().toISOString()
          }
        };
      }

      // Si SÍ hay cuentas exitosas, continuar al siguiente paso
      return {
        ...updatedData,
        successful_ids: statusResponse.successful_ids || [],
        successful_count: successfulCount,
        failed_count: failedCount,
        _workflowActive: true,
        _nextStep: 'fetch-account-details'
      };
    }

    // Si falló
    if (statusResponse.status === 'FAILED') {
      console.error(`❌ [PollStatus] Importación falló`);
      throw new Error('Import task failed');
    }

    // Si llegamos al máximo de intentos
    if (currentAttempt >= (data.maxAttempts || 150)) {
      console.error(`⏰ [PollStatus] Timeout - Máximo de intentos alcanzado`);
      throw new Error('Polling timeout - task did not complete in time');
    }

    // Continuar haciendo polling - VOLVER AL MISMO PASO
    console.log(
      `⏳ [PollStatus] Estado: ${statusResponse.status} - Continuando polling...`,
    );
    return {
      ...updatedData,
      _workflowActive: true,
      _nextStep: 'poll-status', // Volver a este mismo paso hasta que esté COMPLETED
    };
  },
  nextStep: 'poll-status', // Paso por defecto es volver a sí mismo
};

// Paso 3: Obtener detalles de las cuentas exitosas
const fetchAccountDetailsStep: WorkflowStep = {
  name: 'Fetch Account Details',
  timeout: 30000, // 30 segundos
  handler: async (data: ImportAccountsData) => {
    const successfulIds = data.successful_ids || [];

    if (successfulIds.length === 0) {
      console.log(`⚠️ [FetchDetails] No hay cuentas exitosas para procesar`);
      return {
        ...data,
        importedAccounts: [],
        _workflowActive: false,
        _workflowCompleted: true,
        status: 'completed_no_accounts',
        message: 'No successful accounts to process'
      };
    }

    console.log(
      `🔍 [FetchDetails] Obteniendo detalles de ${successfulIds.length} cuentas exitosas`,
    );

    const detailsResponse: AccountDetailsResponse = await makeHttpRequest(
      'https://api.flamebot-tin.com/api/get-tinder-accounts-by-ids',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.apiToken}`,
        },
        body: JSON.stringify(successfulIds),
      },
    );

    if (!detailsResponse.success) {
      throw new Error('Failed to fetch account details');
    }

    console.log(
      `✅ [FetchDetails] Obtenidos detalles de ${detailsResponse.accounts.length} cuentas`,
    );

    // Mapear los datos originales con los detalles obtenidos
    const importedAccounts = detailsResponse.accounts.map((accountDetail) => {
      // Buscar la cuenta original correspondiente
      const originalAccount = data.accounts.find((original) => {
        // Aquí necesitamos una forma de relacionar la cuenta original con la importada
        // Por ahora usaremos el orden, pero idealmente tendríamos un identificador único
        return true; // Simplificado por ahora
      });

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
          accountTag: accountDetail.user_data.general_information.account_tag,
          image: accountDetail.user_data.general_information.image,
          location: accountDetail.user_data.general_information.location,
          isVerified: accountDetail.user_data.general_information.is_verified,
        },
        proxy: {
          https: accountDetail.user_data.proxy.https,
        },
        status: accountDetail.user_data.status,
      };
    });

    return {
      ...data,
      importedAccounts,
      _workflowActive: true,
      _nextStep: 'save-accounts' // Especificar explícitamente el siguiente paso
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

    console.log(
      `💾 [SaveAccounts] Guardando ${accountsToSave.length} cuentas en la base de datos`,
    );

    if (accountsToSave.length === 0) {
      console.log(`⚠️ [SaveAccounts] No hay cuentas para guardar`);
      return {
        ...data,
        _workflowActive: false,
        _workflowCompleted: true,
        status: 'completed_no_save',
        message: 'No accounts to save',
      };
    }

    // Convertir a entidades de dominio
    const { Account } = await import('../entities/account.entity');
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

    console.log(
      `✅ [SaveAccounts] Preparadas ${domainAccounts.length} entidades de dominio para guardar`,
    );

    // Obtener el repositorio y guardar las cuentas
    try {
      const { WorkflowEngineService } = await import('../../infrastructure/workflow-engine.service');
      const accountRepository = WorkflowEngineService.getAccountRepository();
      
      console.log(`💾 [SaveAccounts] Guardando ${domainAccounts.length} cuentas en la base de datos...`);
      await accountRepository.saveMany(domainAccounts);
      
      console.log(`✅ [SaveAccounts] ${domainAccounts.length} cuentas guardadas exitosamente en la base de datos`);
    } catch (error) {
      console.error(`❌ [SaveAccounts] Error guardando cuentas:`, error);
      throw new Error(`Failed to save accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const summary = {
      totalProcessed: data.accounts.length,
      successful: data.successful_count || 0,
      failed: data.failed_count || 0,
      saved: domainAccounts.length,
      timestamp: new Date().toISOString(),
      accountsToSave: domainAccounts.map((acc) => acc.toPlainObject()),
    };

    console.log(`🎯 [SaveAccounts] Resumen final:`, summary);

    return {
      ...data,
      summary,
      domainAccounts: domainAccounts.map((acc) => acc.toPlainObject()),
      _workflowActive: false,
      _workflowCompleted: true,
      status: 'completed',
      message: `Successfully prepared ${domainAccounts.length} accounts for saving`,
    };
  },
  nextStep: undefined, // Fin del workflow
};

// Definición completa del workflow
export const importAccountsWorkflow: WorkflowDefinition = {
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
