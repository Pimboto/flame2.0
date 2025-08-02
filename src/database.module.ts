import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowExecution } from './domain/entities/workflow-execution.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowExecution])],
  providers: [],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
