# 📱 Import Accounts Workflow - Documentación Técnica

## 🎯 Descripción

Workflow orquestado para importar cuentas de Tinder desde API externa (Flamebot) siguiendo **Clean Architecture**. Implementa un proceso robusto de 4 pasos con manejo de errores, polling inteligente y persistencia automática.

**Funcionalidades principales:**
- ✅ Importación masiva de cuentas con validación
- ✅ Polling automático con timeout y reintentos
- ✅ Manejo de estados COMPLETED/FAILED con terminación limpia
- ✅ Persistencia en PostgreSQL siguiendo Domain-Driven Design
- ✅ Logs detallados para debugging y monitoreo
- ✅ Arquitectura extensible para nuevos pasos/APIs

## 🏗️ Arquitectura Clean - REFACTORIZADA

El workflow ahora respeta **100% los principios de Clean Architecture**:

```
src/
├── domain/                                    # ✅ CAPA PURA (sin frameworks)
│   ├── entities/
│   │   ├── account.entity.ts                 # Entidad pura sin decoradores
│   │   └── workflow-execution.ts             # Entidad pura sin TypeORM
│   ├── interfaces/
│   │   ├── account.repository.interface.ts   # Interface sin implementación
│   │   ├── workflow-execution.repository.ts  # Interface del repositorio
│   │   ├── http-client.interface.ts          # Abstracción HTTP
│   │   └── tinder-api.interface.ts           # Abstracción API Tinder
│   └── workflows/
│       └── import-accounts-workflow.ts       # Lógica pura (NO hace HTTP)
│
├── infrastructure/                            # ✅ IMPLEMENTACIONES CONCRETAS
│   ├── entities/
│   │   ├── account.entity.ts                 # Con decoradores TypeORM
│   │   └── workflow-execution.entity.ts      # Con decoradores TypeORM
│   ├── mappers/
│   │   └── workflow-execution.mapper.ts      # Convierte dominio ↔ persistencia
│   ├── repositories/
│   │   ├── account.repository.ts             # Implementación con TypeORM
│   │   └── workflow-execution.repository.ts  # Implementación del repo
│   └── services/
│       ├── http-client.service.ts            # Cliente HTTP real
│       ├── tinder-api.service.ts             # Llamadas API reales
│       ├── redis-connection.service.ts       # Pool de conexiones Redis
│       ├── metrics.service.ts                # Sistema de métricas
│       └── queue-manager.service.ts          # Gestión de colas BullMQ
│
└── application/                               # ✅ CASOS DE USO
    └── services/
        └── workflow.service.ts               # Orquestación (usa interfaces)
```

### 🔄 Cambios Importantes en la Refactorización:

1. **Workflow NO hace HTTP directamente**:
   ```typescript
   // ❌ ANTES (violación)
   const response = await fetch('https://api.flamebot-tin.com/...');
   
   // ✅ AHORA (correcto)
   const response = await tinderApiService.importAccounts(accounts, token);
   ```

2. **Inyección de Dependencias**:
   ```typescript
   // El workflow ahora recibe servicios inyectados
   export function createImportAccountsWorkflow(
     tinderApiService: ITinderApiService,  // Interface, no implementación
     accountRepository: IAccountRepository, // Interface del dominio
     logger: ILogger
   ): WorkflowDefinition
   ```

3. **Entidades Separadas**:
   - `domain/entities/workflow-execution.ts` - Sin decoradores, pura
   - `infrastructure/entities/workflow-execution.entity.ts` - Con TypeORM
   - Mapper convierte entre ambas

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
  "success": true,
  "instanceId": "abc123-def456-...",
  "message": "Workflow iniciado exitosamente"
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
- `cancelled`: Cancelado
- `stopped`: Detenido

### 3. Ver Historial

```bash
curl http://localhost:3000/api/v1/workflows/executions
```

## 📊 Flujo del Workflow (4 Pasos)

### Paso 1: `import-accounts` 
```typescript
// Usa TinderApiService inyectado (NO hace fetch directamente)
handler: async (data: ImportAccountsData) => {
  const response = await tinderApiService.importAccounts(
    data.accounts,
    data.apiToken
  );
  return { ...data, taskId: response.task_id, _workflowActive: true };
}
```
- **Timeout**: 60s | **Output**: `task_id` | **Next**: `poll-status`

