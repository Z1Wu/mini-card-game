import { create } from 'zustand';

interface PlayerState {
  playerId: string | null;
  playerName: string | null;
  username: string | null;
  password: string | null;
  isConnected: boolean;
  setPlayer: (id: string, name: string) => void;
  setUsername: (username: string) => void;
  setPassword: (password: string) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  playerId: null,
  playerName: null,
  username: null,
  password: null,
  isConnected: false,
  setPlayer: (id, name) => set({ playerId: id, playerName: name }),
  setUsername: (username) => set({ username }),
  setPassword: (password) => set({ password }),
  setConnected: (connected) => set({ isConnected: connected }),
  reset: () => set({ playerId: null, playerName: null, username: null, password: null, isConnected: false }),
}));
