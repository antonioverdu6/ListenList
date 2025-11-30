# 🚀 GUÍA DE DESPLIEGUE COMPLETA

## 📋 RESUMEN DE ARCHIVOS CREADOS

### Backend (Django)
- ✅ `requirements.txt` - Actualizado con gunicorn, whitenoise, psycopg2
- ✅ `Procfile` - Para Render (web + worker)
- ✅ `build.sh` - Script de build para Render
- ✅ `runtime.txt` - Versión de Python
- ✅ `redmusical/settings.py` - Configurado para producción
- ✅ `.env.example` - Variables de entorno de ejemplo

### Frontend (React)
- ✅ `netlify.toml` - Configuración de Netlify
- ✅ `frontend/.env.example` - Variables de entorno
- ✅ `frontend/src/config/api.js` - Configuración de API
- ✅ `frontend/src/services/api.js` - Funciones para llamar al backend

---

## 🔧 PARTE 1: PREPARAR BACKEND PARA RENDER

### Paso 1: Configurar variables de entorno locales

Crea `.env` (NO lo subas a Git):

```bash
SECRET_KEY=$(python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')
DEBUG=False
FRONTEND_URL=http://localhost:3000
```

### Paso 2: Probar localmente con gunicorn

```bash
# Instalar dependencias
pip install -r requirements.txt

# Recolectar archivos estáticos
python manage.py collectstatic --no-input

# Probar gunicorn
gunicorn redmusical.wsgi:application --bind 127.0.0.1:8000
```

### Paso 3: Hacer build.sh ejecutable (Linux/Mac)

```bash
chmod +x build.sh
```

---

## 📤 PARTE 2: SUBIR A GITHUB

```bash
# Asegúrate de tener .gitignore actualizado
echo "*.env
*.pyc
__pycache__/
db.sqlite3
media/
staticfiles/
node_modules/
build/" >> .gitignore

# Commit y push
git add .
git commit -m "Configuración para despliegue en Render + Netlify"
git push origin master
```

---

## 🌐 PARTE 3: DESPLEGAR BACKEND EN RENDER

### 3.1: Crear servicio en Render

1. Ve a https://render.com y crea una cuenta
2. Click en **"New +"** → **"Web Service"**
3. Conecta tu repositorio de GitHub
4. Configura:
   - **Name**: `listenlist-backend` (o el que prefieras)
   - **Region**: Elige el más cercano
   - **Branch**: `master`
   - **Root Directory**: (vacío, tu proyecto está en la raíz)
   - **Runtime**: `Python 3`
   - **Build Command**: `./build.sh`
   - **Start Command**: `gunicorn redmusical.wsgi:application`

### 3.2: Configurar Base de Datos PostgreSQL

1. En Render Dashboard, click **"New +"** → **"PostgreSQL"**
2. Configura:
   - **Name**: `listenlist-db`
   - **Database**: `listenlist`
   - **User**: (auto-generado)
   - **Region**: El mismo que tu web service
3. Click **"Create Database"**
4. Copia el **Internal Database URL**

### 3.3: Variables de entorno en Render

En tu Web Service → **"Environment"**, añade:

```
SECRET_KEY=<genera-uno-nuevo-largo-y-aleatorio>
DEBUG=False
RENDER_EXTERNAL_HOSTNAME=tu-app.onrender.com
FRONTEND_URL=https://tu-app.netlify.app
DATABASE_URL=<pega-aqui-la-URL-de-postgres>
SPOTIPY_CLIENT_ID=<tu-spotify-client-id>
SPOTIPY_CLIENT_SECRET=<tu-spotify-client-secret>
```

**Generar SECRET_KEY segura:**
```python
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

### 3.4: Configurar Redis (opcional, para Channels)

1. **"New +"** → **"Redis"**
2. Name: `listenlist-redis`
3. En tu Web Service, añadir variables:
```
REDIS_HOST=<tu-redis-hostname>
REDIS_PORT=6379
```

### 3.5: Añadir Background Worker

1. En tu Web Service → **"Settings"**
2. Busca **"Background Workers"**
3. Añade worker:
   - **Name**: `spotify-worker`
   - **Command**: `python manage.py process_spotify_queue --loop`

### 3.6: Deploy

1. Click **"Manual Deploy"** → **"Deploy latest commit"**
2. Espera ~5-10 minutos
3. Tu backend estará en: `https://tu-app.onrender.com`

---

## 🎨 PARTE 4: DESPLEGAR FRONTEND EN NETLIFY

### 4.1: Actualizar todas las llamadas API

En cada componente que haga fetch, importa y usa el servicio:

```javascript
// ANTES (hardcoded):
fetch('http://localhost:8000/musica/canciones/')

// DESPUÉS (usando el servicio):
import { getCanciones } from '../services/api';

const canciones = await getCanciones();
```

### 4.2: Preparar repositorio

