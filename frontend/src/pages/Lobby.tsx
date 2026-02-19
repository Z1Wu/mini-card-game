import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { usePlayerStore } from '../stores/playerStore';
import { useGameStore } from '../stores/gameStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { wsService } from '../services/websocket';
import { StartGameMessage, LoginSuccessMessage, ReconnectSuccessMessage } from '../types/message';
import { MIN_PLAYERS } from '../utils/constants';

export const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const { playerId, playerName, isConnected } = usePlayerStore();
  const { setGameState } = useGameStore();
  const { send } = useWebSocket();
  const [players, setPlayers] = useState<Array<{ id: string; name: string; hand_count: number }>>([]);

  useEffect(() => {
    if (!playerId) {
      navigate('/', { replace: true });
    }
  }, [playerId, navigate]);

  useEffect(() => {
    const handlePlayerList = (message: any) => {
      console.log('Received player list:', message.players);
      setPlayers(message.players);
    };

    const handleGameState = (message: any) => {
      console.log('Received game state:', message.game_state);
      if (message.game_state) {
        setGameState(message.game_state);
        // 如果游戏状态不是 WAITING，说明游戏已经开始，导航到游戏页面
        if (message.game_state.state !== 'WAITING') {
          navigate('/game');
        }
      }
    };

    const handleLoginSuccess = (message: LoginSuccessMessage) => {
      console.log('Login successful:', message);
    };

    const handleReconnectSuccess = (message: ReconnectSuccessMessage) => {
      console.log('Reconnect successful:', message);
    };

    const handleError = (message: any) => {
      console.error('Error from server:', message.message);
      alert(message.message);
    };

    wsService.on('player_list', handlePlayerList);
    wsService.on('game_state', handleGameState);
    wsService.on('login_success', handleLoginSuccess);
    wsService.on('reconnect_success', handleReconnectSuccess);
    wsService.on('error', handleError);

    // 检查连接状态
    if (!wsService.isConnected()) {
      console.warn('WebSocket not connected in Lobby');
    } else {
      console.log('WebSocket connected in Lobby');
    }

    return () => {
      wsService.off('player_list');
      wsService.off('game_state');
      wsService.off('login_success');
      wsService.off('reconnect_success');
      wsService.off('error');
    };
  }, [setGameState, navigate]);

  const handleStartGame = () => {
    if (players.length < MIN_PLAYERS) {
      alert(`需要至少 ${MIN_PLAYERS} 名玩家才能开始游戏`);
      return;
    }

    console.log('Starting game with players:', players.length);
    const message: StartGameMessage = {
      type: 'start_game',
      player_id: playerId!,
    };
    send(message);

    // 等待后端响应后再导航
    // navigate('/game');
  };

  const handleLeave = () => {
    wsService.disconnect();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">游戏大厅</h1>
          <div className="text-slate-400">
            {playerName && <span className="mr-4">{playerName}</span>}
            <span>{players.length} / 6</span>
          </div>
        </div>

        {!isConnected && (
          <div className="mb-6 p-4 bg-yellow-900/50 border border-yellow-700 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-yellow-400 font-medium">连接状态</p>
                <p className="text-yellow-300 text-sm">正在尝试重新连接...</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold text-slate-300 mb-4">玩家列表</h2>
          {players.length === 0 ? (
            <p className="text-slate-500 text-center py-8">等待玩家加入...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="bg-slate-700 rounded-lg p-4 border border-slate-600"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{player.name}</span>
                    <span className="text-slate-400 text-sm">手牌: {player.hand_count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <Button
            onClick={handleStartGame}
            disabled={players.length < MIN_PLAYERS}
            className="flex-1"
            variant="primary"
          >
            开始游戏
          </Button>
          <Button
            onClick={handleLeave}
            variant="danger"
            className="flex-1"
          >
            离开
          </Button>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          {players.length < MIN_PLAYERS
            ? `还需要 ${MIN_PLAYERS - players.length} 名玩家才能开始游戏`
            : '所有玩家已就绪，可以开始游戏'}
        </p>
      </div>
    </div>
  );
};
