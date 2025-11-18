import React, { useState, useEffect, useCallback} from "react";
import "../styles/styles_detalle.css";
import { refreshAccessToken } from "../utils/auth";
import { useParams, Link, useNavigate } from "react-router-dom";
import NotificationPanel from "../components/NotificationPanel";




function DetalleCancion() {
  const { spotifyId } = useParams();
  const [cancion, setCancion] = useState(null);
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState("");
  const [letra, setLetra] = useState("");
  const [userRating, setUserRating] = useState(null);
  const [avgRating, setAvgRating] = useState(0);
  const [countRating, setCountRating] = useState(0);
  const [cancionesRecomendadas, setCancionesRecomendadas] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showNuevoComentario, setShowNuevoComentario] = useState(false);
  const [nuevoComentarioTexto, setNuevoComentarioTexto] = useState("");
  const [respuestaForms, setRespuestaForms] = useState({});
  const [respuestasTexto, setRespuestasTexto] = useState({});
  const [error, setError] = useState(null);
  const [comentarioEditando, setComentarioEditando] = useState(null);
  const [textoEditando, setTextoEditando] = useState("");
  
  const fetchCancion = useCallback(async () => {
    try {
      // Pedimos la canción usando spotifyId
      const response = await fetch(`http://127.0.0.1:8000/musica/cancion/${spotifyId}/`);
      const data = await response.json();

      setCancion(data);
      setAvgRating(data.avgRating ?? 0);
      setCountRating(data.countRating ?? 0);

      // Aquí es la clave: usar directamente userRating que devuelve la API
      // para mantener la estrella incluso tras refrescar
      setUserRating(data.userRating ?? null);

      setComentarios(data.comentarios ?? []);
      setCancionesRecomendadas(data.cancionesRecomendadas ?? []);
      setLetra(data.letra ?? "");
      setError(null);
      console.log("Spotify ID del álbum:", data.album.spotify_id);

    } catch (err) {
      console.error(err);
      setError(err.message);
      setCancion(null);
    }
  }, [spotifyId]);



  const fetchRating = useCallback(async () => {
    if (!cancion?.id) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/musica/cancion/${spotifyId}/`);
      if (!response.ok) {
        console.error("Error en la API:", response.status, response.statusText);
        return;
      }

      const data = await response.json();

      // Solo actualizar avg y count, no tocar userRating si el usuario ya lo seleccionó
      setAvgRating(data.avgRating ?? 0);
      setCountRating(data.countRating ?? 0);
    } catch (err) {
      console.error("Error actualizando rating:", err);
    }
  }, [cancion?.id, spotifyId]);

  // Tu handler original, perfecto tal como está
  const handleRating = async (puntuacion) => {
    let accessToken = localStorage.getItem("access");
    if (!accessToken) {
      alert("Debes iniciar sesión para valorar.");
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/cancion/${cancion.id}/valorar/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ puntuacion }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error valorando canción:", errorText);
        throw new Error("Error valorando canción");
      }

      const data = await response.json();
      console.log("Canción valorada:", data);

      // Actualizamos inmediatamente el rating del usuario
      setUserRating(puntuacion);

      // Refrescamos avg y count
      fetchRating();
    } catch (err) {
      console.error(err);
      alert("No se pudo valorar la canción.");
    }
  };

  useEffect(() => {
    fetchCancion();
    const interval = setInterval(fetchRating, 10000);
    return () => clearInterval(interval);
  }, [fetchCancion, fetchRating]);

  useEffect(() => {
    async function fetchUnread() {
      const token = localStorage.getItem('access');
      if (!token) return;
      try {
        const res = await fetch('http://127.0.0.1:8000/musica/api/notificaciones/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.unread !== 'undefined') setUnreadNotifications(Number(data.unread));
      } catch (err) {
        console.debug('No se pudo obtener contador de notificaciones (cancion):', err);
      }
    }
    if (menuOpen) fetchUnread();
    if (!menuOpen) fetchUnread();
  }, [menuOpen]);

  // Asegurarnos de que al entrar en la página la vista esté en la parte superior.
  // Esto evita que, al navegar desde un álbum u otra página, el scroll se mantenga a mitad.
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch (err) {
      // En entornos donde window no exista, evitamos lanzar errores.
      console.debug("scrollTo no disponible:", err);
    }
  }, [spotifyId]);


  const getArtistName = (item) => {
    const album = item?.album;
    if (!album) return "Desconocido";
    const artista = album.artista;
    if (!artista) return "Desconocido";
    if (typeof artista === "string") return artista;
    if (artista?.nombre) return artista.nombre;
    if (artista?.name) return artista.name;
    return "Desconocido";
  };

  const artistId = (() => {
    const a = cancion?.album?.artista;
    if (!a) return null;
    if (typeof a === "string") return null;
    return a.id ?? a.pk ?? a.spotify_id ?? null;
  })();


  const toggleRespuestaForm = (id) => {
    setRespuestaForms((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleNuevoComentario = async (e, parentId = null) => {
    e.preventDefault();

    let accessToken = localStorage.getItem("access");
    if (!accessToken) {
      alert("No hay token de acceso. Debes iniciar sesión.");
      return;
    }

    // Revisar si el token ha expirado
    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      const ahora = Date.now() / 1000;
      if (ahora > payload.exp) {
        console.log("Token expirado, refrescando...");
        accessToken = await refreshAccessToken(); // obtiene y guarda el token nuevo
        if (!accessToken) {
          alert("No se pudo refrescar el token. Inicia sesión de nuevo.");
          return;
        }
      }
    } catch (err) {
      console.error("Error decodificando token:", err);
    }

    const texto = parentId ? respuestasTexto[parentId] : nuevoComentarioTexto;
    console.log("[handleNuevoComentario] Iniciando envío", { parentId, texto });

    try {
      const formData = new FormData();
      formData.append("texto", texto);
      if (parentId) formData.append("parent_id", parentId);

      const response = await fetch(
        `http://127.0.0.1:8000/musica/cancion/${cancion.id}/comentario/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`, // <--- usamos el token actualizado
          },
          body: formData,
        }
      );

      console.log("[handleNuevoComentario] POST completado, status:", response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error("[handleNuevoComentario] Error en POST:", text);
        throw new Error(`Error al enviar comentario: HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log("[handleNuevoComentario] Comentario enviado correctamente:", data);
      setComentarios(data.comentarios ?? []);

      if (parentId) {
        setRespuestasTexto((prev) => ({ ...prev, [parentId]: "" }));
        setRespuestaForms((prev) => ({ ...prev, [parentId]: false }));
      } else {
        setNuevoComentarioTexto("");
        setShowNuevoComentario(false);
      }
    } catch (err) {
      console.error("[handleNuevoComentario] ERROR GLOBAL:", err);
      alert("No se pudo enviar el comentario. Revisa la consola para más detalles.");
    }
  };

  const handleBorrarComentario = async (comentarioId) => {
    let accessToken = localStorage.getItem("access");
    if (!accessToken) {
      alert("Debes iniciar sesión para borrar un comentario");
      return;
    }

    try {
      // refrescar token si está expirado
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      const ahora = Date.now() / 1000;
      if (ahora > payload.exp) {
        accessToken = await refreshAccessToken();
        if (!accessToken) return;
      }

      const response = await fetch(
        `http://127.0.0.1:8000/musica/api/comentario/${comentarioId}/borrar/`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) throw new Error("Error al borrar comentario");

      // Actualiza la lista de comentarios
      setComentarios((prev) => prev.filter(c => c.id !== comentarioId));
    } catch (err) {
      console.error("Error borrando comentario:", err);
      alert("No se pudo borrar el comentario");
    }
  };

  const handleEditarComentario = async (comentarioId, nuevoTexto) => {
    const accessToken = localStorage.getItem("access");
    if (!accessToken) return alert("Debes iniciar sesión para editar.");

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/musica/comentario/${comentarioId}/editar/`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ texto: nuevoTexto }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        console.error("Error editando comentario:", data);
        throw new Error("Error editando comentario");
      }

      const data = await response.json();
      console.log("Comentario editado:", data);

      // Actualiza la lista de comentarios localmente
      setComentarios((prev) =>
        prev.map((c) => (c.id === comentarioId ? { ...c, texto: data.texto } : c))
      );
    } catch (err) {
      console.error(err);
      alert("No se pudo editar el comentario.");
    }
  };

  if (error) return <p style={{ color: "crimson" }}>Error: {error}</p>;
  if (!cancion) return <p>Cargando...</p>;

  const onSubmitSearch = (e) => {
    e.preventDefault();
    if (!searchQ.trim()) return;
    navigate(`/buscar?q=${encodeURIComponent(searchQ.trim())}`);
  };

  return (
    <>
      
      <header className="header-bar">
        <div className="header-center">
          <button className="back-btn" onClick={() => navigate(-1)} aria-label="Volver">Volver</button>
          <form className="header-search" onSubmit={onSubmitSearch}>
            <input
              className="header-search-input"
              type="text"
              placeholder="Buscar..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
          </form>
        </div>
        <div className="header-right">
          <button className="header-bell" onClick={() => setPanelOpen(true)} aria-label="Notificaciones">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M15 17H9a3 3 0 0 1-3-3V9a6 6 0 1 1 12 0v5a3 3 0 0 1-3 3z" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadNotifications > 0 && <span className="header-badge">{unreadNotifications}</span>}
          </button>
        </div>
        <div className="logo">
          ListenList <span>beta</span>
        </div>
      </header>

      <div
        className={`menu-btn ${menuOpen ? "active" : ""}`}
        onClick={() => setMenuOpen(!menuOpen)}
      ></div>

      <nav className={`side-menu ${menuOpen ? "show" : ""}`}>
        <ul>
          <li>
            <Link to="/" className="side-menu-link">Inicio</Link>
          </li>
          <li>
            <Link to="/perfil" className="side-menu-link">Mi Perfil</Link>
          </li>
          <li>
            <Link to="#" className="side-menu-link">ListenList Plus</Link>
          </li>
          <li>
            <Link to="#" className="side-menu-link">Configuración</Link>
          </li>
        </ul>
      </nav>

      <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />

      <div className="detalle-cancion-page">
        <h1>{cancion.titulo ?? "Sin título"}</h1>
        <h2>
          Artista: {
            artistId ? (
                <Link to={`/artista/${artistId}`} className="artista">{getArtistName(cancion)}</Link>
            ) : (
              getArtistName(cancion)
            )
          }
        </h2>

        <div className="detalle-cancion">
          <div className="imagen-cancion">
            {cancion.album?.imagen_url ? (
              <img
                src={cancion.album.imagen_url}
                alt={`Portada de ${cancion.album?.titulo ?? ""}`}
              />
            ) : (
              <p>
                <em>Sin imagen disponible</em>
              </p>
            )}
          </div>

          <div className="info-cancion">
            <p className="album">
              Álbum:{" "}
              {cancion.album ? (
                <Link to={`/album/${cancion.album.spotify_id}`}>{cancion.album.titulo}</Link>
              ) : (
                "Desconocido"
              )}
            </p>
            <p className="duracion">
              Duración: {cancion.duracion_formateada ?? cancion.duracion ?? "—"}
            </p>
            <p className="fecha">{cancion.fecha_formateada ?? "—"}</p>
          </div>

          <div className="valoracion-box">
            <div className="estrellas">
              {[5, 4, 3, 2, 1].map((i) => (
                <React.Fragment key={i}>
                  <input
                    type="radio"
                    id={`star${i}`}
                    name="puntuacion"
                    value={i}
                    checked={userRating === i}
                    onChange={() => handleRating(i)}
                  />
                  <label htmlFor={`star${i}`}>&#9733;</label>
                </React.Fragment>
              ))}
            </div>
            <p className="avg">
              Valoración media: {Number(avgRating).toFixed(1)} ({countRating} votos)
            </p>

            <section className="recomendaciones">
              <h3>Canciones recomendadas</h3>
              <div className="flashcards-container">
                {cancionesRecomendadas.length > 0 ? (
                  cancionesRecomendadas.map((rec) => (
                    <Link
                      key={rec.spotify_id}
                      to={`/cancion/${rec.spotify_id}`}
                      className="flashcard"
                    >
                      {rec.album?.imagen_url ? (
                        <img
                          src={rec.album.imagen_url}
                          alt={`Portada de ${rec.album?.titulo ?? ""}`}
                          className="flashcard-img"
                        />
                      ) : (
                        <div className="flashcard-img-placeholder">Sin imagen</div>
                      )}
                      <div className="flashcard-info">
                        <h4>{rec.titulo_trunc ?? rec.titulo ?? "—"}</h4>
                        <p>{getArtistName(rec)}</p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p>No hay canciones recomendadas disponibles.</p>
                )}
              </div>
            </section>
          </div>

          <div className="letra-cancion">
            <h3>Letra</h3>
            {letra ? (
              <pre style={{ whiteSpace: "pre-wrap" }}>{letra}</pre>
            ) : (
              <p>No se encontró la letra de esta canción.</p>
            )}
          </div>
        </div>

        <div className="comentarios-section">
          <h3>
            Comentarios <span className="comentario-sticker">({comentarios.length})</span>
          </h3>

          <button
            onClick={() => setShowNuevoComentario((prev) => !prev)}
            className="btn-nuevo-comentario"
          >
            Comentar...
          </button>

          {showNuevoComentario && (
            <form
              className="form-nuevo-comentario"
              onSubmit={(e) => handleNuevoComentario(e, null)}
            >
              <textarea
                name="texto"
                placeholder="Escribe tu comentario..."
                value={nuevoComentarioTexto}
                onChange={(e) => setNuevoComentarioTexto(e.target.value)}
                required
              />
              <button type="submit">Publicar</button>
            </form>
          )}

          {comentarios.length > 0 ? (
            comentarios.map((comentario) => (
              <article className="comentario" key={comentario.id}>
                <p>
                  <strong>{comentario.autor}</strong> dijo:
                </p>
                {comentarioEditando === comentario.id ? (
                  <div>
                    <textarea
                      value={textoEditando}
                      onChange={(e) => setTextoEditando(e.target.value)}
                    />
                    <p> </p>
                    <span className="icono-editar" title="Guardar"
                      onClick={async () => {
                        await handleEditarComentario(comentario.id, textoEditando);
                        setComentarioEditando(null);
                      }}
                    >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" /> {/* Este path dibuja un tick */}
                    </svg>
                  </span>
                    <span
                      className="icono-borrar"
                      onClick={() => setComentarioEditando(null)}
                    >
                      <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    </span>
                  </div>
                ) : (
                  <p>{comentario.texto}</p>
                )}
                <div className="comentario-botones">
                  {/* Botón Responder */}
                  <button
                    className="responder"
                    onClick={() => toggleRespuestaForm(comentario.id)}
                  >
                    Responder
                  </button>

                  {/* Icono Compartir */}
                  <span className="icono-editar" title="Compartir">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="18" cy="5" r="3"></circle>
                      <circle cx="6" cy="12" r="3"></circle>
                      <circle cx="18" cy="19" r="3"></circle>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                  </span>

                  {/* Icono Editar */}
                  <span
                    className="icono-editar"
                    onClick={() => {
                      setComentarioEditando(comentario.id);
                      setTextoEditando(comentario.texto);
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </span>

                  {/* Icono Borrar */}
                  <span
                    className="icono-borrar"
                    onClick={() => handleBorrarComentario(comentario.id)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </span>
                </div>
                {respuestaForms[comentario.id] && (
                  <form
                    className="form-respuesta"
                    onSubmit={(e) => handleNuevoComentario(e, comentario.id)}
                  >
                    <textarea
                      name="texto"
                      placeholder="Escribe tu respuesta..."
                      value={respuestasTexto[comentario.id] || ""}
                      onChange={(e) =>
                        setRespuestasTexto({
                          ...respuestasTexto,
                          [comentario.id]: e.target.value,
                        })
                      }
                      required
                    />
                    <button type="submit">Publicar</button>
                  </form>
                )}
                <div className="respuestas">
                  {comentario.respuestas &&
                    comentario.respuestas.map((respuesta) => (
                      <article className="respuesta" key={respuesta.id}>
                        <p>
                          <strong>{respuesta.autor}</strong> respondió:
                        </p>
                        <p>{respuesta.texto}</p>
                      </article>
                    ))}
                </div>
              </article>
            ))
          ) : (
            <p>No hay comentarios aún.</p>
          )}
        </div>
      </div>
    </>
  );
}

export default DetalleCancion;
