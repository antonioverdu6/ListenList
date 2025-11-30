import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { refreshAccessToken } from '../utils/auth';
import '../styles/styles_detalle.css';

export default function NotificationPanel({ open, onClose, noGreen = true }) {
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(Boolean(open));
  const [closing, setClosing] = useState(false);
  const navigate = useNavigate();
  const ANIM_MS = 220;

  const ensureToken = useCallback(async () => {
    let token = localStorage.getItem('access');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (Date.now() / 1000 > payload.exp) {
        token = await refreshAccessToken();
        return token;
      }
    } catch (err) {
      console.debug('No se pudo decodificar token en NotificationPanel:', err);
    }
    return token;
  }, []);

  // Manage visibility to allow close animation before unmount
  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      // start closing animation, then hide
      setClosing(true);
      const t = setTimeout(() => { setVisible(false); setClosing(false); }, ANIM_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, visible]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const token = await ensureToken();
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const res = await fetch('http://127.0.0.1:8000/musica/api/notificaciones/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Error fetching notifications');
        const data = await res.json();
        if (!cancelled) {
          setNotifs(data.results || []);
          setUnread(Number(data.unread || 0));
        }
      } catch (err) {
        console.error('Error cargando notificaciones:', err);
        if (!cancelled) setNotifs([]);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open, ensureToken]);

  // fetchNotifs logic is executed in the useEffect above when panel opens

  async function marcarLeida(id, enlace) {
    const token = await ensureToken();
    if (!token) return alert('Debes iniciar sesión');
    try {
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, leido: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
      await fetch(`http://127.0.0.1:8000/musica/api/notificaciones/${id}/marcar_leida/`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      });
      try { localStorage.setItem('notifications_changed', String(Date.now())); } catch(e){}
      if (enlace) onClose() || navigate(enlace);
    } catch (err) { console.error('Error marcando notificación:', err); }
  }

  async function marcarTodas() {
    const token = await ensureToken();
    if (!token) return alert('Debes iniciar sesión');
    try {
      await fetch('http://127.0.0.1:8000/musica/api/notificaciones/marcar_todas_leidas/', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      });
      setNotifs(prev => prev.map(n => ({ ...n, leido: true })));
      setUnread(0);
      try { localStorage.setItem('notifications_changed', String(Date.now())); } catch(e){}
    } catch (err) { console.error('Error marcando todas:', err); }
  }

  if (!visible) return null;

  const tipoIcon = (tipo) => {
    const t = (tipo || '').toLowerCase();
    // Return a small flat SVG (stroke-only) to keep icons discreet
    if (t.includes('seguidor') || t.includes('seguir') || t.includes('nuevo')) {
      return (
        <svg className="notif-svg" viewBox="0 0 24 24" aria-hidden>
          <path d="M15 17H9a3 3 0 0 1-3-3V9a6 6 0 1 1 12 0v5a3 3 0 0 1-3 3z" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    }
    if (t.includes('coment') || t.includes('comentario')) {
      return (
        <svg className="notif-svg" viewBox="0 0 24 24" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    }
    if (t.includes('message') || t.includes('mensaje')) {
      return (
        <svg className="notif-svg" viewBox="0 0 24 24" aria-hidden>
          <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z" />
        </svg>
      );
    }
    if (t.includes('gusta') || t.includes('like')) {
      return (
        <svg className="notif-svg" viewBox="0 0 24 24" aria-hidden>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    }
    // playlist / default headphones
    return (
      <svg className="notif-svg" viewBox="0 0 24 24" aria-hidden>
        <path d="M4 18v-6a8 8 0 0 1 16 0v6" />
        <rect x="2" y="13" width="4" height="6" rx="2" />
        <rect x="18" y="13" width="4" height="6" rx="2" />
      </svg>
    );
  };

  return (
    <div className="notif-overlay" onMouseDown={onClose}>
      <div className={`notif-popover ${open && !closing ? 'open' : ''} ${closing ? 'closing' : ''} ${noGreen ? 'no-green' : ''}`} onMouseDown={(e)=>e.stopPropagation()} role="dialog" aria-modal="false" aria-label="Panel de notificaciones">
        <header className="notif-header">
          <div className="notif-title">
            <h3>Notificaciones</h3>
            {unread > 0 && <span className="menu-badge">{unread}</span>}
          </div>
          <div className="notif-header-actions">
            <button className="btn-small ghost" onClick={marcarTodas} disabled={notifs.length===0}>Marcar todas</button>
            <button aria-label="Cerrar" className="close-x" onClick={onClose}>✕</button>
          </div>
        </header>

        <div className="notif-body">
          {loading ? <p className="muted">Cargando...</p> : (
            notifs.length === 0 ? <p className="muted">No tienes notificaciones.</p> : (
              <ul className="notif-list">
                {notifs.map(n => (
                  <li key={n.id} className={`notif-item ${n.leido ? 'read' : 'unread'}`} tabIndex={0}>
                    <div className="notif-left">
                      <div className="notif-avatar" title={n.origen_user?.username || n.origen_artista?.nombre || ''}>
                        {n.origen_user?.username ? n.origen_user.username[0].toUpperCase() : (n.origen_artista?.nombre ? n.origen_artista.nombre[0].toUpperCase() : 'L')}
                      </div>
                      {!n.leido && <span className="unread-dot" aria-hidden></span>}
                      <div className="notif-icon" aria-hidden>{tipoIcon(n.tipo)}</div>
                    </div>

                    <div className="notif-body-main">
                      <div className="notif-content-row">
                        <div style={{flex:1}}>
                          <div className="notif-source">{n.origen_user?.username || n.origen_artista?.nombre || 'Sistema'}</div>
                          <div className="notif-content">{n.contenido}</div>
                        </div>
                        <div className="notif-date muted-small">{new Date(n.fecha_creacion).toLocaleString()}</div>
                      </div>
                      <div className="notif-actions">
                        {!n.leido && <button className="btn link" onClick={() => marcarLeida(n.id, n.enlace)}>Marcar y abrir</button>}
                        {n.enlace && <button className="btn link" onClick={() => { onClose(); navigate(n.enlace); }}>Abrir</button>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </div>
    </div>
  );
}
