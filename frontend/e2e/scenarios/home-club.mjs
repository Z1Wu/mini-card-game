import assert from 'node:assert/strict';
import { chooseVisibleCard, readState } from '../lib/players.mjs';
import { ownHandNames, waitForLatestAction } from './shared.mjs';

export const name = 'home-club';
export const label = '归宅部交换隐藏调和牌';

export async function run(ctx) {
  await chooseVisibleCard(ctx.actorPage, '归宅部', '特技');
  const modal = ctx.actorPage.locator('.game-modal').filter({ hasText: '归宅部：选择一张手牌与调和区的一张牌进行替换' });
  await modal.waitFor({ state: 'visible' });
  await modal.getByLabel('卡牌：保健委员', { exact: true }).click();
  await modal.getByLabel('牌背', { exact: true }).click();
  await ctx.screenshot('home-club-choice', ctx.actorPage);
  await modal.getByRole('button', { name: '确认替换', exact: true }).click();
  await waitForLatestAction(ctx.actorPage, '特技', '归宅部');
  const state = await readState(ctx.actorPage);
  // Effect semantics: the hidden harmony card (学生会长, known fixture) joins
  // the hand while the offered 保健委员 leaves it; the harmony area size is
  // conserved because the swap is one-for-one.
  assert.ok(ownHandNames(state).includes('学生会长'));
  assert.ok(!ownHandNames(state).includes('保健委员'));
  assert.equal(state.game.harmony_card_count, 1);
  return {
    evidence: '手牌保健委员与隐藏调和牌（学生会长）交换，调和区数量保持不变',
    actions: [{ action: 'skill', scenario: name, player_id: 'player1' }],
  };
}
