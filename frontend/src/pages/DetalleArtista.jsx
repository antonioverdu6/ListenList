import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import NotificationPanel from "../components/NotificationPanel";
import { refreshAccessToken } from "../utils/auth";
import "../styles/styles_artista.css";
import "../styles/styles_detalle.css"; // import shared detalle styles for comments layout

function DetalleArtista() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState("");

  const [artista, setArtista] = useState(null);
  const [siguiendo, setSiguiendo] = useState(false);
  const [notificacionesActivas, setNotificacionesActivas] = useState(false);
  const [comentarios, setComentarios] = useState([]);
  const [showNuevoComentario, setShowNuevoComentario] = useState(false);
  const [nuevoComentarioTexto, setNuevoComentarioTexto] = useState("");
  const [respuestaForms, setRespuestaForms] = useState({});
  const [respuestasTexto, setRespuestasTexto] = useState({});
  const [comentarioEditando, setComentarioEditando] = useState(null);
  const [textoEditando, setTextoEditando] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    async function fetchArtista() {
      try {
        const res = await fetch(`http://127.0.0.1:8000/musica/api/artista/${id}/`);
        const data = await res.json();
        setArtista(data);
  // Intentamos cargar comentarios del artista (endpoint GET)
        try {
          const resC = await fetch(`http://127.0.0.1:8000/musica/api/artistas/${id}/comentarios/`);
          if (resC.ok) {
            const d = await resC.json();
            setComentarios(d.comentarios || []);
          }
        } catch (err) {
          console.debug("No se pudieron cargar comentarios del artista:", err);
        }
        // Al obtener artista, comprobar estado de seguimiento y notificaciones
        try {
          const token = localStorage.getItem("access");
          if (token) {
            // Comprobar seguimiento (asumimos endpoint comprobador para artista)
            try {
              const resSeg = await fetch(`http://127.0.0.1:8000/musica/api/comprobar_seguimiento_artista/${data.id}/`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (resSeg.ok) {
                const dseg = await resSeg.json();
                if (typeof dseg.siguiendo !== 'undefined') setSiguiendo(Boolean(dseg.siguiendo));
              }
            } catch (err) {
              // Silenciar: endpoint puede no existir aún
              console.debug('No se pudo comprobar seguimiento artista:', err);
            }

            // Comprobar notificaciones (endpoint opcional por ahora)
            try {
              const resNot = await fetch(`http://127.0.0.1:8000/musica/api/comprobar_notificacion_artista/${data.id}/`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (resNot.ok) {
                const dnot = await resNot.json();
                if (typeof dnot.notificaciones !== 'undefined') setNotificacionesActivas(Boolean(dnot.notificaciones));
              }
            } catch (err) {
              console.debug('No se pudo comprobar notificaciones artista (es opcional):', err);
            }
          }
        } catch (err) {
          console.debug('Error comprobando estados siguiendo/notificaciones:', err);
        }
      } catch (err) {
        console.error("Error cargando artista:", err);
      }
    }
    fetchArtista();
  }, [id]);

  // Fetch unread notifications count when appropriate
  useEffect(() => {
    async function fetchUnread() {
      const token = localStorage.getItem('access');
      if (!token) return;
      try {
        const res = await fetch('http://127.0.0.1:8000/musica/api/notificaciones/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.unread !== 'undefined') setUnreadNotifications(Number(data.unread));
      } catch (err) {
        console.debug('No se pudo obtener contador de notificaciones:', err);
      }
    }

    // Fetch when component mounts and when menu opens
    if (menuOpen) fetchUnread();
    // also try once on mount
    if (!menuOpen) fetchUnread();
  }, [menuOpen]);

    

    // Return array of genero names (suitable for rendering tags)
    const getGenerosArray = (generos) => {
      if (!generos) return [];
      const lista = Array.isArray(generos) ? generos : [generos];
      const nombres = lista.map((g) => {
        if (!g) return null;
        if (typeof g === 'string') return g;
        if (typeof g === 'object') {
          if (g.nombre) return g.nombre;
          if (g.name) return g.name;
          if (g.fields && (g.fields.nombre || g.fields.name)) return g.fields.nombre || g.fields.name;
          if (Array.isArray(g) && g.length) {
            const inner = g[0];
            if (inner && (inner.nombre || inner.name)) return inner.nombre || inner.name;
          }
        }
        return null;
      }).filter(Boolean);
      return nombres;
    };

    const formatYear = (fecha) => {
      if (!fecha) return '';
      // fecha puede venir como 'YYYY-MM-DD', 'YYYY', Date object, o null
      try {
        if (typeof fecha === 'number') return String(fecha);
        if (typeof fecha === 'string') {
          // Buscar primer grupo de 4 dígitos que parezca un año
          const m = fecha.match(/(\d{4})/);
          if (m) return m[1];
          return fecha;
        }
        if (fecha instanceof Date) return String(fecha.getFullYear());
      } catch (err) {
        return '';
      }
      return '';
    };

  const toggleRespuestaForm = (comentarioId) => {
    setRespuestaForms(prev => ({ ...prev, [comentarioId]: !prev[comentarioId] }));
  };

  const handleNuevoComentario = async (e, parentId = null) => {
    e.preventDefault();

    let accessToken = localStorage.getItem("access");
    if (!accessToken) {
      alert("No hay token de acceso. Debes iniciar sesión.");
      return;
    }

    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      const ahora = Date.now() / 1000;
      if (ahora > payload.exp) {
        accessToken = await refreshAccessToken();
        if (!accessToken) {
          alert("No se pudo refrescar el token. Inicia sesión de nuevo.");
          return;
        }
      }
    } catch (err) {
      console.error("Error decodificando token:", err);
    }

    const texto = parentId ? respuestasTexto[parentId] : nuevoComentarioTexto;

    try {
      const formData = new FormData();
      formData.append("texto", texto);
      if (parentId) formData.append("parent_id", parentId);

      const response = await fetch(`http://127.0.0.1:8000/musica/api/artistas/${artista.id}/comentarios/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Error en POST comentario artista:", text);
        throw new Error(`Error al enviar comentario: HTTP ${response.status}`);
      }

      const data = await response.json();
      setComentarios(data.comentarios ?? []);

      if (parentId) {
        setRespuestasTexto(prev => ({ ...prev, [parentId]: "" }));
        setRespuestaForms(prev => ({ ...prev, [parentId]: false }));
      } else {
        setNuevoComentarioTexto("");
        setShowNuevoComentario(false);
      }
    } catch (err) {
      console.error("[handleNuevoComentario] ERROR:", err);
      alert("No se pudo enviar el comentario. Revisa la consola.");
    }
  };

  const handleBorrarComentario = async (comentarioId) => {
    let accessToken = localStorage.getItem("access");
    if (!accessToken) {
      alert("Debes iniciar sesión para borrar un comentario");
      return;
    }

    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      const ahora = Date.now() / 1000;
      if (ahora > payload.exp) {
        accessToken = await refreshAccessToken();
        if (!accessToken) return;
      }
    } catch (err) {
      console.error("Error decodificando token:", err);
    }

    try {
      const response = await fetch(`http://127.0.0.1:8000/musica/api/comentario_artista/${comentarioId}/borrar/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error("Error al borrar comentario");

      setComentarios(prev => prev.filter(c => c.id !== comentarioId));
    } catch (err) {
      console.error("Error borrando comentario:", err);
      alert("No se pudo borrar el comentario");
    }
  };

  const handleEditarComentario = async (comentarioId, nuevoTexto) => {
    let accessToken = localStorage.getItem("access");
    if (!accessToken) return alert("Debes iniciar sesión para editar.");

    try {
      const response = await fetch(`http://127.0.0.1:8000/musica/api/comentario_artista/${comentarioId}/editar/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ texto: nuevoTexto }),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error("Error editando comentario:", data);
        throw new Error("Error editando comentario");
      }

      const data = await response.json();
      setComentarios(prev => prev.map(c => (c.id === comentarioId ? { ...c, texto: data.texto } : c)));
    } catch (err) {
      console.error(err);
      alert("No se pudo editar el comentario.");
    }
  };

  if (!artista) return <p style={{ color: "white" }}>Cargando...</p>;

  const onSubmitSearch = (e) => {
    e.preventDefault();
    if (!searchQ.trim()) return;
    navigate(`/buscar?q=${encodeURIComponent(searchQ.trim())}`);
  };

  return (
    <>
      <header className="header-bar">
        <div className="header-center">
          <button className="back-btn" onClick={() => navigate(-1)} aria-label="Volver">Volver</button>
          <form className="header-search" onSubmit={onSubmitSearch}>
            <input
              className="header-search-input"
              type="text"
              placeholder="Buscar..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
          </form>
        </div>
        <div className="header-right">
          <button className="header-bell" onClick={() => setPanelOpen(true)} aria-label="Notificaciones">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M15 17H9a3 3 0 0 1-3-3V9a6 6 0 1 1 12 0v5a3 3 0 0 1-3 3z" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadNotifications > 0 && <span className="header-badge">{unreadNotifications}</span>}
          </button>
        </div>
        <div className="logo">ListenList <span>beta</span></div>
      </header>

      <div className={`menu-btn ${menuOpen ? "active" : ""}`} onClick={() => setMenuOpen(!menuOpen)}></div>

      <nav className={`side-menu ${menuOpen ? "show" : ""}`}>
        <ul>
          <li><Link to="/" className="side-menu-link">Inicio</Link></li>
          <li><Link to="/perfil" className="side-menu-link">Mi Perfil</Link></li>
          <li><Link to="#" className="side-menu-link">ListenList Plus</Link></li>
          <li><Link to="#" className="side-menu-link">Configuración</Link></li>
        </ul>
      </nav>

      <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />

      <div className="detalle-artista">

      <main className="artista-container">
          <section className="artista-hero" style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.55) 100%), url(${artista.imagen_url})` }}>
          <div className="artista-hero-inner">
            <div className="artista-meta">
              {artista.imagen_url ? (
                <img src={artista.imagen_url} alt={artista.nombre} className="artista-imagen" />
              ) : (
                <div className="artista-placeholder">Sin imagen</div>
              )}

              <div className="artista-acciones">
                <h1 className="artista-nombre">{artista.nombre}</h1>
                <div className="botones-artista">
                    {/* Botón de seguir: reutiliza la clase visual 'btn-seguir' usada en MiPerfil.jsx */}
                    <button
                      className={`btn-seguir ${siguiendo ? 'siguiendo' : ''}`}
                      onClick={async () => {
                        // Toggle follow estado para artista
                        let token = localStorage.getItem('access');
                        if (!token) return alert('Debes iniciar sesión para seguir artistas.');
                        try {
                          // refrescar token si está expirado (similar a MiPerfil)
                          try {
                            const payload = JSON.parse(atob(token.split('.')[1]));
                            if (Date.now() / 1000 > payload.exp) {
                              token = await refreshAccessToken();
                              if (!token) return alert('No se pudo refrescar el token. Inicia sesión de nuevo.');
                            }
                          } catch (e) {
                            console.debug('No se pudo decodificar token antes de toggle seguir:', e);
                          }

                          // Llamada al endpoint toggle para artistas.
                          // Asumimos endpoints REST con sufijo _artista; si tu backend usa otra ruta, actualiza aquí.
                          const res = await fetch(`http://127.0.0.1:8000/musica/api/toggle_seguir_artista/${artista.id}/`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          if (!res.ok) {
                            // intentar respuesta en formato JSON con mensaje
                            const txt = await res.text();
                            console.error('toggle_seguir_artista failed:', res.status, txt);
                            throw new Error('Error en servidor al intentar seguir/dejar de seguir');
                          }
                          const data = await res.json();
                          if (typeof data.siguiendo !== 'undefined') {
                            setSiguiendo(Boolean(data.siguiendo));
                            // Actualizar contador localmente para feedback inmediato
                            setArtista(prev => {
                              if (!prev) return prev;
                              const current = Number(prev.seguidores_count || 0);
                              const delta = data.siguiendo ? 1 : -1;
                              const next = Math.max(0, current + delta);
                              return { ...prev, seguidores_count: next };
                            });
                            // Notify other components/pages that seguimiento changed
                            try {
                              localStorage.setItem('artista_seguimiento_changed', String(Date.now()));
                            } catch (e) {
                              console.debug('No se pudo escribir localStorage:', e);
                            }
                            try {
                              window.dispatchEvent(new Event('artistaSeguido'));
                            } catch (e) {
                              /* ignore */
                            }
                          }
                        } catch (err) {
                          console.error('Error toggling follow artista:', err);
                          alert('No se pudo cambiar el estado de seguimiento. Revisa la consola.');
                        }
                      }}
                    >
                      {siguiendo ? 'Siguiendo' : 'Seguir'}
                    </button>

                    {/* Botón campanita (notificaciones) */}
                    <button
                      className={`btn-notificacion ${notificacionesActivas ? 'activo' : ''}`}
                      title={notificacionesActivas ? 'Desactivar notificaciones' : 'Recibir notificaciones'}
                      onClick={async () => {
                        // Toggle notificaciones local + POST a endpoint (puede ser ficticio)
                        let token = localStorage.getItem('access');
                        if (!token) return alert('Debes iniciar sesión para activar notificaciones.');
                        try {
                          try {
                            const payload = JSON.parse(atob(token.split('.')[1]));
                            if (Date.now() / 1000 > payload.exp) {
                              token = await refreshAccessToken();
                              if (!token) return alert('No se pudo refrescar el token. Inicia sesión de nuevo.');
                            }
                          } catch (e) {
                            console.debug('No se pudo decodificar token antes de toggle notificacion:', e);
                          }

                          // Llamada POST a endpoint de notificaciones (puede no existir aún)
                          try {
                            const res = await fetch(`http://127.0.0.1:8000/musica/api/toggle_notificacion_artista/${artista.id}/`, {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                              body: JSON.stringify({}),
                            });
                            if (res.ok) {
                              const d = await res.json();
                              if (typeof d.notificaciones !== 'undefined') {
                                setNotificacionesActivas(Boolean(d.notificaciones));
                                return;
                              }
                            }
                          } catch (err) {
                            console.debug('El endpoint toggle_notificacion_artista no respondió (ficticio):', err);
                          }

                          // Fallback: si el endpoint no existe, solo alternar localmente
                          setNotificacionesActivas(prev => !prev);
                        } catch (err) {
                          console.error('Error toggling notificaciones:', err);
                          alert('No se pudo cambiar el estado de notificaciones. Revisa la consola.');
                        }
                      }}
                    >
                      {/* Icono campana: cambia visual según estado */}
                      {notificacionesActivas ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a6 6 0 00-6 6v3.586l-1.707 1.707A1 1 0 005 15h14a1 1 0 00.707-1.707L18 11.586V8a6 6 0 00-6-6zm0 20a3 3 0 003-3H9a3 3 0 003 3z"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M15 17H9a3 3 0 006 0z"/><path d="M18 8v3.586L19.707 13.293A1 1 0 0119 15H5a1 1 0 01-.707-1.707L6 11.586V8a6 6 0 0112 0z"/></svg>
                      )}
                    </button>
                </div>
                {/* Mostrar contador de seguidores debajo de los botones */}
                <div className="followers-count">
                  {(typeof artista.seguidores_count !== 'undefined') && (
                    <small>{artista.seguidores_count} {artista.seguidores_count === 1 ? 'seguidor' : 'seguidores'}</small>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="artista-body">
            <div className="artista-column artista-left">
            <h3>Géneros</h3>
            <div className="genero-tags">
              {(() => {
                const lista = getGenerosArray(artista.generos);
                if (!lista || lista.length === 0) return <span className="sin-genero">Sin género especificado</span>;
                return lista.slice(0, 50).map(g => <span key={g} className="genero-tag">{g}</span>);
              })()}
            </div>

            <h3>Valoración</h3>
            <p className="artista-valoracion">
              {artista.valoracion_media ? Number(artista.valoracion_media).toFixed(1) : 'Sin valoraciones'}
            </p>
          </div>

          <div className="artista-column artista-right">
            <h3>Álbumes mejor valorados</h3>
            <div className="album-grid">
              {artista.albums && artista.albums.length ? (
                artista.albums.slice(0,4).map(a => (
                  <Link key={a.spotify_id || a.id} to={`/album/${a.spotify_id || a.id}`} className="album-tile">
                    {a.imagen_url ? <img src={a.imagen_url} alt={a.titulo} /> : <div className="album-placeholder">Sin imagen</div>}
                    <div className="album-info">
                      <strong>{a.titulo}</strong>
                      <small>{formatYear(a.fecha_lanzamiento)}</small>
                      <div style={{ fontSize: 12, color: '#bbb' }}>Valoración: {(a.valoracion_media || 0).toFixed ? (Number(a.valoracion_media).toFixed(1)) : (a.valoracion_media)}</div>
                    </div>
                  </Link>
                ))
              ) : (
                <p>No hay álbumes disponibles.</p>
              )}
            </div>

            <h3 style={{ marginTop: '1.4rem' }}>Canciones mejor valoradas</h3>
            <ol className="top-tracks">
              {artista.top_tracks && artista.top_tracks.length ? (
                artista.top_tracks.slice(0,5).map(t => (
                  <li key={t.spotify_id || t.id}>
                    {t.imagen_url ? (
                      <img src={t.imagen_url} alt={t.titulo} className="track-thumb" />
                    ) : (
                      <div className="track-thumb" />
                    )}

                    <div className="track-meta">
                      <div className="track-title"><Link className="track-link" to={`/cancion/${t.spotify_id || t.id}`}>{t.titulo}</Link></div>
                      <div className="track-sub">Álbum: <Link className="track-album-link" to={`/album/${t.album}`}>{t.album_titulo || '—'}</Link></div>
                    </div>

                    <div className="track-rating">{(t.valoracion_media || 0).toFixed ? Number(t.valoracion_media).toFixed(1) : t.valoracion_media}</div>
                  </li>
                ))
              ) : (
                <p>No hay canciones destacadas.</p>
              )}
            </ol>
          </div>
        </section>

        <div className="comentarios-section">
          <h3>Comentarios <span className="comentario-sticker">({comentarios.length})</span></h3>

          <button onClick={() => setShowNuevoComentario((p) => !p)} className="btn-nuevo-comentario">Comentar...</button>

          {showNuevoComentario && (
            <form className="form-nuevo-comentario" onSubmit={(e) => handleNuevoComentario(e, null)}>
              <textarea name="texto" placeholder="Escribe tu comentario..." value={nuevoComentarioTexto} onChange={(e) => setNuevoComentarioTexto(e.target.value)} required />
              <button type="submit">Publicar</button>
            </form>
          )}

          {comentarios.length > 0 ? (
            comentarios.map((comentario) => (
              <article className="comentario" key={comentario.id}>
                <p><strong>{comentario.autor}</strong> dijo:</p>
                {comentarioEditando === comentario.id ? (
                  <div>
                    <textarea value={textoEditando} onChange={(e) => setTextoEditando(e.target.value)} />
                    <p> </p>
                    <span className="icono-editar" title="Guardar" onClick={async () => { await handleEditarComentario(comentario.id, textoEditando); setComentarioEditando(null); }}>
                      ✔
                    </span>
                    <span className="icono-borrar" onClick={() => setComentarioEditando(null)}>✖</span>
                  </div>
                ) : (
                  <p>{comentario.texto}</p>
                )}

                <div className="comentario-botones">
                  <button className="responder" onClick={() => toggleRespuestaForm(comentario.id)}>Responder</button>
                  <span className="icono-editar" title="Editar" onClick={() => { setComentarioEditando(comentario.id); setTextoEditando(comentario.texto); }}>✎</span>
                  <span className="icono-borrar" onClick={() => handleBorrarComentario(comentario.id)}>🗑</span>
                </div>

                {respuestaForms[comentario.id] && (
                  <form className="form-respuesta" onSubmit={(e) => handleNuevoComentario(e, comentario.id)}>
                    <textarea name="texto" placeholder="Escribe tu respuesta..." value={respuestasTexto[comentario.id] || ''} onChange={(e) => setRespuestasTexto({...respuestasTexto, [comentario.id]: e.target.value})} required />
                    <button type="submit">Publicar</button>
                  </form>
                )}

                <div className="respuestas">
                  {comentario.respuestas && comentario.respuestas.map(r => (
                    <article className="respuesta" key={r.id}><p><strong>{r.autor}</strong> respondió:</p><p>{r.texto}</p></article>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <p>No hay comentarios aún.</p>
          )}
        </div>

        <div style={{ textAlign: 'center', margin: '2rem 0' }}>
          <Link to="/" className="volver-link">← Volver al inicio</Link>
        </div>
      </main>
    </div>
    </>
  );
}

export default DetalleArtista;
