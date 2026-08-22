import assert from 'node:assert/strict';
import { chooseFirstVisibleCard, chooseVisibleCard, readState } from '../lib/players.mjs';
import { waitForLatestAction } from './shared.mjs';

export const name = 'student-council-president';
export const label = '学生会长正面特技无效果';

export async function run(ctx) {
  await chooseVisibleCard(ctx.actorPage, '学生会长', '特技');
  await waitForLatestAction(ctx.actorPage, '特技', '学生会长');
  const state = await readState(ctx.actorPage);
  // Face-up the president does nothing beyond entering the field and passing
  // the turn — no private modal, no special phase.
  assert.equal(state.game.state, 'playing');
  assert.equal(state.game.players.find((player) => player.id === 'player1').field_card_count, 1);
  assert.equal(state.game.own_hand.length, 2);
  assert.ok(state.game.turn_count > 0 || state.game.current_player_id !== 'player1', 'the turn should advance normally');
  await ctx.actorPage.waitForTimeout(300);
  assert.equal(await ctx.actorPage.locator('.game-modal').count(), 0, 'the president skill must not open any modal');
  // The game keeps flowing normally for the next player.
  await chooseFirstVisibleCard(ctx.pagesById.get('player2'), '调和', ['犯人']);
  await waitForLatestAction(ctx.actorPage, '调和', null);
  return {
    evidence: '学生会长正面打出仅上场并推进回合：无私有弹窗、无特殊阶段，下一位玩家可立即正常行动',
    actions: [
      { action: 'skill', scenario: name, player_id: 'player1' },
      { action: 'harmony', scenario: `${name}-followup`, player_id: 'player2' },
    ],
  };
}
