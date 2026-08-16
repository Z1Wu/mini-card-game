import React from 'react';
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import { useAdminStore } from '../../stores/adminStore';

const navItems = [
  { to: '/admin', label: '仪表盘', end: true },
  { to: '/admin/users', label: '用户管理' },
  { to: '/admin/rooms', label: '房间监控' },
];

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, name, logout } = useAdminStore();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-950 border-r border-slate-800 flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <p className="text-xs text-slate-500 mb-1">管理后台</p>
          <h1 className="text-lg font-bold text-white truncate">{name || '管理员'}</h1>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white border-l-2 border-[#c66b5d]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-sm text-slate-400 hover:text-red-400 transition-colors"
          >
            退出登录
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};
