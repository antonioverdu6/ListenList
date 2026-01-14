import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthModalProvider } from "./context/AuthModalContext";
import AuthModal from "./components/AuthModal";
import Home from "./pages/Home";
import Buscar from "./pages/Buscar";
import DetalleCancion from "./pages/DetalleCancion";
import DetalleAlbum from "./pages/DetalleAlbum";
// import Login from "./pages/Login"; // Replaced by AuthModal
// import Registro from "./pages/Registro"; // Replaced by AuthModal
import MiPerfil from "./pages/MiPerfil";
import Mensajes from "./pages/Mensajes";
import DetalleArtista from "./pages/DetalleArtista";

function App() {
  return (
    <AuthModalProvider>
      <Router>
        <AuthModal />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/inicio" element={<Home />} />
          {/* <Route path="/login" element={<Login />} /> */}
          {/* <Route path="/registro" element={<Registro />} /> */}
          <Route path="/buscar" element={<Buscar />} />
          <Route path="/cancion/:spotifyId" element={<DetalleCancion />} />
          <Route path="/album/:spotify_id" element={<DetalleAlbum />} />
          <Route path="/perfil/:username" element={<MiPerfil />} />
          <Route path="/mensajes" element={<Mensajes />} />
          <Route path="/artista/:id" element={<DetalleArtista />} />
        </Routes>
      </Router>
    </AuthModalProvider>
  );
}

export default App;
