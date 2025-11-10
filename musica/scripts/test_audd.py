# scripts moved from project root into musica/scripts
import os
import sys
from pathlib import Path

# Ensure project root is on sys.path so `redmusical` settings can be imported
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'redmusical.settings')
import django
django.setup()

from musica.models import Cancion
from musica.audd_api import obtener_letra

# Cambia este id por uno de los que listaste (por ejemplo 90)
ID_PROBAR = 90

c = Cancion.objects.get(id=ID_PROBAR)
titulo = c.titulo
artista = getattr(getattr(c.album, "artista", None), "nombre", "")
print("Probando:", c.id, titulo, "| artista:", artista)
letra = obtener_letra(titulo, artista)
print("DEVUELVE:", type(letra), "contenido?", bool(letra))
if letra:
    print("---- 800 primeros caracteres ----")
    print(letra[:800])
else:
    print("No se devolvió letra (None o cadena vacía)")
