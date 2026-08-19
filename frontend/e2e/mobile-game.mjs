import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFreePort, prepareOutput, startServices, stopProcess } from './lib/services.mjs';
import { chooseFirstVisibleCard, closePlayers, createRoomAndLogin, findHost, openPlayers, playMixedTurn, readState, waitForState } from './lib/players.mjs';
import { savePlayerArtifacts, writeReport } from './lib/reporting.mjs';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.resolve(frontendRoot, '..', 'backend');
const viewportArgument = process.argv.find((argument) => argument.startsWith('--viewport='))?.split('=')[1] ?? '844x390';
const [viewportWidth, viewportHeight] = viewportArgument.split('x').map(Number);
assert.ok(Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight), `Invalid mobile viewport: ${viewportArgument}`);
const mobileViewport = { width: viewportWidth, height: viewportHeight };
const viewportLabel = `${mobileViewport.width}x${mobileViewport.height}`;
const defaultOutput = viewportLabel === '844x390'
  ? 'test-results/mobile-game'
  : `test-results/mobile-game/${viewportLabel}`;
const outputRoot = await prepareOutput(frontendRoot, process.env.E2E_OUTPUT_DIR ?? defaultOutput);
const rawVideoRoot = path.join(outputRoot, 'raw-video');
await fs.mkdir(rawVideoRoot, { recursive: true });
const backendPort = Number(process.env.E2E_BACKEND_PORT) || await findFreePort();
const frontendPort = Number(process.env.E2E_FRONTEND_PORT) || await findFreePort();
const seed = Number(process.env.E2E_SEED ?? 75);
const accounts = [
  { username: 'player1', password: 'password1' },
  { username: 'player2', password: 'password2' },
  { username: 'player3', password: 'password3' },
];
const reportPath = path.join(outputRoot, 'report.json');
const videoPath = path.join(outputRoot, 'mobile-game.webm');

let services;
let browser;
let players = [];
let roomCode;
let finalState = null;
let testError;
const turns = [];
let screenshots = {};

