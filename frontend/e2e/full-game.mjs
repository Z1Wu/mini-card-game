import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFreePort, prepareOutput, startServices, stopProcess } from './lib/services.mjs';
import { chooseFirstVisibleCard, closePlayers, createRoomAndLogin, findHost, openPlayers, playMixedTurn, readState, waitForState } from './lib/players.mjs';
import { savePlayerArtifacts, writeReport } from './lib/reporting.mjs';

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
const videoPath = path.join(outputRoot, 'full-game.webm');
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
  ({ browser, players } = await openPlayers(accounts, { appUrl: services.appUrl, rawVideoRoot }));
  roomCode = await createRoomAndLogin(players);
  const host = await findHost(players);
  const primary = host.page;
  await primary.getByText('3 / 5', { exact: true }).waitFor({ state: 'visible' });
  await Promise.all([...players.map((player) => player.page.waitForURL('**/game')), primary.getByRole('button', { name: '开始游戏', exact: true }).click()]);
  // Pause so the initial game table (harmony target, opponent stats, hand) is visible in video.
  await primary.waitForTimeout(800);
  const pagesByPlayer = new Map();
  for (const player of players) pagesByPlayer.set((await readState(player.page)).connection.player_id, player.page);
  for (let step = 0; step < 30; step += 1) {
    const before = await readState(primary);
    if (before.game?.state === 'game_over') break;
    const playerId = before.game?.current_player_id;
    const page = pagesByPlayer.get(playerId);
    assert.ok(page, `A browser page should exist for ${playerId}`);
    const { action, card } = await playMixedTurn(page, before, step);
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
  result: testError ? 'failed' : 'passed', seed, room_code: roomCode, ports: { backend: backendPort, frontend: frontendPort }, players: players.map((player) => ({ name: player.name, username: player.username, console_errors: player.consoleErrors, page_errors: player.pageErrors })), turns_played: turns.length, turns, final_state: finalState, winner_parity: !testError, service_logs: { backend: services?.backend.logs ?? [], frontend: services?.frontend.logs ?? [] }, artifacts: { video: path.relative(frontendRoot, videoPath), screenshots: Object.fromEntries(Object.entries(screenshots).map(([name, file]) => [name, path.relative(frontendRoot, file)])) }, error: testError instanceof Error ? testError.stack : null,
});
if (testError) throw testError;
console.log(`Recorded E2E passed: ${turns.length} turns, winner ${finalState.game.winner_id}; report: ${reportPath}`);
