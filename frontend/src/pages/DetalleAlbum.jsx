import API_URL from '../config/api';
import React, { useState, useEffect, useCallback } from "react";
import "../styles/styles_album.css";
import { useParams, Link, useNavigate } from "react-router-dom";
import { refreshAccessToken } from "../utils/auth";
import NotificationPanel from "../components/NotificationPanel";

function DetalleAlbum() {
    const { spotify_id } = useParams();

    // --- Hooks declarados primero ---
    const navigate = useNavigate();
    const meUsername = localStorage.getItem('username');
    const [searchQ, setSearchQ] = useState("");
    const [album, setAlbum] = useState(null);
    const [canciones, setCanciones] = useState([]);
    const [userRating, setUserRating] = useState(null);
    const [avgRating, setAvgRating] = useState(0);
    const [countRating, setCountRating] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [panelOpen, setPanelOpen] = useState(false);
    const [error, setError] = useState(null);

    const [comentarios, setComentarios] = useState([]);
    const [showNuevoComentario, setShowNuevoComentario] = useState(false);
    const [nuevoComentarioTexto, setNuevoComentarioTexto] = useState("");
    const [respuestaForms, setRespuestaForms] = useState({});
    const [respuestasTexto, setRespuestasTexto] = useState({});
    const [comentarioEditando, setComentarioEditando] = useState(null);
    const [textoEditando, setTextoEditando] = useState("");


    // --- Fetch del álbum ---
    const fetchAlbum = useCallback(async () => {
        if (!spotify_id) return;
        try {
            const response = await fetch(`${API_URL}/musica/api/album/${spotify_id}/`);
            if (!response.ok) throw new Error("Error cargando álbum");
            const data = await response.json();

            setAlbum(data);
            setAvgRating(data.avgPuntuacion ?? 0);
            setCountRating(data.countPuntuacion ?? 0);
            setUserRating(data.userRating ?? null);
            setCanciones(data.canciones ?? []);
            setComentarios(data.comentarios ?? []);    // ← AQUÍ inicializas los comentarios
            setError(null);
        } catch (err) {
            console.error(err);
            setError(err.message);
            setAlbum(null);
        }
        }, [spotify_id]);


    // --- Actualizar solo medias ---
    const fetchRating = useCallback(async () => {
        if (!spotify_id) return;
        try {
            const response = await fetch(`${API_URL}/musica/api/album/${spotify_id}/`);
            if (!response.ok) return;
            const data = await response.json();
            setAvgRating(data.avgPuntuacion ?? 0);
            setCountRating(data.countPuntuacion ?? 0);
        } catch (err) {
            console.error("Error actualizando rating:", err);
        }
    }, [spotify_id]);

    const handleNuevoComentario = async (e, parentId = null) => {
        e.preventDefault();

        let accessToken = localStorage.getItem("access");
        if (!accessToken) {
            alert("No hay token de acceso. Debes iniciar sesión.");
            return;
        }

        try {
            const payload = JSON.parse(atob(accessToken.split(".")[1]));
            const ahora = Date.now() / 1000;
            if (ahora > payload.exp) {
                accessToken = await refreshAccessToken();
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
                `${API_URL}/musica/api/albumes/${album.id}/comentarios/`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
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
                setRespuestasTexto(prev => ({ ...prev, [parentId]: "" }));
                setRespuestaForms(prev => ({ ...prev, [parentId]: false }));
            } else {
                setNuevoComentarioTexto("");
                setShowNuevoComentario(false);
            }
        } catch (err) {
            console.error("[handleNuevoComentario] ERROR GLOBAL:", err);
            alert("No se pudo enviar el comentario. Revisa la consola para más detalles.");
        }
    };

    const handleBorrarComentario = async comentarioId => {
        let accessToken = localStorage.getItem("access");
        if (!accessToken) {
            alert("Debes iniciar sesión para borrar un comentario");
            return;
        }

        try {
            const payload = JSON.parse(atob(accessToken.split(".")[1]));
            const ahora = Date.now() / 1000;
            if (ahora > payload.exp) {
                accessToken = await refreshAccessToken();
                if (!accessToken) return;
            }

            const response = await fetch(
                `${API_URL}/musica/api/comentario_album/${comentarioId}/borrar/`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${accessToken}` },
                }
            );

            if (!response.ok) throw new Error("Error al borrar comentario");

            setComentarios(prev => prev.filter(c => c.id !== comentarioId));
        } catch (err) {
            console.error("Error borrando comentario:", err);
            alert("No se pudo borrar el comentario");
        }
    };

    const handleEditarComentario = async (comentarioId, nuevoTexto) => {
        let accessToken = localStorage.getItem("access");
        if (!accessToken) {
            return alert("Debes iniciar sesión para editar.");
        }

        // Refrescar token si ha expirado
        try {
            const payload = JSON.parse(atob(accessToken.split(".")[1]));
            if (Date.now() / 1000 > payload.exp) {
            accessToken = await refreshAccessToken();
            if (!accessToken) {
                return alert("No se pudo refrescar token. Inicia sesión de nuevo.");
            }
            }
        } catch (err) {
            console.error("Error decodificando token:", err);
        }

        try {
            const response = await fetch(
            `${API_URL}/musica/api/comentario_album/${comentarioId}/editar/`,
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
            setComentarios(prev =>
            prev.map(c => (c.id === comentarioId ? { ...c, texto: data.texto } : c))
            );
        } catch (err) {
            console.error(err);
            alert("No se pudo editar el comentario.");
        }
        };


    const handleRating = async puntuacion => {
        let accessToken = localStorage.getItem("access");
        if (!accessToken) {
            return alert("Debes iniciar sesión para valorar.");
        }
        try {
            const payload = JSON.parse(atob(accessToken.split(".")[1]));
            if (Date.now() / 1000 > payload.exp) {
            accessToken = await refreshAccessToken();
            if (!accessToken) {
                return alert("No se pudo refrescar token, inicia sesión de nuevo.");
            }
            }
        } catch (err) {
            console.error("Error decodificando token:", err);
        }

        try {
            const res = await fetch(
            `${API_URL}/musica/api/album/${album.spotify_id}/valorar/`,
            {
                method: "POST",
                headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                },
                body: JSON.stringify({ puntuacion }),
            }
            );
            if (!res.ok) throw new Error("Error valorando álbum");
            setUserRating(puntuacion);
            fetchRating(); // asegúrate de tener esta función
        } catch (err) {
            console.error(err);
            alert("No se pudo valorar el álbum.");
        }
        };


    const toggleRespuestaForm = (comentarioId) => {
        setRespuestaForms(prev => ({
            ...prev,
            [comentarioId]: !prev[comentarioId],
        }));
    };

    useEffect(() => {
        fetchAlbum();
        const interval = setInterval(fetchRating, 10000);
        return () => clearInterval(interval);
    }, [fetchAlbum, fetchRating]);

    useEffect(() => {
        async function fetchUnread() {
            const token = localStorage.getItem('access');
            if (!token) return;
            try {
                const res = await fetch(`${API_URL}/musica/api/notificaciones/`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) return;
                const data = await res.json();
                if (typeof data.unread !== 'undefined') setUnreadNotifications(Number(data.unread));
            } catch (err) {
                console.debug('No se pudo obtener contador de notificaciones (album):', err);
            }
        }
        if (menuOpen) fetchUnread();
        if (!menuOpen) fetchUnread();
    }, [menuOpen]);

    if (error) return <p style={{ color: "crimson" }}>Error: {error}</p>;
    if (!album) return <p>Cargando...</p>;

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
                        <input className="header-search-input" type="text" placeholder="Buscar..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
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
                <Link to="/" className="logo">ListenList <span>beta</span></Link>
            </header>

            <div
                className={`menu-btn ${menuOpen ? "active" : ""}`}
                onClick={() => setMenuOpen(!menuOpen)}
            ></div>

            <nav className={`side-menu ${menuOpen ? "show" : ""}`}>
                <ul>
                    <li>
                        <Link to="/">Inicio</Link>
                    </li>
                    {meUsername && (
                    <li>
                        <Link to={`/perfil/${meUsername}`}>Mi Perfil</Link>
                    </li>
                    )}
                    <li>
                        <Link to="#">ListenList Plus</Link>
                    </li>
                    <li>
                        <Link to="#">Configuración</Link>
                    </li>
                </ul>
            </nav>

            <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />

            <div className="detalle-album-page">
                <main className="album-detalle">
                    <h1 className="album-title">{album.titulo}</h1>
                    {(() => {
                        const a = album?.artista;
                        const artistId = a ? (a.id ?? a.pk ?? a.spotify_id ?? null) : null;
                        return (
                            <h2>
                                Artista: {artistId ? (
                                        <Link to={`/artista/${artistId}`} className="artista">{album.artista?.nombre ?? "Desconocido"}</Link>
                                ) : (
                                    album.artista?.nombre ?? "Desconocido"
                                )}
                            </h2>
                        );
                    })()}

                    <div className="album-columns">
                        {/* INFO ÁLBUM */}
                        <div className="album-info">
                            {album.imagen_url ? (
                                <img src={album.imagen_url} alt={`Portada de ${album.titulo}`} />
                            ) : (
                                <p>
                                    <em>Sin imagen disponible</em>
                                </p>
                            )}

                            <div className="valoracion-box">
                                <div className="estrellas">
                                    {[5, 4, 3, 2, 1].map((i) => (
                                        <React.Fragment key={i}>
                                            <input
                                                type="radio"
                                                id={`star${i}`}
                                                name="puntuacion-album"
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
                            </div>

                            <div className="info-cancion">
                                <p>
                                    <strong>Número de canciones:</strong> {Array.isArray(canciones) ? canciones.length : "—"}
                                </p>
                                <p>
                                    <strong>Duración total:</strong>{" "}
                                    {album.duracion_formateada ?? "—"}
                                </p>
                                <p>
                                    <strong>Fecha de lanzamiento:</strong>{" "}
                                    {album.fecha_lanzamiento ?? "—"}
                                </p>
                            </div>
                        </div>

                        {/* LISTA DE CANCIONES */}
                        <div className="album-songs">
                            <h3>Canciones</h3>
                            <ol>
                                {canciones.length > 0 ? (
                                    canciones.map((c) => (
                                        <li key={c.spotify_id}>
                                            <Link to={`/cancion/${c.spotify_id}`}>{c.titulo}</Link>
                                            <span className="nota-media">
                                                {c.valoracion_media ? (
                                                    <>
                                                        {c.valoracion_media.toFixed(1)}
                                                    </>
                                                ) : (
                                                    "Sin valoraciones"
                                                )}
                                            </span>
                                            <span className="duracion">{c.duracion_formateada}</span>
                                        </li>
                                    ))
                                ) : (
                                    <p>No hay canciones en este álbum.</p>
                                )}
                            </ol>
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
                                                    <path d="M20 6L9 17l-5-5" />
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
                </main>
            </div>
        </>
    );
}

export default DetalleAlbum;
