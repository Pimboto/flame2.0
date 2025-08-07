// src/application/use-cases/get-execution-history/get-execution-history.use-case.ts

import { Injectable, Logger } from '@nestjs/common';
import { WorkflowEngineService } from '../../../infrastructure/workflow-engine.service';
import { ExecutionHistoryDto } from '../../dto/execution-history.dto';

@Injectable()
export class GetExecutionHistoryUseCase {
  private readonly logger = new Logger(GetExecutionHistoryUseCase.name);

  constructor(private readonly workflowEngine: WorkflowEngineService) {}

  async execute(): Promise<ExecutionHistoryDto> {
    this.logger.log('Getting execution history');

    const executions = await this.workflowEngine.getExecutionHistory();

    return {
      executions: executions.map((e) => ({
        id: e.id,
        workflowId: e.workflowId,
        status: e.status,
        createTime: e.createTime,
        finishedOn: e.finishedOn,
        error: e.error,
      })),
      total: executions.length,
    };
  }
}
