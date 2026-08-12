import React from 'react';
import { Card as CardView } from './Card';
import { Card, Player } from '../../types/game';

interface CentralZoneProps { players: Player[]; harmonyArea: Card[]; isGameOver: boolean; }

export const CentralZone: React.FC<CentralZoneProps> = ({ players, harmonyArea, isGameOver }) => (
  <section className="campus-panel p-4 sm:p-5" aria-label="桌面中央牌区">
    <div className="grid gap-4 lg:grid-cols-2">
      <div><h2 className="mb-2 text-base font-semibold text-slate-700">正面出牌</h2><div className="flex flex-wrap gap-2 items-end">
        {players.flatMap(p => (p.field_cards ?? []).map(c => <div key={c.id} className="flex flex-col items-center gap-0.5"><span className="text-xs text-slate-500">{p.name}</span><div className="w-16"><CardView card={c} showAsFaceDown={false} /></div></div>))}
        {players.every(p => !p.field_cards?.length) && <span className="text-slate-500 text-sm">暂无</span>}
      </div></div>
      <div><h2 className="mb-2 text-base font-semibold text-slate-700">调和区（背面朝上）</h2><div className="flex flex-wrap gap-2">
        {harmonyArea.length ? harmonyArea.map(card => <div key={card.id} className="w-14"><CardView card={card} showAsFaceDown /></div>) : <span className="text-slate-500 text-sm">调和区为空</span>}
      </div></div>
      <div className="lg:col-span-2"><div className="mb-2 text-sm text-slate-500">质疑牌（背面，结算时揭晓）</div><div className="flex flex-wrap gap-2 items-end">
        {players.flatMap(p => (p.doubt_cards ?? []).map(c => <div key={`${p.id}-${c.id}`} className="flex flex-col items-center gap-0.5"><span className="text-xs text-slate-500">→ {p.name}</span><div className="w-12"><CardView card={c} showAsFaceDown={!isGameOver} /></div></div>))}
        {players.every(p => !p.doubt_cards?.length) && <span className="text-slate-500 text-sm">暂无</span>}
      </div></div>
    </div>
  </section>
);
