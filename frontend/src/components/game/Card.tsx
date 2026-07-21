import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Card as CardModel, CardType as RoleType, CardUsageType } from '../../types/game';
import { cn } from '../../utils/helpers';

interface CardProps {
  card: CardModel;
  onPlay?: (card: CardModel, usageType: CardUsageType, targetPlayerId?: string) => void;
  isPlayable?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  showActions?: boolean;
  /** 背面显示（调和区、质疑牌等）：不展示牌面，仅牌背；质疑牌在胜利阶段前不显示点数 */
  showAsFaceDown?: boolean;
  /** 禁用特技（如归宅部在调和区为空时） */
  disabledSkill?: boolean;
  /** 结算页等场景不显示胜利优先级，仅显示名称与调和值 */
  showVictoryPriority?: boolean;
}

const roleVisuals: Record<RoleType, { mark: string; tone: string; accent: string; glow: string }> = {
  [RoleType.CLASS_REP]: { mark: '班', tone: '#f59e0b', accent: '#fff7ed', glow: 'rgba(245, 158, 11, 0.28)' },
  [RoleType.LIBRARY_COMMITTEE]: { mark: '书', tone: '#14b8a6', accent: '#ecfeff', glow: 'rgba(20, 184, 166, 0.25)' },
  [RoleType.ALIEN]: { mark: '外', tone: '#8b5cf6', accent: '#f5f3ff', glow: 'rgba(139, 92, 246, 0.28)' },
  [RoleType.HOME_CLUB]: { mark: '宅', tone: '#64748b', accent: '#f8fafc', glow: 'rgba(100, 116, 139, 0.24)' },
  [RoleType.HEALTH_COMMITTEE]: { mark: '健', tone: '#22c55e', accent: '#f0fdf4', glow: 'rgba(34, 197, 94, 0.25)' },
  [RoleType.DISCIPLINE_COMMITTEE]: { mark: '纪', tone: '#0ea5e9', accent: '#f0f9ff', glow: 'rgba(14, 165, 233, 0.25)' },
  [RoleType.NEWS_CLUB]: { mark: '闻', tone: '#06b6d4', accent: '#ecfeff', glow: 'rgba(6, 182, 212, 0.24)' },
  [RoleType.RICH_GIRL]: { mark: '大', tone: '#ec4899', accent: '#fdf2f8', glow: 'rgba(236, 72, 153, 0.24)' },
  [RoleType.ACCOMPLICE]: { mark: '共', tone: '#a855f7', accent: '#faf5ff', glow: 'rgba(168, 85, 247, 0.24)' },
  [RoleType.INFECTED]: { mark: '染', tone: '#84cc16', accent: '#f7fee7', glow: 'rgba(132, 204, 22, 0.22)' },
  [RoleType.CRIMINAL]: { mark: '犯', tone: '#ef4444', accent: '#fef2f2', glow: 'rgba(239, 68, 68, 0.28)' },
  [RoleType.STUDENT_COUNCIL_PRESIDENT]: { mark: '会', tone: '#eab308', accent: '#fefce8', glow: 'rgba(234, 179, 8, 0.28)' },
  [RoleType.HONOR_STUDENT]: { mark: '优', tone: '#38bdf8', accent: '#f0f9ff', glow: 'rgba(56, 189, 248, 0.25)' },
};

