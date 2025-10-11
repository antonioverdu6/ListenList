from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.http import JsonResponse
from django.db.models import Sum
from django.db.models import Avg, Count
from .models import Artista, Cancion, Album, ComentarioCancion, ValoracionCancion, ValoracionAlbum, ValoracionArtista, ListaMusical, ComentarioAlbum, Perfil, Seguimiento
from .forms import RegistroForm, ValoracionCancionForm, ValoracionAlbumForm, ValoracionArtistaForm
from .spotify_client import buscar_canciones, get_or_create_cancion, get_or_create_album
from django.utils import timezone
from .audd_api import obtener_letra
from datetime import date, timedelta
from .utils import formatear_fecha, normalizar_fecha, formatear_duracion
from .serializers import ArtistaSerializer, AlbumSerializer, CancionSerializer, ListaMusicalSerializer, AlbumDetailSerializer, ComentarioAlbumSerializer, UsuarioSerializer, PerfilSerializer
from rest_framework import generics
from django.views.decorators.csrf import ensure_csrf_cookie
from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import status
from rest_framework import generics, permissions
from rest_framework.response import Response



# Create your views here.


def lista_artistas(request):
    artistas = Artista.objects.all()
    return render(request, 'musica/artistas.html', {'artistas': artistas})


import json
import requests
from django.http import JsonResponse
from django.contrib.auth.models import User
from .forms import RegistroForm
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

# Claves de reCAPTCHA
RECAPTCHA_SECRET_KEY = "6LfHr84rAAAAAASOPXXZjT48Rrb3-q3-KT8M86JV"

RECAPTCHA_SECRET_KEY = "6Ld2us4rAAAAAMGrIBYepnth0Py-1fNqGxMv-aw7"

@csrf_exempt 
def registro(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)

            # Validar reCAPTCHA v3
            captcha_token = data.get("captcha")
            if not captcha_token:
                return JsonResponse({"error": "Captcha requerido"}, status=400)

            captcha_response = requests.post(
                "https://www.google.com/recaptcha/api/siteverify",
                data={
                    'secret': RECAPTCHA_SECRET_KEY,
                    'response': captcha_token
                }
            ).json()

            print("Respuesta reCAPTCHA v3:", captcha_response)  # Para debug

            # Verificación para reCAPTCHA v3
            if not captcha_response.get("success"):
                error_codes = captcha_response.get("error-codes", [])
                return JsonResponse({
                    "error": "Captcha inválido",
                    "error_codes": error_codes
                }, status=400)

            # Opcional: Verificar score (reCAPTCHA v3 devuelve un score de 0.0 a 1.0)
            score = captcha_response.get("score", 0)
            if score < 0.5:  # Ajusta este threshold según necesites
                return JsonResponse({
                    "error": "Actividad sospechosa detectada",
                    "score": score
                }, status=400)

            # Resto de tu lógica de registro...
            form = RegistroForm({
                'username': data.get('username'),
                'email': data.get('email'),
                'password1': data.get('password1'),
                'password2': data.get('password2')
            })

            if form.is_valid():
                new_user = form.save(commit=False)
                new_user.set_password(form.cleaned_data['password1'])
                new_user.save()
                return JsonResponse({"success": "Usuario creado correctamente"}, status=201)
            else:
                return JsonResponse({"error": form.errors}, status=400)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Datos inválidos"}, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Método no permitido"}, status=405)


@api_view(["POST"])
@permission_classes([AllowAny])
def register_user(request):
    data = request.data
    username = data.get("username")
    password1 = data.get("password1")
    password2 = data.get("password2")

    if password1 != password2:
        return JsonResponse({"error": "Las contraseñas no coinciden"}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "El usuario ya existe"}, status=400)

    user = User.objects.create_user(username=username, password=password1)

    # Devolver tokens JWT directamente
    refresh = RefreshToken.for_user(user)
    return JsonResponse({
        "message": "Usuario registrado con éxito",
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }, status=201)

