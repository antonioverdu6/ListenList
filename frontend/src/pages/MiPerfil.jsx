import API_URL from '../config/api';
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import "../styles/miperfil.css";
import Footer from "../components/Footer";
import NotificationPanel from "../components/NotificationPanel";
import UserListPopover from "../components/UserListPopover";
import { refreshAccessToken } from "../utils/auth";
import { useAuthModal } from "../context/AuthModalContext";

// URLs reales usadas por el buscador (canciones, álbumes, artistas)
const API_URL_SONGS = `${API_URL}/musica/buscar_api/`;
const API_URL_ALBUMS = `${API_URL}/musica/api/albums_buscar/`;
const API_URL_ARTISTS = `${API_URL}/musica/api/artistas_buscar/`;

// Centralized endpoint map so components can reuse it (stable reference)
const endpointMap = {
  songs: (qq) => `${API_URL_SONGS}?q=${encodeURIComponent(qq)}`,
  albums: (qq) => `${API_URL_ALBUMS}?q=${encodeURIComponent(qq)}`,
  artists: (qq) => `${API_URL_ARTISTS}?q=${encodeURIComponent(qq)}`,
};

// Small reusable back+search component used in headers
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

function MiPerfil() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { openLogin } = useAuthModal();
  const meUsername = localStorage.getItem('username');
  const isOwnProfile = meUsername === username;

  // Estados
  const [usuario, setUsuario] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [editando, setEditando] = useState(false);
  const [formData, setFormData] = useState({
    banner: "",
    biografia: "",
  });
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const avatarPreviewUrlRef = useRef(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [bannerFile, setBannerFile] = useState(null);
  const bannerPreviewUrlRef = useRef(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [comentarios, setComentarios] = useState([]);
  const [artistasSeguidos, setArtistasSeguidos] = useState([]);
  const [valoraciones, setValoraciones] = useState([]);
  const [siguiendo, setSiguiendo] = useState(false);
  const [contador, setContador] = useState({ seguidores: 0, siguiendo: 0 });
  const [loading, setLoading] = useState(true);
  const [isOpenFollowers, setIsOpenFollowers] = useState(false);
  const [isOpenFollowing, setIsOpenFollowing] = useState(false);
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  // Your Picks state (3 slots)
  const [pickedItems, setPickedItems] = useState([null, null, null]);
  const initialHydratedRef = useRef(false);
  const lastSavedRef = useRef([null, null, null]);
  const [openPopoverIndex, setOpenPopoverIndex] = useState(null);
  const [openActionMenuIndex, setOpenActionMenuIndex] = useState(null);
  // Removed hoverActionIndex (unused)
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('songs');
  const [musicData, setMusicData] = useState([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const popoverRef = useRef(null);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrlRef.current) {
        URL.revokeObjectURL(avatarPreviewUrlRef.current);
        avatarPreviewUrlRef.current = null;
      }
      if (bannerPreviewUrlRef.current) {
        URL.revokeObjectURL(bannerPreviewUrlRef.current);
        bannerPreviewUrlRef.current = null;
      }
    };
  }, []);
  const savePicks = useCallback(async (nextPicks) => {
    try {
      let token = localStorage.getItem('access');
      if (!token) return;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (Date.now()/1000 > payload.exp) token = await refreshAccessToken();
      } catch {}
      const payloadPicks = nextPicks.map(it => it ? ({ id: it.id, type: it.type, name: it.name, artist: it.artist || null, imageUrl: it.imageUrl || null }) : null);
      const res = await fetch(`${API_URL}/musica/api/picks/${username}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ picks: payloadPicks })
      });
      console.log('Save picks status:', res.status);
      if (res.ok) {
        // Fetch-after-save or use returned body to rehydrate UI consistently
        try {
          const body = await res.json();
          if (body && Array.isArray(body.picks)) {
            const serverNorm = [null, null, null];
            const picks = body.picks.slice(0,3);
            for (let i=0;i<3;i++) {
              const it = picks[i];
              serverNorm[i] = it ? { id: it.id, type: it.type, name: it.name, artist: it.artist || null, imageUrl: it.imageUrl || null } : null;
            }
            setPickedItems(serverNorm);
            lastSavedRef.current = serverNorm;
            return;
          }
        } catch {}
        // If body wasn't JSON (or no picks), trigger a GET as fallback
        try {
          const rp = await fetch(`${API_URL}/musica/api/picks/${username}/`, { headers: { Authorization: `Bearer ${token}` } });
          if (rp.ok) {
            const pd = await rp.json();
            const picks = Array.isArray(pd.picks) ? pd.picks.slice(0,3) : [null,null,null];
            const norm = [null, null, null];
            for (let i=0;i<3;i++) {
              const it = picks[i];
              norm[i] = it ? { id: it.id, type: it.type, name: it.name, artist: it.artist || null, imageUrl: it.imageUrl || null } : null;
            }
            setPickedItems(norm);
            lastSavedRef.current = norm;
          }
        } catch {}
      }
    } catch (e) {
      console.warn('Error guardando picks:', e);
    }
  }, [username]);

  // Persist picks to backend when viewing own profile and picks change
  // Ensure this hook is declared before any render returns
  useEffect(() => {
    const isOwn = localStorage.getItem('username') === username;
    if (!isOwn) return;
    // Avoid saving immediately after hydration to prevent overwriting with nulls
    if (!initialHydratedRef.current) return;
    // Dedupe: if nothing changed compared to last saved, skip
    const curr = JSON.stringify(pickedItems);
    const last = JSON.stringify(lastSavedRef.current);
    if (curr === last) return;
    savePicks(pickedItems);
    lastSavedRef.current = pickedItems;
  }, [pickedItems, username, savePicks]);
  

  // Cargar perfil del usuario
  useEffect(() => {
    async function fetchPerfil() {
      try {
        const res = await fetch(`${API_URL}/musica/api/usuarios/${username}/`);
        if (!res.ok) throw new Error("No se pudo cargar el perfil");
        const data = await res.json();
        setUsuario(data);
        setFormData({
          banner: data.banner || "",
          biografia: data.biografia || "",
        });
        setBannerPreview(data.banner || "");
        if (avatarPreviewUrlRef.current) {
          URL.revokeObjectURL(avatarPreviewUrlRef.current);
          avatarPreviewUrlRef.current = null;
        }
        setAvatarFile(null);
        setAvatarRemoved(false);
        setAvatarPreview(data.fotoPerfil || data.foto_perfil || "");
        setComentarios(data.comentarios || []);
        setValoraciones(data.valoraciones || []);
        // Load picks via dedicated picks endpoint with token refresh
        try {
          let token = localStorage.getItem('access');
          if (token) {
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              if (Date.now()/1000 > payload.exp) token = await refreshAccessToken();
            } catch {}
          }
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const rp = await fetch(`${API_URL}/musica/api/picks/${username}/`, { headers });
          if (rp.status === 401 || rp.status === 403) {
            // Do not overwrite local state on auth failure; just skip
            console.debug('GET picks no autorizado; manteniendo estado local.');
          } else if (rp.ok) {
            const pd = await rp.json();
            const picks = Array.isArray(pd.picks) ? pd.picks.slice(0,3) : [null,null,null];
            const norm = [null, null, null];
            for (let i=0;i<3;i++) {
              const it = picks[i];
              norm[i] = it ? { id: it.id, type: it.type, name: it.name, artist: it.artist || null, imageUrl: it.imageUrl || null } : null;
            }
            setPickedItems(norm);
            // Mark hydration complete and set lastSaved snapshot
            initialHydratedRef.current = true;
            lastSavedRef.current = norm;
          } else {
            // Non-OK other than auth; do not force nulls immediately
            initialHydratedRef.current = true;
          }
        } catch (e) {
          console.debug('No se pudieron cargar picks:', e);
          // Network error: mark hydration to allow manual saves later
          initialHydratedRef.current = true;
        }
      } catch (error) {
        console.error("Error al cargar el perfil:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchPerfil();
  }, [username]);

  // Ensure token is valid (refresh if expired) and return token + username from payload
  const ensureToken = useCallback(async () => {
    let token = localStorage.getItem('access');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (Date.now() / 1000 > payload.exp) {
        token = await refreshAccessToken();
      }
      return { token, username: payload.username || localStorage.getItem('username') };
    } catch (err) {
      try {
        token = await refreshAccessToken();
        const payload = JSON.parse(atob(token.split('.')[1]));
        return { token, username: payload.username || localStorage.getItem('username') };
      } catch (e) {
        return null;
      }
    }
  }, []);

  // Cargar estado de seguimiento y contadores
  const fetchSeguimiento = useCallback(async () => {
    try {
      const tokenInfo = await ensureToken();
      const token = tokenInfo ? tokenInfo.token : null;
      const currentUser = tokenInfo ? tokenInfo.username : localStorage.getItem('username');

      // Contadores
      const resCont = await fetch(`${API_URL}/musica/api/seguidores_y_siguiendo/${username}/`);
      if (resCont.ok) {
        const dataCont = await resCont.json();
        setContador(dataCont);
      }

      // Estado de seguimiento
      if (token && currentUser && currentUser !== username) {
        const resSeg = await fetch(`${API_URL}/musica/api/comprobar_seguimiento/${username}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resSeg.ok) {
          const dataSeg = await resSeg.json();
          setSiguiendo(Boolean(dataSeg.siguiendo));
        } else if (resSeg.status === 401) {
          setSiguiendo(false);
        }
      } else {
        if (currentUser === username) setSiguiendo(false);
      }
    } catch (err) {
      console.error("Error obteniendo seguimiento:", err);
    }
  }, [ensureToken, username]);

  useEffect(() => {
    fetchSeguimiento();
  }, [fetchSeguimiento]);

  // Cargar artistas seguidos (carrusel)
  useEffect(() => {
    let mounted = true;
    const fetchSeguidos = async () => {
      try {
        const res = await fetch(`${API_URL}/musica/api/artistas_seguidos/${username}/`);
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setArtistasSeguidos(data || []);
      } catch (err) {
        console.error('Error cargando artistas seguidos:', err);
      }
    };

    fetchSeguidos();

    // Listen for changes triggered elsewhere (DetalleArtista)
    const handler = () => fetchSeguidos();
    window.addEventListener('artistaSeguido', handler);
    const storageHandler = (e) => {
      if (e.key === 'artista_seguimiento_changed') fetchSeguidos();
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      mounted = false;
      window.removeEventListener('artistaSeguido', handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, [username]);

  // Poll unread notifications count for menu badge
  useEffect(() => {
    async function fetchUnread() {
      const token = localStorage.getItem('access');
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/musica/api/notificaciones/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.unread !== 'undefined') setUnreadNotifications(Number(data.unread));
      } catch (err) {
        console.debug('No se pudo obtener contador de notificaciones (perfil):', err);
      }
    }
    if (menuOpen) fetchUnread();
    // try once on mount
    fetchUnread();
  }, [menuOpen]);

  // Inicializa la posición del carrusel en la sección central (3x contenido para loop)
  useEffect(() => {
    const el = carruselRef.current;
    if (!el || !artistasSeguidos || artistasSeguidos.length === 0) return;
    const t = setTimeout(() => {
      el.scrollLeft = el.scrollWidth / 3;
    }, 0);
    return () => clearTimeout(t);
  }, [artistasSeguidos]);

  

  const carruselRef = useRef(null);
  const carruselSnapTimerRef = useRef(null);
  const getCardStep = useCallback(() => {
    const el = carruselRef.current;
    if (!el) return 160;
    const children = el.children;
    if (children && children.length >= 2) {
      return Math.max(1, children[1].offsetLeft - children[0].offsetLeft);
    }
    if (children && children.length === 1) return children[0].offsetWidth + 10;
    return 160;
  }, []);
  const normalizeCarouselPosition = useCallback(() => {
    const el = carruselRef.current;
    if (!el) return;
    const segment = el.scrollWidth / 3;
    const left = el.scrollLeft;
    const step = getCardStep();
    const threshold = Math.max(8, step * 0.9);
    if (left < threshold) {
      el.scrollLeft = left + segment;
    } else if (left > (segment * 2) - threshold) {
      el.scrollLeft = left - segment;
    }
  }, [getCardStep]);
  const scrollIzquierda = () => {
    const el = carruselRef.current;
    if (!el) return;
    const step = getCardStep();
    el.scrollBy({ left: -step, behavior: 'smooth' });
    if (carruselSnapTimerRef.current) clearTimeout(carruselSnapTimerRef.current);
    carruselSnapTimerRef.current = setTimeout(normalizeCarouselPosition, 260);
  };
  const scrollDerecha = () => {
    const el = carruselRef.current;
    if (!el) return;
    const step = getCardStep();
    el.scrollBy({ left: step, behavior: 'smooth' });
    if (carruselSnapTimerRef.current) clearTimeout(carruselSnapTimerRef.current);
    carruselSnapTimerRef.current = setTimeout(normalizeCarouselPosition, 260);
  };

  // Ajusta al volar si el usuario llega a los extremos (zootropo infinito)
  useEffect(() => {
    const el = carruselRef.current;
    if (!el || !artistasSeguidos || artistasSeguidos.length === 0) return;
    const onScroll = () => normalizeCarouselPosition();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [artistasSeguidos, normalizeCarouselPosition]);

  // Función para seguir/dejar de seguir
  const handleToggleFollow = async () => {
    const tokenInfo = await ensureToken();
    if (!tokenInfo) {
      openLogin();
      return;
    }
    const currentUser = tokenInfo.username || localStorage.getItem('username');
    if (currentUser === username) return;

    try {
      const res = await fetch(`${API_URL}/musica/api/toggle_seguir/${username}/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenInfo.token}` },
      });
      if (!res.ok) {
        console.error('toggle follow failed', res.status);
        return;
      }
      const data = await res.json();
      setSiguiendo(Boolean(data.siguiendo));
      // Refresh counters from server to avoid local-delta errors
      await fetchSeguimiento();
    } catch (err) {
      console.error('Error al seguir/dejar de seguir:', err);
    }
  };

  const handleAvatarSelect = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Por favor selecciona una imagen válida.");
      return;
    }
    if (avatarPreviewUrlRef.current) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current);
      avatarPreviewUrlRef.current = null;
    }
    const objectUrl = URL.createObjectURL(file);
    avatarPreviewUrlRef.current = objectUrl;
    setAvatarPreview(objectUrl);
    setAvatarFile(file);
    setAvatarRemoved(false);
    event.target.value = "";
  };

  const handleBannerSelect = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Por favor selecciona una imagen válida.");
      return;
    }
    if (bannerPreviewUrlRef.current) {
      URL.revokeObjectURL(bannerPreviewUrlRef.current);
      bannerPreviewUrlRef.current = null;
    }
    const objectUrl = URL.createObjectURL(file);
    bannerPreviewUrlRef.current = objectUrl;
    setBannerPreview(objectUrl);
    setBannerFile(file);
    event.target.value = "";
  };

  const handleRemoveAvatar = () => {
    if (avatarPreviewUrlRef.current) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current);
      avatarPreviewUrlRef.current = null;
    }
    setAvatarPreview("");
    setAvatarFile(null);
    setAvatarRemoved(true);
  };

  const handleCancelarEdicion = () => {
    if (avatarPreviewUrlRef.current) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current);
      avatarPreviewUrlRef.current = null;
    }
    if (bannerPreviewUrlRef.current) {
      URL.revokeObjectURL(bannerPreviewUrlRef.current);
      bannerPreviewUrlRef.current = null;
    }
    setAvatarPreview(usuario.fotoPerfil || usuario.foto_perfil || "");
    setAvatarFile(null);
    setAvatarRemoved(false);
    setBannerPreview(usuario.banner || "");
    setBannerFile(null);
    setFormData({
      banner: usuario.banner || "",
      biografia: usuario.biografia || "",
    });
    setEditando(false);
  };

  const handleIniciarEdicion = () => {
    if (avatarPreviewUrlRef.current) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current);
      avatarPreviewUrlRef.current = null;
    }
    if (bannerPreviewUrlRef.current) {
      URL.revokeObjectURL(bannerPreviewUrlRef.current);
      bannerPreviewUrlRef.current = null;
    }
    setFormData({
      banner: usuario.banner || "",
      biografia: usuario.biografia || "",
    });
    setAvatarPreview(usuario.fotoPerfil || usuario.foto_perfil || "");
    setAvatarFile(null);
    setAvatarRemoved(false);
    setBannerPreview(usuario.banner || "");
    setBannerFile(null);
    setEditando(true);
  };

  // Guardar cambios en perfil
  const handleGuardar = async () => {
    try {
      let token = localStorage.getItem("access");
      if (!token) {
        openLogin();
        return;
      }

      // Refrescar token si expiró
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (Date.now() / 1000 > payload.exp) {
          token = await refreshAccessToken();
        }
      } catch (e) {
        console.error("Error verificando token:", e);
      }

      const payload = new FormData();
      // if (typeof formData.banner === "string") {
      //   payload.append("banner", formData.banner);
      // }
      if (typeof formData.biografia === "string") {
        payload.append("biografia", formData.biografia);
      }
      if (avatarFile) {
        payload.append("fotoPerfil", avatarFile);
      } else if (avatarRemoved) {
        payload.append("remove_avatar", "1");
      }
      if (bannerFile) {
        payload.append("banner", bannerFile);
      }

      const response = await fetch(`${API_URL}/musica/api/usuarios/${username}/`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: payload,
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("Error guardando perfil:", data);
        throw new Error("Error al guardar perfil");
      }

      setUsuario(data);
      setFormData({
        banner: data.banner || "",
        biografia: data.biografia || "",
      });
      if (avatarPreviewUrlRef.current) {
        URL.revokeObjectURL(avatarPreviewUrlRef.current);
        avatarPreviewUrlRef.current = null;
      }
      if (bannerPreviewUrlRef.current) {
        URL.revokeObjectURL(bannerPreviewUrlRef.current);
        bannerPreviewUrlRef.current = null;
      }
      setAvatarFile(null);
      setAvatarRemoved(false);
      setAvatarPreview(data.fotoPerfil || data.foto_perfil || "");
      setBannerFile(null);
      setBannerPreview(data.banner || "");
      setEditando(false);
    } catch (err) {
      console.error("Error guardando perfil:", err);
    }
  };

  // Ordenar valoraciones
  const ordenAsc = [...valoraciones].sort((a, b) => a.nota - b.nota);
  // Últimas valoraciones (más recientes primero). Si no hay fecha, usar orden de llegada (reverso)
  const hasAnyFecha = valoraciones.some(v => v && (v.fecha || v.created_at || v.createdAt || v.fecha_creacion));
  const ordenRecientes = hasAnyFecha
    ? [...valoraciones].sort((a, b) => {
        const ta = new Date(a && (a.fecha || a.created_at || a.createdAt || a.fecha_creacion || 0)).getTime();
        const tb = new Date(b && (b.fecha || b.created_at || b.createdAt || b.fecha_creacion || 0)).getTime();
        if (isNaN(ta) && isNaN(tb)) return 0;
        if (isNaN(ta)) return 1;
        if (isNaN(tb)) return -1;
        return tb - ta; // más nuevo primero
      })
    : [...valoraciones].reverse();

  // close popover on ESC or outside click (hooks must be called unconditionally)
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setOpenPopoverIndex(null); }
    function onClick(e) { if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpenPopoverIndex(null); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, []);

  // Note: removed local mock arrays. Search will query the backend API directly.

  // Fetch music items from Django search endpoints when the popover opens and there's a query
  useEffect(() => {
    if (openPopoverIndex === null) return;
    const q = (searchTerm || '').trim();
    // If there's no query, use a minimal default query to surface some results
    // (the backend `buscar_api` returns [] for empty q)
    const qToUse = q || 'a';

    let mounted = true;
    const controller = new AbortController();

    // Use the centralized endpointMap defined above
    const url = (endpointMap[activeFilter] || endpointMap.songs)(qToUse);

    async function fetchMusic() {
      setMusicLoading(true);
      setMusicError(null);
      try {
        const res = await fetch(url, { method: 'GET', signal: controller.signal, credentials: 'include', headers: { Accept: 'application/json' } });
        console.log('Fetching from', url, res.status);
        if (res.status === 404) {
          const msg = 'Endpoint no encontrado (404). Revisa que MI_RUTA_CORRECTA exista en urls.py';
          setMusicError(msg);
          throw new Error(msg);
        }
        if ([301, 302, 401, 403].includes(res.status)) {
          const msg = `Error ${res.status}: Revisa que la ruta de la API de Django sea la correcta y devuelva JSON`;
          setMusicError(msg);
          throw new Error(msg);
        }
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const msg = 'La API no está devolviendo JSON, está devolviendo HTML u otro tipo';
          setMusicError(msg);
          throw new Error(msg);
        }
        const data = await res.json();
        console.log('Sample data', data);
        if (!mounted) return;
        const rawItems = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
        // Normalize into a unified shape used by the picker
        const normItems = rawItems.map((it) => {
          if (!it) return null;
          if (activeFilter === 'songs') {
            // buscar_api returns song dicts from spotify_client
            return {
              id: it.spotify_id || it.id || it.spotifyId,
              type: 'song',
              name: it.nombre || it.name || it.titulo,
              artist: it.artista || (it.album && it.album.artista) || it.artist || (it.album && it.album.artista && it.album.artista.nombre),
              imageUrl: it.imagen || it.imagen_url || it.image_url || it.imageUrl ||
                        (it.album && (it.album.imagen_url || it.album.image_url || it.album.imageUrl)) ||
                        (Array.isArray(it.images) && it.images[0] && it.images[0].url) ||
                        (it.album && Array.isArray(it.album.images) && it.album.images[0] && it.album.images[0].url) || null,
            };
          } else if (activeFilter === 'albums') {
            // api/albums_buscar returns albums with artista
            return {
              id: it.spotify_id || it.id,
              type: 'album',
              name: it.titulo || it.nombre || it.name,
              artist: (it.artista && (it.artista.nombre || it.artista.name)) || it.artist,
              imageUrl: it.imagen_url || it.image_url || it.imageUrl ||
                        (Array.isArray(it.images) && it.images[0] && it.images[0].url) || null,
            };
          } else if (activeFilter === 'artists') {
            // api/artistas_buscar returns basic artist info
            return {
              id: it.id,
              type: 'artist',
              name: it.nombre || it.name,
              artist: null,
              imageUrl: it.imagen_url || it.image_url || it.imageUrl ||
                        (Array.isArray(it.images) && it.images[0] && it.images[0].url) || null,
            };
          }
          return null;
        }).filter(Boolean);
        setMusicData(normItems);
        console.log('Fetched data (normalized):', normItems);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error fetching music items:', err);
          setMusicError(err.message || 'Error cargando música');
        }
        setMusicData([]);
      } finally {
        if (mounted) setMusicLoading(false);
      }
    }

    fetchMusic();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [openPopoverIndex, searchTerm, activeFilter]);

  // reset to first page when search term or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilter]);

  // Debug logs for popover and search term (hooks must run unconditionally)
  useEffect(() => {
    console.log('Popover open state changed:', openPopoverIndex);
  }, [openPopoverIndex]);

  useEffect(() => {
    console.log('Search term changed:', searchTerm);
  }, [searchTerm]);

  // Animation state for action menu open (hooks must be before any early return)
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  useEffect(() => {
    if (openActionMenuIndex !== null) {
      setActionMenuVisible(false);
      const t = setTimeout(() => setActionMenuVisible(true), 0);
      return () => clearTimeout(t);
    } else {
      setActionMenuVisible(false);
    }
  }, [openActionMenuIndex]);

  // Comentarios: paginación por lotes de 5 (arranca en la página 1)
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsPageAnimDir, setCommentsPageAnimDir] = useState(1); // 1: next/right, -1: prev/left
  useEffect(() => {
    // Reinicia a la primera página cuando cambia el origen de comentarios
    setCommentsPage(1);
  }, [comentarios]);

  const banner = usuario.banner || "/default-banner.jpg";
  const normalizedUsername = usuario.username || username || "";
  const avatarInitial = (normalizedUsername.charAt(0) || "?").toUpperCase();
  const rawAvatar = avatarPreview || usuario.fotoPerfil || usuario.foto_perfil || "";
  const shouldShowAvatarFallback = avatarRemoved || !rawAvatar;
  const fotoPerfil = shouldShowAvatarFallback ? "" : rawAvatar;
  const nombre = usuario.nombre;
  const perfilUserId = usuario.userId;

  const handleMessageUser = useCallback(() => {
    if (!perfilUserId) return;
    const params = new URLSearchParams();
    params.set("to", username);
    params.set("toId", String(perfilUserId));
    const displayName = nombre || username;
    if (displayName) params.set("toName", displayName);
    navigate(`/mensajes?${params.toString()}`);
  }, [navigate, nombre, perfilUserId, username]);

  if (loading) return <p style={{ color: "white", textAlign: "center" }}>Cargando perfil...</p>;

  // Followers / following lists will be fetched on demand from the backend endpoints
  // Endpoint: GET /musica/api/seguidores/<username>/ and /musica/api/siguiendo/<username>/
  // The server returns [{ id, username, fotoPerfil, isFollowing }, ...]

  const fetchFollowers = async () => {
    try {
      const tokenInfo = await ensureToken();
      const headers = tokenInfo ? { Authorization: `Bearer ${tokenInfo.token}` } : {};
      const res = await fetch(`${API_URL}/musica/api/seguidores/${username}/`, { headers });
      if (!res.ok) throw new Error('Error fetching followers');
      const data = await res.json();
      setFollowersList(data || []);
    } catch (err) {
      console.error('Error cargando seguidores:', err);
      setFollowersList([]);
    }
  };

  const fetchFollowing = async () => {
    try {
      const tokenInfo = await ensureToken();
      const headers = tokenInfo ? { Authorization: `Bearer ${tokenInfo.token}` } : {};
      const res = await fetch(`${API_URL}/musica/api/siguiendo/${username}/`, { headers });
      if (!res.ok) throw new Error('Error fetching following');
      const data = await res.json();
      setFollowingList(data || []);
    } catch (err) {
      console.error('Error cargando siguiendo:', err);
      setFollowingList([]);
    }
  }; 

  // Toggle follow/unfollow for a given target username (called from the popover)
  const handleToggleFollowUser = async (targetUsername) => {
    const tokenInfo = await ensureToken();
    if (!tokenInfo) {
      openLogin();
      return;
    }
    try {
      const res = await fetch(`${API_URL}/musica/api/toggle_seguir/${targetUsername}/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenInfo.token}` },
      });
      if (!res.ok) {
        console.error('toggle follow failed', res.status);
        return;
      }
      const data = await res.json();

      // Update local lists: set isFollowing for the affected user
      setFollowersList(prev => prev.map(u => (u.username === targetUsername ? { ...u, isFollowing: !!data.siguiendo } : u)));
      setFollowingList(prev => prev.map(u => (u.username === targetUsername ? { ...u, isFollowing: !!data.siguiendo } : u)));

      // If we are viewing our own profile page, update the 'siguiendo' counter
      if (tokenInfo.username === username) {
        // Re-fetch counters instead of local delta
        await fetchSeguimiento();
      }
      // Refresh lists and counters from server to ensure consistency
      await fetchFollowers();
      await fetchFollowing();
      await fetchSeguimiento();
    } catch (err) {
      console.error('Error toggling follow:', err);
    }
  };

  


  const openPopover = (index) => {
    if (!isOwnProfile) return;
    setOpenActionMenuIndex(null);
    setOpenPopoverIndex(index);
    setActiveFilter('songs');
    setSearchTerm('');
  };
  const toggleActionMenu = (index) => {
    if (!isOwnProfile) return;
    setOpenActionMenuIndex(prev => (prev === index ? null : index));
  };
  const navigateToItem = (it) => {
    if (!it) return;
    const href = it.type === 'song' ? `/cancion/${it.id}` : it.type === 'album' ? `/album/${it.id}` : `/artista/${it.id}`;
    window.location.href = href;
  };
  const handlePickClick = (item, index) => {
    if (!isOwnProfile) {
      if (item) navigateToItem(item);
      return;
    }
    if (item) {
      navigateToItem(item);
    } else {
      openPopover(index);
    }
  };
  // (removed debug wrapper) use `openPopover` directly to open the popover
  const selectPick = (item) => {
    if (openPopoverIndex === null) return;
    setPickedItems(prev => { const cp = [...prev]; cp[openPopoverIndex] = item; return cp; });
    setOpenPopoverIndex(null);
  };
  const clearPick = (index) => { setPickedItems(prev => { const cp = [...prev]; cp[index] = null; return cp; }); };

  // Pagination + filtering helpers for the popover list
  const filterTypeMap = { songs: 'song', albums: 'album', artists: 'artist' };
  const filterType = filterTypeMap[activeFilter] || 'song';
  const qLower = (searchTerm || '').trim().toLowerCase();
  const filteredMusic = musicData.filter(item => {
    if (!item || !item.type || !item.name) return false;
    return item.type === filterType && item.name.toLowerCase().includes(qLower);
  });
  const perPage = 6; // uniform 6 items per page for songs, albums, artists
  const totalPages = Math.max(1, Math.ceil(filteredMusic.length / perPage));
  const pageItems = filteredMusic.slice((currentPage - 1) * perPage, currentPage * perPage);


  const retryFetch = async () => {
    setMusicLoading(true);
    setMusicError(null);
    try {
      const qToUse = ((searchTerm || '').trim()) || 'a';
      const url = (endpointMap[activeFilter] || endpointMap.songs)(qToUse);
      const res = await fetch(url, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } });
      console.log('Fetching from', url, res.status);
      if (res.status === 404) {
        const msg = 'Endpoint no encontrado (404). Revisa que MI_RUTA_CORRECTA exista en urls.py';
        setMusicError(msg);
        throw new Error(msg);
      }
      if ([301, 302, 401, 403].includes(res.status)) {
        const msg = `Error ${res.status}: Revisa que la ruta de la API de Django sea la correcta y devuelva JSON`;
        setMusicError(msg);
        throw new Error(msg);
      }
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const msg = 'La API no está devolviendo JSON, está devolviendo HTML u otro tipo';
        setMusicError(msg);
        throw new Error(msg);
      }
      const data = await res.json();
      console.log('Sample data', data);
      const rawItems = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
      const normItems = rawItems.map((it) => {
        if (!it) return null;
        if (activeFilter === 'songs') {
          return {
            id: it.spotify_id || it.id || it.spotifyId,
            type: 'song',
            name: it.nombre || it.name || it.titulo,
            artist: it.artista || (it.album && it.album.artista) || it.artist || (it.album && it.album.artista && it.album.artista.nombre),
            imageUrl: it.imagen_url || it.image_url || it.imageUrl ||
                      (it.album && (it.album.imagen_url || it.album.image_url || it.album.imageUrl)) ||
                      (Array.isArray(it.images) && it.images[0] && it.images[0].url) ||
                      (it.album && Array.isArray(it.album.images) && it.album.images[0] && it.album.images[0].url) || null,
          };
        } else if (activeFilter === 'albums') {
          return {
            id: it.spotify_id || it.id,
            type: 'album',
            name: it.titulo || it.nombre || it.name,
            artist: (it.artista && (it.artista.nombre || it.artista.name)) || it.artist,
            imageUrl: it.imagen || it.imagen_url || it.image_url || it.imageUrl ||
                      (Array.isArray(it.images) && it.images[0] && it.images[0].url) || null,
          };
        } else if (activeFilter === 'artists') {
          return {
            id: it.id,
            type: 'artist',
            name: it.nombre || it.name,
            artist: null,
            imageUrl: it.imagen || it.imagen_url || it.image_url || it.imageUrl ||
                      (Array.isArray(it.images) && it.images[0] && it.images[0].url) || null,
          };
        }
        return null;
      }).filter(Boolean);
      setMusicData(normItems);
      console.log('Fetched data (normalized):', normItems);
    } catch (err) {
      console.error('Retry fetch error:', err);
      setMusicError(err.message || 'Error cargando música');
      setMusicData([]);
    } finally {
      setMusicLoading(false);
    }
  };

  

  return (
    <>
      {/* Header con logo */}
      <header className="header-bar">
        <div className="header-center">
          {/* back button and compact search centered */}
          <BackAndSearch />
        </div>
        <div className="header-right">
          <button className="header-bell" onClick={() => setPanelOpen(true)} aria-label="Notificaciones">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M15 17H9a3 3 0 0 1-3-3V9a6 6 0 1 1 12 0v5a3 3 0 0 1-3 3z" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadNotifications > 0 && <span className="header-badge header-badge--alert">{unreadNotifications}</span>}
          </button>
        </div>
        <Link to="/" className="logo">
          ListenList <span>beta</span>
        </Link>
      </header>

      {/* Botón del menú lateral */}
      <div
        className={`menu-btn ${menuOpen ? "active" : ""}`}
        onClick={() => setMenuOpen(!menuOpen)}
      ></div>

      {/* Menú lateral */}
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
      {/* Contenedor principal del perfil */}
      <div className="perfil-container">
        <div
          className="perfil-banner"
          style={{ backgroundImage: `url(${bannerPreview || formData.banner || banner})` }}
        />

        <div className="perfil-header">
          <div className="perfil-avatar-wrapper">
            {shouldShowAvatarFallback ? (
              <div className="perfil-avatar perfil-avatar-fallback" aria-hidden="true">
                {avatarInitial}
              </div>
            ) : (
              <img
                src={fotoPerfil}
                alt="Foto de perfil"
                className="perfil-avatar"
              />
            )}
          </div>
          <div className="perfil-info">
            <h1 className="perfil-nombre">{nombre || username}</h1>

            {/* Seguimiento */}
            <div className="perfil-seguimiento">
              {localStorage.getItem("username") !== username && (
                <div className="perfil-actions-inline">
                  <button
                    className={`btn-seguir ${siguiendo ? "siguiendo" : ""}`}
                    onClick={handleToggleFollow}
                  >
                    {siguiendo ? "Siguiendo" : "Seguir"}
                  </button>
                  {siguiendo && perfilUserId && (
                    <button
                      type="button"
                      className="btn-mensaje"
                      onClick={handleMessageUser}
                    >
                      Enviar mensaje
                    </button>
                  )}
                </div>
              )}
              <div className="seguimiento-contadores">
                <span
                  data-testid="followers-trigger"
                  role="button"
                  aria-haspopup="dialog"
                  tabIndex={0}
                  onClick={async () => { await fetchFollowers(); setIsOpenFollowers(true); setIsOpenFollowing(false); }}
                  onKeyDown={async (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); await fetchFollowers(); setIsOpenFollowers(true); setIsOpenFollowing(false); } }}
                >
                  {contador.seguidores} seguidores
                </span>
                {' '}·{' '}
                <span
                  data-testid="following-trigger"
                  role="button"
                  aria-haspopup="dialog"
                  tabIndex={0}
                  onClick={async () => { await fetchFollowing(); setIsOpenFollowing(true); setIsOpenFollowers(false); }}
                  onKeyDown={async (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); await fetchFollowing(); setIsOpenFollowing(true); setIsOpenFollowers(false); } }}
                >
                  {contador.siguiendo} seguidos
                </span>
              </div>
            </div>

            {/* Edición de perfil */}
            {editando ? (
              <>
                <label htmlFor="avatar-upload">Foto de perfil</label>
                <div className="avatar-edit-controls">
                  <div className="avatar-actions">
                    <label className="avatar-upload-label" htmlFor="avatar-upload">
                      <span>Elegir imagen</span>
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarSelect}
                        className="avatar-file-input"
                      />
                    </label>
                    {!shouldShowAvatarFallback && (
                      <button
                        type="button"
                        className="avatar-remove-btn"
                        onClick={handleRemoveAvatar}
                      >
                        Quitar foto
                      </button>
                    )}
                  </div>
                </div>

                <label htmlFor="banner-upload">Banner</label>
                <div className="avatar-edit-controls">
                  <div className="avatar-actions">
                    <label className="avatar-upload-label" htmlFor="banner-upload">
                      <span>Elegir banner</span>
                      <input
                        id="banner-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleBannerSelect}
                        className="avatar-file-input"
                      />
                    </label>
                  </div>
                </div>

                <label htmlFor="perfil-biografia">Biografía</label>
                <textarea
                  id="perfil-biografia"
                  value={formData.biografia}
                  onChange={(e) =>
                    setFormData({ ...formData, biografia: e.target.value })
                  }
                />

                <div className="botones-edicion">
                  <button type="button" onClick={handleGuardar}>Guardar</button>
                  <button type="button" onClick={handleCancelarEdicion}>Cancelar</button>
                </div>
              </>
            ) : (
              <>
                <p
                  className="perfil-bio"
                  dangerouslySetInnerHTML={{
                    __html: (usuario.biografia || "Sin biografía aún.").replace(/\n/g, "<br />"),
                  }}
                />
                {localStorage.getItem("username") === username && (
                  <button type="button" onClick={handleIniciarEdicion}>Editar perfil</button>
                )}
              </>
            )}
            
          </div>
        </div>
        {/* Your Picks section (moved outside header) */}
        <section className="perfil-seccion" style={{ marginTop: 12 }}>
          <h2>Your Picks</h2>
          <div className="your-picks-layout">
            {pickedItems.map((it, i) => (
              <div key={i} style={{ width: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                {isOwnProfile && it && (
                  <button
                    aria-label="Acciones"
                    onClick={() => toggleActionMenu(i)}
                    
                    style={{ position: 'absolute', top: 6, right: 8, padding: '6px 8px', fontSize: 14, borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#c7d0d6', cursor: 'pointer', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)', lineHeight: 1 }}
                  >
                    Más
                  </button>
                )}
                <button
                  onClick={() => handlePickClick(it, i)}
                  style={{
                    width: 220,
                    height: 240,
                    borderRadius: 18,
                    border: it ? '1px solid rgba(255,255,255,0.10)' : '2px dashed rgba(255,255,255,0.18)',
                    background: it
                      ? 'linear-gradient(180deg, rgba(32,34,37,0.9) 0%, rgba(22,24,26,0.9) 100%)'
                      : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    boxShadow: it ? '0 12px 30px rgba(0,0,0,0.35)' : 'none',
                    outline: 'none',
                    backdropFilter: it ? 'blur(6px)' : 'none',
                    WebkitBackdropFilter: it ? 'blur(6px)' : 'none',
                    transition: 'transform 180ms ease, box-shadow 220ms ease, border-color 220ms ease'
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={openPopoverIndex === i}
                >
                  {it ? (
                    <div style={{ textAlign: 'center', color: '#fff', width: '100%' }}>
                      <div style={{ position: 'absolute', top: 10, left: 10, padding: '4px 8px', fontSize: 12, borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(2px)', zIndex: 2 }}>
                        {it.type === 'song' ? 'Canción' : it.type === 'album' ? 'Álbum' : 'Artista'}
                      </div>
                      <div style={{ position: 'relative', width: 168, height: 168, marginTop: 16, zIndex: 1 }}>
                        <img
                          src={it.imageUrl || it.image_url || (it.album && (it.album.imagen_url || (it.album.images && it.album.images[0] && it.album.images[0].url))) || '/default-cover.png'}
                          alt="thumb"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }}
                        />
                        <div style={{ position: 'absolute', inset: 0, borderRadius: 14, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10), 0 8px 22px rgba(29,185,84,0.10)' }} />
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 12, maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                      {it.artist && <div style={{ fontSize: 13, color: '#c7d0d6', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.artist}</div>}
                    </div>
                  ) : (
                    <div style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
                      <div style={{ fontSize: 40, color: '#1db954' }}>+</div>
                      <div style={{ fontSize: 15 }}>Pin tu favorita</div>
                    </div>
                  )}
                </button>
                {isOwnProfile && it && openActionMenuIndex === i && (
                  <div style={{ position: 'absolute', top: -40, right: 3, background: '#1f2224', border: '1px solid #3a3f44', borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.35)', overflow: 'hidden', zIndex: 1000, width: 104, opacity: actionMenuVisible ? 1 : 0, transform: actionMenuVisible ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.98)', transition: 'opacity 160ms ease, transform 180ms ease' }}>
                    <button onClick={() => { setOpenActionMenuIndex(null); openPopover(i); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', width: '100%', textAlign: 'left', color: '#c7d0d6', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path d="M4 12a1 1 0 0 1 1-1h7.586l-2.293-2.293a1 1 0 1 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 1 1-1.414-1.414L12.586 13H5a1 1 0 0 1-1-1Z" fill="#c7d0d6"/>
                      </svg>
                    </button>
                    <button onClick={() => { setOpenActionMenuIndex(null); clearPick(i); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', width: '100%', textAlign: 'left', color: '#ff6b6b', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path d="M9 3h6a1 1 0 0 1 1 1v2h3a1 1 0 1 1 0 2h-1v11a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V8H5a1 1 0 1 1 0-2h3V4a1 1 0 0 1 1-1Zm6 3V5H9v1h6Z" fill="#ff6b6b"/>
                        <path d="M10 10a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1Z" fill="#ff6b6b"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Popover centered */}
          {openPopoverIndex !== null && (
            <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1600 }}>
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
              <div ref={popoverRef} role="dialog" aria-modal="true" style={{ width: 'min(720px,95%)', background: '#1f2224', borderRadius: 10, padding: 16, zIndex: 1601 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={`Buscar en ${activeFilter}`}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 6, background: '#121314', border: '1px solid #333', color: '#fff' }}
                  />
                  <button onClick={() => setSearchTerm('')} style={{ padding: '8px 10px', borderRadius: 6, background: '#1db954', color: '#fff' }}>Limpiar</button>
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button onClick={() => setActiveFilter('songs')} style={{ padding: '6px 10px', borderRadius: 6, background: activeFilter === 'songs' ? '#1db954' : '#2a2d2f', color: '#fff' }}>Canciones</button>
                  <button onClick={() => setActiveFilter('albums')} style={{ padding: '6px 10px', borderRadius: 6, background: activeFilter === 'albums' ? '#1db954' : '#2a2d2f', color: '#fff' }}>Álbumes</button>
                  <button onClick={() => setActiveFilter('artists')} style={{ padding: '6px 10px', borderRadius: 6, background: activeFilter === 'artists' ? '#1db954' : '#2a2d2f', color: '#fff' }}>Artistas</button>
                </div>

                <div style={{ marginTop: 12, overflow: 'hidden', paddingBottom: 4 }}>
                  { (musicLoading || (!musicData.length && !musicError)) ? (
                    <div style={{ color: '#c7d0d6' }}>Cargando canciones...</div>
                  ) : musicError ? (
                    <div style={{ color: '#ffb3b3' }}>
                      Error cargando música: {musicError}
                      <div style={{ marginTop: 8 }}>
                        <button onClick={retryFetch} className="px-3 py-1 bg-green-600 text-white rounded">Reintentar</button>
                      </div>
                    </div>
                  ) : filteredMusic.length === 0 ? (
                    (searchTerm || '').trim() === '' ? (
                      <div style={{ color: '#c7d0d6' }}>Escribe algo para buscar canciones...</div>
                    ) : (
                      <div style={{ color: '#c7d0d6' }}>No hay resultados.</div>
                    )
                  ) : (
                    <ul
                      style={{
                        listStyle: 'none',
                        padding: '0 6px',
                        margin: 0,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
                        gap: 10,
                        maxWidth: '100%',
                        boxSizing: 'border-box'
                      }}
                    >
                      {pageItems.map(r => (
                        <li key={r.id}>
                          <button
                            onClick={() => selectPick(r)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 6,
                              padding: 8,
                              borderRadius: 8,
                              background: 'transparent',
                              border: '1px solid #2b2b2b',
                              color: '#fff'
                            }}
                          >
                            <img
                              src={r.image_url || r.imageUrl}
                              alt="thumb"
                              style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8 }}
                            />
                            <div style={{ textAlign: 'center', width: '100%' }}>
                              <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                              {r.artist && (
                                <div style={{ fontSize: 11, color: '#c7d0d6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {r.artist}
                                </div>
                              )}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Pagination controls (arrow style like comments) */}
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="carrusel-btn"
                    style={{ opacity: currentPage === 1 ? 0.5 : 1 }}
                  >◀</button>
                  <div style={{ color: '#c7d0d6', fontSize: 13 }}>Página {currentPage} / {totalPages}</div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="carrusel-btn"
                    style={{ opacity: currentPage === totalPages ? 0.5 : 1 }}
                  >▶</button>
                </div>

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setOpenPopoverIndex(null)} style={{ padding: '8px 12px', borderRadius: 6, background: '#3a3f44', color: '#fff' }}>Cerrar</button>
                </div>
              </div>
            </div>
          )}

        </section>

        {/* Comentarios (paginados de 5 en 5, arrancando en página 1) */}
        <section className="perfil-seccion">
          <h2>Comentarios</h2>
          {comentarios && comentarios.length > 0 ? (
            (() => {
              const ordered = [...comentarios];
              const pageSize = 5;
              const totalCommentPages = Math.max(1, Math.ceil(ordered.length / pageSize));
              const currentCommentPage = Math.min(totalCommentPages, Math.max(1, commentsPage));

              const startIdx = (currentCommentPage - 1) * pageSize;
              const endIdx = startIdx + pageSize;
              const pageSlice = ordered.slice(startIdx, endIdx);

              return (
                <div>
                  <div
                    key={currentCommentPage}
                    className={`comments-page-anim ${commentsPageAnimDir > 0 ? 'from-right' : 'from-left'}`}
                  >
                    {pageSlice.map((c, i) => (
                      <div key={`${startIdx + i}`} className="perfil-comentario">
                        <span className="comentario-item">
                          {c.itemType}: <b>{c.itemName}</b>
                        </span>
                        <p
                          className="comentario-texto"
                          dangerouslySetInnerHTML={{
                            __html: (c.texto || '').replace(/\n/g, "<br />"),
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <button
                      onClick={() => { setCommentsPageAnimDir(-1); setCommentsPage(currentCommentPage - 1); }}
                      disabled={currentCommentPage === 1}
                      className="carrusel-btn"
                      style={{ opacity: currentCommentPage === 1 ? 0.5 : 1 }}
                    >◀</button>
                    <div style={{ color: '#c7d0d6', fontSize: 13 }}>Página {currentCommentPage} / {totalCommentPages}</div>
                    <button
                      onClick={() => { setCommentsPageAnimDir(1); setCommentsPage(currentCommentPage + 1); }}
                      disabled={currentCommentPage === totalCommentPages}
                      className="carrusel-btn"
                      style={{ opacity: currentCommentPage === totalCommentPages ? 0.5 : 1 }}
                    >▶</button>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="sin-datos">Aún no has comentado nada.</p>
          )}
        </section>

        {/* Artistas seguidos (carrusel) */}
        <section className="perfil-seccion">
          <h2>Artistas seguidos</h2>
          {artistasSeguidos && artistasSeguidos.length > 0 ? (
            <div className="artistas-seguidos-wrapper">
              <button className="carrusel-btn left" onClick={scrollIzquierda}>◀</button>
              <div className="artistas-seguidos" ref={carruselRef}>
                {[...artistasSeguidos, ...artistasSeguidos, ...artistasSeguidos].map((a, idx) => (
                  <div key={`${a.id}-${idx}`} className="artista-card">
                    <Link to={`/artista/${a.id}`}>
                      {a.imagen_url ? (
                        <img src={a.imagen_url} alt={a.nombre} />
                      ) : (
                        <div className="artista-placeholder-small">Sin imagen</div>
                      )}
                      <div className="artista-card-nombre">{a.nombre}</div>
                    </Link>
                  </div>
                ))}
              </div>
              <button className="carrusel-btn right" onClick={scrollDerecha}>▶</button>
            </div>
          ) : (
            <p className="sin-datos">No sigues a ningún artista aún.</p>
          )}
        </section>

        

        {/* Valoraciones */}
        <section className="perfil-seccion perfil-dos-columnas">
          <div>
            <h2>Últimas Valoraciones</h2>
            {ordenRecientes.slice(0, 5).map((v, i) => (
              <div key={i} className="valoracion-item">
                <span>
                  {v.itemType}:{" "}
                  {v.itemType === "Canción" ? (
                    <Link to={`/cancion/${v.spotify_id}`}><b>{v.itemName}</b></Link>
                  ) : v.itemType === "Álbum" ? (
                    <Link to={`/album/${v.spotify_id}`}><b>{v.itemName}</b></Link>
                  ) : (
                    <b>{v.itemName}</b>
                  )}
                </span>
                <span className="nota alta">{v.nota}</span>
              </div>
            ))}
          </div>

          <div>
            <h2>Peor Valoradas</h2>
            {ordenAsc.slice(0, 5).map((v, i) => (
              <div key={i} className="valoracion-item">
                <span>
                  {v.itemType}:{" "}
                  {v.itemType === "Canción" ? (
                    <Link to={`/cancion/${v.spotify_id}`}><b>{v.itemName}</b></Link>
                  ) : v.itemType === "Álbum" ? (
                    <Link to={`/album/${v.spotify_id}`}><b>{v.itemName}</b></Link>
                  ) : (
                    <b>{v.itemName}</b>
                  )}
                </span>
                <span className="nota baja">{v.nota}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Popovers para seguidores / siguiendo (sin navegar de ruta) */}
      {isOpenFollowers && (
        <UserListPopover
          title="Seguidores"
          users={followersList}
          dataTestId="followers-dialog"
          onClose={() => setIsOpenFollowers(false)}
          onToggleFollow={(targetUsername) => handleToggleFollowUser(targetUsername)}
        />
      )}

      {isOpenFollowing && (
        <UserListPopover
          title="Siguiendo"
          users={followingList}
          dataTestId="following-dialog"
          onClose={() => setIsOpenFollowing(false)}
          onToggleFollow={(targetUsername) => handleToggleFollowUser(targetUsername)}
        />
      )}

      <Footer />
    </>
  );
}

export default MiPerfil;
