import assert from 'node:assert/strict';
import { chooseVisibleCard, readState } from '../lib/players.mjs';
import { waitForLatestAction } from '../lib/scenarios.mjs';

export const name = 'harmony';
export const label = '调和与隐藏归属';

export async function run(ctx) {
  await chooseVisibleCard(ctx.actorPage, '图书委员', '调和');
  await waitForLatestAction(ctx.actorPage, '调和', null);
  const state = await readState(ctx.actorPage);
  assert.equal(state.game.harmony_card_count, 1);
  assert.equal(state.game.players.find((player) => player.id === 'player1').hand_count, 2);
  return {
    evidence: '调和区新增一张隐藏牌，行动者手牌减少一张',
    actions: [{ action: 'harmony', scenario: name, player_id: 'player1' }],
  };
}
