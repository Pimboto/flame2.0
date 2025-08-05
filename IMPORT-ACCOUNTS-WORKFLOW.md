# 📱 Import Accounts Workflow - Documentación

## 🎯 Descripción

Workflow automatizado para importar cuentas de Tinder desde la API externa de Flamebot. El proceso incluye:
1. Envío de cuentas a la API
2. Polling del estado de importación
3. Obtención de detalles de cuentas exitosas
4. Almacenamiento en base de datos

## 🏗️ Arquitectura

El workflow sigue estrictamente los principios de Clean Architecture:

```
/domain/
  ├── entities/account.entity.ts         # Entidad de dominio pura
  ├── interfaces/account.repository.ts   # Interface del repositorio
  └── workflows/import-accounts-workflow.ts # Definición del workflow

/infrastructure/
  ├── persistence/entities/account.entity.ts # Entidad TypeORM
  └── repositories/account.repository.ts     # Implementación del repositorio

/account.module.ts # Módulo de NestJS con DI
```

## 🚀 Uso

### 1. Ejecutar Importación

```bash
curl -X POST http://localhost:3000/api/v1/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "import-accounts-workflow",
    "data": {
      "accounts": [
        {
          "account": "8e0c2d96-38d2-4756-9531-60641e3f02a6:ae54f3e7f9fb40b99e2ff2e7d94cc3e4:eyJhbGciOiJIUzI1NiJ9.MTMxODU0MTAzNjg.HskbTT3H4Hvz0bkEdvsIlNwl3ltRYSqYBlZOzeufHeY:40.71272659301758:-74.00601196289062:socks5://...",
          "class_info": {
            "class_type": "Iris",
            "class_color": "#ffb3f5"
          },
          "account_origin": "ios"
        }
      ],
      "apiToken": "YOUR_BEARER_TOKEN_HERE"
    }
  }'
```

**Respuesta:**
```json
{
  "executionId": "abc123-def456-...",
  "status": "accepted"
}
```

### 2. Monitorear Progreso

```bash
curl http://localhost:3000/api/v1/workflows/instances/{executionId}
```

**Estados posibles:**
- `pending`: En cola
- `running`: Ejecutándose
- `completed`: Completado exitosamente
- `failed`: Falló
- `stopped`: Detenido

### 3. Ver Historial

```bash
curl http://localhost:3000/api/v1/workflows/executions
```

## 📊 Flujo del Workflow

### Paso 1: Import Accounts (`import-accounts`)
- **Endpoint**: POST `https://api.flamebot-tin.com/api/add-tinder-cards`
- **Timeout**: 60 segundos
- **Output**: `task_id` para polling

### Paso 2: Poll Status (`poll-status`)
- **Endpoint**: GET `https://api.flamebot-tin.com/api/get-add-tinder-cards-status/{task_id}`
- **Intervalo**: 4 segundos
- **Timeout máximo**: 10 minutos (150 intentos)
- **Estados**: PENDING, STARTED, COMPLETED, FAILED

### Paso 3: Fetch Account Details (`fetch-account-details`)
- **Endpoint**: POST `https://api.flamebot-tin.com/api/get-tinder-accounts-by-ids`
- **Input**: Array de `successful_ids`
- **Output**: Detalles completos de las cuentas

### Paso 4: Save Accounts (`save-accounts`)
- **Acción**: Convierte a entidades de dominio y prepara para guardar
- **Output**: Resumen con estadísticas

## 📈 Métricas y Logs

El workflow proporciona logs detallados:

```
🚀 [ImportAccounts] Iniciando importación de 2 cuentas
✅ [ImportAccounts] Task creado: 5594b8f5-c483-464b-b77d-70ac13b369e9
🔍 [PollStatus] Intento 1/150 - Verificando estado...
📊 [PollStatus] Estado: STARTED, Progreso: 50%
🎉 [PollStatus] Importación completada - Exitosas: 2, Fallidas: 0
🔍 [FetchDetails] Obteniendo detalles de 2 cuentas exitosas
💾 [SaveAccounts] Guardando 2 cuentas en la base de datos
🎯 [SaveAccounts] Resumen final: {...}
```

## 🔐 Seguridad

- **Token API**: Debe proporcionarse en cada ejecución
- **Validación**: DTOs validados automáticamente
- **Timeouts**: Protección contra procesos colgados
- **Reintentos**: Manejo automático de fallos temporales

## 🛠️ Configuración

### Variables de Entorno
```env
# No se requieren variables adicionales
# El token de API se pasa como parámetro en cada ejecución
```

### Base de Datos
La tabla `accounts` se crea automáticamente con las siguientes columnas:
- `id` (UUID)
- `external_id` (único, indexado)
- `account_string`
- `account_origin`
- `class_type`, `class_color`
- `name`, `age`, `phone`, `email`, etc.
- `proxy_https`
- `status` (indexado)
- `created_at`, `updated_at`

## 🧪 Testing

### Script de Prueba
```bash
# Usar el script de ejemplo
npx ts-node example-import-accounts.ts
```

### Verificar Cuentas Importadas
```sql
-- En PostgreSQL
SELECT id, external_id, name, status, created_at 
FROM accounts 
ORDER BY created_at DESC;
```

## 🚨 Troubleshooting

### Error: "Request failed"
- Verificar que el token API es válido
- Verificar conectividad con api.flamebot-tin.com

### Error: "Polling timeout"
- El proceso tomó más de 10 minutos
- Verificar el estado del task en la API externa

### Error: "No accounts to save"
- No hubo cuentas exitosas en la importación
- Revisar los datos de entrada

## 📝 Notas Importantes

1. **Idempotencia**: El workflow NO es idempotente por defecto. Ejecutarlo múltiples veces con las mismas cuentas puede crear duplicados.

2. **Límites**: 
   - Máximo tiempo de polling: 10 minutos
   - Intervalo de polling: 4 segundos
   - Sin límite en cantidad de cuentas por batch

3. **Persistencia**: Las cuentas se convierten a entidades de dominio pero el guardado real en BD debe implementarse según necesidades específicas.

4. **Monitoreo**: Use las herramientas de monitoreo de BullMQ para ver el estado de las colas en tiempo real.