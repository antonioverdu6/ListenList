document.addEventListener('DOMContentLoaded', function () {
    const estrellasContainer = document.getElementById('estrellas');

    if (estrellasContainer) {
        const cancionId = estrellasContainer.dataset.cancionId;

        estrellasContainer.querySelectorAll('input[type="radio"]').forEach(input => {
            input.addEventListener('change', function () {
                const puntuacion = this.value;

                // Creamos un formulario dinámico para hacer POST y recargar la página
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = `/musica/cancion/${cancionId}/valorar/`;

                // CSRF token
                const csrfInput = document.createElement('input');
                csrfInput.type = 'hidden';
                csrfInput.name = 'csrfmiddlewaretoken';
                csrfInput.value = getCookie('csrftoken');
                form.appendChild(csrfInput);

                // Puntuación
                const puntuacionInput = document.createElement('input');
                puntuacionInput.type = 'hidden';
                puntuacionInput.name = 'puntuacion';
                puntuacionInput.value = puntuacion;
                form.appendChild(puntuacionInput);

                document.body.appendChild(form);
                form.submit(); // Esto recargará la página y actualizará los datos
            });
        });
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

    // Funcionalidad de comentarios
    function mostrarFormulario(container, parentId = '') {
        const existingForm = document.querySelector('#form-comentario');
        const clonedForm = existingForm.cloneNode(true);
        clonedForm.style.display = 'block';
        clonedForm.id = '';

        clonedForm.querySelector('input[name="parent_id"]').value = parentId;

        const textarea = clonedForm.querySelector('textarea');
        textarea.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                clonedForm.submit();
            }
        });

        container.innerHTML = '';
        container.appendChild(clonedForm);
        textarea.focus();
    }

    document.getElementById('btn-nuevo-comentario')?.addEventListener('click', () => {
        const container = document.getElementById('nuevo-comentario-container');
        mostrarFormulario(container);
    });

    document.querySelectorAll('.responder').forEach(btn => {
        btn.addEventListener('click', () => {
            const parentId = btn.dataset.id;
            const container = document.querySelector(`.formulario-respuesta[data-container-id="${parentId}"]`);
            mostrarFormulario(container, parentId);
        });
    });

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
