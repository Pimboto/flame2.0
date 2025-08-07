// src/infrastructure/services/workflow-monitor.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  IWorkflowMonitor,
  WorkflowMetrics,
} from '../../domain/interfaces/workflow-monitor.interface';

@Injectable()
export class WorkflowMonitorService implements IWorkflowMonitor {
  private readonly logger = new Logger(WorkflowMonitorService.name);

  private metrics: WorkflowMetrics = {
    memoryUsage: {
      heapUsed: 0,
      heapTotal: 0,
      heapUsedPercent: 0,
      rss: 0,
      external: 0,
    },
    workflowMetrics: {
      totalJobsProcessed: 0,
      totalJobsFailed: 0,
      activeWorkers: 0,
      activeJobs: 0,
    },
    performanceMetrics: {
      averageProcessingTime: 0,
      successRate: 0,
      throughput: 0,
    },
    lastUpdated: new Date(),
  };

  private performanceSamples: Map<string, number[]> = new Map();
  private readonly MAX_SAMPLES = 100;
  private readonly MEMORY_WARNING_THRESHOLD = 80;
  private readonly MEMORY_CRITICAL_THRESHOLD = 95;

  @Cron(CronExpression.EVERY_MINUTE)
  async monitorSystem() {
    this.updateMemoryMetrics();
    this.checkMemoryThresholds();
  }

  updateMemoryMetrics(): void {
    const memUsage = process.memoryUsage();

    this.metrics.memoryUsage = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapUsedPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      rss: memUsage.rss,
      external: memUsage.external,
    };

    this.metrics.lastUpdated = new Date();
  }

  private checkMemoryThresholds(): void {
    const heapPercent = this.metrics.memoryUsage.heapUsedPercent;

    if (heapPercent > this.MEMORY_CRITICAL_THRESHOLD) {
      this.logger.error(`CRITICAL: Memory usage at ${heapPercent.toFixed(2)}%`);
      this.triggerEmergencyGC();
    } else if (heapPercent > this.MEMORY_WARNING_THRESHOLD) {
      this.logger.warn(`WARNING: Memory usage at ${heapPercent.toFixed(2)}%`);
    }
  }

  private triggerEmergencyGC(): void {
    if (global.gc) {
      global.gc();
      this.logger.log('Emergency garbage collection triggered');
    }
  }

  recordJobCompleted(workflowId: string, processingTime: number): void {
    this.metrics.workflowMetrics.totalJobsProcessed++;
    this.recordProcessingTime(workflowId, processingTime);
    this.updatePerformanceMetrics();
  }

  recordJobFailed(_workflowId: string): void {
    this.metrics.workflowMetrics.totalJobsFailed++;
    this.updatePerformanceMetrics();
  }

  private recordProcessingTime(workflowId: string, timeMs: number): void {
    if (!this.performanceSamples.has(workflowId)) {
      this.performanceSamples.set(workflowId, []);
    }

    const samples = this.performanceSamples.get(workflowId)!;
    samples.push(timeMs);

    if (samples.length > this.MAX_SAMPLES) {
      samples.shift();
    }
  }

  private updatePerformanceMetrics(): void {
    const allSamples: number[] = [];
    for (const samples of this.performanceSamples.values()) {
      allSamples.push(...samples);
    }

    if (allSamples.length > 0) {
      this.metrics.performanceMetrics.averageProcessingTime =
        allSamples.reduce((a, b) => a + b, 0) / allSamples.length;

      this.metrics.performanceMetrics.throughput =
        60000 / this.metrics.performanceMetrics.averageProcessingTime;
    }

    const total =
      this.metrics.workflowMetrics.totalJobsProcessed +
      this.metrics.workflowMetrics.totalJobsFailed;
    if (total > 0) {
      this.metrics.performanceMetrics.successRate =
        (this.metrics.workflowMetrics.totalJobsProcessed / total) * 100;
    }
  }

  setActiveWorkers(count: number): void {
    this.metrics.workflowMetrics.activeWorkers = count;
  }

  setActiveJobs(count: number): void {
    this.metrics.workflowMetrics.activeJobs = count;
  }

  getMetrics(): WorkflowMetrics {
    this.updateMemoryMetrics();
    return { ...this.metrics };
  }

  getMemoryInfo(): any {
    const mem = this.metrics.memoryUsage;
    return {
      heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsagePercent: `${mem.heapUsedPercent.toFixed(2)}%`,
      rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
      external: `${(mem.external / 1024 / 1024).toFixed(2)} MB`,
    };
  }

  reset(): void {
    this.metrics = {
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        heapUsedPercent: 0,
        rss: 0,
        external: 0,
      },
      workflowMetrics: {
        totalJobsProcessed: 0,
        totalJobsFailed: 0,
        activeWorkers: 0,
        activeJobs: 0,
      },
      performanceMetrics: {
        averageProcessingTime: 0,
        successRate: 0,
        throughput: 0,
      },
      lastUpdated: new Date(),
    };
    this.performanceSamples.clear();
    this.logger.log('Monitor metrics reset');
  }

  isMemoryHealthy(): boolean {
    return (
      this.metrics.memoryUsage.heapUsedPercent < this.MEMORY_WARNING_THRESHOLD
    );
  }
}
