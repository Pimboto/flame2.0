// src/infrastructure/repositories/workflow-execution.repository.ts
// REPOSITORIO - Implementación concreta con TypeORM

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowExecution } from '../../domain/entities/workflow-execution';
import { WorkflowExecutionEntity } from '../entities/workflow-execution.entity';
import { WorkflowExecutionMapper } from '../mappers/workflow-execution.mapper';
import { IWorkflowExecutionRepository } from '../../domain/interfaces/workflow-execution.repository.interface';

@Injectable()
export class WorkflowExecutionRepository
  implements IWorkflowExecutionRepository
{
  constructor(
    @InjectRepository(WorkflowExecutionEntity)
    private readonly repository: Repository<WorkflowExecutionEntity>,
  ) {}

  async create(
    workflowExecution: WorkflowExecution,
  ): Promise<WorkflowExecution> {
    const entity = WorkflowExecutionMapper.toPersistence(workflowExecution);
    const saved = await this.repository.save(entity);
    return WorkflowExecutionMapper.toDomain(saved);
  }

  async findById(id: string): Promise<WorkflowExecution | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? WorkflowExecutionMapper.toDomain(entity) : null;
  }

  async findByJobId(jobId: string): Promise<WorkflowExecution | null> {
    const entity = await this.repository.findOne({ where: { jobId } });
    return entity ? WorkflowExecutionMapper.toDomain(entity) : null;
  }

  async update(workflowExecution: WorkflowExecution): Promise<void> {
    const entity = WorkflowExecutionMapper.toPersistence(workflowExecution);
    await this.repository.save(entity);
  }

  async updateById(id: string, data: Partial<any>): Promise<void> {
    await this.repository.update(id, data);
  }

  async findAll(): Promise<WorkflowExecution[]> {
    const entities = await this.repository.find({
      order: { createdAt: 'DESC' },
      take: 100, // Limitar a las últimas 100 ejecuciones
    });
    return WorkflowExecutionMapper.toDomainMany(entities);
  }

  async findByWorkflowId(workflowId: string): Promise<WorkflowExecution[]> {
    const entities = await this.repository.find({
      where: { workflowId },
      order: { createdAt: 'DESC' },
    });
    return WorkflowExecutionMapper.toDomainMany(entities);
  }

  async deleteOldExecutions(cutoffDate: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .andWhere('status IN (:...statuses)', {
        statuses: ['completed', 'failed', 'cancelled'],
      })
      .execute();

    return result.affected || 0;
  }

  async getActiveExecutionsCount(): Promise<number> {
    return await this.repository.count({
      where: [{ status: 'running' }, { status: 'pending' }],
    });
  }
}
