from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from channels.auth import AuthMiddlewareStack
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken, TokenError


class JWTAuthMiddleware(BaseMiddleware):
    """Autenticación JWT para conexiones WebSocket."""

    def __init__(self, inner):
        super().__init__(inner)
        self.jwt_auth = JWTAuthentication()

    async def __call__(self, scope, receive, send):
        token = self._get_token_from_scope(scope)
        scope["user"] = AnonymousUser()
        if token:
            user = await self._get_user(token)
            if user is not None:
                scope["user"] = user
        return await super().__call__(scope, receive, send)

    def _get_token_from_scope(self, scope):
        headers = dict(scope.get("headers", []))
        auth_header = headers.get(b"authorization")
        if auth_header:
            prefix, _, token = auth_header.partition(b" ")
            if prefix.lower() == b"bearer" and token:
                return token.decode()
        query_string = scope.get("query_string", b"").decode()
        if query_string:
            params = parse_qs(query_string)
            token_list = params.get("token")
            if token_list:
                return token_list[0]
        return None

    @database_sync_to_async
    def _get_user(self, raw_token):
        try:
            validated_token = self.jwt_auth.get_validated_token(raw_token)
            return self.jwt_auth.get_user(validated_token)
        except (InvalidToken, TokenError, AuthenticationFailed):
            return None


def JWTAuthMiddlewareStack(inner):
    """Helper que combina AuthMiddlewareStack con JWTAuthMiddleware."""

    return JWTAuthMiddleware(AuthMiddlewareStack(inner))