try {
  services = await startServices({ frontendRoot, backendRoot, backendPort, frontendPort, seed });
  ({ browser, players } = await openPlayers(accounts, { appUrl: services.appUrl, rawVideoRoot, viewport: mobileViewport }));
  roomCode = await createRoomAndLogin(players);
  const host = await findHost(players);
  const primary = host.page;

  // ── Mobile layout: verify no horizontal overflow on lobby ──
  const lobbyOverflow = await primary.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(lobbyOverflow, false, 'Lobby should have no horizontal overflow on mobile');

  // Wait for lobby player count, then start
  await primary.getByText('3 / 5', { exact: true }).waitFor({ state: 'visible' });
  await Promise.all([
    ...players.map((player) => player.page.waitForURL('**/game')),
    primary.getByRole('button', { name: '开始游戏', exact: true }).click(),
  ]);

  // Pause so the initial game table (harmony target, opponent stats, hand) is visible in video.
  await primary.waitForTimeout(800);

  const pagesByPlayer = new Map();
  for (const player of players) pagesByPlayer.set((await readState(player.page)).connection.player_id, player.page);

  // Selected-card decision sheet: verify the three outcome previews fit on the
  // short landscape viewport before any state-changing action is submitted.
  const initialState = await readState(primary);
  const initialTurnPage = pagesByPlayer.get(initialState.game?.current_player_id);
  assert.ok(initialTurnPage, 'The initial current player page should exist');
  const initialCardLabel = await initialTurnPage.locator('.table-hand [aria-label^="卡牌："]').evaluateAll((cards) => cards
    .map((card) => card.getAttribute('aria-label'))
    .find((label) => label && label !== '卡牌：犯人'));
  assert.ok(initialCardLabel, 'A non-Criminal card should be available for decision preview');
  await initialTurnPage.getByLabel(initialCardLabel, { exact: true }).first().click();
  const decisionSheet = initialTurnPage.getByLabel(/决策说明$/);
  await decisionSheet.waitFor({ state: 'visible' });
  await decisionSheet.getByText('查看完整决策说明', { exact: true }).click();
  await initialTurnPage.getByLabel('出牌结果预览').waitFor({ state: 'visible' });
  await initialTurnPage.waitForTimeout(350);
  assert.equal(await initialTurnPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Decision sheet should not create horizontal overflow');
  await initialTurnPage.screenshot({ path: path.join(outputRoot, 'decision-panel.png') });
  await initialTurnPage.getByRole('button', { name: '取消选择', exact: true }).click();

  // ── Mobile layout assertions on game page ──
  const gameTable = primary.locator('.game-table');
  await gameTable.waitFor({ state: 'visible' });
  const hand = primary.locator('.table-hand');
  await hand.waitFor({ state: 'visible' });
  const gameOverflow = await primary.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(gameOverflow, false, 'Game table should have no horizontal overflow on mobile');
  await primary.getByRole('list', { name: '其他玩家' }).waitFor({ state: 'visible' });
  await primary.getByLabel('我的手牌').waitFor({ state: 'visible' });
  await primary.getByLabel(/调和目标 \d+，已投入 \d+ 张，当前总值未知/).waitFor({ state: 'visible' });
  assert.equal(await primary.getByRole('heading', { name: '质疑牌' }).count(), 0, 'Doubt cards should stay attached to players instead of a central pile');
  await primary.screenshot({ path: path.join(outputRoot, 'game-table.png') });

  // Disruptive actions live behind the table menu and require confirmation.
  await primary.getByRole('button', { name: '打开牌桌菜单' }).click();
  await primary.getByRole('menuitem', { name: /重新开始/ }).click();
  await primary.getByRole('alertdialog').getByText('重新开始当前牌局？', { exact: true }).waitFor({ state: 'visible' });
  await primary.getByRole('button', { name: '取消', exact: true }).click();
  await primary.getByRole('button', { name: '打开牌桌菜单' }).click();
  await primary.getByRole('menuitem', { name: '离开房间', exact: true }).click();
  await primary.getByRole('alertdialog').getByText('确定要离开当前房间？', { exact: true }).waitFor({ state: 'visible' });
  await primary.getByRole('button', { name: '取消', exact: true }).click();

  // ── Play full game on mobile ──
  let showcaseDone = false;
  for (let step = 0; step < 30; step += 1) {
    const before = await readState(primary);
    if (before.game?.state === 'game_over') break;
    const playerId = before.game?.current_player_id;
    const page = pagesByPlayer.get(playerId);
    assert.ok(page, `A browser page should exist for ${playerId}`);
    if (page === players[0].page && before.game?.turn_count === 2) {
      await page.screenshot({ path: path.join(outputRoot, 'my-turn-table.png') });
    }

    // Ensure a hand card is scrolled into view before tapping
    const firstCard = page.locator('[aria-label^="卡牌："]').first();
    await firstCard.scrollIntoViewIfNeeded();

    // Run showcase only on the video-recorded player's first turn
    const showcase = page === players[0].page && !showcaseDone;
    const { action, card } = await playMixedTurn(page, before, step, showcase);
    if (showcase) showcaseDone = true;
    turns.push({ turn: before.game.turn_count, player_id: playerId, action, card });
    await waitForState(primary, (turn) => {
      const state = JSON.parse(window.render_game_to_text());
      return state.game?.state === 'game_over' || state.game?.turn_count > turn;
    }, `turn ${before.game.turn_count} to finish`, before.game.turn_count);
    if (step === 5) {
      await primary.getByRole('button', { name: '打开牌桌菜单' }).click();
      await primary.getByRole('menuitem', { name: /行动记录/ }).click();
      await primary.getByText('公开行动', { exact: true }).waitFor({ state: 'visible' });
      await primary.screenshot({ path: path.join(outputRoot, 'action-history.png') });
      await primary.getByRole('button', { name: '关闭行动记录' }).click();
      await primary.screenshot({ path: path.join(outputRoot, 'mid-game-table.png') });
    }
    // Pause so the turn-change toast is visible in the video.
    await primary.waitForTimeout(400);
  }

  finalState = await readState(primary);
  assert.equal(finalState.game?.state, 'game_over');
  assert.ok(turns.length >= 15, `Expected at least 15 turns, got ${turns.length}`);
  assert.ok(finalState.game?.players.every((player) => player.hand_count === 1), 'Every player should have exactly 1 card in hand');
  assert.ok(finalState.game?.winner_id, 'The winner should be exposed through render_game_to_text');
  assert.equal(finalState.game?.public_action_count, turns.length, 'Every completed play should have one reconnect-safe public action');
  assert.equal(
    players.flatMap((player) => [...player.consoleErrors, ...player.pageErrors]).length,
    0,
    'Unexpected browser errors',
  );

  // ── Settlement flow on mobile ──
  await primary.getByRole('heading', { name: '调和揭晓' }).waitFor({ state: 'visible' });
  await primary.waitForTimeout(800);
  for (let stage = 0; stage < 3; stage += 1) {
    await primary.getByRole('button', { name: '下一步' }).click();
    await primary.waitForTimeout(600);
  }
  await primary.getByRole('heading', { name: '胜者揭晓' }).waitFor({ state: 'visible' });
  const winnerName = finalState.game.players.find((player) => player.id === finalState.game.winner_id)?.name;
  assert.ok(winnerName, 'Winner name should be present in the final state');
  await primary.getByText(new RegExp(`${winnerName} 获胜！$`)).waitFor({ state: 'visible' });
  await primary.getByText(/服务器按优先级 1 → 5 判定/).waitFor({ state: 'attached' });
  await primary.getByRole('button', { name: '重新开始一局', exact: true }).scrollIntoViewIfNeeded();
  await primary.getByRole('button', { name: '返回登录', exact: true }).waitFor({ state: 'visible' });
  // Pause so the winner screen is captured in the video.
  await primary.waitForTimeout(1500);
} catch (error) {
  testError = error;
} finally {
  if (players.length) screenshots = await savePlayerArtifacts(players, outputRoot);
  const video = players[0]?.video;
  await closePlayers(browser, players, async () => {
    if (video) await video.saveAs(videoPath).catch((error) => { if (!testError) testError = error; });
  });
  await Promise.all([stopProcess(services?.frontend), stopProcess(services?.backend)]);
}

if (!testError) {
  try { assert.ok((await fs.stat(videoPath)).size > 10_000, 'Recorded video is unexpectedly small'); } catch (error) { testError = error; }
}

await writeReport(reportPath, {
  result: testError ? 'failed' : 'passed',
  viewport: mobileViewport,
  seed,
  room_code: roomCode,
  ports: { backend: backendPort, frontend: frontendPort },
  players: players.map((player) => ({
    name: player.name,
    username: player.username,
    console_errors: player.consoleErrors,
    page_errors: player.pageErrors,
  })),
  turns_played: turns.length,
  turns,
  final_state: finalState,
  winner_parity: !testError,
  service_logs: {
    backend: services?.backend.logs ?? [],
    frontend: services?.frontend.logs ?? [],
  },
  artifacts: {
    video: path.relative(frontendRoot, videoPath),
    game_table: path.relative(frontendRoot, path.join(outputRoot, 'game-table.png')),
    decision_panel: path.relative(frontendRoot, path.join(outputRoot, 'decision-panel.png')),
    action_history: path.relative(frontendRoot, path.join(outputRoot, 'action-history.png')),
    screenshots: Object.fromEntries(
      Object.entries(screenshots).map(([name, file]) => [name, path.relative(frontendRoot, file)]),
    ),
  },
  error: testError instanceof Error ? testError.stack : null,
});

if (testError) throw testError;
console.log(`Mobile E2E passed (${mobileViewport.width}×${mobileViewport.height}): ${turns.length} turns, winner ${finalState.game.winner_id}; report: ${reportPath}`);
