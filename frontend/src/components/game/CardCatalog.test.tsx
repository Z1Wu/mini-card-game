import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CardCatalog } from './CardCatalog';
import { CardType } from '../../types/game';

it('opens the complete public catalog and closes without a gameplay action', () => {
  render(<CardCatalog />);
  const dialog = screen.getByLabelText('卡牌图鉴') as HTMLDialogElement;
  const show = vi.fn(() => dialog.setAttribute('open', ''));
  const close = vi.fn(() => dialog.removeAttribute('open'));
  dialog.showModal = show;
  dialog.close = close;
  fireEvent.click(screen.getByRole('button', { name: '卡牌图鉴', exact: true }));
  expect(show).toHaveBeenCalledOnce();
  for (const name of Object.values(CardType)) expect(screen.getByRole('heading', { name, exact: true })).toBeInTheDocument();
  expect(screen.getAllByText('特技与效果')).toHaveLength(13);
  expect(screen.getAllByText('胜利条件')).toHaveLength(13);
  fireEvent.click(screen.getByRole('button', { name: '关闭卡牌图鉴' }));
  expect(close).toHaveBeenCalledOnce();
  vi.restoreAllMocks();
});
