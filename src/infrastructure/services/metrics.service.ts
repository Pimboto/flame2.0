// src/infrastructure/services/metrics.service.ts
// SERVICIO DE MÉTRICAS - Maneja el monitoreo y métricas del sistema

import { Injectable, Logger } from '@nestjs/common';

export interface SystemMetrics {
  totalJobsProcessed: number;
  totalJobsFailed: number;
  activeWorkers: number;
  activeJobs: number;
  memoryUsage: number;
  redisMemoryUsage: number;
  lastUpdated: Date;
}

export interface PerformanceMetrics {
  averageProcessingTime: number;
  successRate: number;
  throughput: number;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  private metrics: SystemMetrics = {
    totalJobsProcessed: 0,
    totalJobsFailed: 0,
    activeWorkers: 0,
    activeJobs: 0,
    memoryUsage: 0,
    redisMemoryUsage: 0,
    lastUpdated: new Date(),
  };

  private performanceMetrics: Map<string, number[]> = new Map();
  private readonly MAX_PERFORMANCE_SAMPLES = 100;

  incrementJobsProcessed(): void {
    this.metrics.totalJobsProcessed++;
    this.metrics.lastUpdated = new Date();
  }

  incrementJobsFailed(): void {
    this.metrics.totalJobsFailed++;
    this.metrics.lastUpdated = new Date();
  }

  setActiveWorkers(count: number): void {
    this.metrics.activeWorkers = count;
    this.metrics.lastUpdated = new Date();
  }

  setActiveJobs(count: number): void {
    this.metrics.activeJobs = count;
    this.metrics.lastUpdated = new Date();
  }

  updateMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    this.metrics.lastUpdated = new Date();
  }

  setRedisMemoryUsage(percentage: number): void {
    this.metrics.redisMemoryUsage = percentage;
    this.metrics.lastUpdated = new Date();
  }

  recordProcessingTime(workflowId: string, timeMs: number): void {
    if (!this.performanceMetrics.has(workflowId)) {
      this.performanceMetrics.set(workflowId, []);
    }

    const samples = this.performanceMetrics.get(workflowId)!;
    samples.push(timeMs);

    // Keep only the last N samples
    if (samples.length > this.MAX_PERFORMANCE_SAMPLES) {
      samples.shift();
    }
  }

  getMetrics(): SystemMetrics {
    this.updateMemoryUsage();
    return { ...this.metrics };
  }

  getPerformanceMetrics(workflowId?: string): PerformanceMetrics {
    if (workflowId && this.performanceMetrics.has(workflowId)) {
      const samples = this.performanceMetrics.get(workflowId)!;
      return this.calculatePerformanceMetrics(samples);
    }

    // Calculate overall performance
    const allSamples: number[] = [];
    for (const samples of this.performanceMetrics.values()) {
      allSamples.push(...samples);
    }

    return this.calculatePerformanceMetrics(allSamples);
  }

  private calculatePerformanceMetrics(samples: number[]): PerformanceMetrics {
    if (samples.length === 0) {
      return {
        averageProcessingTime: 0,
        successRate: 0,
        throughput: 0,
      };
    }

    const average = samples.reduce((a, b) => a + b, 0) / samples.length;
    const successRate =
      this.metrics.totalJobsProcessed > 0
        ? (this.metrics.totalJobsProcessed /
            (this.metrics.totalJobsProcessed + this.metrics.totalJobsFailed)) *
          100
        : 0;

    // Calculate throughput (jobs per minute)
    const throughput = samples.length > 0 ? 60000 / average : 0;

    return {
      averageProcessingTime: Math.round(average),
      successRate: Math.round(successRate * 100) / 100,
      throughput: Math.round(throughput * 100) / 100,
    };
  }

  getMemoryInfo(): any {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsagePercent: `${this.metrics.memoryUsage.toFixed(2)}%`,
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memUsage.external / 1024 / 1024).toFixed(2)} MB`,
    };
  }

  reset(): void {
    this.metrics = {
      totalJobsProcessed: 0,
      totalJobsFailed: 0,
      activeWorkers: 0,
      activeJobs: 0,
      memoryUsage: 0,
      redisMemoryUsage: 0,
      lastUpdated: new Date(),
    };
    this.performanceMetrics.clear();
    this.logger.log('Metrics reset');
  }
}
