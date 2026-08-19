import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GameMenu } from './GameMenu';

describe('GameMenu', () => {
  it('keeps disruptive actions inside the menu and exposes history count', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onShowHistory = vi.fn();
    const onRequestReset = vi.fn();
    const onRequestLeave = vi.fn();

    const { rerender } = render(
      <GameMenu open={false} isHost actionCount={7} onToggle={onToggle} onClose={vi.fn()} onShowHistory={onShowHistory} onRequestReset={onRequestReset} onRequestLeave={onRequestLeave} />,
    );

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '打开牌桌菜单' }));
    expect(onToggle).toHaveBeenCalledOnce();

    rerender(<GameMenu open isHost actionCount={7} onToggle={onToggle} onClose={vi.fn()} onShowHistory={onShowHistory} onRequestReset={onRequestReset} onRequestLeave={onRequestLeave} />);
    expect(screen.getByRole('menu', { name: '牌桌菜单' })).toHaveTextContent('7');
    await user.click(screen.getByRole('menuitem', { name: /重新开始/ }));
    await user.click(screen.getByRole('menuitem', { name: '离开房间' }));
    expect(onRequestReset).toHaveBeenCalledOnce();
    expect(onRequestLeave).toHaveBeenCalledOnce();
  });

  it('explains that reset is host-only', () => {
    render(<GameMenu open isHost={false} actionCount={0} onToggle={vi.fn()} onClose={vi.fn()} onShowHistory={vi.fn()} onRequestReset={vi.fn()} onRequestLeave={vi.fn()} />);
    expect(screen.getByRole('menuitem', { name: /重新开始/ })).toBeDisabled();
    expect(screen.getByText('仅房主')).toBeInTheDocument();
  });
});
