export async function refreshAccessToken() {
  const refresh = localStorage.getItem("refresh");
  if (!refresh) throw new Error("No hay refresh token, debes iniciar sesión");

  const response = await fetch("http://127.0.0.1:8000/api/token/refresh/", {
      const API_URL = process.env.REACT_APP_API_URL?.replace(/\/$/, '') || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/api/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    throw new Error("Refresh token expirado, inicia sesión de nuevo");
  }

  const data = await response.json();
  localStorage.setItem("access", data.access);
  return data.access;
}