### Paso 2: `poll-status` (⚡ Lógica Inteligente)
```typescript
handler: async (data: ImportAccountsData) => {
  const statusResponse = await tinderApiService.getTaskStatus(
    data.taskId,
    data.apiToken
  );
  
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

### Paso 3: `fetch-account-details`
```typescript
handler: async (data: ImportAccountsData) => {
  const detailsResponse = await tinderApiService.getAccountsByIds(
    data.successful_ids,
    data.apiToken
  );
  const importedAccounts = detailsResponse.accounts.map(mapToAccount);
  return { ...data, importedAccounts, _nextStep: 'save-accounts' };
}
```
- **Input**: `successful_ids[]` | **Output**: Accounts con detalles completos

### Paso 4: `save-accounts` (🗄️ Persistencia)
```typescript
handler: async (data: ImportAccountsData) => {
  // Crear entidades de dominio puras
  const domainAccounts = accountsToSave.map(Account.create);
  
  // Usar repositorio inyectado (interface)
  await accountRepository.saveMany(domainAccounts);
  
  return { ...data, _workflowActive: false, _workflowCompleted: true };
}
```
- **Acción**: Domain entities → Mapper → TypeORM persistence
- **Output**: Summary con estadísticas

## 🏛️ Arquitectura de Capas

### Domain Layer (Pura)
```typescript
// domain/entities/workflow-execution.ts
export class WorkflowExecution {
  private constructor(
    private readonly _id: WorkflowExecutionId,  // Value Object
    private _status: WorkflowExecutionStatus,   // Enum
    // ... sin decoradores TypeORM
  ) {}
  
  // Métodos de negocio
  start(): void { /* lógica pura */ }
  complete(data: any): void { /* lógica pura */ }
}
```

### Infrastructure Layer
```typescript
// infrastructure/entities/workflow-execution.entity.ts
@Entity('workflow_executions')  // ✅ TypeORM aquí está bien
export class WorkflowExecutionEntity {
  @PrimaryColumn('uuid')
  id!: string;
  // ...
}

// infrastructure/mappers/workflow-execution.mapper.ts
export class WorkflowExecutionMapper {
  static toDomain(entity: WorkflowExecutionEntity): WorkflowExecution {
    return WorkflowExecution.reconstitute({...});
  }
  
  static toPersistence(domain: WorkflowExecution): WorkflowExecutionEntity {
    return new WorkflowExecutionEntity({...});
  }
}
```

### Application Layer
```typescript
// application/services/workflow.service.ts
constructor(
  @Inject('IWorkflowExecutionRepository')  // Interface, no implementación
  private readonly workflowRepo: IWorkflowExecutionRepository
) {}
```

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

- **Token API**: Validado al inicio del workflow
- **Validación**: DTOs con class-validator
- **Timeouts**: Protección contra procesos colgados (configurable por paso)
- **Reintentos**: 3 intentos con backoff exponencial
- **Circuit Breaker**: Para llamadas externas (próximamente)

## 🛠️ Configuración

### Variables de Entorno
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/flamebot
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
NODE_ENV=development
```

### Base de Datos (PostgreSQL)
```sql
-- Tabla generada automáticamente por TypeORM desde infrastructure/entities
CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    external_id VARCHAR UNIQUE NOT NULL,
    account_string TEXT NOT NULL,
    account_origin VARCHAR NOT NULL,
    class_type VARCHAR NOT NULL,
    class_color VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    age INTEGER,
    phone VARCHAR,
    email VARCHAR,
    account_tag VARCHAR,
    image VARCHAR,
    location VARCHAR,
    is_verified BOOLEAN DEFAULT FALSE,
    proxy_https VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY,
    workflow_id VARCHAR NOT NULL,
    job_id VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    input_data JSONB,
    output_data JSONB,
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
```

## 🧪 Testing

### Unit Tests (Domain)
```typescript
// domain/entities/account.entity.spec.ts
describe('Account Entity', () => {
  it('should create account with valid data', () => {
    const account = Account.create(
      'ext-123',
      'account:string',
      'ios',
      { classType: 'Iris', classColor: '#fff' },
      { name: 'Test' },
      { https: 'proxy' },
      'alive'
    );
    expect(account.isActive()).toBe(true);
  });
});
```

### Integration Tests
```bash
# Ejecutar tests
pnpm test

# Coverage
pnpm test:cov
```

### E2E Test
```bash
# Script de prueba completo
npx ts-node scripts/test-import-workflow.ts
```

