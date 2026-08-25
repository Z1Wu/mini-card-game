import React, { useCallback } from 'react';

interface PushToTalkButtonProps {
  /** 正在录音（按住中）。 */
  talking: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
}

/** 按住说话按钮（Issue #131）：指针按住开始、松开结束；键盘可用 Space/Enter。 */
export const PushToTalkButton: React.FC<PushToTalkButtonProps> = ({
  talking,
  disabled = false,
  onStart,
  onStop,
}) => {
  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    // 阻止长按弹出系统菜单/选中文字。
    event.preventDefault();
    if (!disabled) onStart();
  }, [disabled, onStart]);

  const handlePointerEnd = useCallback(() => {
    if (talking) onStop();
  }, [talking, onStop]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.repeat) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!disabled) onStart();
    }
  }, [disabled, onStart]);

  const handleKeyUp = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === ' ' || event.key === 'Enter') && talking) {
      event.preventDefault();
      onStop();
    }
  }, [talking, onStop]);

  return (
    <button
      type="button"
      className={`voice-ptt${talking ? ' voice-ptt-talking' : ''}`}
      aria-pressed={talking}
      aria-label={talking ? '松开结束说话' : '按住说话'}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onContextMenu={event => event.preventDefault()}
    >
      <span className="voice-ptt-icon" aria-hidden="true">🎙️</span>
      <span className="voice-ptt-label">{talking ? '松开结束' : '按住说话'}</span>
    </button>
  );
};
