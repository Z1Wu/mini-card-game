import { create } from 'zustand';

interface PlayerState {
  playerId: string | null;
  playerName: string | null;
  username: string | null;
  password: string | null;
  roomCode: string;
  reconnectToken: string | null;
  isConnected: boolean;
  setPlayer: (id: string, name: string) => void;
  setUsername: (username: string) => void;
  setPassword: (password: string) => void;
  setRoomCode: (roomCode: string) => void;
  setReconnectToken: (token: string | null) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  playerId: null,
  playerName: null,
  username: null,
  password: null,
  roomCode: 'default',
  reconnectToken: null,
  isConnected: false,
  setPlayer: (id, name) => set({ playerId: id, playerName: name }),
  setUsername: (username) => set({ username }),
  setPassword: (password) => set({ password }),
  setRoomCode: (roomCode) => set({ roomCode }),
  setReconnectToken: (reconnectToken) => set({ reconnectToken }),
  setConnected: (connected) => set({ isConnected: connected }),
  reset: () => set({ playerId: null, playerName: null, username: null, password: null, roomCode: 'default', reconnectToken: null, isConnected: false }),
}));
