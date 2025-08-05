# 📱 Import Accounts Workflow - Documentación Técnica

## 🎯 Descripción

Workflow orquestado para importar cuentas de Tinder desde API externa (Flamebot) siguiendo Clean Architecture. Implementa un proceso robusto de 4 pasos con manejo de errores, polling inteligente y persistencia automática.

**Funcionalidades principales:**
- ✅ Importación masiva de cuentas con validación
- ✅ Polling automático con timeout y reintentos
- ✅ Manejo de estados COMPLETED/FAILED con terminación limpia
- ✅ Persistencia en PostgreSQL siguiendo Domain-Driven Design
- ✅ Logs detallados para debugging y monitoreo
- ✅ Arquitectura extensible para nuevos pasos/APIs

## 🏗️ Arquitectura Clean

El workflow respeta estrictamente los principios del @MUST-READ-RULES.md:

```
src/
├── domain/
│   ├── entities/account.entity.ts                    # ✅ Entidad pura sin frameworks
│   ├── repositories/account.repository.interface.ts  # ✅ Interface sin implementación
│   └── workflows/import-accounts-workflow.ts         # ✅ Lógica de negocio pura
├── infrastructure/
│   ├── entities/account.entity.ts                    # ✅ TypeORM separado del dominio
│   └── repositories/account.repository.ts            # ✅ Implementación concreta
└── database.module.ts                                # ✅ DI configuration
```

**Separación de responsabilidades:**
- **Domain**: Entidades inmutables + interfaces + workflows
- **Infrastructure**: TypeORM + implementaciones + persistencia
- **Application**: Orquestación (WorkflowEngineService)
- **Presentation**: Controllers + DTOs

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

## 📊 Flujo del Workflow (4 Pasos)

### Paso 1: `import-accounts` 
```typescript
// POST https://api.flamebot-tin.com/api/add-tinder-cards
handler: async (data: ImportAccountsData) => {
  const response = await makeHttpRequest(url, { method: 'POST', ... });
  return { ...data, taskId: response.task_id, _workflowActive: true };
}
```
- **Timeout**: 60s | **Output**: `task_id` | **Next**: `poll-status`

### Paso 2: `poll-status` (⚡ Lógica Inteligente)
```typescript
handler: async (data: ImportAccountsData) => {
  if (statusResponse.status === 'COMPLETED') {
    // Si successful_count === 0 → Terminar workflow
    if (successfulCount === 0) {
      return { ...data, _workflowActive: false, _workflowCompleted: true };
    }
    // Si hay exitosas → Continuar a fetch-account-details
    return { ...data, _nextStep: 'fetch-account-details' };
  }
  // Si STARTED/PENDING → Volver a poll-status (loop)
  return { ...data, _nextStep: 'poll-status' };
}
```
- **Intervalo**: 4s | **Max**: 150 intentos (10min) | **Estados**: PENDING/STARTED/COMPLETED/FAILED
- **Lógica de terminación**: Evita bucles infinitos cuando no hay cuentas exitosas

### Paso 3: `fetch-account-details`
```typescript
// POST https://api.flamebot-tin.com/api/get-tinder-accounts-by-ids
handler: async (data: ImportAccountsData) => {
  const detailsResponse = await makeHttpRequest(url, { body: successful_ids });
  const importedAccounts = detailsResponse.accounts.map(mapToAccount);
  return { ...data, importedAccounts, _nextStep: 'save-accounts' };
}
```
- **Input**: `successful_ids[]` | **Output**: Accounts con detalles completos

### Paso 4: `save-accounts` (🗄️ Persistencia)
```typescript
handler: async (data: ImportAccountsData) => {
  // Crear entidades de dominio
  const domainAccounts = accountsToSave.map(Account.create);
  
  // Obtener repositorio via DI
  const accountRepository = WorkflowEngineService.getAccountRepository();
  await accountRepository.saveMany(domainAccounts);
  
  return { ...data, _workflowActive: false, _workflowCompleted: true };
}
```
- **Acción**: Domain entities → TypeORM persistence | **Output**: Summary con estadísticas

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

