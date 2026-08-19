import React from 'react';
import { Card as CardView } from './Card';
import { Card, CardType, CardUsageType, Player } from '../../types/game';
import { CardDecisionPanel } from './CardDecisionPanel';

interface PlayerHandProps {
  player: Player;
  isCurrentTurn: boolean;
  selectedCard: Card | null;
  onSelect: (card: Card | null) => void;
  onPlay: (card: Card, usage: CardUsageType) => void;
  harmonyIsEmpty: boolean;
  newsClubMyChosenCard: Card | null;
  turnStatusText: string;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  player, isCurrentTurn, selectedCard, onSelect, onPlay, harmonyIsEmpty, newsClubMyChosenCard, turnStatusText,
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
    <div className={`table-hand${isSettlement ? ' table-hand-settlement' : ''}${isCurrentTurn ? ' table-hand-my-turn' : ''}${player.hand.length <= 9 ? ' table-hand-compact' : ''}`} aria-label="我的手牌">
      {(player.doubt_cards?.length ?? 0) > 0 && (
        <div className="table-hand-doubt-state" aria-label={`你有 ${player.doubt_cards.length} 张质疑牌`}>
          <span aria-hidden="true">!</span> 被质疑 ×{player.doubt_cards.length}
        </div>
      )}
      <div className={`table-turn-task${isCurrentTurn ? ' table-turn-task-active' : ''}`} role="status" aria-live="polite">
        <span className="table-turn-task-icon" aria-hidden="true">{isCurrentTurn ? '◆' : '◇'}</span>
        <strong>{isCurrentTurn
          ? selectedCard ? `已选「${selectedCard.name}」` : '轮到你'
          : turnStatusText}</strong>
        {isCurrentTurn && <span>{selectedCard ? '请选择行动' : '请选择一张手牌'}</span>}
      </div>
      <div className="table-hand-info">
        <div className="table-hand-avatar">
          <div className="table-hand-icon">{localInitial}</div>
          {isCurrentTurn && <span className="table-hand-turn-dot" aria-hidden="true" />}
        </div>
        <div className="table-hand-body">
          <span className="table-hand-title">{player.name}</span>
          <span className="table-hand-stats">手牌 {player.hand.length} · 场牌 {player.field_cards?.length ?? 0} · 质疑 {player.doubt_cards?.length ?? 0}</span>
        </div>
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
            aria-label="调和"
          >
            <strong>调和</strong><small>秘密投入 {selectedCard.harmony_value > 0 ? '+' : ''}{selectedCard.harmony_value}</small>
          </button>
          <button
            className="table-hand-action-btn table-hand-action-doubt"
            onClick={() => onPlay(selectedCard, CardUsageType.DOUBT)}
            aria-label="质疑"
          >
            <strong>质疑</strong><small>选择目标玩家</small>
          </button>
          <button
            className="table-hand-action-btn table-hand-action-skill"
            disabled={skillDisabled}
            onClick={() => !skillDisabled && onPlay(selectedCard, CardUsageType.SKILL)}
            title={skillDisabled ? '调和区为空时无法使用该特技' : undefined}
            aria-label={skillDisabled ? '特技（不可用）' : '特技'}
          >
            <strong>特技</strong><small>{skillDisabled ? '调和区为空' : '正面发动效果'}</small>
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
      {isCurrentTurn && selectedCard?.name === CardType.CRIMINAL && !isSettlement && (
        <div className="table-hand-blocked">犯人不可主动打出，只能保留或被其他特技移动</div>
      )}
    </div>
  );
};
