from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("musica", "0018_alter_perfil_fotoperfil"),
    ]

    operations = [
        migrations.CreateModel(
            name="SpotifyTrackFetch",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("spotify_id", models.CharField(max_length=100, unique=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("pending", "Pending"), ("success", "Success"), ("error", "Error")],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("attempts", models.PositiveIntegerField(default=0)),
                ("last_error", models.TextField(blank=True)),
                ("next_retry_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-updated_at"]},
        ),
    ]
