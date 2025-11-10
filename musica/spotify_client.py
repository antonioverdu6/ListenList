import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from .utils import normalizar_fecha


sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(
    client_id='a268e268074b4e02afea8d925786b006',
    client_secret='a5ec174e5e304574a0ec5fb2590c4f12'
))

def buscar_canciones(query, limit=17):
    results = sp.search(q=query, type='track', limit=limit)
    canciones = []
    # cache artist genres to avoid repeated calls
    artist_genres_cache = {}
    for item in results['tracks']['items']:
        artist_id = item['artists'][0].get('id') if item.get('artists') else None
        generos = []
        if artist_id:
            if artist_id in artist_genres_cache:
                generos = artist_genres_cache[artist_id]
            else:
                try:
                    artist_info = sp.artist(artist_id)
                    generos = artist_info.get('genres', [])
                except Exception:
                    generos = []
                artist_genres_cache[artist_id] = generos

        canciones.append({
            'nombre': item['name'],
            'artista': item['artists'][0]['name'] if item.get('artists') else None,
            'album': item['album']['name'] if item.get('album') else None,
            'imagen': item['album']['images'][0]['url'] if item.get('album') and item['album'].get('images') else '',
            'spotify_id': item['id'],
            'preview_url': item.get('preview_url'),
            'generos': generos,
        })
    return canciones


def get_or_create_artista(spotify_id):
    from .models import Artista
    from .models import Genero
    # First, try to find by spotify_id field in DB
    artista = Artista.objects.filter(spotify_id=spotify_id).first()

    try:
        data = sp.artist(spotify_id)
    except Exception:
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
    artista = Artista.objects.filter(nombre__iexact=spotify_id).first()
    if artista:
        return artista
    artista, _ = Artista.objects.get_or_create(spotify_id=spotify_id, defaults={'nombre': spotify_id})
    return artista

from datetime import timedelta, datetime

def get_or_create_cancion(spotify_id):
    from .models import Cancion, Album, Artista

    cancion = Cancion.objects.filter(spotify_id=spotify_id).first()
    if cancion:
        return cancion

    # Obtener la canción desde Spotify
    track = sp.track(spotify_id)

    # Artista: prefer creating/loading via spotify artist id to sync genres
    artist_id = track['artists'][0].get('id') if track.get('artists') else None
    if artist_id:
        artista_obj = get_or_create_artista(artist_id)
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
    if created:
        album_tracks = sp.album_tracks(album_data['id'])['items']
        for t in album_tracks:
            art_id = t['artists'][0].get('id') if t.get('artists') else None
            if art_id:
                artista_t = get_or_create_artista(art_id)
            else:
                artista_t, _ = Artista.objects.get_or_create(nombre=t['artists'][0]['name'])
            Cancion.objects.get_or_create(
                spotify_id=t['id'],
                defaults={
                    'titulo': t['name'],
                    'album': album_obj,
                    'duracion': timedelta(milliseconds=t['duration_ms'])
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
    album_data = sp.album(spotify_id)
    # Use spotify artist id when possible to sync genres
    artist_id = album_data['artists'][0].get('id') if album_data.get('artists') else None
    if artist_id:
        artista_obj = get_or_create_artista(artist_id)
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
    for track in sp.album_tracks(spotify_id)['items']:
        Cancion.objects.get_or_create(
            spotify_id=track['id'],
            defaults={
                'titulo': track['name'],
                'album': album_obj,
                'duracion': timedelta(milliseconds=track['duration_ms'])
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
        res = sp.search(q=q, type='artist', limit=1)
        items = res.get('artists', {}).get('items', [])
        if not items:
            # fallback: try a plain search
            res = sp.search(q=nombre, type='artist', limit=1)
            items = res.get('artists', {}).get('items', [])
        if not items:
            return []
        artist_id = items[0].get('id')
        if not artist_id:
            return []
        artist_info = sp.artist(artist_id)
        return artist_info.get('genres', []) or []
    except Exception:
        return []


def obtener_generos_y_id_por_nombre(nombre):
    """Buscar un artista por nombre en Spotify y devolver (generos, artist_id).
    Devuelve ([], None) en fallo/no encontrado.
    """
    try:
        q = f"artist:{nombre}"
        res = sp.search(q=q, type='artist', limit=1)
        items = res.get('artists', {}).get('items', [])
        if not items:
            res = sp.search(q=nombre, type='artist', limit=1)
            items = res.get('artists', {}).get('items', [])
        if not items:
            return [], None
        artist = items[0]
        artist_id = artist.get('id')
        if not artist_id:
            return [], None
        artist_info = sp.artist(artist_id)
        return artist_info.get('genres', []) or [], artist_id
    except Exception:
        return [], None


def obtener_generos_por_id(artist_id):
    """Obtener géneros desde Spotify usando el artist_id directamente."""
    try:
        artist_info = sp.artist(artist_id)
        return artist_info.get('genres', []) or []
    except Exception:
        return []
