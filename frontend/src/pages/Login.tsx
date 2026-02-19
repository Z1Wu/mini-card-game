import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { usePlayerStore } from '../stores/playerStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { wsService } from '../services/websocket';
import { LoginMessage, ReconnectMessage, GameStatusMessage } from '../types/message';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setPlayer, setConnected, setUsername, setPassword } = usePlayerStore();
  const { connect, send, error } = useWebSocket();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [username, setUsernameInput] = useState('');
  const [password, setPasswordInput] = useState('');
  const [serverError, setServerError] = useState('');
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
      console.error('Error from server:', message.message);
      setServerError(message.message);
      setIsConnecting(false);
      setIsReconnecting(false);
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
    wsService.on('login_success', handleLoginSuccess);
    wsService.on('reconnect_success', handleReconnectSuccess);

    return () => {
      wsService.off('error');
      wsService.off('login_success');
      wsService.off('reconnect_success');
    };
  }, [navigate, setPlayer]);

  const handleLogin = async () => {
    const u = username.trim();
    const p = password;
    if (!u || !p) {
      alert('请输入用户名和密码');
      return;
    }

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
      </div>
    </div>
  );
};
