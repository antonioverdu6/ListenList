import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "../styles/miperfil.css";
import Footer from "../components/Footer";
import { refreshAccessToken } from "../utils/auth";

function MiPerfil() {
  const { username } = useParams();

  // Estados
  const [usuario, setUsuario] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const [formData, setFormData] = useState({
    fotoPerfil: "",
    banner: "",
    biografia: "",
  });
  const [comentarios, setComentarios] = useState([]);
  const [valoraciones, setValoraciones] = useState([]);
  const [siguiendo, setSiguiendo] = useState(false);
  const [contador, setContador] = useState({ seguidores: 0, siguiendo: 0 });
  const [loading, setLoading] = useState(true);

  // Cargar perfil del usuario
  useEffect(() => {
    async function fetchPerfil() {
      try {
        const res = await fetch(`http://127.0.0.1:8000/musica/api/usuarios/${username}/`);
        if (!res.ok) throw new Error("No se pudo cargar el perfil");
        const data = await res.json();
        setUsuario(data);
        setFormData({
          fotoPerfil: data.fotoPerfil || "",
          banner: data.banner || "",
          biografia: data.biografia || "",
        });
        setComentarios(data.comentarios || []);
        setValoraciones(data.valoraciones || []);
      } catch (error) {
        console.error("Error al cargar el perfil:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchPerfil();
  }, [username]);

  // Cargar estado de seguimiento y contadores
  useEffect(() => {
    const fetchSeguimiento = async () => {
      try {
        const token = localStorage.getItem("access");
        const currentUser = localStorage.getItem("username");

        // Contadores
        const resCont = await fetch(`http://127.0.0.1:8000/musica/api/seguidores_y_siguiendo/${username}/`);
        const dataCont = await resCont.json();
        setContador(dataCont);

        // Estado de seguimiento
        if (token && currentUser && currentUser !== username) {
          const resSeg = await fetch(`http://127.0.0.1:8000/musica/api/comprobar_seguimiento/${username}/`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resSeg.ok) {
            const dataSeg = await resSeg.json();
            setSiguiendo(dataSeg.siguiendo);
          }
        }
      } catch (err) {
        console.error("Error obteniendo seguimiento:", err);
      }
    };
    fetchSeguimiento();
  }, [username]);

  // Función para seguir/dejar de seguir
  const handleToggleFollow = async () => {
    const token = localStorage.getItem("access");
    const currentUser = localStorage.getItem("username");
    if (!token) return alert("Debes iniciar sesión.");
    if (currentUser === username) return;

    try {
      const res = await fetch(`http://127.0.0.1:8000/musica/api/toggle_seguir/${username}/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSiguiendo(data.siguiendo);
      setContador((prev) => ({
        ...prev,
        seguidores: prev.seguidores + (data.siguiendo ? 1 : -1),
      }));
    } catch (err) {
      console.error("Error al seguir/dejar de seguir:", err);
    }
  };

  // Guardar cambios en perfil
  const handleGuardar = async () => {
    try {
      let token = localStorage.getItem("access");
      if (!token) return alert("Debes iniciar sesión.");

      // Refrescar token si expiró
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (Date.now() / 1000 > payload.exp) {
          token = await refreshAccessToken();
        }
      } catch (e) {
        console.error("Error verificando token:", e);
      }

      const response = await fetch(`http://127.0.0.1:8000/musica/api/usuarios/${username}/`, {
        method: "PUT", // <-- solo este cambio clave
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("Error guardando perfil:", data);
        throw new Error("Error al guardar perfil");
      }

      setUsuario(data);
      setEditando(false);
    } catch (err) {
      console.error("Error guardando perfil:", err);
    }
  };

  // Ordenar valoraciones
  const ordenDesc = [...valoraciones].sort((a, b) => b.nota - a.nota);
  const ordenAsc = [...valoraciones].sort((a, b) => a.nota - b.nota);

  if (loading) return <p style={{ color: "white", textAlign: "center" }}>Cargando perfil...</p>;

  const banner = usuario.banner || "/default-banner.jpg";
  const fotoPerfil = usuario.foto_perfil || "/default-avatar.png";
  const nombre = usuario.nombre;

  return (
    <>
      {/* Header con logo */}
      <header className="header-bar">
        <div className="logo">
          ListenList <span>beta</span>
        </div>
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
          <li><Link to={`/perfil/${username}`}>Mi Perfil</Link></li>
          <li><Link to="#">ListenList Plus</Link></li>
          <li><Link to="#">Configuración</Link></li>
        </ul>
      </nav>

      {/* Contenedor principal del perfil */}
      <div className="perfil-container">
        <div
          className="perfil-banner"
          style={{ backgroundImage: `url(${formData.banner || banner})` }}
        />

        <div className="perfil-header">
          <img
            src={formData.fotoPerfil || fotoPerfil}
            alt="Foto de perfil"
            className="perfil-avatar"
          />
          <div className="perfil-info">
            <h1 className="perfil-nombre">{nombre || username}</h1>

            {/* Seguimiento */}
            <div className="perfil-seguimiento">
              {localStorage.getItem("username") !== username && (
                <button
                  className={`btn-seguir ${siguiendo ? "siguiendo" : ""}`}
                  onClick={handleToggleFollow}
                >
                  {siguiendo ? "Dejar de seguir" : "Seguir"}
                </button>
              )}
              <div className="seguimiento-contadores">
                <span>{contador.seguidores} seguidores</span> ·{" "}
                <span>{contador.siguiendo} seguidos</span>
              </div>
            </div>

            {/* Edición de perfil */}
            {editando ? (
              <>
                <label>URL foto de perfil:</label>
                <input
                  type="text"
                  value={formData.fotoPerfil}
                  onChange={(e) =>
                    setFormData({ ...formData, fotoPerfil: e.target.value })
                  }
                />

                <label>URL banner:</label>
                <input
                  type="text"
                  value={formData.banner}
                  onChange={(e) =>
                    setFormData({ ...formData, banner: e.target.value })
                  }
                />

                <label>Biografía:</label>
                <textarea
                  value={formData.biografia}
                  onChange={(e) =>
                    setFormData({ ...formData, biografia: e.target.value })
                  }
                />

                <div className="botones-edicion">
                  <button onClick={handleGuardar}>Guardar</button>
                  <button onClick={() => setEditando(false)}>Cancelar</button>
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
                  <button onClick={() => setEditando(true)}>Editar perfil</button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Comentarios */}
        <section className="perfil-seccion">
          <h2>Comentarios</h2>
          {comentarios.length > 0 ? (
            comentarios.map((c, i) => (
              <div key={i} className="perfil-comentario">
                <span className="comentario-item">
                  {c.itemType}: <b>{c.itemName}</b>
                </span>
                <p
                  className="comentario-texto"
                  dangerouslySetInnerHTML={{
                    __html: c.texto.replace(/\n/g, "<br />"),
                  }}
                />
              </div>
            ))
          ) : (
            <p className="sin-datos">Aún no has comentado nada.</p>
          )}
        </section>

        {/* Valoraciones */}
        <section className="perfil-seccion perfil-dos-columnas">
          <div>
            <h2>Top Valoraciones</h2>
            {ordenDesc.slice(0, 5).map((v, i) => (
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
            <h2>Menos Valoradas</h2>
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

      <Footer />
    </>
  );
}

export default MiPerfil;
