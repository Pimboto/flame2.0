import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Script de emergencia para detener TODOS los workflows
async function emergencyStop() {
  console.log('🚨 EMERGENCY STOP - Deteniendo todos los workflows...\n');

  const redis = new IORedis({
    host: 'shortline.proxy.rlwy.net',
    port: 21879,
    password: 'MtjPGJZoJWqCXnoMZjrsjUsFaiXvIIAM',
    username: 'default',
  });

  try {
    // 1. Obtener todas las colas
    const keys = await redis.keys('bull:*');
    const queueNames = new Set<string>();
    
    keys.forEach(key => {
      const match = key.match(/bull:([^:]+):/);
      if (match) {
        queueNames.add(match[1]);
      }
    });

    console.log(`📋 Encontradas ${queueNames.size} colas\n`);

    let totalJobsRemoved = 0;

    // 2. Para cada cola
    for (const queueName of queueNames) {
      console.log(`🔍 Procesando cola: ${queueName}`);
      
      const queue = new Queue(queueName, {
        connection: {
          host: 'shortline.proxy.rlwy.net',
          port: 21879,
          password: 'MtjPGJZoJWqCXnoMZjrsjUsFaiXvIIAM',
          username: 'default',
        },
      });

      try {
        // Pausar la cola primero
        await queue.pause();
        console.log(`   ⏸️  Cola pausada`);

        // Obtener TODOS los jobs
        const activeJobs = await queue.getJobs(['active']);
        const waitingJobs = await queue.getJobs(['waiting']);
        const delayedJobs = await queue.getJobs(['delayed']);
        
        const allJobs = [...activeJobs, ...waitingJobs, ...delayedJobs];
        
        if (allJobs.length > 0) {
          console.log(`   📊 Jobs encontrados: ${allJobs.length}`);
          
          // Eliminar todos los jobs
          for (const job of allJobs) {
            await job.remove();
            totalJobsRemoved++;
          }
          
          console.log(`   ✅ ${allJobs.length} jobs eliminados`);
        } else {
          console.log(`   ✅ No hay jobs activos`);
        }

        // Limpiar la cola completamente
        await queue.drain();
        console.log(`   🧹 Cola drenada`);

        // Cerrar la cola
        await queue.close();
        
      } catch (error) {
        console.error(`   ❌ Error procesando cola ${queueName}:`, error);
      }
    }

    console.log(`\n✅ COMPLETO: ${totalJobsRemoved} jobs eliminados en total`);

    // 3. Limpiar keys huérfanas de Redis
    console.log('\n🧹 Limpiando keys huérfanas...');
    
    const orphanKeys = await redis.keys('bull:*:stalled*');
    for (const key of orphanKeys) {
      await redis.del(key);
    }
    
    console.log(`✅ ${orphanKeys.length} keys huérfanas eliminadas`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await redis.disconnect();
    console.log('\n🏁 Emergency stop completado');
  }
}

// Confirmar antes de ejecutar
console.log('⚠️  ADVERTENCIA: Este script detendrá TODOS los workflows activos');
console.log('Presiona Ctrl+C para cancelar o espera 5 segundos para continuar...\n');

setTimeout(() => {
  emergencyStop().catch(console.error);
}, 5000);
