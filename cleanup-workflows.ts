import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { DataSource } from 'typeorm';
import { WorkflowExecution } from './src/domain/entities/workflow-execution.entity';

// Script para limpiar workflows zombies y jobs huérfanos
async function cleanupWorkflows() {
  console.log('🧹 Iniciando limpieza de workflows...\n');

  // Conectar a Redis
  const redis = new IORedis({
    host: 'shortline.proxy.rlwy.net',
    port: 21879,
    password: 'MtjPGJZoJWqCXnoMZjrsjUsFaiXvIIAM',
    username: 'default',
  });

  // Conectar a PostgreSQL
  const dataSource = new DataSource({
    type: 'postgres',
    url: 'postgresql://postgres:ifZOZKtkfRQnsYzUlgNaDMAaxoMuHMWL@centerbeam.proxy.rlwy.net:45100/railway',
    entities: [WorkflowExecution],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Conectado a PostgreSQL');
    console.log('✅ Conectado a Redis\n');

    // 1. Listar todas las colas
    const keys = await redis.keys('bull:*');
    const queueNames = new Set<string>();
    
    keys.forEach(key => {
      const match = key.match(/bull:([^:]+):/);
      if (match) {
        queueNames.add(match[1]);
      }
    });

    console.log(`📋 Colas encontradas: ${queueNames.size}`);
    console.log(Array.from(queueNames).join(', '));
    console.log('');

    // 2. Para cada cola, verificar jobs activos
    for (const queueName of queueNames) {
      const queue = new Queue(queueName, {
        connection: {
          host: 'shortline.proxy.rlwy.net',
          port: 21879,
          password: 'MtjPGJZoJWqCXnoMZjrsjUsFaiXvIIAM',
          username: 'default',
        },
      });

      const jobs = await queue.getJobs(['active', 'waiting', 'delayed']);
      
      if (jobs.length > 0) {
        console.log(`\n🔍 Cola: ${queueName}`);
        console.log(`   Jobs activos: ${jobs.length}`);
        
        for (const job of jobs) {
          const jobInfo = {
            id: job.id,
            name: job.name,
            createdAt: job.timestamp ? new Date(job.timestamp) : null,
            data: job.data,
          };
          
          console.log(`\n   Job ID: ${jobInfo.id}`);
          console.log(`   Creado: ${jobInfo.createdAt?.toLocaleString()}`);
          console.log(`   Data: ${JSON.stringify(jobInfo.data).substring(0, 100)}...`);
          
          // Verificar si es un job antiguo (más de 1 hora)
          if (jobInfo.createdAt) {
            const ageInMinutes = (Date.now() - jobInfo.createdAt.getTime()) / 1000 / 60;
            
            if (ageInMinutes > 60) {
              console.log(`   ⚠️  Job antiguo (${Math.round(ageInMinutes)} minutos)`);
              console.log(`   ¿Eliminar? (Descomenta la línea siguiente para eliminar)`);
              // await job.remove();
              // console.log(`   ✅ Job eliminado`);
            }
          }
        }
      }

      await queue.close();
    }

    // 3. Verificar executions en BD con estado incorrecto
    console.log('\n📊 Verificando ejecuciones en base de datos...\n');
    
    const executions = await dataSource.getRepository(WorkflowExecution).find({
      where: { status: 'completed' },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const suspiciousExecutions = executions.filter(exec => {
      // Si tiene datos de loop pero está marcado como completado
      const hasLoopData = exec.outputData?.iteration || exec.outputData?._workflowActive;
      const isRecent = (Date.now() - exec.createdAt.getTime()) / 1000 / 60 < 120; // 2 horas
      return hasLoopData && isRecent;
    });

    if (suspiciousExecutions.length > 0) {
      console.log(`⚠️  Encontradas ${suspiciousExecutions.length} ejecuciones sospechosas:\n`);
      
      for (const exec of suspiciousExecutions) {
        console.log(`ID: ${exec.id}`);
        console.log(`Workflow: ${exec.workflowId}`);
        console.log(`Creado: ${exec.createdAt.toLocaleString()}`);
        console.log(`Iteración: ${exec.outputData?.iteration || 'N/A'}`);
        console.log(`Job ID: ${exec.jobId}`);
        console.log('---');
      }
    }

    // 4. Opción para limpiar todo
    console.log('\n🔧 Opciones de limpieza:');
    console.log('1. Para limpiar TODOS los jobs: descomenta las líneas en el código');
    console.log('2. Para limpiar jobs específicos: usa el ID del job');
    console.log('3. Para pausar todas las colas: descomenta la sección correspondiente');
    
    // DESCOMENTAR PARA LIMPIAR TODO
    /*
    console.log('\n⚠️  LIMPIANDO TODOS LOS JOBS...');
    for (const queueName of queueNames) {
      const queue = new Queue(queueName, {
        connection: {
          host: 'shortline.proxy.rlwy.net',
          port: 21879,
          password: 'MtjPGJZoJWqCXnoMZjrsjUsFaiXvIIAM',
          username: 'default',
        },
      });
      
      await queue.obliterate({ force: true });
      console.log(`✅ Cola ${queueName} limpiada`);
      await queue.close();
    }
    */

    // DESCOMENTAR PARA PAUSAR TODAS LAS COLAS
    /*
    console.log('\n⏸️  PAUSANDO TODAS LAS COLAS...');
    for (const queueName of queueNames) {
      const queue = new Queue(queueName, {
        connection: {
          host: 'shortline.proxy.rlwy.net',
          port: 21879,
          password: 'MtjPGJZoJWqCXnoMZjrsjUsFaiXvIIAM',
          username: 'default',
        },
      });
      
      await queue.pause();
      console.log(`⏸️  Cola ${queueName} pausada`);
      await queue.close();
    }
    */

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await redis.disconnect();
    await dataSource.destroy();
    console.log('\n✅ Limpieza completada');
  }
}

// Ejecutar
cleanupWorkflows().catch(console.error);
