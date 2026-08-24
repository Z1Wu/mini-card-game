import assert from 'node:assert/strict';
import { chooseVisibleCard, readState, waitForState } from '../lib/players.mjs';

const CHOOSER_ORDER = ['player1', 'player2', 'player3', 'player4'];

export const name = 'news-club';
export const label = '新闻部逐人传牌';

export async function run(ctx) {
  await chooseVisibleCard(ctx.actorPage, '新闻部', '特技');
  // Passes are applied immediately, so each chooser picks from: the actor
  // holds two cards (the News Club itself went to the field), later choosers
  // hold their three cards plus the card they just received. Wait for the
  // choice modal first — it implies this page has received the pass before.
  const given = {};
  const afterConfirm = {};
  for (const chooser of CHOOSER_ORDER) {
    const page = ctx.pagesById.get(chooser);
    const modal = page.locator('.game-modal').filter({ hasText: /新闻部：选择一张手牌递给/ });
    await modal.waitFor({ state: 'visible' });
    if (chooser !== 'player1') await ctx.showTitle(`新闻部传牌 · ${chooser} 正在选择`, chooser);
    const state = await readState(page);
    const expectedSize = chooser === 'player1' ? 2 : 4;
    assert.equal(state.game.own_hand.length, expectedSize, `${chooser} should choose with ${expectedSize} cards in hand`);
    // The just-received card is appended last, so index 0 is always an own card.
    const chosenName = state.game.own_hand[0].name;
    given[chooser] = chosenName;
    await modal.getByLabel(`卡牌：${chosenName}`, { exact: true }).first().click();
    await page.waitForTimeout(200);
    await modal.getByRole('button', { name: '确认递给下家', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    afterConfirm[chooser] = (await readState(page)).game.own_hand.map((card) => card.name);
  }
  // Every page must have processed the terminal broadcast before we compare
  // hands across seats; waiting only on the actor leaves other pages stale.
  await Promise.all(players.map((player) => waitForState(
    player.page,
    () => JSON.parse(window.render_game_to_text()).game?.turn_count > 0,
    `${player.username} to reach the post-rotation turn`,
  )));
  // Effect semantics: every passed identity shows up in the next seat's private
  // hand; the actor ends one card short because playing News Club cost a card.
  for (let index = 0; index < CHOOSER_ORDER.length; index += 1) {
    const giver = CHOOSER_ORDER[index];
    const receiver = CHOOSER_ORDER[(index + 1) % CHOOSER_ORDER.length];
    const receiverHand = (await readState(ctx.pagesById.get(receiver))).game.own_hand.map((card) => card.name);
    assert.ok(receiverHand.includes(given[giver]), `${receiver} should hold the card ${giver} passed (${given[giver]}); chosen=${JSON.stringify(given)} afterConfirm=${JSON.stringify(afterConfirm)} receiver=${JSON.stringify(receiverHand)}`);
    assert.equal(receiverHand.length, receiver === 'player1' ? 2 : 3, `${receiver} final hand size is conserved; chosen=${JSON.stringify(given)} afterConfirm=${JSON.stringify(afterConfirm)} receiver=${JSON.stringify(receiverHand)}`);
  }
  return {
    evidence: `四名玩家依次在各自页面选牌，牌按座次传给下家（${CHOOSER_ORDER.map((giver) => `${giver}→${given[giver]}`).join('，')}），最终手牌数守恒`,
    actions: [{ action: 'skill', scenario: name, player_id: 'player1' }],
  };
}
