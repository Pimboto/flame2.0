import IORedis from 'ioredis';

// Script para probar la conexión a Redis
async function testRedisConnection() {
  console.log('🔍 Probando conexión a Redis...\n');

  const connections = [
    {
      name: 'Railway Redis (desde .env)',
      config: {
        host: 'shortline.proxy.rlwy.net',
        port: 21879,
        password: 'MtjPGJZoJWqCXnoMZjrsjUsFaiXvIIAM',
        username: 'default',
      }
    },
    {
      name: 'Redis Local',
      config: {
        host: 'localhost',
        port: 6379,
      }
    }
  ];

  for (const conn of connections) {
    console.log(`\n📡 Probando: ${conn.name}`);
    console.log(`Config: ${JSON.stringify(conn.config, null, 2)}`);
    
    const redis = new IORedis({
      ...conn.config,
      retryStrategy: () => null, // No reintentar para prueba rápida
      lazyConnect: true,
      connectTimeout: 5000,
    });

    try {
      await redis.connect();
      const pong = await redis.ping();
      console.log(`✅ Conexión exitosa! Respuesta: ${pong}`);
      
      // Probar algunas operaciones básicas
      await redis.set('test:key', 'test-value');
      const value = await redis.get('test:key');
      console.log(`✅ Set/Get funcionando: ${value}`);
      
      // Obtener info
      const info = await redis.info('server');
      const versionMatch = info.match(/redis_version:([^\r\n]+)/);
      if (versionMatch) {
        console.log(`✅ Redis version: ${versionMatch[1]}`);
      }
      
      await redis.del('test:key');
      await redis.disconnect();
      
      console.log(`\n🎉 ${conn.name} está funcionando correctamente!`);
      return true;
      
    } catch (error: any) {
      console.error(`❌ Error conectando a ${conn.name}:`);
      
      if (error instanceof Error) {
        console.error(`   ${error.message}`);
        
        if (error.message.includes('ECONNREFUSED')) {
          console.error('   → Redis no está ejecutándose en esa dirección');
        } else if (error.message.includes('ENOTFOUND')) {
          console.error('   → No se puede resolver el hostname');
        } else if (error.message.includes('AUTH')) {
          console.error('   → Error de autenticación - verifica usuario/contraseña');
        } else if (error.message.includes('ETIMEDOUT')) {
          console.error('   → Timeout de conexión - el servidor no responde');
        } else if (error.message.includes('ECONNRESET')) {
          console.error('   → Conexión rechazada por el servidor');
        }
      } else {
        console.error(`   Error desconocido: ${String(error)}`);
      }
      
      try {
        await redis.disconnect();
      } catch {}
    }
  }

  console.log('\n\n💡 Sugerencias:');
  console.log('1. Verifica que los datos de Railway Redis estén actualizados');
  console.log('2. Revisa si Railway Redis está activo en tu dashboard');
  console.log('3. Verifica tu conexión a internet');
  console.log('4. Si usas VPN o proxy, intenta desactivarlo');
  console.log('5. Considera instalar Redis localmente como respaldo:');
  console.log('   - Windows: https://github.com/microsoftarchive/redis/releases');
  console.log('   - Mac: brew install redis');
  console.log('   - Linux: sudo apt-get install redis-server');
  
  return false;
}

// Ejecutar test
testRedisConnection()
  .then(success => {
    if (!success) {
      console.log('\n❌ No se pudo conectar a ningún Redis');
      process.exit(1);
    }
  })
  .catch(console.error);
