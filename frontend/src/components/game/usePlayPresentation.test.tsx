import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Card, CardType, CardUsageType, Player, PublicAction } from '../../types/game';
import { collectNewPlays, usePlayPresentation } from './usePlayPresentation';
import { playActionSound } from '../../services/playSounds';

vi.mock('../../services/playSounds', () => ({ playActionSound: vi.fn(), unlockPlaySounds: vi.fn() }));
const card: Card = { id: 'skill', name: CardType.LIBRARY_COMMITTEE, description: '', harmony_value: 1, victory_priority: 4, victory_condition: '', owner_id: 'p1', is_face_up: true, location: 'field', target_player_id: null };
const player: Player = { id: 'p1', name: '小林', hand: [], field_cards: [], doubt_cards: [], is_connected: true, current_hand_count: 3 };
const action: PublicAction = { sequence: 1, actor_id: 'p1', actor_name: '小林', usage_type: CardUsageType.SKILL, card_name: card.name, target_player_id: null, target_player_name: null };

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
describe('confirmed play presentation', () => {
  it('skips historical actions and concealed harmony/doubt cards', () => {
    const initial = collectNewPlays(null, 'g', [action], [{ ...player, field_cards: [card] }]);
    expect(initial.reveals).toEqual([]);
    const hidden = collectNewPlays(collectNewPlays(null, 'g', [], [player]).snapshot, 'g', [{ ...action, usage_type: CardUsageType.DOUBT }], [{ ...player, field_cards: [{ ...card, hidden: true }] }]);
    expect(hidden.actions).toHaveLength(1);
    expect(hidden.reveals).toEqual([]);
    expect(collectNewPlays(initial.snapshot, 'other-room', [action], [player]).actions).toEqual([]);
  });

  it('reveals a confirmed skill once, then puts it into its owner field', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ actions, players }) => usePlayPresentation('g', actions, players), { initialProps: { actions: [] as PublicAction[], players: [player] } });
    rerender({ actions: [action], players: [{ ...player, field_cards: [card] }] });
    expect(result.current.active?.card.id).toBe(card.id);
    expect(result.current.players[0].field_cards).toEqual([]);
    rerender({ actions: [{ ...action }], players: [{ ...player, field_cards: [card] }] });
    expect(playActionSound).toHaveBeenCalledTimes(1);
    expect(playActionSound).toHaveBeenCalledWith(CardUsageType.SKILL);
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.active).toBeNull();
    expect(result.current.players[0].field_cards).toEqual([card]);
  });
});
