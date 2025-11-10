from django.core.management.base import BaseCommand
from musica.models import Cancion
from musica.audd_api import obtener_letra
import time
import os


class Command(BaseCommand):
    help = "Rellena letras usando la API de AudD para canciones sin letra."

    def add_arguments(self, parser):
        parser.add_argument("--batch", type=int, default=10, help="Número de canciones a procesar")
        parser.add_argument("--delay", type=float, default=1.5, help="Segundos de espera entre peticiones")
        parser.add_argument("--debug", action="store_true", help="Activa DEBUG_AUDD durante la ejecución (no persiste)")

    def handle(self, *args, **options):
        batch = options["batch"]
        delay = options["delay"]
        debug_flag = options["debug"]

        # Opción segura: no modificar variables del entorno permanentemente
        if debug_flag:
            os.environ.setdefault("DEBUG_AUDD", "true")

        qs = Cancion.objects.filter(letra__isnull=True)[:batch]
        self.stdout.write(self.style.NOTICE(f"Procesando {qs.count()} canciones (batch={batch}, delay={delay})"))

        for c in qs:
            titulo = c.titulo
            artista = getattr(getattr(c.album, "artista", None), "nombre", "")
            self.stdout.write(f"Intentando {c.id} | {titulo} — {artista}")
            try:
                l = obtener_letra(titulo, artista)
            except Exception as e:
                self.stderr.write(f"  ERROR en obtener_letra: {e}")
                l = None

            if l:
                c.letra = l
                c.save(update_fields=["letra"])
                self.stdout.write(self.style.SUCCESS(f"  -> GUARDADA (longitud {len(l)})"))
            else:
                self.stdout.write(self.style.WARNING("  -> No encontrada"))

            time.sleep(delay)

        # limpiar flag DEBUG si lo activamos sólo temporalmente
        if debug_flag:
            try:
                del os.environ["DEBUG_AUDD"]
            except KeyError:
                pass

        self.stdout.write(self.style.SUCCESS("Proceso terminado."))
