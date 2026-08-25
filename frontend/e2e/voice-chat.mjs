/**
 * 浏览器级语音 E2E（Issue #131）：真实 Chromium + 假麦克风设备。
 *
 * 用 --use-fake-ui-for-media-stream 免权限、--use-fake-device-for-media-stream
 * 提供可录制的假音频设备，让 MediaRecorder 在浏览器里真实编码一段 Opus；
 * 宿主按住说话后，断言其他玩家的座位亮起「正在说话」徽标并随播放结束消失，
 * 且发送者自己永远看不到该徽标——覆盖 采集→编码→WS 上行→服务器转发→
 * 接收解码→播放→UI 指示 的完整浏览器链路。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFreePort, prepareOutput, startServices, stopProcess } from './lib/services.mjs';
import { closePlayers, createRoomAndLogin, findHost, openPlayers } from './lib/players.mjs';
import { savePlayerArtifacts, writeReport } from './lib/reporting.mjs';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.resolve(frontendRoot, '..', 'backend');
const outputRoot = await prepareOutput(frontendRoot, process.env.E2E_OUTPUT_DIR ?? path.join('test-results', 'voice-chat'));
const backendPort = Number(process.env.E2E_BACKEND_PORT) || await findFreePort();
const frontendPort = Number(process.env.E2E_FRONTEND_PORT) || await findFreePort();
const seed = Number(process.env.E2E_SEED ?? 75);
const accounts = [{ username: 'player1', password: 'password1' }, { username: 'player2', password: 'password2' }, { username: 'player3', password: 'password3' }];
const HOST_SEAT_NAME = '玩家1'; // player1 创建房间，必然是宿主
const reportPath = path.join(outputRoot, 'report.json');
let services;
let browser;
let players = [];
let testError;
let screenshots = {};
const events = [];

try {
  services = await startServices({ frontendRoot, backendRoot, backendPort, frontendPort, seed });
  ({ browser, players } = await openPlayers(accounts, {
    appUrl: services.appUrl,
    rawVideoRoot: path.join(outputRoot, 'raw-video'),
    browserArgs: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  }));
  await createRoomAndLogin(players);
  const host = await findHost(players);
  const joiners = players.filter(player => player !== host);
  const hostName = players.find(player => player === host).username.replace('player', '玩家');

  await Promise.all([
    ...players.map(player => player.page.waitForURL('**/game')),
    host.page.getByRole('button', { name: '开始游戏', exact: true }).click(),
  ]);
  for (const player of players) {
    await player.page.getByLabel(/调和目标 \d+，已投入 \d+ 张，当前总值未知/).waitFor({ state: 'visible' });
    await player.page.getByRole('button', { name: '按住说话' }).waitFor({ state: 'visible' });
  }

  const seatOfSpeakerOn = page => page.locator('.table-seat', { hasText: hostName });
  async function expectBadge(page, state, timeout) {
    await seatOfSpeakerOn(page).locator('.table-seat-speaking-badge').waitFor({ state, timeout });
  }

  async function holdToTalk(durationMs, label) {
    const button = host.page.getByRole('button', { name: /按住说话|松开结束说话/ });
    await button.hover();
    events.push({ at_ms: Date.now(), event: `${label}:press` });
    await host.page.mouse.down();
    await host.page.waitForTimeout(durationMs);
    await host.page.mouse.up();
    events.push({ at_ms: Date.now(), event: `${label}:release` });
  }

  // ── 第一段：较长录音，两个听众都应看到宿主「正在说话」 ──
  await holdToTalk(1600, 'burst-1');
  for (const joiner of joiners) {
    await expectBadge(joiner.page, 'visible', 15_000);
    await joiner.page.locator('.table-seats').screenshot({ path: path.join(outputRoot, `${joiner.name}-speaking.png`) }).catch(() => {});
  }
  // 发送者不回发：宿主页任何座位都不出现徽标（自己的手牌区也不是 seat）。
  assert.equal(await host.page.locator('.table-seat-speaking-badge').count(), 0, 'Sender must never see a speaking badge');
  events.push({ at_ms: Date.now(), event: 'burst-1:badges-visible' });

  // 徽标随接收端播放结束而消失。
  await Promise.all(joiners.map(joiner => expectBadge(joiner.page, 'hidden', 20_000)));
  events.push({ at_ms: Date.now(), event: 'burst-1:playback-done' });

  // ── 第二段：短录音，验证每次按下都新建录制器且可重复使用 ──
  await holdToTalk(900, 'burst-2');
  await Promise.all(joiners.map(joiner => expectBadge(joiner.page, 'visible', 15_000)));
  await Promise.all(joiners.map(joiner => expectBadge(joiner.page, 'hidden', 20_000)));

  assert.equal(players.flatMap(player => [...player.consoleErrors, ...player.pageErrors]).length, 0, 'Unexpected browser errors');
} catch (error) {
  testError = error;
} finally {
  if (players.length) screenshots = await savePlayerArtifacts(players, outputRoot).catch(() => ({}));
  await closePlayers(browser, players);
  await Promise.all([stopProcess(services?.frontend), stopProcess(services?.backend)]);
}

await writeReport(reportPath, {
  suite: 'voice-chat-push-to-talk',
  result: testError ? 'failed' : 'passed',
  room_code: null,
  ports: { backend: backendPort, frontend: frontendPort },
  players: players.map(player => ({ name: player.name, username: player.username, console_errors: player.consoleErrors, page_errors: player.pageErrors })),
  events,
  artifacts: { screenshots: Object.fromEntries(Object.entries(screenshots).map(([name, file]) => [name, path.relative(frontendRoot, file)])) },
  error: testError instanceof Error ? testError.stack : null,
});
if (testError) throw testError;
console.log(`Voice chat E2E passed: ${events.length} events; report: ${reportPath}`);
