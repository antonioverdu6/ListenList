import API_URL from '../config/api';
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import "../styles/styles_buscar.css";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function Buscar() {
  const queryParam = useQuery().get("q") || "";
  const [query, setQuery] = useState(queryParam);
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categoria, setCategoria] = useState("canciones"); // 👈 nueva categoría activa

  // Buscar canciones (por defecto)
  const buscarCanciones = async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/musica/buscar_api/?q=${encodeURIComponent(q)}`
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

  const buscarAlbumes = async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/musica/api/albums_buscar/?q=${encodeURIComponent(q)}`
      );
      if (!res.ok) throw new Error("Error en la API de álbumes");
      const data = await res.json();
      setResultados(data);
    } catch (err) {
      console.error("Error buscando álbumes:", err);
      setResultados([]);
    } finally {
      setLoading(false);
    }
  };

  const buscarArtistas = async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/musica/api/artistas_buscar/?q=${encodeURIComponent(q)}`
      );
      if (!res.ok) throw new Error("Error en la API de artistas");
      const data = await res.json();
      // Deduplicate artists by name (some duplicates may exist in DB)
      const unique = Array.isArray(data)
        ? data.filter((v, i, a) => a.findIndex(t => (t.nombre || '').toLowerCase() === (v.nombre || '').toLowerCase()) === i)
        : [];
      setResultados(unique);
    } catch (err) {
      console.error("Error buscando artistas:", err);
      setResultados([]);
    } finally {
      setLoading(false);
    }
  };


  // Buscar usuarios
  const buscarUsuarios = async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/musica/api/usuarios_buscar/?q=${encodeURIComponent(q)}`
      );
      if (!res.ok) throw new Error("Error en la API de usuarios");
      const data = await res.json();
      setResultados(data);
    } catch (err) {
      console.error("Error buscando usuarios:", err);
      setResultados([]);
    } finally {
      setLoading(false);
    }
  };


  // Detectar búsqueda por tipo
  const buscarSegunCategoria = (q, cat) => {
    switch (cat) {
      case "albumes":
        buscarAlbumes(q);
        break;
      case "artistas":
        buscarArtistas(q);
        break;
      case "usuarios":
        buscarUsuarios(q);
        break;
      default:
        buscarCanciones(q);
    }
  };

  useEffect(() => {
    if (queryParam) buscarCanciones(queryParam);
  }, [queryParam]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    buscarSegunCategoria(query, categoria);
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
          placeholder="Buscar..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
        <button type="submit" className="search-button">
          Buscar
        </button>
      </form>

      {/* 🔽 NUEVO: Botones de categorías */}
      <div className="category-buttons">
        <button
          className={categoria === "canciones" ? "active" : ""}
          onClick={() => {
            setCategoria("canciones");
            buscarCanciones(query);
          }}
        >
          Canciones
        </button>
        <button
          className={categoria === "albumes" ? "active" : ""}
          onClick={() => {
            setCategoria("albumes");
            buscarAlbumes(query);
          }}
        >
          Álbumes
        </button>
        <button
          className={categoria === "artistas" ? "active" : ""}
          onClick={() => {
            setCategoria("artistas");
            buscarArtistas(query);
          }}
        >
          Artistas
        </button>
        <button
          className={categoria === "usuarios" ? "active" : ""}
          onClick={() => {
            setCategoria("usuarios");
            buscarUsuarios(query);
          }}
        >
          Usuarios
        </button>
      </div>

      {loading && <p style={{ textAlign: "center" }}>Buscando...</p>}

      {/* 🔽 Renderizado condicional según categoría */}
      <div className="song-grid">
        {categoria === "canciones" &&
          resultados.map((cancion, idx) => {
            // Defensive: some API rows may have artista as object {id, nombre}
            const artistaText =
              !cancion
                ? ""
                : typeof cancion.artista === "string"
                ? cancion.artista
                : cancion.artista?.nombre || "";
            // Use spotify_id when available, otherwise fallback to index (not ideal but prevents missing key)
            const key = cancion?.spotify_id || `${cancion?.id || 'song'}-${idx}`;
            if (!cancion) return null;
            return (
              <div className="song-tile" key={key}>
                <Link to={`/cancion/${cancion.spotify_id || ''}`} className="song-link">
                  <div className="song-cover">
                    <img src={cancion.imagen} alt={`Portada de ${cancion.nombre || ''}`} />
                    {cancion.preview_url && (
                      <audio controls src={cancion.preview_url} className="song-audio" />
                    )}
                  </div>
                  <div className="song-info">
                    <h2 className="song-title">{cancion.nombre_trunc || cancion.nombre}</h2>
                    <p className="song-artist">{artistaText}</p>
                    <p className="song-album">
                      Álbum: <span>{cancion.album_trunc || (cancion.album?.titulo || '')}</span>
                    </p>
                  </div>
                </Link>
              </div>
            );
          })}

        {categoria === "albumes" &&
          resultados.map((album) => (
            <div className="song-tile" key={album.id}>
              <Link to={`/album/${album.spotify_id}`} className="song-link">
                <div className="song-cover">
                  <img src={album.imagen_url} alt={album.titulo} />
                </div>
                <div className="song-info">
                  <h2 className="song-title">{album.titulo}</h2>
                  <p className="song-artist">{album.artista?.nombre}</p>
                </div>
              </Link>
            </div>
          ))}

        {categoria === "artistas" &&
          resultados.map((artista) => (
            <div className="song-tile" key={artista.id}>
              <Link to={`/artista/${artista.id}`} className="song-link">
                <div className="song-cover">
                  <img
                    src={artista.imagen_url || "/default-avatar.png"}
                    alt={artista.nombre}
                  />
                </div>
                <div className="song-info">
                  <h2 className="song-title">{artista.nombre}</h2>
                </div>
              </Link>
            </div>
          ))}

        {categoria === "usuarios" &&
          resultados.map((user) => (
            <div className="song-tile" key={user.username}>
              <Link to={`/perfil/${user.username}`} className="song-link">
                <div className="song-cover">
                  {user.fotoPerfil ? (
                    <img
                      src={user.fotoPerfil}
                      alt={user.username}
                    />
                  ) : (
                    <div className="user-avatar-fallback" aria-hidden="true">
                      {(user.username || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="song-info">
                  <h2 className="song-title">{user.username}</h2>
                  <p className="song-artist">{user.email}</p>
                </div>
              </Link>
            </div>
          ))}
      </div>
    </div>
  );
}

export default Buscar;
