import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Monitor en tiempo real de Redis y BullMQ
async function monitorRedis() {
  console.clear();
  console.log('📊 Monitor de Redis/BullMQ - Actualización cada 2 segundos\n');
  console.log('Presiona Ctrl+C para salir\n');

  const redis = new IORedis({
    host: 'shortline.proxy.rlwy.net',
    port: 21879,
    password: 'MtjPGJZoJWqCXnoMZjrsjUsFaiXvIIAM',
    username: 'default',
  });

  const monitor = async () => {
    try {
      // Limpiar consola
      console.clear();
      console.log('📊 Monitor de Redis/BullMQ');
      console.log('=' .repeat(80));
      console.log(`🕐 ${new Date().toLocaleString()}\n`);

      // Obtener todas las colas
      const keys = await redis.keys('bull:*');
      const queueNames = new Set<string>();
      
      keys.forEach(key => {
        const match = key.match(/bull:([^:]+):/);
        if (match) {
          queueNames.add(match[1]);
        }
      });

      let totalActive = 0;
      let totalWaiting = 0;
      let totalDelayed = 0;
      let totalCompleted = 0;
      let totalFailed = 0;

      // Para cada cola
      for (const queueName of queueNames) {
        const queue = new Queue(queueName, {
          connection: {
            host: 'shortline.proxy.rlwy.net',
            port: 21879,
            password: 'MtjPGJZoJWqCXnoMZjrsjUsFaiXvIIAM',
            username: 'default',
          },
        });

        const counts = await queue.getJobCounts();
        
        if (counts.active > 0 || counts.waiting > 0 || counts.delayed > 0) {
          console.log(`\n📦 Cola: ${queueName}`);
          console.log(`   🟢 Activos: ${counts.active}`);
          console.log(`   🟡 Esperando: ${counts.waiting}`);
          console.log(`   ⏰ Retrasados: ${counts.delayed}`);
          console.log(`   ✅ Completados: ${counts.completed}`);
          console.log(`   ❌ Fallidos: ${counts.failed}`);

          // Si hay jobs activos, mostrar detalles
          if (counts.active > 0) {
            const activeJobs = await queue.getJobs(['active']);
            console.log('\n   Jobs activos:');
            
            for (const job of activeJobs.slice(0, 3)) { // Mostrar máximo 3
              const age = Date.now() - job.timestamp;
              const ageMinutes = Math.floor(age / 1000 / 60);
              console.log(`     - ID: ${job.id} (${ageMinutes} min)`);
              
              if (job.data?.iteration) {
                console.log(`       Iteración: ${job.data.iteration}`);
              }
            }
            
            if (activeJobs.length > 3) {
              console.log(`     ... y ${activeJobs.length - 3} más`);
            }
          }
        }

        totalActive += counts.active;
        totalWaiting += counts.waiting;
        totalDelayed += counts.delayed;
        totalCompleted += counts.completed;
        totalFailed += counts.failed;

        await queue.close();
      }

      // Resumen total
      console.log('\n' + '=' .repeat(80));
      console.log('📈 RESUMEN TOTAL:');
      console.log(`   🟢 Total Activos: ${totalActive}`);
      console.log(`   🟡 Total Esperando: ${totalWaiting}`);
      console.log(`   ⏰ Total Retrasados: ${totalDelayed}`);
      console.log(`   ✅ Total Completados: ${totalCompleted}`);
      console.log(`   ❌ Total Fallidos: ${totalFailed}`);

      // Información de memoria
      const info = await redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      if (memoryMatch) {
        console.log(`\n💾 Memoria Redis: ${memoryMatch[1]}`);
      }

    } catch (error) {
      console.error('❌ Error:', error);
    }
  };

  // Ejecutar monitor cada 2 segundos
  await monitor();
  const interval = setInterval(monitor, 2000);

  // Manejar salida limpia
  process.on('SIGINT', async () => {
    clearInterval(interval);
    await redis.disconnect();
    console.log('\n\n👋 Monitor detenido');
    process.exit(0);
  });
}

monitorRedis().catch(console.error);
