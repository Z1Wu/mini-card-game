import { create } from 'zustand';
import { wsService } from '../services/websocket';

interface RoomState {
  roomCode: string | null;
  setRoomCode: (roomCode: string) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomCode: wsService.getRoomCode(),
  setRoomCode: (roomCode) => {
    const normalized = wsService.setRoomCode(roomCode);
    set({ roomCode: normalized });
  },
  clearRoom: () => {
    wsService.clearRoomCode();
    set({ roomCode: null });
  },
}));
