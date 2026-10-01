import React, { useEffect, useMemo, useState } from 'react';
import { TurnAnnouncement } from '../components/game/TurnAnnouncement';
import { GameTable } from '../components/game/GameTable';
import { Card, CardType, CardUsageType, GameState, Player } from '../types/game';

const roles = [CardType.CLASS_REP, CardType.LIBRARY_COMMITTEE, CardType.ALIEN, CardType.HOME_CLUB, CardType.HEALTH_COMMITTEE];

const card = (id: string, name: CardType): Card => ({ id, name, description: `${name} 的测试说明`, harmony_value: 2, victory_priority: 3, victory_condition: '', owner_id: null, is_face_up: true, location: 'hand', target_player_id: null });

const player = (index: number): Player => ({
  id: `player-${index}`,
  name: ['小林（你）', '小王', '小陈', '小李', '小周'][index],
  hand: index === 0 ? roles.slice(0, 4).map((role, cardIndex) => card(`hand-${cardIndex}`, role)) : [],
  field_cards: Array.from({ length: Math.min(8, Math.max(1, Number(new URLSearchParams(window.location.search).get('fields')) || 1)) }, (_, i) => ({ ...card(`field-${index}-${i}`, roles[index]), location: 'field' as const })),
  doubt_cards: index > 1 ? [{ ...card(`doubt-${index}`, roles[index]), hidden: true, is_face_up: false }] : [],
  is_connected: true,
  current_hand_count: index === 0 ? 4 : 4 - (index % 2),
});

/** Deterministic, transport-free browser fixture used to verify landscape table layouts. */
export const GameTableFixture: React.FC = () => {
  const count = Math.min(5, Math.max(3, Number(new URLSearchParams(window.location.search).get('players')) || 3));
  const players = useMemo(() => Array.from({ length: count }, (_, index) => player(index)), [count]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [turn, setTurn] = useState(0);
  const showTurns = new URLSearchParams(window.location.search).has('turns');
  const currentIndex = turn % count;
  useEffect(() => {
    const textHook = () => JSON.stringify({ turn, currentPlayer: players[currentIndex].name, selected: selectedCard?.name ?? null });
    Object.assign(window, { render_game_to_text: textHook });
    return () => { Reflect.deleteProperty(window, 'render_game_to_text'); };
  }, [turn, players, currentIndex, selectedCard]);
  const [action, setAction] = useState('轮到小王出牌');
  const handlePlay = (selected: Card, usage: CardUsageType) => setAction(`已选择 ${selected.name} · ${usage}`);

  return <main className="game-table-fixture campus-shell min-h-screen p-3 sm:p-4"><div className="mx-auto max-w-6xl space-y-4"><header className="game-table-fixture-header campus-panel p-4"><p className="campus-kicker">Issue #124 deterministic fixture</p><h1 className="campus-title text-xl">{count} 人牌桌布局</h1><p role="status" className="mt-2 rounded-lg bg-[#fff4e8] p-2 text-sm font-semibold text-slate-700">▶ {action}</p>{showTurns && <button type="button" className="fixture-next-turn" onClick={() => setTurn(value => value + 1)}>下一回合</button>}</header>{showTurns && <TurnAnnouncement game={{ id: 'turn-fixture', state: GameState.PLAYING, players, current_player_index: currentIndex, turn_count: turn + 1, harmony_area: [], player_count: count, required_harmony_value: 8, winner: null }} playerId="player-0" />}<GameTable players={players} localPlayer={players[0]} localPlayerId="player-0" currentPlayerIndex={currentIndex} harmonyArea={[{ ...card('harmony-1', CardType.NEWS_CLUB), location: 'harmony' }, { ...card('harmony-2', CardType.RICH_GIRL), location: 'harmony' }, { ...card('harmony-3', CardType.ACCOMPLICE), location: 'harmony' }]} requiredHarmonyValue={8} selectedCard={selectedCard} onSelectCard={setSelectedCard} onPlayCard={handlePlay} newsClubMyChosenCard={null} turnStatusText={action} /></div></main>;
};
