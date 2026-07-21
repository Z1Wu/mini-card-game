import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(frontendRoot, '..');
const backendRoot = path.join(repositoryRoot, 'backend');
const outputRoot = path.join(frontendRoot, 'test-results', 'full-game');
const rawVideoRoot = path.join(outputRoot, 'raw-video');
const appUrl = 'http://127.0.0.1:3100';
const backendPort = 8876;
const isolatedWebSocketUrl = `ws://127.0.0.1:${backendPort}`;
const videoPath = path.join(outputRoot, 'full-game.webm');
const screenshotPath = path.join(outputRoot, 'final-settlement.png');
const reportPath = path.join(outputRoot, 'report.json');

const accounts = [
  { username: 'player1', password: 'password1' },
  { username: 'player2', password: 'password2' },
  { username: 'player3', password: 'password3' },
];

const expectedOutputParent = `${path.join(frontendRoot, 'test-results')}${path.sep}`;
assert.ok(outputRoot.startsWith(expectedOutputParent), 'E2E output must stay inside frontend/test-results');
await fsPromises.rm(outputRoot, { recursive: true, force: true });
await fsPromises.mkdir(rawVideoRoot, { recursive: true });

function resolveBackendPython() {
  const candidates = process.platform === 'win32'
    ? [path.join(backendRoot, '.venv', 'Scripts', 'python.exe')]
    : [path.join(backendRoot, '.venv', 'bin', 'python')];
  const executable = candidates.find((candidate) => fs.existsSync(candidate));
  if (!executable) {
    throw new Error('Backend virtual environment is missing. Run `uv sync --project backend --frozen` first.');
  }
  return executable;
}

