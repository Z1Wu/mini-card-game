import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../common/Button';
import { Game } from '../../types/game';
import { SettlementSummary } from '../../types/message';
import { Card } from './Card';

interface SettlementViewProps {
  gameState: Game;
  winnerId: string | null;
  settlementSummary: SettlementSummary | null;
  isHost: boolean;
  onRematch: () => void;
  onReturnToLogin: () => void;
}

const stageTitles = ['调和揭晓', '质疑揭晓', '最终身份揭晓', '胜者揭晓'];
const revealStyle = (index: number) => ({ '--reveal-index': index } as React.CSSProperties);

/** Presents the server-authoritative settlement in small, keyboard-navigable stages. */
export const SettlementView: React.FC<SettlementViewProps> = ({
  gameState, winnerId, settlementSummary, isHost, onRematch, onReturnToLogin,
}) => {
  const [stage, setStage] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const settlementKey = JSON.stringify({ gameId: gameState.id, winnerId, settlementSummary });

  useEffect(() => {
    setStage(0);
    setShowDetails(false);
  }, [settlementKey]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [stage]);

  const harmonyTotal = settlementSummary?.harmony_total ?? gameState.harmony_area.reduce((sum, card) => sum + card.harmony_value, 0);
  const requiredHarmony = settlementSummary?.required_harmony_value ?? gameState.required_harmony_value ?? 0;
  const harmonyReached = settlementSummary?.harmony_reached ?? harmonyTotal >= requiredHarmony;
  const doubtTotals = settlementSummary?.player_doubt_totals ?? Object.fromEntries(
    gameState.players.map((player) => [player.id, player.doubt_cards.reduce((sum, card) => sum + card.harmony_value, 0)]),
  );
  const imprisonedIds = settlementSummary?.imprisoned_player_ids ?? [];
  const roleConditionResults = settlementSummary?.role_condition_results;
  const imprisonedPlayers = gameState.players.filter((player) => imprisonedIds.includes(player.id));
  const winner = winnerId ? gameState.players.find((player) => player.id === winnerId) : undefined;
  const suppliedWinnerReason = settlementSummary?.winner_reason;
  const winnerReason = suppliedWinnerReason?.player_id === winner?.id ? suppliedWinnerReason : null;
  const winnerCard = winnerReason
    ? winner?.hand.find((card) => card.id === winnerReason.card_id)
    : undefined;
  const playersByPriority = useMemo(() => [...gameState.players].sort((a, b) => {
    const aPriority = Math.min(...a.hand.map((card) => card.victory_priority), Infinity);
    const bPriority = Math.min(...b.hand.map((card) => card.victory_priority), Infinity);
    return aPriority - bPriority;
  }), [gameState.players]);

  const changeStage = (next: number) => setStage(Math.max(0, Math.min(stageTitles.length - 1, next)));

  const stageContent = [
    <section key="harmony" className="settlement-result settlement-reveal-stage" aria-label="调和结算">
      <p className="settlement-lead">调和区合计 <strong>{harmonyTotal}</strong>，目标值 <strong>{requiredHarmony}</strong></p>
      <p className={harmonyReached ? 'settlement-success' : 'settlement-failure'}>{harmonyReached ? '调和达成' : '调和未达成'}</p>
      <div className="settlement-cards" aria-label="调和区卡牌">
        {gameState.harmony_area.length ? gameState.harmony_area.map((card, index) => <div className="settlement-card settlement-reveal-item" style={revealStyle(index)} key={card.id}><Card card={card} /></div>) : <span>调和区没有卡牌</span>}
      </div>
    </section>,
    <section key="doubt" className="settlement-result settlement-reveal-stage" aria-label="质疑结算">
      <p className="settlement-lead">每位玩家的质疑总和</p>
      <div className="settlement-player-list">
        {gameState.players.map((player, index) => <div key={player.id} style={revealStyle(index)} className={`${imprisonedIds.includes(player.id) ? 'settlement-player imprisoned' : 'settlement-player'} settlement-reveal-item`}>
          <span>{player.name}</span><strong>{doubtTotals[player.id] ?? 0}</strong>{imprisonedIds.includes(player.id) && <span>被监禁</span>}
        </div>)}
      </div>
      <p className="settlement-summary">{imprisonedPlayers.length ? `被监禁：${imprisonedPlayers.map((player) => player.name).join('、')}${imprisonedPlayers.length > 1 ? '（并列）' : ''}` : '无人被监禁'}</p>
    </section>,
    <section key="roles" className="settlement-result settlement-reveal-stage" aria-label="最终身份结算">
      <p className="settlement-lead">按胜利优先级公开最终手牌</p>
      <div className="settlement-role-list">
        {playersByPriority.map((player, index) => {
          const hand = player.hand ?? [];
          return <div className="settlement-role settlement-reveal-item" style={revealStyle(index)} key={player.id}>
            <strong>{player.name}</strong>
            <div className="settlement-cards">{hand.length ? hand.map((card) => {
              const conditionMet = roleConditionResults?.[card.id];
              const conditionCopy = conditionMet === undefined
                ? '服务器未提供此角色的条件结果'
                : conditionMet ? '胜利条件达成' : '胜利条件未达成';
              return <div className="settlement-card settlement-role-card" key={card.id}>
                <Card card={card} showVictoryPriority />
                <p>{card.victory_condition}</p>
                <p className={conditionMet ? 'settlement-success' : conditionMet === false ? 'settlement-failure' : undefined}>{conditionCopy}</p>
              </div>;
            }) : <span>没有可公开的最终手牌</span>}</div>
          </div>;
        })}
      </div>
    </section>,
    <section key="winner" className="settlement-result settlement-winner settlement-reveal-stage" aria-label="胜者结算">
      <div className="settlement-winner-burst" aria-hidden="true" />
      <p className="settlement-winner-kicker">WINNER</p>
      <p className="settlement-lead settlement-winner-name">{winner ? `${winner.name} 获胜！` : '本局没有可确认的胜者'}</p>
      {winnerReason && <div className="settlement-winner-reason settlement-reveal-item" style={revealStyle(1)}>
        {winnerCard && <div className="settlement-winner-card"><Card card={winnerCard} showVictoryPriority /></div>}
        <div>
          <p>获胜角色 <strong>{winnerReason.card_name}</strong></p>
          <p>胜利条件 <strong>{winnerReason.victory_condition.replace(/^\d+\s*/, '')}</strong></p>
          <p className="settlement-priority-explanation">服务器按优先级 1 → 5 判定；该角色以优先级 {winnerReason.victory_priority} 满足条件，成为首个有效胜者。</p>
        </div>
      </div>}
      {winner && !winnerReason && <p className="settlement-missing-reason">服务器未提供完整胜因说明。</p>}
      {!winner && <p>结算资料未提供可匹配的胜者，未显示推测结果。</p>}
      <Button onClick={() => setShowDetails((visible) => !visible)} variant="secondary">{showDetails ? '收起完整结算' : '查看完整结算'}</Button>
      {showDetails && <div className="settlement-details" aria-label="完整结算">
        <p>调和：{harmonyTotal} / {requiredHarmony}（{harmonyReached ? '达成' : '未达成'}）</p>
        <p>监禁：{imprisonedPlayers.length ? imprisonedPlayers.map((player) => player.name).join('、') : '无人'}</p>
        <p>胜者：{winner ? winner.name : '无'}</p>
      </div>}
      <div className="settlement-actions">
        <Button onClick={onRematch} variant="secondary" disabled={!isHost}>{isHost ? '重新开始一局' : '等待房主重新开始'}</Button>
        <Button onClick={onReturnToLogin} variant="primary">返回登录</Button>
      </div>
    </section>,
  ];

  return <main className="settlement-view">
    <div className="settlement-shell">
      <p className="settlement-progress" aria-live="polite">第 {stage + 1} / {stageTitles.length} 阶段：{stageTitles[stage]}</p>
      <div className="settlement-stage-track" aria-hidden="true">
        {stageTitles.map((title, index) => <span key={title} className={index <= stage ? 'is-reached' : ''}>{index + 1}</span>)}
      </div>
      <h1 className="settlement-heading" tabIndex={-1} ref={headingRef}>{stageTitles[stage]}</h1>
      {stageContent[stage]}
      <nav className="settlement-navigation" aria-label="结算阶段导航">
        <Button onClick={() => changeStage(stage - 1)} variant="secondary" disabled={stage === 0}>上一步</Button>
        {stage < stageTitles.length - 1 && <Button onClick={() => changeStage(stage + 1)} variant="primary">下一步</Button>}
      </nav>
    </div>
  </main>;
};
