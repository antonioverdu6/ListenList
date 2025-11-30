import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import "../styles/fondoBurbujas.css";
import API_URL from "../config/api";

export default function FondoBurbujas() {
  const [artistas, setArtistas] = useState([]);

  useEffect(() => {
    async function fetchArtistas() {
      try {
        const res = await fetch(`${API_URL}/musica/api/artistas/`);
        const data = await res.json();
        const artistasConImagen = data.filter((a) => a.imagen_url);
        setArtistas(artistasConImagen.slice(0, 15));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error cargando artistas:", err);
      }
    }
    fetchArtistas();
  }, []);

  const posiciones = useMemo(
    () =>
      Array.from({ length: 15 }, () => ({
        left: `${Math.random() * 100}%`,
        width: `${60 + Math.random() * 80}px`,
        animationDuration: `${18 + Math.random() * 10}s`,
        animationDelay: `${Math.random() * 10}s`,
      })),
    []
  );

  return (
    <div className="fondo-burbujas">
      {artistas.map((a, i) => (
        <Link
          key={a.id}
          to={`/artista/${a.id}`}
          className="burbuja-link"
          title={a.nombre}
        >
          <img
            src={a.imagen_url}
            alt={a.nombre}
            className="burbuja"
            style={posiciones[i] || {}}
          />
        </Link>
      ))}
    </div>
  );
}
