import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { usePlayerStore } from '../stores/playerStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { wsService } from '../services/websocket';
import { RoomCreatedMessage, RoomJoinedMessage, RoomListMessage, RoomInfo } from '../types/message';

const ROOM_STATE_LABELS: Record<string, string> = {
  waiting: '等待中',
  playing: '对局中',
  special_phase: '特技阶段',
  game_over: '已结束',
};

export const Rooms: React.FC = () => {
  const navigate = useNavigate();
  const { username, playerName, setRoomCode, reset: resetPlayer } = usePlayerStore();
  const { connect, send } = useWebSocket();
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expiredMsg, setExpiredMsg] = useState('');

  useEffect(() => {
    // The hub session lives on the socket; without a username we are not
    // authenticated and must go back to the login screen.
    if (!username) {
      navigate('/', { replace: true });
    }
  }, [username, navigate]);

  useEffect(() => {
    const handleRoomList = (message: RoomListMessage) => {
      setRooms(message.rooms ?? []);
    };

    const handleError = (message: { code?: string; message?: string }) => {
      if (message.code === 'authentication_required') {
        // Session lost (e.g. server restart): start over at login.
        wsService.clearSession();
        resetPlayer();
        navigate('/', { replace: true });
        return;
      }
      setError(message.message || '操作失败，请重试');
      setBusy(false);
    };

    const handleRoomReady = (message: RoomCreatedMessage | RoomJoinedMessage) => {
      setRoomCode(message.room_code);
      // Remember the room so an accidental drop can replay back into it.
      wsService.updateSessionRoom(message.room_code);
      navigate('/lobby');
    };

    const unsubExpired = wsService.onSessionExpired(() => {
      setRoomCode('default');
      setExpiredMsg('你之前的房间已过期，请重新创建或加入房间。');
    });

    wsService.on('room_list', handleRoomList);
    wsService.on('room_created', handleRoomReady);
    wsService.on('room_joined', handleRoomReady);
    wsService.on('error', handleError);

    (async () => {
      try {
        await connect();
        send({ type: 'list_rooms' });
      } catch (_) {
        setError('无法连接服务器');
      }
    })();
    const timer = setInterval(() => send({ type: 'list_rooms' }), 5000);

    return () => {
      wsService.off('room_list', handleRoomList);
      wsService.off('room_created', handleRoomReady);
      wsService.off('room_joined', handleRoomReady);
      wsService.off('error', handleError);
      unsubExpired();
      clearInterval(timer);
    };
  }, [connect, send, navigate, setRoomCode, resetPlayer]);

  const handleCreate = async () => {
    setBusy(true);
    setError('');
    try {
      await connect();
      send({ type: 'create_room' });
    } catch {
      setBusy(false);
      setError('无法连接服务器');
    }
  };

  const handleJoin = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    setError('');
    try {
      await connect();
      send({ type: 'join_room', room_code: code });
    } catch {
      setBusy(false);
      setError('无法连接服务器');
    }
  };

  return (
    <div className="campus-shell flex items-center justify-center p-4 sm:p-8">
      <div className="campus-panel max-w-2xl w-full p-7 sm:p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="campus-kicker mb-1">Game Rooms</p>
            <h1 className="campus-title text-3xl font-bold">房间大厅</h1>
          </div>
          <div className="text-slate-600">{playerName && <span>{playerName}</span>}</div>
        </div>

        {expiredMsg && (
          <div className="mb-4 p-3 bg-amber-900/50 border border-amber-700 rounded-lg">
            <p className="text-amber-300 text-sm">{expiredMsg}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-700 bg-red-900/50 p-4" role="alert">
            <p className="text-sm text-red-200">{error}</p>
            <button type="button" onClick={() => setError('')} className="min-h-11 min-w-11 text-red-200 underline focus:outline-none focus:ring-2 focus:ring-red-200" aria-label="关闭提示">关闭</button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:flex gap-3 mb-6">
          <Button onClick={handleCreate} disabled={busy} variant="primary" className="flex-1 min-w-[120px]">
            创建房间
          </Button>
          <div className="flex gap-2 flex-1">
            <input
              value={joinCode}
              onChange={event => setJoinCode(event.target.value.toUpperCase())}
              placeholder="输入 6 位房间码"
              maxLength={6}
              className="min-w-0 flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white uppercase placeholder-slate-500"
              disabled={busy}
              aria-label="房间码"
            />
            <Button type="button" variant="secondary" onClick={() => handleJoin(joinCode)} disabled={busy || !joinCode.trim()}>加入</Button>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-slate-700 mb-4">开着的房间</h2>
        {rooms.length === 0 ? (
          <p className="text-slate-500 text-center py-10">
            暂无房间——创建一个，把房间码发给同伴吧。
          </p>
        ) : (
          <div className="space-y-2 mb-6">
            {rooms.map(room => (
              <div key={room.code} className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg">
                <div>
                  <span className="text-base font-mono font-bold text-[#c66b5d]">{room.code}</span>
                  <span className="text-slate-400 text-xs ml-2">{ROOM_STATE_LABELS[room.state ?? ''] ?? ''}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 text-right">
                    {room.player_count}人{room.player_names.length > 0 ? ` · ${room.player_names.join('、')}` : ''}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={() => handleJoin(room.code)}
                    disabled={busy || room.state !== 'waiting'}
                  >
                    加入
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-slate-500 text-xs mt-6">列表每 5 秒自动刷新；只有等待中的房间可以加入。</p>
      </div>
    </div>
  );
};
