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
    path('cancion/<int:cancion_id>/valorar/', views.valorar_cancion, name='valorar-cancion-api'),
    path("api/album/<str:spotify_id>/valorar/",views.valorar_album,name="valorar_album_api"),    
    path('artista/<str:spotify_id>/valorar/', views.valorar_artista, name='valorar_artista'),
    path('album/<str:spotify_id>/', views.detalle_album, name='detalle_album'),
    path('hello/', views.hello_world),
    path('artistas/', views.ArtistaList.as_view()),
    path('albums/', views.AlbumList.as_view()),
    path('canciones/', views.CancionList.as_view()),
    path('listas/', views.ListaMusicalList.as_view()),
    path('buscar_api/', views.buscar_api, name='buscar_api'),
    path('api/cancion/<str:spotify_id>/', CancionDetailAPI.as_view(), name='cancion-detail-api'),
    path('api/album/<str:spotify_id>/', AlbumDetailAPI.as_view(), name='detalle-album-api'),
    path("comentario/<int:comentario_id>/borrar/", views.borrar_comentario_cancion, name="borrar_comentario"),
    path("comentario/<int:comentario_id>/editar/", views.editar_comentario_cancion, name="editar_comentario"),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/comentario/<int:comentario_id>/editar/", views.EditarComentarioCancionAPIView.as_view(), name="editar_comentario_api"),
    path("api/comentario/<int:comentario_id>/borrar/", views.borrar_comentario_cancion, name="borrar_comentario_api"),
    path("api/albumes/<int:album_id>/comentarios/",views.agregar_comentario_album,name="agregar_comentario_album"),
    path("api/comentario_album/<int:comentario_id>/borrar/",views.borrar_comentario_album,name="borrar_comentario_album"),
    path("api/comentario_album/<int:comentario_id>/editar/",views.editar_comentario_album,name="editar_comentario_album"),
    path("api/artistas/<int:artista_id>/comentarios/", views.agregar_comentario_artista, name="agregar_comentario_artista"),
    path("api/comentario_artista/<int:comentario_id>/borrar/", views.borrar_comentario_artista, name="borrar_comentario_artista"),
    path("api/comentario_artista/<int:comentario_id>/editar/", views.editar_comentario_artista, name="editar_comentario_artista"),
    path("api/usuarios/<str:username>/", views.PerfilDetailAPI.as_view(), name="perfil-detail"),
    path("api/artistas/", views.ArtistaList.as_view(), name="artistas-api"),
    path("api/artista/<int:id>/", views.ArtistaDetailAPI.as_view(), name="artista-detail-api"),
    path("api/toggle_seguir/<str:username>/", views.toggle_seguir_usuario, name="toggle_seguir_usuario"),
    path("api/comprobar_seguimiento/<str:username>/", views.comprobar_seguimiento, name="comprobar_seguimiento"),
    # Seguimiento / notificaciones para ARTISTAS
    path("api/comprobar_seguimiento_artista/<int:artista_id>/", views.comprobar_seguimiento_artista, name="comprobar_seguimiento_artista"),
    path("api/toggle_seguir_artista/<int:artista_id>/", views.toggle_seguir_artista, name="toggle_seguir_artista"),
    path("api/comprobar_notificacion_artista/<int:artista_id>/", views.comprobar_seguimiento_artista, name="comprobar_notificacion_artista"),
    path("api/toggle_notificacion_artista/<int:artista_id>/", views.toggle_notificacion_artista, name="toggle_notificacion_artista"),
    path("api/seguidores_y_siguiendo/<str:username>/", views.seguidores_y_siguiendo, name="seguidores_y_siguiendo"),
    path("api/seguidores/<str:username>/", views.seguidores_list, name="seguidores_list"),
    path("api/siguiendo/<str:username>/", views.siguiendo_list, name="siguiendo_list"),
    path("api/perfil/<str:username>/", views.perfil_usuario, name="perfil_usuario"),
    path("api/editar_perfil/", views.editar_perfil, name="editar_perfil"),
    path("api/usuarios_buscar/", views.buscar_usuarios, name="buscar_usuarios"),
    path("api/artistas_buscar/", views.buscar_artistas, name="buscar_artistas"),
    path("api/albums_buscar/", views.buscar_albums, name="buscar_albums"),
    path("api/artistas_seguidos/<str:username>/", views.artistas_seguidos, name="artistas_seguidos"),
    # Picks management
    path("api/picks/<str:username>/", views.picks_detail, name="picks_detail"),
    # Notificaciones
    path("api/notificaciones/", views.notificaciones_lista, name="notificaciones_lista"),
    path("api/notificaciones/<int:pk>/marcar_leida/", views.notificacion_marcar_leida, name="notificacion_marcar_leida"),
    path("api/notificaciones/marcar_todas_leidas/", views.notificaciones_marcar_todas_leidas, name="notificaciones_marcar_todas_leidas"),
]
