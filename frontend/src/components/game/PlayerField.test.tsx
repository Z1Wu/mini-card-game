import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { CardType, Player } from '../../types/game';
import { PlayerZone } from './PlayerZone';

it('keeps plays with their owner and preserves hidden card visibility without hand backs', () => {
  const player: Player = { id: 'p', name: '小王', hand: [], current_hand_count: 6, doubt_cards: [], is_connected: true,
    field_cards: [
      { id: 'a', name: CardType.LIBRARY_COMMITTEE, harmony_value: 1, victory_priority: 4, description: '', victory_condition: '', owner_id: 'p', location: 'field', is_face_up: true, target_player_id: null },
      { id: 'b', name: CardType.CRIMINAL, harmony_value: 0, victory_priority: 3, description: '', victory_condition: '', owner_id: 'p', location: 'field', is_face_up: false, hidden: true, target_player_id: null },
    ] };
  const { container } = render(<PlayerZone player={player} isCurrentTurn={false} />);
  const field = screen.getByLabelText('小王的场牌');
  expect(within(field).getByLabelText('卡牌：图书委员')).toBeInTheDocument();
  expect(within(field).queryByLabelText('卡牌：犯人')).not.toBeInTheDocument();
  expect(within(field).getByLabelText('牌背')).toBeInTheDocument();
  expect(screen.getByLabelText('手牌 6 张')).toBeInTheDocument();
  expect(container.querySelector('.table-seat-cards')).toBeNull();
});
