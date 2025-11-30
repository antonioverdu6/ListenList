from django.db import migrations, models


def clear_remote_avatar_values(apps, schema_editor):
    Perfil = apps.get_model("musica", "Perfil")
    for perfil in Perfil.objects.exclude(fotoPerfil="").exclude(fotoPerfil=None):
        perfil.fotoPerfil = ""
        perfil.save(update_fields=["fotoPerfil"])


class Migration(migrations.Migration):

    dependencies = [
        ("musica", "0017_perfil_picks"),
    ]

    operations = [
        migrations.AlterField(
            model_name="perfil",
            name="fotoPerfil",
            field=models.ImageField(blank=True, null=True, upload_to="avatars/"),
        ),
        migrations.RunPython(clear_remote_avatar_values, migrations.RunPython.noop),
    ]
