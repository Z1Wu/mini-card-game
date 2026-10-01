import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Card, CardUsageType, Player, PublicAction } from '../../types/game';
import { playActionSound, unlockPlaySounds } from '../../services/playSounds';

export interface RevealedPlay { sequence: number; actorId: string; actorName: string; card: Card }
interface Snapshot { gameId: string; sequence: number; fieldIds: Set<string> }

export function collectNewPlays(previous: Snapshot | null, gameId: string, actions: PublicAction[], players: Player[]) {
  const sequence = actions[actions.length - 1]?.sequence ?? 0;
  const snapshot = { gameId, sequence, fieldIds: new Set(players.flatMap(player => player.field_cards.map(card => card.id))) };
  if (!previous || previous.gameId !== gameId || sequence < previous.sequence) return { snapshot, actions: [], reveals: [] as RevealedPlay[], reset: true };
  const fresh = actions.filter(action => action.sequence > previous.sequence);
  const reveals: RevealedPlay[] = [];
  const used = new Set<string>();
  for (const action of fresh) {
    if (action.usage_type !== CardUsageType.SKILL || !action.card_name) continue;
    const card = players.find(player => player.id === action.actor_id)?.field_cards.find(card =>
      card.name === action.card_name && card.is_face_up && !card.hidden && !previous.fieldIds.has(card.id) && !used.has(card.id));
    if (card) { reveals.push({ sequence: action.sequence, actorId: action.actor_id, actorName: action.actor_name, card }); used.add(card.id); }
  }
  return { snapshot, actions: fresh, reveals, reset: false };
}

export function usePlayPresentation(gameId: string, actions: PublicAction[], players: Player[], suppressActorId?: string) {
  const previous = useRef<Snapshot | null>(null);
  const [queue, setQueue] = useState<RevealedPlay[]>([]);
  useLayoutEffect(() => {
    const next = collectNewPlays(previous.current, gameId, actions, players);
    previous.current = next.snapshot;
    if (next.reset) setQueue([]);
    else if (next.reveals.length) setQueue(current => [...current, ...next.reveals.filter(play => play.actorId !== suppressActorId)]);
    next.actions.forEach(action => playActionSound(action.usage_type));
  }, [gameId, actions, players, suppressActorId]);
  useEffect(() => {
    window.addEventListener('pointerdown', unlockPlaySounds);
    window.addEventListener('keydown', unlockPlaySounds);
    return () => { window.removeEventListener('pointerdown', unlockPlaySounds); window.removeEventListener('keydown', unlockPlaySounds); };
  }, []);
  const active = queue[0] ?? null;
  useEffect(() => {
    if (!active) return;
    const duration = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 950 : 1500;
    const timer = setTimeout(() => setQueue(current => current.slice(1)), duration);
    return () => clearTimeout(timer);
  }, [active]);
  const hiddenIds = new Set(queue.map(play => play.card.id));
  return { active, players: players.map(player => ({ ...player, field_cards: player.field_cards.filter(card => !hiddenIds.has(card.id)) })) };
}
