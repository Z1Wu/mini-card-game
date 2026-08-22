/** Localized, user-facing messages for stable server error codes. */
const CODE_MESSAGES: Record<string, string> = {
  game_in_progress: '游戏正在进行中，无法加入新玩家',
  invalid_reconnect_credentials: '重连凭证无效或已过期，请重新登录',
  player_not_in_game: '你不在当前对局中，无法重连',
  session_taken_over: '该账号已在其他连接登录，当前连接已断开',
  username_claimed_elsewhere: '该玩家已在其他房间中登录',
  authentication_required: '请先登录后再进行该操作',
};

/**
 * Prefer the localized message for a stable server error code; fall back to
 * the raw server message so unknown codes still surface their detail.
 */
export function describeServerError(message: { code?: string; message?: string }): string {
  const code = message?.code;
  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code];
  }
  return message?.message ?? '操作失败，请重试';
}
