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
        self._broadcast_share("share_created", share)
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
            self._broadcast_share("share_read", share)
        serializer = ShareSerializer(share, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

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