def buscar(request):
    query = request.GET.get('q', '')
    resultados = []
    if query:
        resultados = buscar_canciones(query)  # lista de dicts con info de canciones

    # Aquí truncamos los títulos largos antes de pasar a la plantilla
    for cancion in resultados:
        titulo = cancion.get('nombre', '')
        if len(titulo) > 15:
            cancion['nombre_trunc'] = titulo[:20] + "..."
        else:
            cancion['nombre_trunc'] = titulo

        # Truncar álbum
        album = cancion.get('album', '')
        if len(album) > 15:
            cancion['album_trunc'] = album[:22] + "..."
        else:
            cancion['album_trunc'] = album

    return render(request, 'musica/buscar.html', {'resultados': resultados, 'query': query})


def inicio(request):
    return render(request, 'musica/inicio.html') 


@ensure_csrf_cookie
def detalle_cancion(request, spotify_id): # ← Recibe spotify_id correctamente
    cancion = get_or_create_cancion(spotify_id) # ← Usa get_or_create_cancion
    
    # Normalizar fecha
    if cancion.album and cancion.album.fecha_lanzamiento:
        fecha_normalizada = normalizar_fecha(cancion.album.fecha_lanzamiento)
        if fecha_normalizada != cancion.album.fecha_lanzamiento:
            cancion.album.fecha_lanzamiento = fecha_normalizada
            cancion.album.save(update_fields=["fecha_lanzamiento"])

    # Obtener letra si no existe
    if not cancion.letra:
        artista_nombre = getattr(getattr(cancion.album, "artista", None), "nombre", "")
        letra_obtenida = obtener_letra(cancion.titulo, artista_nombre)
        if letra_obtenida:
            cancion.letra = letra_obtenida
            cancion.save(update_fields=["letra"])

    # Valoración del usuario
    user_rating = None
    if request.user.is_authenticated:
        try:
            user_rating = ValoracionCancion.objects.get(
                cancion=cancion, autor=request.user
            ).puntuacion
        except ValoracionCancion.DoesNotExist:
            pass

    # Stats globales de valoraciones
    valoraciones = ValoracionCancion.objects.filter(cancion=cancion)
    avg_puntuacion = valoraciones.aggregate(Avg("puntuacion"))["puntuacion__avg"] or 0
    count_puntuacion = valoraciones.count()

    # Comentarios (con respuestas anidadas)
    comentarios = [
        {
            "id": c.id,
            "autor": c.autor.username,
            "texto": c.texto,
            "respuestas": [
                {"id": r.id, "autor": r.autor.username, "texto": r.texto}
                for r in c.respuestas.all()
            ],
        }
        for c in cancion.comentarios.filter(parent__isnull=True)
    ]

    # Canciones recomendadas
    canciones_recomendadas = []
    for rec in Cancion.objects.exclude(id=cancion.id).order_by("?")[:3]:
        canciones_recomendadas.append({
            "spotify_id": rec.spotify_id,
            "titulo": rec.titulo,
            "titulo_trunc": rec.titulo[:12] + "..." if len(rec.titulo) > 15 else rec.titulo,
            "album": {
                "id": cancion.album.id,
                "titulo": cancion.album.titulo,
                "imagen_url": cancion.album.imagen_url,
                "spotify_id": cancion.album.spotify_id,  # ← AGREGAR ESTA LÍNEA
                "artista": {
                    "id": cancion.album.artista.id,
                    "nombre": cancion.album.artista.nombre,
                },
            },
        })

    # Construcción de JSON final
    # Construcción de JSON final
    data = {
        "id": cancion.id,
        "titulo": cancion.titulo,
        "duracion_formateada": formatear_duracion(cancion.duracion),
        "spotify_id": cancion.spotify_id,
        "fecha_formateada": formatear_fecha(cancion.album.fecha_lanzamiento),
        "letra": cancion.letra,
        "userRating": user_rating,
        "avgRating": avg_puntuacion,
        "countRating": count_puntuacion,
        "comentarios": comentarios,
        "album": {
            "id": cancion.album.id,
            "titulo": cancion.album.titulo,
            "imagen_url": cancion.album.imagen_url,
            "spotify_id": cancion.album.spotify_id,  # ← AGREGAR ESTA LÍNEA
            "artista": {
                "id": cancion.album.artista.id,
                "nombre": cancion.album.artista.nombre,
            },
        },
        "cancionesRecomendadas": canciones_recomendadas,
    }


    return JsonResponse(data)


