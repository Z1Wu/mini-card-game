import React, { useEffect, useRef } from 'react';

interface GameMenuProps {
  open: boolean;
  isHost: boolean;
  actionCount: number;
  onToggle: () => void;
  onClose: () => void;
  onShowHistory: () => void;
  onRequestReset: () => void;
  onRequestLeave: () => void;
}

export const GameMenu: React.FC<GameMenuProps> = ({
  open,
  isHost,
  actionCount,
  onToggle,
  onClose,
  onShowHistory,
  onRequestReset,
  onRequestLeave,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [open, onClose]);

  return (
    <div className="game-menu" ref={menuRef}>
      <button
        type="button"
        className="game-menu-trigger"
        onClick={onToggle}
        aria-label="打开牌桌菜单"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span aria-hidden="true">•••</span>
      </button>
      {open && (
        <div className="game-menu-panel" role="menu" aria-label="牌桌菜单">
          <button type="button" role="menuitem" onClick={onShowHistory}>
            <span>行动记录</span><b>{actionCount}</b>
          </button>
          <div className="game-menu-divider" />
          <button
            type="button"
            role="menuitem"
            disabled={!isHost}
            title={isHost ? undefined : '只有房主可以重新开始'}
            onClick={onRequestReset}
          >
            <span>重新开始</span>{!isHost && <small>仅房主</small>}
          </button>
          <button type="button" role="menuitem" className="game-menu-danger" onClick={onRequestLeave}>
            <span>离开房间</span>
          </button>
        </div>
      )}
    </div>
  );
};
