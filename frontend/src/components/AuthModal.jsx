import React, { useState, useEffect } from 'react';
import { useAuthModal } from '../context/AuthModalContext';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import API_URL from '../config/api';
import '../styles/AuthModal.css';
import { useNavigate } from 'react-router-dom';

const LoginForm = ({ switchToRegister, onClose }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (response.ok && data.access && data.refresh) {
        localStorage.setItem("access", data.access);
        localStorage.setItem("refresh", data.refresh);
        localStorage.setItem("username", username);
        onClose();
        // Optional: Reload or trigger a state update to refresh UI
        window.location.reload(); 
      } else {
        setError(data.detail || "Usuario o contraseña incorrectos");
      }
    } catch (err) {
      console.error("Error en login:", err);
      setError("Error en la conexión con el servidor");
    }
  };

  return (
    <div className="auth-modal-body">
      <div className="auth-modal-header">
        <h2>Iniciar Sesión</h2>
      </div>
      {error && <div className="auth-error">{error}</div>}
      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Entrar</button>
      </form>
      <div className="auth-modal-footer">
        ¿No tienes cuenta?
        <button onClick={switchToRegister}>Regístrate aquí</button>
      </div>
    </div>
  );
};

const RegisterFormContent = ({ switchToLogin, onClose }) => {
  const [username, setUsername] = useState("");
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const { executeRecaptcha } = useGoogleReCaptcha();

  const handleRegistro = async (e) => {
    e.preventDefault();
    setError("");

    if (!executeRecaptcha) {
      setError("reCAPTCHA no está disponible. Recarga la página.");
      return;
    }

    let captchaToken;
    try {
      captchaToken = await executeRecaptcha("registro");
    } catch (err) {
      console.error("Error ejecutando reCAPTCHA:", err);
      setError("Error al verificar reCAPTCHA");
      return;
    }

    if (password1 !== password2) {
      setError("Las contraseñas no coinciden");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password1,
          password2,
          captcha: captchaToken,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Auto login after register or just switch to login?
        // For now, let's switch to login and fill username
        alert("Registro exitoso. Por favor inicia sesión.");
        switchToLogin();
      } else {
        const errorMessage = data.error
          ? typeof data.error === "string"
            ? data.error
            : Object.entries(data.error)
                .map(([key, value]) => `${key}: ${value}`)
                .join(" | ")
          : "Error al registrar";
        setError(errorMessage);
      }
    } catch (err) {
      console.error("Error en registro:", err);
      setError("Error en la conexión con el servidor");
    }
  };

  return (
    <div className="auth-modal-body">
      <div className="auth-modal-header">
        <h2>Registro</h2>
      </div>
      {error && <div className="auth-error">{error}</div>}
      <form onSubmit={handleRegistro}>
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password1}
          onChange={(e) => setPassword1(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Repetir contraseña"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          required
        />
        <button type="submit">Registrarse</button>
      </form>
      <div className="auth-modal-footer">
        ¿Ya tienes cuenta?
        <button onClick={switchToLogin}>Inicia sesión</button>
      </div>
    </div>
  );
};

const AuthModal = () => {
  const { isOpen, view, closeModal, openLogin, openRegister } = useAuthModal();
  const siteKey = process.env.REACT_APP_RECAPTCHA_KEY;

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={closeModal}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={closeModal}>&times;</button>
        
        {view === 'login' && (
          <LoginForm switchToRegister={openRegister} onClose={closeModal} />
        )}

        {view === 'register' && (
          <GoogleReCaptchaProvider
            reCaptchaKey={siteKey}
            scriptProps={{
              async: false,
              defer: false,
              appendTo: "head",
              nonce: undefined,
            }}
            useRecaptchaNet
            language="es"
          >
            <RegisterFormContent switchToLogin={openLogin} onClose={closeModal} />
          </GoogleReCaptchaProvider>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
