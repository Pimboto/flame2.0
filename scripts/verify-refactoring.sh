#!/bin/bash
# scripts/verify-refactoring.sh
# Script para verificar que la refactorización está completa y funcionando

echo "🔍 Verificando Refactorización de Clean Architecture..."
echo "=================================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar archivos
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} $1 existe"
        return 0
    else
        echo -e "${RED}❌${NC} $1 no encontrado"
        return 1
    fi
}

# Función para verificar directorios
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✅${NC} Directorio $1 existe"
        return 0
    else
        echo -e "${RED}❌${NC} Directorio $1 no encontrado"
        return 1
    fi
}

echo ""
echo "1. Verificando estructura de Domain (entidades puras)..."
echo "----------------------------------------------------------"
check_file "src/domain/entities/workflow-execution.ts"
check_file "src/domain/entities/account.entity.ts"
check_dir "src/domain/interfaces"
check_file "src/domain/interfaces/workflow-execution.repository.interface.ts"

echo ""
echo "2. Verificando Infrastructure (implementaciones)..."
echo "----------------------------------------------------------"
check_file "src/infrastructure/entities/workflow-execution.entity.ts"
check_file "src/infrastructure/entities/account.entity.ts"
check_dir "src/infrastructure/mappers"
check_file "src/infrastructure/mappers/workflow-execution.mapper.ts"
check_dir "src/infrastructure/services"
check_file "src/infrastructure/services/http-client.service.ts"
check_file "src/infrastructure/services/tinder-api.service.ts"

echo ""
echo "3. Verificando que NO existan archivos violatorios..."
echo "----------------------------------------------------------"
if [ ! -f "src/domain/entities/workflow-execution.entity.ts" ]; then
    echo -e "${GREEN}✅${NC} workflow-execution.entity.ts correctamente eliminado de domain"
else
    echo -e "${RED}❌${NC} VIOLACIÓN: workflow-execution.entity.ts todavía existe en domain!"
fi

echo ""
echo "4. Compilando proyecto..."
echo "----------------------------------------------------------"
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅${NC} Compilación exitosa"
else
    echo -e "${RED}❌${NC} Error de compilación"
    echo "Ejecuta 'npm run build' para ver los errores"
fi

echo ""
echo "5. Verificando configuración..."
echo "----------------------------------------------------------"
check_file "tsconfig.json"
check_file "scripts/migrate-database.ts"
check_dir "docs"

echo ""
echo "6. Resumen de la verificación:"
echo "=================================================="

# Contar errores
ERRORS=0
if [ ! -f "src/domain/entities/workflow-execution.ts" ]; then ((ERRORS++)); fi
if [ ! -f "src/infrastructure/entities/workflow-execution.entity.ts" ]; then ((ERRORS++)); fi
if [ ! -d "src/infrastructure/mappers" ]; then ((ERRORS++)); fi
if [ ! -d "src/infrastructure/services" ]; then ((ERRORS++)); fi

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ REFACTORIZACIÓN COMPLETA${NC}"
    echo ""
    echo "Próximos pasos:"
    echo "1. Ejecutar: pnpm install"
    echo "2. Ejecutar: pnpm run migrate"
    echo "3. Ejecutar: pnpm build"
    echo "4. Ejecutar: pnpm start:dev"
else
    echo -e "${RED}❌ REFACTORIZACIÓN INCOMPLETA${NC}"
    echo "Se encontraron $ERRORS problemas"
    echo "Revisa los errores arriba y corrige los archivos faltantes"
fi

echo ""
echo "Para más información, consulta:"
echo "- docs/CLEAN-ARCHITECTURE-GUIDE.md"
echo "- docs/MIGRATION-SUMMARY.md"
echo "- MUST-READ-RULES.md"