from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('musica', '0014_artista_spotify_id'),
    ]

    operations = [
        migrations.CreateModel(
            name='SeguimientoArtista',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('notificaciones', models.BooleanField(default=False)),
                ('fecha', models.DateTimeField(auto_now_add=True)),
                ('artista', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='seguidores', to='musica.artista')),
                ('seguidor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='artistas_seguidos', to='auth.user')),
            ],
            options={
                'unique_together': {('seguidor', 'artista')},
            },
        ),
    ]
