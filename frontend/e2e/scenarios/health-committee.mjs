import assert from 'node:assert/strict';
import { chooseVisibleCard, readState } from '../lib/players.mjs';
import { ownHandNames, waitForLatestAction } from './shared.mjs';

export const name = 'health-committee';
export const label = '保健委员收回公开场牌';

export async function run(ctx) {
  await chooseVisibleCard(ctx.actorPage, '保健委员', '特技');
  const modal = ctx.actorPage.locator('.game-modal').filter({ hasText: '保健委员：选择一张场上正面朝上的卡牌' });
  await modal.waitFor({ state: 'visible' });
  // Two opponents each show a public field card, so the skill has a real
  // choice to make; both candidates must be offered.
  assert.ok(await modal.getByLabel('卡牌：图书委员', { exact: true }).count() > 0, '玩家2 的场牌应作为候选出现');
  assert.ok(await modal.getByLabel('卡牌：归宅部', { exact: true }).count() > 0, '玩家3 的场牌应作为候选出现');
  await modal.getByLabel('卡牌：图书委员', { exact: true }).click();
  await ctx.screenshot('health-committee-choice', ctx.actorPage);
  await modal.getByRole('button', { name: '确认选择', exact: true }).click();
  await waitForLatestAction(ctx.actorPage, '特技', '保健委员', 'player2');
  const state = await readState(ctx.actorPage);
  // Exactly the picked card moves; the untouched opponent keeps its field card.
  assert.equal(state.game.players.find((player) => player.id === 'player2').field_card_count, 0);
  assert.equal(state.game.players.find((player) => player.id === 'player3').field_card_count, 1);
  assert.ok(ownHandNames(state).includes('图书委员'));
  assert.ok(!ownHandNames(state).includes('归宅部'));
  return {
    evidence: '场上有两张候选场牌（玩家2 图书委员、玩家3 归宅部），行动者选中图书委员后仅该张被移入私有手牌，归宅部留在玩家3 场上',
    actions: [{ action: 'skill', scenario: name, player_id: 'player1' }],
  };
}
