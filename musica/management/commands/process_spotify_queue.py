import time
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import models
from django.utils import timezone

from musica.models import SpotifyTrackFetch
from musica.spotify_client import get_or_create_cancion
from spotipy.exceptions import SpotifyException


class Command(BaseCommand):
    help = "Process pending Spotify track fetch tasks"

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=5, help="Number of tracks to process per run")
        parser.add_argument("--loop", action="store_true", help="Continuously process the queue")
        parser.add_argument("--sleep", type=int, default=30, help="Seconds to wait between loop iterations when queue is empty")

    def handle(self, *args, **options):
        limit = options["limit"]
        loop = options["loop"]
        sleep_seconds = max(1, options["sleep"])

        if loop:
            self.stdout.write(self.style.SUCCESS("Starting Spotify queue worker in loop mode"))

        while True:
            processed_any = self._process_once(limit)
            if not loop:
                break
            delay = 1 if processed_any else sleep_seconds
            time.sleep(delay)

    def _process_once(self, limit):
        now = timezone.now()
        pending_qs = SpotifyTrackFetch.objects.filter(
            models.Q(status=SpotifyTrackFetch.STATUS_PENDING)
            | models.Q(status=SpotifyTrackFetch.STATUS_ERROR, next_retry_at__lte=now)
        ).order_by("created_at")

        tasks = list(pending_qs[:limit])
        if not tasks:
            self.stdout.write(self.style.SUCCESS("No pending Spotify tracks to process."))
            return False

        for task in tasks:
            self.stdout.write(f"Processing {task.spotify_id} (attempt {task.attempts + 1})")
            try:
                get_or_create_cancion(task.spotify_id)
            except SpotifyException as exc:
                self._mark_error(task, exc)
            except Exception as exc:  # pragma: no cover - defensive
                self._mark_error(task, exc)
            else:
                task.status = SpotifyTrackFetch.STATUS_SUCCESS
                task.last_error = ""
                task.next_retry_at = None
                task.attempts = task.attempts + 1
                task.save(update_fields=["status", "last_error", "next_retry_at", "attempts", "updated_at"])
                self.stdout.write(self.style.SUCCESS(f"Fetched {task.spotify_id}"))

        return True

    def _mark_error(self, task, exc):
        task.status = SpotifyTrackFetch.STATUS_ERROR
        task.attempts = task.attempts + 1
        wait_seconds = min(60 * (task.attempts or 1), 300)
        task.next_retry_at = timezone.now() + timedelta(seconds=wait_seconds)
        task.last_error = str(exc)
        task.save(update_fields=["status", "attempts", "next_retry_at", "last_error", "updated_at"])
        self.stderr.write(self.style.WARNING(f"Failed {task.spotify_id}: {exc}"))
