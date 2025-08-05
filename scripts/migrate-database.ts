// scripts/migrate-database.ts
// SCRIPT DE MIGRACIÓN - Actualiza la estructura de la base de datos

import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { WorkflowExecutionEntity } from '../src/infrastructure/entities/workflow-execution.entity';
import { AccountEntity } from '../src/infrastructure/entities/account.entity';

dotenv.config();

async function migrate() {
  console.log('🔄 Starting database migration...');

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/flamebot',
    entities: [WorkflowExecutionEntity, AccountEntity],
    synchronize: false,
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    // Run migrations
    await dataSource.synchronize(true);
    console.log('✅ Database schema synchronized');

    await dataSource.destroy();
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate().catch(console.error);
