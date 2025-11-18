from datetime import timedelta
from rest_framework import serializers
from .models import Genero, Artista, Album, Cancion, ListaMusical, ComentarioCancion, Valoracion, ComentarioAlbum, Perfil
from .models import ComentarioArtista
from .models import Notificacion
from django.db import models
from django.contrib.auth.models import User



class GeneroSerializer(serializers.ModelSerializer):
    class Meta:
        model = Genero
        fields = ['id', 'nombre']

class ArtistaSerializer(serializers.ModelSerializer):
    generos = serializers.SerializerMethodField()
    valoracion_media = serializers.SerializerMethodField()
    albums = serializers.SerializerMethodField()
    top_tracks = serializers.SerializerMethodField()
    seguidores_count = serializers.SerializerMethodField()

    class Meta:
        model = Artista
        fields = ['id', 'nombre', 'spotify_id', 'generos', 'valoracion_media', 'imagen_url', 'albums', 'top_tracks', 'seguidores_count']

    def get_albums(self, obj):
        try:
            from .models import Album
            from django.db.models import Avg
            qs = Album.objects.filter(artista=obj).annotate(avg_rating=Avg('valoraciones__puntuacion'))
            qs = qs.order_by('-avg_rating')[:5]
            data = []
            for a in qs:
                data.append({
                    'id': a.id,
                    'titulo': a.titulo,
                    'imagen_url': a.imagen_url,
                    'spotify_id': a.spotify_id,
                    'fecha_lanzamiento': getattr(a, 'fecha_lanzamiento', None),
                    'valoracion_media': float(getattr(a, 'avg_rating', 0) or 0),
                })
            return data
        except Exception:
            return []

    def get_top_tracks(self, obj):
        try:
            from .models import Cancion
            from django.db.models import Avg
            qs = Cancion.objects.filter(album__artista=obj).annotate(avg_rating=Avg('valoraciones__puntuacion'))
            qs = qs.order_by('-avg_rating')[:5]
            data = []
            for c in qs:
                data.append({
                    'id': c.id,
                    'spotify_id': c.spotify_id,
                    'titulo': c.titulo,
                    'valoracion_media': c.valoracion_media() or 0,
                    'album': c.album.id if c.album else None,
                    'album_titulo': c.album.titulo if c.album else None,
                })
            return data
        except Exception:
            return []

    def get_generos(self, obj):
        try:
            # Si el artista ya tiene géneros asociados en la DB, devolverlos
            if obj.generos.exists():
                return GeneroSerializer(obj.generos.all(), many=True).data

            # Fallback: intentar obtener géneros desde Spotify preferentemente por spotify_id
            from .spotify_client import obtener_generos_por_id, obtener_generos_y_id_por_nombre
            if getattr(obj, 'spotify_id', None):
                generos = obtener_generos_por_id(obj.spotify_id)
                artist_id_used = obj.spotify_id
            else:
                generos, artist_id_used = obtener_generos_y_id_por_nombre(obj.nombre)
            # Persistir géneros en DB y relacionarlos al artista
            created_objs = []
            from .models import Genero
            for g in generos:
                if not g:
                    continue
                gen_obj, _ = Genero.objects.get_or_create(nombre=g)
                obj.generos.add(gen_obj)
                created_objs.append(gen_obj)

            # If we discovered the spotify artist id from the search, persist it on the model
            if artist_id_used and not getattr(obj, 'spotify_id', None):
                obj.spotify_id = artist_id_used
                obj.save(update_fields=['spotify_id'])

            return GeneroSerializer(created_objs, many=True).data if created_objs else []
        except Exception:
            return []

    def get_valoracion_media(self, obj):
        try:
            v = obj.valoracion_media()
            return float(v) if v is not None else 0.0
        except Exception:
            return 0.0

    def get_seguidores_count(self, obj):
        try:
            from .models import SeguimientoArtista
            return SeguimientoArtista.objects.filter(artista=obj).count()
        except Exception:
            # If the model is not present or any error, gracefully return 0
            return 0


class AlbumSerializer(serializers.ModelSerializer):
    artista = ArtistaSerializer(read_only=True)
    valoracion_media = serializers.FloatField(read_only=True)  

    class Meta:
        model = Album
        fields = ['id', 'titulo', 'artista', 'fecha_lanzamiento', 'bio', 'imagen_url', 'valoracion_media']

