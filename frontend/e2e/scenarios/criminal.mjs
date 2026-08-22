import assert from 'node:assert/strict';
import { chooseVisibleCard, readState } from '../lib/players.mjs';

export const name = 'criminal';
export const label = '犯人不可打出';

const REJECTED_ACTIONS = ['调和', '质疑', '特技'];
const REJECTION_TEXT = '犯人牌不可打出，仅可被其他卡牌效果移动';

export async function run(ctx) {
  for (const action of REJECTED_ACTIONS) {
    await chooseVisibleCard(ctx.actorPage, '犯人', action);
    const banner = ctx.actorPage.getByRole('alert').filter({ hasText: REJECTION_TEXT });
    await banner.waitFor({ state: 'visible' });
    await ctx.screenshot(`criminal-rejected-${action}`, ctx.actorPage);
    // The server rejected the play: close the banner and confirm nothing moved.
    const state = await readState(ctx.actorPage);
    assert.equal(state.game.state, 'playing');
    assert.equal(state.game.turn_count, 0, `${action} must not advance the turn`);
    assert.equal(state.game.current_player_id, 'player1');
    assert.equal(state.game.public_action_count, 0, `${action} must not create a public action`);
    assert.ok(state.game.own_hand.some((card) => card.name === '犯人'), 'the criminal stays in hand');
    assert.equal(state.game.players.find((player) => player.id === 'player1').hand_count, 3);
    await banner.getByRole('button', { name: '关闭', exact: true }).click();
    await banner.waitFor({ state: 'hidden' });
  }
  return {
    evidence: '对犯人尝试调和/质疑/特技均被服务端拒绝并提示，回合、公开记录与手牌保持不变',
    actions: [],
  };
}
