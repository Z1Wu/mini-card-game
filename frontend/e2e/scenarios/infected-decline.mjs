import assert from 'node:assert/strict';
import { chooseFirstVisibleCard, chooseVisibleCard, readState, waitForState } from '../lib/players.mjs';
import { waitForLatestAction } from './shared.mjs';

const FOLLOWERS = ['player2', 'player3', 'player4'];

export const name = 'infected-decline';
export const label = '感染者放弃拿牌';

/** The fixture pads the actor's hand so it survives two of its own turn starts. */
export const actorHandSize = 5;

async function waitPlayingAt(page, playerId) {
  await waitForState(page, () => {
    const state = JSON.parse(window.render_game_to_text());
    return state.game?.state === 'playing' && state.game?.current_player_id === playerId;
  }, `${playerId} to act in the normal playing phase`);
}

export async function run(ctx) {
  await chooseVisibleCard(ctx.actorPage, '感染者', '特技');
  await waitForLatestAction(ctx.actorPage, '特技', '感染者');
  for (const follower of FOLLOWERS) {
    await ctx.showTitle(`感染者等待下回合 · ${follower} 调和`, follower);
    await chooseFirstVisibleCard(ctx.pagesById.get(follower), '调和', ['犯人']);
  }
  const stateAtPrompt = await readState(ctx.actorPage);
  const harmonyAtPrompt = stateAtPrompt.game.harmony_card_count;
  const modal = ctx.actorPage.locator('.game-modal').filter({ hasText: '感染者：回合开始效果' });
  await modal.waitFor({ state: 'visible' });
  await ctx.screenshot('infected-decline-prompt', ctx.actorPage);
  await modal.getByRole('button', { name: '放弃', exact: true }).click();
  // Declining changes nothing: same hand size, same harmony area, and the
  // owner may immediately take its normal turn action.
  await waitPlayingAt(ctx.actorPage, 'player1');
  const stateAfterDecline = await readState(ctx.actorPage);
  assert.equal(stateAfterDecline.game.state, 'playing');
  assert.equal(stateAfterDecline.game.harmony_card_count, harmonyAtPrompt);
  assert.equal(stateAfterDecline.game.own_hand.length, 4);
  await chooseFirstVisibleCard(ctx.actorPage, '调和', ['犯人']);
  for (const follower of FOLLOWERS) {
    await chooseFirstVisibleCard(ctx.pagesById.get(follower), '调和', ['犯人']);
  }
  // Second turn start for the owner: a declined Infected never prompts again.
  await waitPlayingAt(ctx.actorPage, 'player1');
  await ctx.actorPage.waitForTimeout(700);
  const finalState = await readState(ctx.actorPage);
  assert.equal(finalState.game.state, 'playing');
  assert.equal(finalState.game.current_player_id, 'player1');
  assert.equal(await ctx.actorPage.locator('.game-modal').filter({ hasText: '感染者：回合开始效果' }).count(), 0, 'a declined Infected must not prompt again');
  return {
    evidence: `放弃后手牌与调和区不变（${stateAfterDecline.game.own_hand.length} 张 / ${harmonyAtPrompt} 张），再次轮到感染者持有者时不再出现提示`,
    actions: [
      { action: 'skill', scenario: name, player_id: 'player1' },
      ...FOLLOWERS.map((follower) => ({ action: 'harmony', scenario: `${name}-setup`, player_id: follower })),
      { action: 'harmony', scenario: name, player_id: 'player1' },
      ...FOLLOWERS.map((follower) => ({ action: 'harmony', scenario: name, player_id: follower })),
    ],
  };
}
