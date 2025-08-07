// src/application/mappers/workflow-execution.mapper.ts

import { WorkflowExecution } from '../../domain/entities/workflow-execution';
import { WorkflowExecutionDto } from '../dto/workflow-execution.dto';

export class WorkflowExecutionMapper {
  static toDto(execution: WorkflowExecution): WorkflowExecutionDto {
    return {
      executionId: execution.id.toString(),
      workflowId: execution.workflowId,
      status: execution.status,
      message: `Workflow ${execution.status}`,
      createdAt: execution.createdAt,
    };
  }

  static toDtoArray(executions: WorkflowExecution[]): WorkflowExecutionDto[] {
    return executions.map((e) => this.toDto(e));
  }
}
