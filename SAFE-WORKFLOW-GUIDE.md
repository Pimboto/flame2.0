# Workflow Seguro de Automatización - Guía de Uso

## Descripción

Este workflow implementa un sistema de automatización con múltiples puntos de control para garantizar que las operaciones se detengan correctamente cuando se detectan condiciones anormales.

## Características del Workflow

- **ID**: `safe-automation-workflow`
- **Verificación de condiciones**: Antes y después de cada paso
- **Detención automática**: Se detiene en la 3ra iteración (hardcoded para pruebas)
- **Timeout por paso**: Cada paso tiene un tiempo máximo de ejecución
- **Historial completo**: Registra todas las acciones y decisiones

## Flujo de Ejecución

1. **Initialize**: Inicializa el workflow con datos básicos
2. **Pre-Condition Check**: Verifica si debe continuar (llamada a API simulada)
3. **Wait Step**: Espera 20 segundos
4. **Post-Wait Check**: Verifica nuevamente las condiciones
5. **Execute Action**: Imprime "Hello World"
6. **Decide Next Step**: Decide si continuar el loop o terminar

## Uso con los Endpoints Existentes

### 1. Ejecutar el Workflow

```bash
# Ejecutar con datos por defecto
curl -X POST http://localhost:3000/api/v1/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "safe-automation-workflow",
    "data": {
      "testMode": true,
      "maxIterations": 10
    }
  }'
```

Respuesta esperada:
```json
{
  "instanceId": "execution-id-uuid",
  "status": "accepted"
}
```

### 2. Verificar Estado del Workflow

```bash
# Reemplazar {instanceId} con el ID devuelto al ejecutar
curl http://localhost:3000/api/v1/workflows/instances/{instanceId}
```

Respuesta esperada:
```json
{
  "id": "execution-id",
  "workflowId": "safe-automation-workflow",
  "status": "running",
  "currentStep": "wait-step",
  "iteration": 2,
  "progress": "20% (Iteración 2/10)",
  "messages": [
    {
      "message": "🌍 Hello World! (Iteración #1)",
      "timestamp": "2024-01-20T10:00:00Z"
    },
    {
      "message": "🌍 Hello World! (Iteración #2)",
      "timestamp": "2024-01-20T10:00:20Z"
    }
  ],
  "history": [
    {
      "step": "pre-condition-check",
      "iteration": 0,
      "timestamp": "2024-01-20T10:00:00Z",
      "controlResponse": {
        "shouldContinue": true,
        "status": "ok"
      }
    }
  ],
  "data": {
    "testMode": true,
    "maxIterations": 10,
    "iteration": 2,
    "currentStep": "wait-step",
    "status": "running"
  },
  "createTime": "2024-01-20T10:00:00Z",
  "lastUpdate": "2024-01-20T10:00:40Z",
  "isLooping": true
}
```

Estados posibles:
- `pending`: Workflow en cola esperando iniciar
- `running`: Workflow en ejecución
- `stopped`: Workflow detenido por condición de parada
- `completed`: Workflow completado exitosamente
- `failed`: Workflow fallido por error
- `cancelled`: Workflow cancelado manualmente

### 3. Ver Historial de Ejecuciones

```bash
curl http://localhost:3000/api/v1/workflows/executions
```

### 4. Estadísticas de las Colas

```bash
curl http://localhost:3000/api/v1/workflows/queues/stats
```

### 5. Terminar un Workflow en Ejecución

```bash
curl -X DELETE http://localhost:3000/api/v1/workflows/instances/{instanceId}
```

## Comportamiento Esperado

El workflow se ejecutará de la siguiente manera:

1. **Iteración 0**: Inicia, verifica condición (OK), espera 20s, imprime "Hello World! (Iteración #1)"
2. **Iteración 1**: Verifica condición (OK), espera 20s, imprime "Hello World! (Iteración #2)"
3. **Iteración 2**: Verifica condición (OK), espera 20s, imprime "Hello World! (Iteración #3)"
4. **Iteración 3**: Verifica condición (STOP) - **El workflow se detiene automáticamente**

Total tiempo estimado: ~60 segundos (3 iteraciones × 20 segundos)

## Verificación del Estado en Tiempo Real

Mientras el workflow está ejecutándose, puedes verificar su estado y ver:
- En qué paso está actualmente (`currentStep`)
- Cuántas iteraciones ha completado (`iteration`)
- Qué mensajes ha generado (`messages`)
- El historial completo de verificaciones (`history`)
- El progreso como porcentaje (`progress`)

Esto te permite monitorear exactamente qué está haciendo el workflow en cada momento.

## Monitoreo en Tiempo Real

Para ver los logs en tiempo real mientras se ejecuta:

```bash
# En una terminal separada
tail -f logs/app.log | grep -E "(SafeWorkflow|safe-automation)"
```

## Personalización para Producción

En producción, modificar la función `checkWorkflowCondition` en el archivo:
`/src/domain/workflows/examples/safe-automation-workflow.ts`

```typescript
// Cambiar de:
async function checkWorkflowCondition(data: any): Promise<ControlApiResponse> {
  const iteration = data.iteration || 0;
  
  // HARDCODED para prueba
  if (iteration >= 3) {
    return { shouldContinue: false, status: 'stop', message: 'Test limit' };
  }
  
  return { shouldContinue: true, status: 'ok', message: 'Continue' };
}

// A:
async function checkWorkflowCondition(data: any): Promise<ControlApiResponse> {
  const response = await fetch('https://api.empresa.com/workflow-control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      workflowId: data.workflowId, 
      context: data 
    })
  });
  
  return await response.json();
}
```

## Notas Importantes

- El workflow está diseñado para fallar de manera segura
- Si la API de control no responde, el workflow se detiene
- Todos los pasos tienen timeouts configurados
- El historial completo se guarda en la base de datos
- Los logs se guardan con el tag `SafeWorkflow` para fácil filtrado
