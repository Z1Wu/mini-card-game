import React, { useMemo, useState } from 'react';
import { GameTable } from '../components/game/GameTable';
import { Card, CardType, CardUsageType, Player } from '../types/game';

const roles = [CardType.CLASS_REP, CardType.LIBRARY_COMMITTEE, CardType.ALIEN, CardType.HOME_CLUB, CardType.HEALTH_COMMITTEE];

const card = (id: string, name: CardType): Card => ({ id, name, description: `${name} 的测试说明`, harmony_value: 2, victory_priority: 3, victory_condition: '', owner_id: null, is_face_up: true, location: 'hand', target_player_id: null });

const player = (index: number): Player => ({
  id: `player-${index}`,
  name: ['小林（你）', '小王', '小陈', '小李', '小周'][index],
  hand: index === 0 ? roles.slice(0, 4).map((role, cardIndex) => card(`hand-${cardIndex}`, role)) : [],
  field_cards: index % 2 ? [card(`field-${index}`, roles[index])] : [],
  doubt_cards: index > 1 ? [{ ...card(`doubt-${index}`, roles[index]), hidden: true, is_face_up: false }] : [],
  is_connected: true,
  current_hand_count: index === 0 ? 4 : 4 - (index % 2),
});

/** Deterministic, transport-free browser fixture used to verify landscape table layouts. */
export const GameTableFixture: React.FC = () => {
  const count = Math.min(5, Math.max(3, Number(new URLSearchParams(window.location.search).get('players')) || 3));
  const players = useMemo(() => Array.from({ length: count }, (_, index) => player(index)), [count]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [action, setAction] = useState('轮到小王出牌');
  const handlePlay = (selected: Card, usage: CardUsageType) => setAction(`已选择 ${selected.name} · ${usage}`);

  return <main className="campus-shell min-h-screen p-3 sm:p-4"><div className="mx-auto max-w-6xl space-y-4"><header className="campus-panel p-4"><p className="campus-kicker">Issue #120 deterministic fixture</p><h1 className="campus-title text-xl">{count} 人牌桌布局</h1><p role="status" className="mt-2 rounded-lg bg-[#fff4e8] p-2 text-sm font-semibold text-slate-700">▶ {action}</p></header><GameTable players={players} localPlayer={players[0]} localPlayerId="player-0" currentPlayerIndex={0} harmonyArea={[card('harmony-1', CardType.NEWS_CLUB), card('harmony-2', CardType.RICH_GIRL), card('harmony-3', CardType.ACCOMPLICE)]} requiredHarmonyValue={8} selectedCard={selectedCard} onSelectCard={setSelectedCard} onPlayCard={handlePlay} newsClubMyChosenCard={null} turnStatusText={action} /></div></main>;
};
