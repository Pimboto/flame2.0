# 🔥 FlameBot 2.0 - Arquitectura y Guía de Desarrollo

## 📋 Tabla de Contenidos

1. [Arquitectura Clean](#arquitectura-clean)
2. [Estructura del Proyecto](#estructura-del-proyecto)
3. [Capas de la Arquitectura](#capas-de-la-arquitectura)
4. [Flujo de Datos](#flujo-de-datos)
5. [Patrones y Principios](#patrones-y-principios)
6. [Guía de Desarrollo](#guía-de-desarrollo)
7. [Mejores Prácticas OBLIGATORIAS](#mejores-prácticas-obligatorias)
8. [Ejemplos Prácticos](#ejemplos-prácticos)
9. [Testing](#testing)
10. [Workflows](#workflows)

---

## 🏗️ Arquitectura Clean

Este proyecto implementa **Clean Architecture** (Arquitectura Limpia) con las siguientes características:

- **Independencia de Frameworks**: La lógica de negocio no depende de NestJS
- **Testabilidad**: Cada capa se puede probar de forma aislada
- **Independencia de UI**: La lógica no sabe cómo se presenta
- **Independencia de Base de Datos**: Puedes cambiar de PostgreSQL a MongoDB sin tocar el dominio
- **Independencia de Agentes Externos**: El core no depende de APIs externas

### Principios Fundamentales

1. **Dependency Rule**: Las dependencias apuntan hacia adentro
2. **Entities**: Lógica de negocio pura
3. **Use Cases**: Casos de uso específicos de la aplicación
4. **Interface Adapters**: Convierten datos entre capas
5. **Frameworks & Drivers**: Detalles externos (DB, Web, etc.)

---

## 📁 Estructura del Proyecto

```
src/
├── domain/                    # 🧠 Núcleo del negocio (Capa más interna)
│   ├── entities/             # Entidades de negocio
│   ├── value-objects/        # Objetos de valor
│   ├── interfaces/           # Contratos/Interfaces
│   └── workflows/            # Definiciones de workflows
│
├── application/              # 💼 Casos de uso y lógica de aplicación
│   ├── services/            # Servicios de aplicación
│   ├── dto/                 # Data Transfer Objects
│   ├── mappers/             # Mapeadores DTO <-> Entity
│   └── ports/               # Puertos (interfaces) para infra
│
├── infrastructure/          # 🔧 Implementaciones concretas
│   ├── repositories/        # Implementación de repositorios
│   ├── workflow-engine.service.ts
│   └── persistence/         # Configuración de DB
│
├── interfaces/              # 🌐 Puntos de entrada (Controllers, etc.)
│   ├── http/               # Controllers REST
│   ├── grpc/               # Controllers gRPC (futuro)
│   └── graphql/            # Resolvers GraphQL (futuro)
│
└── common/                  # 🛠️ Utilidades compartidas
    ├── exceptions/         # Excepciones personalizadas
    ├── decorators/         # Decoradores
    ├── filters/            # Filtros de excepción
    └── services/           # Servicios transversales (Logger, Config)
```

---

## 🎯 Capas de la Arquitectura

### 1. Domain Layer (Dominio)

**Responsabilidad**: Lógica de negocio pura

```typescript
// ❌ NUNCA hacer esto en Domain
import { Injectable } from '@nestjs/common'; // NO importar nada de NestJS
import { Repository } from 'typeorm'; // NO importar nada de infraestructura

// ✅ CORRECTO - Entity pura
export class WorkflowExecution {
  constructor(
    public readonly id: string,
    public readonly workflowId: string,
    public readonly status: WorkflowStatus,
    private _data: any
  ) {}

  // Métodos de negocio
  canTransitionTo(newStatus: WorkflowStatus): boolean {
    // Lógica de negocio pura
    return this.status.canTransitionTo(newStatus);
  }

  updateData(data: any): void {
    if (!this.isActive()) {
      throw new WorkflowNotActiveError();
    }
    this._data = { ...this._data, ...data };
  }
}
```

### 2. Application Layer (Aplicación)

**Responsabilidad**: Orquestación de casos de uso

```typescript
// application/services/workflow.service.ts
export class WorkflowApplicationService {
  constructor(
    private readonly workflowRepo: IWorkflowRepository, // Interface, no implementación
    private readonly eventBus: IEventBus,
    private readonly logger: ILogger
  ) {}

  async executeWorkflow(command: ExecuteWorkflowCommand): Promise<WorkflowExecutionDto> {
    // 1. Validar comando
    await this.validateCommand(command);
    
    // 2. Ejecutar lógica de dominio
    const workflow = await this.workflowRepo.findById(command.workflowId);
    const execution = workflow.createExecution(command.data);
    
    // 3. Persistir cambios
    await this.workflowRepo.saveExecution(execution);
    
    // 4. Publicar eventos
    await this.eventBus.publish(new WorkflowStartedEvent(execution));
    
    // 5. Retornar DTO
    return WorkflowExecutionMapper.toDto(execution);
  }
}
```

### 3. Infrastructure Layer (Infraestructura)

**Responsabilidad**: Implementaciones concretas

```typescript
// infrastructure/repositories/workflow-execution.repository.ts
@Injectable()
export class WorkflowExecutionRepositoryImpl implements IWorkflowExecutionRepository {
  constructor(
    @InjectRepository(WorkflowExecutionEntity)
    private readonly typeOrmRepo: Repository<WorkflowExecutionEntity>
  ) {}

  async findById(id: string): Promise<WorkflowExecution | null> {
    const entity = await this.typeOrmRepo.findOne({ where: { id } });
    return entity ? WorkflowExecutionMapper.toDomain(entity) : null;
  }

  async save(execution: WorkflowExecution): Promise<void> {
    const entity = WorkflowExecutionMapper.toPersistence(execution);
    await this.typeOrmRepo.save(entity);
  }
}
```

### 4. Interface Layer (Interfaces)

**Responsabilidad**: Adaptadores de entrada

```typescript
// interfaces/http/workflow.controller.ts
@Controller('workflows')
@ApiTags('workflows')
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowApplicationService
  ) {}

  @Post('execute')
  @UseGuards(AuthGuard)
  @UseInterceptors(LoggingInterceptor)
  async execute(@Body() dto: ExecuteWorkflowDto): Promise<ApiResponse<WorkflowExecutionDto>> {
    try {
      const command = new ExecuteWorkflowCommand(dto.workflowId, dto.data);
      const result = await this.workflowService.executeWorkflow(command);
      
      return {
        success: true,
        data: result,
        timestamp: new Date()
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
```

---

## 🔄 Flujo de Datos

```
[HTTP Request] → [Controller] → [Application Service] → [Domain] → [Repository] → [Database]
                      ↓              ↓                      ↓           ↓
                    [DTO]       [Command/Query]        [Entity]    [Interface]
```

### Ejemplo de Flujo Completo:

1. **Request**: `POST /api/v1/workflows/execute`
2. **Controller**: Valida y convierte a DTO
3. **Application Service**: Orquesta el caso de uso
4. **Domain**: Ejecuta lógica de negocio
5. **Repository**: Persiste cambios
6. **Response**: Retorna DTO al cliente

---

## 🎨 Patrones y Principios

### SOLID Principles

#### 1. Single Responsibility Principle (SRP)
```typescript
// ✅ CORRECTO - Una responsabilidad
export class WorkflowValidator {
  validate(workflow: Workflow): ValidationResult {
    // Solo validación
  }
}

// ❌ INCORRECTO - Múltiples responsabilidades
export class WorkflowService {
  validate() { } // Validación
  save() { }     // Persistencia
  notify() { }   // Notificación
}
```

#### 2. Open/Closed Principle (OCP)
```typescript
// ✅ CORRECTO - Abierto para extensión, cerrado para modificación
interface WorkflowStep {
  execute(context: WorkflowContext): Promise<StepResult>;
}

class EmailStep implements WorkflowStep {
  async execute(context: WorkflowContext): Promise<StepResult> {
    // Implementación específica
  }
}

class HttpStep implements WorkflowStep {
  async execute(context: WorkflowContext): Promise<StepResult> {
    // Implementación específica
  }
}
```

#### 3. Liskov Substitution Principle (LSP)
```typescript
// ✅ CORRECTO - Las subclases son intercambiables
abstract class Repository<T> {
  abstract findById(id: string): Promise<T | null>;
}

class UserRepository extends Repository<User> {
  async findById(id: string): Promise<User | null> {
    // Mantiene el contrato
  }
}
```

#### 4. Interface Segregation Principle (ISP)
```typescript
// ✅ CORRECTO - Interfaces específicas
interface Readable {
  read(): Promise<Data>;
}

interface Writable {
  write(data: Data): Promise<void>;
}

// ❌ INCORRECTO - Interface muy grande
interface Repository {
  read(): Promise<Data>;
  write(data: Data): Promise<void>;
  delete(id: string): Promise<void>;
  update(id: string, data: Data): Promise<void>;
  // ... muchos más métodos
}
```

#### 5. Dependency Inversion Principle (DIP)
```typescript
// ✅ CORRECTO - Depende de abstracciones
export class WorkflowService {
  constructor(
    private readonly repository: IWorkflowRepository, // Interface
    private readonly logger: ILogger // Interface
  ) {}
}

// ❌ INCORRECTO - Depende de implementaciones concretas
export class WorkflowService {
  constructor(
    private readonly repository: PostgresWorkflowRepository, // Implementación
    private readonly logger: WinstonLogger // Implementación
  ) {}
}
```

### Patrones de Diseño Utilizados

1. **Repository Pattern**: Abstracción de la persistencia
2. **Command Pattern**: Encapsulación de operaciones
3. **Factory Pattern**: Creación de objetos complejos
4. **Observer Pattern**: Sistema de eventos
5. **Strategy Pattern**: Algoritmos intercambiables

---

## 📝 Guía de Desarrollo

### 1. Creando una Nueva Feature

#### Paso 1: Definir la Entidad de Dominio
```typescript
// domain/entities/task.entity.ts
export class Task {
  constructor(
    public readonly id: TaskId,
    public readonly title: string,
    public readonly description: string,
    private _status: TaskStatus,
    public readonly createdAt: Date
  ) {}

  complete(): void {
    if (this._status === TaskStatus.COMPLETED) {
      throw new TaskAlreadyCompletedError();
    }
    this._status = TaskStatus.COMPLETED;
  }

  get status(): TaskStatus {
    return this._status;
  }
}
```

#### Paso 2: Crear el Repositorio (Interface)
```typescript
// domain/interfaces/task.repository.interface.ts
export interface ITaskRepository {
  findById(id: string): Promise<Task | null>;
  findByUserId(userId: string): Promise<Task[]>;
  save(task: Task): Promise<void>;
  delete(id: string): Promise<void>;
}
```

#### Paso 3: Implementar el Caso de Uso
```typescript
// application/use-cases/complete-task.use-case.ts
export class CompleteTaskUseCase {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(command: CompleteTaskCommand): Promise<void> {
    const task = await this.taskRepo.findById(command.taskId);
    
    if (!task) {
      throw new TaskNotFoundError(command.taskId);
    }

    task.complete();
    
    await this.taskRepo.save(task);
    await this.eventBus.publish(new TaskCompletedEvent(task));
  }
}
```

#### Paso 4: Implementar el Repositorio
```typescript
// infrastructure/repositories/task.repository.ts
@Injectable()
export class TaskRepository implements ITaskRepository {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly repo: Repository<TaskEntity>
  ) {}

  async findById(id: string): Promise<Task | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? TaskMapper.toDomain(entity) : null;
  }

  async save(task: Task): Promise<void> {
    const entity = TaskMapper.toPersistence(task);
    await this.repo.save(entity);
  }
}
```

#### Paso 5: Crear el Controller
```typescript
// interfaces/http/task.controller.ts
@Controller('tasks')
export class TaskController {
  constructor(
    private readonly completeTaskUseCase: CompleteTaskUseCase
  ) {}

  @Patch(':id/complete')
  async completeTask(@Param('id') id: string): Promise<void> {
    const command = new CompleteTaskCommand(id);
    await this.completeTaskUseCase.execute(command);
  }
}
```

### 2. Estructura de Módulos

```typescript
// task.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity]),
    CommonModule,
  ],
  controllers: [TaskController],
  providers: [
    // Use Cases
    CompleteTaskUseCase,
    CreateTaskUseCase,
    
    // Repositories
    {
      provide: 'ITaskRepository',
      useClass: TaskRepository,
    },
    
    // Services
    TaskApplicationService,
  ],
  exports: [TaskApplicationService],
})
export class TaskModule {}
```

---

## ⚠️ Mejores Prácticas OBLIGATORIAS

### 1. Separación de Responsabilidades

```typescript
// ❌ NUNCA mezclar capas
@Injectable()
export class BadWorkflowService {
  constructor(
    @InjectRepository(WorkflowEntity) // ❌ Repository de TypeORM en servicio de aplicación
    private repo: Repository<WorkflowEntity>
  ) {}

  async execute(dto: WorkflowDto) { // ❌ Usando DTO en lugar de Command
    const workflow = new WorkflowEntity(); // ❌ Creando entidad de persistencia
    workflow.data = dto.data;
    await this.repo.save(workflow); // ❌ Acceso directo a BD
  }
}

// ✅ CORRECTO - Separación clara
@Injectable()
export class WorkflowApplicationService {
  constructor(
    @Inject('IWorkflowRepository')
    private workflowRepo: IWorkflowRepository // ✅ Interface
  ) {}

  async execute(command: ExecuteWorkflowCommand) { // ✅ Command pattern
    const workflow = new Workflow(command.data); // ✅ Entidad de dominio
    await this.workflowRepo.save(workflow); // ✅ A través de interface
  }
}
```

### 2. Inmutabilidad en el Dominio

```typescript
// ❌ INCORRECTO - Entidad mutable
export class BadTask {
  public status: string; // ❌ Propiedad pública mutable
  
  setStatus(status: string) { // ❌ Setter directo
    this.status = status;
  }
}

// ✅ CORRECTO - Entidad inmutable con métodos de negocio
export class Task {
  private constructor(
    private readonly _id: TaskId,
    private _status: TaskStatus // ✅ Privado
  ) {}

  complete(): Task { // ✅ Retorna nueva instancia
    if (!this.canComplete()) {
      throw new InvalidTaskTransitionError();
    }
    return new Task(this._id, TaskStatus.COMPLETED);
  }

  private canComplete(): boolean { // ✅ Lógica de negocio encapsulada
    return this._status === TaskStatus.PENDING;
  }
}
```

### 3. Value Objects

```typescript
// ❌ INCORRECTO - Usando primitivos
export class User {
  constructor(
    public email: string, // ❌ String primitivo
    public age: number    // ❌ Number primitivo
  ) {}
}

// ✅ CORRECTO - Value Objects
export class Email {
  constructor(private readonly value: string) {
    if (!this.isValid(value)) {
      throw new InvalidEmailError(value);
    }
  }

  private isValid(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  toString(): string {
    return this.value;
  }
}

export class Age {
  constructor(private readonly value: number) {
    if (value < 0 || value > 150) {
      throw new InvalidAgeError(value);
    }
  }

  isAdult(): boolean {
    return this.value >= 18;
  }
}

export class User {
  constructor(
    private readonly email: Email, // ✅ Value Object
    private readonly age: Age      // ✅ Value Object
  ) {}
}
```

### 4. Error Handling

```typescript
// ❌ INCORRECTO - Errores genéricos
export class WorkflowService {
  async execute(id: string) {
    const workflow = await this.repo.findById(id);
    if (!workflow) {
      throw new Error('Workflow not found'); // ❌ Error genérico
    }
  }
}

// ✅ CORRECTO - Domain Exceptions
// domain/exceptions/workflow.exceptions.ts
export class WorkflowNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Workflow with ID ${id} not found`);
    this.name = 'WorkflowNotFoundError';
  }
}

export class WorkflowAlreadyCompletedError extends DomainError {
  constructor(id: string) {
    super(`Workflow ${id} is already completed`);
    this.name = 'WorkflowAlreadyCompletedError';
  }
}

// application/services/workflow.service.ts
export class WorkflowService {
  async execute(id: string) {
    const workflow = await this.repo.findById(id);
    if (!workflow) {
      throw new WorkflowNotFoundError(id); // ✅ Domain exception
    }
  }
}
```

### 5. Testing

```typescript
// ❌ INCORRECTO - Test acoplado a implementación
describe('WorkflowService', () => {
  it('should save workflow to PostgreSQL', async () => {
    const pgRepo = new PostgresWorkflowRepository(); // ❌ Implementación concreta
    const service = new WorkflowService(pgRepo);
    // ...
  });
});

// ✅ CORRECTO - Test con mocks/stubs
describe('WorkflowService', () => {
  let service: WorkflowService;
  let mockRepo: MockType<IWorkflowRepository>;

  beforeEach(() => {
    mockRepo = createMock<IWorkflowRepository>();
    service = new WorkflowService(mockRepo);
  });

  it('should execute workflow successfully', async () => {
    // Arrange
    const workflow = WorkflowMother.create(); // ✅ Object Mother pattern
    mockRepo.findById.mockResolvedValue(workflow);

    // Act
    const result = await service.execute('workflow-id');

    // Assert
    expect(mockRepo.findById).toHaveBeenCalledWith('workflow-id');
    expect(result).toBeDefined();
  });
});
```

### 6. DTOs y Validación

```typescript
// application/dto/create-workflow.dto.ts
import { IsString, IsNotEmpty, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  workflowId: string;

  @IsObject()
  @ValidateNested()
  @Type(() => WorkflowDataDto)
  data: WorkflowDataDto;
}

// ✅ Validación automática en controller
@Post()
@UsePipes(new ValidationPipe({ transform: true }))
async create(@Body() dto: CreateWorkflowDto) {
  // DTO ya validado
}
```

### 7. Configuración y Variables de Entorno

```typescript
// ❌ INCORRECTO - Hardcoded values
export class EmailService {
  private apiKey = 'sk-1234567890'; // ❌ Valor hardcodeado
}

// ✅ CORRECTO - Usando ConfigService
@Injectable()
export class EmailService {
  constructor(private config: ConfigService) {}

  private get apiKey(): string {
    return this.config.get('EMAIL_API_KEY'); // ✅ De variables de entorno
  }
}
```

### 8. Logs y Monitoreo

```typescript
// ✅ Logging estructurado
@Injectable()
export class WorkflowApplicationService {
  constructor(
    private logger: ILogger,
    private metrics: IMetricsService
  ) {}

  async execute(command: ExecuteWorkflowCommand): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting workflow execution', {
        workflowId: command.workflowId,
        userId: command.userId,
        timestamp: new Date()
      });

      // Ejecutar workflow...

      this.metrics.recordSuccess('workflow.execution', Date.now() - startTime);
      
    } catch (error) {
      this.logger.error('Workflow execution failed', {
        error: error.message,
        stack: error.stack,
        workflowId: command.workflowId
      });
      
      this.metrics.recordFailure('workflow.execution');
      throw error;
    }
  }
}
```

---

## 🧪 Testing

### Estructura de Tests

```
src/
├── domain/
│   └── entities/
│       ├── workflow.entity.ts
│       └── workflow.entity.spec.ts      # Unit test
├── application/
│   └── services/
│       ├── workflow.service.ts
│       └── workflow.service.spec.ts     # Unit test
└── test/
    ├── integration/                     # Integration tests
    ├── e2e/                            # End-to-end tests
    └── fixtures/                       # Test data
```

### Tipos de Tests

#### 1. Unit Tests (Dominio)
```typescript
describe('Workflow Entity', () => {
  describe('complete', () => {
    it('should transition to completed state', () => {
      const workflow = new Workflow('id', WorkflowStatus.ACTIVE);
      
      workflow.complete();
      
      expect(workflow.status).toBe(WorkflowStatus.COMPLETED);
    });

    it('should throw error if already completed', () => {
      const workflow = new Workflow('id', WorkflowStatus.COMPLETED);
      
      expect(() => workflow.complete()).toThrow(WorkflowAlreadyCompletedError);
    });
  });
});
```

#### 2. Integration Tests
```typescript
describe('WorkflowService Integration', () => {
  let app: INestApplication;
  let workflowService: WorkflowService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    workflowService = app.get(WorkflowService);
  });

  it('should create and execute workflow', async () => {
    const result = await workflowService.execute({
      workflowId: 'test-workflow',
      data: { test: true }
    });

    expect(result).toBeDefined();
    expect(result.status).toBe('completed');
  });

  afterAll(async () => {
    await app.close();
  });
});
```

---

## 🔄 Workflows

### Creando un Nuevo Workflow

```typescript
// domain/workflows/approval-workflow.ts
export const approvalWorkflowDefinition: WorkflowDefinition = {
  id: 'approval-workflow',
  name: 'Approval Workflow',
  version: 1,
  startStep: 'validate-request',
  steps: new Map([
    ['validate-request', {
      name: 'Validate Request',
      handler: async (data) => {
        // Validación
        if (!data.amount || data.amount <= 0) {
          throw new InvalidRequestError('Amount must be positive');
        }
        return { ...data, validated: true };
      },
      nextStep: 'check-approval-level',
    }],
    
    ['check-approval-level', {
      name: 'Check Approval Level',
      handler: async (data) => {
        const level = data.amount > 10000 ? 'high' : 'low';
        return { ...data, approvalLevel: level };
      },
      nextStep: 'notify-approvers',
    }],
    
    ['notify-approvers', {
      name: 'Notify Approvers',
      handler: async (data) => {
        // Enviar notificaciones
        await notificationService.notify(data.approvers, data);
        return { ...data, notified: true };
      },
      nextStep: null, // Fin del workflow
    }],
  ]),
};
```

### Mejores Prácticas para Workflows

1. **Idempotencia**: Los handlers deben ser idempotentes
2. **Atomicidad**: Cada paso debe ser una transacción completa
3. **Compensación**: Manejar rollbacks cuando sea necesario
4. **Timeouts**: Definir timeouts para cada paso
5. **Reintentos**: Configurar política de reintentos

```typescript
export const robustWorkflowStep: WorkflowStep = {
  name: 'Process Payment',
  handler: async (data, context) => {
    const idempotencyKey = `${context.executionId}-${context.stepId}`;
    
    // Verificar si ya se procesó
    if (await cache.exists(idempotencyKey)) {
      return await cache.get(idempotencyKey);
    }
    
    try {
      const result = await paymentService.process(data);
      await cache.set(idempotencyKey, result, TTL.ONE_HOUR);
      return result;
    } catch (error) {
      // Manejo de errores con compensación
      await compensationService.revert(data);
      throw error;
    }
  },
  config: {
    timeout: 30000, // 30 segundos
    retries: 3,
    retryDelay: 1000,
    compensationStep: 'revert-payment',
  },
};
```

---

## 📚 Recursos y Referencias

### Libros Recomendados
- "Clean Architecture" - Robert C. Martin
- "Domain-Driven Design" - Eric Evans
- "Implementing Domain-Driven Design" - Vaughn Vernon

### Documentación
- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [BullMQ Documentation](https://docs.bullmq.io/)

### Herramientas de Desarrollo
- **ESLint**: Configurado con reglas estrictas
- **Prettier**: Formato consistente
- **Husky**: Pre-commit hooks
- **Jest**: Testing framework
- **TypeDoc**: Generación de documentación

---

## 🚀 Comandos Útiles

```bash
# Desarrollo
pnpm start:dev          # Iniciar en modo desarrollo
pnpm build             # Compilar para producción
pnpm start:prod        # Iniciar en producción

# Testing
pnpm test              # Ejecutar tests unitarios
pnpm test:e2e          # Ejecutar tests e2e
pnpm test:cov          # Coverage report

# Workflows
pnpm monitor:redis     # Monitor de Redis en tiempo real
pnpm cleanup:workflows # Limpiar workflows huérfanos
pnpm emergency:stop    # Detener todos los workflows

# Utilidades
pnpm lint              # Ejecutar linter
pnpm format            # Formatear código
pnpm set-logs minimal  # Configurar logs mínimos
```

---

## 📋 Checklist para Code Review

Antes de aprobar un PR, verificar:

- [ ] ¿Respeta la arquitectura de capas?
- [ ] ¿Las dependencias apuntan hacia adentro?
- [ ] ¿Usa interfaces en lugar de implementaciones concretas?
- [ ] ¿Tiene tests unitarios con coverage > 80%?
- [ ] ¿Los nombres son descriptivos y en inglés?
- [ ] ¿Maneja errores con excepciones de dominio?
- [ ] ¿Usa DTOs para entrada/salida?
- [ ] ¿Aplica validación en los DTOs?
- [ ] ¿Documenta métodos públicos complejos?
- [ ] ¿Evita código comentado?
- [ ] ¿No tiene console.log() en el código?
- [ ] ¿Usa el logger apropiado?
- [ ] ¿Las entidades son inmutables?
- [ ] ¿Usa Value Objects donde corresponde?
- [ ] ¿Sigue los principios SOLID?

---

## 🤝 Contribuyendo

1. Crear branch desde `develop`: `feature/nombre-descriptivo`
2. Commits con mensajes claros: `feat: add user authentication`
3. PR con descripción detallada y tests
4. Code review obligatorio antes de merge
5. Merge solo si pasan todos los tests y checks

---

## 📞 Contacto y Soporte

- **Tech Lead**: [Nombre]
- **Arquitecto**: [Nombre]
- **Canal Slack**: #flamebot-dev
- **Documentación interna**: [Link a Confluence/Wiki]

---

**Recuerda**: La arquitectura limpia no es negociable. Si tienes dudas sobre dónde poner algo, pregunta antes de implementar. Es mejor invertir tiempo en diseño que refactorizar después.

> "La arquitectura limpia no es sobre frameworks o tecnologías, es sobre crear software mantenible, testeable y escalable." - Uncle Bob
