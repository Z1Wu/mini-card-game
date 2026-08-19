import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFreePort, prepareOutput, startServices, stopProcess } from './lib/services.mjs';
import { closePlayers, createRoomAndLogin, findHost, openPlayers, playSmokeTurn, readState, waitForState } from './lib/players.mjs';
import { savePlayerArtifacts, savePlayerVideos, writeMultiviewArtifact, writeReport } from './lib/reporting.mjs';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.resolve(frontendRoot, '..', 'backend');
const outputRoot = await prepareOutput(frontendRoot, process.env.E2E_OUTPUT_DIR);
const rawVideoRoot = path.join(outputRoot, 'raw-video');
await fs.mkdir(rawVideoRoot, { recursive: true });
const backendPort = Number(process.env.E2E_BACKEND_PORT) || await findFreePort();
const frontendPort = Number(process.env.E2E_FRONTEND_PORT) || await findFreePort();
const seed = Number(process.env.E2E_SEED ?? 75);
const accounts = [{ username: 'player1', password: 'password1' }, { username: 'player2', password: 'password2' }, { username: 'player3', password: 'password3' }];
const reportPath = path.join(outputRoot, 'report.json');
let services;
let browser;
let players = [];
let recordingStartedAt = 0;
let roomCode;
let finalState = null;
let testError;
const turns = [];
let screenshots = {};
let videos = {};
let multiview = {};
const timeline = [];

try {
  services = await startServices({ frontendRoot, backendRoot, backendPort, frontendPort, seed });
  ({ browser, players, recordingStartedAt } = await openPlayers(accounts, { appUrl: services.appUrl, rawVideoRoot }));
  roomCode = await createRoomAndLogin(players);
  const host = await findHost(players);
  const primary = host.page;
  await primary.getByText('3 / 5', { exact: true }).waitFor({ state: 'visible' });
  await Promise.all([...players.map((player) => player.page.waitForURL('**/game')), primary.getByRole('button', { name: '开始游戏', exact: true }).click()]);
  // Pause so the initial game table (harmony target, opponent stats, hand) is visible in video.
  await primary.waitForTimeout(800);
  assert.equal(await primary.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Desktop game table should not create horizontal overflow');
  await primary.getByLabel(/调和目标 \d+，已投入 \d+ 张，当前总值未知/).waitFor({ state: 'visible' });
  await primary.screenshot({ path: path.join(outputRoot, 'game-table.png') });
  const pagesByPlayer = new Map();
  for (const player of players) pagesByPlayer.set((await readState(player.page)).connection.player_id, player.page);
  let showcaseDone = false;
  for (let step = 0; step < 30; step += 1) {
    const before = await readState(primary);
    if (before.game?.state === 'game_over') break;
    const playerId = before.game?.current_player_id;
    const page = pagesByPlayer.get(playerId);
    assert.ok(page, `A browser page should exist for ${playerId}`);
    const showcase = !showcaseDone;
    timeline.push({ at_ms: Date.now() - recordingStartedAt, player_id: playerId, label: `完整牌局：${before.game.players.find((player) => player.id === playerId)?.name ?? playerId} 第 ${before.game.turn_count + 1} 次行动` });
    const { action, card } = await playSmokeTurn(page, showcase);
    if (showcase) showcaseDone = true;
    turns.push({ turn: before.game.turn_count, player_id: playerId, action, card });
    await waitForState(primary, (turn) => { const state = JSON.parse(window.render_game_to_text()); return state.game?.state === 'game_over' || state.game?.turn_count > turn; }, `turn ${before.game.turn_count} to finish`, before.game.turn_count);
    // Pause so the turn-change toast is visible in the video.
    await primary.waitForTimeout(400);
  }
  finalState = await readState(primary);
  assert.equal(finalState.game?.state, 'game_over');
  assert.ok(turns.length >= 15, `Expected at least 15 turns, got ${turns.length}`);
  assert.ok(finalState.game?.players.every((player) => player.hand_count === 1), 'Every player should have exactly 1 card in hand');
  assert.ok(finalState.game?.winner_id, 'The winner should be exposed through render_game_to_text');
  assert.equal(finalState.game?.public_action_count, turns.length, 'Every completed play should have one reconnect-safe public action');
  assert.equal(players.flatMap((player) => [...player.consoleErrors, ...player.pageErrors]).length, 0, 'Unexpected browser errors');
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
  // Pause so the winner screen is captured in the video.
  await primary.waitForTimeout(1500);
} catch (error) {
  testError = error;
} finally {
  if (players.length) screenshots = await savePlayerArtifacts(players, outputRoot);
  await closePlayers(browser, players, async () => {
    try {
      videos = await savePlayerVideos(players, outputRoot);
      multiview = await writeMultiviewArtifact({ outputRoot, title: '完整牌局冒烟测试（跟随实际行动玩家）', players, videos, timeline, recordingStartedAt });
    } catch (error) {
      if (!testError) testError = error;
    }
  });
  await Promise.all([stopProcess(services?.frontend), stopProcess(services?.backend)]);
}

if (!testError) {
  try {
    assert.equal(Object.keys(videos).length, players.length, 'Every player should have a recording');
    for (const video of Object.values(videos)) assert.ok((await fs.stat(video)).size > 10_000, `Recorded video is unexpectedly small: ${video}`);
  } catch (error) { testError = error; }
}
await writeReport(reportPath, {
  suite: 'complete-game-smoke', result: testError ? 'failed' : 'passed', seed, room_code: roomCode, ports: { backend: backendPort, frontend: frontendPort }, players: players.map((player) => ({ name: player.name, username: player.username, console_errors: player.consoleErrors, page_errors: player.pageErrors })), turns_played: turns.length, turns, action_distribution: Object.fromEntries([...new Set(turns.map((turn) => turn.action))].map((action) => [action, turns.filter((turn) => turn.action === action).length])), final_state: finalState, winner_parity: !testError, service_logs: { backend: services?.backend.logs ?? [], frontend: services?.frontend.logs ?? [] }, artifacts: { multiview: path.relative(frontendRoot, multiview.htmlPath ?? ''), timeline: path.relative(frontendRoot, multiview.timelinePath ?? ''), videos: Object.fromEntries(Object.entries(videos).map(([name, file]) => [name, path.relative(frontendRoot, file)])), screenshots: Object.fromEntries(Object.entries(screenshots).map(([name, file]) => [name, path.relative(frontendRoot, file)])) }, error: testError instanceof Error ? testError.stack : null,
});
if (testError) throw testError;
console.log(`Recorded E2E passed: ${turns.length} turns, winner ${finalState.game.winner_id}; report: ${reportPath}`);
