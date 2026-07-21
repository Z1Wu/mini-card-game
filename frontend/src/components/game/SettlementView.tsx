import React from 'react';
import { Button } from '../common/Button';
import { Game } from '../../types/game';
import { SettlementSummary } from '../../types/message';
import { Card } from './Card';

interface SettlementViewProps {
  gameState: Game;
  winnerId: string | null;
  settlementSummary: SettlementSummary | null;
  isHost: boolean;
  onRematch: () => void;
  onReturnToLogin: () => void;
}

/** Renders the completed-game settlement without subscribing to game services or stores. */
export const SettlementView: React.FC<SettlementViewProps> = ({
  gameState,
  winnerId,
  settlementSummary,
  isHost,
  onRematch,
  onReturnToLogin,
}) => {
  const harmonyTotal = settlementSummary?.harmony_total ?? gameState.harmony_area.reduce((sum, card) => sum + card.harmony_value, 0);
  const requiredHarmony = settlementSummary?.required_harmony_value ?? gameState.required_harmony_value ?? 0;
  const harmonyReached = settlementSummary?.harmony_reached ?? harmonyTotal >= requiredHarmony;
  const doubtTotals = settlementSummary?.player_doubt_totals ?? Object.fromEntries(
    gameState.players.map((player) => [player.id, player.doubt_cards.reduce((sum, card) => sum + card.harmony_value, 0)])
  );
  const imprisonedIds = settlementSummary?.imprisoned_player_ids ?? [];
  const winner = winnerId ? gameState.players.find((player) => player.id === winnerId) : null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-8 pb-24">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-white">游戏结束 · 完整结算</h1>
          <div className="flex gap-2">
            <Button onClick={onRematch} variant="secondary" size="sm" disabled={!isHost}>{isHost ? '重新开始一局' : '等待房主重新开始'}</Button>
            <Button onClick={onReturnToLogin} variant="primary" size="sm">返回登录</Button>
          </div>
        </div>

        <section className="bg-slate-800 rounded-xl p-4 border border-slate-600">
          <h2 className="text-lg font-semibold text-amber-200 mb-3">判定 1：调和值</h2>
          <p className="text-slate-400 text-sm mb-2">调和区卡牌（正面）及数值总和</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {gameState.harmony_area.length === 0 ? <span className="text-slate-500">无</span> : gameState.harmony_area.map((card) => (
              <div key={card.id} className="w-16"><Card card={card} showAsFaceDown={false} /></div>
            ))}
          </div>
          <p className="text-slate-300">
            总和 = <strong className="text-white">{harmonyTotal}</strong>
            {' '}/ 要求 <strong className="text-white">{requiredHarmony}</strong>{' '}
            <span className={harmonyReached ? 'text-emerald-400' : 'text-red-400'}>{harmonyReached ? '达成' : '未达成'}</span>
          </p>
        </section>

        <section className="bg-slate-800 rounded-xl p-4 border border-slate-600">
          <h2 className="text-lg font-semibold text-slate-300 mb-3">已出卡片区 · 正面出牌</h2>
          <div className="flex flex-wrap gap-3">
            {gameState.players.flatMap((player) => (player.field_cards ?? []).map((card) => (
              <div key={card.id} className="flex flex-col items-center gap-1">
                <span className="text-xs text-slate-500">{player.name}</span>
                <div className="w-16"><Card card={card} showAsFaceDown={false} /></div>
              </div>
            )))}
            {gameState.players.every((player) => !(player.field_cards?.length)) && <span className="text-slate-500">无</span>}
          </div>
        </section>

        <section className="bg-slate-800 rounded-xl p-4 border border-slate-600">
          <h2 className="text-lg font-semibold text-amber-200 mb-3">判定 2：质疑结算</h2>
          <p className="text-slate-400 text-sm mb-3">各玩家被质疑的牌（正面）及数值总和，最大值大于 0 的玩家均被监禁（可并列）</p>
          <div className="space-y-4">
            {gameState.players.map((player) => {
              const total = doubtTotals[player.id] ?? 0;
              const isImprisoned = imprisonedIds.includes(player.id);
              return <div key={player.id} className={`rounded-lg p-3 border-2 ${isImprisoned ? 'border-red-500 bg-red-900/20' : 'border-slate-600 bg-slate-700/50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-white">{player.name}</span>
                  <span className="text-slate-400 text-sm">质疑区总和 = {total}</span>
                  {isImprisoned && <span className="text-xs font-medium text-red-400 bg-red-900/50 px-2 py-0.5 rounded">被监禁</span>}
                </div>
                <div className="flex flex-wrap gap-3">
                  {(player.doubt_cards ?? []).length === 0 ? <span className="text-slate-500 text-sm">无</span> : (player.doubt_cards ?? []).map((card) => (
                    <div key={card.id} className="w-24 min-w-[5rem]"><Card card={card} showAsFaceDown={false} showVictoryPriority={false} /></div>
                  ))}
                </div>
              </div>;
            })}
          </div>
        </section>

        <section className="bg-slate-800 rounded-xl p-4 border border-slate-600">
          <h2 className="text-lg font-semibold text-amber-200 mb-3">判定 3：最终手牌与胜者</h2>
          <p className="text-slate-400 text-sm mb-3">按胜利优先级依次公开手牌，先满足条件者胜</p>
          <div className="space-y-4">
            {gameState.players.map((player) => {
              const hand = player.hand ?? [];
              const isWinner = winnerId === player.id;
              return <div key={player.id} className={`rounded-lg p-3 border-2 ${isWinner ? 'border-primary-500 bg-primary-900/20' : 'border-slate-600 bg-slate-700/50'}`}>
                <div className="flex items-center gap-2 mb-2"><span className="font-medium text-white">{player.name}</span>{isWinner && <span className="text-primary-400 font-bold">获胜</span>}</div>
                <div className="flex flex-wrap gap-3">
                  {hand.length === 0 ? <span className="text-slate-500 text-sm">无</span> : hand.map((card) => (
                    <div key={card.id} className="w-24 min-w-[5rem] flex flex-col items-center gap-0.5">
                      <Card card={card} showAsFaceDown={false} showVictoryPriority />
                      {typeof card.victory_priority === 'number' && <span className="text-[10px] text-slate-500">胜利优先级 {card.victory_priority}</span>}
                    </div>
                  ))}
                </div>
              </div>;
            })}
          </div>
        </section>

        <div className="text-center pt-4">
          <p className="text-primary-400 text-xl font-semibold mb-4">{winner ? `${winner.name} 获胜！` : '本局无人达成胜利条件'}</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button onClick={onRematch} variant="secondary" disabled={!isHost}>{isHost ? '重新开始一局' : '等待房主重新开始'}</Button>
            <Button onClick={onReturnToLogin} variant="primary">返回登录</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
