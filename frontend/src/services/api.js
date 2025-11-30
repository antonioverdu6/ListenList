// src/services/api.js
import API_URL from '../config/api';

// Función auxiliar para hacer fetch con autenticación
export const fetchAPI = async (endpoint, options = {}) => {
  const token = localStorage.getItem('access_token');
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // Añadir token si existe
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);

  // Si el token expiró, intentar refrescar
  if (response.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) {
      // Reintentar la petición original
      config.headers['Authorization'] = `Bearer ${localStorage.getItem('access_token')}`;
      return fetch(`${API_URL}${endpoint}`, config);
    } else {
      // Redirigir a login si no se puede refrescar
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  return response;
};

// Refrescar token
const refreshToken = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_URL}/api/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('access_token', data.access);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

// Ejemplos de uso:

// GET canciones
export const getCanciones = async () => {
  const response = await fetchAPI('/musica/canciones/');
  if (!response.ok) throw new Error('Error al obtener canciones');
  return response.json();
};

// GET detalle canción
export const getCancion = async (spotifyId) => {
  const response = await fetchAPI(`/musica/cancion/${spotifyId}/`);
  if (!response.ok) throw new Error('Error al obtener canción');
  return response.json();
};

// POST valorar canción
export const valorarCancion = async (cancionId, puntuacion) => {
  const response = await fetchAPI(`/musica/cancion/${cancionId}/valorar/`, {
    method: 'POST',
    body: JSON.stringify({ puntuacion }),
  });
  if (!response.ok) throw new Error('Error al valorar');
  return response.json();
};

// POST login
export const login = async (username, password) => {
  const response = await fetch(`${API_URL}/api/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  
  if (!response.ok) throw new Error('Login failed');
  
  const data = await response.json();
  localStorage.setItem('access_token', data.access);
  localStorage.setItem('refresh_token', data.refresh);
  
  return data;
};

// Logout
export const logout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.href = '/login';
};
