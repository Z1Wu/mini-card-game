import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Card, CardType } from '../../types/game';
import { SkillActivation } from './SkillActivation';

const card: Card = { id: 'skill', name: CardType.NEWS_CLUB, description: '', harmony_value: 1, victory_priority: 4, victory_condition: '', owner_id: 'p1', is_face_up: true, location: 'hand', target_player_id: null };
afterEach(() => { vi.useRealTimers(); });
it('shows the face before continuing and cancels continuation on unmount', () => {
  vi.useFakeTimers();
  const complete = vi.fn();
  const view = render(<SkillActivation card={card} onComplete={complete} />);
  expect(screen.getByLabelText('展示特技牌：新闻部')).toBeInTheDocument();
  vi.advanceTimersByTime(1499);
  expect(complete).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(complete).toHaveBeenCalledTimes(1);
  view.unmount();
  const cancelled = render(<SkillActivation card={card} onComplete={complete} />);
  cancelled.unmount();
  vi.advanceTimersByTime(1500);
  expect(complete).toHaveBeenCalledTimes(1);
});
