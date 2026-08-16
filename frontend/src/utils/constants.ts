/** 未设置时使用当前页面同源 + /ws，便于云服务器部署 */
function getDefaultWsUrl(): string {
  if (typeof location !== 'undefined') {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/ws`;
  }
  return 'ws://localhost:8765';
}
export const WS_URL = import.meta.env.VITE_WS_URL || getDefaultWsUrl();

/** Admin REST API base URL; defaults to same-origin /api/admin. */
function getDefaultAdminApiUrl(): string {
  if (typeof location !== 'undefined') {
    return `${location.origin}/api/admin`;
  }
  return 'http://localhost:8766/api/admin';
}
export const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL || getDefaultAdminApiUrl();

export const MAX_PLAYERS = 5;
export const MIN_PLAYERS = 3;
export const HAND_COUNT_MAP: Record<number, number> = {
  3: 6,
  4: 6,
  5: 5,
};
