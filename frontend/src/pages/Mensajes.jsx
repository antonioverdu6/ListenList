import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import NotificationPanel from "../components/NotificationPanel";

import "../styles/mensajes.css";
import { refreshAccessToken } from "../utils/auth";

const API_BASE = "http://127.0.0.1:8000/api/mensajes";
const WS_URL = "ws://localhost:8000/ws/mensajes/";

function parseTokenPayload(token) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    return JSON.parse(atob(payload));
  } catch (err) {
    console.warn("No se pudo parsear el token", err);
    return null;
  }
}

function formatRelativeTime(isoDate) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "Ahora";
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `${diffDays} días`;
  return date.toLocaleDateString();
}

function formatName(user) {
  if (!user) return "";
  if (user.first_name || user.last_name) {
    return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  }
  return user.username || "Sin nombre";
}

function extractRecipientFromSearch(search) {
  if (!search) return null;
  const params = new URLSearchParams(search);
  const username = params.get("to");
  if (!username) return null;
  const rawId = params.get("toId");
  const parsedId = rawId ? Number(rawId) : null;
  const id = Number.isFinite(parsedId) ? parsedId : null;
  const name = params.get("toName") || null;
  return { username, id, name };
}

function buildMessageFromShare(share, currentUserId) {
  const isSender = share.sender?.id === currentUserId;
  return {
    id: share.id,
    text: share.message_text || "",
    createdAt: share.created_at,
    contentType: share.content_type,
    itemId: share.item_id,
    payload: share.payload || {},
    is_read: share.is_read,
    read_at: share.read_at,
    direction: isSender ? "outgoing" : "incoming",
    sender: share.sender,
    recipient: share.recipient,
    raw: share,
  };
}

function hydrateThreads(shares, currentUserId) {
  const threadsMap = new Map();
  shares.forEach((share) => {
    const message = buildMessageFromShare(share, currentUserId);
    const partner = message.direction === "outgoing" ? share.recipient : share.sender;
    if (!partner) return;
    const existing = threadsMap.get(partner.id) || {
      partner,
      messages: [],
    };
    existing.partner = partner;
    existing.messages.push(message);
    threadsMap.set(partner.id, existing);
  });

  const hydrated = Array.from(threadsMap.values()).map((thread) => {
    const orderedMessages = thread.messages
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const lastMessage = orderedMessages[orderedMessages.length - 1];
    const lastText = lastMessage?.text?.trim()
      || (lastMessage?.contentType ? `Compartido (${lastMessage.contentType})` : "");
    const hasUnread = orderedMessages.some(
      (msg) => msg.direction === "incoming" && !msg.is_read,
    );
    return {
      ...thread,
      messages: orderedMessages,
      lastMessageAt: lastMessage?.createdAt ?? null,
      lastMessagePreview: lastText,
      hasUnread,
      isPlaceholder: false,
    };
  });

  return sortThreadsByRecency(hydrated);
}

function sortThreadsByRecency(list) {
  return list.slice().sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
}

function mergeThreadsPreservingPlaceholders(prevThreads, nextThreads) {
  const map = new Map();

  nextThreads.forEach((thread) => {
    const partnerId = thread.partner?.id;
    if (!partnerId) return;
    map.set(partnerId, { ...thread, isPlaceholder: false });
  });

  prevThreads.forEach((thread) => {
    const partnerId = thread.partner?.id;
    if (!partnerId || !thread.isPlaceholder) return;
    if (map.has(partnerId)) return;
    map.set(partnerId, thread);
  });

  return sortThreadsByRecency(Array.from(map.values()));
}

function BackAndSearch() {
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState("");
  return (
    <>
      <button className="back-btn" onClick={() => navigate(-1)} aria-label="Volver">Volver</button>
      <form className="header-search" onSubmit={(e) => { e.preventDefault(); if (!searchQ.trim()) return; navigate(`/buscar?q=${encodeURIComponent(searchQ.trim())}`); }}>
        <input className="header-search-input" type="text" placeholder="Buscar..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
      </form>
    </>
  );
}

