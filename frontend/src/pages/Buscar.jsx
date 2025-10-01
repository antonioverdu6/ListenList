import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import "../styles/styles_buscar.css";

// Hook para leer query string
function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function Buscar() {
  const queryParam = useQuery().get("q") || "";
  const [query, setQuery] = useState(queryParam);
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);

  // Función para buscar canciones desde Django
const buscarCanciones = async (q) => {
    if (!q.trim()) return; // evitar llamadas con string vacío
    setLoading(true);
    try {
        const response = await fetch(
            `http://127.0.0.1:8000/musica/buscar_api/?q=${encodeURIComponent(q)}`
        );

        if (!response.ok) throw new Error("Error en la API");

        const data = await response.json();
        setResultados(data);
    } catch (err) {
        console.error("Error:", err);
        setResultados([]);
    } finally {
        setLoading(false);
    }
};


  // Lanza la búsqueda si hay query en la URL
  useEffect(() => {
    if (queryParam) {
      buscarCanciones(queryParam);
    }
  }, [queryParam]);

  // Maneja submit del form
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    buscarCanciones(query);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="search-form">
        <Link to="/" className="search-button">
          Volver
        </Link>
        <input
          type="text"
          name="q"
          placeholder="Buscar canción..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
        <button type="submit" className="search-button">
          Buscar
        </button>
      </form>

      {loading && <p style={{ textAlign: "center" }}>Buscando...</p>}

      <div className="song-grid">
        {resultados.map(
          (cancion) =>
            cancion.spotify_id &&
            cancion.nombre && (
              <div className="song-tile" key={cancion.spotify_id}>
                <Link
                  to={`/cancion/${cancion.spotify_id}`}
                  className="song-link"
                >
                  <div className="song-cover">
                    <img
                      src={cancion.imagen}
                      alt={`Portada de ${cancion.nombre}`}
                    />
                    {cancion.preview_url && (
                      <audio
                        controls
                        src={cancion.preview_url}
                        className="song-audio"
                      />
                    )}
                  </div>
                  <div className="song-info">
                    <h2 className="song-title" title={cancion.nombre}>
                      {cancion.nombre_trunc}
                    </h2>
                    <p className="song-artist">{cancion.artista}</p>
                    <p className="song-album">
                      Álbum: <span title={cancion.album}>{cancion.album_trunc}</span>
                    </p>
                  </div>
                </Link>
                <a
                  href={`https://open.spotify.com/track/${cancion.spotify_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="spotify-link"
                >
                  <span className="spotify-icon"></span> Escuchar en Spotify
                </a>
              </div>
            )
        )}
      </div>
    </div>
  );
}

export default Buscar;
