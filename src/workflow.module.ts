import { Module } from '@nestjs/common';
import { WorkflowService } from './application/services/workflow.service';
import { WorkflowController } from './presentation/controllers/workflow.controller';
import { WorkflowEngineService } from './infrastructure/workflow-engine.service';

@Module({
  imports: [],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowEngineService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
