# 📚 Arquitectura Clean - Guía de Referencia Rápida

## ✅ Estado Actual: REFACTORIZADO

El proyecto ha sido completamente refactorizado para cumplir con Clean Architecture. Esta guía documenta la estructura actual y las mejores prácticas.

## 🏗️ Estructura de Capas

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION                         │
│                 (Controllers, DTOs)                     │
├─────────────────────────────────────────────────────────┤
│                    APPLICATION                          │
│              (Casos de Uso, Servicios)                  │
├─────────────────────────────────────────────────────────┤
│                      DOMAIN                             │
│          (Entidades, Interfaces, Workflows)             │
├─────────────────────────────────────────────────────────┤
│                  INFRASTRUCTURE                         │
│     (Repos, DB, HTTP, Redis, Implementaciones)          │
└─────────────────────────────────────────────────────────┘

Regla de Oro: Las dependencias SOLO pueden apuntar hacia ADENTRO (↓)
```

## 📁 Estructura de Archivos

### ✅ CORRECTO - Estructura Actual

```
src/
├── domain/                              # ✅ Capa más interna (pura)
│   ├── entities/
│   │   ├── account.entity.ts           # Sin @Entity, sin @Column
│   │   └── workflow-execution.ts       # Entidad pura, métodos de negocio
│   ├── interfaces/
│   │   ├── account.repository.interface.ts
│   │   ├── workflow-execution.repository.interface.ts
│   │   ├── http-client.interface.ts
│   │   └── tinder-api.interface.ts
│   ├── value-objects/
│   │   └── workflow-execution-id.ts    # Value object inmutable
│   └── workflows/
│       └── import-accounts-workflow.ts # Lógica pura, usa interfaces
│
├── application/                         # ✅ Casos de uso
│   └── services/
│       └── workflow.service.ts         # Orquesta, usa interfaces
│
├── infrastructure/                      # ✅ Detalles de implementación
│   ├── entities/
│   │   ├── account.entity.ts           # Con @Entity, @Column
│   │   └── workflow-execution.entity.ts # TypeORM aquí está bien
│   ├── mappers/
│   │   └── workflow-execution.mapper.ts # Convierte domain ↔ persistence
│   ├── repositories/
│   │   ├── account.repository.ts       # Implementa interface del domain
│   │   └── workflow-execution.repository.ts
│   └── services/
│       ├── http-client.service.ts      # Implementación real de HTTP
│       ├── tinder-api.service.ts       # Llamadas API reales
│       ├── redis-connection.service.ts # Pool de conexiones
│       ├── metrics.service.ts          # Sistema de métricas
│       └── queue-manager.service.ts    # Gestión de colas
│
└── presentation/                        # ✅ Capa externa
    ├── controllers/
    │   └── workflow.controller.ts      # @Controller, rutas HTTP
    └── dto/
        └── execute-workflow.dto.ts     # @IsString, validaciones
```

## 🔄 Flujo de Datos Correcto

```typescript
// 1. PRESENTATION: Controller recibe request
@Controller('workflows')
export class WorkflowController {
  constructor(private workflowService: WorkflowService) {} // ✅ Servicio de aplicación
  
  @Post('execute')
  async execute(@Body() dto: ExecuteWorkflowDto) {
    return this.workflowService.executeWorkflow(dto);
  }
}

// 2. APPLICATION: Servicio orquesta el caso de uso
@Injectable()
export class WorkflowService {
  constructor(
    @Inject('IWorkflowRepository')  // ✅ Interface, no implementación
    private workflowRepo: IWorkflowRepository
  ) {}
  
  async executeWorkflow(dto: ExecuteWorkflowDto) {
    const workflow = WorkflowExecution.create(...); // ✅ Entidad de dominio
    return this.workflowRepo.save(workflow);
  }
}

// 3. DOMAIN: Entidad con lógica de negocio
export class WorkflowExecution {
  private constructor(
    private readonly _id: WorkflowExecutionId,  // ✅ Value Object
    private _status: WorkflowExecutionStatus    // ✅ Sin decoradores
  ) {}
  
  start(): void {
    if (this._status !== WorkflowExecutionStatus.PENDING) {
      throw new Error('Cannot start non-pending workflow');  // ✅ Regla de negocio
    }
    this._status = WorkflowExecutionStatus.RUNNING;
  }
}

// 4. INFRASTRUCTURE: Implementación real
@Injectable()
export class WorkflowExecutionRepository implements IWorkflowRepository {
  constructor(
    @InjectRepository(WorkflowExecutionEntity)  // ✅ TypeORM aquí está bien
    private repo: Repository<WorkflowExecutionEntity>
  ) {}
  
  async save(workflow: WorkflowExecution): Promise<void> {
    const entity = WorkflowExecutionMapper.toPersistence(workflow); // ✅ Mapper
    await this.repo.save(entity);
  }
}
```

## ❌ ERRORES COMUNES A EVITAR

### 1. NO importar frameworks en Domain
```typescript
// ❌ INCORRECTO
// domain/entities/user.entity.ts
import { Entity, Column } from 'typeorm';  // ❌ TypeORM en domain
@Entity()
export class User { }

// ✅ CORRECTO
// domain/entities/user.ts
export class User {  // Sin decoradores, pura
  private constructor(private readonly _id: UserId) {}
}
```

### 2. NO hacer HTTP en Domain
```typescript
// ❌ INCORRECTO
// domain/workflows/my-workflow.ts
const response = await fetch('https://api.com');  // ❌ HTTP directo

