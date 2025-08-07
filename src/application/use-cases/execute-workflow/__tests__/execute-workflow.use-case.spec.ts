// src/application/use-cases/execute-workflow/__tests__/execute-workflow.use-case.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ExecuteWorkflowUseCase } from '../execute-workflow.use-case';
import { ExecuteWorkflowCommand } from '../../../commands/execute-workflow.command';
import { WorkflowEngineService } from '../../../../infrastructure/workflow-engine.service';
import { BadRequestException } from '@nestjs/common';

describe('ExecuteWorkflowUseCase', () => {
  let useCase: ExecuteWorkflowUseCase;
  let workflowEngine: jest.Mocked<WorkflowEngineService>;

  beforeEach(async () => {
    const mockWorkflowEngine = {
      startWorkflow: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecuteWorkflowUseCase,
        {
          provide: WorkflowEngineService,
          useValue: mockWorkflowEngine,
        },
      ],
    }).compile();

    useCase = module.get<ExecuteWorkflowUseCase>(ExecuteWorkflowUseCase);
    workflowEngine = module.get(WorkflowEngineService);
  });

  describe('execute', () => {
    it('should execute valid workflow successfully', async () => {
      const command = new ExecuteWorkflowCommand(
        'safe-automation-workflow',
        { test: true },
        'user-123',
        1,
      );
      const executionId = 'exec-123';

      workflowEngine.startWorkflow.mockResolvedValue(executionId);

      const result = await useCase.execute(command);

      expect(result).toEqual({
        executionId,
        workflowId: command.workflowId,
        status: 'started',
        message: 'Workflow started successfully',
        createdAt: expect.any(Date),
      });

      expect(workflowEngine.startWorkflow).toHaveBeenCalledWith(
        command.workflowId,
        command.data,
      );
    });

    it('should throw BadRequestException for invalid workflow ID', async () => {
      const command = new ExecuteWorkflowCommand('invalid-workflow', {
        test: true,
      });

      await expect(useCase.execute(command)).rejects.toThrow(
        BadRequestException,
      );
      await expect(useCase.execute(command)).rejects.toThrow(
        'Invalid workflow ID: invalid-workflow',
      );

      expect(workflowEngine.startWorkflow).not.toHaveBeenCalled();
    });

    it('should handle empty data', async () => {
      const command = new ExecuteWorkflowCommand(
        'import-accounts-workflow',
        {},
      );
      const executionId = 'exec-456';

      workflowEngine.startWorkflow.mockResolvedValue(executionId);

      const result = await useCase.execute(command);

      expect(result.executionId).toBe(executionId);
      expect(workflowEngine.startWorkflow).toHaveBeenCalledWith(
        command.workflowId,
        {},
      );
    });

    it('should propagate workflow engine errors', async () => {
      const command = new ExecuteWorkflowCommand('safe-automation-workflow', {
        test: true,
      });
      const error = new Error('Engine error');

      workflowEngine.startWorkflow.mockRejectedValue(error);

      await expect(useCase.execute(command)).rejects.toThrow('Engine error');
    });
  });
});