```bash
cd frontend

# Crear .env para desarrollo
echo "REACT_APP_API_URL=http://localhost:8000" > .env

# Añadir a .gitignore
echo ".env" >> .gitignore

# Probar build local
npm run build
```

### 4.3: Subir a GitHub

```bash
git add .
git commit -m "Configuración Netlify + variables de entorno"
git push origin master
```

### 4.4: Desplegar en Netlify

1. Ve a https://netlify.com
2. Click **"Add new site"** → **"Import an existing project"**
3. Conecta GitHub → Selecciona tu repositorio
4. Configura:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/build`
   - **Branch**: `master`

### 4.5: Variables de entorno en Netlify

1. En tu sitio → **"Site settings"** → **"Environment variables"**
2. Añadir:
```
REACT_APP_API_URL=https://tu-app.onrender.com
```

3. **"Deploys"** → **"Trigger deploy"** → **"Deploy site"**

### 4.6: Configurar dominio personalizado (opcional)

1. **"Domain settings"** → **"Add custom domain"**
2. Sigue las instrucciones de DNS

---

## 🔗 PARTE 5: CONECTAR FRONTEND ↔ BACKEND

### 5.1: Actualizar CORS en Render

En las variables de entorno de Render, actualiza:

```
FRONTEND_URL=https://tu-sitio.netlify.app
```

Redeploy el backend.

### 5.2: Probar la conexión

Abre tu sitio de Netlify y verifica:

1. **Consola del navegador**: No debería haber errores CORS
2. **Network tab**: Las peticiones van a tu backend de Render
3. **Login/Registro**: Funcionan correctamente

---

## 🐛 ERRORES COMUNES Y SOLUCIONES

### ❌ Error: "CORS policy blocked"

**Causa**: Frontend URL no está en CORS_ALLOWED_ORIGINS

**Solución**:
1. Ve a Render → Environment variables
2. Actualiza `FRONTEND_URL` con tu URL de Netlify exacta
3. Redeploy

### ❌ Error: "Static files not found"

**Causa**: WhiteNoise no configurado correctamente

**Solución**:
```python
# En settings.py, verifica:
MIDDLEWARE = [
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Debe estar aquí
    # ...
]

STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

### ❌ Error: "Database connection failed"

**Causa**: DATABASE_URL mal configurada

**Solución**:
1. En Render PostgreSQL, copia **Internal Database URL**
2. Pega exactamente en variable `DATABASE_URL`
3. Asegúrate que `psycopg2-binary` está en requirements.txt

### ❌ Error: "Cannot connect to backend"

**Causa**: API_URL apunta a localhost

**Solución**:
1. En Netlify → Environment variables
2. Verifica `REACT_APP_API_URL=https://tu-backend.onrender.com`
3. Redeploy frontend

### ❌ Error: "502 Bad Gateway" en Render

**Causa**: El proceso no inicia correctamente

**Solución**:
1. Revisa logs en Render Dashboard
2. Verifica que `Procfile` existe:
```
web: gunicorn redmusical.wsgi:application
```
3. Asegúrate que `build.sh` tiene permisos

### ❌ Error: "Blank page" en Netlify

**Causa**: React Router no configurado para SPAs

**Solución**:
Verifica que `netlify.toml` tiene:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## ✅ CHECKLIST FINAL

### Backend (Render)
- [ ] PostgreSQL creado y conectado
- [ ] Variables de entorno configuradas
- [ ] Build exitoso (revisa logs)
- [ ] Endpoint `/admin/` carga correctamente
- [ ] Migraciones ejecutadas (`python manage.py migrate`)
- [ ] Superusuario creado (desde shell de Render)

### Frontend (Netlify)
- [ ] Build exitoso
- [ ] Variables de entorno configuradas
- [ ] Sitio carga sin errores de consola
- [ ] Peticiones van al backend de Render (Network tab)
- [ ] Login/registro funcionan

### Conexión
- [ ] No hay errores CORS
- [ ] Tokens JWT se guardan correctamente
- [ ] Refresh token funciona
- [ ] WebSockets (si usas) conectan correctamente

---

## 🚀 SIGUIENTES PASOS

1. **Monitoreo**: Activa alertas en Render para caídas
2. **Logs**: Revisa logs regularmente en Render Dashboard
3. **Backups**: Configura backups automáticos de PostgreSQL
4. **CDN**: Netlify ya incluye CDN, pero verifica caché
5. **SSL**: Render y Netlify proveen SSL gratis automáticamente
6. **Custom Domain**: Configura tu propio dominio
7. **Analytics**: Añade Google Analytics o Plausible

---

## 📞 SOPORTE

Si tienes problemas:
1. Revisa logs en Render Dashboard
2. Revisa consola del navegador
3. Verifica variables de entorno
4. Prueba endpoints con Postman/Thunder Client

---

¡Tu aplicación ya está desplegada! 🎉
