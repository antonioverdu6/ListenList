# Script para rellenar letras desde AudD (ejecutar con: python manage.py shell < scripts/fill_lyrics.py)
from musica.models import Cancion
from musica.audd_api import obtener_letra
import time, sys

# Configura aquí si quieres un batch menor/greater
BATCH = 10
DELAY = 1.5  # segundos entre peticiones

qs = Cancion.objects.filter(letra__isnull=True)[:BATCH]
print("Procesando", qs.count(), "canciones")

for c in qs:
    titulo = c.titulo
    artista = getattr(getattr(c.album, "artista", None), "nombre", "")
    print(f"Intentando {c.id} | {titulo} — {artista}")
    try:
        l = obtener_letra(titulo, artista)
    except Exception as e:
        print("  ERROR en obtener_letra:", e, file=sys.stderr)
        l = None

    if l:
        c.letra = l
        c.save(update_fields=["letra"])
        print("  -> GUARDADA (longitud)", len(l))
    else:
        print("  -> No encontrada")
    time.sleep(DELAY)
