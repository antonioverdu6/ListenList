from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Share

User = get_user_model()


@override_settings(
    CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
)
class ShareAPITests(APITestCase):
    def setUp(self):
        self.sender = User.objects.create_user(username="sender", password="pass1234")
        self.recipient = User.objects.create_user(username="recipient", password="pass1234")
        self.list_url = reverse("share-list")

    def auth(self, user):
        self.client.force_authenticate(user)

    def test_user_can_create_share(self):
        self.auth(self.sender)
        payload = {
            "recipient_id": self.recipient.id,
            "content_type": "song",
            "item_id": "spotify:track:123",
            "payload": {"title": "Canción"},
            "message_text": "Debes escucharla",
        }
        response = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        share = Share.objects.get()
        self.assertEqual(share.sender, self.sender)
        self.assertEqual(share.recipient, self.recipient)

    def test_user_can_list_inbox(self):
        Share.objects.create(
            sender=self.sender,
            recipient=self.recipient,
            content_type="song",
            item_id="spotify:track:1",
        )
        self.auth(self.recipient)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_user_cannot_access_others_share(self):
        share = Share.objects.create(
            sender=self.sender,
            recipient=self.recipient,
            content_type="song",
            item_id="spotify:track:1",
        )
        other = User.objects.create_user(username="third", password="pass1234")
        self.auth(other)
        url = reverse("share-mark-read", args=[share.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_recipient_can_mark_read(self):
        share = Share.objects.create(
            sender=self.sender,
            recipient=self.recipient,
            content_type="song",
            item_id="spotify:track:1",
        )
        self.auth(self.recipient)
        url = reverse("share-mark-read", args=[share.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        share.refresh_from_db()
        self.assertTrue(share.is_read)