export const Card: React.FC<CardProps> = ({
  card,
  onPlay,
  isPlayable = false,
  isSelected = false,
  onClick,
  showActions = false,
  showAsFaceDown = false,
  disabledSkill = false,
  showVictoryPriority = true,
}) => {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDescriptionPopover, setShowDescriptionPopover] = useState(false);
  const visual = roleVisuals[card.name] ?? roleVisuals[RoleType.HOME_CLUB];
  const cardStyle = {
    '--card-tone': visual.tone,
    '--card-accent': visual.accent,
    '--card-glow': visual.glow,
  } as React.CSSProperties;

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleLongPressStart = () => {
    if (showAsFaceDown) return;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      setShowDescriptionPopover(true);
    }, 500);
  };

  const handleLongPressEnd = () => {
    clearLongPress();
  };

  if (showAsFaceDown) {
    return (
      <div
        className={cn(
          'game-card game-card-back relative aspect-[2/3] min-h-0 w-full overflow-hidden rounded-xl',
          'shadow-lg transition-all duration-200'
        )}
        aria-label="牌背"
      >
        <div className="game-card-back-mark">秘</div>
        <span className="game-card-back-label">牌背</span>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          'game-card group relative aspect-[2/3] w-full overflow-hidden rounded-xl p-1.5 shadow-xl transition-all duration-200',
          { 'ring-2 ring-primary-500': isSelected },
          { 'cursor-pointer': onClick || isPlayable },
          { 'opacity-75 grayscale-[0.25]': !isPlayable && onClick }
        )}
        aria-label={`卡牌：${card.name}`}
        style={cardStyle}
        onClick={onClick}
        onMouseDown={handleLongPressStart}
        onMouseLeave={handleLongPressEnd}
        onMouseUp={handleLongPressEnd}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
      >
        <div className="game-card-face">
          <div className="game-card-corner game-card-corner-left" title="调和值">
            <span className="game-card-corner-value">{card.harmony_value}</span>
            <span className="game-card-corner-label">调和</span>
          </div>
          {showVictoryPriority && (
            <div className="game-card-corner game-card-corner-right" title="胜利优先级">
              <span className="game-card-corner-value">{card.victory_priority}</span>
              <span className="game-card-corner-label">优先</span>
            </div>
          )}

          <div className="game-card-emblem" aria-hidden="true">{visual.mark}</div>

          <div className="game-card-title-wrap">
            <div className="game-card-ribbon" />
            <span className="game-card-title" title={card.name}>{card.name}</span>
          </div>

          <div className="game-card-footer">
            <span className="game-card-hint">长按查看技能</span>
            {showVictoryPriority && (
              <span className="game-card-priority">胜利 {card.victory_priority}</span>
            )}
          </div>
        </div>

      {showActions && onPlay && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-slate-950/95 rounded-b-xl p-1.5 flex gap-1 shadow-[0_-10px_24px_rgba(15,23,42,0.28)]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(card, CardUsageType.HARMONY);
            }}
            className="flex-1 text-[10px] bg-primary-600 hover:bg-primary-700 text-white py-0.5 px-1.5 rounded transition-colors"
          >
            调和
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(card, CardUsageType.DOUBT);
            }}
            className="flex-1 text-[10px] bg-accent-600 hover:bg-accent-700 text-white py-0.5 px-1.5 rounded transition-colors"
          >
            质疑
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!disabledSkill) onPlay(card, CardUsageType.SKILL);
            }}
            disabled={disabledSkill}
            title={disabledSkill ? "调和区为空时无法使用该特技" : undefined}
            className={cn(
              "flex-1 text-[10px] py-0.5 px-1.5 rounded transition-colors",
              disabledSkill ? "bg-slate-700 text-slate-500 cursor-not-allowed" : "bg-slate-600 hover:bg-slate-700 text-white"
            )}
          >
            特技{disabledSkill ? "（不可用）" : ""}
          </button>
        </div>
      )}
      </div>
      {showDescriptionPopover && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100]"
          onClick={() => setShowDescriptionPopover(false)}
          role="presentation"
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-600 p-4 rounded-t-xl shadow-2xl max-h-[40vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-slate-300 mb-2">{card.description}</p>
            <p className="text-xs text-slate-400 mb-2">
              <span className="text-accent-400">调和值 {card.harmony_value}</span>（放入调和区时计入总和）
              · <span className="text-slate-400">胜利优先级 {card.victory_priority}</span>（结算时比较）
            </p>
            <button
              type="button"
              className="text-xs text-primary-400 hover:underline"
              onClick={() => setShowDescriptionPopover(false)}
            >
              关闭
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
