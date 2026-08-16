import React from 'react';
import { Player } from '../../types/game';

interface PlayerZoneProps {
  player: Player;
  isCurrentTurn: boolean;
}

export const PlayerZone: React.FC<PlayerZoneProps> = ({ player, isCurrentTurn }) => {
  const isWaitingSettlement = player.current_hand_count === 1;
  const initial = player.name.charAt(0);
  const fieldCount = player.field_cards?.length ?? 0;
  const doubtCount = player.doubt_cards?.length ?? 0;

  return (
    <div
      className={`table-seat${isCurrentTurn ? ' table-seat-current' : ''}${isWaitingSettlement ? ' table-seat-settlement' : ''}`}
      aria-label={`${player.name}${isCurrentTurn ? ' (当前回合)' : ''}`}
    >
      {isCurrentTurn && <span className="table-seat-badge">出牌中</span>}
      <div className="table-seat-avatar">
        <div className="table-seat-icon">{initial}</div>
        <span className="table-seat-name">{player.name}</span>
      </div>
      <div className="table-seat-meta">
        <span className="table-seat-stat" title="手牌数">
          <span className="table-seat-dot table-seat-dot-hand" />
          <span className="table-seat-stat-label">手</span>{player.current_hand_count}
        </span>
        <span className="table-seat-stat" title="场牌数">
          <span className="table-seat-dot table-seat-dot-field" />
          <span className="table-seat-stat-label">场</span>{fieldCount}
        </span>
        <span className="table-seat-stat" title="质疑牌数">
          <span className="table-seat-dot table-seat-dot-doubt" />
          <span className="table-seat-stat-label">疑</span>{doubtCount}
        </span>
      </div>
      {isWaitingSettlement && <div className="table-seat-settle">等待结算</div>}
    </div>
  );
};
