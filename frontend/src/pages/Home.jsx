import React, { useState } from "react";
import "../styles/styles.css";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import FondoBurbujas from "../components/FondoBurbujas";


function Home() {
  const [query, setQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query) return;
    // Redirigir a la página de búsqueda con query como parámetro
    window.location.href = `/buscar?q=${encodeURIComponent(query)}`;
  };

  return (
    <>
      <FondoBurbujas />
      <header className={`home-header ${mobileMenuOpen ? 'menu-open' : ''}`}>
        <Link to="/" className="logo">
          ListenList <span>beta</span>
        </Link>
        <button
          className="mobile-menu-btn"
          aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setMobileMenuOpen((s) => !s)}
        >
          <span className="hamburger" />
        </button>

        <div className={`home-nav-wrapper ${mobileMenuOpen ? "open" : ""}`}>
          <Navbar />
        </div>
      </header>

      <section className="hero">
        <h1>Descubre, valora y comparte tu música favorita</h1>
        <p>
          Busca cualquier artista, álbum o canción usando el catálogo de
          Spotify.
          <br />
          Valora, comenta y lleva tu diario musical junto a otros fans.
        </p>
        <form className="search-box" onSubmit={handleSubmit}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca un artista, álbum o canción..."
            required
          />
          <button type="submit">Buscar</button>
        </form>
      </section>

      <section className="features">
        <div className="feature-card">
          <h3>Catálogo infinito</h3>
          <p>
            Accede a millones de canciones y álbumes gracias a la API oficial de
            Spotify.
          </p>
        </div>
        <div className="feature-card">
          <h3>Valora y comenta</h3>
          <p>
            Deja tu opinión y califica tus discos y canciones favoritas.
          </p>
        </div>
        <div className="feature-card">
          <h3>Red social musical</h3>
          <p>
            Sigue a otros usuarios, descubre recomendaciones y comparte tu
            pasión por la música.
          </p>
        </div>
      </section>

      <section className="how-it-works">
        <h2>¿Cómo funciona?</h2>
        <ol>
          <li>
            <strong>Busca</strong> cualquier artista, álbum o canción.
          </li>
          <li>
            <strong>Selecciona</strong> el contenido que te interesa.
          </li>
          <li>
            <strong>Valora</strong> y <strong>comenta</strong> para guardarlo en
            tu perfil.
          </li>
          <li>¡Listo! Tu diario musical se actualiza automáticamente.</li>
        </ol>
      </section>

      <Footer />
    </>
  );
}

export default Home;