class CancionSerializer(serializers.ModelSerializer):
    album = AlbumSerializer(read_only=True)
    valoracion_media = serializers.FloatField(read_only=True)  

    class Meta:
        model = Cancion
        fields = ['id', 'titulo', 'album', 'duracion', 'spotify_id', 'letra', 'valoracion_media']

class ListaMusicalSerializer(serializers.ModelSerializer):
    canciones = CancionSerializer(many=True, read_only=True)
    creador = serializers.StringRelatedField()

    class Meta:
        model = ListaMusical
        fields = ['id', 'nombre', 'creador', 'canciones', 'fecha_creacion', 'publica']



class AlbumNestedSerializer(serializers.ModelSerializer):
    artista = serializers.StringRelatedField()
    class Meta:
        model = Album
        fields = ['id', 'titulo', 'imagen_url', 'artista', 'spotify_id']


class ArtistaNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Artista
        fields = ['nombre']

class ComentarioCancionSerializer(serializers.ModelSerializer):
    autor = serializers.StringRelatedField()
    class Meta:
        model = ComentarioCancion
        fields = ['id', 'autor', 'texto', 'fecha', 'parent']

class CancionDetailSerializer(serializers.ModelSerializer):
    album = AlbumNestedSerializer()
    duracion_formateada = serializers.SerializerMethodField()
    fecha_formateada = serializers.SerializerMethodField()
    avgRating = serializers.SerializerMethodField()
    countRating = serializers.SerializerMethodField()
    userRating = serializers.SerializerMethodField()
    comentarios = ComentarioCancionSerializer(many=True, read_only=True)

    class Meta:
        model = Cancion
        fields = ['id', 'spotify_id', 'titulo', 'letra', 'album', 'duracion_formateada', 'fecha_formateada', 'avgRating', 'countRating', 'userRating', 'comentarios']

    def get_duracion_formateada(self, obj):
        from .utils import formatear_duracion
        return formatear_duracion(obj.duracion)

    def get_fecha_formateada(self, obj):
        from .utils import formatear_fecha
        return formatear_fecha(obj.album.fecha_lanzamiento)
    
    def get_avgRating(self, obj):
        valoracion = obj.valoraciones.aggregate(avg=models.Avg('puntuacion')).get('avg')
        return valoracion if valoracion is not None else 0

    def get_countRating(self, obj):
        return obj.valoraciones.count()
    
    def get_userRating(self, obj):
        request = self.context['request']
        if request and request.user.is_authenticated:
            valoracion = obj.valoraciones.filter(usuario=request.user).first()
            return valoracion.puntuacion if valoracion else None
        return None
    
