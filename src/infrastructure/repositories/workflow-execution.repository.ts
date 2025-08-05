import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowExecution } from '../../domain/entities/workflow-execution.entity';

@Injectable()
export class WorkflowExecutionRepository {
  constructor(
    @InjectRepository(WorkflowExecution)
    private readonly repository: Repository<WorkflowExecution>,
  ) {}

  async create(data: Partial<WorkflowExecution>): Promise<WorkflowExecution> {
    const execution = this.repository.create(data);
    return await this.repository.save(execution);
  }

  async findById(id: string): Promise<WorkflowExecution | null> {
    return await this.repository.findOne({ where: { id } });
  }

  async findByJobId(jobId: string): Promise<WorkflowExecution | null> {
    return await this.repository.findOne({ where: { jobId } });
  }

  async update(
    id: string,
    data: Partial<WorkflowExecution>,
  ): Promise<WorkflowExecution> {
    await this.repository.update(id, data);
    return (await this.findById(id)) as WorkflowExecution;
  }

  async findAll(): Promise<WorkflowExecution[]> {
    return await this.repository.find({
      order: { createdAt: 'DESC' },
      take: 100, // Limitar a las últimas 100 ejecuciones
    });
  }

  async findByWorkflowId(workflowId: string): Promise<WorkflowExecution[]> {
    return await this.repository.find({
      where: { workflowId },
      order: { createdAt: 'DESC' },
    });
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
      where: [
        { status: 'running' },
        { status: 'pending' },
        { status: 'active' },
      ],
    });
  }
}
