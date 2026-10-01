import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game, GameState } from '../../types/game';
import { TurnAnnouncement } from './TurnAnnouncement';

const game: Game = { id: 'game', state: GameState.PLAYING, turn_count: 1, current_player_index: 0,
  players: ['甲', '乙'].map((name, i) => ({ id: `p${i}`, name, hand: [], field_cards: [], doubt_cards: [], is_connected: true, current_hand_count: 3 })),
  harmony_area: [], player_count: 2, required_harmony_value: 8, winner: null };
afterEach(() => { vi.useRealTimers(); });
describe('turn announcement', () => {
  it('announces initial own turn, dismisses in StrictMode and ignores repeated snapshots', () => {
    vi.useFakeTimers();
    const view = render(<StrictMode><TurnAnnouncement game={game} playerId="p0" /></StrictMode>);
    expect(screen.getByText('轮到你了')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2200));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    view.rerender(<StrictMode><TurnAnnouncement game={{ ...game, players: [...game.players] }} playerId="p0" /></StrictMode>);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('announces a new player, does not replay when special phase ends, and stops at settlement', () => {
    vi.useFakeTimers();
    const view = render(<TurnAnnouncement game={game} playerId="p0" />);
    const next = { ...game, state: GameState.SPECIAL_PHASE, turn_count: 2, current_player_index: 1 };
    view.rerender(<TurnAnnouncement game={next} playerId="p0" />);
    expect(screen.getByText('轮到 乙 了')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2200));
    view.rerender(<TurnAnnouncement game={{ ...next, state: GameState.PLAYING }} playerId="p0" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    view.rerender(<TurnAnnouncement game={{ ...next, turn_count: 3 }} playerId="p0" />);
    expect(screen.getByText('轮到 乙 了')).toBeInTheDocument();
    view.rerender(<TurnAnnouncement game={{ ...next, state: GameState.GAME_OVER }} playerId="p0" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('restarts the timer on fast consecutive turns and accepts a new game', () => {
    vi.useFakeTimers();
    const view = render(<TurnAnnouncement game={game} playerId="p0" />);
    act(() => vi.advanceTimersByTime(1000));
    view.rerender(<TurnAnnouncement game={{ ...game, turn_count: 2, current_player_index: 1 }} playerId="p0" />);
    act(() => vi.advanceTimersByTime(1300));
    expect(screen.getByText('轮到 乙 了')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(900));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    view.rerender(<TurnAnnouncement game={{ ...game, id: 'rematch' }} playerId="p0" />);
    expect(screen.getByText('轮到你了')).toBeInTheDocument();
  });
});
