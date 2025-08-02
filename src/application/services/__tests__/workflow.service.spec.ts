import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowService } from '../workflow.service';
import { WorkflowEngineService } from '../../../infrastructure/workflow-engine.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('WorkflowService', () => {
  let service: WorkflowService;
  let engineService: jest.Mocked<WorkflowEngineService>;

  beforeEach(async () => {
    const mockEngineService = {
      startWorkflow: jest.fn(),
      getWorkflowStatus: jest.fn(),
      suspendWorkflow: jest.fn(),
      resumeWorkflow: jest.fn(),
      terminateWorkflow: jest.fn(),
      testWorkflow: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        {
          provide: WorkflowEngineService,
          useValue: mockEngineService,
        },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
    engineService = module.get(WorkflowEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeWorkflow', () => {
    it('should execute a valid workflow', async () => {
      const dto = { workflowId: 'sample-workflow', data: { test: true } };
      const instanceId = 'instance-123';

      engineService.startWorkflow.mockResolvedValue(instanceId);

      const result = await service.executeWorkflow(dto);

      expect(result).toEqual({
        success: true,
        instanceId,
        message: 'Workflow iniciado exitosamente',
      });
      expect(engineService.startWorkflow).toHaveBeenCalledWith(
        dto.workflowId,
        dto.data,
      );
    });

    it('should throw BadRequestException for invalid workflow', async () => {
      const dto = { workflowId: 'invalid-workflow', data: {} };

      await expect(service.executeWorkflow(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getWorkflowStatus', () => {
    it('should return workflow status', async () => {
      const instanceId = 'instance-123';
      const mockStatus = {
        status: 'running',
        data: { test: true },
        createTime: new Date(),
        completeTime: null,
      };

      engineService.getWorkflowStatus.mockResolvedValue(mockStatus as any);

      const result = await service.getWorkflowStatus(instanceId);

      expect(result).toEqual({
        instanceId,
        status: mockStatus.status,
        data: mockStatus.data,
        createTime: mockStatus.createTime,
        completeTime: mockStatus.completeTime,
      });
    });

    it('should throw NotFoundException when instance not found', async () => {
      const instanceId = 'non-existent';

      engineService.getWorkflowStatus.mockResolvedValue(null);

      await expect(service.getWorkflowStatus(instanceId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listAvailableWorkflows', () => {
    it('should return list of available workflows', async () => {
      const result = await service.listAvailableWorkflows();

      expect(result.workflows).toBeDefined();
      expect(result.workflows.length).toBeGreaterThan(0);
      expect(result.workflows[0]).toHaveProperty('id');
      expect(result.workflows[0]).toHaveProperty('name');
      expect(result.workflows[0]).toHaveProperty('description');
    });
  });
});
