# Workflow Engine - Clean Architecture Documentation

## 📋 Tabla de Contenidos
- [Arquitectura](#arquitectura)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Guía de Desarrollo](#guía-de-desarrollo)
- [Testing](#testing)
- [Debugging](#debugging)
- [Ejemplos Prácticos](#ejemplos-prácticos)

## 🏗️ Arquitectura

Este proyecto implementa **Clean Architecture** con las siguientes capas:

### 1. Domain Layer (Núcleo)
- **Entidades**: Lógica de negocio pura
- **Interfaces**: Contratos para servicios externos
- **Workflows**: Definiciones de flujos de trabajo
- **NO DEPENDE** de frameworks externos (NestJS, TypeORM, etc.)

### 2. Application Layer
- **Use Cases**: Orquestación de la lógica de negocio
- **DTOs**: Objetos de transferencia de datos
- **Commands/Queries**: Patrones CQRS
- Depende SOLO del Domain Layer

### 3. Infrastructure Layer
- **Implementaciones concretas** de las interfaces del dominio
- **Repositorios**: Acceso a base de datos
- **Servicios externos**: APIs, Redis, BullMQ
- Depende del Domain y Application

### 4. Presentation Layer
- **Controllers**: Endpoints HTTP
- **DTOs de entrada**: Validación de requests
- Depende de Application Layer

## 📁 Estructura del Proyecto

```
src/
├── domain/                    # ❤️ Núcleo del negocio (puro)
│   ├── entities/             # Entidades del dominio
│   ├── interfaces/           # Contratos/puertos
│   └── workflows/            # Definiciones de workflows
│
├── application/              # 🧠 Lógica de aplicación
│   ├── use-cases/           # Casos de uso
│   ├── dto/                 # DTOs de aplicación
│   └── commands/            # Comandos CQRS
│
├── infrastructure/          # 🔧 Implementaciones técnicas
│   ├── repositories/        # Acceso a datos
│   ├── services/           # Servicios externos
│   └── entities/           # Entidades de BD
│
└── presentation/           # 🌐 Capa de presentación
    └── controllers/        # Endpoints REST
```

## 👨‍💻 Guía de Desarrollo

### 1. Agregar un Nuevo Servicio Externo

**Ejemplo: Agregar servicio de Swipe Task al workflow de importación**

#### Paso 1: Definir la Interface en Domain

```typescript
// src/domain/interfaces/swipe-task.interface.ts

export interface SwipeTaskRequest {
  account_ids: string[];
  task_name: string;
}

export interface SwipeTaskResponse {
  task_id: string;
  status: string;
  message: string;
}

export interface ISwipeTaskService {
  startSwipeTask(request: SwipeTaskRequest, apiToken: string): Promise<SwipeTaskResponse>;
  getTaskStatus(taskId: string, apiToken: string): Promise<SwipeTaskResponse>;
}
```

#### Paso 2: Implementar el Servicio en Infrastructure

```typescript
// src/infrastructure/services/swipe-task.service.ts

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ISwipeTaskService, SwipeTaskRequest, SwipeTaskResponse } from '../../domain/interfaces/swipe-task.interface';
import { IHttpClient } from '../../domain/interfaces/http-client.interface';

@Injectable()
export class SwipeTaskService implements ISwipeTaskService {
  private readonly logger = new Logger(SwipeTaskService.name);
  private readonly baseUrl = 'https://api.flamebot-tin.com/api';

  constructor(
    @Inject('IHttpClient')
    private readonly httpClient: IHttpClient,
  ) {}

  async startSwipeTask(request: SwipeTaskRequest, apiToken: string): Promise<SwipeTaskResponse> {
    try {
      const response = await this.httpClient.post(
        `${this.baseUrl}/tasks/swipe/start`,
        request,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        task_id: response.data.task_id,
        status: response.data.status || 'started',
        message: response.data.message || 'Swipe task started',
      };
    } catch (error) {
      this.logger.error('Error starting swipe task:', error);
      throw error;
    }
  }

  async getTaskStatus(taskId: string, apiToken: string): Promise<SwipeTaskResponse> {
    try {
      const response = await this.httpClient.get(
        `${this.baseUrl}/tasks/swipe/status/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error('Error getting task status:', error);
      throw error;
    }
  }
}
```

#### Paso 3: Crear Use Case

```typescript
// src/application/use-cases/swipe-task/start-swipe-task.use-case.ts

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ISwipeTaskService } from '../../../domain/interfaces/swipe-task.interface';

