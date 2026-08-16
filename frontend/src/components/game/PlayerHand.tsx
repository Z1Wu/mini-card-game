import React from 'react';
import { Card as CardView } from './Card';
import { Card, CardType, CardUsageType, Player } from '../../types/game';

interface PlayerHandProps {
  player: Player;
  isCurrentTurn: boolean;
  selectedCard: Card | null;
  onSelect: (card: Card) => void;
  onPlay: (card: Card, usage: CardUsageType) => void;
  harmonyIsEmpty: boolean;
  newsClubMyChosenCard: Card | null;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  player, isCurrentTurn, selectedCard, onSelect, onPlay, harmonyIsEmpty, newsClubMyChosenCard,
}) => {
  const isSettlement = player.current_hand_count === 1;

  return (
    <div className={`table-hand${isSettlement ? ' table-hand-settlement' : ''}`}>
      <div className="table-hand-info">
        <span className="table-hand-title">
          我的手牌{isCurrentTurn && <span className="table-hand-turn"> · 你的回合</span>}
        </span>
        <span className="table-hand-stats">手牌 {player.hand.length} · 质疑 {player.doubt_cards?.length ?? 0}</span>
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
                onClick={() => onSelect(card)}
                showActions={selected && isCurrentTurn && card.name !== CardType.CRIMINAL}
                onPlay={onPlay}
                disabledSkill={card.name === CardType.HOME_CLUB && harmonyIsEmpty}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
