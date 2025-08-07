// src/workflow.module.ts

import { Module } from '@nestjs/common';
import { WorkflowService } from './application/services/workflow.service';
import { WorkflowController } from './presentation/controllers/workflow.controller';
import { WorkflowEngineService } from './infrastructure/workflow-engine.service';
import { DatabaseModule } from './database.module';
import { RedisConnectionService } from './infrastructure/services/redis-connection.service';
import { MetricsService } from './infrastructure/services/metrics.service';
import { HttpClientService } from './infrastructure/services/http-client.service';
import { TinderApiService } from './infrastructure/services/tinder-api.service';
import { QueueManagerService } from './infrastructure/services/queue-manager.service';
import { WorkflowExecutorService } from './infrastructure/services/workflow-executor.service';
import { WorkflowWorkerService } from './infrastructure/services/workflow-worker.service';
import { WorkflowMonitorService } from './infrastructure/services/workflow-monitor.service';
import { WorkflowCleanupService } from './infrastructure/services/workflow-cleanup.service';
import { ExecuteWorkflowUseCase } from './application/use-cases/execute-workflow/execute-workflow.use-case';
import { ImportAccountsUseCase } from './application/use-cases/import-accounts/import-accounts.use-case';
import { ProcessImportTaskUseCase } from './application/use-cases/import-accounts/process-import-task.use-case';
import { CheckWorkflowConditionUseCase } from './application/use-cases/workflow-control/check-workflow-condition.use-case';
import { GetWorkflowStatusUseCase } from './application/use-cases/get-workflow-status/get-workflow-status.use-case';
import { TerminateWorkflowUseCase } from './application/use-cases/terminate-workflow/terminate-workflow.use-case';
import { SuspendWorkflowUseCase } from './application/use-cases/suspend-workflow/suspend-workflow.use-case';
import { ResumeWorkflowUseCase } from './application/use-cases/resume-workflow/resume-workflow.use-case';
import { GetWorkflowListUseCase } from './application/use-cases/get-workflow-list/get-workflow-list.use-case';
import { GetExecutionHistoryUseCase } from './application/use-cases/get-execution-history/get-execution-history.use-case';

@Module({
  imports: [DatabaseModule],
  controllers: [WorkflowController],
  providers: [
    // Application Services
    WorkflowService,

    // Use Cases
    ExecuteWorkflowUseCase,
    ImportAccountsUseCase,
    ProcessImportTaskUseCase,
    CheckWorkflowConditionUseCase,
    GetWorkflowStatusUseCase,
    TerminateWorkflowUseCase,
    SuspendWorkflowUseCase,
    ResumeWorkflowUseCase,
    GetWorkflowListUseCase,
    GetExecutionHistoryUseCase,

    // Infrastructure Services
    WorkflowEngineService,
    WorkflowExecutorService,
    WorkflowWorkerService,
    WorkflowMonitorService,
    WorkflowCleanupService,
    RedisConnectionService,
    MetricsService,
    HttpClientService,
    TinderApiService,
    QueueManagerService,

    // Interface Bindings - Domain Interfaces
    {
      provide: 'IWorkflowExecutor',
      useClass: WorkflowExecutorService,
    },
    {
      provide: 'IWorkflowWorker',
      useClass: WorkflowWorkerService,
    },
    {
      provide: 'IWorkflowMonitor',
      useClass: WorkflowMonitorService,
    },
    {
      provide: 'IWorkflowCleanup',
      useClass: WorkflowCleanupService,
    },
    {
      provide: 'IQueueManager',
      useClass: QueueManagerService,
    },
    {
      provide: 'IRedisConnection',
      useClass: RedisConnectionService,
    },
    {
      provide: 'IHttpClient',
      useClass: HttpClientService,
    },
    {
      provide: 'ITinderApiService',
      useClass: TinderApiService,
    },
    {
      provide: 'IMetricsService',
      useClass: MetricsService,
    },
  ],
  exports: [
    WorkflowService,
    WorkflowEngineService,
    MetricsService,
    ExecuteWorkflowUseCase,
    ImportAccountsUseCase,
    ProcessImportTaskUseCase,
    CheckWorkflowConditionUseCase,
  ],
})
export class WorkflowModule {}
