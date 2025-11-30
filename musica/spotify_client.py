import logging
import os
import time
from threading import Lock

import spotipy
from spotipy.exceptions import SpotifyException
from spotipy.oauth2 import SpotifyClientCredentials
from .utils import normalizar_fecha


logger = logging.getLogger(__name__)

try:
    sp = spotipy.Spotify(
        auth_manager=SpotifyClientCredentials(
            client_id=os.environ.get('SPOTIPY_CLIENT_ID'),
            client_secret=os.environ.get('SPOTIPY_CLIENT_SECRET')
        ),
        requests_timeout=6,
        retries=0,
    )
except Exception as exc:  # pragma: no cover - depends on external service
    logger.warning("No se pudo inicializar el cliente de Spotify: %s", exc)
    sp = None

_last_call_ts = 0.0
_call_lock = Lock()

def _throttle_min_interval(min_interval=0.25):
    """Simple mutex-based throttle to keep a minimum gap between Spotify calls."""
    global _last_call_ts
    with _call_lock:
        now = time.monotonic()
        wait = min_interval - (now - _last_call_ts)
        if wait > 0:
            time.sleep(wait)
            now = time.monotonic()
        _last_call_ts = now

def _call_spotify(method, *args, retry_on_429=True, **kwargs):
    """Call a Spotipy method with a single optional retry when Spotify returns 429."""
    if not sp:
        raise RuntimeError("Spotify client not available")  # pragma: no cover

    try:
        _throttle_min_interval()
        return method(*args, **kwargs)
    except SpotifyException as exc:
        if retry_on_429 and getattr(exc, "http_status", None) == 429:
            headers = getattr(exc, "headers", {}) or {}
            raw_retry = headers.get("Retry-After") or headers.get("retry-after")
            wait_seconds = 5.0
            if raw_retry is not None:
                try:
                    wait_seconds = float(raw_retry)
                except (TypeError, ValueError):
                    wait_seconds = 5.0
            wait_seconds = max(0.5, min(wait_seconds, 8.0))
            logger.warning(
                "Spotify rate limit hit (%s). Waiting %.1fs before retrying %s",
                exc, wait_seconds, getattr(method, "__name__", method)
            )
            time.sleep(wait_seconds)
            _throttle_min_interval()
            return method(*args, **kwargs)
        raise


def buscar_canciones(query, limit=17):
    if not sp:
        logger.debug("Cliente Spotify no disponible; devolveremos lista vacía")
        return []

    try:
        results = _call_spotify(sp.search, q=query, type='track', limit=limit)
    except Exception as exc:  # pragma: no cover - network failures
        logger.warning("Fallo buscando canciones en Spotify: %s", exc)
        return []

    canciones = []
    # Keep the loop lightweight to avoid hitting Spotify rate limits.
    for item in results.get('tracks', {}).get('items', []):
        canciones.append({
            'nombre': item['name'],
            'artista': item['artists'][0]['name'] if item.get('artists') else None,
            'album': item['album']['name'] if item.get('album') else None,
            'imagen': item['album']['images'][0]['url'] if item.get('album') and item['album'].get('images') else '',
            'spotify_id': item['id'],
            'preview_url': item.get('preview_url'),
            'generos': [],
        })
    return canciones


def get_or_create_artista(spotify_id, *, fallback_name=None):
    from .models import Artista
    from .models import Genero
    # First, try to find by spotify_id field in DB
    artista = Artista.objects.filter(spotify_id=spotify_id).first()

    data = None
    should_fetch = not artista or not getattr(artista, "imagen_url", None)

    if sp and should_fetch:
        try:
            data = _call_spotify(sp.artist, spotify_id)
        except SpotifyException as exc:  # pragma: no cover - depends on external service
            logger.warning("Spotify artist lookup failed (%s): %s", getattr(exc, "http_status", "?"), exc)
            data = None
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Spotify artist lookup error: %s", exc)
            data = None

    if data:
        nombre = data.get('name')

        if not artista:
            # prefer to create by spotify_id to keep stable linkage
            artista, created = Artista.objects.get_or_create(spotify_id=spotify_id, defaults={'nombre': nombre})
        else:
            created = False

        # ensure nombre is present
        if not artista.nombre and nombre:
            artista.nombre = nombre

        # update image if available
        if data.get('images') and data['images']:
            imagen = data['images'][0].get('url')
            if imagen and artista.imagen_url != imagen:
                artista.imagen_url = imagen

        # persist spotify_id if missing
        if not artista.spotify_id:
            artista.spotify_id = spotify_id

        artista.save()

        # sync genres into Genero model and attach to artist
        genres = data.get('genres', []) or []
        for g in genres:
            gen_obj, _ = Genero.objects.get_or_create(nombre=g)
            artista.generos.add(gen_obj)

        return artista

    # Fallback: attempt to find by name or create a minimal artist record with spotify_id
    if artista:
        return artista

    # Fallback: attempt to find by name if provided, otherwise by spotify_id string
    lookup_name = fallback_name or spotify_id
    artista = Artista.objects.filter(nombre__iexact=lookup_name).first()
    if artista:
        return artista
    artista, _ = Artista.objects.get_or_create(
        spotify_id=spotify_id,
        defaults={'nombre': lookup_name},
    )
    return artista

from datetime import timedelta, datetime

