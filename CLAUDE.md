# 🚨 REGLAS DE ORO - LEAN ESTO PRIMERO

## ❌ PROHIBIDO - Violaciones que resultan en PR rechazado

### 1. **NUNCA importar frameworks en Domain**
```typescript
// ❌ ESTO ESTÁ PROHIBIDO EN /domain
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
```

### 2. **NUNCA acceder a BD directamente desde Application**
```typescript
// ❌ PROHIBIDO en /application
@InjectRepository(Entity)
private repo: Repository<Entity>
```

### 3. **NUNCA usar entidades de persistencia como entidades de dominio**
```typescript
// ❌ PROHIBIDO
@Entity()
export class User {  // Esto es de TypeORM, NO es entidad de dominio
  @Column()
  name: string;
}
```

### 4. **NUNCA exponer detalles de implementación**
```typescript
// ❌ PROHIBIDO
export class UserService {
  constructor(
    private postgresRepo: PostgresUserRepository // ❌ Implementación concreta
  ) {}
}
```

### 5. **NUNCA mutar estado directamente**
```typescript
// ❌ PROHIBIDO
user.status = 'active'; // Mutación directa
user.email = 'new@email.com'; // Setter público
```

---

## ✅ OBLIGATORIO - Prácticas que DEBEN seguirse

### 1. **SIEMPRE usar Interfaces para dependencias**
```typescript
// ✅ CORRECTO
constructor(
  @Inject('IUserRepository')
  private userRepo: IUserRepository
) {}
```

### 2. **SIEMPRE validar en los DTOs**
```typescript
// ✅ CORRECTO
export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

### 3. **SIEMPRE usar Value Objects para conceptos de negocio**
```typescript
// ✅ CORRECTO
export class Email {
  constructor(private readonly value: string) {
    if (!this.isValid(value)) {
      throw new InvalidEmailError(value);
    }
  }
}
```

### 4. **SIEMPRE manejar errores con Domain Exceptions**
```typescript
// ✅ CORRECTO
export class UserNotFoundError extends DomainError {
  constructor(id: string) {
    super(`User with ID ${id} not found`);
  }
}
```

### 5. **SIEMPRE escribir tests PRIMERO (TDD)**
```typescript
// ✅ CORRECTO - Test primero
describe('User', () => {
  it('should not allow invalid email', () => {
    expect(() => new User(new Email('invalid'))).toThrow();
  });
});
```

---

## 📁 Dónde va cada cosa - GUÍA RÁPIDA

```
¿Es lógica de negocio pura? → /domain/entities
¿Es un caso de uso? → /application/use-cases
¿Es implementación de DB? → /infrastructure/repositories
¿Es un controller? → /interfaces/http
¿Es configuración? → /infrastructure/config
¿Es utilidad compartida? → /common
```

---

## 🎯 Ejemplos de Código CORRECTO vs INCORRECTO

### Ejemplo 1: Crear Usuario

```typescript
// ❌ INCORRECTO - Todo mezclado
@Controller('users')
export class UserController {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  @Post()
  async create(@Body() data: any) {
    const user = new User();
    user.email = data.email; // ❌ Sin validación
    user.status = 'active'; // ❌ Lógica de negocio en controller
    await this.repo.save(user); // ❌ Acceso directo a BD
    return user; // ❌ Retornando entidad de BD
  }
}
```

```typescript
// ✅ CORRECTO - Separación clara

// interfaces/http/user.controller.ts
@Controller('users')
export class UserController {
  constructor(private createUserUseCase: CreateUserUseCase) {}

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const command = new CreateUserCommand(dto.email, dto.password);
    const userId = await this.createUserUseCase.execute(command);
    return { id: userId, message: 'User created successfully' };
  }
}

// application/use-cases/create-user.use-case.ts
export class CreateUserUseCase {
  constructor(
    @Inject('IUserRepository') private userRepo: IUserRepository,
    @Inject('IPasswordHasher') private hasher: IPasswordHasher
  ) {}

  async execute(command: CreateUserCommand): Promise<string> {
    // Crear value objects
    const email = new Email(command.email);
    const hashedPassword = await this.hasher.hash(command.password);
    
    // Crear entidad de dominio
    const user = User.create(email, hashedPassword);
    
    // Guardar a través de interface
    await this.userRepo.save(user);
    
    return user.id.value;
  }
}

// domain/entities/user.entity.ts
export class User {
  private constructor(
    private readonly _id: UserId,
    private readonly _email: Email,
    private readonly _password: HashedPassword,
    private _status: UserStatus
  ) {}

  static create(email: Email, password: HashedPassword): User {
    return new User(
      UserId.generate(),
      email,
      password,
      UserStatus.PENDING_VERIFICATION
    );
  }

  activate(): void {
    if (this._status !== UserStatus.PENDING_VERIFICATION) {
      throw new InvalidUserStateError('User must be pending verification');
    }
    this._status = UserStatus.ACTIVE;
  }
}
```

---

## 🔍 Quick Review Checklist

Antes de hacer commit:

```
□ ¿Mi código respeta las capas?
□ ¿Uso interfaces, no implementaciones?
□ ¿Mis entidades son inmutables?
□ ¿Tengo tests?
□ ¿Uso DTOs para entrada/salida?
□ ¿Manejo errores correctamente?
□ ¿Mi código es fácil de testear?
□ ¿Evito acoplamientos?
```

---

## 🆘 ¿Dudas?

1. **¿No sabes dónde poner algo?** → Pregunta en Slack
2. **¿No entiendes un concepto?** → Revisa los ejemplos
3. **¿Crees que hay una excepción?** → Probablemente no la hay
4. **¿Quieres saltarte una regla?** → NO. Las reglas existen por una razón

**Recuerda**: Es mejor preguntar que refactorizar después.