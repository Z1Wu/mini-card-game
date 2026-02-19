import { create } from 'zustand';
import { Game, Player, Card } from '../types/game';

type SetGameStateArg = Game | null | ((prev: Game | null) => Game | null);

interface GameStore {
  gameState: Game | null;
  setGameState: (state: SetGameStateArg) => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  addCardToHarmony: (card: Card) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  setGameState: (stateOrUpdater) =>
    set((s) => ({
      gameState: typeof stateOrUpdater === 'function' ? stateOrUpdater(s.gameState) : stateOrUpdater,
    })),
  updatePlayer: (playerId, updates) =>
    set((state) => ({
      gameState: state.gameState
        ? {
            ...state.gameState,
            players: state.gameState.players.map((player) =>
              player.id === playerId ? { ...player, ...updates } : player
            ),
          }
        : null,
    })),
  addCardToHarmony: (card) =>
    set((state) => ({
      gameState: state.gameState
        ? {
            ...state.gameState,
            harmony_area: [...state.gameState.harmony_area, card],
          }
        : null,
    })),
  resetGame: () => set({ gameState: null }),
}));
