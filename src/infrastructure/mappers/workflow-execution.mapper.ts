// src/infrastructure/mappers/workflow-execution.mapper.ts
// MAPPER - Convierte entre entidades de dominio y persistencia

import {
  WorkflowExecution,
  WorkflowExecutionStatus,
} from '../../domain/entities/workflow-execution';
import { WorkflowExecutionEntity } from '../entities/workflow-execution.entity';

export class WorkflowExecutionMapper {
  /**
   * Convierte una entidad de dominio a una entidad de persistencia
   */
  static toPersistence(domain: WorkflowExecution): WorkflowExecutionEntity {
    const entity = new WorkflowExecutionEntity();
    const plainObject = domain.toPlainObject();

    entity.id = plainObject.id;
    entity.workflowId = plainObject.workflowId;
    entity.jobId = plainObject.jobId;
    entity.status = plainObject.status;
    entity.inputData = plainObject.inputData;
    entity.outputData = plainObject.outputData;
    entity.error = plainObject.error;
    entity.createdAt = plainObject.createdAt;
    entity.updatedAt = plainObject.updatedAt;
    entity.completedAt = plainObject.completedAt;

    return entity;
  }

  /**
   * Convierte una entidad de persistencia a una entidad de dominio
   */
  static toDomain(entity: WorkflowExecutionEntity): WorkflowExecution {
    return WorkflowExecution.reconstitute({
      id: entity.id,
      workflowId: entity.workflowId,
      jobId: entity.jobId,
      status: entity.status as WorkflowExecutionStatus,
      inputData: entity.inputData,
      outputData: entity.outputData,
      error: entity.error || null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      completedAt: entity.completedAt || null,
    });
  }

  /**
   * Convierte múltiples entidades de persistencia a dominio
   */
  static toDomainMany(
    entities: WorkflowExecutionEntity[],
  ): WorkflowExecution[] {
    return entities.map((entity) => this.toDomain(entity));
  }

  /**
   * Convierte múltiples entidades de dominio a persistencia
   */
  static toPersistenceMany(
    domains: WorkflowExecution[],
  ): WorkflowExecutionEntity[] {
    return domains.map((domain) => this.toPersistence(domain));
  }
}
