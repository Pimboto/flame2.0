// src/database.module.ts
// MÓDULO DE BASE DE DATOS - Solo usa entidades de infrastructure

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowExecutionEntity } from './infrastructure/entities/workflow-execution.entity';
import { WorkflowExecutionRepository } from './infrastructure/repositories/workflow-execution.repository';
import { AccountEntity } from './infrastructure/entities/account.entity';
import { AccountRepository } from './infrastructure/repositories/account.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowExecutionEntity, // Entidad de persistencia desde infrastructure
      AccountEntity,
    ]),
  ],
  providers: [
    WorkflowExecutionRepository,
    AccountRepository,
    // Registrar las interfaces con sus implementaciones
    {
      provide: 'IWorkflowExecutionRepository',
      useClass: WorkflowExecutionRepository,
    },
    {
      provide: 'IAccountRepository',
      useClass: AccountRepository,
    },
  ],
  exports: [
    WorkflowExecutionRepository,
    AccountRepository,
    'IWorkflowExecutionRepository',
    'IAccountRepository',
    TypeOrmModule,
  ],
})
export class DatabaseModule {}
