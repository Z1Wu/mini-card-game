import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { usePlayerStore } from '../stores/playerStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { wsService } from '../services/websocket';
import { LoginMessage, ReconnectMessage, GameStatusMessage, RoomCreatedMessage, RoomJoinedMessage, ErrorMessage } from '../types/message';
import { useRoomStore } from '../stores/roomStore';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setPlayer, setConnected, setUsername, setPassword, reset: resetPlayer } = usePlayerStore();
  const { roomCode, setRoomCode, clearRoom } = useRoomStore();
  const { connect, send, error } = useWebSocket();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [username, setUsernameInput] = useState('');
  const [password, setPasswordInput] = useState('');
  const [serverError, setServerError] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [roomError, setRoomError] = useState('');
  const [isSelectingRoom, setIsSelectingRoom] = useState(false);
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  /** 对局状态（登录前查询）：null=加载中/未请求 */
  const [gameStatus, setGameStatus] = useState<{ has_game: boolean; state: string | null; player_names: string[] } | null>(null);
  const [gameStatusError, setGameStatusError] = useState<string | null>(null);

  const isGameInProgressError = serverError?.includes('游戏正在进行中') ?? false;

  useEffect(() => {
    let cancelled = false;
    const handler = (msg: GameStatusMessage) => {
      if (!cancelled) setGameStatus({ has_game: msg.has_game, state: msg.state, player_names: msg.player_names ?? [] });
    };
    wsService.on('game_status', handler);
    (async () => {
      try {
        await connect();
        if (!cancelled && roomCode) send({ type: 'query_game_status' });
      } catch (_) {
        if (!cancelled) setGameStatusError('无法获取对局状态');
      }
    })();
    return () => {
      cancelled = true;
      wsService.off('game_status');
    };
  }, [connect, send, roomCode]);

  useEffect(() => {
    const handleError = (message: ErrorMessage) => {
      if (message.code === 'room_not_found' || message.code === 'room_code_exhausted' || message.code === 'room_switch_requires_disconnect') {
        console.warn('Room selection error:', message.code, message.message);
        setRoomError(message.code === 'room_not_found' ? '找不到该房间，请检查房间代码' : message.message);
        setIsSelectingRoom(false);
        if (message.code === 'room_not_found') {
          clearRoom();
          setGameStatus(null);
        }
        return;
      }
      console.error('Error from server:', message.message);
      setServerError(message.message);
      setIsConnecting(false);
      setIsReconnecting(false);
    };

    const handleRoomReady = (message: RoomCreatedMessage | RoomJoinedMessage) => {
      setRoomCode(message.room_code);
      setRoomInput('');
      setRoomError('');
      setIsSelectingRoom(false);
      setGameStatus(null);
      send({ type: 'query_game_status' });
    };

    const handleLoginSuccess = (message: { player_id?: string; player_name?: string }) => {
      setServerError('');
      setIsConnecting(false);
      setIsReconnecting(false);
      if (message.player_id && message.player_name) {
        setPlayer(message.player_id, message.player_name);
      }
      navigate('/lobby');
    };

    const handleReconnectSuccess = (message: { player_id?: string; player_name?: string }) => {
      setServerError('');
      setIsReconnecting(false);
      if (message.player_id && message.player_name) {
        setPlayer(message.player_id, message.player_name);
      }
      navigate('/lobby');
    };

    wsService.on('error', handleError);
    wsService.on('room_created', handleRoomReady);
    wsService.on('room_joined', handleRoomReady);
    wsService.on('login_success', handleLoginSuccess);
    wsService.on('reconnect_success', handleReconnectSuccess);

    return () => {
      wsService.off('error');
      wsService.off('room_created');
      wsService.off('room_joined');
      wsService.off('login_success');
      wsService.off('reconnect_success');
    };
  }, [navigate, setPlayer, setRoomCode, clearRoom, send]);

  const handleCreateRoom = async () => {
    setIsSelectingRoom(true);
    setRoomError('');
    try {
      await connect();
      send({ type: 'create_room' });
    } catch (_) {
      setRoomError('无法连接到房间服务');
      setIsSelectingRoom(false);
    }
  };

  const handleJoinRoom = async () => {
    const code = roomInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setRoomError('请输入 6 位房间代码');
      return;
    }
    setIsSelectingRoom(true);
    setRoomError('');
    try {
      await connect();
      send({ type: 'join_room', room_code: code });
    } catch (_) {
      setRoomError('无法连接到房间服务');
      setIsSelectingRoom(false);
    }
  };

  const handleChangeRoom = () => {
    wsService.disconnect();
    wsService.clearSessionCredentials();
    resetPlayer();
    clearRoom();
    setServerError('');
    setRoomError('');
    setGameStatus(null);
    setCopiedRoomCode(false);
  };

  const handleCopyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedRoomCode(true);
      window.setTimeout(() => setCopiedRoomCode(false), 1500);
    } catch (_) {
      setRoomError('无法自动复制，请手动复制房间代码');
    }
  };

  const handleLogin = async () => {
    const u = username.trim();
    const p = password;
    if (!u || !p) {
      alert('请输入用户名和密码');
      return;
    }
    if (!roomCode) {
      setRoomError('请先创建或加入房间');
      return;
    }

    setIsConnecting(true);
    setServerError('');
    try {
      await connect();
      setUsername(u);
      setPassword(p);
      setConnected(true);
      wsService.setSessionCredentials(u, p);

      const message: LoginMessage = {
        type: 'login',
        username: u,
        password: p,
      };
      send(message);
    } catch (err) {
      console.error('Failed to connect:', err);
      setIsConnecting(false);
    }
  };

  const handleReconnect = async () => {
    const u = usePlayerStore.getState().username;
    const p = usePlayerStore.getState().password;
    if (!u || !p) {
      alert('请先使用用户名和密码登录');
      return;
    }
    if (!roomCode) {
      setRoomError('请先重新加入房间');
      return;
    }

    setIsReconnecting(true);
    setServerError('');
    try {
      if (!wsService.isConnected()) {
        await connect();
      }
      setConnected(true);
      wsService.setSessionCredentials(u, p);

      const message: ReconnectMessage = {
        type: 'reconnect',
        username: u,
        password: p,
      };
      send(message);
    } catch (err) {
      console.error('Reconnect failed:', err);
      setIsReconnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
        <h1 className="text-4xl font-bold text-center mb-2 text-white">卡牌游戏</h1>
        <p className="text-center text-slate-400 mb-8">多人在线对战</p>

        {!roomCode ? (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white">选择私人房间</h2>
              <p className="text-sm text-slate-400 mt-2">创建房间并把代码分享给其他玩家，或输入朋友的房间代码。</p>
            </div>

            {roomError && (
              <div className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm" role="alert">
                {roomError}
              </div>
            )}

            <Button onClick={handleCreateRoom} disabled={isSelectingRoom} className="w-full" variant="primary">
              {isSelectingRoom ? '正在连接…' : '创建私人房间'}
            </Button>

            <div className="flex items-center gap-3 text-slate-500 text-xs">
              <span className="h-px bg-slate-700 flex-1" />
              或加入已有房间
              <span className="h-px bg-slate-700 flex-1" />
            </div>

            <div>
              <label htmlFor="room-code" className="block text-sm font-medium text-slate-300 mb-2">房间代码</label>
              <input
                id="room-code"
                value={roomInput}
                onChange={(event) => setRoomInput(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                onKeyDown={(event) => { if (event.key === 'Enter') void handleJoinRoom(); }}
                placeholder="例如 ABC123"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white tracking-[0.25em] uppercase placeholder:tracking-normal placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoComplete="off"
                disabled={isSelectingRoom}
              />
            </div>
            <Button onClick={handleJoinRoom} disabled={isSelectingRoom || roomInput.length !== 6} className="w-full" variant="secondary">
              加入房间
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-primary-900/30 border border-primary-700 rounded-xl flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-primary-300 mb-1">当前私人房间</div>
                <div className="text-xl font-mono font-bold tracking-[0.2em] text-white" data-testid="active-room-code">{roomCode}</div>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={handleCopyRoomCode} variant="secondary" size="sm">
                  {copiedRoomCode ? '已复制' : '复制代码'}
                </Button>
                <Button type="button" onClick={handleChangeRoom} variant="danger" size="sm">更换房间</Button>
              </div>
            </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-red-400 font-medium">连接失败</p>
                <p className="text-red-300 text-sm">无法连接到游戏服务器，请确保服务器已启动</p>
              </div>
            </div>
          </div>
        )}

        {serverError && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-red-400 font-medium">登录失败</p>
                <p className="text-red-300 text-sm">{serverError}</p>
                {isGameInProgressError && (
                  <p className="text-slate-300 text-sm mt-2">若您在本局中掉线，请点击下方「断线重连」重新进入对局。</p>
                )}
                {isGameInProgressError && (
                  <Button
                    type="button"
                    onClick={handleReconnect}
                    disabled={isReconnecting}
                    variant="secondary"
                    className="mt-3 w-full"
                  >
                    {isReconnecting ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        重连中...
                      </span>
                    ) : (
                      '断线重连'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 对局状态（登录前可见） */}
        <div className="mb-6 p-4 bg-slate-700/50 border border-slate-600 rounded-xl">
          <div className="text-sm font-medium text-slate-400 mb-2">当前对局状态</div>
          {gameStatusError && (
            <p className="text-amber-400 text-sm">{gameStatusError}</p>
          )}
          {!gameStatusError && gameStatus === null && (
            <p className="text-slate-500 text-sm">正在获取对局状态…</p>
          )}
          {!gameStatusError && gameStatus !== null && !gameStatus.has_game && (
            <p className="text-slate-400 text-sm">当前无对局</p>
          )}
          {!gameStatusError && gameStatus !== null && gameStatus.has_game && (
            <div className="text-slate-300 text-sm">
              {gameStatus.state === 'waiting' && (
                <p>等待中，已加入：{gameStatus.player_names.length ? gameStatus.player_names.join('、') : '暂无'}</p>
              )}
              {(gameStatus.state === 'playing' || gameStatus.state === 'special_phase') && (
                <p>对局进行中，参与玩家：{gameStatus.player_names.join('、')}</p>
              )}
              {gameStatus.state === 'game_over' && (
                <p>上一局已结束，参与玩家：{gameStatus.player_names.join('、')}</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
              用户名
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="请输入用户名"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isConnecting}
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="请输入密码"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isConnecting}
              autoComplete="current-password"
            />
          </div>

          <Button
            onClick={handleLogin}
            disabled={!username.trim() || !password || isConnecting}
            className="w-full"
            variant="primary"
          >
            {isConnecting ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                登录
              </div>
            ) : (
              '登录'
            )}
          </Button>

          <div className="text-center text-sm text-slate-500 space-y-2">
            <p>需要至少 3 名玩家开始游戏</p>
            <p>断线后重新登录可回到对局</p>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
};
