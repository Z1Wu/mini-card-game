import React from 'react';
import { Player } from '../../types/game';
import { PlayerField } from './PlayerField';

interface PlayerZoneProps {
  player: Player;
  isCurrentTurn: boolean;
  /** 该玩家正在播放语音（Issue #131）。 */
  isSpeaking?: boolean;
}

export const PlayerZone: React.FC<PlayerZoneProps> = ({ player, isCurrentTurn, isSpeaking = false }) => {
  const isWaitingSettlement = player.current_hand_count === 1;
  const initial = player.name.charAt(0);
  const fieldCount = player.field_cards?.length ?? 0;
  const doubtCount = player.doubt_cards?.length ?? 0;

  return (
    <div
      className={`table-seat${isCurrentTurn ? ' table-seat-current' : ''}${isWaitingSettlement ? ' table-seat-settlement' : ''}${isSpeaking ? ' table-seat-speaking' : ''}`}
      aria-label={`${player.name}${isCurrentTurn ? ' (当前回合)' : ''}`}
      role="listitem"
      data-field-owner={player.id}
    >
      <div className="table-seat-main">
        <div className="table-seat-avatar">
          <div className="table-seat-icon">{initial}</div>
          {isCurrentTurn && <span className="table-seat-turn-dot" aria-hidden="true" />}
        </div>
        <div className="table-seat-body">
          <span className="table-seat-name">{player.name}</span>
          {isSpeaking && (
            <span className="table-seat-speaking-badge" role="status">🎙️ 正在说话</span>
          )}
          <div className="table-seat-meta">
            <span className="table-seat-stat table-seat-stat-hand" aria-label={`手牌 ${player.current_hand_count} 张`}>
              <span className="table-seat-stat-label" aria-hidden="true">手牌</span>
              <strong>{player.current_hand_count}</strong>
            </span>
            <span className={`table-seat-stat table-seat-stat-field${fieldCount > 0 ? ' is-active' : ' is-zero'}`} aria-label={`场牌 ${fieldCount} 张`}>
              <span className="table-seat-stat-label" aria-hidden="true">场牌</span>
              <strong>{fieldCount}</strong>
            </span>
            <span className={`table-seat-stat table-seat-stat-doubt${doubtCount > 0 ? ' is-active' : ' is-zero'}`} aria-label={`质疑牌 ${doubtCount} 张`}>
              <span className="table-seat-stat-label" aria-hidden="true">质疑牌</span>
              <strong>{doubtCount}</strong>
            </span>
          </div>
          {isWaitingSettlement && <div className="table-seat-settle">等待结算</div>}
        </div>
      </div>
      <PlayerField player={player} />
    </div>
  );
};
