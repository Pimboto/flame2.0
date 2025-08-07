// src/application/use-cases/import-accounts/__tests__/process-import-task.use-case.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import {
  ProcessImportTaskUseCase,
  ProcessImportTaskCommand,
} from '../process-import-task.use-case';
import { ITinderApiService } from '../../../../domain/interfaces/tinder-api.interface';
import { IAccountRepository } from '../../../../domain/interfaces/account.repository.interface';

describe('ProcessImportTaskUseCase', () => {
  let useCase: ProcessImportTaskUseCase;
  let tinderApiService: jest.Mocked<ITinderApiService>;
  let accountRepository: jest.Mocked<IAccountRepository>;

  beforeEach(async () => {
    const mockTinderApiService = {
      importAccounts: jest.fn(),
      getTaskStatus: jest.fn(),
      getAccountsByIds: jest.fn(),
    };

    const mockAccountRepository = {
      save: jest.fn(),
      saveMany: jest.fn(),
      findById: jest.fn(),
      findByExternalId: jest.fn(),
      findByExternalIds: jest.fn(),
      findAll: jest.fn(),
      findByStatus: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      exists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessImportTaskUseCase,
        {
          provide: 'ITinderApiService',
          useValue: mockTinderApiService,
        },
        {
          provide: 'IAccountRepository',
          useValue: mockAccountRepository,
        },
      ],
    }).compile();

    useCase = module.get<ProcessImportTaskUseCase>(ProcessImportTaskUseCase);
    tinderApiService = module.get('ITinderApiService');
    accountRepository = module.get('IAccountRepository');
  });

  describe('execute', () => {
    const command: ProcessImportTaskCommand = {
      taskId: 'task-123',
      apiToken: 'token-abc',
      accounts: [
        {
          account: 'test:account:1',
          class_info: {
            class_type: 'premium',
            class_color: '#FF0000',
          },
          account_origin: 'ios',
        },
      ],
      maxAttempts: 2,
    };

    it('should process completed import successfully', async () => {
      tinderApiService.getTaskStatus.mockResolvedValueOnce({
        status: 'COMPLETED',
        successful: 1,
        failed: 0,
        successful_ids: ['acc-1'],
      });

      tinderApiService.getAccountsByIds.mockResolvedValue({
        success: true,
        accounts: [
          {
            user_data: {
              id: 'acc-1',
              class_info: {
                class_type: 'premium',
                class_color: '#FF0000',
              },
              general_information: {
                name: 'Test User',
                age: 25,
                phone: '+1234567890',
                email: 'test@example.com',
                account_tag: 'tag123',
                image: 'https://example.com/image.jpg',
                location: 'New York',
                is_verified: true,
              },
              proxy: {
                https: 'https://proxy.example.com',
              },
              status: 'active',
            },
          },
        ],
      });

      accountRepository.saveMany.mockResolvedValue(undefined);

      const result = await useCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.summary.successful).toBe(1);
      expect(result.summary.failed).toBe(0);
      expect(result.summary.saved).toBe(1);

      expect(tinderApiService.getTaskStatus).toHaveBeenCalledWith(
        command.taskId,
        command.apiToken,
      );
      expect(tinderApiService.getAccountsByIds).toHaveBeenCalledWith(
        ['acc-1'],
        command.apiToken,
      );
      expect(accountRepository.saveMany).toHaveBeenCalled();
    });

    it('should handle no successful accounts', async () => {
      tinderApiService.getTaskStatus.mockResolvedValueOnce({
        status: 'COMPLETED',
        successful: 0,
        failed: 1,
        successful_ids: [],
      });

      const result = await useCase.execute(command);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No accounts were imported successfully');
      expect(result.summary.successful).toBe(0);
      expect(result.summary.failed).toBe(1);

      expect(tinderApiService.getAccountsByIds).not.toHaveBeenCalled();
      expect(accountRepository.saveMany).not.toHaveBeenCalled();
    });

    it('should handle failed import task', async () => {
      tinderApiService.getTaskStatus.mockResolvedValueOnce({
        status: 'FAILED',
      });

      await expect(useCase.execute(command)).rejects.toThrow(
        'Import task failed',
      );
    });

    it('should timeout after max attempts', async () => {
      tinderApiService.getTaskStatus.mockResolvedValue({
        status: 'PROCESSING',
      });

      await expect(useCase.execute(command)).rejects.toThrow(
        'Import task timeout - exceeded maximum attempts',
      );

      expect(tinderApiService.getTaskStatus).toHaveBeenCalledTimes(
        command.maxAttempts,
      );
    });

    it('should handle API errors gracefully', async () => {
      tinderApiService.getTaskStatus.mockRejectedValue(new Error('API Error'));

      await expect(useCase.execute(command)).rejects.toThrow('API Error');
    });
  });
});
