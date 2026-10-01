import { CSSProperties, useLayoutEffect, useState } from 'react';
import { Card } from './Card';
import { RevealedPlay } from './usePlayPresentation';

export function SkillPlayReveal({ play }: { play: RevealedPlay }) {
  const [arrival, setArrival] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    const owner = [...document.querySelectorAll<HTMLElement>('[data-field-owner]')].find(node => node.dataset.fieldOwner === play.actorId);
    const target = owner?.querySelector('.player-field-card:last-child') ?? owner;
    const box = target?.getBoundingClientRect();
    if (box) setArrival({ x: box.x + box.width / 2 - window.innerWidth / 2, y: box.y + box.height / 2 - window.innerHeight / 2 });
  }, [play]);
  return <div className="skill-play-reveal" aria-label={`${play.actorName}发动${play.card.name}`} role="status">
    <div className="skill-play-card" style={{ '--arrival-x': `${arrival.x}px`, '--arrival-y': `${arrival.y}px` } as CSSProperties}>
      <Card card={play.card} showAsFaceDown={false} />
      <span className="skill-play-caption">{play.actorName} · 特技</span>
    </div>
  </div>;
}
