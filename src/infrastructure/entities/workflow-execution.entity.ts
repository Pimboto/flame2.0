// src/infrastructure/entities/workflow-execution.entity.ts
// ENTIDAD DE PERSISTENCIA - Puede usar TypeORM

import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('workflow_executions')
export class WorkflowExecutionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'workflow_id' })
  workflowId!: string;

  @Column({ name: 'job_id' })
  jobId!: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled', 'stopped'],
    default: 'pending',
  })
  status!: string;

  @Column({ type: 'jsonb', nullable: true, name: 'input_data' })
  inputData?: any;

  @Column({ type: 'jsonb', nullable: true, name: 'output_data' })
  outputData?: any;

  @Column({ nullable: true })
  error?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ nullable: true, name: 'completed_at' })
  completedAt?: Date;
}
