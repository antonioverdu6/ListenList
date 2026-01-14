import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { refreshAccessToken } from "../utils/auth";
import { useAuthModal } from "../context/AuthModalContext";
import "../styles/navbar.css";
import API_URL from "../config/api";

function Navbar() {
  const navigate = useNavigate();
  const { openLogin } = useAuthModal();
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

      const url = `${API_URL}/api/mensajes/shares/unread_count/`;
      async function requestWith(token) {
        return fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      try {
        let tokenToUse = access;
        let res = await requestWith(tokenToUse);
        // Evitar ruido en consola por 401 esperado cuando el access ha caducado
        if (res.status === 401) {
          try {
            tokenToUse = await refreshAccessToken();
            res = await requestWith(tokenToUse);
          } catch (err) {
            console.debug("No se pudo refrescar token para mensajes:", err);
            if (!cancelled) setUnreadConversations(0);
            scheduleNext();
            return;
          }
        }

        if (!res.ok) {
          // Solo loguear si no es el 401 inicial (ya gestionado) o tras refresco sigue fallando
          if (!cancelled && res.status !== 401) console.debug("No se pudo obtener mensajes no leídos", res.status);
          scheduleNext();
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
        <a href="#logout" onClick={(e) => { e.preventDefault(); handleLogout(e); }} role="button" aria-label="Cerrar sesión">Cerrar sesión</a>
      ) : (
        <a href="#login" onClick={(e) => { e.preventDefault(); openLogin(); }} role="button" aria-label="Iniciar sesión">Iniciar sesión</a>
      )}
    </nav>
  );
}

export default Navbar;
