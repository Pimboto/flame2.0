import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowModule } from './workflow.module';
import { DatabaseModule } from './database.module';
import { ConfigModule } from './common/modules/config.module';
import { ConfigService } from './common/services/config.service';
import { CustomTypeOrmLogger } from './common/services/typeorm-logger.service';

@Module({
  imports: [
    ConfigModule, // Debe ir primero para estar disponible globalmente
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const config = configService.databaseConfig;
        
        // Solo usar el logger personalizado si está habilitado el logging
        if (configService.logSql || configService.logSqlErrorOnly) {
          return {
            ...config,
            logger: new CustomTypeOrmLogger(
              configService.logSql,
              configService.logSqlErrorOnly,
            ),
          };
        }
        
        return config;
      },
      inject: [ConfigService],
    }),
    DatabaseModule,
    WorkflowModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
