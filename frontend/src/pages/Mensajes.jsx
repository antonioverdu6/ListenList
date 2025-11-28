import React, { useState } from "react";
import "../styles/mensajes.css";
import { Link } from "react-router-dom";

function Mensajes() {
  // Static demo data
  const demoContacts = [
    { id: 1, name: "María", avatar: "/default-avatar.png", last: "¿Has escuchado el último álbum?", time: "12:34" },
    { id: 2, name: "Juan", avatar: "/default-avatar.png", last: "Me encantó ese single 💚", time: "11:02" },
    { id: 3, name: "Lucía", avatar: "/default-avatar.png", last: "Te paso mi top de la semana", time: "Ayer" },
  ];
  const [activeId, setActiveId] = useState(demoContacts[0].id);

  const active = demoContacts.find((c) => c.id === activeId);
  const demoThread = [
    { id: "m1", from: "me", text: "¡Hola!", time: "12:30" },
    { id: "m2", from: "them", text: active?.last || "¿Qué tal?", time: "12:34" },
    { id: "m3", from: "me", text: "Te comparto este álbum luego.", time: "12:35" },
  ];

  return (
    <div className="mensajes-container">
      <aside className="mensajes-sidebar">
        <div className="sidebar-header">
          <h2>Mensajes</h2>
          <Link to="/buscar" className="sidebar-action">Explorar</Link>
        </div>
        <div className="sidebar-search">
          <input placeholder="Buscar conversaciones" />
        </div>
        <ul className="contact-list">
          {demoContacts.map((c) => (
            <li
              key={c.id}
              className={`contact-item ${activeId === c.id ? "active" : ""}`}
              onClick={() => setActiveId(c.id)}
            >
              <img src={c.avatar} alt="avatar" className="contact-avatar" />
              <div className="contact-texts">
                <div className="contact-row">
                  <span className="contact-name">{c.name}</span>
                  <span className="contact-time">{c.time}</span>
                </div>
                <div className="contact-last">{c.last}</div>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <main className="mensajes-main">
        <header className="chat-header">
          <div className="chat-peer">
            <img src={active?.avatar} alt="avatar" className="chat-avatar" />
            <div>
              <div className="chat-name">{active?.name}</div>
              <div className="chat-status">Conectado • hoy</div>
            </div>
          </div>
          <div className="chat-actions">
            <button className="chat-btn">Compartir</button>
            <button className="chat-btn">Opciones</button>
          </div>
        </header>

        <section className="chat-thread">
          {demoThread.map((m) => (
            <div key={m.id} className={`bubble ${m.from === "me" ? "mine" : "theirs"}`}>
              <div className="bubble-text">{m.text}</div>
              <div className="bubble-time">{m.time}</div>
            </div>
          ))}
        </section>

        <footer className="chat-composer">
          <input className="compose-input" placeholder="Escribe un mensaje..." />
          <button className="compose-send">Enviar</button>
        </footer>
      </main>
    </div>
  );
}

export default Mensajes;
