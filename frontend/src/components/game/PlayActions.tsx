import { Card, CardType, CardUsageType } from '../../types/game';

export function PlayActions({ selectedCard, isCurrentTurn, handCount, harmonyIsEmpty, onPlay, onSelect }: {
  selectedCard: Card | null; isCurrentTurn: boolean; handCount: number; harmonyIsEmpty: boolean;
  onPlay: (card: Card, usage: CardUsageType) => void; onSelect: (card: Card | null) => void;
}) {
  const canShowActions = isCurrentTurn && handCount > 1 && selectedCard?.name !== CardType.CRIMINAL;
  const skillDisabled = selectedCard?.name === CardType.HOME_CLUB && harmonyIsEmpty;
  if (!canShowActions || !selectedCard) return null;
  return (
          <div className="table-hand-actions">
            <button
              className="table-hand-action-btn table-hand-action-harmony"
              onClick={() => onPlay(selectedCard, CardUsageType.HARMONY)}
              aria-label="调和"
            >
              <strong>调和</strong>
            </button>
            <button
              className="table-hand-action-btn table-hand-action-doubt"
              onClick={() => onPlay(selectedCard, CardUsageType.DOUBT)}
              aria-label="质疑"
            >
              <strong>质疑</strong>
            </button>
            <button
              className="table-hand-action-btn table-hand-action-skill"
              disabled={skillDisabled}
              onClick={() => !skillDisabled && onPlay(selectedCard, CardUsageType.SKILL)}
              title={skillDisabled ? '调和区为空时无法使用该特技' : undefined}
              aria-label={skillDisabled ? '特技（不可用）' : '特技'}
            >
              <strong>特技</strong>
            </button>
            <button
              className="table-hand-action-btn table-hand-action-cancel"
              onClick={() => onSelect(null)}
              aria-label="取消选择"
            >
              ✕
            </button>
          </div>
  );

}