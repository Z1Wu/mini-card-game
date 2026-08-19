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
  it('keeps doubt cards attached to their target player', () => {
    render(<PlayerZone player={player} isCurrentTurn />);
    expect(screen.getByRole('listitem', { name: /小王/ })).toHaveTextContent('手4');
    expect(screen.getByLabelText('小王 有 1 张质疑牌')).toBeInTheDocument();
    expect(screen.getByText('被质疑')).toBeInTheDocument();
  });
});
