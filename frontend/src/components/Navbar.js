import React from "react";
import { Link, useNavigate } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access");

  const handleLogout = (e) => {
    e.preventDefault(); // evita que el link haga reload
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    navigate("/"); // volvemos a home después de cerrar sesión
  };

  return (
    <nav>
      <Link to="/">Inicio</Link>
      <Link to="/explorar">Explorar</Link>
      {token && <Link to="/perfil">Mi perfil</Link>}

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
