import React from 'react';
import { Card, CardType } from '../../types/game';
import { getCardDecision } from './cardDecision';

interface CardDecisionPanelProps {
  card: Card;
  harmonyIsEmpty: boolean;
  isCurrentTurn: boolean;
  isSettlement: boolean;
}

export const CardDecisionPanel: React.FC<CardDecisionPanelProps> = ({
  card, harmonyIsEmpty, isCurrentTurn, isSettlement,
}) => {
  const decision = getCardDecision(card, harmonyIsEmpty);
  const blocked = card.name === CardType.CRIMINAL;
  const stateCopy = blocked
    ? '此牌不可主动打出'
    : isSettlement
      ? '已作为最终身份保留'
      : isCurrentTurn ? '选择一种出牌方式' : '可预览，等待你的回合';

  return (
    <section className="table-decision" aria-label={`${card.name} 决策说明`}>
      <div className="table-decision-summary">
        <strong>{card.name}</strong>
        <span>调和 {card.harmony_value > 0 ? '+' : ''}{card.harmony_value}</span>
        <span>优先级 {card.victory_priority}</span>
        <em>{stateCopy}</em>
      </div>
      <p className="table-decision-skill"><b>特技</b>{decision.skill}</p>
      <p className="table-decision-victory"><b>保留胜利</b>{decision.victory}</p>
      {!blocked && !isSettlement && (
        <div className="table-decision-previews" aria-label="出牌结果预览">
          <span><b>调和</b>{decision.harmony}</span>
          <span><b>质疑</b>{decision.doubt}</span>
          <span className={decision.skillUnavailable ? 'is-unavailable' : ''}><b>特技</b>{decision.skill}</span>
        </div>
      )}
    </section>
  );
};
