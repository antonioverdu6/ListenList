document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM cargado, inicializando valoraciones álbum');

    // Buscar el contenedor de estrellas para álbum
    const estrellasContainer = document.querySelector('.estrellas[data-album-id]');

    if (estrellasContainer) {
        const albumId = estrellasContainer.dataset.albumId;
        console.log('Contenedor de estrellas encontrado para álbum:', albumId);

        estrellasContainer.querySelectorAll('input[type="radio"]').forEach(input => {
            input.addEventListener('change', function () {
                const puntuacion = this.value;
                console.log('Valoración seleccionada:', puntuacion);

                fetch(`/musica/album/${albumId}/valorar/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-CSRFToken': getCookie('csrftoken'),
                    },
                    body: new URLSearchParams({
                        'puntuacion': puntuacion
                    })
                })
                .then(response => {
                    console.log('Respuesta recibida:', response);
                    if (!response.ok) throw new Error('Error al guardar valoración');
                    return response.json();
                })
                .then(data => {
                    console.log('Valoración guardada:', data);
                })
                .catch(error => console.error('Error:', error));
            });
        });
    } else {
        console.warn('No se encontró el contenedor de estrellas para álbum.');
    }

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                cookie = cookie.trim();
                if (cookie.startsWith(name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    // --- Menú lateral con animación círculo → X ---
    const menuToggle = document.getElementById("menu-toggle");
    const sideMenu = document.getElementById("side-menu");

    if (menuToggle && sideMenu) {
        menuToggle.addEventListener("click", function () {
            // Alterna la clase para la animación (círculo <-> X)
            menuToggle.classList.toggle("active");

            // Alterna el menú lateral
            sideMenu.classList.toggle("show");

            // Aquí añades o quitas la clase para mover el botón con el menú
            document.body.classList.toggle("menu-open");
        });
    } else {
        console.warn("No se encontró el botón o el menú lateral en esta página.");
    }
});
