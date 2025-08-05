import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowExecution } from './domain/entities/workflow-execution.entity';
import { WorkflowExecutionRepository } from './infrastructure/repositories/workflow-execution.repository';
import { AccountEntity } from './infrastructure/entities/account.entity';
import { AccountRepository } from './infrastructure/repositories/account.repository';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowExecution, AccountEntity])],
  providers: [WorkflowExecutionRepository, AccountRepository],
  exports: [WorkflowExecutionRepository, AccountRepository, TypeOrmModule],
})
export class DatabaseModule {}