// ✅ CORRECTO
// domain/workflows/my-workflow.ts
const response = await apiService.getData();  // ✅ Usa servicio inyectado
```

### 3. NO usar implementaciones concretas
```typescript
// ❌ INCORRECTO
constructor(private userRepo: PostgresUserRepository) {}  // ❌ Implementación

// ✅ CORRECTO
constructor(
  @Inject('IUserRepository')
  private userRepo: IUserRepository  // ✅ Interface
) {}
```

## 🔧 Comandos Útiles

```bash
# Compilar proyecto
pnpm build

# Ejecutar migraciones
pnpm run migrate

# Iniciar en desarrollo
pnpm start:dev

# Ejecutar tests
pnpm test

# Ver coverage
pnpm test:cov

# Limpiar y rebuild
rm -rf dist && pnpm build

# Ver logs mínimos
pnpm set-logs minimal

# Monitorear Redis
pnpm monitor:redis

# Limpiar workflows huérfanos
pnpm cleanup:workflows
```

## 📝 Checklist para Code Review

Antes de aprobar un PR:

- [ ] ¿Domain NO tiene imports de frameworks?
- [ ] ¿Las entidades de domain son inmutables?
- [ ] ¿Se usan interfaces en lugar de implementaciones?
- [ ] ¿Hay mappers entre domain y persistence?
- [ ] ¿Los workflows usan servicios inyectados?
- [ ] ¿Los DTOs tienen validación?
- [ ] ¿Hay tests unitarios?
- [ ] ¿Se respeta la regla de dependencias?

## 🎯 Ejemplos de Cada Capa

### Domain Entity (Pura)
```typescript
// domain/entities/account.ts
export class Account {
  private constructor(
    private readonly _id: string,
    private readonly _externalId: string,
    private _status: string
  ) {}
  
  static create(externalId: string, ...): Account {
    return new Account(randomUUID(), externalId, 'active');
  }
  
  isActive(): boolean {
    return this._status === 'active';
  }
}
```

### Infrastructure Entity (Con TypeORM)
```typescript
// infrastructure/entities/account.entity.ts
@Entity('accounts')
export class AccountEntity {
  @PrimaryColumn('uuid')
  id!: string;
  
  @Column({ name: 'external_id', unique: true })
  externalId!: string;
  
  @Column()
  status!: string;
}
```

### Mapper
```typescript
// infrastructure/mappers/account.mapper.ts
export class AccountMapper {
  static toDomain(entity: AccountEntity): Account {
    return Account.reconstitute({
      id: entity.id,
      externalId: entity.externalId,
      status: entity.status
    });
  }
  
  static toPersistence(domain: Account): AccountEntity {
    const entity = new AccountEntity();
    entity.id = domain.id;
    entity.externalId = domain.externalId;
    entity.status = domain.status;
    return entity;
  }
}
```

### Repository Implementation
```typescript
// infrastructure/repositories/account.repository.ts
@Injectable()
export class AccountRepository implements IAccountRepository {
  constructor(
    @InjectRepository(AccountEntity)
    private repo: Repository<AccountEntity>
  ) {}
  
  async save(account: Account): Promise<void> {
    const entity = AccountMapper.toPersistence(account);
    await this.repo.save(entity);
  }
  
  async findById(id: string): Promise<Account | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? AccountMapper.toDomain(entity) : null;
  }
}
```

## 🚀 Creando Nuevas Features

### 1. Definir Entidad de Dominio
```typescript
// domain/entities/feature.ts
export class Feature {
  private constructor(
    private readonly _id: FeatureId,
    private _name: string
  ) {}
  
  static create(name: string): Feature {
    return new Feature(FeatureId.generate(), name);
  }
}
```

### 2. Crear Interface del Repositorio
```typescript
// domain/interfaces/feature.repository.interface.ts
export interface IFeatureRepository {
  save(feature: Feature): Promise<void>;
  findById(id: string): Promise<Feature | null>;
}
```

### 3. Crear Entidad de Persistencia
```typescript
// infrastructure/entities/feature.entity.ts
@Entity('features')
export class FeatureEntity {
  @PrimaryColumn('uuid')
  id!: string;
  
  @Column()
  name!: string;
}
```

### 4. Implementar Repositorio
```typescript
// infrastructure/repositories/feature.repository.ts
@Injectable()
export class FeatureRepository implements IFeatureRepository {
  // Implementación con TypeORM
}
```

### 5. Crear Servicio de Aplicación
```typescript
// application/services/feature.service.ts
@Injectable()
export class FeatureService {
  constructor(
    @Inject('IFeatureRepository')
    private featureRepo: IFeatureRepository
  ) {}
  
  async createFeature(name: string): Promise<void> {
    const feature = Feature.create(name);
    await this.featureRepo.save(feature);
  }
}
```

### 6. Crear Controller
```typescript
// presentation/controllers/feature.controller.ts
@Controller('features')
export class FeatureController {
  constructor(private featureService: FeatureService) {}
  
  @Post()
  async create(@Body() dto: CreateFeatureDto) {
    await this.featureService.createFeature(dto.name);
  }
}
```

## 📊 Métricas de Calidad

- **Cobertura de Tests**: > 80%
- **Complejidad Ciclomática**: < 10
- **Acoplamiento**: Bajo (uso de interfaces)
- **Cohesión**: Alta (Single Responsibility)
- **Duplicación de Código**: < 3%

## 🔗 Enlaces Útiles

- [Clean Architecture - Uncle Bob](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)

---

**Última actualización**: Post-refactorización completa
**Estado**: ✅ Cumple 100% con Clean Architecture
**Versión**: 2.0.0