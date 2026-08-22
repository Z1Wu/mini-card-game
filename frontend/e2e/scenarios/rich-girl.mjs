import assert from 'node:assert/strict';
import { chooseVisibleCard, readState } from '../lib/players.mjs';
import { ownHandNames, readLabeledCards, waitForLatestAction } from '../lib/scenarios.mjs';

export const name = 'rich-girl';
export const label = '大小姐两阶段交换';

export async function run(ctx) {
  const targetPage = ctx.pagesById.get('player2');
  const targetBefore = ownHandNames(await readState(targetPage));
  await chooseVisibleCard(ctx.actorPage, '大小姐', '特技');
  await ctx.actorPage.getByRole('button', { name: '玩家2', exact: true }).click();
  let modal = ctx.actorPage.locator('.game-modal').filter({ hasText: /大小姐：从 玩家2 手牌选一张拿取/ });
  await modal.waitFor({ state: 'visible' });
  assert.ok(await modal.getByText('牌背', { exact: true }).count() > 0);
  assert.equal(await modal.locator('[aria-label^="卡牌："]').count(), 0, 'Target card identities must stay hidden before take confirmation');
  assert.equal(await targetPage.getByText(/大小姐：从 玩家2 手牌选一张拿取/).count(), 0);
  await modal.getByText('牌背', { exact: true }).first().click();
  await ctx.screenshot('rich-girl-hidden-take', ctx.actorPage);
  await modal.getByRole('button', { name: '确认（查看拿到的牌）', exact: true }).click();
  modal = ctx.actorPage.locator('.game-modal').filter({ hasText: /选择要交给 玩家2 的牌/ });
  await modal.waitFor({ state: 'visible' });
  // The give phase privately reveals which hidden card was taken.
  const taken = (await readLabeledCards(modal, ['拿到的牌']))['拿到的牌'];
  assert.ok(taken && targetBefore.includes(taken), `taken card ${taken} must come from 玩家2's real hand`);
  const giveChoices = modal.locator('.mb-4').filter({ hasText: '选择要交给对方的牌' });
  const giveOptions = await giveChoices.locator('[aria-label^="卡牌："]').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label').replace(/^卡牌：/, '')));
  const givenAway = giveOptions.find((cardName) => cardName !== taken);
  assert.ok(givenAway, 'the actor should have an own hand card to give away');
  await giveChoices.getByLabel(`卡牌：${givenAway}`, { exact: true }).click();
  await ctx.screenshot('rich-girl-give', ctx.actorPage);
  await modal.getByRole('button', { name: '确认交换', exact: true }).click();
  await waitForLatestAction(ctx.actorPage, '特技', '大小姐', 'player2');
  const actorAfter = ownHandNames(await readState(ctx.actorPage));
  const targetAfter = ownHandNames(await readState(targetPage));
  assert.ok(actorAfter.includes(taken), `actor hand must gain the taken card ${taken}`);
  assert.ok(!actorAfter.includes(givenAway), `actor hand must lose the given card ${givenAway}`);
  assert.ok(targetAfter.includes(givenAway), `target hand must gain the given card ${givenAway}`);
  assert.ok(!targetAfter.includes(taken), `target hand must lose the taken card ${taken}`);
  return {
    evidence: `目标手牌先保持牌背；确认拿牌后私下看到 ${taken} 并交出 ${givenAway}，双方手牌身份按效果互换`,
    actions: [{ action: 'skill', scenario: name, player_id: 'player1' }],
  };
}
