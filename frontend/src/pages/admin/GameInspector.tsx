import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminApi } from '../../services/adminApi';

const cardNameClass = (name: string): string => {
  const specialCards = ['犯人', '外星人', '优等生', '感染者'];
  if (specialCards.includes(name)) return 'text-red-300';
  return 'text-slate-200';
};

export const GameInspector: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [gameState, setGameState] = useState<any>(null);
  const [error, setError] = useState('');

  const loadState = useCallback(async () => {
    if (!code) return;
    try {
      const data = await adminApi.getGameState(code);
      setGameState(data.game_state);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    }
  }, [code]);

  useEffect(() => {
    loadState();
    const id = setInterval(loadState, 2000);
    return () => clearInterval(id);
  }, [loadState]);

  if (error) {
    return (
      <div className="p-8">
        <Link to="/admin/rooms" className="text-sm text-slate-400 hover:text-slate-200 mb-4 inline-block">&larr; 返回房间列表</Link>
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="p-8">
        <Link to="/admin/rooms" className="text-sm text-slate-400 hover:text-slate-200 mb-4 inline-block">&larr; 返回房间列表</Link>
        <p className="text-slate-400">加载中...</p>
      </div>
    );
  }

  const stateLabels: Record<string, string> = {
    waiting: '等待中',
    playing: '进行中',
    special_phase: '特殊阶段',
    game_over: '已结束',
  };

  return (
    <div className="p-8">
      <Link to="/admin/rooms" className="text-sm text-slate-400 hover:text-slate-200 mb-4 inline-block">&larr; 返回房间列表</Link>
      <h1 className="text-2xl font-bold text-white mb-2">对局详情: {code}</h1>

      {/* Game metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
          <p className="text-xs text-slate-500">状态</p>
          <p className="text-sm font-medium text-white">{stateLabels[gameState.state] ?? gameState.state}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
          <p className="text-xs text-slate-500">回合数</p>
          <p className="text-sm font-medium text-white">{gameState.turn_count}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
          <p className="text-xs text-slate-500">调和目标</p>
          <p className="text-sm font-medium text-white">{gameState.required_harmony_value}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
          <p className="text-xs text-slate-500">当前玩家</p>
          <p className="text-sm font-medium text-white">
            {gameState.players[gameState.current_player_index]?.name ?? '—'}
          </p>
        </div>
      </div>

      {/* Players with full hands */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-3">玩家手牌（管理员视角，全部可见）</h2>
        <div className="space-y-3">
          {gameState.players?.map((player: any, idx: number) => (
            <div key={player.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-white">{player.name}</span>
                {idx === gameState.current_player_index && (
                  <span className="px-2 py-0.5 text-xs bg-[#c66b5d]/20 text-[#c66b5d] rounded">当前回合</span>
                )}
                {player.id === gameState.winner && (
                  <span className="px-2 py-0.5 text-xs bg-green-900/50 text-green-300 rounded">胜者</span>
                )}
              </div>
              {player.hand?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {player.hand.map((card: any) => (
                    <div key={card.id} className="px-2 py-1 bg-slate-700 rounded text-xs">
                      <span className={cardNameClass(card.name)}>{card.name}</span>
                      <span className="text-slate-500 ml-1">调和{card.harmony_value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-xs">无手牌</p>
              )}
              {player.doubt_cards?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-slate-500 mb-1">质疑区</p>
                  <div className="flex flex-wrap gap-2">
                    {player.doubt_cards.map((card: any) => (
                      <div key={card.id} className="px-2 py-1 bg-slate-700/50 rounded text-xs">
                        <span className={cardNameClass(card.name)}>{card.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {player.field_cards?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-slate-500 mb-1">场上</p>
                  <div className="flex flex-wrap gap-2">
                    {player.field_cards.map((card: any) => (
                      <div key={card.id} className="px-2 py-1 bg-slate-700/50 rounded text-xs">
                        <span className={cardNameClass(card.name)}>{card.name}</span>
                        {card.is_face_up && <span className="text-green-400 ml-1">↑</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Harmony area */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-3">调和区</h2>
        {gameState.harmony_area?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {gameState.harmony_area.map((card: any) => (
              <div key={card.id} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm">
                <span className={cardNameClass(card.name)}>{card.name}</span>
                <span className="text-slate-500 ml-2">调和{card.harmony_value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">空</p>
        )}
      </div>
    </div>
  );
};
