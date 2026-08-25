import assert from 'node:assert/strict';
import { chooseVisibleCard, readState } from '../lib/players.mjs';
import { waitForLatestAction } from './shared.mjs';

export const name = 'doubt';
export const label = '质疑与目标归属';

export async function run(ctx) {
  await chooseVisibleCard(ctx.actorPage, '图书委员', '质疑');
  await ctx.actorPage.getByText('选择要质疑的玩家', { exact: true }).waitFor({ state: 'visible' });
  await ctx.screenshot('doubt-target', ctx.actorPage);
  await ctx.actorPage.getByRole('button', { name: '玩家2', exact: true }).click();
  await waitForLatestAction(ctx.actorPage, '质疑', null, 'player2');
  const state = await readState(ctx.actorPage);
  assert.equal(state.game.players.find((player) => player.id === 'player2').doubt_card_count, 1);
  return {
    evidence: '公开行动记录目标为 player2，且质疑牌归属 player2',
    actions: [{ action: 'doubt', scenario: name, player_id: 'player1' }],
  };
}
