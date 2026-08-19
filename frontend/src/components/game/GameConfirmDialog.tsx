import React, { useEffect, useRef } from 'react';

interface GameConfirmDialogProps {
  kind: 'reset' | 'leave';
  onCancel: () => void;
  onConfirm: () => void;
}

const copy = {
  reset: {
    eyebrow: '牌局操作',
    title: '重新开始当前牌局？',
    description: '当前对局会立即结束，所有玩家将一起进入新牌局。此操作无法撤销。',
    confirm: '确认重开',
  },
  leave: {
    eyebrow: '离开房间',
    title: '确定要离开当前房间？',
    description: '你将退出当前牌局并返回登录页，当前操作无法撤销。',
    confirm: '确认离开',
  },
};
export const GameConfirmDialog: React.FC<GameConfirmDialogProps> = ({ kind, onCancel, onConfirm }) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const content = copy[kind];

  useEffect(() => {
    cancelRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onCancel]);

  return (
    <div className="game-modal game-confirm-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="game-action-panel game-confirm-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="game-confirm-title"
        aria-describedby="game-confirm-description"
        onClick={event => event.stopPropagation()}
      >
        <span className="game-action-eyebrow">{content.eyebrow}</span>
        <h2 id="game-confirm-title">{content.title}</h2>
        <p id="game-confirm-description">{content.description}</p>
        <div className="game-action-footer">
          <button ref={cancelRef} type="button" className="game-action-secondary" onClick={onCancel}>取消</button>
          <button type="button" className="game-action-danger" onClick={onConfirm}>{content.confirm}</button>
        </div>
      </section>
    </div>
  );
};
