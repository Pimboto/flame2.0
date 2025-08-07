// src/domain/entities/__tests__/workflow-execution.spec.ts

import {
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowExecutionId,
} from '../workflow-execution';

describe('WorkflowExecution Entity', () => {
  describe('create', () => {
    it('should create a new workflow execution with pending status', () => {
      const workflowId = 'test-workflow';
      const jobId = 'job-123';
      const inputData = { test: true };

      const execution = WorkflowExecution.create(workflowId, jobId, inputData);

      expect(execution.workflowId).toBe(workflowId);
      expect(execution.jobId).toBe(jobId);
      expect(execution.status).toBe(WorkflowExecutionStatus.PENDING);
      expect(execution.inputData).toEqual(inputData);
      expect(execution.outputData).toBeNull();
      expect(execution.error).toBeNull();
      expect(execution.completedAt).toBeNull();
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute workflow execution from data', () => {
      const data = {
        id: 'exec-123',
        workflowId: 'test-workflow',
        jobId: 'job-123',
        status: WorkflowExecutionStatus.RUNNING,
        inputData: { test: true },
        outputData: { result: 'success' },
        error: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        completedAt: null,
      };

      const execution = WorkflowExecution.reconstitute(data);

      expect(execution.id.toString()).toBe(data.id);
      expect(execution.workflowId).toBe(data.workflowId);
      expect(execution.status).toBe(data.status);
      expect(execution.inputData).toEqual(data.inputData);
      expect(execution.outputData).toEqual(data.outputData);
    });
  });

  describe('start', () => {
    it('should start a pending execution', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});

      execution.start();

      expect(execution.status).toBe(WorkflowExecutionStatus.RUNNING);
    });

    it('should throw error if execution is not pending', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});
      execution.start();

      expect(() => execution.start()).toThrow(
        'Cannot start execution in status running',
      );
    });
  });

  describe('complete', () => {
    it('should complete a running execution', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});
      execution.start();
      const finalOutput = { result: 'success' };

      execution.complete(finalOutput);

      expect(execution.status).toBe(WorkflowExecutionStatus.COMPLETED);
      expect(execution.outputData).toEqual(finalOutput);
      expect(execution.completedAt).not.toBeNull();
    });

    it('should throw error if execution is not running', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});

      expect(() => execution.complete({})).toThrow(
        'Cannot complete execution in status pending',
      );
    });
  });

  describe('fail', () => {
    it('should fail an execution with error', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});
      execution.start();
      const errorMessage = 'Test error';

      execution.fail(errorMessage);

      expect(execution.status).toBe(WorkflowExecutionStatus.FAILED);
      expect(execution.error).toBe(errorMessage);
      expect(execution.completedAt).not.toBeNull();
    });

    it('should not fail a completed execution', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});
      execution.start();
      execution.complete({});

      expect(() => execution.fail('error')).toThrow(
        'Cannot fail a completed execution',
      );
    });
  });

  describe('cancel', () => {
    it('should cancel a running execution', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});
      execution.start();

      execution.cancel();

      expect(execution.status).toBe(WorkflowExecutionStatus.CANCELLED);
      expect(execution.completedAt).not.toBeNull();
    });

    it('should not cancel a completed execution', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});
      execution.start();
      execution.complete({});

      expect(() => execution.cancel()).toThrow(
        'Cannot cancel execution in status completed',
      );
    });
  });

  describe('updateProgress', () => {
    it('should update progress of running execution', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});
      execution.start();
      const progressData = { step: 1, total: 10 };

      execution.updateProgress(progressData);

      expect(execution.outputData).toEqual(progressData);
    });

    it('should merge progress data', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});
      execution.start();

      execution.updateProgress({ step: 1 });
      execution.updateProgress({ total: 10 });

      expect(execution.outputData).toEqual({ step: 1, total: 10 });
    });
  });

  describe('isActive', () => {
    it('should return true for pending execution', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});
      expect(execution.isActive()).toBe(true);
    });

    it('should return true for running execution', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});
      execution.start();
      expect(execution.isActive()).toBe(true);
    });

    it('should return false for completed execution', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});
      execution.start();
      execution.complete({});
      expect(execution.isActive()).toBe(false);
    });
  });

  describe('isCompleted', () => {
    it('should return false for pending execution', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});
      expect(execution.isCompleted()).toBe(false);
    });

    it('should return true for completed execution', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});
      execution.start();
      execution.complete({});
      expect(execution.isCompleted()).toBe(true);
    });

    it('should return true for failed execution', () => {
      const execution = WorkflowExecution.create('test', 'job-123', {});
      execution.start();
      execution.fail('error');
      expect(execution.isCompleted()).toBe(true);
    });
  });

  describe('WorkflowExecutionId', () => {
    it('should create valid id', () => {
      const id = new WorkflowExecutionId('test-123');
      expect(id.toString()).toBe('test-123');
    });

    it('should throw error for empty id', () => {
      expect(() => new WorkflowExecutionId('')).toThrow(
        'WorkflowExecutionId cannot be empty',
      );
    });

    it('should generate unique ids', () => {
      const id1 = WorkflowExecutionId.generate();
      const id2 = WorkflowExecutionId.generate();
      expect(id1.toString()).not.toBe(id2.toString());
    });

    it('should compare ids correctly', () => {
      const id1 = new WorkflowExecutionId('test-123');
      const id2 = new WorkflowExecutionId('test-123');
      const id3 = new WorkflowExecutionId('test-456');

      expect(id1.equals(id2)).toBe(true);
      expect(id1.equals(id3)).toBe(false);
    });
  });
});
