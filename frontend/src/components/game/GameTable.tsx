import React from 'react';
import { Card, CardUsageType, Player, PublicAction } from '../../types/game';
import { usePlayPresentation } from './usePlayPresentation';
import { SkillPlayReveal } from './SkillPlayReveal';
import { Card as CardView } from './Card';
import { PlayActions } from './PlayActions';
import { PlayerHand } from './PlayerHand';
import { PlayerZone } from './PlayerZone';

interface GameTableProps {
  suppressLocalSkillReveal?: boolean;
  gameId?: string;
  publicActions?: PublicAction[];
  players: Player[];
  localPlayer: Player;
  localPlayerId: string;
  currentPlayerIndex: number;
  harmonyArea: Card[];
  requiredHarmonyValue: number;
  selectedCard: Card | null;
  onSelectCard: (card: Card | null) => void;
  onPlayCard: (card: Card, usage: CardUsageType) => void;
  newsClubMyChosenCard: Card | null;
  turnStatusText: string;
  /** 正在播放语音的玩家 id（Issue #131），无则 null。 */
  speakingPlayerId?: string | null;
}

/** Full-screen card-game table: owner-scoped public plays, central harmony target, local hand at bottom. */
export const GameTable: React.FC<GameTableProps> = (props) => {
  const presentation = usePlayPresentation(props.gameId ?? 'table', props.publicActions ?? [], props.players, props.suppressLocalSkillReveal ? props.localPlayerId : undefined);
  const opponents = presentation.players.filter(p => p.id !== props.localPlayerId);
  const localPlayer = presentation.players.find(player => player.id === props.localPlayerId) ?? props.localPlayer;
  const isMyTurn = props.players[props.currentPlayerIndex]?.id === props.localPlayerId;
  const harmonyCount = props.harmonyArea.length;


  return (
    <div className="game-table">
      {/* ── Oval felt + table rim ── */}
      <div className="table-felt" aria-hidden="true" />

      {/* ── Opponents arranged around the table ── */}
      <div className={`table-seats opponents-${opponents.length}`} role="list" aria-label="其他玩家">
        {opponents.map(player => (
          <PlayerZone
            key={player.id}
            player={player}
            isCurrentTurn={props.players[props.currentPlayerIndex]?.id === player.id}
            isSpeaking={props.speakingPlayerId === player.id}
          />
        ))}
      </div>

      {/* ── Center play area ── */}
      <div className="table-center">
        <div className="table-center-inner">
          <section className="table-objective" aria-label={`调和目标 ${props.requiredHarmonyValue}，已投入 ${harmonyCount} 张，当前总值未知`}>
            <div className="table-objective-seal" aria-hidden="true">和</div>
            <div className="table-objective-copy">
              <span className="table-objective-kicker">调和仪式</span>
              <div className="table-objective-summary">
                <span>目标 <strong>{props.requiredHarmonyValue}</strong></span>
                <i aria-hidden="true" />
                <span>已投入 <strong>{harmonyCount}</strong> 张</span>
                <i aria-hidden="true" />
                <span className="table-objective-unknown">当前总值未知</span>
              </div>
            </div>
            <div className="table-objective-cards" aria-label={`调和区 ${harmonyCount} 张牌`}>
              {props.harmonyArea.length > 0 ? props.harmonyArea.map(card => (
                <div key={card.id} className="table-objective-card">
                  <CardView card={card} showAsFaceDown />
                </div>
              )) : <span className="table-objective-empty">等待投入</span>}
            </div>
          </section>
          <div className="table-center-controls">
          <div className="table-objective-doubt" aria-label={`被质疑数 ${localPlayer.doubt_cards?.length ?? 0}`}>
            被质疑数 <strong>{localPlayer.doubt_cards?.length ?? 0}</strong>
          </div>
          <PlayActions selectedCard={props.selectedCard} isCurrentTurn={isMyTurn} handCount={localPlayer.current_hand_count} harmonyIsEmpty={!props.harmonyArea.length} onPlay={props.onPlayCard} onSelect={props.onSelectCard} />
          </div>

        </div>
      </div>

      {/* ── Player hand (fixed bottom) ── */}
      <PlayerHand
        player={localPlayer}
        isCurrentTurn={isMyTurn}
        selectedCard={props.selectedCard}
        onSelect={props.onSelectCard}
        harmonyIsEmpty={!props.harmonyArea.length}
        newsClubMyChosenCard={props.newsClubMyChosenCard}
        turnStatusText={props.turnStatusText}
      />
      {presentation.active && <SkillPlayReveal key={presentation.active.sequence} play={presentation.active} />}
    </div>
  );
};