def get_or_create_cancion(spotify_id):
    from .models import Cancion, Album, Artista

    cancion = Cancion.objects.filter(spotify_id=spotify_id).first()
    if cancion:
        return cancion

    # Obtener la canción desde Spotify
    track = _call_spotify(sp.track, spotify_id)

    # Artista: prefer creating/loading via spotify artist id to sync genres
    artist_id = track['artists'][0].get('id') if track.get('artists') else None
    if artist_id:
        artista_obj = get_or_create_artista(artist_id, fallback_name=track['artists'][0].get('name'))
    else:
        artista_obj, _ = Artista.objects.get_or_create(nombre=track['artists'][0]['name'])

    # Álbum
    album_data = track['album']
    imagen_url = album_data['images'][0]['url'] if album_data['images'] else ''
    fecha_normalizada = normalizar_fecha(album_data['release_date'])

    album_obj, created = Album.objects.get_or_create(
        spotify_id=album_data['id'],   
        defaults={
            'titulo': album_data['name'],
            'artista': artista_obj,
            'fecha_lanzamiento': fecha_normalizada,
            'imagen_url': imagen_url
        }
    )

    # Si el álbum es nuevo → traemos todas sus canciones
    if created and sp:
        try:
            album_tracks = _call_spotify(sp.album_tracks, album_data['id']).get('items', [])
        except SpotifyException as exc:  # pragma: no cover - external
            logger.warning("Spotify album_tracks failed (%s): %s", getattr(exc, "http_status", "?"), exc)
            album_tracks = []
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Spotify album_tracks error: %s", exc)
            album_tracks = []

        for t in album_tracks:
            track_id = t.get('id')
            if not track_id:
                continue
            Cancion.objects.get_or_create(
                spotify_id=track_id,
                defaults={
                    'titulo': t.get('name', ''),
                    'album': album_obj,
                    'duracion': timedelta(milliseconds=t.get('duration_ms') or 0)
                }
            )

    # Ahora sí devolvemos la canción pedida
    return Cancion.objects.get(spotify_id=spotify_id)

def get_or_create_album(spotify_id):
    from .models import Album, Cancion, Artista

    album = Album.objects.filter(spotify_id=spotify_id).first()
    if album:
        return album

    # Traer info del álbum desde Spotify
    album_data = _call_spotify(sp.album, spotify_id)
    # Use spotify artist id when possible to sync genres
    artist_id = album_data['artists'][0].get('id') if album_data.get('artists') else None
    if artist_id:
        artista_obj = get_or_create_artista(artist_id, fallback_name=album_data['artists'][0].get('name'))
    else:
        artista_obj, _ = Artista.objects.get_or_create(nombre=album_data['artists'][0]['name'])

    imagen_url = album_data['images'][0]['url'] if album_data['images'] else ''
    fecha_normalizada = normalizar_fecha(album_data['release_date'])

    album_obj = Album.objects.create(
        spotify_id=spotify_id,
        titulo=album_data['name'],
        artista=artista_obj,
        fecha_lanzamiento=fecha_normalizada,
        imagen_url=imagen_url
    )

    # Guardar todas sus canciones
    try:
        album_tracks = _call_spotify(sp.album_tracks, spotify_id).get('items', []) if sp else []
    except SpotifyException as exc:  # pragma: no cover - external
        logger.warning("Spotify album_tracks failed (%s): %s", getattr(exc, "http_status", "?"), exc)
        album_tracks = []
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Spotify album_tracks error: %s", exc)
        album_tracks = []

    for track in album_tracks:
        track_id = track.get('id')
        if not track_id:
            continue
        Cancion.objects.get_or_create(
            spotify_id=track_id,
            defaults={
                'titulo': track.get('name', ''),
                'album': album_obj,
                'duracion': timedelta(milliseconds=track.get('duration_ms') or 0)
            }
        )

    return album_obj


def obtener_generos_por_nombre(nombre):
    """Buscar un artista por nombre en Spotify y devolver su lista de géneros.
    Devuelve lista de strings o [] en fallo/no encontrado.
    """
    try:
        # Buscar artista por nombre (limit 1)
        q = f"artist:{nombre}"
        res = _call_spotify(sp.search, q=q, type='artist', limit=1)
        items = res.get('artists', {}).get('items', [])
        if not items:
            # fallback: try a plain search
            res = _call_spotify(sp.search, q=nombre, type='artist', limit=1)
            items = res.get('artists', {}).get('items', [])
        if not items:
            return []
        artist_id = items[0].get('id')
        if not artist_id:
            return []
        artist_info = _call_spotify(sp.artist, artist_id)
        return artist_info.get('genres', []) or []
    except Exception:
        return []


def obtener_generos_y_id_por_nombre(nombre):
    """Buscar un artista por nombre en Spotify y devolver (generos, artist_id).
    Devuelve ([], None) en fallo/no encontrado.
    """
    try:
        q = f"artist:{nombre}"
        res = _call_spotify(sp.search, q=q, type='artist', limit=1)
        items = res.get('artists', {}).get('items', [])
        if not items:
            res = _call_spotify(sp.search, q=nombre, type='artist', limit=1)
            items = res.get('artists', {}).get('items', [])
        if not items:
            return [], None
        artist = items[0]
        artist_id = artist.get('id')
        if not artist_id:
            return [], None
        artist_info = _call_spotify(sp.artist, artist_id)
        return artist_info.get('genres', []) or [], artist_id
    except Exception:
        return [], None


def obtener_generos_por_id(artist_id):
    """Obtener géneros desde Spotify usando el artist_id directamente."""
    try:
        artist_info = _call_spotify(sp.artist, artist_id)
        return artist_info.get('genres', []) or []
    except Exception:
        return []
