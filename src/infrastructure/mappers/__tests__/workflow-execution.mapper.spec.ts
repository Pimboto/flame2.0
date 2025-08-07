// src/infrastructure/mappers/__tests__/workflow-execution.mapper.spec.ts

import {
  WorkflowExecution,
  WorkflowExecutionStatus,
} from '../../../domain/entities/workflow-execution';
import { WorkflowExecutionEntity } from '../../entities/workflow-execution.entity';
import { WorkflowExecutionMapper } from '../workflow-execution.mapper';

describe('WorkflowExecutionMapper', () => {
  const mockDate = new Date('2024-01-01');

  describe('toPersistence', () => {
    it('should map domain entity to persistence entity', () => {
      const domain = WorkflowExecution.reconstitute({
        id: 'exec-123',
        workflowId: 'workflow-1',
        jobId: 'job-456',
        status: WorkflowExecutionStatus.RUNNING,
        inputData: { test: true },
        outputData: { result: 'success' },
        error: null,
        createdAt: mockDate,
        updatedAt: mockDate,
        completedAt: null,
      });

      const entity = WorkflowExecutionMapper.toPersistence(domain);

      expect(entity).toBeInstanceOf(WorkflowExecutionEntity);
      expect(entity.id).toBe('exec-123');
      expect(entity.workflowId).toBe('workflow-1');
      expect(entity.jobId).toBe('job-456');
      expect(entity.status).toBe('running');
      expect(entity.inputData).toEqual({ test: true });
      expect(entity.outputData).toEqual({ result: 'success' });
      expect(entity.error).toBeNull();
      expect(entity.createdAt).toEqual(mockDate);
      expect(entity.updatedAt).toEqual(mockDate);
      expect(entity.completedAt).toBeNull();
    });

    it('should handle completed execution', () => {
      const completedDate = new Date('2024-01-02');
      const domain = WorkflowExecution.reconstitute({
        id: 'exec-123',
        workflowId: 'workflow-1',
        jobId: 'job-456',
        status: WorkflowExecutionStatus.COMPLETED,
        inputData: { test: true },
        outputData: { result: 'success' },
        error: null,
        createdAt: mockDate,
        updatedAt: completedDate,
        completedAt: completedDate,
      });

      const entity = WorkflowExecutionMapper.toPersistence(domain);

      expect(entity.status).toBe('completed');
      expect(entity.completedAt).toEqual(completedDate);
    });

    it('should handle failed execution', () => {
      const domain = WorkflowExecution.reconstitute({
        id: 'exec-123',
        workflowId: 'workflow-1',
        jobId: 'job-456',
        status: WorkflowExecutionStatus.FAILED,
        inputData: { test: true },
        outputData: null,
        error: 'Test error',
        createdAt: mockDate,
        updatedAt: mockDate,
        completedAt: mockDate,
      });

      const entity = WorkflowExecutionMapper.toPersistence(domain);

      expect(entity.status).toBe('failed');
      expect(entity.error).toBe('Test error');
    });
  });

  describe('toDomain', () => {
    it('should map persistence entity to domain entity', () => {
      const entity = new WorkflowExecutionEntity();
      entity.id = 'exec-123';
      entity.workflowId = 'workflow-1';
      entity.jobId = 'job-456';
      entity.status = 'running';
      entity.inputData = { test: true };
      entity.outputData = { result: 'success' };
      entity.error = undefined;
      entity.createdAt = mockDate;
      entity.updatedAt = mockDate;
      entity.completedAt = undefined;

      const domain = WorkflowExecutionMapper.toDomain(entity);

      expect(domain).toBeInstanceOf(WorkflowExecution);
      expect(domain.id.toString()).toBe('exec-123');
      expect(domain.workflowId).toBe('workflow-1');
      expect(domain.jobId).toBe('job-456');
      expect(domain.status).toBe(WorkflowExecutionStatus.RUNNING);
      expect(domain.inputData).toEqual({ test: true });
      expect(domain.outputData).toEqual({ result: 'success' });
      expect(domain.error).toBeNull();
      expect(domain.createdAt).toEqual(mockDate);
      expect(domain.updatedAt).toEqual(mockDate);
      expect(domain.completedAt).toBeNull();
    });

    it('should handle null error correctly', () => {
      const entity = new WorkflowExecutionEntity();
      entity.id = 'exec-123';
      entity.workflowId = 'workflow-1';
      entity.jobId = 'job-456';
      entity.status = 'completed';
      entity.inputData = {};
      entity.outputData = {};
      entity.error = undefined;
      entity.createdAt = mockDate;
      entity.updatedAt = mockDate;
      entity.completedAt = mockDate;

      const domain = WorkflowExecutionMapper.toDomain(entity);

      expect(domain.error).toBeNull();
    });
  });

  describe('toDomainMany', () => {
    it('should map multiple persistence entities to domain entities', () => {
      const entities = [
        createMockEntity('exec-1', 'running'),
        createMockEntity('exec-2', 'completed'),
        createMockEntity('exec-3', 'failed'),
      ];

      const domains = WorkflowExecutionMapper.toDomainMany(entities);

      expect(domains).toHaveLength(3);
      expect(domains[0].id.toString()).toBe('exec-1');
      expect(domains[1].id.toString()).toBe('exec-2');
      expect(domains[2].id.toString()).toBe('exec-3');
    });

    it('should handle empty array', () => {
      const domains = WorkflowExecutionMapper.toDomainMany([]);

      expect(domains).toEqual([]);
    });
  });

  describe('toPersistenceMany', () => {
    it('should map multiple domain entities to persistence entities', () => {
      const domains = [
        createMockDomain('exec-1', WorkflowExecutionStatus.RUNNING),
        createMockDomain('exec-2', WorkflowExecutionStatus.COMPLETED),
        createMockDomain('exec-3', WorkflowExecutionStatus.FAILED),
      ];

      const entities = WorkflowExecutionMapper.toPersistenceMany(domains);

      expect(entities).toHaveLength(3);
      expect(entities[0].id).toBe('exec-1');
      expect(entities[1].id).toBe('exec-2');
      expect(entities[2].id).toBe('exec-3');
    });

    it('should handle empty array', () => {
      const entities = WorkflowExecutionMapper.toPersistenceMany([]);

      expect(entities).toEqual([]);
    });
  });

  // Helper functions
  function createMockEntity(
    id: string,
    status: string,
  ): WorkflowExecutionEntity {
    const entity = new WorkflowExecutionEntity();
    entity.id = id;
    entity.workflowId = 'workflow-1';
    entity.jobId = 'job-1';
    entity.status = status;
    entity.inputData = {};
    entity.outputData = {};
    entity.createdAt = mockDate;
    entity.updatedAt = mockDate;
    return entity;
  }

  function createMockDomain(
    id: string,
    status: WorkflowExecutionStatus,
  ): WorkflowExecution {
    return WorkflowExecution.reconstitute({
      id,
      workflowId: 'workflow-1',
      jobId: 'job-1',
      status,
      inputData: {},
      outputData: {},
      error: null,
      createdAt: mockDate,
      updatedAt: mockDate,
      completedAt: null,
    });
  }
});
