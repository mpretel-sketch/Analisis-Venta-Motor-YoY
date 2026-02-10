# 📊 Early Warning YoY - Sistema de Análisis de Ventas

Sistema de análisis de ventas Year-over-Year con integración directa a NetSuite.

## 🚀 Inicio Rápido

### Opción 1: Usar con Excel (Sin NetSuite)

```bash
# 1. Instalar dependencias del backend
cd backend
pip install -r requirements.txt

# 2. Ejecutar backend
uvicorn app.main:app --reload --port 8000

# 3. En otra terminal, ejecutar frontend
cd ../frontend
npm install
npm run dev
```

Abre http://localhost:5173 y sube tu archivo Excel para analizar.

---

### Opción 2: Integración con NetSuite

Si quieres obtener datos directamente desde NetSuite sin subir Excel:

**👉 Lee la guía completa: [NETSUITE_SETUP.md](./NETSUITE_SETUP.md)**

Resumen de pasos:

1. **Configurar NetSuite**:
   - Habilitar Token-Based Authentication
   - Crear integración y obtener Consumer Key/Secret
   - Generar Access Tokens
   - Desplegar el RESTlet (`backend/RESTLET_NETSUITE.js`)

2. **Configurar local**:
   ```bash
   cd backend
   cp .env.example .env
   # Editar .env con tus credenciales de NetSuite
   ```

3. **Ejecutar**:
   ```bash
   # Backend
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000

   # Frontend (nueva terminal)
   cd frontend
   npm install
   npm run dev
   ```

4. **Usar**:
   - Abre http://localhost:5173
   - Haz clic en **📡 Analizar desde NetSuite**

---

## 📁 Estructura del Proyecto

```
Análisis Vebta Motor YoY/
├── backend/
│   ├── app/
│   │   ├── main.py              # Endpoints FastAPI
│   │   ├── analysis.py          # Lógica de análisis YoY
│   │   └── netsuite_client.py   # Cliente de NetSuite (nuevo)
│   ├── .env.example             # Plantilla de configuración
│   ├── requirements.txt         # Dependencias Python
│   └── RESTLET_NETSUITE.js      # Script para desplegar en NetSuite
├── frontend/
│   └── src/
│       └── App.jsx              # Interfaz React (con botón NetSuite)
├── NETSUITE_SETUP.md            # Guía completa de integración NetSuite
└── README.md                    # Este archivo
```

---

## 🆕 Nuevas Funcionalidades

### Endpoints Nuevos

1. **POST /api/analyze/netsuite**
   - Obtiene datos desde NetSuite vía RESTlet
   - Mismos parámetros que `/api/analyze` pero sin archivo
   - Parámetros adicionales: `start_date`, `end_date`

2. **GET /api/netsuite/test**
   - Prueba la conexión con NetSuite
   - Útil para verificar credenciales

### Interfaz

- **Nuevo botón**: 📡 Analizar desde NetSuite
- **Flujo dual**: Puedes usar Excel O NetSuite, ambos funcionan
- **Mismo análisis**: Ambas fuentes usan la misma lógica de análisis

---

## 🔧 Dependencias Nuevas

### Backend

```txt
requests==2.31.0           # Peticiones HTTP
requests-oauthlib==1.3.1   # OAuth 1.0a para NetSuite
python-dotenv==1.0.0       # Variables de entorno
```

---

## 🧪 Probar la Integración

### 1. Test de conexión básico

```bash
curl http://localhost:8000/api/netsuite/test
```

Respuesta esperada:
```json
{
  "success": true,
  "message": "Conexión exitosa. 150 registros disponibles.",
  "records": 150
}
```

### 2. Test de análisis desde NetSuite

```bash
curl -X POST http://localhost:8000/api/analyze/netsuite \
  -F "mode=month" \
  -F "alert_threshold=-30"
```

---

## ❗ Troubleshooting Rápido

| Error | Causa | Solución |
|-------|-------|----------|
| "Configuración de NetSuite incompleta" | Falta archivo `.env` | Copia `.env.example` a `.env` y configura |
| "Error HTTP 401" | Credenciales incorrectas | Verifica Consumer Keys y Tokens |
| "El RESTlet no devolvió columnas requeridas" | Campos personalizados incorrectos | Ajusta campos en `RESTLET_NETSUITE.js` |
| "Timeout" | Query muy grande | Añade filtros de fecha o optimiza RESTlet |

**👉 Ver troubleshooting completo en [NETSUITE_SETUP.md](./NETSUITE_SETUP.md#7-troubleshooting)**

---

## 📝 Notas de Migración

### ¿Necesito cambiar mi código existente?

**NO**. La integración con NetSuite es completamente opcional:

- ✅ El flujo de Excel sigue funcionando exactamente igual
- ✅ No hay breaking changes
- ✅ Puedes usar ambos flujos simultáneamente
- ✅ Si no configuras NetSuite, simplemente no aparecerá el botón (aparece pero da error si no está configurado)

### ¿Qué archivos se modificaron?

**Backend**:
- `app/main.py` - Añadido import y 2 endpoints nuevos
- `app/netsuite_client.py` - Archivo nuevo
- `requirements.txt` - 3 dependencias nuevas

**Frontend**:
- `src/App.jsx` - Función nueva y botón nuevo

**Nuevos archivos**:
- `backend/.env.example` - Plantilla de configuración
- `backend/RESTLET_NETSUITE.js` - Script para NetSuite
- `NETSUITE_SETUP.md` - Documentación
- `.gitignore` - Para no subir credenciales

---

## 🔐 Seguridad

- ⚠️ **NUNCA** subas el archivo `.env` a Git
- ⚠️ El archivo `.env` está en `.gitignore`
- ⚠️ Rota las credenciales periódicamente
- ⚠️ Limita los permisos en NetSuite al mínimo necesario

---

## 📞 Soporte

**Para problemas con NetSuite**: Ver [NETSUITE_SETUP.md](./NETSUITE_SETUP.md)

**Para problemas generales**:
1. Verifica los logs del backend (terminal de uvicorn)
2. Verifica los logs del frontend (consola del navegador)
3. Revisa que todas las dependencias estén instaladas

---

## ✨ Roadmap

Posibles mejoras futuras:
- [ ] Cache de datos de NetSuite
- [ ] Sincronización automática periódica
- [ ] Webhooks para actualizaciones en tiempo real
- [ ] Dashboard de monitoreo de conexiones
- [ ] Soporte para múltiples cuentas de NetSuite

---

Hecho con ❤️ para automatizar análisis de ventas.
