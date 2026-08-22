import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { usePlayerStore } from '../stores/playerStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { wsService } from '../services/websocket';
import { LoginMessage, LoginSuccessMessage, ReconnectSuccessMessage } from '../types/message';
import { logUnexpectedError } from '../utils/logger';
import { describeServerError } from '../utils/errorMessages';
import { adminApi } from '../services/adminApi';
import { useAdminStore } from '../stores/adminStore';

const REMEMBERED_USERNAME_KEY = 'card-game-username';

function loadRememberedUsername(): string {
  try {
    return window.localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberUsername(username: string): void {
  try {
    window.localStorage.setItem(REMEMBERED_USERNAME_KEY, username);
  } catch {
    // Storage may be unavailable (privacy mode); remembering is best-effort.
  }
}

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setPlayer, setConnected, setUsername, setPassword, setReconnectToken } = usePlayerStore();
  const { connect, send, error } = useWebSocket();
  const [isConnecting, setIsConnecting] = useState(false);
  const [username, setUsernameInput] = useState(loadRememberedUsername);
  const [password, setPasswordInput] = useState('');
  const [serverError, setServerError] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    const handleError = (message: any) => {
      logUnexpectedError('Server returned an unexpected error');
      setServerError(describeServerError(message));
      setIsConnecting(false);
    };

    const handleLoginSuccess = async (message: LoginSuccessMessage) => {
      setServerError('');
      setIsConnecting(false);
      if (message.player_id && message.player_name) {
        setPlayer(message.player_id, message.player_name);
      }
      if (username.trim()) {
        rememberUsername(username.trim());
      }
      setReconnectToken(message.reconnect_token);
      // No room yet: the hub session starts in the internal holding room and
      // the player picks a room on the /rooms page next.
      wsService.setSession('default', username.trim(), message.reconnect_token);

      if (message.role === 'admin') {
        const pwd = usePlayerStore.getState().password;
        setPassword('');
        try {
          const result = await adminApi.login(username.trim(), pwd!);
          useAdminStore.getState().setSession(result.token, result.username, result.name);
          navigate('/admin');
        } catch (err) {
          setServerError('管理员 HTTP 登录失败：' + (err instanceof Error ? err.message : '未知错误'));
        }
        return;
      }

      setPassword('');
      navigate('/rooms');
    };

    const handleReconnectSuccess = (message: ReconnectSuccessMessage) => {
      setServerError('');
      setIsConnecting(false);
      if (message.player_id && message.player_name) {
        setPlayer(message.player_id, message.player_name);
      }
      if (message.reconnect_token) setReconnectToken(message.reconnect_token);
      // Persist the session (with the rotated token) so a later drop can be
      // replayed automatically. Keep the session's room code — the store may
      // have been reset by a refresh while the socket session still knows it.
      const { username: storedUsername, reconnectToken } = usePlayerStore.getState();
      const activeToken = message.reconnect_token ?? reconnectToken;
      if (activeToken && storedUsername) {
        wsService.setSession(wsService.getSessionRoomCode(), storedUsername, activeToken);
      }
      setPassword('');
      navigate('/rooms');
    };

    wsService.on('error', handleError);
    wsService.on('login_success', handleLoginSuccess);
    wsService.on('reconnect_success', handleReconnectSuccess);

    return () => {
      wsService.off('error');
      wsService.off('login_success');
      wsService.off('reconnect_success');
    };
  }, [navigate, setConnected, setPassword, setPlayer, setReconnectToken, setUsername, username]);

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

  return (
    <div className="campus-shell flex items-center justify-center p-4 sm:p-8">
      <div className="campus-panel max-w-md w-full p-7 sm:p-8">
        <div className="text-center mb-8 pt-2">
          <p className="campus-kicker mb-2">Campus Card Club</p>
          <h1 className="campus-title text-4xl font-bold mb-2">放课后卡牌会</h1>
          <p className="text-slate-500">集结同伴，开始一局轻松又刺激的对决</p>
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
              </div>
            </div>
          </div>
        )}

        <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); void handleLogin(); }}>
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
              autoFocus={!username}
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
              autoFocus={Boolean(username)}
              autoComplete="current-password"
              aria-invalid={Boolean(validationError && !password)}
              aria-describedby={validationError ? 'login-validation-error' : undefined}
            />
            {validationError && <p id="login-validation-error" className="mt-2 text-sm text-red-300" role="alert">{validationError}</p>}
          </div>

          <Button
            type="submit"
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
            <p>登录后选择或创建房间</p>
          </div>
        </form>
      </div>
    </div>
  );
};
