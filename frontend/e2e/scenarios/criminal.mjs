import assert from 'node:assert/strict';
import { readState } from '../lib/players.mjs';

export const name = 'criminal';
export const label = '犯人不可打出';

const BLOCKED_TEXT = '犯人不可主动打出，只能保留或被其他特技移动';

async function assertUntouched(ctx, note) {
  const state = await readState(ctx.actorPage);
  assert.equal(state.game.state, 'playing');
  assert.equal(state.game.turn_count, 0, `${note}: the turn must not advance`);
  assert.equal(state.game.current_player_id, 'player1');
  assert.equal(state.game.public_action_count, 0, `${note}: no public action may appear`);
  assert.ok(state.game.own_hand.some((card) => card.name === '犯人'), `${note}: the criminal stays in hand`);
  assert.equal(state.game.players.find((player) => player.id === 'player1').hand_count, 3);
}

export async function run(ctx) {
  const hand = ctx.actorPage.locator('.table-hand');
  // Selecting the criminal opens a blocked hint instead of an action bar.
  await hand.getByLabel('卡牌：犯人', { exact: true }).click();
  const blocked = ctx.actorPage.getByText(BLOCKED_TEXT, { exact: true });
  await blocked.waitFor({ state: 'visible' });
  await ctx.screenshot('criminal-blocked', ctx.actorPage);
  assert.equal(await hand.getByRole('button', { name: '调和', exact: true }).count(), 0, 'the criminal must offer no harmony play');
  assert.equal(await hand.getByRole('button', { name: '质疑', exact: true }).count(), 0, 'the criminal must offer no doubt play');
  assert.equal(await hand.getByRole('button', { name: '特技', exact: true }).count(), 0, 'the criminal must offer no skill play');
  await assertUntouched(ctx, 'while the criminal is selected');

  // Contrast: any other card still offers the normal action bar.
  const filler = await ctx.actorPage.evaluate(() => JSON.parse(window.render_game_to_text()).game.own_hand.find((card) => card.name !== '犯人').name);
  await hand.getByLabel(`卡牌：${filler}`, { exact: true }).first().click();
  await hand.getByRole('button', { name: '调和', exact: true }).waitFor({ state: 'visible' });
  await ctx.actorPage.getByRole('button', { name: '取消选择', exact: true }).click();
  await hand.getByRole('button', { name: '调和', exact: true }).waitFor({ state: 'hidden' });
  await assertUntouched(ctx, 'after deselecting');
  return {
    evidence: '选中犯人只出现「犯人不可主动打出」提示且无任何出牌按钮；普通卡照常给出动作条。回合、公开记录与手牌全程不变',
    actions: [],
  };
}
