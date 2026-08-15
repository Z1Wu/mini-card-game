import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Login } from './pages/Login';
import { Lobby } from './pages/Lobby';
import { Game } from './pages/Game';
import { GameTableFixture } from './pages/GameTableFixture';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UserManagement } from './pages/admin/UserManagement';
import { RoomMonitor } from './pages/admin/RoomMonitor';
import { GameInspector } from './pages/admin/GameInspector';
import './assets/styles/index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
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
