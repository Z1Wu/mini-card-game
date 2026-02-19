import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { usePlayerStore } from '../stores/playerStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { JoinGameMessage } from '../types/message';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { setPlayer, setConnected } = usePlayerStore();
  const { connect, send, error } = useWebSocket();
  const [playerName, setPlayerName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleJoinGame = async () => {
    if (!playerName.trim()) {
      alert('请输入玩家名称');
      return;
    }

    setIsConnecting(true);
    try {
      await connect();
      const playerId = `player_${Date.now()}`;
      setPlayer(playerId, playerName);
      setConnected(true);

      const message: JoinGameMessage = {
        type: 'join_game',
        player_id: playerId,
        player_name: playerName,
      };
      send(message);

      navigate('/lobby');
    } catch (err) {
      console.error('Failed to connect:', err);
      setIsConnecting(false);
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

        <div className="space-y-6">
          <div>
            <label htmlFor="playerName" className="block text-sm font-medium text-slate-300 mb-2">
              玩家名称
            </label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinGame()}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="输入你的名称"
              maxLength={20}
              disabled={isConnecting}
            />
          </div>

          <Button
            onClick={handleJoinGame}
            disabled={!playerName.trim() || isConnecting}
            className="w-full"
            size="lg"
          >
            {isConnecting ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                连接中...
              </div>
            ) : (
              '加入游戏'
            )}
          </Button>

          <div className="text-center text-sm text-slate-500">
            <p>需要至少 3 名玩家开始游戏</p>
          </div>
        </div>
      </div>
    </div>
  );
};
