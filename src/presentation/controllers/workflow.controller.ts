import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { WorkflowService } from '../../application/services/workflow.service';
import { ExecuteWorkflowDto } from '../dto/execute-workflow.dto';

@Controller('workflows')
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name);

  constructor(private readonly workflowService: WorkflowService) {}

  @Get()
  async listWorkflows() {
    this.logger.log('Listando workflows disponibles');
    return await this.workflowService.listAvailableWorkflows();
  }

  @Post('execute')
  @HttpCode(HttpStatus.ACCEPTED)
  async executeWorkflow(@Body() dto: ExecuteWorkflowDto) {
    this.logger.log(`Ejecutando workflow: ${dto.workflowId}`);
    return await this.workflowService.executeWorkflow(dto);
  }

  @Get('instances/:instanceId')
  async getWorkflowStatus(@Param('instanceId') instanceId: string) {
    this.logger.log(`Obteniendo estado del workflow: ${instanceId}`);
    return await this.workflowService.getWorkflowStatus(instanceId);
  }

  @Put('instances/:instanceId/suspend')
  async suspendWorkflow(@Param('instanceId') instanceId: string) {
    this.logger.log(`Suspendiendo workflow: ${instanceId}`);
    return await this.workflowService.suspendWorkflow(instanceId);
  }

  @Put('instances/:instanceId/resume')
  async resumeWorkflow(@Param('instanceId') instanceId: string) {
    this.logger.log(`Reanudando workflow: ${instanceId}`);
    return await this.workflowService.resumeWorkflow(instanceId);
  }

  @Delete('instances/:instanceId')
  async terminateWorkflow(@Param('instanceId') instanceId: string) {
    this.logger.log(`Terminando workflow: ${instanceId}`);
    return await this.workflowService.terminateWorkflow(instanceId);
  }

  @Get('executions')
  async getExecutionHistory() {
    this.logger.log('Obteniendo historial de ejecuciones');
    return await this.workflowService.getExecutionHistory();
  }

  @Post(':workflowId/test')
  async testWorkflow(
    @Param('workflowId') workflowId: string,
    @Body() testData: any,
  ) {
    this.logger.log(`Testeando workflow: ${workflowId}`);
    return await this.workflowService.testWorkflow(workflowId, testData);
  }

  @Get('queues/stats')
  async getQueueStats() {
    this.logger.log('Obteniendo estadísticas de las colas');
    return await this.workflowService.getQueueStats();
  }

  @Get('capacity')
  async getCapacityInfo() {
    this.logger.log('Obteniendo información de capacidad del sistema');
    return await this.workflowService.getCapacityInfo();
  }

  @Post('maintenance/cleanup')
  async forceCleanup() {
    this.logger.log('Ejecutando limpieza manual del sistema');
    return await this.workflowService.forceCleanup();
  }
}
