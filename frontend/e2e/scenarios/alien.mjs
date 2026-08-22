import assert from 'node:assert/strict';
import { chooseFirstVisibleCard, chooseVisibleCard, readState } from '../lib/players.mjs';
import { waitForLatestAction } from './shared.mjs';

export const name = 'alien';
export const label = '外星人正面特技无效果';

export async function run(ctx) {
  await chooseVisibleCard(ctx.actorPage, '外星人', '特技');
  await waitForLatestAction(ctx.actorPage, '特技', '外星人');
  const state = await readState(ctx.actorPage);
  // The alien only matters while hidden in hand during an Honor Student
  // phase (covered by the honor-student scenario); played face-up it must be
  // a plain no-op with no raise-hand prompts anywhere.
  assert.equal(state.game.state, 'playing');
  assert.equal(state.game.players.find((player) => player.id === 'player1').field_card_count, 1);
  assert.equal(state.game.own_hand.length, 2);
  assert.ok(state.game.turn_count > 0 || state.game.current_player_id !== 'player1', 'the turn should advance normally');
  await ctx.actorPage.waitForTimeout(300);
  assert.equal(await ctx.actorPage.locator('.game-modal').count(), 0, 'a face-up alien must not open any modal');
  for (const id of ['player2', 'player3', 'player4']) {
    assert.equal(await ctx.pagesById.get(id).getByText(/优等生特技：/).count(), 0);
    assert.equal(await ctx.pagesById.get(id).getByText(/正在等待其他人举手/).count(), 0);
  }
  // The game keeps flowing normally for the next player.
  await chooseFirstVisibleCard(ctx.pagesById.get('player2'), '调和', ['犯人']);
  await waitForLatestAction(ctx.actorPage, '调和', null);
  return {
    evidence: '外星人正面打出仅上场并推进回合：无举手提示、无特殊阶段，下一位玩家可立即正常行动',
    actions: [
      { action: 'skill', scenario: name, player_id: 'player1' },
      { action: 'harmony', scenario: `${name}-followup`, player_id: 'player2' },
    ],
  };
}
