from django.db import models

# Create your models here

from django.contrib.auth.models import User
from django.db.models import Avg
from django.utils.timezone import now


class Genero(models.Model):
    nombre = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.nombre

class Artista(models.Model):
    nombre = models.CharField(max_length=200)
    generos = models.ManyToManyField(Genero, blank=True, related_name='artistas')
    imagen_url = models.URLField(blank=True, null=True)


    def __str__(self):
        return self.nombre

    def valoracion_media(self):
        valoraciones = self.valoraciones.all()
        if valoraciones.exists():
            return valoraciones.aggregate(Avg('puntuacion'))['puntuacion__avg']
        return None

class Album(models.Model):
    titulo = models.CharField(max_length=200)
    artista = models.ForeignKey(Artista, on_delete=models.CASCADE, related_name='albums')
    fecha_lanzamiento = models.DateField()
    bio = models.TextField(blank=True)
    imagen_url = models.URLField(blank=True, null=True)
    spotify_id = models.CharField(max_length=100, unique=True, null=True, blank=True)  

    def __str__(self):
        return f"{self.titulo} - {self.artista.nombre}"



class Cancion(models.Model):
    titulo = models.CharField(max_length=200)
    album = models.ForeignKey(Album, on_delete=models.CASCADE, related_name='canciones')
    duracion = models.DurationField()
    spotify_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    letra = models.TextField(blank=True, null=True)
    

    def __str__(self):
        return f"{self.titulo} ({self.album.titulo})"

    def valoracion_media(self):
        valoraciones = self.valoraciones.all()
        if valoraciones.exists():
            return valoraciones.aggregate(Avg('puntuacion'))['puntuacion__avg']
        return None

class ListaMusical(models.Model):
    nombre = models.CharField(max_length=200)
    creador = models.ForeignKey(User, on_delete=models.CASCADE, related_name='listas_creadas')
    canciones = models.ManyToManyField(Cancion, related_name='listas')
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    publica = models.BooleanField(default=True)  # Si la lista es pública o privada

    def __str__(self):
        return f"{self.nombre} por {self.creador.username}"

# Modelo base para comentarios y reseñas
class ComentarioBase(models.Model):
    autor = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    texto = models.TextField(null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True, null=True)
    # No likes aquí, cada modelo hijo lo define con related_name único

    class Meta:
        abstract = True

class ComentarioCancion(ComentarioBase):
    cancion = models.ForeignKey(Cancion, on_delete=models.CASCADE, related_name='comentarios', null=True, blank=True)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='respuestas')
    likes = models.ManyToManyField(User, related_name='likes_comentario_cancion', blank=True)

class ComentarioAlbum(ComentarioBase):
    album = models.ForeignKey(Album, on_delete=models.CASCADE, related_name='comentarios', null=True, blank=True)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='respuestas')
    likes = models.ManyToManyField(User, related_name='likes_comentario_album', blank=True)

class ComentarioArtista(ComentarioBase):
    artista = models.ForeignKey(Artista, on_delete=models.CASCADE, related_name='comentarios', null=True, blank=True)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='respuestas')
    likes = models.ManyToManyField(User, related_name='likes_comentario_artista', blank=True)

class ReseñaBase(models.Model):
    autor = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    texto = models.TextField(null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True, null=True)
    likes = models.ManyToManyField(User, related_name='likes_reseñas', blank=True)

    class Meta:
        abstract = True

class Valoracion(models.Model):
    PUNTUACION_CHOICES = [(i, str(i)) for i in range(1, 6)]
    autor = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    puntuacion = models.IntegerField(choices=PUNTUACION_CHOICES)
    fecha = models.DateTimeField(auto_now_add=True, null=True)


    class Meta:
        abstract = True

class ValoracionCancion(Valoracion):
    cancion = models.ForeignKey(Cancion, on_delete=models.CASCADE, related_name='valoraciones', null=True, blank=True)

    class Meta:
        unique_together = ('autor', 'cancion')

class ValoracionAlbum(Valoracion):
    album = models.ForeignKey(Album, on_delete=models.CASCADE, related_name='valoraciones', null=True, blank=True)

    class Meta:
        unique_together = ('autor', 'album')

class ValoracionArtista(Valoracion):
    artista = models.ForeignKey(Artista, on_delete=models.CASCADE, related_name='valoraciones', null=True, blank=True)

    class Meta:
        unique_together = ('autor', 'artista')

class Perfil(models.Model):
    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil')
    fotoPerfil = models.CharField(max_length=500, blank=True, null=True)
    banner = models.URLField(blank=True, null=True)
    biografia = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.usuario.username

    # === NUEVO ===
    def comentarios_usuario(self):
        from .models import ComentarioCancion, ComentarioAlbum
        return list(ComentarioCancion.objects.filter(autor=self.usuario)) + \
               list(ComentarioAlbum.objects.filter(autor=self.usuario))

    def valoraciones_usuario(self):
        from .models import ValoracionCancion, ValoracionAlbum, ValoracionArtista
        return list(ValoracionCancion.objects.filter(autor=self.usuario)) + \
               list(ValoracionAlbum.objects.filter(autor=self.usuario)) + \
               list(ValoracionArtista.objects.filter(autor=self.usuario))

class Seguimiento(models.Model):
    seguidor = models.ForeignKey(User, on_delete=models.CASCADE, related_name="seguidos")
    seguido = models.ForeignKey(User, on_delete=models.CASCADE, related_name="seguidores")
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("seguidor", "seguido")

    def __str__(self):
        return f"{self.seguidor.username} → {self.seguido.username}"
