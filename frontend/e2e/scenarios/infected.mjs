import assert from 'node:assert/strict';
import { chooseFirstVisibleCard, chooseVisibleCard, readState, waitForState } from '../lib/players.mjs';
import { waitForLatestAction } from '../lib/scenarios.mjs';

const FOLLOWERS = ['player2', 'player3', 'player4'];

async function waitBackAtActor(ctx) {
  await waitForState(ctx.actorPage, () => {
    const state = JSON.parse(window.render_game_to_text());
    return state.game?.state === 'playing' && state.game?.current_player_id === 'player1';
  }, 'the turn to rotate back to the Infected owner');
  // The one-shot prompt would appear synchronously with the turn-start
  // broadcast; settle briefly before asserting it never shows up again.
  await ctx.actorPage.waitForTimeout(700);
}

export const name = 'infected';
export const label = '感染者下回合拿牌';

export async function run(ctx) {
  await chooseVisibleCard(ctx.actorPage, '感染者', '特技');
  await waitForLatestAction(ctx.actorPage, '特技', '感染者');
  for (const follower of FOLLOWERS) {
    await ctx.showTitle(`感染者等待下回合 · ${follower} 调和`, follower);
    await chooseFirstVisibleCard(ctx.pagesById.get(follower), '调和', ['犯人']);
  }
  const harmonyBeforeTake = (await readState(ctx.actorPage)).game.harmony_card_count;
  const modal = ctx.actorPage.locator('.game-modal').filter({ hasText: '感染者：回合开始效果' });
  await modal.waitFor({ state: 'visible' });
  await ctx.screenshot('infected-next-turn', ctx.actorPage);
  await modal.getByRole('button', { name: '调和牌 1', exact: true }).click();
  await modal.getByRole('button', { name: '拿取所选牌', exact: true }).click();
  await waitForState(ctx.actorPage, () => {
    const state = JSON.parse(window.render_game_to_text());
    return state.game?.state === 'playing' && state.game?.own_hand?.length === 3;
  }, 'infected take to resolve');
  assert.equal((await readState(ctx.actorPage)).game.harmony_card_count, harmonyBeforeTake - 1);
  // The effect resolves exactly once: a full rotation later there is no prompt.
  await chooseFirstVisibleCard(ctx.actorPage, '调和', ['犯人']);
  for (const follower of FOLLOWERS) {
    await chooseFirstVisibleCard(ctx.pagesById.get(follower), '调和', ['犯人']);
  }
  await waitBackAtActor(ctx);
  assert.equal(await ctx.actorPage.locator('.game-modal').filter({ hasText: '感染者：回合开始效果' }).count(), 0, 'the taken Infected effect must not prompt again');
  return {
    evidence: `三名其他玩家行动后，感染者仅在自己的下回合收到一次拿牌提示（${harmonyBeforeTake - 1}→拿取），再次轮到时不再提示`,
    actions: [
      { action: 'skill', scenario: name, player_id: 'player1' },
      ...FOLLOWERS.map((follower) => ({ action: 'harmony', scenario: `${name}-setup`, player_id: follower })),
    ],
  };
}
