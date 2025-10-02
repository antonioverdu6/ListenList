import React, { useState, useEffect, useCallback } from "react";
import "../styles/styles_album.css";
import { useParams, Link } from "react-router-dom";
import { refreshAccessToken } from "../utils/auth";

function DetalleAlbum() {
  const { spotify_id } = useParams();

  // --- Hooks declarados primero ---
  const [album, setAlbum] = useState(null);
  const [canciones, setCanciones] = useState([]);
  const [userRating, setUserRating] = useState(null);
  const [avgRating, setAvgRating] = useState(0);
  const [countRating, setCountRating] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState(null);

  // --- Fetch del álbum ---
  const fetchAlbum = useCallback(async () => {
    console.log("spotify_id recibido:", spotify_id); // 👈 AÑADE ESTO
    console.log("tipo:", typeof spotify_id); // 👈 Y ESTO

    if (!spotify_id) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/musica/api/album/${spotify_id}/`);

      if (!response.ok) throw new Error("Error cargando álbum");

      const data = await response.json();
      setAlbum(data);
      setAvgRating(data.avgPuntuacion ?? 0);
      setCountRating(data.countPuntuacion ?? 0);
      setUserRating(data.userRating ?? null);
      setCanciones(data.canciones ?? []);
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
            const response = await fetch(`http://127.0.0.1:8000/musica/api/album/${spotify_id}/`);
            if (!response.ok) return;
            const data = await response.json();
            setAvgRating(data.avgPuntuacion ?? 0);
            setCountRating(data.countPuntuacion ?? 0);
        } catch (err) {
            console.error("Error actualizando rating:", err);
        }
    }, [spotify_id]);

    // --- Handler de rating ---
    const handleRating = async (puntuacion) => {
        let accessToken = localStorage.getItem("access");
        if (!accessToken) return alert("Debes iniciar sesión para valorar.");

        try {
            const payload = JSON.parse(atob(accessToken.split(".")[1]));
            if (Date.now() / 1000 > payload.exp) {
                accessToken = await refreshAccessToken();
                if (!accessToken) return alert("No se pudo refrescar token, inicia sesión de nuevo.");
            }
        } catch (err) {
            console.error("Error decodificando token:", err);
        }

        try {
            const response = await fetch(
                `http://127.0.0.1:8000/musica/album/${spotify_id}/valorar/`, 
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ puntuacion }),
                }
            );

            if (!response.ok) throw new Error("Error valorando álbum");

            setUserRating(puntuacion);
            fetchRating();
        } catch (err) {
            console.error(err);
            alert("No se pudo valorar el álbum.");
        }
    };

    useEffect(() => {
        fetchAlbum();
        const interval = setInterval(fetchRating, 10000);
        return () => clearInterval(interval);
    }, [fetchAlbum, fetchRating]);

    if (error) return <p style={{ color: "crimson" }}>Error: {error}</p>;
    if (!album) return <p>Cargando...</p>;


return (
    <>
        <header className="header-bar">
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
                    <Link to="/">Inicio</Link>
                </li>
                <li>
                    <Link to="#">Mi Perfil</Link>
                </li>
                <li>
                    <Link to="#">ListenList Plus</Link>
                </li>
                <li>
                    <Link to="#">Configuración</Link>
                </li>
            </ul>
        </nav>

        <div className="detalle-album-page">
            <main className="album-detalle">
                <h1 className="album-title">{album.titulo}</h1>
                <h2>Artista: {album.artista?.nombre ?? "Desconocido"}</h2>

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
            </main>
        </div>
    </>
);
}

export default DetalleAlbum;
