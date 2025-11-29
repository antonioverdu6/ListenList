from django.urls import re_path

from .consumers import ShareConsumer

websocket_urlpatterns = [
    re_path(r"ws/mensajes/$", ShareConsumer.as_asgi(), name="mensajes-stream"),
]
