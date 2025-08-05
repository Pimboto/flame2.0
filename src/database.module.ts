import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowExecution } from './domain/entities/workflow-execution.entity';
import { WorkflowExecutionRepository } from './infrastructure/repositories/workflow-execution.repository';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowExecution])],
  providers: [WorkflowExecutionRepository],
  exports: [WorkflowExecutionRepository, TypeOrmModule],
})
export class DatabaseModule {}
