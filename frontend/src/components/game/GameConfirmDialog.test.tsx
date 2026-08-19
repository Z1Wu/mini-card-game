import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GameConfirmDialog } from './GameConfirmDialog';

describe('GameConfirmDialog', () => {
  it('describes reset impact and only runs it after confirmation', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<GameConfirmDialog kind="reset" onCancel={onCancel} onConfirm={onConfirm} />);

    expect(screen.getByRole('alertdialog')).toHaveTextContent('所有玩家将一起进入新牌局');
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: '确认重开' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('uses an explicit leave confirmation', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<GameConfirmDialog kind="leave" onCancel={vi.fn()} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: '确认离开' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
