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
import { createSafeWorkflowTestData } from '../../domain/workflows/examples/safe-automation-workflow';

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

  // Endpoint especial para probar el workflow seguro
  @Post('safe-automation/test')
  @HttpCode(HttpStatus.ACCEPTED)
  async testSafeAutomationWorkflow(@Body() body?: { maxIterations?: number }) {
    this.logger.log('Iniciando prueba del workflow de automatización segura');

    const testData = createSafeWorkflowTestData(body?.maxIterations);

    const result = await this.workflowService.executeWorkflow({
      workflowId: 'safe-automation-workflow',
      data: testData,
    });

    return {
      message: 'Workflow de automatización segura iniciado',
      description:
        'El workflow se detendrá en la 3ra iteración automáticamente',
      executionId: result.instanceId,
      testData,
      steps: [
        '1. Inicializar workflow',
        '2. Verificar condición (API check)',
        '3. Esperar 20 segundos',
        '4. Verificar condición nuevamente',
        '5. Ejecutar acción (Hello World)',
        '6. Decidir siguiente paso y volver al paso 2',
        'NOTA: Se detendrá automáticamente en la 3ra iteración',
      ],
    };
  }

  // Endpoint para obtener el estado detallado del workflow seguro
  @Get('safe-automation/status/:instanceId')
  async getSafeWorkflowStatus(@Param('instanceId') instanceId: string) {
    this.logger.log(
      `Obteniendo estado detallado del workflow seguro: ${instanceId}`,
    );

    const status = await this.workflowService.getWorkflowStatus(instanceId);

    if (!status) {
      return {
        error: 'Workflow no encontrado',
        instanceId,
      };
    }

    return {
      ...status,
      interpretation: this.interpretSafeWorkflowStatus(status),
    };
  }

  private interpretSafeWorkflowStatus(status: any): any {
    const data = status.data || {};

    return {
      currentIteration: data.iteration || 0,
      isRunning: status.status === 'active' || status.status === 'running',
      wasStopped: data.status === 'stopped',
      stopReason: data.stopReason,
      messages: data.messages || [],
      history: data.history || [],
      startedAt: data.startedAt,
      stoppedAt: data.stoppedAt,
      completedAt: data.completedAt,
    };
  }
}
