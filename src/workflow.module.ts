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

@Module({
  imports: [DatabaseModule],
  controllers: [WorkflowController],
  providers: [
    // Application Services
    WorkflowService,

    // Infrastructure Services
    WorkflowEngineService,
    RedisConnectionService,
    MetricsService,
    HttpClientService,
    TinderApiService,
    QueueManagerService,

    // Bindings for interfaces to implementations
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
  exports: [WorkflowService, WorkflowEngineService, MetricsService],
})
export class WorkflowModule {}
