import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { usePlayerStore } from '../stores/playerStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { wsService } from '../services/websocket';
import { LoginMessage, ReconnectMessage, GameStatusMessage, LoginSuccessMessage, ReconnectSuccessMessage, RoomCreatedMessage, RoomJoinedMessage } from '../types/message';
import { logUnexpectedError } from '../utils/logger';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { roomCode, setPlayer, setConnected, setUsername, setPassword, setRoomCode, setReconnectToken } = usePlayerStore();
  const { connect, send, error } = useWebSocket();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [username, setUsernameInput] = useState('');
  const [password, setPasswordInput] = useState('');
  const [serverError, setServerError] = useState('');
  /** 对局状态（登录前查询）：null=加载中/未请求 */
  const [gameStatus, setGameStatus] = useState<{ has_game: boolean; state: string | null; player_names: string[] } | null>(null);
  const [gameStatusError, setGameStatusError] = useState<string | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomError, setRoomError] = useState('');
  const [validationError, setValidationError] = useState('');

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
        if (!cancelled) send({ type: 'query_game_status' });
      } catch (_) {
        if (!cancelled) setGameStatusError('无法获取对局状态');
      }
    })();
    return () => {
      cancelled = true;
      wsService.off('game_status');
    };
  }, [connect, send]);

  useEffect(() => {
    const handleError = (message: any) => {
      logUnexpectedError('Server returned an unexpected error');
      if (message.code?.startsWith('room_')) {
        setRoomError(message.message);
        setRoomBusy(false);
        return;
      }
      setServerError(message.message);
      setIsConnecting(false);
      setIsReconnecting(false);
    };

    const handleLoginSuccess = (message: LoginSuccessMessage) => {
      setServerError('');
      setIsConnecting(false);
      setIsReconnecting(false);
      if (message.player_id && message.player_name) {
        setPlayer(message.player_id, message.player_name);
      }
      setReconnectToken(message.reconnect_token);
      wsService.setSession(roomCode, username.trim(), message.reconnect_token);
      setPassword('');
      navigate('/lobby');
    };

    const handleReconnectSuccess = (message: ReconnectSuccessMessage) => {
      setServerError('');
      setIsReconnecting(false);
      if (message.player_id && message.player_name) {
        setPlayer(message.player_id, message.player_name);
      }
      if (message.reconnect_token) setReconnectToken(message.reconnect_token);
      navigate('/lobby');
    };

    const handleRoomReady = (message: RoomCreatedMessage | RoomJoinedMessage) => {
      setRoomCode(message.room_code);
      setRoomCodeInput(message.room_code);
      setRoomBusy(false);
      setRoomError('');
      setGameStatus(null);
      send({ type: 'query_game_status' });
    };

    wsService.on('error', handleError);
    wsService.on('login_success', handleLoginSuccess);
    wsService.on('reconnect_success', handleReconnectSuccess);
    wsService.on('room_created', handleRoomReady);
    wsService.on('room_joined', handleRoomReady);

    return () => {
      wsService.off('error');
      wsService.off('login_success');
      wsService.off('reconnect_success');
      wsService.off('room_created');
      wsService.off('room_joined');
    };
  }, [navigate, roomCode, send, setPassword, setPlayer, setReconnectToken, setRoomCode, username]);

  const handleCreateRoom = async () => {
    setRoomBusy(true);
    setRoomError('');
    try {
      await connect();
      send({ type: 'create_room' });
    } catch {
      setRoomBusy(false);
      setRoomError('无法连接服务器');
    }
  };

  const handleJoinRoom = async () => {
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) return;
    setRoomBusy(true);
    setRoomError('');
    try {
      await connect();
      send({ type: 'join_room', room_code: code });
    } catch {
      setRoomBusy(false);
      setRoomError('无法连接服务器');
    }
  };

  const handleLogin = async () => {
    const u = username.trim();
    const p = password;
    if (!u || !p) {
      setValidationError(!u && !p ? '请输入用户名和密码。' : !u ? '请输入用户名。' : '请输入密码。');
      document.getElementById(!u ? 'username' : 'password')?.focus();
      return;
    }

    setValidationError('');
    setIsConnecting(true);
    setServerError('');
    try {
      await connect();
      setUsername(u);
      setPassword(p);
      setConnected(true);

      const message: LoginMessage = {
        type: 'login',
        username: u,
        password: p,
      };
      send(message);
    } catch (err) {
      logUnexpectedError('Login connection failed', err);
      setIsConnecting(false);
    }
  };

  const handleReconnect = async () => {
    const u = usePlayerStore.getState().username;
    const token = usePlayerStore.getState().reconnectToken;
    const p = usePlayerStore.getState().password;
    if (!u || (!token && !p)) {
      setValidationError('请先使用用户名和密码登录。');
      document.getElementById('username')?.focus();
      return;
    }

    setIsReconnecting(true);
    setServerError('');
    try {
      if (!wsService.isConnected()) {
        await connect();
      }
      setConnected(true);

      const message: ReconnectMessage = {
        type: 'reconnect',
        username: u,
        ...(token ? { reconnect_token: token } : { password: p! }),
      };
      send(message);
    } catch (err) {
      logUnexpectedError('Reconnect failed', err);
      setIsReconnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
        <h1 className="text-4xl font-bold text-center mb-2 text-white">卡牌游戏</h1>
        <p className="text-center text-slate-400 mb-8">多人在线对战</p>

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

        <div className="mb-6 p-4 bg-slate-700/50 border border-slate-600 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-300">游戏房间</span>
            <span className="text-xs text-primary-300">{roomCode === 'default' ? '默认大厅' : roomCode}</span>
          </div>
          <div className="flex gap-2">
            <input
              value={roomCodeInput}
              onChange={event => setRoomCodeInput(event.target.value.toUpperCase())}
              placeholder="输入 6 位房间码"
              maxLength={6}
              className="min-w-0 flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white uppercase placeholder-slate-500"
              disabled={roomBusy}
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleJoinRoom} disabled={roomBusy || !roomCodeInput.trim()}>加入</Button>
            <Button type="button" variant="primary" size="sm" onClick={handleCreateRoom} disabled={roomBusy}>创建</Button>
          </div>
          {roomError && <p className="text-red-300 text-xs mt-2">{roomError}</p>}
          <p className="text-slate-500 text-xs mt-2">登录前选择房间；创建后可把房间码发给其他玩家。</p>
        </div>

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
              onChange={(e) => {
                setUsernameInput(e.target.value);
                if (validationError) setValidationError('');
              }}
              placeholder="请输入用户名"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isConnecting}
              autoComplete="username"
              aria-invalid={Boolean(validationError && !username.trim())}
              aria-describedby={validationError ? 'login-validation-error' : undefined}
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
              onChange={(e) => {
                setPasswordInput(e.target.value);
                if (validationError) setValidationError('');
              }}
              placeholder="请输入密码"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isConnecting}
              autoComplete="current-password"
              aria-invalid={Boolean(validationError && !password)}
              aria-describedby={validationError ? 'login-validation-error' : undefined}
            />
            {validationError && <p id="login-validation-error" className="mt-2 text-sm text-red-300" role="alert">{validationError}</p>}
          </div>

          <Button
            onClick={handleLogin}
            disabled={isConnecting}
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
      </div>
    </div>
  );
};
