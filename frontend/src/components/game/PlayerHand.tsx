import React from 'react';
import { Card as CardView } from './Card';
import { Card, CardType, CardUsageType, Player } from '../../types/game';

interface PlayerHandProps { player: Player; isCurrentTurn: boolean; selectedCard: Card | null; onSelect: (card: Card) => void; onPlay: (card: Card, usage: CardUsageType) => void; harmonyIsEmpty: boolean; newsClubMyChosenCard: Card | null; }

export const PlayerHand: React.FC<PlayerHandProps> = ({ player, isCurrentTurn, selectedCard, onSelect, onPlay, harmonyIsEmpty, newsClubMyChosenCard }) => (
  <section className={`rounded-xl border-2 p-4 ${player.current_hand_count === 1 ? 'border-red-500 bg-slate-800' : isCurrentTurn ? 'border-primary-500 bg-slate-800 ring-2 ring-primary-400' : 'border-slate-700 bg-slate-800'}`} aria-label="我的手牌">
    <div className="mb-3 flex flex-wrap justify-between gap-2"><h2 className="text-lg font-semibold text-slate-300">我的卡牌 {isCurrentTurn && <span className="text-primary-400">▶ 当前回合</span>}</h2><span className="text-slate-400">手牌: {player.hand.length} · 质疑: {player.doubt_cards?.length ?? 0}</span></div>
    {newsClubMyChosenCard && <div className="mb-2 flex items-center gap-2 text-sm text-sky-300"><span>新闻部：我选的牌</span><div className="w-12"><CardView card={newsClubMyChosenCard} showAsFaceDown={false} /></div></div>}
    <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
      {player.hand.map(card => <div key={card.id} className="w-28 shrink-0 snap-start sm:w-32"><CardView card={card} isPlayable={isCurrentTurn && card.name !== CardType.CRIMINAL && player.hand.length > 1} isSelected={selectedCard?.id === card.id} onClick={() => onSelect(card)} showActions={selectedCard?.id === card.id && isCurrentTurn && card.name !== CardType.CRIMINAL} onPlay={onPlay} disabledSkill={card.name === CardType.HOME_CLUB && harmonyIsEmpty} /></div>)}
    </div>
  </section>
);
