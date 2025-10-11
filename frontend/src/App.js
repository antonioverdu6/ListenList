import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Buscar from "./pages/Buscar";
import DetalleCancion from "./pages/DetalleCancion";
import DetalleAlbum from "./pages/DetalleAlbum";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import MiPerfil from "./pages/MiPerfil";
import DetalleArtista from "./pages/DetalleArtista";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/inicio" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/buscar" element={<Buscar />} />
        <Route path="/cancion/:spotifyId" element={<DetalleCancion />} />
        <Route path="/album/:spotify_id" element={<DetalleAlbum />} />
        <Route path="/perfil/:username" element={<MiPerfil />} />
        <Route path="/artista/:id" element={<DetalleArtista />} />
      </Routes>
    </Router>
  );
}

export default App;
