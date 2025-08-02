import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowModule } from './workflow.module';
import { DatabaseModule } from './database.module';
import { ConfigModule } from './common/modules/config.module';
import { ConfigService } from './common/services/config.service';

@Module({
  imports: [
    ConfigModule, // Debe ir primero para estar disponible globalmente
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => configService.databaseConfig,
      inject: [ConfigService],
    }),
    DatabaseModule,
    WorkflowModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
