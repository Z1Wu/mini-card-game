import assert from 'node:assert/strict';
import { chooseVisibleCard } from '../lib/players.mjs';
import { readCardNamesIn, waitForLatestAction } from './shared.mjs';

export const name = 'library-committee';
export const label = '图书委员查看调和区';

export async function run(ctx) {
  await chooseVisibleCard(ctx.actorPage, '图书委员', '特技');
  const heading = ctx.actorPage.getByRole('heading', { name: '图书委员：调和区所有卡牌' });
  await heading.waitFor({ state: 'visible' });
  // The fixture hides exactly one 学生会长 in the harmony area; the skill must
  // reveal its real identity to the actor (not a card back).
  const modal = ctx.actorPage.locator('.game-modal').filter({ hasText: '图书委员：调和区所有卡牌' });
  assert.deepEqual(await readCardNamesIn(modal), ['学生会长']);
  for (const id of ['player2', 'player3', 'player4']) {
    assert.equal(await ctx.pagesById.get(id).getByRole('heading', { name: '图书委员：调和区所有卡牌' }).count(), 0);
  }
  await ctx.screenshot('library-private-result', ctx.actorPage);
  await ctx.actorPage.getByRole('button', { name: '关闭', exact: true }).click();
  await waitForLatestAction(ctx.actorPage, '特技', '图书委员');
  return {
    evidence: '仅行动者看到调和区真实牌面（学生会长），公开记录显示正面特技',
    actions: [{ action: 'skill', scenario: name, player_id: 'player1' }],
  };
}
