from django.core.management.base import BaseCommand
from django.db import transaction, connection
from django.conf import settings
from django.utils import timezone
import shutil
import os

from musica.models import Artista, Album, ComentarioArtista, ValoracionArtista


def _normalize(s):
    if s is None:
        return ""
    return str(s).strip().lower()


class Command(BaseCommand):
    help = 'Merge duplicate Artista rows that share the same nombre and imagen_url (normalized).'

    def add_arguments(self, parser):
        parser.add_argument('--no-backup', action='store_true', help='Do not create a sqlite backup before running')

    def handle(self, *args, **options):
        # If using sqlite, make a backup of the database file by default
        if not options.get('no_backup'):
            db_settings = settings.DATABASES.get('default', {})
            engine = db_settings.get('ENGINE', '')
            if 'sqlite' in engine:
                db_path = db_settings.get('NAME')
                if db_path and os.path.exists(db_path):
                    bak_name = f"{db_path}.bak.{timezone.now().strftime('%Y%m%d%H%M%S')}"
                    shutil.copy2(db_path, bak_name)
                    self.stdout.write(self.style.SUCCESS(f'SQLite backup created: {bak_name}'))

        # Build grouping key -> list of artista instances
        groups = {}
        for artista in Artista.objects.all():
            key = (_normalize(artista.nombre), _normalize(artista.imagen_url))
            groups.setdefault(key, []).append(artista)

        total_merged = 0
        for key, artistas in groups.items():
            if len(artistas) <= 1:
                continue

            # choose survivor: the one with smallest id (oldest)
            artistas_sorted = sorted(artistas, key=lambda a: (a.id or 0))
            survivor = artistas_sorted[0]
            duplicates = artistas_sorted[1:]

            with transaction.atomic():
                self.stdout.write(f"Merging {len(duplicates)} duplicates into Artista id={survivor.id} nombre='{survivor.nombre}'")

                # Merge genres: add all genres from duplicates
                for dup in duplicates:
                    for genero in dup.generos.all():
                        survivor.generos.add(genero)

                # Reassign albums
                albums_moved = 0
                for dup in duplicates:
                    moved = Album.objects.filter(artista=dup).update(artista=survivor)
                    albums_moved += moved

                # Reassign comentarios de artista
                ComentarioArtista.objects.filter(artista__in=[d.id for d in duplicates]).update(artista=survivor)

                # Reassign valoraciones de artista, avoid unique_together conflicts
                valores = ValoracionArtista.objects.filter(artista__in=[d.id for d in duplicates])
                resolved = 0
                for val in valores:
                    existing = ValoracionArtista.objects.filter(autor=val.autor, artista=survivor).first()
                    if existing:
                        # keep the higher puntuacion
                        if (val.puntuacion or 0) > (existing.puntuacion or 0):
                            existing.puntuacion = val.puntuacion
                            existing.save()
                        # remove duplicate
                        val.delete()
                    else:
                        val.artista = survivor
                        val.save()
                    resolved += 1

                # Delete duplicate artists
                dup_ids = [d.id for d in duplicates]
                deleted_count, _ = Artista.objects.filter(id__in=dup_ids).delete()

                self.stdout.write(self.style.SUCCESS(f" -> moved {albums_moved} album(s), resolved {resolved} valoracion(s), deleted {deleted_count} duplicate artista rows"))
                total_merged += len(duplicates)

        self.stdout.write(self.style.SUCCESS(f'Deduplication complete. Total merged artists: {total_merged}'))