# 🚀 Guía de Integración con NetSuite

Esta guía te ayudará a configurar la integración con NetSuite para obtener datos de ventas directamente desde la API sin necesidad de subir archivos Excel manualmente.

## 📋 Índice

1. [Configuración en NetSuite](#1-configuración-en-netsuite)
2. [Desplegar el RESTlet](#2-desplegar-el-restlet)
3. [Configuración Local](#3-configuración-local)
4. [Instalación de Dependencias](#4-instalación-de-dependencias)
5. [Ejecución del Proyecto](#5-ejecución-del-proyecto)
6. [Uso de la Funcionalidad](#6-uso-de-la-funcionalidad)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Configuración en NetSuite

### 1.1 Habilitar Token-Based Authentication (TBA)

1. En NetSuite, ve a: **Setup > Company > Enable Features**
2. Pestaña **SuiteCloud**
3. Sección **Manage Authentication**
4. Marca la casilla: **TOKEN-BASED AUTHENTICATION**
5. Guarda los cambios

### 1.2 Crear una Integración

1. Ve a: **Setup > Integration > Manage Integrations > New**
2. Completa los siguientes campos:
   - **Name**: `Early Warning YoY Integration`
   - **State**: `Enabled`
   - **Token-Based Authentication**: ✅ Marcado
3. **Importante**: Anota los siguientes valores que se generan (solo se muestran una vez):
   - **Consumer Key** → Guardar como `NS_CONSUMER_KEY`
   - **Consumer Secret** → Guardar como `NS_CONSUMER_SECRET`
4. Guarda la integración

### 1.3 Generar Access Tokens

1. Ve a: **Setup > Users/Roles > Access Tokens > New**
2. Selecciona:
   - **Application Name**: La integración que acabas de crear
   - **User**: Tu usuario (debe tener permisos de lectura en transacciones)
   - **Role**: El rol que usarás para consultar datos
3. **Importante**: Anota los siguientes valores (solo se muestran una vez):
   - **Token ID** → Guardar como `NS_TOKEN_ID`
   - **Token Secret** → Guardar como `NS_TOKEN_SECRET`
4. Guarda el token

---

## 2. Desplegar el RESTlet

### 2.1 Crear el Script File

1. En NetSuite, ve a: **Documents > Files > SuiteScripts**
2. Crea una nueva carpeta: `EarlyWarning` (opcional, para organización)
3. Sube el archivo `RESTLET_NETSUITE.js` que se encuentra en la carpeta `backend/`

### 2.2 Crear el Script Record

1. Ve a: **Customization > Scripting > Scripts > New**
2. Selecciona el archivo que acabas de subir: `RESTLET_NETSUITE.js`
3. Haz clic en **Create Script Record**

### 2.3 Configurar el Script

1. Completa los campos:
   - **Name**: `Early Warning YoY RESTlet`
   - **ID**: `customscript_ew_yoy_restlet`
   - **Get Function**: `getVentasYoY`
2. En la pestaña **Deployments**, crea un nuevo deployment:
   - **Title**: `Early Warning YoY Deployment`
   - **Status**: `Released`
   - **Log Level**: `Debug` (temporal, para debugging)
   - **Audience**: Selecciona los roles que pueden acceder

### 2.4 Obtener la URL del RESTlet

1. Una vez desplegado, ve al deployment que acabas de crear
2. Copia la **External URL**
3. Debería verse algo así:
   ```
   https://8085023.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=123&deploy=1
   ```
4. Guarda esta URL como `NS_RESTLET_URL`

### 2.5 (IMPORTANTE) Configurar el RESTlet

Antes de usar el RESTlet, debes ajustar el código según tu estructura de NetSuite:

1. Abre el archivo `RESTLET_NETSUITE.js`
2. Revisa las siguientes líneas y ajusta según tus campos personalizados:

```javascript
// Línea 64 - ID del Saved Search (si tienes uno)
var savedSearchId = 'customsearch_ventas_yoy'; // Cambia esto

// Líneas 78-80 - Nombres de campos
var cliente = result.getValue({ name: 'companyname' });
var hotelCode = result.getValue({ name: 'custentity_hotel_code' }); // ← Ajusta este campo
var ubicacion = result.getValue({ name: 'custentity_ubicacion' });  // ← Ajusta este campo
```

**Campos personalizados comunes:**
- `custentity_hotel_code` → Código del hotel
- `custentity_ubicacion` → Ubicación del hotel

Si no tienes estos campos personalizados, puedes:
- Crearlos en NetSuite (Setup > Customization > Entity Fields)
- O usar campos estándar (ej: `entityid`, `custentity_other_field`)

---

## 3. Configuración Local

### 3.1 Crear archivo .env

1. En la carpeta `backend/`, copia el archivo `.env.example` a `.env`:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edita el archivo `.env` con tus credenciales:
   ```env
   # Configuración de NetSuite
   NS_ACCOUNT=8085023
   NS_CONSUMER_KEY=tu_consumer_key_de_la_integracion
   NS_CONSUMER_SECRET=tu_consumer_secret_de_la_integracion
   NS_TOKEN_ID=tu_token_id_del_usuario
   NS_TOKEN_SECRET=tu_token_secret_del_usuario
   NS_RESTLET_URL=https://8085023.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=123&deploy=1
   ```

3. **Importante**: Verifica que el archivo `.env` esté en `.gitignore` para no subir credenciales a Git

---

## 4. Instalación de Dependencias

### 4.1 Backend

```bash
cd backend
pip install -r requirements.txt
```

Nuevas dependencias añadidas:
- `requests==2.31.0` - Para hacer peticiones HTTP
- `requests-oauthlib==1.3.1` - Para autenticación OAuth 1.0a con NetSuite
- `python-dotenv==1.0.0` - Para cargar variables de entorno desde .env

### 4.2 Frontend

```bash
cd frontend
npm install
```

---

## 5. Ejecución del Proyecto

### 5.1 Iniciar Backend

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

El backend estará disponible en: http://localhost:8000

### 5.2 Iniciar Frontend

En otra terminal:

```bash
cd frontend
npm run dev
```

El frontend estará disponible en: http://localhost:5173

---

## 6. Uso de la Funcionalidad

### 6.1 Probar Conexión con NetSuite

Antes de usar la aplicación, prueba que la conexión funcione:

```bash
curl http://localhost:8000/api/netsuite/test
```

Deberías recibir algo como:
```json
{
  "success": true,
  "message": "Conexión exitosa. 150 registros disponibles.",
  "records": 150
}
```

### 6.2 Usar en la Interfaz Web

1. Abre http://localhost:5173 en tu navegador
2. Verás un nuevo botón: **📡 Analizar desde NetSuite**
3. Configura los filtros y parámetros de análisis:
   - Modo de análisis (Mes / YTD / Rolling)
   - Mes de referencia
   - Umbrales de alerta
   - Filtros (ubicación, impacto, variación, etc.)
4. Haz clic en **📡 Analizar desde NetSuite**
5. El sistema:
   - Se conecta a NetSuite vía RESTlet
   - Obtiene los datos de ventas
   - Realiza el análisis YoY
   - Muestra los resultados igual que con Excel

### 6.3 Flujo Dual

El proyecto ahora soporta dos flujos:

**Flujo 1: Excel Manual (original)**
- Sube un archivo Excel
- Haz clic en "Analizar"
- Descarga el reporte

**Flujo 2: NetSuite Automático (nuevo)**
- No necesitas subir archivo
- Haz clic en "📡 Analizar desde NetSuite"
- Los datos se obtienen automáticamente
- Puedes descargar el reporte generado

**Ambos flujos coexisten** sin afectarse mutuamente.

---

## 7. Troubleshooting

### Error: "Configuración de NetSuite incompleta"

**Causa**: Faltan variables de entorno en el archivo `.env`

**Solución**:
1. Verifica que el archivo `backend/.env` exista
2. Revisa que todas las variables estén configuradas:
   ```bash
   cat backend/.env
   ```
3. No debe haber valores con `tu_xxxxx_aqui`

---

### Error: "Error HTTP 401 - Unauthorized"

**Causa**: Credenciales incorrectas o integración no autorizada

**Solución**:
1. Verifica que el Token ID y Token Secret sean correctos
2. Asegúrate de que el token no haya expirado
3. Verifica que el usuario tenga el rol correcto asignado
4. Revisa que la integración esté **Enabled** en NetSuite

---

### Error: "El RESTlet no devolvió las columnas requeridas"

**Causa**: El RESTlet no está devolviendo las columnas esperadas

**Solución**:
1. Verifica que el RESTlet esté usando los campos correctos:
   - `custentity_hotel_code` → Ajústalo a tu campo real
   - `custentity_ubicacion` → Ajústalo a tu campo real
2. Revisa los logs del RESTlet en NetSuite:
   - **Customization > Scripting > Script Execution Log**
3. Prueba el RESTlet directamente desde el navegador (con autenticación)

---

### Error: "Timeout al consultar NetSuite"

**Causa**: El RESTlet está tardando más de 2 minutos

**Solución**:
1. Reduce el rango de fechas usando los parámetros `start_date` y `end_date`
2. Optimiza el Saved Search o la query del RESTlet:
   - Añade índices a los campos filtrados
   - Reduce las columnas devueltas
3. Aumenta el timeout en `netsuite_client.py` (línea 125)

---

### El RESTlet devuelve datos pero el análisis falla

**Causa**: Formato de meses incorrecto

**Solución**:
1. Verifica que los meses estén en formato: `"ene 2024"`, `"feb 2024"`, etc.
2. Revisa la función `formatMonthLabel` en el RESTlet
3. Prueba manualmente con Postman/curl para ver la respuesta:
   ```bash
   curl -X GET "https://tu-restlet-url" \
     -H "Authorization: OAuth ..." \
     -H "Content-Type: application/json"
   ```

---

### El botón "Analizar desde NetSuite" no aparece

**Causa**: El frontend no se actualizó correctamente

**Solución**:
1. Recarga el frontend con cache limpio: `Ctrl + Shift + R`
2. Verifica que el archivo `App.jsx` tenga el botón nuevo
3. Reinicia el servidor de desarrollo del frontend

---

## 📊 Estructura de Datos Esperada

El RESTlet debe devolver un array de objetos JSON con esta estructura:

```json
[
  {
    "Cliente": "Hotel Paradise S.L.",
    "Hotel - Code": "PAR001",
    "Ubicación": "Madrid",
    "ene 2023": 50000.00,
    "feb 2023": 48000.50,
    "mar 2023": 52000.75,
    "abr 2023": 51000.00,
    ... (todos los meses con datos),
    "ene 2024": 55000.00,
    "feb 2024": 53000.25,
    ...
  },
  {
    "Cliente": "Hotel Beach Resort S.A.",
    "Hotel - Code": "BCH002",
    "Ubicación": "Barcelona",
    ...
  }
]
```

**Requisitos**:
- Columna `Cliente` es **obligatoria**
- Columnas `Hotel - Code` y `Ubicación` son **opcionales** pero recomendadas
- Meses deben estar en formato: `"ene 2024"`, `"feb 2024"`, etc. (minúsculas, espacio, año de 4 dígitos)
- Valores numéricos sin símbolos de moneda

---

## 🔐 Seguridad

1. **NUNCA** subas el archivo `.env` a Git
2. **NUNCA** compartas tus Consumer Keys, Secrets o Tokens
3. **Rota** las credenciales periódicamente
4. **Limita** los roles y permisos al mínimo necesario
5. **Monitorea** los logs de acceso en NetSuite

---

## 📝 Notas Adicionales

### Saved Search vs Query Dinámica

El RESTlet incluye **dos opciones**:

1. **Saved Search** (Recomendado):
   - Crea un Saved Search en NetSuite con las columnas exactas
   - Más fácil de mantener y optimizar
   - Permite usar filtros visuales de NetSuite

2. **Query Dinámica**:
   - El RESTlet genera la consulta programáticamente
   - Más flexible pero requiere conocimientos de SuiteScript
   - Úsala si no tienes permisos para crear Saved Searches

### Mapeo del Reporte Original (cr=475)

Si quieres replicar exactamente el reporte original:

1. Abre el reporte: https://8085023.app.netsuite.com/app/reporting/reportrunner.nl?cr=475&reload=T
2. Guárdalo como Saved Search:
   - Haz clic en "Customize"
   - "Save Search"
   - Anota el ID del Saved Search
3. Usa ese ID en el RESTlet (línea 64)

---

## 📞 Soporte

Si tienes problemas:

1. Revisa los logs del backend: busca errores en la terminal donde corre `uvicorn`
2. Revisa los logs de NetSuite: **Customization > Scripting > Script Execution Log**
3. Prueba el endpoint de test: `GET /api/netsuite/test`
4. Verifica las credenciales en el archivo `.env`

---

## ✅ Checklist de Configuración

Antes de usar la integración, verifica:

- [ ] Token-Based Authentication habilitado en NetSuite
- [ ] Integración creada y habilitada
- [ ] Access Tokens generados
- [ ] RESTlet desplegado y accesible
- [ ] Archivo `.env` creado con todas las variables
- [ ] Dependencias instaladas (`pip install -r requirements.txt`)
- [ ] Backend corriendo en puerto 8000
- [ ] Frontend corriendo en puerto 5173
- [ ] Test de conexión exitoso (`/api/netsuite/test`)

---

¡Listo! Ahora puedes analizar tus datos de NetSuite sin necesidad de exportar a Excel. 🎉
