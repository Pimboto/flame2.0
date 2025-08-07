// src/infrastructure/services/__tests__/workflow-executor.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowExecutorService } from '../workflow-executor.service';
import { WorkflowDefinition } from '../../../domain/workflows/sample.workflow';

describe('WorkflowExecutorService', () => {
  let service: WorkflowExecutorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkflowExecutorService],
    }).compile();

    service = module.get<WorkflowExecutorService>(WorkflowExecutorService);
  });

  describe('registerWorkflow', () => {
    it('should register a workflow', () => {
      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: 1,
        startStep: 'step1',
        steps: new Map([
          [
            'step1',
            {
              name: 'Step 1',
              handler: async (context) => ({ ...context.data, step1: true }),
            },
          ],
        ]),
      };

      service.registerWorkflow(workflow);

      expect(service.getWorkflow('test-workflow')).toBe(workflow);
    });
  });

  describe('getWorkflow', () => {
    it('should return registered workflow', () => {
      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: 1,
        startStep: 'step1',
        steps: new Map(),
      };

      service.registerWorkflow(workflow);

      expect(service.getWorkflow('test-workflow')).toBe(workflow);
    });

    it('should return undefined for unregistered workflow', () => {
      expect(service.getWorkflow('non-existent')).toBeUndefined();
    });
  });

  describe('executeStep', () => {
    it('should execute workflow step', async () => {
      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: 1,
        startStep: 'step1',
        steps: new Map([
          [
            'step1',
            {
              name: 'Step 1',
              handler: async (context) => ({
                ...context.data,
                executed: true,
                executionId: context.executionId,
              }),
            },
          ],
        ]),
      };

      service.registerWorkflow(workflow);

      const result = await service.executeStep(
        'test-workflow',
        'step1',
        { initial: true },
        'exec-123',
      );

      expect(result).toEqual({
        initial: true,
        executed: true,
        executionId: 'exec-123',
      });
    });

    it('should throw error for non-existent workflow', async () => {
      await expect(
        service.executeStep('non-existent', 'step1', {}, 'exec-123'),
      ).rejects.toThrow('Workflow not found: non-existent');
    });

    it('should throw error for non-existent step', async () => {
      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: 1,
        startStep: 'step1',
        steps: new Map(),
      };

      service.registerWorkflow(workflow);

      await expect(
        service.executeStep('test-workflow', 'non-existent', {}, 'exec-123'),
      ).rejects.toThrow(
        'Step not found: non-existent in workflow test-workflow',
      );
    });

    it('should handle step timeout', async () => {
      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: 1,
        startStep: 'step1',
        steps: new Map([
          [
            'step1',
            {
              name: 'Step 1',
              timeout: 100,
              handler: async () => {
                await new Promise((resolve) => setTimeout(resolve, 200));
                return {};
              },
            },
          ],
        ]),
      };

      service.registerWorkflow(workflow);

      await expect(
        service.executeStep('test-workflow', 'step1', {}, 'exec-123'),
      ).rejects.toThrow('Execution timeout');
    });
  });

  describe('executeWorkflowSync', () => {
    it('should execute workflow synchronously', async () => {
      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: 1,
        startStep: 'step1',
        steps: new Map([
          [
            'step1',
            {
              name: 'Step 1',
              handler: async (context) => ({ ...context.data, step1: true }),
              nextStep: 'step2',
            },
          ],
          [
            'step2',
            {
              name: 'Step 2',
              handler: async (context) => ({ ...context.data, step2: true }),
              nextStep: 'step3',
            },
          ],
          [
            'step3',
            {
              name: 'Step 3',
              handler: async (context) => ({
                ...context.data,
                step3: true,
                _workflowCompleted: true,
              }),
            },
          ],
        ]),
      };

      service.registerWorkflow(workflow);

      const result = await service.executeWorkflowSync('test-workflow', {
        initial: true,
      });

      expect(result.success).toBe(true);
      expect(result.stepsExecuted).toBe(3);
      expect(result.data).toEqual({
        initial: true,
        step1: true,
        step2: true,
        step3: true,
        _workflowCompleted: true,
      });
    });

    it('should handle workflow with delays', async () => {
      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: 1,
        startStep: 'step1',
        steps: new Map([
          [
            'step1',
            {
              name: 'Step 1',
              delay: 50,
              handler: async (context) => ({
                ...context.data,
                executed: true,
                _workflowCompleted: true,
              }),
            },
          ],
        ]),
      };

      service.registerWorkflow(workflow);

      const startTime = Date.now();
      const result = await service.executeWorkflowSync('test-workflow', {});
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });

    it('should stop at max steps limit', async () => {
      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: 1,
        startStep: 'loop',
        steps: new Map([
          [
            'loop',
            {
              name: 'Loop Step',
              handler: async (context) => ({
                ...context.data,
                count: (context.data.count || 0) + 1,
              }),
              nextStep: 'loop', // Infinite loop
            },
          ],
        ]),
      };

      service.registerWorkflow(workflow);

      const result = await service.executeWorkflowSync('test-workflow', {});

      expect(result.success).toBe(true);
      expect(result.stepsExecuted).toBe(100); // Max steps limit
      expect(result.data.count).toBe(100);
    });
  });

  describe('getAllWorkflows', () => {
    it('should return all registered workflows', () => {
      const workflow1: WorkflowDefinition = {
        id: 'workflow1',
        name: 'Workflow 1',
        version: 1,
        startStep: 'step1',
        steps: new Map(),
      };

      const workflow2: WorkflowDefinition = {
        id: 'workflow2',
        name: 'Workflow 2',
        version: 1,
        startStep: 'step1',
        steps: new Map(),
      };

      service.registerWorkflow(workflow1);
      service.registerWorkflow(workflow2);

      const workflows = service.getAllWorkflows();

      expect(workflows).toHaveLength(2);
      expect(workflows).toContain(workflow1);
      expect(workflows).toContain(workflow2);
    });
  });

  describe('getWorkflowIds', () => {
    it('should return all workflow IDs', () => {
      const workflow1: WorkflowDefinition = {
        id: 'workflow1',
        name: 'Workflow 1',
        version: 1,
        startStep: 'step1',
        steps: new Map(),
      };

      const workflow2: WorkflowDefinition = {
        id: 'workflow2',
        name: 'Workflow 2',
        version: 1,
        startStep: 'step1',
        steps: new Map(),
      };

      service.registerWorkflow(workflow1);
      service.registerWorkflow(workflow2);

      const ids = service.getWorkflowIds();

      expect(ids).toEqual(['workflow1', 'workflow2']);
    });
  });
});
