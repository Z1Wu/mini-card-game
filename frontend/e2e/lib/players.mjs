import { chromium } from 'playwright';

const TIMEOUT_MS = 15_000;

function attachDiagnostics(page, player) {
  page.on('console', (message) => { if (message.type() === 'error') player.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => player.pageErrors.push(error.message));
}

export async function openPlayers(accounts, { appUrl, rawVideoRoot, viewport = { width: 1280, height: 720 } }) {
  const browser = await chromium.launch({ headless: true });
  const players = [];
  for (let index = 0; index < accounts.length; index += 1) {
    const context = await browser.newContext({ viewport, ...(index === 0 ? { recordVideo: { dir: rawVideoRoot, size: viewport } } : {}) });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT_MS);
    const player = { ...accounts[index], name: `player${index + 1}`, page, context, consoleErrors: [], pageErrors: [], video: index === 0 ? page.video() : null };
    attachDiagnostics(page, player);
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    players.push(player);
  }
  return { browser, players };
}

export async function createRoomAndLogin(players) {
  const host = players[0];
  await host.page.getByRole('button', { name: '创建', exact: true }).click();
  const roomInput = host.page.locator('input[placeholder="输入 6 位房间码"]');
  await roomInput.waitFor({ state: 'visible' });
  await host.page.waitForFunction((selector) => document.querySelector(selector)?.value.length === 6, 'input[placeholder="输入 6 位房间码"]', { timeout: TIMEOUT_MS });
  const roomCode = await roomInput.inputValue();
  for (const player of players.slice(1)) {
    const input = player.page.locator('input[placeholder="输入 6 位房间码"]');
    await input.fill(roomCode);
    await player.page.getByRole('button', { name: '加入', exact: true }).click();
    await player.page.waitForFunction((selector) => document.querySelector(selector)?.value.length === 6, 'input[placeholder="输入 6 位房间码"]', { timeout: TIMEOUT_MS });
  }
  // Keep join order stable so a seeded deck maps to the same players every run.
  for (const player of players) await login(player);
  return roomCode;
}

