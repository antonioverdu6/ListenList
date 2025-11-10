import os
import django
import sys
from pathlib import Path
# ensure project root is on sys.path (musica/scripts -> parents[2] is project root)
sys.path.append(str(Path(__file__).resolve().parents[2]))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'redmusical.settings')
django.setup()
from musica.models import Artista

if __name__ == '__main__':
    for a in Artista.objects.all()[:10]:
        print(f"Artista id={a.id} nombre='{a.nombre}' -> valoracion_media={a.valoracion_media()}")
