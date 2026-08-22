import assert from 'node:assert/strict';
import { chooseVisibleCard } from '../lib/players.mjs';
import { waitForLatestAction } from '../lib/scenarios.mjs';

export const name = 'honor-student';
export const label = '优等生等待举手与结果';

export async function run(ctx) {
  await chooseVisibleCard(ctx.actorPage, '优等生', '特技');
  await ctx.actorPage.getByText(/正在等待其他人举手/).first().waitFor({ state: 'visible' });
  await ctx.pagesById.get('player2').getByText('优等生特技：你持有犯人卡，必须举手示意', { exact: true }).waitFor({ state: 'visible' });
  await ctx.pagesById.get('player3').getByText('优等生特技：你持有外星人卡，可以假装犯人举手', { exact: true }).waitFor({ state: 'visible' });
  assert.equal(await ctx.pagesById.get('player4').getByText(/优等生特技：/).count(), 0);
  await ctx.screenshot('honor-student-waiting', ctx.actorPage);
  await ctx.pagesById.get('player2').getByRole('button', { name: '举手', exact: true }).click();
  await ctx.pagesById.get('player3').getByRole('button', { name: '举手（假装犯人）', exact: true }).click();
  await ctx.actorPage.getByRole('heading', { name: '优等生：举手结果' }).waitFor({ state: 'visible' });
  await ctx.actorPage.getByText('举手的人：玩家2、玩家3', { exact: true }).waitFor({ state: 'visible' });
  await ctx.screenshot('honor-student-result', ctx.actorPage);
  await ctx.actorPage.getByRole('button', { name: '关闭', exact: true }).click();
  await waitForLatestAction(ctx.actorPage, '特技', '优等生');
  return {
    evidence: '犯人强制举手、外星人主动伪装、无关玩家无私有提示，行动者收到汇总结果',
    actions: [{ action: 'skill', scenario: name, player_id: 'player1' }],
    extraCoverage: ['waiting-panel', 'result-panel'],
  };
}
