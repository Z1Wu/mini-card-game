import assert from 'node:assert/strict';
import { chooseVisibleCard, readState } from '../lib/players.mjs';
import { ownHandNames, waitForLatestAction } from './shared.mjs';

export const name = 'health-committee';
export const label = '保健委员收回公开场牌';

export async function run(ctx) {
  await chooseVisibleCard(ctx.actorPage, '保健委员', '特技');
  const modal = ctx.actorPage.locator('.game-modal').filter({ hasText: '保健委员：选择一张场上正面朝上的卡牌' });
  await modal.waitFor({ state: 'visible' });
  await modal.getByLabel('卡牌：图书委员', { exact: true }).click();
  await ctx.screenshot('health-committee-choice', ctx.actorPage);
  await modal.getByRole('button', { name: '确认选择', exact: true }).click();
  await waitForLatestAction(ctx.actorPage, '特技', '保健委员', 'player2');
  const state = await readState(ctx.actorPage);
  assert.equal(state.game.players.find((player) => player.id === 'player2').field_card_count, 0);
  assert.ok(ownHandNames(state).includes('图书委员'));
  return {
    evidence: 'player2 的公开场牌（图书委员）被服务端移入行动者私有手牌',
    actions: [{ action: 'skill', scenario: name, player_id: 'player1' }],
  };
}
