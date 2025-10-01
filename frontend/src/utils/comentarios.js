import { getCookie } from './csrf';

export async function enviarComentario(cancionId, contenido) {
  const csrfToken = getCookie('csrftoken');

  const response = await fetch(`/musica/cancion/${cancionId}/comentario/`, {
    method: 'POST',
    credentials: 'include', // envía la cookie de sesión
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    body: JSON.stringify({ contenido }),
  });

  if (!response.ok) {
    throw new Error('Error al enviar comentario');
  }

  return await response.json();
}
