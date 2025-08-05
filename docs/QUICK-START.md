# 🚀 Quick Start - Post Refactoring

## Verificación Rápida

```bash
# Hacer el script ejecutable
chmod +x scripts/verify-refactoring.sh

# Ejecutar verificación
./scripts/verify-refactoring.sh
```

## Comandos de Inicio Rápido

```bash
# 1. Instalar dependencias
pnpm install

# 2. Compilar para verificar tipos
pnpm build

# 3. Ejecutar migración de DB
pnpm run migrate

# 4. Iniciar en desarrollo
pnpm start:dev

# 5. Verificar que funciona
curl http://localhost:3000/api/v1/workflows
```

## Test del Workflow de Importación

```bash
# Ejecutar workflow de importación
curl -X POST http://localhost:3000/api/v1/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "import-accounts-workflow",
    "data": {
      "accounts": [{
        "account": "test:account:string",
        "class_info": {
          "class_type": "Iris",
          "class_color": "#ffb3f5"
        },
        "account_origin": "ios"
      }],
      "apiToken": "YOUR_TOKEN_HERE"
    }
  }'
```

## Verificar Estado de la Arquitectura

```bash
# Ver estructura de archivos
tree src -I node_modules -L 3

# Verificar que no hay violaciones
grep -r "@Entity" src/domain/  # No debe encontrar nada
grep -r "fetch(" src/domain/    # No debe encontrar nada
```

## Monitoreo

```bash
# Ver logs en tiempo real
tail -f logs/error.log

# Monitor de Redis
pnpm monitor:redis

# Ver métricas
curl http://localhost:3000/api/v1/workflows/capacity
```

## Troubleshooting

Si encuentras errores:

1. **Error de compilación TypeScript**
   ```bash
   rm -rf dist
   pnpm build
   ```

2. **Error de base de datos**
   ```bash
   pnpm run migrate
   ```

3. **Error de Redis**
   ```bash
   redis-cli ping
   ```

4. **Limpiar todo y empezar de nuevo**
   ```bash
   rm -rf node_modules dist
   pnpm install
   pnpm build
   pnpm run migrate
   pnpm start:dev
   ```