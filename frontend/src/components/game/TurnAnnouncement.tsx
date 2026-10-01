import { useEffect, useRef, useState } from 'react';
import { Game, GameState } from '../../types/game';

/** Announce server turn identity once, including the initial turn. */
export function TurnAnnouncement({ game, playerId }: { game: Game; playerId: string | null }) {
  const player = game.players[game.current_player_index];
  const key = `${game.id}:${game.turn_count}:${player?.id ?? ''}`;
  const active = game.state === GameState.PLAYING || game.state === GameState.SPECIAL_PHASE;
  const lastTurn = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [announcement, setAnnouncement] = useState<{ key: string; text: string; own: boolean } | null>(null);

  useEffect(() => {
    if (!active || !player) {
      clearTimeout(timer.current);
      setAnnouncement(null);
      return;
    }
    if (lastTurn.current === key) return;
    lastTurn.current = key;
    clearTimeout(timer.current);
    const own = player.id === playerId;
    setAnnouncement({ key, own, text: own ? '轮到你了' : `轮到 ${player.name} 了` });
    timer.current = setTimeout(() => setAnnouncement(null), 2200);
  }, [active, key, player, playerId]);
  useEffect(() => () => { clearTimeout(timer.current); lastTurn.current = null; }, []);

  if (!announcement) return null;
  return <div key={announcement.key} className={`turn-announcement${announcement.own ? ' is-own-turn' : ''}`} role="status" aria-live="polite" aria-atomic="true">
    <span className="turn-announcement-rule" aria-hidden="true" />
    <span className="turn-announcement-caption" aria-hidden="true">回合开始</span>
    <strong>{announcement.text}</strong>
    <span className="turn-announcement-rule" aria-hidden="true" />
  </div>;
}
