import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFreePort, prepareOutput, startServices, stopProcess } from './lib/services.mjs';
import { closePlayers, createRoomAndLogin, findHost, openPlayers, readState, waitForState } from './lib/players.mjs';
import { savePlayerArtifacts, savePlayerVideos, writeMultiviewArtifact, writeReport } from './lib/reporting.mjs';
import { SCENARIO_MODULES } from './scenarios/index.mjs';

// The scenario implementations live in `frontend/e2e/scenarios/<card>.mjs`,
// one module per card effect. This file only orchestrates them: parse
// arguments, boot the seeded services with the E2E fixture flag, reset the
// server-owned fixture before each scenario, collect evidence, and write the
// report consumed by CI.
const ALL_SCENARIOS = SCENARIO_MODULES.map((scenario) => scenario.name);
const LABELS = Object.fromEntries(SCENARIO_MODULES.map((scenario) => [scenario.name, scenario.label]));
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.resolve(frontendRoot, '..', 'backend');
const viewportArgument = process.argv.find((argument) => argument.startsWith('--viewport='))?.split('=')[1] ?? '1280x720';
const [viewportWidth, viewportHeight] = viewportArgument.split('x').map(Number);
assert.ok(Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight), `Invalid viewport: ${viewportArgument}`);
const viewport = { width: viewportWidth, height: viewportHeight };
const requested = process.argv.find((argument) => argument.startsWith('--scenarios='))?.split('=')[1];
const planned = requested ? requested.split(',').filter(Boolean) : ALL_SCENARIOS;
assert.ok(planned.length > 0, 'At least one deterministic scenario is required');
for (const scenario of planned) assert.ok(ALL_SCENARIOS.includes(scenario), `Unknown scenario requested: ${scenario} (known: ${ALL_SCENARIOS.join(', ')})`);
const isMobile = viewport.width === 844 && viewport.height === 390;
const outputRoot = await prepareOutput(frontendRoot, process.env.E2E_OUTPUT_DIR ?? (isMobile ? 'test-results/mobile-game' : 'test-results/scenarios'));
const rawVideoRoot = path.join(outputRoot, 'raw-video');
await fs.mkdir(rawVideoRoot, { recursive: true });
const backendPort = Number(process.env.E2E_BACKEND_PORT) || await findFreePort();
const frontendPort = Number(process.env.E2E_FRONTEND_PORT) || await findFreePort();
const seed = Number(process.env.E2E_SEED ?? 122);
const dwell = process.env.E2E_SHOWCASE === '1' ? 1_000 : 220;
const accounts = [1, 2, 3, 4].map((number) => ({ username: `player${number}`, password: `password${number}` }));
const reportPath = path.join(outputRoot, 'report.json');

let services;
let browser;
let players = [];
let recordingStartedAt = 0;
let roomCode;
let testError;
let screenshots = {};
let videos = {};
let multiview = {};
let pagesById = new Map();
const timeline = [];
const hits = new Set();
const actions = [];
const scenarioResults = [];
let mobileChromeCaptured = false;

function actionDistribution() {
  const distribution = { harmony: 0, doubt: 0, skill: 0 };
  for (const action of actions) distribution[action.action] += 1;
  return distribution;
}

async function showScenarioTitle(label, actorId = 'player1') {
  timeline.push({ at_ms: Date.now() - recordingStartedAt, player_id: actorId, label });
  await Promise.all(players.map((player) => player.page.evaluate((text) => {
    document.querySelector('[data-e2e-scenario-title]')?.remove();
    const title = document.createElement('div');
    title.dataset.e2eScenarioTitle = 'true';
    title.textContent = text;
    title.style.cssText = 'position:fixed;z-index:9999;left:12px;top:48px;max-width:70vw;padding:8px 12px;border-radius:8px;background:rgba(15,23,42,.94);color:white;border:2px solid #f59e0b;font:700 16px system-ui;pointer-events:none';
    document.body.append(title);
  }, label)));
  await players[0].page.waitForTimeout(dwell);
  await Promise.all(players.map((player) => player.page.evaluate(() => document.querySelector('[data-e2e-scenario-title]')?.remove())));
}