export interface StartSwipeTaskCommand {
  accountIds: string[];
  taskName?: string;
  apiToken: string;
}

@Injectable()
export class StartSwipeTaskUseCase {
  private readonly logger = new Logger(StartSwipeTaskUseCase.name);

  constructor(
    @Inject('ISwipeTaskService')
    private readonly swipeTaskService: ISwipeTaskService,
  ) {}

  async execute(command: StartSwipeTaskCommand): Promise<any> {
    const taskName = command.taskName || `Swipe Task ${new Date().toLocaleString()}`;
    
    this.logger.log(`Starting swipe task for ${command.accountIds.length} accounts`);

    const response = await this.swipeTaskService.startSwipeTask(
      {
        account_ids: command.accountIds,
        task_name: taskName,
      },
      command.apiToken,
    );

    return {
      success: true,
      taskId: response.task_id,
      status: response.status,
      message: response.message,
    };
  }
}
```

#### Paso 4: Modificar el Workflow para incluir el nuevo paso

```typescript
// src/domain/workflows/import-accounts-workflow.ts
// Agregar después del paso save-to-database

const startSwipeTaskStep: WorkflowStep = {
  name: 'Start Swipe Task',
  timeout: 30000,
  handler: async (context) => {
    // Check if we have successful accounts to swipe
    if (!context.data.successful_ids || context.data.successful_ids.length === 0) {
      context.logger.log('No accounts to swipe', 'ImportWorkflow');
      return {
        ...context.data,
        swipeTaskSkipped: true,
        _workflowCompleted: true,
      };
    }

    context.logger.log(
      `Starting swipe task for ${context.data.successful_ids.length} accounts`,
      'ImportWorkflow'
    );

    return {
      ...context.data,
      _needsSwipeTask: true,
      swipeTaskPending: true,
      _workflowActive: true,
    };
  },
  nextStep: 'complete-workflow',
};

// Modificar save-to-database para que apunte al nuevo paso
const saveToDatabaseStep: WorkflowStep = {
  // ... existing code ...
  nextStep: 'start-swipe-task', // Cambiar de undefined a 'start-swipe-task'
};

// Agregar paso final
const completeWorkflowStep: WorkflowStep = {
  name: 'Complete Workflow',
  handler: async (context) => {
    context.logger.log('Workflow completed successfully', 'ImportWorkflow');
    
    return {
      ...context.data,
      status: 'completed',
      completedAt: new Date(),
      _workflowActive: false,
      _workflowCompleted: true,
    };
  },
};

// Actualizar el Map de steps
steps: new Map([
  ['start-import', startImportStep],
  ['call-import-api', callImportApiStep],
  ['wait-for-processing', waitForProcessingStep],
  ['check-import-status', checkImportStatusStep],
  ['process-results', processResultsStep],
  ['save-to-database', saveToDatabaseStep],
  ['start-swipe-task', startSwipeTaskStep],
  ['complete-workflow', completeWorkflowStep],
]),
```

#### Paso 5: Integrar el Use Case en el Worker

```typescript
// src/infrastructure/services/workflow-worker.service.ts
// En el método processJob, agregar lógica para manejar _needsSwipeTask

if (result._needsSwipeTask && execution) {
  // Inject StartSwipeTaskUseCase and execute it
  const swipeResult = await this.startSwipeTaskUseCase.execute({
    accountIds: result.successful_ids,
    apiToken: result.apiToken,
    taskName: `Import Follow-up ${new Date().toISOString()}`,
  });
  
  result.swipeTaskId = swipeResult.taskId;
  result.swipeTaskStatus = swipeResult.status;
}
```

#### Paso 6: Registrar en el Módulo

```typescript
// src/workflow.module.ts

import { SwipeTaskService } from './infrastructure/services/swipe-task.service';
import { StartSwipeTaskUseCase } from './application/use-cases/swipe-task/start-swipe-task.use-case';

