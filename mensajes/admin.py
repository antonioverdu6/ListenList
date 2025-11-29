from django.contrib import admin

from .models import Share


@admin.register(Share)
class ShareAdmin(admin.ModelAdmin):
    list_display = ("id", "sender", "recipient", "content_type", "item_id", "created_at", "is_read")
    list_filter = ("content_type", "is_read", "created_at")
    search_fields = ("item_id", "message_text", "sender__username", "recipient__username")
    readonly_fields = ("created_at", "read_at", "deleted_at")
