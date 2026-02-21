import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Card as CardType, CardUsageType } from '../../types/game';
import { cn } from '../../utils/helpers';

interface CardProps {
  card: CardType;
  onPlay?: (card: CardType, usageType: CardUsageType, targetPlayerId?: string) => void;
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
          'relative rounded-lg shadow-lg transition-all duration-200 border-2 border-slate-600',
          'bg-gradient-to-br from-slate-600 to-slate-700 aspect-[2/3] min-h-0 flex items-center justify-center w-full'
        )}
      >
        <span className="text-slate-500 text-[10px]">牌背</span>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          'relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-2 shadow-lg transition-all duration-200',
          'border-2 border-slate-700 hover:border-primary-500',
          { 'ring-2 ring-primary-500': isSelected },
          { 'cursor-pointer': onClick || isPlayable },
          { 'opacity-50': !isPlayable && !onClick }
        )}
        onClick={onClick}
        onMouseDown={handleLongPressStart}
        onMouseLeave={handleLongPressEnd}
        onMouseUp={handleLongPressEnd}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
      >
        <div className="flex items-center justify-between gap-1.5 min-h-0">
          <span className={cn("font-bold text-white truncate leading-tight", showVictoryPriority ? "text-[11px]" : "text-xs")} title={card.name}>{card.name}</span>
          <span className="flex items-center gap-1 flex-shrink-0">
            <span className={cn("font-semibold text-accent-400", showVictoryPriority ? "text-[11px]" : "text-xs")} title="调和值">{card.harmony_value}</span>
            {showVictoryPriority && (
              <>
                <span className="text-slate-500 text-[10px]">/</span>
                <span className="text-[11px] font-semibold text-slate-400" title="胜利优先级">{card.victory_priority}</span>
              </>
            )}
          </span>
        </div>
        <p className="text-[9px] text-slate-500 leading-tight mt-0.5">长按查看</p>

      {showActions && onPlay && (
        <div className="absolute bottom-0 left-0 right-0 bg-slate-900/95 rounded-b-lg p-1.5 flex gap-1">
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