async function saveScenarioScreenshot(name, page) {
  await page.locator('.play-feedback-toast').waitFor({ state: 'hidden' }).catch(() => {});
  const file = path.join(outputRoot, `${name}.png`);
  await page.screenshot({ path: file });
  screenshots[name] = file;
}

/** Scenario execution context handed to every module's run(). */
function scenarioContext() {
  return {
    actorPage: pagesById.get('player1'),
    pagesById,
    players,
    screenshot: saveScenarioScreenshot,
    showTitle: showScenarioTitle,
  };
}

async function initializeScenario(scenario, host, byId) {
  const actorHandSize = scenario.actorHandSize ?? 3;
  await showScenarioTitle(`${planned.indexOf(scenario.name) + 1}/${planned.length} · ${LABELS[scenario.name]}`);
  await host.page.evaluate((fixture) => {
    if (!window.initialize_e2e_scenario) throw new Error('E2E scenario hook is unavailable');
    window.initialize_e2e_scenario(fixture);
  }, scenario.name);
  await Promise.all(players.map((player, index) => {
    const expectedSize = index === 0 ? actorHandSize : 3;
    return waitForState(
      player.page,
      ([size]) => { const state = JSON.parse(window.render_game_to_text()); return state.game?.state === 'playing' && state.game?.turn_count === 0 && state.game?.public_action_count === 0 && state.game?.own_hand?.length === size; },
      `${scenario.name} fixture to reach ${player.username}`,
      expectedSize,
    );
  }));
  for (const [index, player] of players.entries()) {
    const expectedSize = index === 0 ? actorHandSize : 3;
    assert.equal(await player.page.locator('.table-hand [aria-label^="卡牌："]').count(), expectedSize, `${scenario.name}: ${player.username} should see exactly its own cards`);
    assert.ok(await player.page.locator('.table-seat-cards [aria-label="牌背"]').count() > 0, `${scenario.name}: opponent hands should render only as card backs`);
  }
  const state = await readState(host.page);
  assert.equal(state.game.current_player_id, 'player1', `${scenario.name}: player1 must be the deterministic actor`);
  assert.equal(byId.get('player1'), players[0].page);
  return state;
}

