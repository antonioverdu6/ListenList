import React from "react";
import { Link, useNavigate } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access");
  const username = localStorage.getItem("username");

  const handleLogout = (e) => {
    e.preventDefault();
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("username");
    navigate("/");
  };

  return (
    <nav>
      <Link to="/">Inicio</Link>
      <Link to="/explorar">Explorar</Link>
      <Link to="/mensajes">Mensajes</Link>

      {token && username && <Link to={`/perfil/${username}`}>Mi perfil</Link>}

      {token ? (
        <a href="#" onClick={handleLogout} style={{ marginLeft: "2rem" }}>
          Cerrar sesión
        </a>
      ) : (
        <Link to="/login" style={{ marginLeft: "2rem" }}>
          Iniciar sesión
        </Link>
      )}
    </nav>
  );
}

export default Navbar;
