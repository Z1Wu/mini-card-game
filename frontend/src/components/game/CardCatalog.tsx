import { useEffect, useRef } from 'react';
import { Card as CardModel } from '../../types/game';
import { Card } from './Card';
import catalog from './cardCatalog.json';
import { cleanVictoryCondition } from './cardDecision';

/** Static public rules, independent of all room/player hands. */
export function CardCatalog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const onClose = () => trigger.current?.focus();
    element?.addEventListener('close', onClose);
    return () => element?.removeEventListener('close', onClose);
  }, []);
  return <>
    <button ref={trigger} type="button" className="game-records-trigger" onClick={() => dialog.current?.showModal()}>卡牌图鉴</button>
    <dialog ref={dialog} className="card-catalog" aria-label="卡牌图鉴">
      <header><h2>卡牌图鉴</h2><button type="button" onClick={() => dialog.current?.close()} aria-label="关闭卡牌图鉴">×</button></header>
      <div className="card-catalog-grid">{(catalog as CardModel[]).map(card => <article key={card.id}>
        <div className="card-catalog-art"><Card card={card} /></div>
        <div><h3>{card.name}</h3><p className="card-catalog-stats">调和 {card.harmony_value} · 优先级 {card.victory_priority}</p>
          <h4>特技与效果</h4><p>{card.description}</p><h4>胜利条件</h4><p>{cleanVictoryCondition(card.victory_condition)}</p></div>
      </article>)}</div>
    </dialog>
  </>;
}
