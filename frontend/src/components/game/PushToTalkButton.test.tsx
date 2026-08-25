import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PushToTalkButton } from './PushToTalkButton';

/** 用受控状态模拟真实按下 → talking 置位 → 松开复位的完整回路。 */
function Harness({ onStartSpy, onStopSpy, disabled }: { onStartSpy?: () => void; onStopSpy?: () => void; disabled?: boolean }) {
  const [talking, setTalking] = useState(false);
  return (
    <PushToTalkButton
      talking={talking}
      disabled={disabled}
      onStart={() => { onStartSpy?.(); setTalking(true); }}
      onStop={() => { onStopSpy?.(); setTalking(false); }}
    />
  );
}

describe('PushToTalkButton', () => {
  it('starts on pointer down and stops on release', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    render(<Harness onStartSpy={onStart} onStopSpy={onStop} />);

    const button = screen.getByRole('button', { name: '按住说话' });
    fireEvent.pointerDown(button);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '松开结束说话' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.pointerUp(button);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '按住说话' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('stops when the pointer leaves or cancels mid-press', () => {
    const onStop = vi.fn();
    render(<Harness onStopSpy={onStop} />);

    const button = screen.getByRole('button', { name: '按住说话' });
    fireEvent.pointerDown(button);
    fireEvent.pointerLeave(button);
    expect(onStop).toHaveBeenCalled();

    fireEvent.pointerDown(button);
    fireEvent.pointerCancel(button);
    expect(onStop).toHaveBeenCalledTimes(2);
  });

  it('supports holding with Space and Enter keys', () => {
    render(<Harness />);

    const button = screen.getByRole('button', { name: '按住说话' });
    fireEvent.keyDown(button, { key: ' ' });
    expect(screen.getByRole('button', { name: '松开结束说话' })).toBeInTheDocument();
    // 按住期间的系统重复事件不应重复触发。
    fireEvent.keyDown(button, { key: ' ', repeat: true });
    fireEvent.keyUp(button, { key: ' ' });
    expect(screen.getByRole('button', { name: '按住说话' })).toBeInTheDocument();
  });

  it('ignores presses while disabled', () => {
    const onStart = vi.fn();
    render(<Harness onStartSpy={onStart} disabled />);

    const button = screen.getByRole('button', { name: '按住说话' });
    expect(button).toBeDisabled();
    fireEvent.pointerDown(button);
    expect(onStart).not.toHaveBeenCalled();
  });
});
