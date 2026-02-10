#!/bin/bash

# Script de instalación y configuración del proyecto
# Early Warning YoY con integración NetSuite

set -e  # Exit on error

echo "🚀 Instalando Early Warning YoY con NetSuite..."
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para imprimir con color
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Verificar que estamos en el directorio correcto
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    print_error "Error: Este script debe ejecutarse desde el directorio raíz del proyecto"
    exit 1
fi

echo "📦 Paso 1: Instalando dependencias del backend..."
cd backend

# Verificar Python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 no está instalado. Instálalo antes de continuar."
    exit 1
fi

print_success "Python encontrado: $(python3 --version)"

# Crear virtualenv si no existe
if [ ! -d ".venv" ]; then
    echo "  Creando entorno virtual..."
    python3 -m venv .venv
    print_success "Entorno virtual creado"
fi

# Activar virtualenv
echo "  Activando entorno virtual..."
source .venv/bin/activate

# Instalar dependencias
echo "  Instalando dependencias de Python..."
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt > /dev/null 2>&1
print_success "Dependencias del backend instaladas"

# Configurar .env
if [ ! -f ".env" ]; then
    print_warning ".env no encontrado. Creando desde .env.example..."
    cp .env.example .env
    print_warning "IMPORTANTE: Edita backend/.env con tus credenciales de NetSuite"
    echo "  Ubicación: $(pwd)/.env"
else
    print_success ".env ya existe"
fi

cd ..

echo ""
echo "📦 Paso 2: Instalando dependencias del frontend..."
cd frontend

# Verificar Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js no está instalado. Instálalo antes de continuar."
    exit 1
fi

print_success "Node.js encontrado: $(node --version)"
print_success "npm encontrado: $(npm --version)"

# Instalar dependencias
echo "  Instalando dependencias de Node.js..."
npm install > /dev/null 2>&1
print_success "Dependencias del frontend instaladas"

cd ..

echo ""
echo "✅ Instalación completada!"
echo ""
echo "📝 Próximos pasos:"
echo ""
echo "1. Si quieres usar NetSuite:"
echo "   ${YELLOW}→ Lee la guía completa en NETSUITE_SETUP.md${NC}"
echo "   ${YELLOW}→ Configura backend/.env con tus credenciales${NC}"
echo "   ${YELLOW}→ Despliega el RESTlet en NetSuite (backend/RESTLET_NETSUITE.js)${NC}"
echo ""
echo "2. Ejecutar el proyecto:"
echo "   ${GREEN}Terminal 1 (Backend):${NC}"
echo "   cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo ""
echo "   ${GREEN}Terminal 2 (Frontend):${NC}"
echo "   cd frontend && npm run dev"
echo ""
echo "3. Abre tu navegador en: ${GREEN}http://localhost:5173${NC}"
echo ""
echo "4. (Opcional) Probar conexión NetSuite:"
echo "   curl http://localhost:8000/api/netsuite/test"
echo ""
print_success "¡Todo listo! 🎉"
