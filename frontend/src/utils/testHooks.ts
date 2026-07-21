import { useGameStore } from '../stores/gameStore';
import { usePlayerStore } from '../stores/playerStore';
import { wsService } from '../services/websocket';
import { useRoomStore } from '../stores/roomStore';

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (milliseconds: number) => Promise<void>;
    simulate_network_drop?: () => void;
  }
}

/**
 * Lightweight browser-test observability. The payload intentionally excludes
 * credentials and private card identities from other players' hands.
 */
export function installGameTestHooks(): void {
  window.render_game_to_text = () => {
    const game = useGameStore.getState().gameState;
    const player = usePlayerStore.getState();
    const room = useRoomStore.getState();
    const currentPlayer = game?.players[game.current_player_index] ?? null;

    return JSON.stringify({
      interface: 'DOM card-game UI; interactions use labeled controls rather than coordinates',
      route: window.location.pathname,
      connection: {
        websocket_connected: wsService.isConnected(),
        authenticated_player_connected: player.isConnected,
        player_id: player.playerId,
        player_name: player.playerName,
        room_code: room.roomCode,
      },
      game: game
        ? {
            state: game.state,
            player_count: game.player_count,
            current_player_id: currentPlayer?.id ?? null,
            turn_count: game.turn_count,
            harmony_card_count: game.harmony_area.length,
            winner_id: game.winner,
            players: game.players.map((gamePlayer) => ({
              id: gamePlayer.id,
              name: gamePlayer.name,
              hand_count: gamePlayer.current_hand_count,
              field_card_count: gamePlayer.field_cards.length,
              doubt_card_count: gamePlayer.doubt_cards.length,
            })),
          }
        : null,
    });
  };

  window.advanceTime ??= (milliseconds: number) =>
    new Promise((resolve) => window.setTimeout(resolve, Math.max(0, milliseconds)));
  window.simulate_network_drop = () => wsService.simulateUnexpectedDisconnect();
}
