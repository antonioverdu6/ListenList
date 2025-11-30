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
const API_ORIGIN = new URL(API_BASE).origin;

function normalizeAvatarUrl(rawUrl) {
  if (!rawUrl) return null;
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return null;
  if (/^https?:\/[a-z0-9]/i.test(trimmed)) {
    const fixed = trimmed.replace(/^https?:\//i, (match) => `${match}/`);
    return fixed;
  }
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    if (trimmed.startsWith("//")) {
      return `https:${trimmed}`;
    }
    return trimmed;
  }
  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${API_ORIGIN}${normalizedPath}`;
}

function normalizeProfile(profile) {
  if (!profile) return null;
  const username = profile.username ?? profile.usuario?.username ?? profile.user?.username ?? null;
  const firstName = profile.first_name ?? profile.usuario?.first_name ?? null;
  const lastName = profile.last_name ?? profile.usuario?.last_name ?? null;
  const userId = profile.userId ?? profile.id ?? profile.usuario?.id ?? null;
  const rawAvatar = profile.fotoPerfil ?? profile.avatar ?? profile.avatarUrl ?? null;
  return {
    userId,
    username,
    first_name: firstName,
    last_name: lastName,
    fotoPerfil: normalizeAvatarUrl(rawAvatar),
  };
}

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
    const normalizedPartner = {
      ...partner,
      fotoPerfil: normalizeAvatarUrl(partner.fotoPerfil),
    };
    const existing = threadsMap.get(normalizedPartner.id) || {
      partner: normalizedPartner,
      messages: [],
    };
    existing.partner = {
      ...existing.partner,
      ...normalizedPartner,
    };
    existing.messages.push(message);
    threadsMap.set(normalizedPartner.id, existing);
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

function Mensajes() {
  const location = useLocation();
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  // const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [activePartnerId, setActivePartnerId] = useState(null);
  const [composerText, setComposerText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [headerQuery, setHeaderQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [partnerProfiles, setPartnerProfiles] = useState({});
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const chatThreadRef = useRef(null);
  const [pendingRecipient, setPendingRecipient] = useState(() => extractRecipientFromSearch(location.search));
  const requestedProfilesRef = useRef(new Set());
  const meUsername = localStorage.getItem("username");

  const handleHeaderSearchSubmit = useCallback((event) => {
    event.preventDefault();
    if (!headerQuery.trim()) return;
    navigate(`/buscar?q=${encodeURIComponent(headerQuery.trim())}`);
  }, [headerQuery, navigate]);

  useEffect(() => {
    setPendingRecipient(extractRecipientFromSearch(location.search));
  }, [location.search]);

  const fetchRecipientProfile = useCallback(async (username) => {
    if (!username) return null;
    try {
      const response = await fetch(`http://127.0.0.1:8000/musica/api/usuarios/${encodeURIComponent(username)}/`);
      if (!response.ok) return null;
      const data = await response.json();
      return normalizeProfile(data);
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
    let partnerForProfile = null;
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

      const normalizedPartner = {
        ...partner,
        fotoPerfil: normalizeAvatarUrl(partner.fotoPerfil),
      };

      partnerForProfile = normalizedPartner;

      const existing = nextMap.get(partner.id) || {
        partner: normalizedPartner,
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
      existing.partner = {
        ...existing.partner,
        ...normalizedPartner,
      };
      existing.isPlaceholder = false;

      nextMap.set(partner.id, existing);
      const ordered = Array.from(nextMap.values()).sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
      return ordered;
    });

    if (partnerForProfile?.id && partnerForProfile?.fotoPerfil) {
      setPartnerProfiles((prev) => {
        const current = prev[partnerForProfile.id];
        if (current && current.fotoPerfil === partnerForProfile.fotoPerfil) {
          return prev;
        }
        return {
          ...prev,
          [partnerForProfile.id]: {
            ...(current || {}),
            userId: partnerForProfile.userId ?? partnerForProfile.id,
            username: partnerForProfile.username,
            first_name: partnerForProfile.first_name ?? current?.first_name ?? null,
            last_name: partnerForProfile.last_name ?? current?.last_name ?? null,
            fotoPerfil: partnerForProfile.fotoPerfil,
          },
        };
      });
    }
  }, [currentUserId, setPartnerProfiles]);

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
    if (!partnerProfiles || !Object.keys(partnerProfiles).length) return;
    setThreads((prev) => prev.map((thread) => {
      const partnerId = thread.partner?.id;
      if (!partnerId) return thread;
      const profile = partnerProfiles[partnerId];
      if (!profile) return thread;

      const nextAvatar = profile.fotoPerfil ?? thread.partner.fotoPerfil ?? null;
      const nextFirstName = profile.first_name ?? thread.partner.first_name;
      const nextLastName = profile.last_name ?? thread.partner.last_name;
      const nextUsername = profile.username ?? thread.partner.username;

      const avatarChanged = thread.partner.fotoPerfil !== nextAvatar;
      const firstChanged = thread.partner.first_name !== nextFirstName;
      const lastChanged = thread.partner.last_name !== nextLastName;
      const usernameChanged = thread.partner.username !== nextUsername;

      if (!avatarChanged && !firstChanged && !lastChanged && !usernameChanged) {
        return thread;
      }

      return {
        ...thread,
        partner: {
          ...thread.partner,
          fotoPerfil: nextAvatar,
          first_name: nextFirstName,
          last_name: nextLastName,
          username: nextUsername,
        },
      };
    }));
  }, [partnerProfiles]);

  useEffect(() => {
    const uniquePartners = threads
      .map((thread) => thread.partner)
      .filter((partner) => partner && partner.id && partner.username);

    if (!uniquePartners.length) return;

    const pending = uniquePartners.filter((partner) => (
      !partnerProfiles[partner.id]
      && !requestedProfilesRef.current.has(partner.id)
    ));

    if (!pending.length) return;

    pending.forEach((partner) => requestedProfilesRef.current.add(partner.id));

    let cancelled = false;

    const loadProfiles = async () => {
      const results = await Promise.all(pending.map(async (partner) => {
        try {
          const profile = await fetchRecipientProfile(partner.username);
          if (!profile || cancelled) {
            return null;
          }
          const normalized = normalizeProfile(profile);
          return [normalized.userId ?? partner.id, normalized];
        } catch (err) {
          return null;
        }
      }));

      if (cancelled) return;

      setPartnerProfiles((prev) => {
        let mutated = false;
        const next = { ...prev };
        results.forEach((entry) => {
          if (!entry) return;
          const [id, profile] = entry;
          const existing = next[id];
          if (!existing) {
            next[id] = profile;
            mutated = true;
            return;
          }
          const merged = {
            ...existing,
            ...profile,
          };
          if (
            existing.fotoPerfil !== merged.fotoPerfil
            || existing.username !== merged.username
            || existing.first_name !== merged.first_name
            || existing.last_name !== merged.last_name
          ) {
            next[id] = merged;
            mutated = true;
          }
        });
        return mutated ? next : prev;
      });

      pending.forEach((partner) => {
        requestedProfilesRef.current.delete(partner.id);
      });
    };

    loadProfiles();

    return () => {
      cancelled = true;
    };
  }, [threads, partnerProfiles, fetchRecipientProfile]);

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
          const normalizedProfile = normalizeProfile(profileData);
          const profileName = normalizedProfile.first_name || normalizedProfile.last_name
            ? `${normalizedProfile.first_name ?? ""} ${normalizedProfile.last_name ?? ""}`.trim()
            : normalizedProfile.username;
          resolved = {
            ...resolved,
            id: normalizedProfile.userId,
            name: profileName || resolved.name,
            fotoPerfil: normalizedProfile.fotoPerfil || null,
          };
          setPartnerProfiles((prev) => {
            const existing = prev[normalizedProfile.userId];
            if (
              existing
              && existing.fotoPerfil === normalizedProfile.fotoPerfil
              && existing.username === normalizedProfile.username
              && existing.first_name === normalizedProfile.first_name
              && existing.last_name === normalizedProfile.last_name
            ) {
              return prev;
            }
            return {
              ...prev,
              [normalizedProfile.userId]: {
                ...(existing || {}),
                ...normalizedProfile,
              },
            };
          });
        }
      } else if (resolved.fotoPerfil) {
        resolved.fotoPerfil = normalizeAvatarUrl(resolved.fotoPerfil);
        setPartnerProfiles((prev) => {
          const existing = prev[resolved.id];
          const nextProfile = {
            userId: resolved.id,
            username: resolved.username,
            first_name: resolved.first_name ?? existing?.first_name ?? null,
            last_name: resolved.last_name ?? existing?.last_name ?? null,
            fotoPerfil: resolved.fotoPerfil,
          };
          if (
            existing
            && existing.fotoPerfil === nextProfile.fotoPerfil
            && existing.username === nextProfile.username
            && existing.first_name === nextProfile.first_name
            && existing.last_name === nextProfile.last_name
          ) {
            return prev;
          }
          return {
            ...prev,
            [resolved.id]: {
              ...(existing || {}),
              ...nextProfile,
            },
          };
        });
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
        fotoPerfil: normalizeAvatarUrl(resolved.fotoPerfil) || null,
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
  }, [pendingRecipient, fetchRecipientProfile, setPartnerProfiles]);

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

  useEffect(() => {
    const container = chatThreadRef.current;
    if (!container) return undefined;

    const scrollToBottom = () => {
      container.scrollTop = container.scrollHeight;
    };

    const observer = new MutationObserver(scrollToBottom);
    observer.observe(container, { childList: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!activeThread) return;
    const container = chatThreadRef.current;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
  }, [activeThread, activeThread?.messages?.length]);

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
  return (
    <>
      <header className="header-bar">
        <div className="header-center">
          <button className="back-btn" onClick={() => navigate(-1)} aria-label="Volver">Volver</button>
          <form className="header-search" onSubmit={handleHeaderSearchSubmit}>
            <input
              className="header-search-input"
              type="text"
              placeholder="Buscar..."
              value={headerQuery}
              onChange={(event) => setHeaderQuery(event.target.value)}
            />
          </form>
        </div>
        <div className="header-right">
          <button className="header-bell" onClick={() => setPanelOpen(true)} aria-label="Notificaciones">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M15 17H9a3 3 0 0 1-3-3V9a6 6 0 1 1 12 0v5a3 3 0 0 1-3 3z" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {/* {unreadNotifications > 0 && <span className="header-badge">{unreadNotifications}</span>} */}
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

      <div className="mensajes-container">
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
            const cachedProfile = partnerProfiles[thread.partner.id];
            const avatarSrc = cachedProfile?.fotoPerfil
              ?? normalizeAvatarUrl(thread.partner?.fotoPerfil)
              ?? null;
            const normalizedUsername = thread.partner.username || "";
            const avatarInitial = (normalizedUsername.charAt(0) || "?").toUpperCase();
            return (
              <li
                key={thread.partner.id}
                className={`contact-item ${isActive ? "active" : ""} ${thread.hasUnread ? "unread" : ""}`}
                onClick={() => setActivePartnerId(thread.partner.id)}
              >
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={`Avatar de ${formatName(thread.partner)}`}
                    className="contact-avatar"
                    onError={(event) => {
                      event.currentTarget.src = "/default-avatar.png";
                    }}
                  />
                ) : (
                  <div className="contact-avatar contact-avatar-fallback" aria-hidden="true">
                    {avatarInitial}
                  </div>
                )}
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
                  {(() => {
                    const chatProfile = partnerProfiles[activeThread.partner.id];
                    const chatAvatarSrc = chatProfile?.fotoPerfil
                      ?? normalizeAvatarUrl(activeThread.partner?.fotoPerfil)
                      ?? null;
                    const normalizedUsername = activeThread.partner.username || "";
                    const chatInitial = (normalizedUsername.charAt(0) || "?").toUpperCase();
                    if (chatAvatarSrc) {
                      return (
                        <img
                          src={chatAvatarSrc}
                          alt={`Avatar de ${formatName(activeThread.partner)}`}
                          className="chat-avatar"
                          onError={(event) => {
                            event.currentTarget.src = "/default-avatar.png";
                          }}
                        />
                      );
                    }
                    return (
                      <div className="chat-avatar chat-avatar-fallback" aria-hidden="true">
                        {chatInitial}
                      </div>
                    );
                  })()}
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

              <section className="chat-thread" ref={chatThreadRef}>
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
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M2 3l20 9-20 9 6-9-6-9zm8.14 9l-3.11 4.67L19.11 12 7.03 7.33 10.14 12z" />
                    </svg>
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
    </>
  );
}

export default Mensajes;