@Module({
  // ... existing configuration ...
  providers: [
    // ... existing providers ...
    
    // New service
    SwipeTaskService,
    StartSwipeTaskUseCase,
    
    // Interface binding
    {
      provide: 'ISwipeTaskService',
      useClass: SwipeTaskService,
    },
  ],
})
```

### 2. Principios de Clean Architecture a Seguir

#### ✅ DO's (Hacer)
1. **Inyección de Dependencias**: Siempre usar interfaces
2. **Flujo de Dependencias**: Infrastructure → Application → Domain
3. **Lógica de Negocio**: En Use Cases, no en controllers
4. **Workflows Puros**: Solo definiciones, sin lógica de infraestructura
5. **Testing**: Mockear interfaces, no implementaciones

#### ❌ DON'Ts (No Hacer)
1. **No importar** frameworks en Domain Layer
2. **No acceder** a BD directamente desde Application
3. **No mezclar** lógica de negocio con infraestructura
4. **No usar** implementaciones concretas en constructores (usar interfaces)
5. **No violar** el flujo de dependencias

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests con coverage
npm run test:cov

# Tests en modo watch
npm run test:watch

# Tests e2e
npm run test:e2e

# Test específico
npm test -- --testPathPattern=workflow-execution.spec
```

### Estructura de Tests

```typescript
// Ejemplo de test para Use Case
describe('StartSwipeTaskUseCase', () => {
  let useCase: StartSwipeTaskUseCase;
  let swipeTaskService: jest.Mocked<ISwipeTaskService>;

  beforeEach(async () => {
    // Mock de la interface, no de la implementación
    const mockSwipeTaskService = {
      startSwipeTask: jest.fn(),
      getTaskStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartSwipeTaskUseCase,
        {
          provide: 'ISwipeTaskService',
          useValue: mockSwipeTaskService,
        },
      ],
    }).compile();

    useCase = module.get<StartSwipeTaskUseCase>(StartSwipeTaskUseCase);
    swipeTaskService = module.get('ISwipeTaskService');
  });

  it('should start swipe task successfully', async () => {
    // Arrange
    const command = {
      accountIds: ['acc1', 'acc2'],
      apiToken: 'token-123',
    };
    
    swipeTaskService.startSwipeTask.mockResolvedValue({
      task_id: 'task-123',
      status: 'started',
      message: 'Task started',
    });

    // Act
    const result = await useCase.execute(command);

    // Assert
    expect(result.success).toBe(true);
    expect(result.taskId).toBe('task-123');
    expect(swipeTaskService.startSwipeTask).toHaveBeenCalledWith(
      {
        account_ids: command.accountIds,
        task_name: expect.any(String),
      },
      command.apiToken,
    );
  });
});
```

### Qué Testear

1. **Domain Entities**: Lógica de negocio, invariantes
2. **Use Cases**: Flujo de orquestación, manejo de errores
3. **Services**: Transformación de datos, llamadas externas (con mocks)
4. **Mappers**: Conversión correcta entre capas

## 🐛 Debugging

### Configuración de Logs

```env
# .env
LOG_LEVEL=debug        # verbose | debug | info | warn | error
LOG_SQL=true          # Ver queries SQL
LOG_SQL_ERROR_ONLY=false  # Solo errores SQL
```

### Errores Comunes y Soluciones

#### Error: "Failed to create queue"
```typescript
// Problema: Conexión Redis duplicada o no disponible
// Solución: Verificar que Redis esté corriendo
docker-compose up redis

// O verificar configuración
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### Error: "Cannot find module"
```bash
# Limpiar y reinstalar
rm -rf node_modules dist
npm install
npm run build
```

#### Error: "Interface not bound"
```typescript
// Asegurarse de registrar en el módulo:
{
  provide: 'IYourInterface',
  useClass: YourImplementation,
}
```

### Debug con VS Code

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeArgs": [
        "-r",
        "ts-node/register",
        "-r",
        "tsconfig-paths/register"
      ],
      "args": ["src/main.ts"],
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      },
      "sourceMaps": true,
      "cwd": "${workspaceRoot}",
      "protocol": "inspector"
    }
  ]
}
```

## 📚 Ejemplos Prácticos

### Ejemplo 1: Workflow Condicional

```typescript
const conditionalStep: WorkflowStep = {
  name: 'Conditional Step',
  handler: async (context) => {
    if (context.data.accounts.length > 100) {
      // Ruta para muchas cuentas
      return {
        ...context.data,
        _nextStep: 'batch-processing',
      };
    } else {
      // Ruta normal
      return {
        ...context.data,
        _nextStep: 'normal-processing',
      };
    }
  },
};
```

### Ejemplo 2: Manejo de Errores y Reintentos

