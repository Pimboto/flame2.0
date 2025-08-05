import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { WorkflowEngineService } from '../../infrastructure/workflow-engine.service';
import { ExecuteWorkflowDto } from '../../presentation/dto/execute-workflow.dto';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(private readonly workflowEngine: WorkflowEngineService) {}

  async executeWorkflow(dto: ExecuteWorkflowDto): Promise<any> {
    try {
      this.logger.log(`Ejecutando workflow: ${dto.workflowId}`);

      // Validar que el workflow existe
      if (!this.isValidWorkflowId(dto.workflowId)) {
        throw new BadRequestException(
          `Workflow no encontrado: ${dto.workflowId}`,
        );
      }

      // Ejecutar el workflow
      const instanceId = await this.workflowEngine.startWorkflow(
        dto.workflowId,
        dto.data || {},
      );

      return {
        success: true,
        instanceId,
        message: 'Workflow iniciado exitosamente',
      };
    } catch (error) {
      this.logger.error('Error ejecutando workflow:', error);
      throw error;
    }
  }

  async getWorkflowStatus(instanceId: string): Promise<any> {
    try {
      const status = await this.workflowEngine.getWorkflowStatus(instanceId);

      if (!status) {
        throw new NotFoundException(
          `Instancia de workflow no encontrada: ${instanceId}`,
        );
      }

      return status; // Devolver todo el estado detallado
    } catch (error) {
      this.logger.error(
        `Error obteniendo estado del workflow ${instanceId}:`,
        error,
      );
      throw error;
    }
  }

  async suspendWorkflow(instanceId: string): Promise<any> {
    try {
      await this.workflowEngine.suspendWorkflow(instanceId);

      return {
        success: true,
        message: 'Workflow suspendido exitosamente',
      };
    } catch (error) {
      this.logger.error(`Error suspendiendo workflow ${instanceId}:`, error);
      throw error;
    }
  }

  async resumeWorkflow(instanceId: string): Promise<any> {
    try {
      await this.workflowEngine.resumeWorkflow(instanceId);

      return {
        success: true,
        message: 'Workflow reanudado exitosamente',
      };
    } catch (error) {
      this.logger.error(`Error reanudando workflow ${instanceId}:`, error);
      throw error;
    }
  }

  async terminateWorkflow(instanceId: string): Promise<any> {
    try {
      await this.workflowEngine.terminateWorkflow(instanceId);

      return {
        success: true,
        message: 'Workflow terminado exitosamente',
      };
    } catch (error) {
      this.logger.error(`Error terminando workflow ${instanceId}:`, error);
      throw error;
    }
  }

  async testWorkflow(workflowId: string, testData: any): Promise<any> {
    try {
      this.logger.log(`Testeando workflow: ${workflowId}`);

      // Validar que el workflow existe
      if (!this.isValidWorkflowId(workflowId)) {
        throw new BadRequestException(`Workflow no encontrado: ${workflowId}`);
      }

      // Ejecutar test
      const result = await this.workflowEngine.testWorkflow(
        workflowId,
        testData,
      );

      return {
        success: true,
        ...result,
        message: 'Test de workflow completado exitosamente',
      };
    } catch (error) {
      this.logger.error(`Error testeando workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async listAvailableWorkflows(): Promise<any> {
    // Por ahora retornamos los workflows hardcodeados
    // En el futuro esto podría venir de una base de datos
    return {
      workflows: [
        {
          id: 'safe-automation-workflow',
          name: 'Safe Automation Workflow',
          description:
            'Workflow seguro con múltiples puntos de control y detención automática',
          version: 1,
        },
      ],
    };
  }

  async getExecutionHistory(): Promise<any> {
    try {
      return await this.workflowEngine.getExecutionHistory();
    } catch (error) {
      this.logger.error('Error obteniendo historial de ejecuciones:', error);
      throw error;
    }
  }

  async getQueueStats(): Promise<any> {
    try {
      return await this.workflowEngine.getQueueStats();
    } catch (error) {
      this.logger.error('Error obteniendo estadísticas de colas:', error);
      throw error;
    }
  }

  async getCapacityInfo(): Promise<any> {
    try {
      return this.workflowEngine.getCapacityInfo();
    } catch (error) {
      this.logger.error('Error obteniendo información de capacidad:', error);
      throw error;
    }
  }

  async forceCleanup(): Promise<any> {
    try {
      await this.workflowEngine.forceCleanup();
      return {
        success: true,
        message: 'Limpieza ejecutada exitosamente',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Error ejecutando limpieza:', error);
      throw error;
    }
  }

  private isValidWorkflowId(workflowId: string): boolean {
    // Por ahora validamos contra una lista hardcodeada
    const validWorkflows = ['safe-automation-workflow'];
    return validWorkflows.includes(workflowId);
  }
}
