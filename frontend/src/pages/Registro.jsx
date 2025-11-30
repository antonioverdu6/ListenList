import React, { useState } from "react";
import API_URL from "../config/api";
import { useNavigate, Link } from "react-router-dom";
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3";
import "../styles/registro.css";

function RegistroForm() {
  const [username, setUsername] = useState("");
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { executeRecaptcha } = useGoogleReCaptcha();

  const handleRegistro = async (e) => {
    e.preventDefault();
    setError(""); // limpiar errores previos

    if (!executeRecaptcha) {
      setError("reCAPTCHA no está disponible. Recarga la página.");
      return;
    }

    // Ejecutar reCAPTCHA
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

    // Enviar registro al backend
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
        console.log("Registro exitoso");
        // After successful registration, go directly to inicio (home)
        navigate("/");
      } else {
        // Convertir objeto de error a string legible
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
    <div className="registro-page">
      <h2>Registro</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
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
      <p>
        ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
      </p>
    </div>
  );
}

// Componente envolvente con reCAPTCHA
function Registro() {
  return (
    <GoogleReCaptchaProvider
      reCaptchaKey="6Ld2us4rAAAAAOrN1RJLKykpjobReGh14xgor4cN"
      scriptProps={{
        async: false,
        defer: false,
        appendTo: "head",
        nonce: undefined,
      }}
    >
      <RegistroForm />
    </GoogleReCaptchaProvider>
  );
}

export default Registro;
