import React from 'react';
import { Card as CardType, CardUsageType } from '../../types/game';
import { cn } from '../../utils/helpers';

interface CardProps {
  card: CardType;
  onPlay?: (card: CardType, usageType: CardUsageType, targetPlayerId?: string) => void;
  isPlayable?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  showActions?: boolean;
  /** 背面显示（调和区等）：不展示牌面信息，仅显示牌背，顺序保留 */
  showAsFaceDown?: boolean;
  /** 禁用特技（如归宅部在调和区为空时） */
  disabledSkill?: boolean;
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
}) => {
  if (showAsFaceDown) {
    return (
      <div
        className={cn(
          'relative rounded-lg shadow-lg transition-all duration-200 border-2 border-slate-600',
          'bg-gradient-to-br from-slate-600 to-slate-700 aspect-[2/3] min-h-[100px] flex items-center justify-center'
        )}
      >
        <span className="text-slate-500 text-xs">牌背</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-3 shadow-lg transition-all duration-200',
        'border-2 border-slate-700 hover:border-primary-500',
        { 'ring-2 ring-primary-500': isSelected },
        { 'cursor-pointer': onClick || isPlayable },
        { 'opacity-50': !isPlayable && !onClick }
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-bold text-white">{card.name}</span>
        <span className="text-xs font-bold text-primary-400">{card.cost}</span>
      </div>
      
      <div className="mb-2">
        <p className="text-xs text-slate-300 line-clamp-3">{card.description}</p>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-xs text-accent-400">调和: {card.harmony_value}</span>
        <span className="text-xs text-slate-400">优先: {card.victory_priority}</span>
      </div>

      {showActions && onPlay && (
        <div className="absolute bottom-0 left-0 right-0 bg-slate-900/95 rounded-b-lg p-2 flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(card, CardUsageType.HARMONY);
            }}
            className="flex-1 text-xs bg-primary-600 hover:bg-primary-700 text-white py-1 px-2 rounded transition-colors"
          >
            调和
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(card, CardUsageType.DOUBT);
            }}
            className="flex-1 text-xs bg-accent-600 hover:bg-accent-700 text-white py-1 px-2 rounded transition-colors"
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
              "flex-1 text-xs py-1 px-2 rounded transition-colors",
              disabledSkill ? "bg-slate-700 text-slate-500 cursor-not-allowed" : "bg-slate-600 hover:bg-slate-700 text-white"
            )}
          >
            特技{disabledSkill ? "（不可用）" : ""}
          </button>
        </div>
      )}
    </div>
  );
};
