import { Module } from '@nestjs/common';
import { WorkflowService } from './application/services/workflow.service';
import { WorkflowController } from './presentation/controllers/workflow.controller';
import { WorkflowEngineService } from './infrastructure/workflow-engine.service';
import { DatabaseModule } from './database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowEngineService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
