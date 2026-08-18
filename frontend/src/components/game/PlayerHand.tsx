import React from 'react';
import { Card as CardView } from './Card';
import { Card, CardType, CardUsageType, Player } from '../../types/game';

interface PlayerHandProps {
  player: Player;
  isCurrentTurn: boolean;
  selectedCard: Card | null;
  onSelect: (card: Card | null) => void;
  onPlay: (card: Card, usage: CardUsageType) => void;
  harmonyIsEmpty: boolean;
  newsClubMyChosenCard: Card | null;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  player, isCurrentTurn, selectedCard, onSelect, onPlay, harmonyIsEmpty, newsClubMyChosenCard,
}) => {
  const isSettlement = player.current_hand_count === 1;
  const canShowActions =
    isCurrentTurn &&
    !isSettlement &&
    selectedCard != null &&
    selectedCard.name !== CardType.CRIMINAL;
  const skillDisabled = selectedCard?.name === CardType.HOME_CLUB && harmonyIsEmpty;

  const localInitial = player.name.charAt(0);

  return (
    <div className={`table-hand${isSettlement ? ' table-hand-settlement' : ''}${isCurrentTurn ? ' table-hand-my-turn' : ''}`}>
      <div className="table-hand-info">
        <div className="table-hand-avatar">
          <div className="table-hand-icon">{localInitial}</div>
          {isCurrentTurn && <span className="table-hand-turn-dot" aria-hidden="true" />}
        </div>
        <div className="table-hand-body">
          <span className="table-hand-title">{player.name}</span>
          <span className="table-hand-stats">手牌 {player.hand.length} · 质疑 {player.doubt_cards?.length ?? 0}</span>
        </div>
      </div>
      {newsClubMyChosenCard && (
        <div className="table-hand-news">
          新闻部已选: <div className="w-8"><CardView card={newsClubMyChosenCard} showAsFaceDown={false} /></div>
        </div>
      )}
      <div className="table-hand-scroll">
        {player.hand.map(card => {
          const playable = isCurrentTurn && card.name !== CardType.CRIMINAL && player.hand.length > 1;
          const selected = selectedCard?.id === card.id;
          return (
            <div key={card.id} className={`table-hand-card${selected ? ' table-hand-card-lifted' : ''}`}>
              <CardView
                card={card}
                isPlayable={playable}
                isSelected={selected}
                onClick={() => onSelect(selected ? null : card)}
              />
            </div>
          );
        })}
      </div>
      {canShowActions && selectedCard && (
        <div className="table-hand-actions">
          <button
            className="table-hand-action-btn table-hand-action-harmony"
            onClick={() => onPlay(selectedCard, CardUsageType.HARMONY)}
          >
            调和
          </button>
          <button
            className="table-hand-action-btn table-hand-action-doubt"
            onClick={() => onPlay(selectedCard, CardUsageType.DOUBT)}
          >
            质疑
          </button>
          <button
            className="table-hand-action-btn table-hand-action-skill"
            disabled={skillDisabled}
            onClick={() => !skillDisabled && onPlay(selectedCard, CardUsageType.SKILL)}
            title={skillDisabled ? '调和区为空时无法使用该特技' : undefined}
          >
            特技{skillDisabled ? '（不可用）' : ''}
          </button>
          <button
            className="table-hand-action-btn table-hand-action-cancel"
            onClick={() => onSelect(null)}
            aria-label="取消选择"
          >
            ✕
          </button>
        </div>
      )}
      {isCurrentTurn && !canShowActions && !isSettlement && (
        <div className="table-hand-hint">点击卡牌选择 · 长按查看技能</div>
      )}
    </div>
  );
};
