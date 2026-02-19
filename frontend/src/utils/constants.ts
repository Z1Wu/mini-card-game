export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8765';
export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 3;
export const HAND_COUNT_MAP: Record<number, number> = {
  3: 6,
  4: 6,
  5: 5,
  6: 4,
};
