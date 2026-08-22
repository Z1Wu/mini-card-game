import { describe, expect, it } from 'vitest';
import { describeServerError } from './errorMessages';

describe('describeServerError', () => {
  it('localizes known stable error codes', () => {
    expect(describeServerError({ code: 'game_in_progress', message: '游戏正在进行中，无法加入新玩家' }))
      .toBe('游戏正在进行中，无法加入新玩家');
    expect(describeServerError({ code: 'invalid_reconnect_credentials', message: 'Invalid reconnect credentials' }))
      .toBe('重连凭证无效或已过期，请重新登录');
    expect(describeServerError({ code: 'session_taken_over', message: '该账号已在其他连接登录，当前连接已断开' }))
      .toBe('该账号已在其他连接登录，当前连接已断开');
  });

  it('passes through raw messages for unknown codes', () => {
    expect(describeServerError({ code: 'room_not_found', message: 'Room not found' })).toBe('Room not found');
    expect(describeServerError({ message: '出牌失败' })).toBe('出牌失败');
  });

  it('falls back to a generic message when nothing is usable', () => {
    expect(describeServerError({})).toBe('操作失败，请重试');
    expect(describeServerError({ code: 'unknown_code' })).toBe('操作失败，请重试');
  });
});