function startProcess(executable, args, options) {
  const child = spawn(executable, args, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  child.stderr.on('data', (chunk) => logs.push(chunk.toString()));
  return { child, logs };
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function waitForWebSocket(port, processInfo, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (processInfo.child.exitCode !== null) {
      throw new Error(`Service exited before port ${port} opened:\n${processInfo.logs.join('')}`);
    }
    const ready = await new Promise((resolve) => {
      const request = http.request({
        host: '127.0.0.1',
        port,
        headers: {
          Connection: 'Upgrade',
          Upgrade: 'websocket',
          'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
          'Sec-WebSocket-Version': '13',
        },
      });
      request.once('upgrade', (_response, socket) => {
        socket.destroy();
        resolve(true);
      });
      request.setTimeout(500, () => {
        request.destroy();
        resolve(false);
      });
      request.once('error', () => resolve(false));
      request.end();
    });
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for port ${port}`);
}

async function waitForHttp(url, processInfo, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (processInfo.child.exitCode !== null) {
      throw new Error(`Frontend exited before becoming ready:\n${processInfo.logs.join('')}`);
    }
    const ready = await new Promise((resolve) => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      });
      request.setTimeout(500, () => {
        request.destroy();
        resolve(false);
      });
      request.once('error', () => resolve(false));
    });
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function login(page, account, playerNumber, consoleErrors) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push({ player: playerNumber, message: message.text() });
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push({ player: playerNumber, message: error.message });
  });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('用户名').fill(account.username);
  await page.getByLabel('密码').fill(account.password);
  await Promise.all([
    page.waitForURL('**/lobby'),
    page.getByRole('button', { name: '登录', exact: true }).click(),
  ]);
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function playHarmony(page, playerId) {
  const heading = page.getByRole('heading', { name: /我的卡牌/ });
  await heading.waitFor({ state: 'visible' });
  const handSection = heading.locator('..').locator('..');
  const playableCards = handSection.locator('.game-card[aria-label^="卡牌："]:not([aria-label="卡牌：犯人"])');
  const selectedCard = playableCards.first();
  const cardLabel = await selectedCard.getAttribute('aria-label');
  assert.ok(cardLabel, `${playerId} should have a playable non-Criminal card`);

  await selectedCard.click();
  await selectedCard.getByRole('button', { name: '调和', exact: true }).click();
  return cardLabel.replace(/^卡牌：/, '');
}

const viteEntry = path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const build = spawnSync(process.execPath, [viteEntry, 'build'], {
  cwd: frontendRoot,
  env: { ...process.env, VITE_WS_URL: isolatedWebSocketUrl },
  stdio: 'inherit',
});
if (build.status !== 0) {
  throw new Error(`Frontend production build failed with exit code ${build.status}`);
}

const backend = startProcess(resolveBackendPython(), ['main.py'], {
  cwd: backendRoot,
  env: { ...process.env, HOST: '127.0.0.1', PORT: String(backendPort) },
});
const frontend = startProcess(process.execPath, [viteEntry, 'preview', '--host', '127.0.0.1', '--port', '3100', '--strictPort'], {
  cwd: frontendRoot,
  env: { ...process.env, VITE_WS_URL: isolatedWebSocketUrl },
});

let browser;
let primaryContext;
let helperContexts = [];
let primaryVideo;
let testError;
const turns = [];
const consoleErrors = [];
let finalState = null;

try {
  await Promise.all([
    waitForWebSocket(backendPort, backend),
    waitForHttp(appUrl, frontend),
  ]);

  browser = await chromium.launch({ headless: true });
  primaryContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: rawVideoRoot, size: { width: 1280, height: 720 } },
  });
  helperContexts = [
    await browser.newContext({ viewport: { width: 1280, height: 720 } }),
    await browser.newContext({ viewport: { width: 1280, height: 720 } }),
  ];
  const contexts = [primaryContext, ...helperContexts];
  const pages = [];

  for (let index = 0; index < contexts.length; index += 1) {
    const page = await contexts[index].newPage();
    pages.push(page);
    await login(page, accounts[index], index + 1, consoleErrors);
  }

  const primaryPage = pages[0];
  primaryVideo = primaryPage.video();
  await primaryPage.getByText('3 / 5', { exact: true }).waitFor({ state: 'visible' });
  await Promise.all([
    ...pages.map((page) => page.waitForURL('**/game')),
    primaryPage.getByRole('button', { name: '开始游戏', exact: true }).click(),
  ]);

  const pagesByPlayer = new Map();
  for (const page of pages) {
    const state = await readState(page);
    pagesByPlayer.set(state.connection.player_id, page);
  }

  for (let step = 0; step < 30; step += 1) {
    const before = await readState(primaryPage);
    if (before.game?.state === 'game_over') break;

    const currentPlayerId = before.game?.current_player_id;
    const currentPage = pagesByPlayer.get(currentPlayerId);
    assert.ok(currentPage, `A browser page should exist for ${currentPlayerId}`);
    const previousTurn = before.game.turn_count;
    const card = await playHarmony(currentPage, currentPlayerId);
    turns.push({ turn: previousTurn, player_id: currentPlayerId, action: 'harmony', card });

    await primaryPage.waitForFunction((turn) => {
      const state = JSON.parse(window.render_game_to_text());
      return state.game?.state === 'game_over' || state.game?.turn_count > turn;
    }, previousTurn);
  }

  finalState = await readState(primaryPage);
  assert.equal(finalState.game?.state, 'game_over');
  assert.equal(turns.length, 15);
  assert.equal(finalState.game?.harmony_card_count, 15);
  assert.ok(finalState.game?.players.every((player) => player.hand_count === 1));
  assert.ok(finalState.game?.winner_id, 'The winner should be exposed through render_game_to_text');
  assert.equal(consoleErrors.length, 0, `Unexpected browser errors: ${JSON.stringify(consoleErrors)}`);

  await primaryPage.getByRole('heading', { name: '游戏结束 · 完整结算' }).waitFor({ state: 'visible' });
  await primaryPage.getByText(/获胜！$/).waitFor({ state: 'visible' });
  await primaryPage.screenshot({ path: screenshotPath, fullPage: true });
} catch (error) {
  testError = error;
} finally {
  await Promise.all(helperContexts.map((context) => context.close().catch(() => {})));
  if (primaryContext) await primaryContext.close().catch(() => {});
  if (primaryVideo) {
    try {
      await primaryVideo.saveAs(videoPath);
    } catch (error) {
      if (!testError) testError = error;
    }
  }
  if (browser) await browser.close().catch(() => {});
  await Promise.all([stopProcess(frontend.child), stopProcess(backend.child)]);
}

if (!testError) {
  try {
    const video = await fsPromises.stat(videoPath);
    assert.ok(video.size > 10_000, `Recorded video is unexpectedly small: ${video.size} bytes`);
  } catch (error) {
    testError = error;
  }
}

const report = {
  result: testError ? 'failed' : 'passed',
  players: accounts.map(({ username }) => username),
  turns_played: turns.length,
  turns,
  final_state: finalState,
  console_errors: consoleErrors,
  service_logs: {
    backend: backend.logs,
    frontend: frontend.logs,
  },
  artifacts: {
    video: path.relative(frontendRoot, videoPath),
    screenshot: path.relative(frontendRoot, screenshotPath),
  },
  error: testError instanceof Error ? testError.stack : null,
};
await fsPromises.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (testError) throw testError;
console.log(`Recorded E2E passed: ${turns.length} turns, winner ${finalState.game.winner_id}`);
