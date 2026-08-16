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
  const card = page.getByLabel(`卡牌：${cardName}`, { exact: true }).first();
  await card.waitFor({ state: 'visible' });
  await card.click();
  await card.getByRole('button', { name: action, exact: true }).click();
}

export async function chooseFirstVisibleCard(page, action, excludedNames = []) {
  const labels = await page.locator('[aria-label^="卡牌："]').evaluateAll((cards, names) => cards
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
 * Play a mixed-action turn: mostly harmony, but occasionally doubt or skill
 * for broader UI coverage. Criminal (犯人) is always excluded.
 */
export async function playMixedTurn(page, state, step) {
  const excludedNames = ['犯人'];
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
          await locator.first().getByRole('button', { name: '特技', exact: true }).click();
          // Dismiss any result modal (e.g. 图书委员 shows harmony area)
          await page.waitForTimeout(500);
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
