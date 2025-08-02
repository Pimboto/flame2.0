#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
🔧 Configuración de Logs para FlameBot

Uso: node set-logs.js [opción]

Opciones:
  minimal     - Solo errores y advertencias (producción)
  normal      - Logs normales sin SQL (por defecto)
  debug       - Logs detallados sin SQL
  sql         - Logs normales + queries SQL
  sql-debug   - Todo incluyendo SQL detallado
  sql-errors  - Solo errores de SQL

Ejemplos:
  node set-logs.js minimal
  node set-logs.js sql-debug
  `);
  process.exit(0);
}

const option = args[0].toLowerCase();

let config = {
  LOG_LEVEL: 'info',
  LOG_SQL: 'false',
  LOG_SQL_ERROR_ONLY: 'true'
};

switch (option) {
  case 'minimal':
    config.LOG_LEVEL = 'warn';
    config.LOG_SQL = 'false';
    config.LOG_SQL_ERROR_ONLY = 'true';
    break;
    
  case 'normal':
    config.LOG_LEVEL = 'info';
    config.LOG_SQL = 'false';
    config.LOG_SQL_ERROR_ONLY = 'true';
    break;
    
  case 'debug':
    config.LOG_LEVEL = 'debug';
    config.LOG_SQL = 'false';
    config.LOG_SQL_ERROR_ONLY = 'true';
    break;
    
  case 'sql':
    config.LOG_LEVEL = 'info';
    config.LOG_SQL = 'true';
    config.LOG_SQL_ERROR_ONLY = 'false';
    break;
    
  case 'sql-debug':
    config.LOG_LEVEL = 'debug';
    config.LOG_SQL = 'true';
    config.LOG_SQL_ERROR_ONLY = 'false';
    break;
    
  case 'sql-errors':
    config.LOG_LEVEL = 'info';
    config.LOG_SQL = 'false';
    config.LOG_SQL_ERROR_ONLY = 'true';
    break;
    
  default:
    console.error(`❌ Opción no válida: ${option}`);
    process.exit(1);
}

// Leer archivo .env actual
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (error) {
  console.error('❌ No se pudo leer .env');
  process.exit(1);
}

// Actualizar valores
for (const [key, value] of Object.entries(config)) {
  const regex = new RegExp(`^${key}=.*$`, 'gm');
  if (envContent.match(regex)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }
}

// Escribir archivo actualizado
try {
  fs.writeFileSync(envPath, envContent);
  console.log(`
✅ Configuración actualizada a: ${option}

  LOG_LEVEL=${config.LOG_LEVEL}
  LOG_SQL=${config.LOG_SQL}
  LOG_SQL_ERROR_ONLY=${config.LOG_SQL_ERROR_ONLY}

Reinicia el servidor para aplicar los cambios.
  `);
} catch (error) {
  console.error('❌ No se pudo escribir .env');
  process.exit(1);
}
