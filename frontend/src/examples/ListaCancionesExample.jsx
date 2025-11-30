// EJEMPLO: Componente que consume lista de canciones

import React, { useState, useEffect } from 'react';
import { getCanciones } from '../services/api';

function ListaCanciones() {
  const [canciones, setCanciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cargarCanciones = async () => {
      try {
        const data = await getCanciones();
        setCanciones(data);
      } catch (err) {
        setError('Error al cargar canciones');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    cargarCanciones();
  }, []);

  if (loading) return <div>Cargando...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="canciones-grid">
      {canciones.map(cancion => (
        <div key={cancion.id} className="cancion-card">
          <img src={cancion.album.imagen_url} alt={cancion.titulo} />
          <h3>{cancion.titulo}</h3>
          <p>{cancion.album.artista.nombre}</p>
        </div>
      ))}
    </div>
  );
}

export default ListaCanciones;
