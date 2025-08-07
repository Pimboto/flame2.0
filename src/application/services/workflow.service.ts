// src/application/services/workflow.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ExecuteWorkflowDto } from '../../presentation/dto/execute-workflow.dto';
import { ExecuteWorkflowCommand } from '../commands/execute-workflow.command';
import { TerminateWorkflowCommand } from '../commands/terminate-workflow.command';
import { GetWorkflowStatusQuery } from '../queries/get-workflow-status.query';
import { GetWorkflowListQuery } from '../queries/get-workflow-list.query';
import { ExecuteWorkflowUseCase } from '../use-cases/execute-workflow/execute-workflow.use-case';
import { GetWorkflowStatusUseCase } from '../use-cases/get-workflow-status/get-workflow-status.use-case';
import { TerminateWorkflowUseCase } from '../use-cases/terminate-workflow/terminate-workflow.use-case';
import { SuspendWorkflowUseCase } from '../use-cases/suspend-workflow/suspend-workflow.use-case';
import { ResumeWorkflowUseCase } from '../use-cases/resume-workflow/resume-workflow.use-case';
import { GetWorkflowListUseCase } from '../use-cases/get-workflow-list/get-workflow-list.use-case';
import { GetExecutionHistoryUseCase } from '../use-cases/get-execution-history/get-execution-history.use-case';
import { WorkflowEngineService } from '../../infrastructure/workflow-engine.service';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly executeWorkflowUseCase: ExecuteWorkflowUseCase,
    private readonly getWorkflowStatusUseCase: GetWorkflowStatusUseCase,
    private readonly terminateWorkflowUseCase: TerminateWorkflowUseCase,
    private readonly suspendWorkflowUseCase: SuspendWorkflowUseCase,
    private readonly resumeWorkflowUseCase: ResumeWorkflowUseCase,
    private readonly getWorkflowListUseCase: GetWorkflowListUseCase,
    private readonly getExecutionHistoryUseCase: GetExecutionHistoryUseCase,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  async executeWorkflow(dto: ExecuteWorkflowDto): Promise<any> {
    const command = new ExecuteWorkflowCommand(dto.workflowId, dto.data);

    const result = await this.executeWorkflowUseCase.execute(command);

    return {
      success: true,
      instanceId: result.executionId,
      message: result.message,
    };
  }

  async getWorkflowStatus(instanceId: string): Promise<any> {
    const query = new GetWorkflowStatusQuery(instanceId, true);
    return await this.getWorkflowStatusUseCase.execute(query);
  }

  async suspendWorkflow(instanceId: string): Promise<any> {
    await this.suspendWorkflowUseCase.execute(instanceId);

    return {
      success: true,
      message: 'Workflow suspended successfully',
    };
  }

  async resumeWorkflow(instanceId: string): Promise<any> {
    await this.resumeWorkflowUseCase.execute(instanceId);

    return {
      success: true,
      message: 'Workflow resumed successfully',
    };
  }

  async terminateWorkflow(instanceId: string): Promise<any> {
    const command = new TerminateWorkflowCommand(instanceId);
    await this.terminateWorkflowUseCase.execute(command);

    return {
      success: true,
      message: 'Workflow terminated successfully',
    };
  }

  async testWorkflow(workflowId: string, testData: any): Promise<any> {
    this.logger.log(`Testing workflow: ${workflowId}`);
    const result = await this.workflowEngine.testWorkflow(workflowId, testData);

    return {
      success: true,
      ...result,
      message: 'Workflow test completed successfully',
    };
  }

  async listAvailableWorkflows(): Promise<any> {
    const query = new GetWorkflowListQuery(true);
    return await this.getWorkflowListUseCase.execute(query);
  }

  async getExecutionHistory(): Promise<any> {
    return await this.getExecutionHistoryUseCase.execute();
  }

  async getQueueStats(): Promise<any> {
    return await this.workflowEngine.getQueueStats();
  }

  async getCapacityInfo(): Promise<any> {
    return this.workflowEngine.getCapacityInfo();
  }

  async forceCleanup(): Promise<any> {
    await this.workflowEngine.forceCleanup();
    return {
      success: true,
      message: 'Cleanup executed successfully',
      timestamp: new Date(),
    };
  }
}
