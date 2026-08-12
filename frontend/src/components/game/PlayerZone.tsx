import React from 'react';
import { Player } from '../../types/game';

interface PlayerZoneProps {
  player: Player;
  isCurrentTurn: boolean;
}

/** A read-only opponent seat. Game state and transport stay in the page container. */
export const PlayerZone: React.FC<PlayerZoneProps> = ({ player, isCurrentTurn }) => {
  const isWaitingSettlement = player.current_hand_count === 1;
  return (
    <article className={`min-w-[11rem] rounded-xl border-2 p-3 transition-all ${
      isWaitingSettlement ? 'border-red-400 bg-red-50 ring-2 ring-red-200' : isCurrentTurn ? 'border-[#ef7667] bg-[#fff4e8] shadow-md shadow-[#ef7667]/15' : 'border-[#dfcfb9] bg-white/70'
    }`} aria-label={`${player.name}${isCurrentTurn ? '，当前回合' : ''}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-sm font-semibold text-slate-700">{player.name}</span>
        {isCurrentTurn && <span className="rounded bg-[#ef7667] px-1.5 py-0.5 text-[10px] font-bold text-white">▶ 当前回合</span>}
        {isWaitingSettlement && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">等待结算</span>}
      </div>
      <div className="mt-0.5 text-xs text-slate-500">手牌: {player.current_hand_count} · 正面: {player.field_cards?.length ?? 0} · 质疑: {player.doubt_cards?.length ?? 0}</div>
    </article>
  );
};
