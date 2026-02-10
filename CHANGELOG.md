# Changelog

Todos los cambios importantes de este proyecto se documentarán en este archivo.

---

## [2.0.0] - 2024-02-10

### 🎉 Nueva Funcionalidad: Integración con NetSuite

Ahora puedes obtener datos directamente desde NetSuite sin necesidad de exportar a Excel.

### ✨ Añadido

#### Backend
- **Cliente de NetSuite** (`app/netsuite_client.py`)
  - Autenticación TBA (Token-Based Authentication) con OAuth 1.0a
  - Conexión via RESTlet personalizado
  - Conversión automática de datos NetSuite a formato compatible con análisis
  - Manejo de errores y timeouts
  - Soporte para paginación y filtros de fecha

- **Nuevos endpoints**:
  - `POST /api/analyze/netsuite` - Analizar datos desde NetSuite
    - Mismos parámetros que `/api/analyze`
    - Parámetros adicionales: `start_date`, `end_date`
  - `GET /api/netsuite/test` - Probar conexión con NetSuite

- **Nuevas dependencias**:
  - `requests==2.31.0` - Peticiones HTTP
  - `requests-oauthlib==1.3.1` - OAuth 1.0a
  - `python-dotenv==1.0.0` - Variables de entorno

- **Configuración**:
  - `.env.example` - Plantilla de configuración
  - Soporte para variables de entorno (NS_ACCOUNT, NS_CONSUMER_KEY, etc.)

#### Frontend
- **Nuevo botón**: 📡 Analizar desde NetSuite
- **Función** `submitNetSuiteAnalysis()` - Llama al endpoint de NetSuite
- Flujo dual: Excel O NetSuite, ambos coexisten sin conflicto

#### Documentación
- **NETSUITE_SETUP.md** - Guía completa de configuración (80+ líneas)
  - Configuración paso a paso en NetSuite
  - Despliegue del RESTlet
  - Configuración local
  - Troubleshooting detallado
  - Checklist de configuración

- **RESTLET_NETSUITE.js** - Script SuiteScript 2.1 para desplegar en NetSuite
  - Soporte para Saved Search existente
  - Query dinámica como fallback
  - Filtros de fecha
  - Formato de meses en español
  - Logging y error handling

- **README.md** - Actualizado con:
  - Inicio rápido para ambos flujos
  - Estructura del proyecto
  - Troubleshooting rápido
  - Notas de migración

- **setup.sh** - Script de instalación automática
  - Instala dependencias backend y frontend
  - Crea virtualenv
  - Copia .env.example a .env
  - Instrucciones de próximos pasos

- **.gitignore** - Para proteger credenciales
  - Excluye .env y archivos sensibles
  - Ignora node_modules, __pycache__, etc.

### 🔧 Modificado

#### Backend
- `app/main.py`:
  - Añadido import de `netsuite_client`
  - Añadido import de `python-dotenv`
  - Carga automática de variables de entorno con `load_dotenv()`
  - Nuevos endpoints (líneas 158-245)

- `requirements.txt`:
  - Añadidas 3 dependencias nuevas

### 🛡️ Seguridad
- Archivo `.env` incluido en `.gitignore`
- Credenciales nunca hardcodeadas
- Autenticación OAuth 1.0a estándar
- Timeout de 2 minutos para prevenir ataques DoS

### 📝 Notas de Migración

#### Sin Breaking Changes
- El flujo de Excel sigue funcionando exactamente igual
- No se requiere configuración de NetSuite para usar Excel
- Retrocompatible al 100%

#### Cambios Opcionales
- Si quieres usar NetSuite, sigue la guía en `NETSUITE_SETUP.md`
- Si no configuras NetSuite, el botón simplemente no funcionará (pero no rompe nada)

### 🐛 Correcciones
- Ninguna (nueva funcionalidad)

### ⚠️ Deprecaciones
- Ninguna

---

## [1.0.0] - 2024-XX-XX

### Versión inicial
- Análisis YoY desde archivos Excel
- Interfaz React con visualizaciones
- Backend FastAPI con análisis pandas
- Soporte para múltiples modos (month, YTD, rolling)
- Filtros avanzados
- Exportación a Excel
- Alertas inteligentes (persistentes y recuperación)
- Comparador de periodos