try {
  services = await startServices({ frontendRoot, backendRoot, backendPort, frontendPort, seed, enableScenarios: true });
  ({ browser, players, recordingStartedAt } = await openPlayers(accounts, { appUrl: services.appUrl, rawVideoRoot, viewport }));
  roomCode = await createRoomAndLogin(players);
  const host = await findHost(players);
  pagesById = new Map();
  for (const player of players) pagesById.set((await readState(player.page)).connection.player_id, player.page);
  const modulesByName = new Map(SCENARIO_MODULES.map((scenario) => [scenario.name, scenario]));
  for (const scenarioName of planned) {
    const scenario = modulesByName.get(scenarioName);
    const initial = await initializeScenario(scenario, host, pagesById);
    assert.equal(initial.game.public_actions.length, 0);
    if (isMobile && !mobileChromeCaptured) {
      const playerView = pagesById.get('player1');
      await playerView.getByLabel(/我的视角：/).waitFor({ state: 'visible' });
      const menuOverlapsSeat = await playerView.evaluate(() => {
        const menu = document.querySelector('.game-menu-trigger')?.getBoundingClientRect();
        if (!menu) return true;
        return [...document.querySelectorAll('.table-seat')].some((seat) => {
          const box = seat.getBoundingClientRect();
          return menu.left < box.right && menu.right > box.left && menu.top < box.bottom && menu.bottom > box.top;
        });
      });
      assert.equal(menuOverlapsSeat, false, 'Mobile table menu should not overlap an opponent seat');
      await playerView.getByRole('button', { name: '打开牌桌菜单' }).click();
      await playerView.getByRole('menu', { name: '牌桌菜单' }).waitFor({ state: 'visible' });
      await saveScenarioScreenshot('mobile-player-view-menu', playerView);
      await playerView.getByRole('button', { name: '打开牌桌菜单' }).click();
      mobileChromeCaptured = true;
    }
    try {
      const outcome = await scenario.run(scenarioContext());
      hits.add(scenario.name);
      for (const extra of outcome.extraCoverage ?? []) hits.add(extra);
      actions.push(...(outcome.actions ?? []));
      scenarioResults.push({ scenario: scenario.name, label: LABELS[scenario.name], result: 'passed', evidence: outcome.evidence });
    } catch (error) {
      scenarioResults.push({ scenario: scenario.name, label: LABELS[scenario.name], result: 'failed', evidence: error instanceof Error ? error.message.split('\n')[0] : String(error) });
      throw error;
    }
    await players[0].page.waitForTimeout(dwell);
  }
  const requiredCoverage = [...planned];
  if (planned.some((scenario) => ['class-representative', 'honor-student'].includes(scenario))) requiredCoverage.push('waiting-panel', 'result-panel');
  const missing = [...new Set(requiredCoverage)].filter((scenario) => !hits.has(scenario));
  assert.deepEqual(missing, [], `Missing deterministic coverage: ${missing.join(', ')}`);
  assert.equal(players.flatMap((player) => [...player.consoleErrors, ...player.pageErrors]).length, 0, 'Unexpected browser errors');
} catch (error) {
  testError = error;
} finally {
  if (players.length) screenshots = { ...screenshots, ...(await savePlayerArtifacts(players, outputRoot).catch(() => ({}))) };
  await closePlayers(browser, players, async () => {
    try {
      videos = await savePlayerVideos(players, outputRoot);
      multiview = await writeMultiviewArtifact({ outputRoot, title: `${isMobile ? '844×390 关键场景' : '确定性玩法场景'}（多视角）`, players, videos, timeline, recordingStartedAt });
    } catch (error) {
      if (!testError) testError = error;
    }
  });
  await Promise.all([stopProcess(services?.frontend), stopProcess(services?.backend)]);
}

if (!testError) {
  try {
    assert.equal(Object.keys(videos).length, players.length, 'Every scenario player should have a recording');
    for (const video of Object.values(videos)) assert.ok((await fs.stat(video)).size > 10_000, `Recorded video is unexpectedly small: ${video}`);
  } catch (error) { testError = error; }
}
const requiredCoverage = [...planned, ...(planned.some((scenario) => ['class-representative', 'honor-student'].includes(scenario)) ? ['waiting-panel', 'result-panel'] : [])];
const missingCoverage = [...new Set(requiredCoverage)].filter((scenario) => !hits.has(scenario));
await writeReport(reportPath, {
  suite: isMobile ? 'mobile-key-scenarios' : 'deterministic-gameplay-scenarios',
  result: testError ? 'failed' : 'passed', viewport, seed, room_code: roomCode,
  planned_scenarios: [...new Set(requiredCoverage)], hit_scenarios: [...hits], missing_coverage: missingCoverage,
  action_distribution: actionDistribution(), actions, scenarios: scenarioResults,
  players: players.map((player) => ({ name: player.name, username: player.username, console_errors: player.consoleErrors, page_errors: player.pageErrors })),
  service_logs: { backend: services?.backend.logs ?? [], frontend: services?.frontend.logs ?? [] },
  artifacts: {
    multiview: path.relative(frontendRoot, multiview.htmlPath ?? ''), timeline: path.relative(frontendRoot, multiview.timelinePath ?? ''),
    videos: Object.fromEntries(Object.entries(videos).map(([name, file]) => [name, path.relative(frontendRoot, file)])),
    screenshots: Object.fromEntries(Object.entries(screenshots).map(([name, file]) => [name, path.relative(frontendRoot, file)])),
  },
  error: testError instanceof Error ? testError.stack : null,
});
if (testError) throw testError;
console.log(`Deterministic E2E passed (${viewport.width}×${viewport.height}): ${[...hits].join(', ')}; report: ${reportPath}`);
