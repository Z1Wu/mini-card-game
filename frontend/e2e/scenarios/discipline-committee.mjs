import assert from 'node:assert/strict';
import { chooseVisibleCard, readState } from '../lib/players.mjs';
import { readCardNamesIn, waitForLatestAction } from '../lib/scenarios.mjs';

export const name = 'discipline-committee';
export const label = '风纪委员私下查看手牌';

export async function run(ctx) {
  await chooseVisibleCard(ctx.actorPage, '风纪委员', '特技');
  await ctx.actorPage.getByRole('button', { name: '玩家2', exact: true }).click();
  const heading = ctx.actorPage.getByRole('heading', { name: '风纪委员：玩家2 的手牌' });
  await heading.waitFor({ state: 'visible' });
  const modal = ctx.actorPage.locator('.game-modal').filter({ hasText: '风纪委员：玩家2 的手牌' });
  // Effect semantics: the private view must equal the target's real hand.
  const viewedNames = (await readCardNamesIn(modal)).sort();
  const targetPage = ctx.pagesById.get('player2');
  const actualNames = (await targetPage.evaluate(() => [...document.querySelectorAll('.table-hand [aria-label^="卡牌："]')]
    .map((card) => card.getAttribute('aria-label').replace(/^卡牌：/, '')))).sort();
  assert.deepEqual(viewedNames, actualNames);
  for (const id of ['player3', 'player4']) {
    assert.equal(await ctx.pagesById.get(id).getByRole('heading', { name: '风纪委员：玩家2 的手牌' }).count(), 0);
  }
  await ctx.screenshot('discipline-private-result', ctx.actorPage);
  await ctx.actorPage.getByRole('button', { name: '关闭', exact: true }).click();
  await waitForLatestAction(ctx.actorPage, '特技', '风纪委员', 'player2');
  const state = await readState(ctx.actorPage);
  // View-only effect: nobody's hand size may change.
  assert.ok(state.game.players.every((player) => player.hand_count === 3));
  return {
    evidence: `仅行动者收到并渲染 player2 的真实手牌（${viewedNames.join('、')}），其余玩家不可见且不移动任何牌`,
    actions: [{ action: 'skill', scenario: name, player_id: 'player1' }],
  };
}
