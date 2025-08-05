@echo off
REM Script para iniciar la aplicación con optimizaciones de memoria en Windows

echo 🚀 Iniciando FlameBot con optimizaciones de memoria...

REM Configuración de Node.js para mejor gestión de memoria
set NODE_OPTIONS=--max-old-space-size=2048 --optimize-for-size --gc-interval=100 --expose-gc

REM Iniciar con garbage collection expuesto
node --expose-gc dist/main.js