@login_required
def detalle_album(request, spotify_id):
    # Esto ya busca o crea el álbum según spotify_id
    album = get_or_create_album(spotify_id)  

    canciones = album.canciones.annotate(
        avg_puntuacion=Avg('valoraciones__puntuacion'),
        count_puntuacion=Count('valoraciones')
    ).order_by('id')

    for cancion in canciones:
        cancion.duracion_formateada = formatear_duracion(cancion.duracion)

    num_canciones = canciones.count()
    duracion_total = sum((cancion.duracion for cancion in canciones), timedelta())
    duracion_formateada = formatear_duracion(duracion_total)
    fecha_formateada = formatear_fecha(album.fecha_lanzamiento)

    user_rating = None
    if request.user.is_authenticated:
        try:
            user_rating = ValoracionAlbum.objects.get(album=album, autor=request.user).puntuacion
        except ValoracionAlbum.DoesNotExist:
            pass

    valoraciones_album = ValoracionAlbum.objects.filter(album=album)
    avg_puntuacion = valoraciones_album.aggregate(Avg('puntuacion'))['puntuacion__avg'] or 0
    count_puntuacion = valoraciones_album.count()

    context = {
        'album': album,
        'canciones': canciones,
        'num_canciones': num_canciones,
        'duracion_formateada': duracion_formateada,
        'fecha_formateada': fecha_formateada,
        'user_rating': user_rating,
        'avg_puntuacion': avg_puntuacion,
        'count_puntuacion': count_puntuacion,
        'stars_range': range(5, 0, -1),
    }
    return render(request, 'musica/detalle_album.html', context)



