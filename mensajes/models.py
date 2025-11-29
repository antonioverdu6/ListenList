import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Share(models.Model):
    class ContentType(models.TextChoices):
        SONG = "song", "Song"
        ALBUM = "album", "Album"
        ARTIST = "artist", "Artist"
        PLAYLIST = "playlist", "Playlist"
        OTHER = "other", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="shares_sent",
        on_delete=models.CASCADE,
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="shares_received",
        on_delete=models.CASCADE,
    )
    content_type = models.CharField(max_length=20, choices=ContentType.choices)
    item_id = models.CharField(max_length=128)
    payload = models.JSONField(blank=True, default=dict)
    message_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(blank=True, null=True)
    deleted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read", "created_at"]),
            models.Index(fields=["sender", "created_at"]),
        ]

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at"])

    def soft_delete(self):
        if not self.deleted_at:
            self.deleted_at = timezone.now()
            self.save(update_fields=["deleted_at"])

    def __str__(self) -> str:
        return f"Share({self.id}) from {self.sender_id} to {self.recipient_id}"


def user_group_name(user_id: int | str) -> str:
    return f"user_{user_id}"