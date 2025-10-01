from django.urls import path
from . import views
from .views import CancionDetailAPI, AlbumDetailAPI


app_name = 'musica'
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('artistas/', views.lista_artistas, name='lista_artistas'),
    path('inicio/', views.inicio, name='inicio'),
    path('buscar/', views.buscar, name='buscar'),
    path('cancion/<str:spotify_id>/', views.detalle_cancion, name='detalle_cancion'),
    path('cancion/<int:cancion_id>/comentario/', views.agregar_comentario_cancion, name='agregar_comentario_cancion'),
    path('cancion/<int:cancion_id>/valorar/', views.valorar_cancion, name='valorar_cancion'),
    path('album/<str:spotify_id>/valorar/', views.valorar_album, name='valorar_album'),
    path('artista/<str:spotify_id>/valorar/', views.valorar_artista, name='valorar_artista'),
    path('album/<str:spotify_id>/', views.detalle_album, name='detalle_album'),
    path('hello/', views.hello_world),
    path('artistas/', views.ArtistaList.as_view()),
    path('albums/', views.AlbumList.as_view()),
    path('canciones/', views.CancionList.as_view()),
    path('listas/', views.ListaMusicalList.as_view()),
    path('buscar_api/', views.buscar_api, name='buscar_api'),
    path('api/cancion/<str:spotify_id>/', CancionDetailAPI.as_view(), name='cancion-detail-api'),
    path('musica/api/album/<str:hash>/', AlbumDetailAPI.as_view(), name='detalle-album'),
    path("comentario/<int:comentario_id>/borrar/", views.borrar_comentario_cancion, name="borrar_comentario"),
    path("comentario/<int:comentario_id>/editar/", views.editar_comentario_cancion, name="editar_comentario"),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/comentario/<int:comentario_id>/editar/", views.EditarComentarioCancionAPIView.as_view(), name="editar_comentario_api"),
    path("api/comentario/<int:comentario_id>/borrar/", views.borrar_comentario_cancion, name="borrar_comentario_api"),
]
