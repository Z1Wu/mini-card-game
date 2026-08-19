import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardType, Player } from '../../types/game';
import { PlayerZone } from './PlayerZone';

const player: Player = {
  id: 'p2',
  name: '小王',
  hand: [],
  field_cards: [],
  doubt_cards: [{ id: 'd1', name: CardType.ALIEN, description: '', harmony_value: 0, victory_priority: 1, victory_condition: '', owner_id: null, is_face_up: false, location: 'field', target_player_id: 'p2', hidden: true }],
  is_connected: true,
  current_hand_count: 4,
};

describe('PlayerZone', () => {
  it('presents public hand, field, and doubt counts as distinct resources', () => {
    render(<PlayerZone player={player} isCurrentTurn />);
    expect(screen.getByLabelText('手牌 4 张')).toBeInTheDocument();
    expect(screen.getByLabelText('场牌 0 张')).toBeInTheDocument();
    expect(screen.getByLabelText('质疑牌 1 张')).toHaveClass('is-active');
    expect(screen.queryByText('被质疑')).not.toBeInTheDocument();
  });
});
