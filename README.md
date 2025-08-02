# FlameBot 2.0 Backend

Backend robusto y escalable construido con TypeScript, NestJS y workflow-es para gestión de workflows programáticos.

## 🚀 Características

- **TypeScript**: Tipado estático para mayor seguridad y mejor DX
- **NestJS**: Framework empresarial con arquitectura modular
- **workflow-es**: Motor de workflows programático y extensible
- **Arquitectura Limpia**: Separación clara de responsabilidades
- **Validación**: En tiempo de compilación y runtime
- **Testing**: Tests unitarios y E2E con Jest
- **Logging**: Sistema de logs estructurado con Winston
- **Manejo de Errores**: Filtro global de excepciones
- **Optimizado**: Sin pérdidas de memoria, gestión eficiente de recursos
- **pnpm**: Gestor de paquetes rápido y eficiente

## 📋 Requisitos

- Node.js >= 16
- pnpm >= 8

### Instalar pnpm

Si no tienes pnpm instalado:

```bash
# Usando npm
npm install -g pnpm

# Usando PowerShell (Windows)
iwr https://get.pnpm.io/install.ps1 -useb | iex

# Usando Curl (Unix)
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

## 🛠️ Instalación

```bash
# Clonar el repositorio
cd D:\Work\flamebot2.0

# Instalar dependencias con pnpm
pnpm install

# Copiar archivo de configuración
copy .env.example .env
```

## 🏗️ Arquitectura

```
src/
├── domain/              # Lógica de negocio y workflows
│   └── workflows/       # Definiciones de workflows
├── application/         # Servicios de aplicación
│   └── services/        # Lógica de orquestación
├── infrastructure/      # Implementaciones técnicas
│   └── repositories/    # Acceso a datos
├── presentation/        # Capa de presentación
│   ├── controllers/     # Endpoints API
│   └── dto/            # Data Transfer Objects
└── common/             # Utilidades compartidas
    ├── interfaces/     # Interfaces comunes
    ├── exceptions/     # Excepciones personalizadas
    └── filters/        # Filtros globales
```

## 🚀 Uso

### Desarrollo

```bash
# Modo desarrollo con hot-reload
pnpm start:dev

# Modo debug
pnpm start:debug
```

### Producción

```bash
# Compilar
pnpm build

# Ejecutar
pnpm start:prod
```

### Testing

```bash
# Tests unitarios
pnpm test

# Tests con coverage
pnpm test:cov

# Tests E2E
pnpm test:e2e

# Tests en modo watch
pnpm test:watch
```

### Otros comandos útiles

```bash
# Formatear código
pnpm format

# Lint
pnpm lint

# Actualizar dependencias
pnpm update

# Verificar dependencias obsoletas
pnpm outdated

# Limpiar caché de pnpm
pnpm store prune
```

## 📡 API Endpoints

### Listar Workflows Disponibles
```
GET /api/v1/workflows
```

### Ejecutar Workflow
```
POST /api/v1/workflows/execute
Body: {
  "workflowId": "sample-workflow",
  "data": { ... }
}
```

### Obtener Estado de Workflow
```
GET /api/v1/workflows/instances/:instanceId
```

### Suspender Workflow
```
PUT /api/v1/workflows/instances/:instanceId/suspend
```

### Reanudar Workflow
```
PUT /api/v1/workflows/instances/:instanceId/resume
```

### Terminar Workflow
```
DELETE /api/v1/workflows/instances/:instanceId
```

### Testear Workflow
```
POST /api/v1/workflows/:workflowId/test
Body: { ... test data ... }
```

## 🔧 Configuración

Las variables de entorno se configuran en el archivo `.env`:

- `NODE_ENV`: Entorno de ejecución (development/production)
- `PORT`: Puerto del servidor
- `DB_TYPE`: Tipo de base de datos
- `DB_DATABASE`: Nombre/ruta de la base de datos
- `CORS_ORIGIN`: Origen permitido para CORS
- `LOG_LEVEL`: Nivel de logging

## 📦 Workflows Incluidos

### Sample Workflow
Workflow básico que demuestra:
- Procesamiento de datos
- Validación
- Delays
- Notificaciones

### Error Handling Workflow
Workflow con manejo avanzado de errores:
- Manejo de excepciones
- Compensación
- Recuperación de errores

## 🧪 Testing en Tiempo Real

El sistema incluye capacidad de testing en tiempo real mediante:
- Endpoint dedicado para tests
- Mocks automáticos de dependencias
- Simulación de condiciones reales
- Timeout configurable

## 🔒 Seguridad

- Validación de DTOs con class-validator
- Sanitización de entradas
- Manejo seguro de errores
- CORS configurado

## 📈 Optimización

- Gestión eficiente del ciclo de vida
- Limpieza automática de recursos
- Sin pérdidas de memoria
- Logging estructurado para debugging

## 💡 Tips para pnpm

### Ventajas de usar pnpm:
- **Eficiencia de espacio**: Usa enlaces duros para ahorrar espacio en disco
- **Velocidad**: Instalaciones más rápidas gracias al caché global
- **Seguridad**: Estricto con las dependencias no declaradas
- **Determinístico**: Instalaciones consistentes en todos los entornos

### Comandos útiles de pnpm:
```bash
# Agregar dependencia
pnpm add <package>

# Agregar dependencia de desarrollo
pnpm add -D <package>

# Remover dependencia
pnpm remove <package>

# Ejecutar script
pnpm <script>

# Ver árbol de dependencias
pnpm list

# Actualizar pnpm
pnpm add -g pnpm
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea tu feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la licencia MIT.
