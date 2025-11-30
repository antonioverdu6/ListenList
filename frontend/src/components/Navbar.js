import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { refreshAccessToken } from "../utils/auth";
import "../styles/navbar.css";

function Navbar() {
  const navigate = useNavigate();
  const [unreadConversations, setUnreadConversations] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timerId;

    async function fetchUnread() {
      const access = localStorage.getItem("access");
      if (!access) {
        if (!cancelled) setUnreadConversations(0);
        scheduleNext();
        return;
      }

      const url = "http://127.0.0.1:8000/api/mensajes/shares/unread_count/";
      async function requestWith(token) {
        return fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      try {
        let tokenToUse = access;
        let res = await requestWith(tokenToUse);
        if (res.status === 401) {
          try {
            tokenToUse = await refreshAccessToken();
            res = await requestWith(tokenToUse);
          } catch (err) {
            console.debug("No se pudo refrescar token para mensajes:", err);
            if (!cancelled) setUnreadConversations(0);
            return;
          }
        }

        if (!res.ok) {
          if (!cancelled) console.debug("No se pudo obtener mensajes no leídos", res.status);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setUnreadConversations(Number(data.conversations_unread || 0));
        }
      } catch (err) {
        if (!cancelled) console.debug("Error consultando mensajes no leídos", err);
      } finally {
        scheduleNext();
      }
    }

    function scheduleNext() {
      if (cancelled) return;
      timerId = setTimeout(fetchUnread, 45000);
    }

    fetchUnread();
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  const token = localStorage.getItem("access");
  const username = localStorage.getItem("username");

  const handleLogout = (e) => {
    e.preventDefault();
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("username");
    setUnreadConversations(0);
    navigate("/");
  };

  return (
    <nav>
      <Link to="/">Inicio</Link>
      <Link to="/explorar">Explorar</Link>
      <Link to="/mensajes">
        Mensajes
        {unreadConversations > 0 && (
          <span className="badge badge--alert badge--compact">{unreadConversations}</span>
        )}
      </Link>

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
