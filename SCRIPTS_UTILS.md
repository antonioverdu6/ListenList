# 🔧 Scripts de Utilidad para Despliegue

## 1. Generar SECRET_KEY segura
```python
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

## 2. Verificar configuración antes de deploy
```bash
python check_config.py
```

## 3. Test local con Gunicorn (simular Render)
```bash
# Instalar dependencias
pip install -r requirements.txt

# Recolectar archivos estáticos
python manage.py collectstatic --no-input

# Probar gunicorn
gunicorn redmusical.wsgi:application --bind 127.0.0.1:8000 --workers 2
```

## 4. Crear superusuario en Render
```bash
# En Render Dashboard → Shell
python manage.py createsuperuser
```

## 5. Ver logs en tiempo real (Render)
En Render Dashboard → Tu servicio → Logs

## 6. Ejecutar migraciones manualmente
```bash
# Render Shell
python manage.py migrate
```

## 7. Test CORS local
```bash
# Instalar httpie
pip install httpie

# Test endpoint
http GET http://localhost:8000/musica/canciones/ Origin:http://localhost:3000
```

## 8. Build frontend local
```bash
cd frontend
npm run build
# Servir build local
npx serve -s build
```

## 9. Limpiar archivos estáticos
```bash
python manage.py collectstatic --clear --no-input
```

## 10. Verificar variables de entorno (local)
```bash
# Windows PowerShell
$env:SECRET_KEY
$env:DEBUG

# Linux/Mac
echo $SECRET_KEY
echo $DEBUG
```

## 11. Test API con curl
```bash
# Login
curl -X POST https://tu-app.onrender.com/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"tu_usuario","password":"tu_password"}'

# Get canciones (con token)
curl https://tu-app.onrender.com/musica/canciones/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 12. Verificar health del servicio
```bash
curl https://tu-app.onrender.com/admin/
```

## 13. Backup database (Render)
En Render Dashboard → PostgreSQL → Backups → Create Backup

## 14. Restaurar backup local
```bash
# Desde Render PostgreSQL
pg_dump -h hostname -U username dbname > backup.sql

# Restaurar local
psql -h localhost -U postgres dbname < backup.sql
```

## 15. Ver tamaño de base de datos
```python
# Render Shell
from django.db import connection
cursor = connection.cursor()
cursor.execute("SELECT pg_size_pretty(pg_database_size(current_database()))")
print(cursor.fetchone()[0])
```

## 16. Flush cache (si usas Redis)
```python
# Render Shell
from django.core.cache import cache
cache.clear()
```

## 17. Test WebSockets (si usas Channels)
```javascript
// En consola del navegador
const ws = new WebSocket('wss://tu-app.onrender.com/ws/...');
ws.onopen = () => console.log('Conectado');
ws.onmessage = (e) => console.log('Mensaje:', e.data);
```

## 18. Monitoring y alertas
```bash
# Instalar Sentry (opcional)
pip install sentry-sdk

# En settings.py
import sentry_sdk
sentry_sdk.init(
    dsn="tu-dsn-de-sentry",
    traces_sample_rate=1.0,
)
```

## 19. Performance test
```bash
# Instalar Apache Bench
# Linux: apt-get install apache2-utils
# Mac: viene preinstalado

# Test 100 requests, 10 concurrentes
ab -n 100 -c 10 https://tu-app.onrender.com/musica/canciones/
```

## 20. Verificar SSL
```bash
curl -I https://tu-app.onrender.com
# Debe mostrar SSL/TLS info
```