export async function findHost(players, timeoutMs = TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const player of players) {
      const start = player.page.getByRole('button', { name: '开始游戏', exact: true });
      if (await start.isVisible().catch(() => false) && await start.isEnabled()) return player;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for the room host to become ready`);
}

async function login(player) {
  await player.page.getByLabel('用户名').fill(player.username);
  await player.page.getByLabel('密码').fill(player.password);
  await Promise.all([player.page.waitForURL('**/lobby', { timeout: TIMEOUT_MS }), player.page.getByRole('button', { name: '登录', exact: true }).click()]);
}

export async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

export async function waitForState(page, predicate, description, argument, timeoutMs = TIMEOUT_MS) {
  try {
    await page.waitForFunction(predicate, argument, { timeout: timeoutMs });
  } catch (error) {
    const state = await readState(page).catch(() => null);
    throw new Error(`Timed out waiting for ${description} after ${timeoutMs}ms. Last state: ${JSON.stringify(state)}\n${error.message}`);
  }
}

export async function chooseVisibleCard(page, cardName, action) {
  // Scope to hand area — field/doubt cards share the same aria-label
  const hand = page.locator('.table-hand');
  const card = hand.getByLabel(`卡牌：${cardName}`, { exact: true }).first();
  await card.waitFor({ state: 'visible' });
  await card.scrollIntoViewIfNeeded();
  await card.click();
  // Brief pause so the card lift animation + action bar are visible in video.
  await page.waitForTimeout(350);
  // Action buttons live in a dedicated action bar (sibling of the card),
  // not inside the card element — scope to the hand container.
  await hand.getByRole('button', { name: action, exact: true }).click();
  // Pause so the green play-feedback toast is captured in the video.
  await page.waitForTimeout(500);
}

export async function chooseFirstVisibleCard(page, action, excludedNames = []) {
  // Only enumerate cards inside the hand area (not field/doubt copies)
  const labels = await page.locator('.table-hand [aria-label^="卡牌："]').evaluateAll((cards, names) => cards
    .filter((card) => card instanceof HTMLElement && card.offsetParent !== null)
    .map((card) => card.getAttribute('aria-label'))
    .filter((label) => label && !names.includes(label.replace(/^卡牌：/, ''))), excludedNames);
  const label = labels[0];
  if (!label) throw new Error(`No playable visible card was found for ${action}`);
  const cardName = label.replace(/^卡牌：/, '');
  await chooseVisibleCard(page, cardName, action);
  return cardName;
}

/**
 * Showcase turn: demonstrates card selection, long-press description popover,
 * cancel/deselect, and reselect+play so the new UI features (action bar,
 * cancel button, hint text, play-feedback toast, long-press popover) are
 * clearly visible in the E2E video.
 * Must be called on the video-recorded page (player 0).
 */
async function showcaseTurn(page, excludedNames) {
  // Enumerate visible non-criminal cards in the hand
  const labels = await page.locator('.table-hand [aria-label^="卡牌："]')
    .evaluateAll((cards, names) => cards
      .filter((card) => card instanceof HTMLElement && card.offsetParent !== null)
      .map((card) => card.getAttribute('aria-label'))
      .filter((label) => label && !names.includes(label.replace(/^卡牌：/, ''))), excludedNames);
  const label = labels[0];
  if (!label) throw new Error('No playable visible card was found for showcase');
  const cardName = label.replace(/^卡牌：/, '');

  const hand = page.locator('.table-hand');
  const card = hand.getByLabel(`卡牌：${cardName}`, { exact: true }).first();
  await card.waitFor({ state: 'visible' });
  await card.scrollIntoViewIfNeeded();

  // 1. Long-press card → description popover appears after 500ms timer.
  //    Use evaluate to dispatch mousedown directly (no click event generated,
  //    so the popover overlay's onClick won't fire and close it prematurely).
  await card.evaluate(el => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  // Wait for the 500ms long-press timer + extra for video visibility
  await page.waitForTimeout(1200);

  // 2. Close description popover via 关闭 button
  const closePopover = page.getByRole('button', { name: '关闭', exact: true });
  if (await closePopover.isVisible().catch(() => false)) {
    await closePopover.click();
    await page.waitForTimeout(400);
  }
  // Clean up mouse state (dispatch mouseup to clear the long-press timer)
  await card.evaluate(el => el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  await page.waitForTimeout(200);

  // 3. Select card — shows lift animation + action bar (调和/质疑/特技/✕)
  await card.click();
  await page.waitForTimeout(800);

  // 4. Cancel via ✕ button — shows card returning down + hint text reappearing
  const cancelBtn = hand.getByRole('button', { name: '取消选择', exact: true });
  if (await cancelBtn.isVisible().catch(() => false)) {
    await cancelBtn.click();
    await page.waitForTimeout(600);
    // 5. Reselect the same card
    await card.click();
    await page.waitForTimeout(500);
  }

  // 6. Play harmony — shows play-feedback toast
  await hand.getByRole('button', { name: '调和', exact: true }).click();
  await page.waitForTimeout(600);

  return { action: 'harmony', card: cardName };
}

/**
 * Play a mixed-action turn: mostly harmony, but occasionally doubt or skill
 * for broader UI coverage. Criminal (犯人) is always excluded.
 * Pass showcase=true on the video-recorded player's first turn to
 * demonstrate card selection, long-press popover, and cancel/deselect.
 */
export async function playMixedTurn(page, state, step, showcase = false) {
  const excludedNames = ['犯人'];

  // ── Showcase turn: only on the recorded player's first turn ──
  if (showcase) {
    return showcaseTurn(page, excludedNames);
  }

  const actionRoll = step % 5;
  let action, cardName;

  if (actionRoll === 1) {
    // ── Doubt: pick a card, play doubt, then select target ──
    try {
      cardName = await chooseFirstVisibleCard(page, '质疑', excludedNames);
      // Target selection modal: click first other-player button
      const currentId = state.game?.current_player_id;
      const targets = state.game?.players?.filter(p => p.id !== currentId) ?? [];
      const targetName = targets[0]?.name;
      if (targetName) {
        const targetBtn = page.getByRole('button', { name: targetName, exact: true });
        await targetBtn.waitFor({ state: 'visible' });
        // Pause so the target-selection modal is visible in the video.
        await page.waitForTimeout(500);
        await targetBtn.click();
      }
      action = 'doubt';
    } catch {
      cardName = await chooseFirstVisibleCard(page, '调和', excludedNames);
      action = 'harmony';
    }
  } else if (actionRoll === 3) {
    // ── Skill (simple): try 图书委员 / 外星人 from HAND only, fallback to harmony ──
    const simpleSkills = ['图书委员', '外星人'];
    let found = false;
    for (const name of simpleSkills) {
      // Scope to hand area to avoid matching field/doubt cards
      const hand = page.locator('.table-hand');
      const locator = hand.getByLabel(`卡牌：${name}`, { exact: true });
      if (await locator.first().isVisible().catch(() => false)) {
        try {
          await locator.first().scrollIntoViewIfNeeded();
          await locator.first().click();
          await page.waitForTimeout(350);
          await hand.getByRole('button', { name: '特技', exact: true }).click();
          // Pause so skill result modal is visible in the video.
          await page.waitForTimeout(700);
          const closeBtn = page.getByRole('button', { name: '关闭', exact: true });
          if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
          cardName = name;
          action = 'skill';
          found = true;
          break;
        } catch { /* fall through */ }
      }
    }
    if (!found) {
      cardName = await chooseFirstVisibleCard(page, '调和', excludedNames);
      action = 'harmony';
    }
  } else {
    // ── Harmony (default) ──
    cardName = await chooseFirstVisibleCard(page, '调和', excludedNames);
    action = 'harmony';
  }

  return { action, card: cardName };
}

export async function closePlayers(browser, players, afterContextsClose = async () => {}) {
  await Promise.all(players.map((player) => player.context.close().catch(() => {})));
  await afterContextsClose();
  await browser?.close().catch(() => {});
}
