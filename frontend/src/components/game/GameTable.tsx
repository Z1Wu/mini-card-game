import React from 'react';
import { Card, CardUsageType, Player } from '../../types/game';
import { Card as CardView } from './Card';
import { PlayerHand } from './PlayerHand';
import { PlayerZone } from './PlayerZone';

interface GameTableProps {
  players: Player[];
  localPlayer: Player;
  localPlayerId: string;
  currentPlayerIndex: number;
  harmonyArea: Card[];
  isGameOver: boolean;
  selectedCard: Card | null;
  onSelectCard: (card: Card) => void;
  onPlayCard: (card: Card, usage: CardUsageType) => void;
  newsClubMyChosenCard: Card | null;
}

/** Full-screen card-game table: opponents at top, play area in center, hand fixed at bottom. */
export const GameTable: React.FC<GameTableProps> = (props) => {
  const opponents = props.players.filter(p => p.id !== props.localPlayerId);
  const isMyTurn = props.players[props.currentPlayerIndex]?.id === props.localPlayerId;

  const allFieldCards = props.players.flatMap(p =>
    (p.field_cards ?? []).map(c => ({ player: p, card: c }))
  );

  return (
    <div className="game-table">
      {/* ── Opponents ── */}
      <div className="table-opponents">
        {opponents.map(player => (
          <PlayerZone
            key={player.id}
            player={player}
            isCurrentTurn={props.players[props.currentPlayerIndex]?.id === player.id}
          />
        ))}
      </div>

      {/* ── Center play area ── */}
      <div className="table-center">
        {/* Face-up field cards */}
        <div className="table-field">
          {allFieldCards.length > 0 ? (
            allFieldCards.map(({ player, card }) => (
              <div key={card.id} className="table-field-item">
                <span className="table-field-label">{player.name}</span>
                <div className="w-14 sm:w-16">
                  <CardView card={card} showAsFaceDown={false} />
                </div>
              </div>
            ))
          ) : (
            <span className="table-zone-empty">出牌区暂无卡牌</span>
          )}
        </div>

        {/* Harmony + Doubt zones */}
        <div className="table-zones">
          <div className="table-zone">
            <h3 className="table-zone-title">调和区 ({props.harmonyArea.length})</h3>
            <div className="table-zone-cards">
              {props.harmonyArea.length > 0 ? (
                props.harmonyArea.map(card => (
                  <div key={card.id} className="w-10 sm:w-12">
                    <CardView card={card} showAsFaceDown />
                  </div>
                ))
              ) : (
                <span className="table-zone-empty">空</span>
              )}
            </div>
          </div>

          <div className="table-zone">
            <h3 className="table-zone-title">质疑牌</h3>
            <div className="table-zone-cards">
              {props.players.flatMap(p =>
                (p.doubt_cards ?? []).map(c => (
                  <div key={`${p.id}-${c.id}`} className="table-doubt-item">
                    <span className="table-doubt-label">{p.name}</span>
                    <div className="w-9 sm:w-10">
                      <CardView card={c} showAsFaceDown={!props.isGameOver} />
                    </div>
                  </div>
                ))
              )}
              {props.players.every(p => !p.doubt_cards?.length) && (
                <span className="table-zone-empty">暂无</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Player hand (fixed bottom) ── */}
      <PlayerHand
        player={props.localPlayer}
        isCurrentTurn={isMyTurn}
        selectedCard={props.selectedCard}
        onSelect={props.onSelectCard}
        onPlay={props.onPlayCard}
        harmonyIsEmpty={!props.harmonyArea.length}
        newsClubMyChosenCard={props.newsClubMyChosenCard}
      />
    </div>
  );
};
