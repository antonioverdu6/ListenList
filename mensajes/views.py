from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Share, user_group_name
from .permissions import IsShareParticipant
from .serializers import ShareCreateSerializer, ShareSerializer


class ShareViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ShareSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Share.objects.filter(deleted_at__isnull=True).filter(
            Q(sender=user) | Q(recipient=user)
        )
        box = self.request.query_params.get("box", "received")
        if box == "sent":
            queryset = queryset.filter(sender=user)
        elif box == "received":
            queryset = queryset.filter(recipient=user)
        return queryset.select_related("sender", "recipient")

    def get_serializer_class(self):
        if self.action == "create":
            return ShareCreateSerializer
        return ShareSerializer

    def perform_create(self, serializer):
        share = serializer.save(sender=self.request.user)
        # Robust: notificación y broadcast no deben romper creación
        try:
            self._create_notification(share)
        except Exception as e:
            # Silenciar para evitar 500 si hay error de notificación
            import logging
            logging.getLogger(__name__).warning("Error creando notificación share: %s", e)
        try:
            self._broadcast_share("share_created", share)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Error enviando broadcast share_created: %s", e)
        return share

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        share = self.perform_create(serializer)
        output = ShareSerializer(share, context={"request": request})
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsShareParticipant])
    def mark_read(self, request, pk=None):
        share = self.get_object()
        if share.recipient != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if not share.is_read:
            share.is_read = True
            share.read_at = timezone.now()
            share.save(update_fields=["is_read", "read_at"])
            # Broadcast robust: no debe provocar 500 si falla layer
            try:
                self._broadcast_share("share_read", share)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning("Broadcast share_read falló: %s", e)
        self._mark_message_notifications_read(share, request.user)
        serializer = ShareSerializer(share, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated], url_path="unread_count")
    def unread_count(self, request):
        user = request.user
        unread_qs = Share.objects.filter(
            recipient=user,
            is_read=False,
            deleted_at__isnull=True,
        )
        conversations = unread_qs.values("sender_id").distinct().count()
        return Response({
            "conversations_unread": conversations,
            "messages_unread": unread_qs.count(),
        })

    @staticmethod
    def _broadcast_share(event_type: str, share: Share) -> None:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        payload = ShareSerializer(share).data
        group_ids = {share.recipient_id, share.sender_id}
        for user_id in group_ids:
            async_to_sync(channel_layer.group_send)(
                user_group_name(user_id),
                {"type": event_type, "data": payload},
            )

    @staticmethod
    def _create_notification(share: Share) -> None:
        if share.sender_id == share.recipient_id:
            return
        try:
            from musica.models import Notificacion
        except Exception:
            return

        mensaje = share.message_text.strip() if share.message_text else ""
        preview = mensaje[:80] + ("…" if len(mensaje) > 80 else "") if mensaje else ""
        if preview:
            preview = " ".join(preview.splitlines()).strip()
        contenido = f"{share.sender.username} te ha enviado un mensaje"
        if preview:
            contenido = f"{contenido}: {preview}"

        try:
            Notificacion.objects.create(
                destinatario=share.recipient,
                tipo="message",
                origen_user=share.sender,
                contenido=contenido,
                enlace=f"/mensajes?to={share.sender.username}&toId={share.sender.id}",
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Error creando Notificacion de share: %s", e)

    @staticmethod
    def _mark_message_notifications_read(share: Share, user) -> None:
        try:
            from musica.models import Notificacion
        except Exception:
            return

        Notificacion.objects.filter(
            destinatario=user,
            origen_user_id=share.sender_id,
            tipo="message",
            leido=False,
        ).update(leido=True)
