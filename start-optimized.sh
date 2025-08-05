#!/bin/bash
# Script para iniciar la aplicación con optimizaciones de memoria

echo "🚀 Iniciando FlameBot con optimizaciones de memoria..."

# Configuración de Node.js para mejor gestión de memoria
export NODE_OPTIONS="
  --max-old-space-size=2048 \
  --max-semi-space-size=32 \
  --max-heap-size=2048 \
  --optimize-for-size \
  --gc-interval=100 \
  --expose-gc
"

# Iniciar con garbage collection expuesto
node --expose-gc dist/main.js
