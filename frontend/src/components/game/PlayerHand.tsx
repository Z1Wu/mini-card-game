import React from 'react';
import { Card as CardView } from './Card';
import { Card, CardType, Player } from '../../types/game';
import { PlayerField } from './PlayerField';
import { CardDecisionPanel } from './CardDecisionPanel';

interface PlayerHandProps {
  player: Player;
  isCurrentTurn: boolean;
  selectedCard: Card | null;
  onSelect: (card: Card | null) => void;
  harmonyIsEmpty: boolean;
  newsClubMyChosenCard: Card | null;
  turnStatusText: string;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  player, isCurrentTurn, selectedCard, onSelect, harmonyIsEmpty, newsClubMyChosenCard, turnStatusText,
}) => {
  const isSettlement = player.current_hand_count === 1;
  const isWaitingForInteraction = isCurrentTurn && /等待|正在选牌/.test(turnStatusText);



  return (
    <div className={`table-hand${isSettlement ? ' table-hand-settlement' : ''}${isCurrentTurn ? ' table-hand-my-turn' : ''}${player.hand.length <= 9 ? ' table-hand-compact' : ''}`} aria-label="我的手牌">
      <div className="table-local-field" data-field-owner={player.id}><PlayerField player={player} /></div>
      <div className={`table-turn-task${isCurrentTurn ? ' table-turn-task-active' : ''}`} role="status" aria-live="polite">
        <span className="table-turn-task-icon" aria-hidden="true">{isCurrentTurn ? '◆' : '◇'}</span>
        <strong>{isWaitingForInteraction
          ? turnStatusText
          : isCurrentTurn
          ? selectedCard ? `已选「${selectedCard.name}」` : '轮到你'
          : turnStatusText}</strong>
        {isCurrentTurn && <span>{isWaitingForInteraction ? '等待其他玩家完成操作' : selectedCard ? '请选择行动' : '请选择一张手牌'}</span>}
      </div>
      {newsClubMyChosenCard && (
        <div className="table-hand-news">
          新闻部已选: <div className="w-8"><CardView card={newsClubMyChosenCard} showAsFaceDown={false} /></div>
        </div>
      )}
      {selectedCard && (
        <CardDecisionPanel
          card={selectedCard}
          harmonyIsEmpty={harmonyIsEmpty}
          isCurrentTurn={isCurrentTurn}
          isSettlement={isSettlement}
        />
      )}
      <div className="table-hand-playrow">
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
      </div>
      {isCurrentTurn && selectedCard?.name === CardType.CRIMINAL && !isSettlement && (
        <div className="table-hand-blocked">犯人不可主动打出，只能保留或被其他特技移动</div>
      )}
    </div>
  );
};