function Mensajes() {
  const location = useLocation();
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [activePartnerId, setActivePartnerId] = useState(null);
  const [composerText, setComposerText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const [pendingRecipient, setPendingRecipient] = useState(() => extractRecipientFromSearch(location.search));

  useEffect(() => {
    setPendingRecipient(extractRecipientFromSearch(location.search));
  }, [location.search]);

  const fetchRecipientProfile = useCallback(async (username) => {
    if (!username) return null;
    try {
      const response = await fetch(`http://127.0.0.1:8000/musica/api/usuarios/${encodeURIComponent(username)}/`);
      if (!response.ok) return null;
      const data = await response.json();
      return data;
    } catch (err) {
      console.warn("No se pudo obtener el perfil para preparar la conversación", err);
      return null;
    }
  }, []);

  const ensureAuth = useCallback(async () => {
    let token = localStorage.getItem("access");
    if (!token) throw new Error("Debes iniciar sesión");

    let payload = parseTokenPayload(token);
    const exp = payload?.exp ? payload.exp * 1000 : null;
    const isExpired = exp ? Date.now() > exp - 5000 : false;

    if (isExpired || !payload) {
      token = await refreshAccessToken();
      payload = parseTokenPayload(token);
    }

    if (!payload?.user_id) throw new Error("Token inválido");

    setCurrentUserId((prev) => (prev === payload.user_id ? prev : payload.user_id));
    return { token, userId: payload.user_id };
  }, []);

  const upsertShare = useCallback((share) => {
    setThreads((prev) => {
      const fallbackPayload = parseTokenPayload(localStorage.getItem("access") || "");
      const effectiveUserId = currentUserId || fallbackPayload?.user_id;
      if (!effectiveUserId) return prev;
      const nextMap = new Map(prev.map((thread) => [thread.partner.id, {
        ...thread,
        messages: thread.messages.slice(),
      }]));

      const message = buildMessageFromShare(share, effectiveUserId);
      const partner = message.direction === "outgoing" ? share.recipient : share.sender;
      if (!partner) return prev;

      const existing = nextMap.get(partner.id) || {
        partner,
        messages: [],
        lastMessageAt: null,
        lastMessagePreview: "",
        hasUnread: false,
        isPlaceholder: false,
      };

      const alreadyPresent = existing.messages.some((msg) => msg.id === message.id);
      if (alreadyPresent) {
        existing.messages = existing.messages.map((msg) => (
          msg.id === message.id ? { ...msg, ...message } : msg
        ));
      } else {
        existing.messages.push(message);
      }

      existing.messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const lastMsg = existing.messages[existing.messages.length - 1];
      existing.lastMessageAt = lastMsg?.createdAt ?? existing.lastMessageAt;
      const preview = lastMsg?.text?.trim()
        || (lastMsg?.contentType ? `Compartido (${lastMsg.contentType})` : existing.lastMessagePreview);
      existing.lastMessagePreview = preview;
      existing.hasUnread = existing.messages.some(
        (msg) => msg.direction === "incoming" && !msg.is_read,
      );
      existing.partner = partner;
      existing.isPlaceholder = false;

      nextMap.set(partner.id, existing);
      const ordered = Array.from(nextMap.values()).sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
      return ordered;
    });
  }, [currentUserId]);

  const upsertShareRef = useRef(upsertShare);
  useEffect(() => {
    upsertShareRef.current = upsertShare;
  }, [upsertShare]);

  const loadShares = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { token, userId } = await ensureAuth();
      const headers = { Authorization: `Bearer ${token}` };
      const [receivedRes, sentRes] = await Promise.all([
        fetch(`${API_BASE}/shares/?box=received`, { headers }),
        fetch(`${API_BASE}/shares/?box=sent`, { headers }),
      ]);

      if (!receivedRes.ok || !sentRes.ok) {
        throw new Error("No se pudo cargar el buzón de mensajes");
      }

      const [receivedData, sentData] = await Promise.all([
        receivedRes.json(),
        sentRes.json(),
      ]);

      const merged = hydrateThreads([
        ...(Array.isArray(receivedData) ? receivedData : []),
        ...(Array.isArray(sentData) ? sentData : []),
      ], userId);

      setThreads((prev) => mergeThreadsPreservingPlaceholders(prev, merged));
    } catch (err) {
      console.error(err);
      setError(err.message || "Error cargando mensajes");
    } finally {
      setLoading(false);
    }
  }, [ensureAuth]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  useEffect(() => {
    if (!threads.length) {
      if (activePartnerId !== null) {
        setActivePartnerId(null);
      }
      return;
    }

    const exists = threads.some((thread) => thread.partner.id === activePartnerId);
    if (!exists) {
      setActivePartnerId(threads[0].partner.id);
    }
  }, [threads, activePartnerId]);

  useEffect(() => {
    if (!pendingRecipient) return;

    let cancelled = false;

    const prepareThread = async () => {
      let resolved = { ...pendingRecipient };

      if (!resolved.id) {
        const profileData = await fetchRecipientProfile(resolved.username);
        if (profileData?.userId) {
          resolved = {
            ...resolved,
            id: profileData.userId,
            name: profileData.nombre || profileData.username || resolved.name,
          };
        }
      }

      if (cancelled) return;

      if (!resolved.id) {
        setError("No se pudo preparar la conversación. Inténtalo de nuevo más tarde.");
        setPendingRecipient(null);
        return;
      }

      const normalizedUsername = (resolved.username || "").toLowerCase();
      const displayName = resolved.name || resolved.username;
      const placeholderPartner = {
        id: resolved.id,
        username: resolved.username,
        first_name: displayName,
        last_name: "",
      };

      let matchedPartnerId = null;
      setThreads((prev) => {
        const existing = prev.find((thread) => {
          if (!thread.partner) return false;
          if (resolved.id && thread.partner.id === resolved.id) return true;
          const currentUsername = (thread.partner.username || "").toLowerCase();
          return currentUsername === normalizedUsername;
        });

        if (existing) {
          matchedPartnerId = existing.partner.id;
          return prev;
        }

        const placeholderThread = {
          partner: placeholderPartner,
          messages: [],
          lastMessageAt: new Date().toISOString(),
          lastMessagePreview: "Nuevo chat",
          hasUnread: false,
          isPlaceholder: true,
        };
        return [placeholderThread, ...prev];
      });

      if (matchedPartnerId) {
        setActivePartnerId(matchedPartnerId);
        setPendingRecipient(null);
        setError(null);
        return;
      }

      setActivePartnerId((prev) => prev ?? resolved.id);
      setError(null);
      setPendingRecipient(null);
    };

    prepareThread();

    return () => {
      cancelled = true;
    };
  }, [pendingRecipient, fetchRecipientProfile]);

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      try {
        const { token } = await ensureAuth();
        if (cancelled) return;

        const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload?.data) {
              upsertShareRef.current?.(payload.data);
            }
          } catch (err) {
            console.warn("Evento de websocket inválido", err);
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
          if (!cancelled) {
            reconnectRef.current = setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        if (!cancelled) {
          reconnectRef.current = setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [ensureAuth]);

  useEffect(() => {
    if (!activePartnerId) return;
    const thread = threads.find((item) => item.partner.id === activePartnerId);
    if (!thread) return;

    const unreadMessages = thread.messages.filter(
      (msg) => msg.direction === "incoming" && !msg.is_read,
    );
    if (!unreadMessages.length) return;

    (async () => {
      try {
        const { token } = await ensureAuth();
        await Promise.all(unreadMessages.map(async (msg) => {
          const response = await fetch(`${API_BASE}/shares/${msg.id}/mark_read/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const updated = await response.json();
            upsertShare(updated);
          }
        }));
      } catch (err) {
        console.warn("No se pudieron marcar mensajes como leídos", err);
      }
    })();
  }, [activePartnerId, ensureAuth, threads, upsertShare]);

  const filteredThreads = useMemo(() => {
    if (!searchTerm.trim()) return threads;
    const lower = searchTerm.trim().toLowerCase();
    return threads.filter((thread) => {
      const name = formatName(thread.partner).toLowerCase();
      const username = (thread.partner.username || "").toLowerCase();
      return name.includes(lower) || username.includes(lower);
    });
  }, [searchTerm, threads]);

  const activeThread = useMemo(
    () => threads.find((item) => item.partner.id === activePartnerId) || null,
    [activePartnerId, threads],
  );

  const handleSend = useCallback(async () => {
    const trimmed = composerText.trim();
    if (!trimmed || !activeThread) return;

    try {
      setError(null);
      const { token } = await ensureAuth();
      const recipientId = activeThread.partner.id;
      if (!recipientId) {
        setError("No se puede enviar aún: estamos identificando al destinatario. Intenta de nuevo en unos segundos.");
        return;
      }

      const payload = {
        recipient_id: recipientId,
        content_type: "other",
        item_id: "message",
        payload: {},
        message_text: trimmed,
      };

      const response = await fetch(`${API_BASE}/shares/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("No se pudo enviar el mensaje");
      }

      const data = await response.json();
      upsertShare(data);
      setComposerText("");
    } catch (err) {
      console.warn(err);
      setError(err.message || "No se pudo enviar el mensaje");
    }
  }, [activeThread, composerText, ensureAuth, upsertShare]);

  const handleComposerKeyDown = useCallback((event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const meUsername = localStorage.getItem("username");

  return (
    <div className="mensajes-container app-fullscreen">
      <header className="header-bar">
        <div className="header-center">
          <BackAndSearch />
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
        <Link to="/" className="logo">ListenList <span>beta</span></Link>
      </header>

      <div
        className={`menu-btn ${menuOpen ? "active" : ""}`}
        onClick={() => setMenuOpen(!menuOpen)}
      ></div>

      <nav className={`side-menu ${menuOpen ? "show" : ""}`}>
        <ul>
          <li><Link to="/">Inicio</Link></li>
          {meUsername && (
            <li><Link to={`/perfil/${meUsername}`}>Mi Perfil</Link></li>
          )}
          <li><Link to="#">ListenList Plus</Link></li>
          <li><Link to="#">Configuración</Link></li>
        </ul>
      </nav>

      <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
      <aside className="mensajes-sidebar">
        <div className="sidebar-header compact">
          <div className="sidebar-title">Conversaciones</div>
        </div>
        <div className="sidebar-search">
          <input
            placeholder="Buscar conversaciones"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <ul className="contact-list">
          {loading && (
            <li className="contact-item">Cargando conversaciones...</li>
          )}
          {!loading && !filteredThreads.length && (
            <li className="contact-item">No hay conversaciones todavía</li>
          )}
          {filteredThreads.map((thread) => {
            const isActive = activePartnerId === thread.partner.id;
            return (
              <li
                key={thread.partner.id}
                className={`contact-item ${isActive ? "active" : ""} ${thread.hasUnread ? "unread" : ""}`}
                onClick={() => setActivePartnerId(thread.partner.id)}
              >
                <img
                  src="/default-avatar.png"
                  alt="avatar"
                  className="contact-avatar"
                />
                <div className="contact-texts">
                  <div className="contact-row">
                    <span className="contact-name">{formatName(thread.partner)}</span>
                    <span className="contact-time">{formatRelativeTime(thread.lastMessageAt)}</span>
                  </div>
                  <div className="contact-last">{thread.lastMessagePreview || "Sin mensajes"}</div>
                </div>
                {thread.hasUnread && <span className="contact-unread" aria-label="Sin leer">●</span>}
              </li>
            );
          })}
        </ul>
      </aside>

      <main className="mensajes-main">
        {activeThread ? (
          <>
            <header className="chat-header">
              <div className="chat-peer">
                <img src="/default-avatar.png" alt="avatar" className="chat-avatar" />
                <div>
                  <div className="chat-name">{formatName(activeThread.partner)}</div>
                  <div className="chat-status">
                    Último mensaje {formatRelativeTime(activeThread.lastMessageAt) || "sin actividad"}
                  </div>
                </div>
              </div>
              <div className="chat-actions">
                <button className="chat-btn" type="button" onClick={loadShares}>Actualizar</button>
              </div>
            </header>

            {error && (
              <div className="chat-error" role="alert">{error}</div>
            )}

            <section className="chat-thread">
              {activeThread.messages.map((message) => (
                <div
                  key={message.id}
                  className={`bubble ${message.direction === "outgoing" ? "mine" : "theirs"}`}
                >
                  <div className="bubble-text">
                    {message.text || `Contenido compartido (${message.contentType})`}
                  </div>
                  <div className="bubble-time">{formatRelativeTime(message.createdAt)}</div>
                </div>
              ))}
            </section>

            <footer className="chat-composer elevated">
              <div className="composer-inner">
                <textarea
                  className="compose-input"
                  placeholder="Escribe un mensaje..."
                  value={composerText}
                  onChange={(event) => setComposerText(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  rows={1}
                />
                <button className="compose-send" type="button" onClick={handleSend} aria-label="Enviar mensaje">
                  Enviar
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="chat-empty">
            {error ? error : "Selecciona una conversación para empezar."}
          </div>
        )}
      </main>
    </div>
  );
}

export default Mensajes;
