import { DataSource } from 'typeorm';
import { WorkflowExecution } from './src/domain/entities/workflow-execution.entity';

// Script para corregir estados incorrectos en BD
async function fixExecutionStates() {
  console.log('🔧 Corrigiendo estados de ejecución...\n');

  const dataSource = new DataSource({
    type: 'postgres',
    url: 'postgresql://postgres:ifZOZKtkfRQnsYzUlgNaDMAaxoMuHMWL@centerbeam.proxy.rlwy.net:45100/railway',
    entities: [WorkflowExecution],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Conectado a PostgreSQL\n');

    // Buscar ejecuciones recientes marcadas como completed
    const repository = dataSource.getRepository(WorkflowExecution);
    
    const recentExecutions = await repository.find({
      where: { status: 'completed' },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    console.log(`📊 Encontradas ${recentExecutions.length} ejecuciones completadas recientes\n`);

    // Filtrar las sospechosas
    const suspiciousExecutions = recentExecutions.filter(exec => {
      const hasLoopData = exec.outputData?.iteration !== undefined;
      const hasActiveFlag = exec.outputData?._workflowActive === true;
      const isLoopWorkflow = exec.workflowId === 'loop-workflow' || exec.workflowId === 'conditional-loop';
      const isRecent = (Date.now() - exec.createdAt.getTime()) / 1000 / 60 < 240; // 4 horas
      
      return (hasLoopData || hasActiveFlag || isLoopWorkflow) && isRecent;
    });

    if (suspiciousExecutions.length === 0) {
      console.log('✅ No se encontraron ejecuciones sospechosas');
      return;
    }

    console.log(`⚠️  Ejecuciones sospechosas: ${suspiciousExecutions.length}\n`);

    for (const exec of suspiciousExecutions) {
      console.log(`ID: ${exec.id}`);
      console.log(`Workflow: ${exec.workflowId}`);
      console.log(`Creado: ${exec.createdAt.toLocaleString()}`);
      console.log(`Iteración: ${exec.outputData?.iteration || 'N/A'}`);
      console.log(`Active Flag: ${exec.outputData?._workflowActive}`);
      
      // DESCOMENTAR PARA CORREGIR
      /*
      await repository.update(exec.id, {
        status: 'cancelled',
        error: 'Terminado manualmente - Estado incorrecto detectado',
        completedAt: new Date(),
      });
      console.log('✅ Estado corregido a "cancelled"');
      */
      
      console.log('---\n');
    }

    console.log('\n💡 Para corregir los estados, descomenta las líneas de UPDATE en el código');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await dataSource.destroy();
    console.log('\n✅ Proceso completado');
  }
}

fixExecutionStates().catch(console.error);
