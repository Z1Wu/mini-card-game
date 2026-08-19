import React from 'react';
import { Card as CardModel, CardType, Player } from '../../types/game';
import { Card as CardView } from './Card';

interface PlayerZoneProps {
  player: Player;
  isCurrentTurn: boolean;
}

const faceDownCard = (playerId: string, index: number): CardModel => ({
  id: `opponent-hand-${playerId}-${index}`,
  name: CardType.HOME_CLUB,
  description: '',
  harmony_value: 0,
  victory_priority: 0,
  victory_condition: '',
  owner_id: playerId,
  is_face_up: false,
  location: 'hand',
  target_player_id: null,
});

export const PlayerZone: React.FC<PlayerZoneProps> = ({ player, isCurrentTurn }) => {
  const isWaitingSettlement = player.current_hand_count === 1;
  const initial = player.name.charAt(0);
  const fieldCount = player.field_cards?.length ?? 0;
  const doubtCount = player.doubt_cards?.length ?? 0;
  const handCards = player.current_hand_count > 0
    ? Array.from({ length: Math.min(player.current_hand_count, 4) }, (_, i) => faceDownCard(player.id, i))
    : [];

  return (
    <div
      className={`table-seat${isCurrentTurn ? ' table-seat-current' : ''}${isWaitingSettlement ? ' table-seat-settlement' : ''}`}
      aria-label={`${player.name}${isCurrentTurn ? ' (当前回合)' : ''}`}
      role="listitem"
    >
      <div className="table-seat-main">
        <div className="table-seat-avatar">
          <div className="table-seat-icon">{initial}</div>
          {isCurrentTurn && <span className="table-seat-turn-dot" aria-hidden="true" />}
        </div>
        <div className="table-seat-body">
          <span className="table-seat-name">{player.name}</span>
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
              <span className="table-seat-stat-label" aria-hidden="true">质疑</span>
              <strong>{doubtCount}</strong>
            </span>
          </div>
          {isWaitingSettlement && <div className="table-seat-settle">等待结算</div>}
        </div>
      </div>
      {handCards.length > 0 && (
        <div className="table-seat-cards" aria-hidden="true">
          {handCards.map(card => (
            <div key={card.id} className="table-seat-card">
              <CardView card={card} showAsFaceDown />
            </div>
          ))}
          {player.current_hand_count > handCards.length && (
            <b className="table-seat-card-overflow">+{player.current_hand_count - handCards.length}</b>
          )}
        </div>
      )}
    </div>
  );
};
