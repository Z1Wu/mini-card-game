import React, { useState } from 'react';
import { CardUsageType, PublicAction } from '../../types/game';

const actionCopy = (action: PublicAction) => {
  if (action.usage_type === CardUsageType.HARMONY) return '向调和区秘密投入一张牌';
  if (action.usage_type === CardUsageType.DOUBT) {
    return `向 ${action.target_player_name ?? '一名玩家'} 放置一张质疑牌`;
  }
  return `发动 ${action.card_name ?? '一项特技'}${action.target_player_name ? `，目标为 ${action.target_player_name}` : ''}`;
};

interface ActionHistoryProps {
  actions: PublicAction[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideToggle?: boolean;
}

export const ActionHistory: React.FC<ActionHistoryProps> = ({ actions, open: controlledOpen, onOpenChange, hideToggle = false }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };
  const recent = [...actions].reverse();
  return (
    <aside className={`action-history${open ? ' action-history-open' : ''}`} aria-label="公开行动记录">
      {!hideToggle && <button
        type="button"
        className="action-history-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span aria-hidden="true">☷</span>
        行动记录
        <b>{actions.length}</b>
      </button>}
      {open && (
        <div className="action-history-panel">
          <div className="action-history-heading">
            <div><strong>公开行动</strong><span>不显示隐藏牌面</span></div>
            {hideToggle && <button type="button" onClick={() => setOpen(false)} aria-label="关闭行动记录">×</button>}
          </div>
          {recent.length ? (
            <ol>
              {recent.map(action => (
                <li key={action.sequence} className={`action-history-${action.usage_type}`}>
                  <span>#{action.sequence}</span>
                  <p><b>{action.actor_name}</b>{actionCopy(action)}</p>
                </li>
              ))}
            </ol>
          ) : <p className="action-history-empty">尚无公开行动</p>}
        </div>
      )}
    </aside>
  );
};