## 🚨 Troubleshooting

### Error: "API token is required"
- El token debe proporcionarse en `data.apiToken`

### Error: "Polling timeout - task did not complete in time"
- El proceso tomó más de 10 minutos
- Verificar el estado del task en la API externa

### Error: "No successful accounts to process"
- No hubo cuentas exitosas en la importación
- Revisar los datos de entrada y logs de la API

### Error de TypeORM
- Ejecutar migración: `pnpm run migrate`
- Verificar conexión a PostgreSQL

## 📝 Notas Importantes

1. **Clean Architecture**: 
   - Domain NO conoce infrastructure
   - Workflow usa interfaces, no implementaciones
   - Mappers convierten entre capas

2. **Límites**: 
   - Máximo tiempo de polling: 10 minutos
   - Intervalo de polling: 4 segundos
   - Timeout por paso configurable

3. **Persistencia**: 
   - Entidades de dominio → Mapper → Entidades TypeORM
   - Transacciones automáticas
   - Soft deletes disponibles

4. **Monitoreo**: 
   - BullBoard para ver colas: http://localhost:3000/admin/queues
   - Métricas en: http://localhost:3000/api/v1/workflows/capacity

## 🚀 Extensibilidad para Desarrolladores

### Agregar Nuevos Pasos al Workflow

```typescript
// En domain/workflows/import-accounts-workflow.ts
// Dentro de createImportAccountsWorkflow()

const customStep: WorkflowStep = {
  name: 'Custom Processing',
  timeout: 30000,
  handler: async (data: ImportAccountsData) => {
    logger.log('🔧 [CustomStep] Procesando...');
    
    // Usar servicios inyectados
    const result = await someService.process(data);
    
    return {
      ...data,
      customResult: result,
      _workflowActive: true,
      _nextStep: 'save-accounts'
    };
  },
  nextStep: 'save-accounts'
};

// Agregar al Map
steps: new Map([
  // ... otros pasos
  ['custom-step', customStep],
])
```

### Agregar Nueva API Externa

```typescript
// 1. Crear interface en domain/interfaces/
export interface ICustomApiService {
  fetchData(id: string): Promise<CustomData>;
}

// 2. Implementar en infrastructure/services/
@Injectable()
export class CustomApiService implements ICustomApiService {
  constructor(private httpClient: HttpClientService) {}
  
  async fetchData(id: string): Promise<CustomData> {
    return this.httpClient.get(`https://api.custom.com/data/${id}`);
  }
}

// 3. Inyectar en workflow
export function createImportAccountsWorkflow(
  tinderApiService: ITinderApiService,
  customApiService: ICustomApiService, // ← Nueva dependencia
  // ...
)
```

### Extender Repositorio

```typescript
// domain/interfaces/account.repository.interface.ts
export interface IAccountRepository {
  // ... métodos existentes
  
  // Agregar nuevos métodos
  findByStatus(status: string): Promise<Account[]>;
  updateStatus(id: string, status: string): Promise<void>;
  softDelete(id: string): Promise<void>;
}

// infrastructure/repositories/account.repository.ts
async findByStatus(status: string): Promise<Account[]> {
  const entities = await this.repository.find({ where: { status } });
  return AccountMapper.toDomainMany(entities);
}
```

### Testing con Mocks

```typescript
// test/workflows/import-accounts.spec.ts
describe('Import Accounts Workflow', () => {
  let workflow: WorkflowDefinition;
  let mockTinderApi: MockType<ITinderApiService>;
  let mockAccountRepo: MockType<IAccountRepository>;
  
  beforeEach(() => {
    mockTinderApi = createMock<ITinderApiService>();
    mockAccountRepo = createMock<IAccountRepository>();
    
    workflow = createImportAccountsWorkflow(
      mockTinderApi,
      mockAccountRepo,
      console
    );
  });
  
  it('should handle successful import', async () => {
    mockTinderApi.importAccounts.mockResolvedValue({ task_id: '123' });
    mockTinderApi.getTaskStatus.mockResolvedValue({ 
      status: 'COMPLETED',
      successful: 2 
    });
    
    // Test workflow execution
  });
});
```

## 📚 Referencias

- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [TypeORM Documentation](https://typeorm.io/)

---

**Última actualización**: Arquitectura refactorizada para cumplir 100% con Clean Architecture
**Versión**: 2.0.0
**Mantenedor**: Equipo de Arquitectura