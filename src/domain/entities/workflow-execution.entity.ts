import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('workflow_executions')
export class WorkflowExecution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  workflowId!: string;

  @Column()
  jobId!: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  })
  status!: string;

  @Column({ type: 'jsonb', nullable: true })
  inputData?: any;

  @Column({ type: 'jsonb', nullable: true })
  outputData?: any;

  @Column({ nullable: true })
  error?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true })
  completedAt?: Date;
}
