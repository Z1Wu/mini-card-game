import React from 'react';
import { Card, CardUsageType, Player } from '../../types/game';
import { CentralZone } from './CentralZone';
import { PlayerHand } from './PlayerHand';
import { PlayerZone } from './PlayerZone';

interface GameTableProps { players: Player[]; localPlayer: Player; localPlayerId: string; currentPlayerIndex: number; harmonyArea: Card[]; isGameOver: boolean; selectedCard: Card | null; onSelectCard: (card: Card) => void; onPlayCard: (card: Card, usage: CardUsageType) => void; newsClubMyChosenCard: Card | null; }

/** Presentational tabletop: receives all data and actions explicitly, with no store or WebSocket subscriptions. */
export const GameTable: React.FC<GameTableProps> = (props) => {
  const opponents = props.players.filter(player => player.id !== props.localPlayerId);
  return <div className="game-table space-y-4"><section aria-label="其他玩家" className="overflow-x-auto"><div className="flex min-w-max gap-2 pb-2 lg:grid lg:min-w-0 lg:grid-cols-4">{opponents.map(player => <PlayerZone key={player.id} player={player} isCurrentTurn={props.players[props.currentPlayerIndex]?.id === player.id} />)}</div></section><CentralZone players={props.players} harmonyArea={props.harmonyArea} isGameOver={props.isGameOver} /><PlayerHand player={props.localPlayer} isCurrentTurn={props.players[props.currentPlayerIndex]?.id === props.localPlayerId} selectedCard={props.selectedCard} onSelect={props.onSelectCard} onPlay={props.onPlayCard} harmonyIsEmpty={!props.harmonyArea.length} newsClubMyChosenCard={props.newsClubMyChosenCard} /></div>;
};