```typescript
const retryableStep: WorkflowStep = {
  name: 'Retryable Step',
  handler: async (context) => {
    const attempt = context.data.attemptCount || 0;
    
    try {
      // Operación que puede fallar
      const result = await riskyOperation();
      return {
        ...context.data,
        result,
        attemptCount: 0, // Reset counter on success
      };
    } catch (error) {
      if (attempt < 3) {
        // Reintentar
        return {
          ...context.data,
          attemptCount: attempt + 1,
          _nextStep: 'retryable-step', // Loop back to itself
        };
      }
      // Fallar después de 3 intentos
      throw error;
    }
  },
};
```

### Ejemplo 3: Integración con Servicios Externos

```typescript
// Use Case con múltiples servicios
export class ComplexWorkflowUseCase {
  constructor(
    @Inject('IAccountRepository')
    private readonly accountRepo: IAccountRepository,
    @Inject('ITinderApiService')
    private readonly tinderApi: ITinderApiService,
    @Inject('ISwipeTaskService')
    private readonly swipeTask: ISwipeTaskService,
    @Inject('INotificationService')
    private readonly notifications: INotificationService,
  ) {}

  async execute(command: ComplexCommand): Promise<Result> {
    // 1. Obtener cuentas
    const accounts = await this.accountRepo.findByStatus('active');
    
    // 2. Procesar con API externa
    const imported = await this.tinderApi.importAccounts(
      accounts.map(a => a.toPlainObject()),
      command.apiToken,
    );
    
    // 3. Iniciar tarea de swipe
    const swipeResult = await this.swipeTask.startSwipeTask({
      account_ids: imported.successful_ids,
      task_name: 'Auto Swipe',
    }, command.apiToken);
    
    // 4. Notificar
    await this.notifications.send({
      type: 'workflow_completed',
      data: { 
        accounts: accounts.length,
        taskId: swipeResult.task_id,
      },
    });
    
    return {
      success: true,
      processedAccounts: accounts.length,
      swipeTaskId: swipeResult.task_id,
    };
  }
}
```

## 🚀 Deployment

### Build para Producción

```bash
# Build
npm run build

# Ejecutar en producción
NODE_ENV=production node dist/main.js
```

### Variables de Entorno Requeridas

```env
# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=workflow_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional

# API
TINDER_API_BASE_URL=https://api.flamebot-tin.com/api
PORT=3001

# Logging
LOG_LEVEL=info
LOG_SQL=false
```

## 📝 Checklist para Nuevas Funcionalidades

- [ ] Definir interface en `domain/interfaces/`
- [ ] Implementar servicio en `infrastructure/services/`
- [ ] Crear Use Case en `application/use-cases/`
- [ ] Agregar tests unitarios
- [ ] Registrar en módulo con binding de interface
- [ ] Actualizar workflow si es necesario
- [ ] Documentar cambios
- [ ] Verificar que no se violan principios de Clean Architecture

## 🤝 Contribuir

1. Seguir Clean Architecture estrictamente
2. Escribir tests para todo código nuevo
3. Documentar interfaces y use cases
4. No mezclar capas
5. Usar inyección de dependencias siempre

## 📞 Soporte

Para dudas sobre la arquitectura:
1. Revisar esta documentación
2. Ver ejemplos en el código existente
3. Seguir los principios SOLID
4. Mantener las capas separadas

## 🔍 Troubleshooting Adicional

### Redis Connection Issues

Si ves errores de duplicación de colas o fallos al crear queues:

1. **Verificar Redis está corriendo:**
```bash
redis-cli ping
# Debe responder: PONG
```

2. **Verificar configuración de Redis:**
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Dejar vacío si no hay password
```

3. **Limpiar Redis si es necesario:**
```bash
redis-cli FLUSHALL
```

### Database Connection Issues

1. **Verificar PostgreSQL está corriendo:**
```bash
psql -U postgres -c "SELECT 1"
```

2. **Crear base de datos si no existe:**
```sql
CREATE DATABASE workflow_db;
```

3. **Ejecutar migraciones:**
```bash
npm run migration:run
```

### Performance Issues

1. **Monitorear memoria:**
```bash
# Ver métricas del sistema
curl http://localhost:3001/api/workflow/capacity
```

2. **Ajustar configuración de workers:**
```typescript
// src/infrastructure/workflow-engine.service.ts
const WORKFLOW_CONFIG = {
  WORKER_CONCURRENCY: 50,  // Reducir si hay problemas de memoria
  MAX_WORKERS_PER_WORKFLOW: 3,  // Reducir para menos paralelismo
};
```

3. **Habilitar garbage collection:**
```bash
node --expose-gc dist/main.js
```
