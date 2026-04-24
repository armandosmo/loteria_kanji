import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing/Landing';
import Join from './pages/Join/Join';
import Host from './pages/Host/Host';
import LobbyPlayer from './pages/LobbyPlayer/LobbyPlayer';
import GamePlayer from './pages/GamePlayer/GamePlayer';
import GameCaller from './pages/GameCaller/GameCaller';
import Result from './pages/Result/Result';
import { useDarkMode } from './hooks/useDarkMode';

function RequireNombre({ children }) {
  const location = useLocation();
  const nombre = localStorage.getItem('nombre');

  // Solo las pantallas de jugador requieren nombre.
  // El Gritón nunca tiene nombre y debe poder llegar a /host, /game/caller
  // y /result sin pasar por la validación.
  const playerOnly = ['/lobby', '/game/player'];
  const needsName = playerOnly.includes(location.pathname);

  if (!nombre && needsName) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  // Aplica el tema (claro/oscuro) guardado en localStorage al montar.
  useDarkMode();
  return (
    <BrowserRouter>
      <RequireNombre>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/join" element={<Join />} />
          <Route path="/host" element={<Host />} />
          <Route path="/lobby" element={<LobbyPlayer />} />
          <Route path="/game/player" element={<GamePlayer />} />
          <Route path="/game/caller" element={<GameCaller />} />
          <Route path="/result" element={<Result />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RequireNombre>
    </BrowserRouter>
  );
}
