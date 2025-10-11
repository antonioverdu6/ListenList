import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import "../styles/styles_artista.css";

function DetalleArtista() {
  const { id } = useParams();
  const [artista, setArtista] = useState(null);

  useEffect(() => {
    async function fetchArtista() {
      try {
        const res = await fetch(`http://127.0.0.1:8000/musica/api/artista/${id}/`);
        const data = await res.json();
        setArtista(data);
      } catch (err) {
        console.error("Error cargando artista:", err);
      }
    }
    fetchArtista();
  }, [id]);

  if (!artista) return <p style={{ color: "white" }}>Cargando...</p>;

  return (
    <div className="detalle-artista">
      <header className="header-bar">
        <div className="logo">
          ListenList <span>beta</span>
        </div>
      </header>

      <div className="artista-info">
        {artista.imagen_url ? (
          <img
            src={artista.imagen_url}
            alt={artista.nombre}
            className="artista-imagen"
          />
        ) : (
          <div className="artista-placeholder">Sin imagen</div>
        )}

        <h1>{artista.nombre}</h1>

        <p className="artista-generos">
          {artista.generos.length
            ? artista.generos.map((g) => g.nombre).join(", ")
            : "Sin género especificado"}
        </p>

        <p className="artista-valoracion">
          Valoración media:{" "}
          {artista.valoracion_media
            ? artista.valoracion_media.toFixed(1)
            : "Sin valoraciones"}
        </p>

        <Link to="/inicio" className="volver-link">
          ← Volver
        </Link>
      </div>
    </div>
  );
}

export default DetalleArtista;
