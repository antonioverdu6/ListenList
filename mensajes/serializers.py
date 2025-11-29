from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Share

User = get_user_model()


class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name")


class ShareSerializer(serializers.ModelSerializer):
    sender = UserSummarySerializer(read_only=True)
    recipient = UserSummarySerializer(read_only=True)

    class Meta:
        model = Share
        fields = (
            "id",
            "sender",
            "recipient",
            "content_type",
            "item_id",
            "payload",
            "message_text",
            "created_at",
            "is_read",
            "read_at",
        )
        read_only_fields = (
            "id",
            "sender",
            "recipient",
            "created_at",
            "is_read",
            "read_at",
        )


class ShareCreateSerializer(serializers.ModelSerializer):
    recipient_id = serializers.PrimaryKeyRelatedField(
        source="recipient", queryset=User.objects.all(), write_only=True
    )

    class Meta:
        model = Share
        fields = (
            "id",
            "recipient_id",
            "content_type",
            "item_id",
            "payload",
            "message_text",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        request = self.context.get("request")
        sender = getattr(request, "user", None)
        recipient = attrs["recipient"]
        if sender and recipient and sender == recipient:
            raise serializers.ValidationError("No puedes enviarte un share a ti mismo.")
        return attrs