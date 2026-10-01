import { Player } from '../../types/game';
import { Card } from './Card';

export function PlayerField({ player }: { player: Player }) {
  if (!player.field_cards?.length) return null;
  return <section className="player-field" aria-label={`${player.name}的场牌`}>
    {player.field_cards.map(card => <div className="player-field-card" key={card.id}>
      <Card card={card} showAsFaceDown={card.hidden || !card.is_face_up} />
    </div>)}
  </section>;
}
