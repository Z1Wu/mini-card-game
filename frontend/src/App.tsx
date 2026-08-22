import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { Login } from './pages/Login';
import { Rooms } from './pages/Rooms';
import { Lobby } from './pages/Lobby';
import { Game } from './pages/Game';
import { GameTableFixture } from './pages/GameTableFixture';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UserManagement } from './pages/admin/UserManagement';
import { RoomMonitor } from './pages/admin/RoomMonitor';
import { GameInspector } from './pages/admin/GameInspector';
import { wsService } from './services/websocket';
import { usePlayerStore } from './stores/playerStore';
import { useGameStore } from './stores/gameStore';
import './assets/styles/index.css';

/** Error codes after which the local session can no longer be replayed. */
const SESSION_INVALID_CODES = new Set(['session_taken_over', 'invalid_reconnect_credentials']);

/**
 * Globally react to a dead session: the socket may still be open, but the
 * player can no longer act, so send them back to the login screen with an
 * explanation instead of leaving a ghost that fails on every action.
 */
function SessionGuard() {
  const navigate = useNavigate();
  useEffect(() => {
    const handleError = (message: { code?: string; message?: string }) => {
      if (!message.code || !SESSION_INVALID_CODES.has(message.code)) return;
      toast.error(message.message || '登录状态已失效，请重新登录');
      wsService.disconnect();
      usePlayerStore.getState().reset();
      useGameStore.getState().resetGame();
      navigate('/', { replace: true });
    };
    wsService.on('error', handleError);
    return () => {
      wsService.off('error', handleError);
    };
  }, [navigate]);
  return null;
}

function App() {
  return (
    <Router>
      <SessionGuard />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/game" element={<Game />} />
        <Route path="/fixtures/game-table" element={<GameTableFixture />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="rooms" element={<RoomMonitor />} />
          <Route path="rooms/:code" element={<GameInspector />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-center" />
    </Router>
  );
}

export default App;
