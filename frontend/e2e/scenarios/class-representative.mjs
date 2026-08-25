import assert from 'node:assert/strict';
import { chooseVisibleCard } from '../lib/players.mjs';
import { readLabeledCards, waitForLatestAction } from './shared.mjs';

export const name = 'class-representative';
export const label = '班长双方选牌交换';

export async function run(ctx) {
  const targetPage = ctx.pagesById.get('player2');
  // Pick the concrete identities to swap from each side's real hand so the
  // assertions prove the exchange itself, not just that panels appeared.
  const actorHand = await ctx.actorPage.evaluate(() => JSON.parse(window.render_game_to_text()).game.own_hand.map((card) => card.name));
  const giveName = actorHand.find((cardName) => cardName !== '班长');
  assert.ok(giveName, 'actor needs a second card to offer');
  const receiveName = await targetPage.evaluate(() => document.querySelector('.table-hand [aria-label^="卡牌："]')?.getAttribute('aria-label')?.replace(/^卡牌：/, ''));
  assert.ok(receiveName, 'target needs a visible hand card');

  await chooseVisibleCard(ctx.actorPage, '班长', '特技');
  await ctx.actorPage.getByRole('button', { name: '玩家2', exact: true }).click();
  let modal = ctx.actorPage.locator('.game-modal').filter({ hasText: /班长：选一张手牌与 玩家2 交换/ });
  await modal.waitFor({ state: 'visible' });
  await modal.getByLabel(`卡牌：${giveName}`, { exact: true }).first().click();
  await modal.getByRole('button', { name: '确认', exact: true }).click();
  await ctx.actorPage.getByText('正在等待 玩家2 选牌', { exact: true }).waitFor({ state: 'visible' });
  await ctx.screenshot('class-representative-waiting', ctx.actorPage);
  modal = targetPage.locator('.game-modal').filter({ hasText: /班长：选一张手牌与 玩家1 交换/ });
  await modal.waitFor({ state: 'visible' });
  await modal.getByLabel(`卡牌：${receiveName}`, { exact: true }).first().click();
  await modal.getByRole('button', { name: '确认', exact: true }).click();
  await waitForLatestAction(ctx.actorPage, '特技', '班长', 'player2');
  const actorResult = ctx.actorPage.locator('.game-modal').filter({ hasText: '班长：交换结果' });
  const targetResult = targetPage.locator('.game-modal').filter({ hasText: '班长：交换结果' });
  await Promise.all([actorResult.waitFor({ state: 'visible' }), targetResult.waitFor({ state: 'visible' })]);
  const labels = ['你给出的牌', '你收到的牌'];
  const actorExchange = await readLabeledCards(actorResult, labels);
  const targetExchange = await readLabeledCards(targetResult, labels);
  assert.equal(actorExchange['你给出的牌'], giveName, `actor should have given ${giveName}`);
  assert.equal(actorExchange['你收到的牌'], receiveName, `actor should have received ${receiveName}`);
  assert.equal(targetExchange['你给出的牌'], receiveName, `target should have given ${receiveName}`);
  assert.equal(targetExchange['你收到的牌'], giveName, `target should have received ${giveName}`);
  await ctx.screenshot('class-representative-result', ctx.actorPage);
  await ctx.actorPage.getByRole('button', { name: '关闭', exact: true }).click();
  await targetPage.getByRole('button', { name: '关闭', exact: true }).click();
  return {
    evidence: `行动者等待目标选牌；双方各选一张（玩家1 出 ${giveName}、玩家2 出 ${receiveName}）并在结果面板看到身份互换`,
    actions: [{ action: 'skill', scenario: name, player_id: 'player1' }],
    extraCoverage: ['waiting-panel', 'result-panel'],
  };
}
