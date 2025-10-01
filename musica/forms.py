from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm
from .models import ValoracionCancion, ValoracionAlbum, ValoracionArtista


class RegistroForm(UserCreationForm):
    email = forms.EmailField(required=True, help_text='Requerido. Introduce una dirección de correo válida.')

    class Meta:
        model = User
        fields = ("username", "email", "password1", "password2")

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data['email']
        if commit:
            user.save()
        return user


class ValoracionCancionForm(forms.ModelForm):
    class Meta:
        model = ValoracionCancion
        fields = ['puntuacion']
        widgets = {
            'puntuacion': forms.RadioSelect(choices=[(i, str(i)) for i in range(1, 6)])
        }

class ValoracionAlbumForm(forms.ModelForm):
    class Meta:
        model = ValoracionAlbum
        fields = ['puntuacion']
        widgets = {
            'puntuacion': forms.RadioSelect(choices=[(i, str(i)) for i in range(1, 6)])
        }

class ValoracionArtistaForm(forms.ModelForm):
    class Meta:
        model = ValoracionArtista
        fields = ['puntuacion']
        widgets = {
            'puntuacion': forms.RadioSelect(choices=[(i, str(i)) for i in range(1, 6)])
        }
