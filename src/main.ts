import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppLogger } from './common/services/logger.service';
import * as express from 'express';
import { join } from 'path';

// Cargar variables de entorno al inicio
dotenv.config();

async function bootstrap() {
  // Verificar que se está usando pnpm
  const userAgent = process.env.npm_config_user_agent;

  // Crear instancia del logger
  const logger = new AppLogger();

  if (userAgent && !userAgent.includes('pnpm')) {
    logger.warn('⚠️  Se recomienda usar pnpm para este proyecto');
    logger.warn('   Instala pnpm con: npm install -g pnpm');
    logger.warn('   Luego ejecuta: pnpm install');
  }

  const app = await NestFactory.create(AppModule, {
    logger,
  });

  // Servir archivos estáticos
  app.use('/tester', express.static(join(__dirname, '..', 'public')));

  // Configuración global de validación
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Filtro global de excepciones
  app.useGlobalFilters(new AllExceptionsFilter());

  // Prefijo global para las rutas
  app.setGlobalPrefix('api/v1');

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(
    `🧪 Workflow Tester UI: http://localhost:${port}/tester/workflow-tester.html`,
  );
  logger.log(`📦 Package Manager: ${userAgent?.split('/')[0] || 'unknown'}`);
  logger.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
