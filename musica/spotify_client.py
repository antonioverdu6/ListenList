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
    for item in results['tracks']['items']:
        canciones.append({
            'nombre': item['name'],
            'artista': item['artists'][0]['name'],
            'album': item['album']['name'],
            'imagen': item['album']['images'][0]['url'] if item['album']['images'] else '',
            'spotify_id': item['id'],
            'preview_url': item['preview_url'],
        })
    return canciones


def get_or_create_artista(spotify_id):
    from .models import Artista

    artista = Artista.objects.filter(id=spotify_id).first()
    if artista and artista.imagen_url:
        return artista

    # Obtener datos del artista desde Spotify
    data = sp.artist(spotify_id)

    artista, _ = Artista.objects.get_or_create(
        nombre=data["name"]
    )

    if data.get("images"):
        artista.imagen_url = data["images"][0]["url"]
        artista.save(update_fields=["imagen_url"])

    return artista

from datetime import timedelta, datetime

def get_or_create_cancion(spotify_id):
    from .models import Cancion, Album, Artista

    cancion = Cancion.objects.filter(spotify_id=spotify_id).first()
    if cancion:
        return cancion

    # Obtener la canción desde Spotify
    track = sp.track(spotify_id)

    # Artista
    artista_obj, _ = Artista.objects.get_or_create(
        nombre=track['artists'][0]['name']
    )

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
    artista_obj, _ = Artista.objects.get_or_create(
        nombre=album_data['artists'][0]['name']
    )

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
