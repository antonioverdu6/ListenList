from rest_framework.permissions import BasePermission


class IsShareParticipant(BasePermission):
    """Permite acceso sólo si el usuario forma parte del share."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user and user.is_authenticated:
            return obj.sender_id == user.id or obj.recipient_id == user.id
        return False