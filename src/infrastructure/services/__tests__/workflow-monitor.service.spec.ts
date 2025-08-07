// src/infrastructure/services/__tests__/workflow-monitor.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowMonitorService } from '../workflow-monitor.service';

describe('WorkflowMonitorService', () => {
  let service: WorkflowMonitorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkflowMonitorService],
    }).compile();

    service = module.get<WorkflowMonitorService>(WorkflowMonitorService);
  });

  describe('getMetrics', () => {
    it('should return initial metrics', () => {
      const metrics = service.getMetrics();

      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('workflowMetrics');
      expect(metrics).toHaveProperty('performanceMetrics');
      expect(metrics).toHaveProperty('lastUpdated');
      expect(metrics.workflowMetrics.totalJobsProcessed).toBe(0);
      expect(metrics.workflowMetrics.totalJobsFailed).toBe(0);
    });
  });

  describe('recordJobCompleted', () => {
    it('should increment completed jobs counter', () => {
      service.recordJobCompleted('workflow1', 1000);
      service.recordJobCompleted('workflow1', 1500);

      const metrics = service.getMetrics();

      expect(metrics.workflowMetrics.totalJobsProcessed).toBe(2);
    });

    it('should record processing time', () => {
      service.recordJobCompleted('workflow1', 1000);
      service.recordJobCompleted('workflow1', 2000);
      service.recordJobCompleted('workflow1', 1500);

      const metrics = service.getMetrics();

      expect(metrics.performanceMetrics.averageProcessingTime).toBe(1500);
    });
  });

  describe('recordJobFailed', () => {
    it('should increment failed jobs counter', () => {
      service.recordJobFailed('workflow1');
      service.recordJobFailed('workflow2');

      const metrics = service.getMetrics();

      expect(metrics.workflowMetrics.totalJobsFailed).toBe(2);
    });
  });

  describe('setActiveWorkers', () => {
    it('should update active workers count', () => {
      service.setActiveWorkers(5);

      const metrics = service.getMetrics();

      expect(metrics.workflowMetrics.activeWorkers).toBe(5);
    });
  });

  describe('setActiveJobs', () => {
    it('should update active jobs count', () => {
      service.setActiveJobs(10);

      const metrics = service.getMetrics();

      expect(metrics.workflowMetrics.activeJobs).toBe(10);
    });
  });

  describe('isMemoryHealthy', () => {
    it('should return true when memory is below threshold', () => {
      expect(service.isMemoryHealthy()).toBe(true);
    });
  });

  describe('getMemoryInfo', () => {
    it('should return formatted memory information', () => {
      const memoryInfo = service.getMemoryInfo();

      expect(memoryInfo).toHaveProperty('heapUsed');
      expect(memoryInfo).toHaveProperty('heapTotal');
      expect(memoryInfo).toHaveProperty('heapUsagePercent');
      expect(memoryInfo).toHaveProperty('rss');
      expect(memoryInfo).toHaveProperty('external');

      expect(memoryInfo.heapUsed).toMatch(/\d+\.\d+ MB/);
      expect(memoryInfo.heapTotal).toMatch(/\d+\.\d+ MB/);
      expect(memoryInfo.heapUsagePercent).toMatch(/\d+\.\d+%/);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      service.recordJobCompleted('workflow1', 1000);
      service.recordJobFailed('workflow1');
      service.setActiveWorkers(5);
      service.setActiveJobs(10);

      service.reset();

      const metrics = service.getMetrics();

      expect(metrics.workflowMetrics.totalJobsProcessed).toBe(0);
      expect(metrics.workflowMetrics.totalJobsFailed).toBe(0);
      expect(metrics.workflowMetrics.activeWorkers).toBe(0);
      expect(metrics.workflowMetrics.activeJobs).toBe(0);
      expect(metrics.performanceMetrics.averageProcessingTime).toBe(0);
    });
  });

  describe('performance metrics calculation', () => {
    it('should calculate success rate correctly', () => {
      service.recordJobCompleted('workflow1', 1000);
      service.recordJobCompleted('workflow1', 1000);
      service.recordJobCompleted('workflow1', 1000);
      service.recordJobFailed('workflow1');

      const metrics = service.getMetrics();

      expect(metrics.performanceMetrics.successRate).toBe(75);
    });

    it('should calculate throughput correctly', () => {
      service.recordJobCompleted('workflow1', 1000); // 1 second per job
      service.recordJobCompleted('workflow1', 1000);

      const metrics = service.getMetrics();

      // 60000ms / 1000ms = 60 jobs per minute
      expect(metrics.performanceMetrics.throughput).toBe(60);
    });

    it('should limit performance samples', () => {
      // Add more than MAX_SAMPLES (100)
      for (let i = 0; i < 150; i++) {
        service.recordJobCompleted('workflow1', 1000);
      }

      const metrics = service.getMetrics();

      // Should still calculate metrics correctly
      expect(metrics.performanceMetrics.averageProcessingTime).toBe(1000);
    });
  });
});
