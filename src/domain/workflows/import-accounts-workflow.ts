// src/domain/workflows/import-accounts-workflow.ts

import { WorkflowDefinition, WorkflowStep } from './sample.workflow';

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
}

export function createImportAccountsWorkflowDefinition(): WorkflowDefinition {
  const startImportStep: WorkflowStep = {
    name: 'Start Import',
    timeout: 60000,
    handler: async (context) => {
      context.logger.log(
        `Starting import of ${context.data.accounts.length} accounts`,
        'ImportWorkflow',
      );

      if (!context.data.apiToken) {
        throw new Error('API token is required');
      }

      return {
        ...context.data,
        status: 'initializing',
        startedAt: new Date(),
        _workflowActive: true,
      };
    },
    nextStep: 'call-import-api',
  };

  const callImportApiStep: WorkflowStep = {
    name: 'Call Import API',
    timeout: 30000,
    handler: async (context) => {
      context.logger.log('Calling import API', 'ImportWorkflow');

      return {
        ...context.data,
        status: 'api_called',
        _workflowActive: true,
        _needsExternalProcessing: true,
      };
    },
    nextStep: 'wait-for-processing',
  };

  const waitForProcessingStep: WorkflowStep = {
    name: 'Wait for Processing',
    timeout: 600000,
    delay: 4000,
    handler: async (context) => {
      const attemptCount = (context.data.attemptCount || 0) + 1;
      const maxAttempts = context.data.maxAttempts || 150;

      context.logger.log(
        `Waiting for import completion - Attempt ${attemptCount}/${maxAttempts}`,
        'ImportWorkflow',
      );

      if (attemptCount >= maxAttempts) {
        return {
          ...context.data,
          status: 'timeout',
          error: 'Import processing timeout',
          _workflowActive: false,
          _workflowCompleted: true,
        };
      }

      return {
        ...context.data,
        attemptCount,
        status: 'processing',
        _workflowActive: true,
        _requiresStatusCheck: true,
      };
    },
    nextStep: 'check-import-status',
  };

  const checkImportStatusStep: WorkflowStep = {
    name: 'Check Import Status',
    timeout: 10000,
    handler: async (context) => {
      context.logger.log('Checking import status', 'ImportWorkflow');

      return {
        ...context.data,
        lastCheck: new Date(),
        _workflowActive: true,
      };
    },
    nextStep: 'process-results',
  };

  const processResultsStep: WorkflowStep = {
    name: 'Process Results',
    timeout: 30000,
    handler: async (context) => {
      context.logger.log('Processing import results', 'ImportWorkflow');

      const hasSuccessful = context.data.successful_count > 0;

      if (!hasSuccessful) {
        return {
          ...context.data,
          status: 'completed_no_success',
          _workflowActive: false,
          _workflowCompleted: true,
        };
      }

      return {
        ...context.data,
        status: 'saving',
        _workflowActive: true,
      };
    },
    nextStep: 'save-to-database',
  };

  const saveToDatabaseStep: WorkflowStep = {
    name: 'Save to Database',
    timeout: 30000,
    handler: async (context) => {
      context.logger.log('Saving accounts to database', 'ImportWorkflow');

      return {
        ...context.data,
        status: 'completed',
        completedAt: new Date(),
        _workflowActive: false,
        _workflowCompleted: true,
      };
    },
    nextStep: undefined,
  };

  return {
    id: 'import-accounts-workflow',
    name: 'Import Tinder Accounts Workflow',
    version: 2,
    startStep: 'start-import',
    steps: new Map([
      ['start-import', startImportStep],
      ['call-import-api', callImportApiStep],
      ['wait-for-processing', waitForProcessingStep],
      ['check-import-status', checkImportStatusStep],
      ['process-results', processResultsStep],
      ['save-to-database', saveToDatabaseStep],
    ]),
  };
}

// For backwards compatibility
export function createImportAccountsWorkflow(
  _tinderApiService?: any,
  _accountRepository?: any,
): WorkflowDefinition {
  // Return the pure workflow definition
  // The services will be injected at the application layer
  return createImportAccountsWorkflowDefinition();
}

export const importAccountsWorkflow = createImportAccountsWorkflow;
