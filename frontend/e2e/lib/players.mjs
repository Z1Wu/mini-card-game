import { chromium } from 'playwright';

const TIMEOUT_MS = 15_000;

function attachDiagnostics(page, player) {
  page.on('console', (message) => { if (message.type() === 'error') player.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => player.pageErrors.push(error.message));
}

export async function openPlayers(accounts, { appUrl, rawVideoRoot }) {
  const browser = await chromium.launch({ headless: true });
  const players = [];
  for (let index = 0; index < accounts.length; index += 1) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...(index === 0 ? { recordVideo: { dir: rawVideoRoot, size: { width: 1280, height: 720 } } } : {}) });
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

export async function closePlayers(browser, players, afterContextsClose = async () => {}) {
  await Promise.all(players.map((player) => player.context.close().catch(() => {})));
  await afterContextsClose();
  await browser?.close().catch(() => {});
}
