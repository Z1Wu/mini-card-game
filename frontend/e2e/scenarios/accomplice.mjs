import assert from 'node:assert/strict';
import { chooseVisibleCard, readState } from '../lib/players.mjs';
import { waitForLatestAction } from './shared.mjs';

export const name = 'accomplice';
export const label = '共犯移动质疑牌';

export async function run(ctx) {
  await chooseVisibleCard(ctx.actorPage, '共犯', '特技');
  const modal = ctx.actorPage.locator('.game-modal').filter({ hasText: '共犯：移动一张质疑牌' });
  assert.ok(await modal.getByLabel('牌背', { exact: true }).count() > 0, 'Hidden choices show card backs');
  assert.ok(await modal.getByLabel('牌背', { exact: true }).evaluateAll(nodes => nodes.every(node => getComputedStyle(node).backgroundImage.includes('card-back-classroom-v1'))), 'Every hidden choice uses the abandoned classroom artwork');
  assert.equal(await modal.locator('[aria-label^="卡牌："]').count(), 0, 'Doubt identities remain hidden');
  await modal.getByRole('button', { name: '玩家2 的质疑牌 1', exact: true }).click();
  await modal.getByRole('button', { name: '玩家3', exact: true }).click();
  await ctx.screenshot('accomplice-move', ctx.actorPage);
  await modal.getByRole('button', { name: '确认移动', exact: true }).click();
  await waitForLatestAction(ctx.actorPage, '特技', '共犯', 'player3');
  const state = await readState(ctx.actorPage);
  assert.equal(state.game.players.find((player) => player.id === 'player2').doubt_card_count, 0);
  assert.equal(state.game.players.find((player) => player.id === 'player3').doubt_card_count, 1);
  return {
    evidence: '质疑牌从 player2 原子移动到 player3',
    actions: [{ action: 'skill', scenario: name, player_id: 'player1' }],
  };
}
