# 🚀 QUICK START - Despliegue Rápido

## Pre-requisitos
- Cuenta en [Render.com](https://render.com) (gratis)
- Cuenta en [Netlify](https://netlify.com) (gratis)
- Repositorio en GitHub

---

## ⚡ Backend en Render (5 minutos)

### 1. Push a GitHub
```bash
git add .
git commit -m "Configuración para producción"
git push origin master
```

### 2. Crear Web Service en Render
1. Render.com → **New +** → **Web Service**
2. Conectar tu repo de GitHub
3. Configurar:
   - **Build Command**: `./build.sh`
   - **Start Command**: `gunicorn redmusical.wsgi:application`

### 3. Crear PostgreSQL Database
1. **New +** → **PostgreSQL**
2. Copiar **Internal Database URL**

### 4. Variables de Entorno en Render
```
SECRET_KEY=<genera-con: python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'>
DEBUG=False
DATABASE_URL=<pega-postgres-url>
FRONTEND_URL=https://tu-app.netlify.app
RENDER_EXTERNAL_HOSTNAME=<tu-app>.onrender.com
SPOTIPY_CLIENT_ID=<tu-client-id>
SPOTIPY_CLIENT_SECRET=<tu-client-secret>
```

### 5. Deploy
Click **Manual Deploy** → Espera 5-10 minutos

✅ Backend listo en: `https://tu-app.onrender.com`

---

## 🎨 Frontend en Netlify (3 minutos)

### 1. Configurar variable de entorno local
```bash
cd frontend
echo "REACT_APP_API_URL=http://localhost:8000" > .env
```

### 2. Crear sitio en Netlify
1. Netlify.com → **Add new site** → **Import from Git**
2. Seleccionar tu repo
3. Configurar:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/build`

### 3. Variables de Entorno en Netlify
En Site settings → Environment variables:
```
REACT_APP_API_URL=https://tu-app.onrender.com
```

### 4. Redeploy
Deploys → Trigger deploy

✅ Frontend listo en: `https://tu-app.netlify.app`

---

## 🔗 Conectar Frontend ↔ Backend

### Actualizar FRONTEND_URL en Render
1. Render → Tu servicio → Environment
2. Actualizar `FRONTEND_URL` con tu URL de Netlify
3. Manual Deploy

---

## ✅ Verificar

### Backend
- [ ] `https://tu-app.onrender.com/admin/` carga
- [ ] Sin errores en logs de Render

### Frontend
- [ ] Sitio carga sin errores
- [ ] No hay errores CORS en consola
- [ ] Login funciona

---

## 🐛 Problemas?

### CORS Error
→ Verifica que `FRONTEND_URL` en Render sea exactamente tu URL de Netlify

### Backend no inicia
→ Revisa logs en Render Dashboard

### Frontend muestra página blanca
→ Verifica que `netlify.toml` existe en `frontend/`

---

## 📚 Documentación Completa
Lee `DEPLOYMENT_GUIDE.md` para instrucciones detalladas.

---

## 🆘 Comandos Útiles

```bash
# Verificar configuración
python check_config.py

# Generar SECRET_KEY nueva
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'

# Test local con gunicorn
gunicorn redmusical.wsgi:application

# Recolectar static files
python manage.py collectstatic --no-input
```
