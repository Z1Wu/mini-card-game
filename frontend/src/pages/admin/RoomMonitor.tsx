import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, AdminRoom } from '../../services/adminApi';

const stateLabels: Record<string, string> = {
  waiting: '等待中',
  playing: '进行中',
  special_phase: '特殊阶段',
  game_over: '已结束',
};

const stateColors: Record<string, string> = {
  waiting: 'bg-slate-600 text-slate-200',
  playing: 'bg-green-900/50 text-green-300 border border-green-700/30',
  special_phase: 'bg-amber-900/50 text-amber-300 border border-amber-700/30',
  game_over: 'bg-red-900/50 text-red-300 border border-red-700/30',
};

export const RoomMonitor: React.FC = () => {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [error, setError] = useState('');
  const [closeTarget, setCloseTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      const data = await adminApi.listRooms();
      setRooms(data.rooms);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    loadRooms();
    const id = setInterval(loadRooms, 3000);
    return () => clearInterval(id);
  }, [loadRooms]);

  const handleCloseRoom = async () => {
    if (!closeTarget) return;
    setBusy(true);
    try {
      await adminApi.closeRoom(closeTarget);
      setCloseTarget(null);
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const handleKick = async (code: string, playerId: string, playerName: string) => {
    if (!confirm(`确定要踢出玩家「${playerName}」吗？`)) return;
    try {
      await adminApi.kickPlayer(code, playerId);
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">房间监控</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {rooms.length === 0 ? (
        <p className="text-slate-400">暂无房间</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rooms.map((room) => (
            <div key={room.code} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-white font-mono">{room.code}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${stateColors[room.state ?? ''] ?? 'bg-slate-700 text-slate-300'}`}>
                    {stateLabels[room.state ?? ''] ?? room.state ?? '—'}
                  </span>
                </div>
                <div className="text-xs text-slate-500">{room.client_count} 连接</div>
              </div>

              {room.players.length > 0 ? (
                <div className="space-y-1.5 mb-4">
                  {room.players.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${p.is_online ? 'bg-green-400' : 'bg-slate-600'}`} />
                        <span className="text-slate-200">{p.name}</span>
                        <span className="text-slate-500 text-xs">({p.hand_count} 张)</span>
                      </div>
                      <button
                        onClick={() => handleKick(room.code, p.id, p.name)}
                        disabled={!p.is_online}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        踢出
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm mb-4">暂无玩家</p>
              )}

              <div className="flex gap-2">
                {room.state && room.state !== 'waiting' && (
                  <Link
                    to={`/admin/rooms/${room.code}`}
                    className="px-3 py-1.5 text-xs bg-slate-700 text-slate-200 rounded hover:bg-slate-600"
                  >
                    查看对局
                  </Link>
                )}
                {room.code !== 'default' && (
                  <button
                    onClick={() => setCloseTarget(room.code)}
                    className="px-3 py-1.5 text-xs bg-red-900/50 text-red-300 rounded hover:bg-red-800/50"
                  >
                    强制关闭
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Close confirmation */}
      {closeTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setCloseTarget(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-80" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-2">确认关闭房间</h2>
            <p className="text-sm text-slate-400 mb-5">关闭房间「{closeTarget}」将断开所有玩家的连接。确定继续吗？</p>
            <div className="flex gap-2">
              <button onClick={handleCloseRoom} disabled={busy} className="flex-1 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                {busy ? '关闭中...' : '关闭'}
              </button>
              <button onClick={() => setCloseTarget(null)} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