@api_view(["POST"])
@permission_classes([IsAuthenticated])
def agregar_comentario_cancion(request, cancion_id):
    cancion = get_object_or_404(Cancion, id=cancion_id)
    if request.method == "POST":
        texto = request.POST.get("texto", "").strip()
        parent_id = request.POST.get("parent_id")

        if texto:
            comentario = ComentarioCancion(
                cancion=cancion,
                autor=request.user,
                texto=texto
            )
            if parent_id:
                try:
                    parent = ComentarioCancion.objects.get(id=parent_id)
                    comentario.parent = parent
                except ComentarioCancion.DoesNotExist:
                    pass
            comentario.save()

        comentarios = [
            {
                "id": c.id,
                "autor": c.autor.username,
                "texto": c.texto,
                "respuestas": [
                    {"id": r.id, "autor": r.autor.username, "texto": r.texto}
                    for r in c.respuestas.all()
                ],
            }
            for c in cancion.comentarios.filter(parent__isnull=True).order_by("-fecha")
        ]

        return JsonResponse({"comentarios": comentarios})
    return JsonResponse({"error": "Método no permitido"}, status=405)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def agregar_comentario_album(request, album_id):
    album = get_object_or_404(Album, id=album_id)
    texto = request.POST.get("texto", "").strip()
    parent_id = request.POST.get("parent_id")

    if not texto:
        return JsonResponse({"error": "El texto del comentario es obligatorio."}, status=400)

    comentario = ComentarioAlbum(
        album=album,
        autor=request.user,
        texto=texto
    )

    if parent_id:
        try:
            parent = ComentarioAlbum.objects.get(id=parent_id)
            comentario.parent = parent
        except ComentarioAlbum.DoesNotExist:
            return JsonResponse({"error": "Comentario padre no encontrado."}, status=400)

    comentario.save()

    comentarios = [
        {
            "id": c.id,
            "autor": c.autor.username,
            "texto": c.texto,
            "respuestas": [
                {"id": r.id, "autor": r.autor.username, "texto": r.texto}
                for r in c.respuestas.all()
            ],
        }
        for c in album.comentarios.filter(parent__isnull=True).order_by("-fecha")
    ]

    return JsonResponse({"comentarios": comentarios})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def valorar_cancion(request, cancion_id):
    cancion = get_object_or_404(Cancion, id=cancion_id)
    puntuacion = request.data.get("puntuacion")
    if puntuacion is None:
        return Response({"error": "Falta la puntuación"}, status=400)

    # Guardar o actualizar la valoración
    valoracion_obj, created = ValoracionCancion.objects.update_or_create(
        cancion=cancion,
        autor=request.user,
        defaults={"puntuacion": puntuacion}
    )

    # Recalcular estadísticas
    from django.db.models import Avg, Count
    qs = ValoracionCancion.objects.filter(cancion=cancion)
    avg_puntuacion = qs.aggregate(Avg("puntuacion"))["puntuacion__avg"] or 0
    count_puntuacion = qs.count()

    # Generar nuevos tokens
    refresh = RefreshToken.for_user(request.user)
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)

    return Response({
        "puntuacion": valoracion_obj.puntuacion,
        "avgRating": round(avg_puntuacion, 1),
        "countRating": count_puntuacion,
        "access": access_token,
        "refresh": refresh_token
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def valorar_album(request, spotify_id):
    album = get_object_or_404(Album, spotify_id=spotify_id)
    puntuacion = request.data.get("puntuacion")

    try:
        puntuacion = int(puntuacion)
    except (TypeError, ValueError):
        return Response({"error": "Puntuación inválida"}, status=status.HTTP_400_BAD_REQUEST)

    if not (1 <= puntuacion <= 5):
        return Response({"error": "La puntuación debe estar entre 1 y 5"}, status=status.HTTP_400_BAD_REQUEST)

    valoracion, created = ValoracionAlbum.objects.get_or_create(
        autor=request.user,
        album=album,
        defaults={"puntuacion": puntuacion}
    )

    if not created:
        valoracion.puntuacion = puntuacion
        valoracion.save()

    return Response(
        {
            "success": True,
            "puntuacion": valoracion.puntuacion,
            "album_id": album.id,
            "autor": request.user.username,
        },
        status=status.HTTP_200_OK,
    )



@login_required
def valorar_artista(request, artista_id):
    artista = get_object_or_404(Artista, id=artista_id)
    valoracion, created = ValoracionArtista.objects.get_or_create(
        autor=request.user,
        artista=artista
    )
    if request.method == 'POST':
        form = ValoracionArtistaForm(request.POST, instance=valoracion)
        if form.is_valid():
            form.save()
            return redirect('detalle_artista', artista_id=artista.id)
    else:
        form = ValoracionArtistaForm(instance=valoracion)

    return render(request, 'artistas/valorar.html', {
        'artista': artista,
        'form': form,
        'promedio': artista.valoracion_media(),
    })





'''--------------------------------------------------------------'''

from rest_framework.response import Response
from rest_framework.decorators import api_view

@api_view(['GET'])
def hello_world(request):
    return Response({"message": "Hola desde Django API 🚀"})



# Vista de prueba
@api_view(['GET'])
def hello_world(request):
    return Response({"message": "Hola desde Django API 🚀"})

# Vistas reales
class ArtistaList(generics.ListAPIView):
    queryset = Artista.objects.all()
    serializer_class = ArtistaSerializer

class AlbumList(generics.ListAPIView):
    queryset = Album.objects.all()
    serializer_class = AlbumSerializer

class CancionList(generics.ListAPIView):
    queryset = Cancion.objects.all()
    serializer_class = CancionSerializer

class ListaMusicalList(generics.ListAPIView):
    queryset = ListaMusical.objects.all()
    serializer_class = ListaMusicalSerializer


from django.http import JsonResponse

def buscar_api(request):
    query = request.GET.get('q', '')
    resultados = []
    if query:
        resultados = buscar_canciones(query)  # lista de dicts con info de canciones

    # Truncar títulos largos y álbumes igual que en buscar()
    for cancion in resultados:
        titulo = cancion.get('nombre', '')
        cancion['nombre_trunc'] = titulo[:20] + "..." if len(titulo) > 20 else titulo
        album = cancion.get('album', '')
        cancion['album_trunc'] = album[:22] + "..." if len(album) > 22 else album

    return JsonResponse(resultados, safe=False)


from rest_framework import generics
from .models import Cancion
from .serializers import CancionDetailSerializer, ComentarioCancionSerializer

class CancionDetailAPI(generics.RetrieveAPIView):
    queryset = Cancion.objects.all()
    serializer_class = CancionDetailSerializer
    lookup_field = 'spotify_id'

class AlbumDetailAPI(generics.RetrieveAPIView):
    queryset = Album.objects.all()
    serializer_class = AlbumDetailSerializer   # <-- usa el serializer completo
    lookup_field = "spotify_id"                # <-- buscará por spotify_id

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request  # para userRating
        return context




class EditarComentarioCancionAPIView(generics.UpdateAPIView):
    queryset = ComentarioCancion.objects.all()
    serializer_class = ComentarioCancionSerializer
    permission_classes = [IsAuthenticated]

class BorrarComentarioCancionAPIView(generics.DestroyAPIView):
    queryset = ComentarioCancion.objects.all()
    serializer_class = ComentarioCancionSerializer
    permission_classes = [IsAuthenticated]

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.contrib.auth.decorators import login_required


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def editar_comentario_cancion(request, comentario_id):
    comentario = get_object_or_404(ComentarioCancion, id=comentario_id)

    if comentario.autor != request.user:
        return JsonResponse({"error": "No tienes permiso para editar este comentario"}, status=403)

    texto = request.data.get("texto", "").strip()
    if not texto:
        return JsonResponse({"error": "Texto vacío"}, status=400)

    comentario.texto = texto
    comentario.save()

    return JsonResponse({"id": comentario.id, "texto": comentario.texto})

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def borrar_comentario_cancion(request, comentario_id):
    comentario = get_object_or_404(ComentarioCancion, id=comentario_id)

    if comentario.autor != request.user:
        return JsonResponse({"error": "No tienes permiso para borrar este comentario"}, status=403)

    comentario.delete()
    return JsonResponse({"success": "Comentario borrado"})


class EditarComentarioAlbumAPIView(generics.UpdateAPIView):
    queryset = ComentarioAlbum.objects.all()
    serializer_class = ComentarioAlbumSerializer
    permission_classes = [IsAuthenticated]

class BorrarComentarioAlbumAPIView(generics.DestroyAPIView):
    queryset = ComentarioAlbum.objects.all()
    serializer_class = ComentarioAlbumSerializer
    permission_classes = [IsAuthenticated]

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def editar_comentario_album(request, comentario_id):
    comentario = get_object_or_404(ComentarioAlbum, id=comentario_id)
    if comentario.autor != request.user:
        return JsonResponse({"error": "No tienes permiso para editar este comentario"}, status=403)
    texto = request.data.get("texto", "").strip()
    if not texto:
        return JsonResponse({"error": "Texto vacío"}, status=400)
    comentario.texto = texto
    comentario.save()
    return JsonResponse({"id": comentario.id, "texto": comentario.texto})

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def borrar_comentario_album(request, comentario_id):
    comentario = get_object_or_404(ComentarioAlbum, id=comentario_id)
    if comentario.autor != request.user:
        return JsonResponse({"error": "No tienes permiso para borrar este comentario"}, status=403)
    comentario.delete()
    return JsonResponse({"success": "Comentario borrado"})

class UsuarioDetailAPI(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UsuarioSerializer
    lookup_field = 'username'
    permission_classes = [AllowAny]


class PerfilDetailAPI(generics.RetrieveUpdateAPIView):
    serializer_class = PerfilSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_object(self):
        username = self.kwargs["username"]
        user = get_object_or_404(User, username=username)
        perfil, created = Perfil.objects.get_or_create(usuario=user)
        return perfil

    def get(self, request, *args, **kwargs):
        perfil = self.get_object()
        serializer = self.get_serializer(perfil)
        return Response(serializer.data)

    def put(self, request, *args, **kwargs):
        perfil = self.get_object()

        # Solo el dueño puede editar su perfil
        if request.user != perfil.usuario:
            return Response({"detail": "No tienes permiso para editar este perfil."},
                            status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(perfil, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    


class ArtistaDetailAPI(generics.RetrieveAPIView):
    queryset = Artista.objects.all()
    serializer_class = ArtistaSerializer
    lookup_field = 'id'



@api_view(["GET"])
@permission_classes([AllowAny])
def perfil_usuario(request, username):
    user = get_object_or_404(User, username=username)
    perfil, _ = Perfil.objects.get_or_create(usuario=user)
    serializer = PerfilSerializer(perfil)
    return Response(serializer.data)

@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def editar_perfil(request):
    user = request.user
    perfil, _ = Perfil.objects.get_or_create(usuario=user)

    data = request.data
    perfil.fotoPerfil = data.get("fotoPerfil", perfil.fotoPerfil)
    perfil.banner = data.get("banner", perfil.banner)
    perfil.biografia = data.get("biografia", perfil.biografia)
    perfil.save()

    serializer = PerfilSerializer(perfil)
    return Response(serializer.data)

########################################################### SEGUIDORES ###########################################################

@api_view(["GET"])
@permission_classes([AllowAny])
def seguidores_y_siguiendo(request, username):
    user = get_object_or_404(User, username=username)
    seguidores_count = Seguimiento.objects.filter(seguido=user).count()
    siguiendo_count = Seguimiento.objects.filter(seguidor=user).count()
    return Response({
        "seguidores": seguidores_count,
        "siguiendo": siguiendo_count
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def comprobar_seguimiento(request, username):
    seguido = get_object_or_404(User, username=username)
    sigue = Seguimiento.objects.filter(seguidor=request.user, seguido=seguido).exists()
    return Response({"siguiendo": sigue})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_seguir_usuario(request, username):
    seguido = get_object_or_404(User, username=username)
    if seguido == request.user:
        return Response({"error": "No puedes seguirte a ti mismo"}, status=400)

    seguimiento = Seguimiento.objects.filter(seguidor=request.user, seguido=seguido)
    if seguimiento.exists():
        seguimiento.delete()
        return Response({"message": f"Has dejado de seguir a {seguido.username}", "siguiendo": False})
    else:
        Seguimiento.objects.create(seguidor=request.user, seguido=seguido)
        return Response({"message": f"Ahora sigues a {seguido.username}", "siguiendo": True})
    


@api_view(["GET"])
@permission_classes([AllowAny])
def buscar_usuarios(request):
    q = request.GET.get("q", "").strip().lower()
    from django.contrib.auth.models import User
    if not q:
        return Response([])
    usuarios = User.objects.filter(username__icontains=q)
    data = [
        {
            "username": u.username,
            "email": u.email,
            "fotoPerfil": getattr(u.perfil, "fotoPerfil", None)
        }
        for u in usuarios
    ]
    return Response(data)


# === BUSCAR ARTISTAS ===
@api_view(["GET"])
@permission_classes([AllowAny])
def buscar_artistas(request):
    q = request.GET.get("q", "").strip().lower()
    if not q:
        return Response([])

    artistas = Artista.objects.filter(nombre__icontains=q)
    data = [
        {
            "id": a.id,
            "nombre": a.nombre,
            "imagen_url": a.imagen_url,
        }
        for a in artistas
    ]
    return Response(data)


# === BUSCAR ÁLBUMES ===
@api_view(["GET"])
@permission_classes([AllowAny])
def buscar_albums(request):
    q = request.GET.get("q", "").strip().lower()
    if not q:
        return Response([])

    albums = Album.objects.filter(titulo__icontains=q).select_related("artista")
    data = [
        {
            "id": a.id,
            "titulo": a.titulo,
            "spotify_id": a.spotify_id,
            "imagen_url": a.imagen_url,
            "artista": {
                "nombre": a.artista.nombre if a.artista else None,
                "id": a.artista.id if a.artista else None,
            },
        }
        for a in albums
    ]
    return Response(data)
