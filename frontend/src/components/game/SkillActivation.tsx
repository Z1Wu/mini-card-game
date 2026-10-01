import { useEffect, useRef } from 'react';
import { Card as CardModel } from '../../types/game';
import { Card } from './Card';

export function SkillActivation({ card, onComplete }: { card: CardModel; onComplete: () => void }) {
  const complete = useRef(onComplete);
  complete.current = onComplete;
  useEffect(() => {
    const timer = setTimeout(() => complete.current(), 1500);
    return () => clearTimeout(timer);
  }, [card.id]);
  return <div className="skill-activation" role="status" aria-label={`展示特技牌：${card.name}`}>
    <div className="skill-activation-card"><Card card={card} /><span className="skill-play-caption">{card.name} · 发动特技</span></div>
  </div>;
}