### Base de Datos (PostgreSQL)
```sql
-- Tabla generada automáticamente por TypeORM
CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    external_id VARCHAR UNIQUE NOT NULL,    -- API external ID
    account_string TEXT NOT NULL,           -- Tinder session string
    account_origin VARCHAR NOT NULL,        -- 'ios', 'android', etc
    class_type VARCHAR NOT NULL,            -- 'Iris', 'Premium', etc
    class_color VARCHAR NOT NULL,           -- '#ffb3f5', '#gold', etc
    name VARCHAR NOT NULL,
    age INTEGER,
    phone VARCHAR,
    email VARCHAR,
    account_tag VARCHAR,
    image VARCHAR,
    location VARCHAR,
    is_verified BOOLEAN DEFAULT FALSE,
    proxy_https VARCHAR NOT NULL,           -- Proxy configuration
    status VARCHAR NOT NULL,                -- 'alive', 'dead', 'suspended'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices automáticos
CREATE UNIQUE INDEX idx_accounts_external_id ON accounts(external_id);
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_created_at ON accounts(created_at);
```

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

3. **Persistencia**: ✅ **IMPLEMENTADO** - Las cuentas se convierten a entidades de dominio y se guardan automáticamente en PostgreSQL via Repository Pattern.

4. **Monitoreo**: Use las herramientas de monitoreo de BullMQ para ver el estado de las colas en tiempo real.

---

## 🚀 Extensibilidad para Desarrolladores

### Agregar Nuevos Pasos al Workflow

```typescript
// En /domain/workflows/import-accounts-workflow.ts

const newCustomStep: WorkflowStep = {
  name: 'Custom Processing',
  timeout: 30000,
  handler: async (data: ImportAccountsData) => {
    console.log('🔧 [CustomStep] Procesando lógica personalizada...');
    
    // Tu lógica aquí
    const processedData = await customProcessing(data.importedAccounts);
    
    return {
      ...data,
      customProcessedData: processedData,
      _workflowActive: true,
      _nextStep: 'next-step-name' // o undefined para terminar
    };
  },
  nextStep: 'save-accounts' // Paso por defecto
};

// Registrar en el Map
steps: new Map([
  ['import-accounts', importAccountsStep],
  ['poll-status', pollStatusStep], 
  ['fetch-account-details', fetchAccountDetailsStep],
  ['custom-processing', newCustomStep], // ← Nuevo paso
  ['save-accounts', saveAccountsStep]
])
```

### Agregar Nuevas APIs Externas

```typescript
// Crear nueva función HTTP helper
async function makeCustomApiRequest(endpoint: string, data: any) {
  return await makeHttpRequest(`https://nueva-api.com${endpoint}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${data.customToken}` },
    body: JSON.stringify(data)
  });
}

// Usarla en el handler
handler: async (data: ImportAccountsData) => {
  const response = await makeCustomApiRequest('/process', data);
  return { ...data, customApiResponse: response };
}
```

### Extender Consultas a la Tabla Accounts

```typescript
// En /domain/repositories/account.repository.interface.ts
export interface IAccountRepository {
  save(account: Account): Promise<void>;
  saveMany(accounts: Account[]): Promise<void>;
  
  // ← Agregar nuevos métodos aquí
  findByStatus(status: string): Promise<Account[]>;
  findByClassType(classType: string): Promise<Account[]>;
  findCreatedAfter(date: Date): Promise<Account[]>;
  updateStatus(id: string, status: string): Promise<void>;
}

// En /infrastructure/repositories/account.repository.ts
async findByStatus(status: string): Promise<Account[]> {
  const entities = await this.accountRepository.find({ 
    where: { status } 
  });
  return entities.map(entity => this.toDomain(entity));
}
```

### Agregar Validaciones de Negocio

```typescript
// En /domain/entities/account.entity.ts
static create(
  externalId: string,
  accountString: string,
  // ... otros params
): Account {
  // ← Agregar validaciones aquí
  if (!externalId || externalId.length < 10) {
    throw new Error('Invalid external ID');
  }
  
  if (!accountString.includes(':')) {
    throw new Error('Invalid account string format');
  }
  
  return new Account(/* ... */);
}
```

### Monitoreo y Métricas Customizadas

```typescript
// En el handler de cualquier paso
handler: async (data: ImportAccountsData) => {
  const startTime = Date.now();
  
  try {
    // Tu lógica aquí
    const result = await processData(data);
    
    // Métrica de éxito
    console.log(`✅ [CustomStep] Procesado en ${Date.now() - startTime}ms`);
    
    return result;
  } catch (error) {
    // Métrica de error
    console.error(`❌ [CustomStep] Error después de ${Date.now() - startTime}ms:`, error);
    throw error;
  }
}
```

**Reglas importantes para extensiones:**
- ✅ Mantener separación de capas (Domain/Infrastructure)
- ✅ Usar interfaces para nuevas dependencias
- ✅ Agregar logs descriptivos para debugging
- ✅ Manejar errores apropiadamente
- ✅ Testear nuevos pasos independientemente