import logging

from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import user_group_name

logger = logging.getLogger(__name__)


class ShareConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if user is None or user.is_anonymous:
            await self.close(code=4401)  # Unauthorized
            return

        self.user = user
        self.group_name = user_group_name(user.id)
        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
        except Exception as e:
            logger.warning("group_add failed for user %s: %s", user.id, e)
        await self.accept()
        logger.debug("User %s connected to share channel", user.id)

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
            except Exception as e:
                logger.warning("group_discard failed for user %s: %s", getattr(self, "user", None), e)
            logger.debug(
                "User %s disconnected from share channel (code %s)",
                getattr(self, "user", None),
                close_code,
            )

    async def receive_json(self, content, **kwargs):
        # For now the channel is write-only from server.
        logger.debug("Ignoring inbound message on share channel: %s", content)

    async def share_created(self, event):
        await self.send_json({"type": "share.created", "data": event["data"]})

    async def share_read(self, event):
        await self.send_json({"type": "share.read", "data": event["data"]})