class AlbumDetailSerializer(serializers.ModelSerializer):
    artista = ArtistaSerializer(read_only=True)
    canciones = serializers.SerializerMethodField()
    avgPuntuacion = serializers.SerializerMethodField()
    countPuntuacion = serializers.SerializerMethodField()
    userRating = serializers.SerializerMethodField()
    duracion_formateada = serializers.SerializerMethodField() 
    num_canciones = serializers.SerializerMethodField() 
    comentarios = serializers.SerializerMethodField()

    class Meta:
        model = Album
        fields = [
            'id', 'spotify_id', 'titulo', 'artista', 'fecha_lanzamiento', 'bio', 'imagen_url',
            'canciones', 'avgPuntuacion', 'countPuntuacion', 'userRating',
            'duracion_formateada', 'num_canciones', 'comentarios']

    def get_canciones(self, obj):
        canciones = obj.canciones.all()
        from .serializers import CancionSerializer
        serializer = CancionSerializer(canciones, many=True, context=self.context)
        return serializer.data

    def get_avgPuntuacion(self, obj):
        from .models import ValoracionAlbum
        valoracion = ValoracionAlbum.objects.filter(album=obj).aggregate(avg=models.Avg('puntuacion'))['avg']
        return valoracion or 0

    def get_countPuntuacion(self, obj):
        from .models import ValoracionAlbum
        return ValoracionAlbum.objects.filter(album=obj).count()

    def get_userRating(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from .models import ValoracionAlbum
            valoracion = ValoracionAlbum.objects.filter(album=obj, autor=request.user).first()
            return valoracion.puntuacion if valoracion else None
        return None
    
    def get_comentarios(self, obj):
        qs = ComentarioAlbum.objects.filter(album=obj, parent__isnull=True).order_by('-fecha')
        return ComentarioAlbumSerializer(qs, many=True, context=self.context).data
    
    def get_duracion_formateada(self, obj):
        """Calcula y formatea la duración total del álbum"""
        from .utils import formatear_duracion  #  Importa desde utils


        
        canciones = obj.canciones.all()
        
        # Sumar todas las duraciones
        duracion_total = sum(
            (c.duracion for c in canciones if c.duracion), 
            timedelta()
        )
        
        # Si no hay duración, retornar None
        if duracion_total.total_seconds() == 0:
            return None
        
        # Usar la función de utils
        return formatear_duracion(duracion_total)
    
    def get_num_canciones(self, obj):
        """Retorna el número de canciones del álbum"""
        return obj.canciones.count()
    

class ComentarioAlbumSerializer(serializers.ModelSerializer):
    autor = serializers.StringRelatedField(read_only=True)
    respuestas = serializers.SerializerMethodField()

    class Meta:
        model = ComentarioAlbum
        fields = ["id", "autor", "texto", "fecha", "parent", "respuestas"]

    def get_respuestas(self, obj):
        respuestas = obj.respuestas.all()
        return ComentarioAlbumSerializer(respuestas, many=True).data


class ComentarioArtistaSerializer(serializers.ModelSerializer):
    autor = serializers.StringRelatedField(read_only=True)
    respuestas = serializers.SerializerMethodField()

    class Meta:
        model = ComentarioArtista
        fields = ["id", "autor", "texto", "fecha", "parent", "respuestas"]

    def get_respuestas(self, obj):
        respuestas = obj.respuestas.all()
        return ComentarioArtistaSerializer(respuestas, many=True).data
    
class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class PerfilSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='usuario.username', read_only=True)
    email = serializers.EmailField(source='usuario.email', read_only=True)
    comentarios = serializers.SerializerMethodField()
    valoraciones = serializers.SerializerMethodField()

    class Meta:
        model = Perfil
        fields = [
            'username', 'email',
            'fotoPerfil', 'banner', 'biografia',
            'comentarios', 'valoraciones'
        ]

    def get_comentarios(self, obj):
        from .models import ComentarioCancion, ComentarioAlbum
        comentarios_canciones = ComentarioCancion.objects.filter(autor=obj.usuario)
        comentarios_albumes = ComentarioAlbum.objects.filter(autor=obj.usuario)
        data = []

        for c in comentarios_canciones:
            data.append({
                "itemType": "Canción",
                "itemName": c.cancion.titulo,
                "texto": c.texto,
                "fecha": c.fecha,
            })
        for c in comentarios_albumes:
            data.append({
                "itemType": "Álbum",
                "itemName": c.album.titulo,
                "texto": c.texto,
                "fecha": c.fecha,
            })
        return sorted(data, key=lambda x: x["fecha"], reverse=True)

    def get_valoraciones(self, obj):
        from .models import ValoracionCancion, ValoracionAlbum, ValoracionArtista
        data = []

        for v in ValoracionCancion.objects.filter(autor=obj.usuario):
            data.append({
                "itemType": "Canción",
                "itemName": v.cancion.titulo,
                "nota": v.puntuacion,
                "spotify_id": v.cancion.spotify_id,
            })
        for v in ValoracionAlbum.objects.filter(autor=obj.usuario):
            data.append({
                "itemType": "Álbum",
                "itemName": v.album.titulo,
                "nota": v.puntuacion,
                "spotify_id": v.album.spotify_id,
            })
        for v in ValoracionArtista.objects.filter(autor=obj.usuario):
            data.append({
                "itemType": "Artista",
                "itemName": v.artista.nombre,
                "nota": v.puntuacion,
            })
        return sorted(data, key=lambda x: x["nota"], reverse=True)


class NotificacionSerializer(serializers.ModelSerializer):
    origen_user = serializers.SerializerMethodField()
    origen_artista = serializers.SerializerMethodField()

    class Meta:
        model = Notificacion
        fields = ['id', 'tipo', 'origen_user', 'origen_artista', 'contenido', 'enlace', 'leido', 'fecha_creacion']

    def get_origen_user(self, obj):
        if obj.origen_user:
            return {'id': obj.origen_user.id, 'username': obj.origen_user.username}
        return None

    def get_origen_artista(self, obj):
        if obj.origen_artista:
            return {'id': obj.origen_artista.id, 'nombre': obj.origen_artista.nombre}
        return None
