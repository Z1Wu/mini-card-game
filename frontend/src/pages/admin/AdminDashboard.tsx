import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, AdminStats } from '../../services/adminApi';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const data = await adminApi.getStats();
      setStats(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    loadStats();
    const id = setInterval(loadStats, 5000);
    return () => clearInterval(id);
  }, [loadStats]);

  const statCards = [
    { label: '注册用户', value: stats?.total_users ?? '—', link: '/admin/users' },
    { label: '管理员数', value: stats?.admin_count ?? '—' },
    { label: '活跃房间', value: stats?.total_rooms ?? '—', link: '/admin/rooms' },
    { label: '进行中对局', value: stats?.active_games ?? '—', link: '/admin/rooms' },
    { label: '在线玩家', value: stats?.online_players ?? '—', link: '/admin/rooms' },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">仪表盘</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`bg-slate-800 border border-slate-700 rounded-xl p-5 ${
              card.link ? 'hover:border-slate-600 cursor-pointer' : ''
            }`}
          >
            {card.link ? (
              <Link to={card.link}>
                <p className="text-3xl font-bold text-white">{card.value}</p>
                <p className="text-sm text-slate-400 mt-1">{card.label}</p>
              </Link>
            ) : (
              <>
                <p className="text-3xl font-bold text-white">{card.value}</p>
                <p className="text-sm text-slate-400 mt-1">{card.label}</p>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/admin/users"
          className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-colors"
        >
          <h2 className="text-lg font-semibold text-white mb-1">用户管理</h2>
          <p className="text-sm text-slate-400">创建、编辑、删除用户账号，重置密码</p>
        </Link>
        <Link
          to="/admin/rooms"
          className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-colors"
        >
          <h2 className="text-lg font-semibold text-white mb-1">房间监控</h2>
          <p className="text-sm text-slate-400">查看活跃房间，踢出玩家，强制关闭房间</p>
        </Link>
      </div>
    </div>
  );
};
