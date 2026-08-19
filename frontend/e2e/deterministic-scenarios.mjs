import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFreePort, prepareOutput, startServices, stopProcess } from './lib/services.mjs';
import { chooseFirstVisibleCard, chooseVisibleCard, closePlayers, createRoomAndLogin, findHost, openPlayers, readState, waitForState } from './lib/players.mjs';
import { savePlayerArtifacts, savePlayerVideos, writeMultiviewArtifact, writeReport } from './lib/reporting.mjs';

const ALL_SCENARIOS = [
  'harmony', 'doubt', 'library-committee', 'home-club', 'health-committee',
  'discipline-committee', 'news-club', 'rich-girl', 'accomplice', 'infected',
  'class-representative', 'honor-student',
];
const LABELS = {
  harmony: '调和与隐藏归属', doubt: '质疑与目标归属', 'library-committee': '图书委员查看调和区',
  'home-club': '归宅部交换隐藏调和牌', 'health-committee': '保健委员收回公开场牌',
  'discipline-committee': '风纪委员私下查看手牌', 'news-club': '新闻部逐人传牌',
  'rich-girl': '大小姐两阶段交换', accomplice: '共犯移动质疑牌', infected: '感染者下回合拿牌',
  'class-representative': '班长双方选牌交换', 'honor-student': '优等生等待举手与结果',
  'waiting-panel': '等待面板', 'result-panel': '结果面板',
};
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.resolve(frontendRoot, '..', 'backend');
const viewportArgument = process.argv.find((argument) => argument.startsWith('--viewport='))?.split('=')[1] ?? '1280x720';
const [viewportWidth, viewportHeight] = viewportArgument.split('x').map(Number);
assert.ok(Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight), `Invalid viewport: ${viewportArgument}`);
const viewport = { width: viewportWidth, height: viewportHeight };
const requested = process.argv.find((argument) => argument.startsWith('--scenarios='))?.split('=')[1];
const planned = requested ? requested.split(',').filter(Boolean) : ALL_SCENARIOS;
assert.ok(planned.length > 0, 'At least one deterministic scenario is required');
for (const scenario of planned) assert.ok(ALL_SCENARIOS.includes(scenario), `Unknown scenario requested: ${scenario}`);
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
  await page.locator('.play-feedback-toast').waitFor({ state: 'hidden' });
  const file = path.join(outputRoot, `${name}.png`);
  await page.screenshot({ path: file });
  screenshots[name] = file;
}

async function initializeScenario(name, host, pagesById) {
  await showScenarioTitle(`${planned.indexOf(name) + 1}/${planned.length} · ${LABELS[name]}`);
  await host.page.evaluate((scenario) => {
    if (!window.initialize_e2e_scenario) throw new Error('E2E scenario hook is unavailable');
    window.initialize_e2e_scenario(scenario);
  }, name);
  await Promise.all(players.map((player) => player.page.waitForURL('**/game')));
  await Promise.all(players.map((player) => waitForState(
    player.page,
    () => { const state = JSON.parse(window.render_game_to_text()); return state.game?.state === 'playing' && state.game?.turn_count === 0 && state.game?.public_action_count === 0 && state.game?.own_hand?.length === 3; },
    `${name} fixture to reach ${player.username}`,
  )));
  for (const player of players) {
    assert.equal(await player.page.locator('.table-hand [aria-label^="卡牌："]').count(), 3, `${name}: ${player.username} should see exactly its own three cards`);
    assert.ok(await player.page.locator('.table-seat-cards [aria-label="牌背"]').count() > 0, `${name}: opponent hands should render only as card backs`);
  }
  const state = await readState(host.page);
  assert.equal(state.game.current_player_id, 'player1', `${name}: player1 must be the deterministic actor`);
  assert.equal(pagesById.get('player1'), players[0].page);
  return state;
}

async function waitForAction(page, usageType, cardName, targetPlayerId = null) {
  await waitForState(page, ([usage, card, target]) => {
    const state = JSON.parse(window.render_game_to_text());
    const action = state.game?.latest_public_action;
    return action?.usage_type === usage && action?.card_name === card && (target === null || action?.target_player_id === target);
  }, `${cardName ?? usageType} public action`, [usageType, cardName, targetPlayerId]);
}

function markScenario(name, evidence, scenarioActions = []) {
  hits.add(name);
  actions.push(...scenarioActions);
  scenarioResults.push({ scenario: name, label: LABELS[name], result: 'passed', evidence });
}

async function scenarioHarmony(page) {
  await chooseVisibleCard(page, '图书委员', '调和');
  await waitForAction(page, '调和', null);
  const state = await readState(page);
  assert.equal(state.game.harmony_card_count, 1);
  assert.equal(state.game.players.find((player) => player.id === 'player1').hand_count, 2);
  markScenario('harmony', '调和区新增一张隐藏牌，行动者手牌减少一张', [{ action: 'harmony', scenario: 'harmony', player_id: 'player1' }]);
}

async function scenarioDoubt(page) {
  await chooseVisibleCard(page, '图书委员', '质疑');
  await page.getByText('选择要质疑的玩家', { exact: true }).waitFor({ state: 'visible' });
  await saveScenarioScreenshot('doubt-target', page);
  await page.getByRole('button', { name: '玩家2', exact: true }).click();
  await waitForAction(page, '质疑', null, 'player2');
  const state = await readState(page);
  assert.equal(state.game.players.find((player) => player.id === 'player2').doubt_card_count, 1);
  markScenario('doubt', '公开行动记录目标为 player2，且质疑牌归属 player2', [{ action: 'doubt', scenario: 'doubt', player_id: 'player1' }]);
}

async function scenarioLibrary(page, pagesById) {
  await chooseVisibleCard(page, '图书委员', '特技');
  const heading = page.getByRole('heading', { name: '图书委员：调和区所有卡牌' });
  await heading.waitFor({ state: 'visible' });
  await page.getByLabel('卡牌：学生会长', { exact: true }).waitFor({ state: 'visible' });
  for (const id of ['player2', 'player3', 'player4']) assert.equal(await pagesById.get(id).getByRole('heading', { name: '图书委员：调和区所有卡牌' }).count(), 0);
  await saveScenarioScreenshot('library-private-result', page);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await waitForAction(page, '特技', '图书委员');
  markScenario('library-committee', '仅行动者看到调和区真实牌面，公开记录显示正面特技', [{ action: 'skill', scenario: 'library-committee', player_id: 'player1' }]);
}

async function scenarioHome(page) {
  await chooseVisibleCard(page, '归宅部', '特技');
  const modal = page.locator('.game-modal').filter({ hasText: '归宅部：选择一张手牌与调和区的一张牌进行替换' });
  await modal.waitFor({ state: 'visible' });
  await modal.getByLabel('卡牌：保健委员', { exact: true }).click();
  await modal.getByLabel('牌背', { exact: true }).click();
  await saveScenarioScreenshot('home-club-choice', page);
  await modal.getByRole('button', { name: '确认替换', exact: true }).click();
  await waitForAction(page, '特技', '归宅部');
  const state = await readState(page);
  assert.ok(state.game.own_hand.some((card) => card.name === '学生会长'));
  assert.ok(!state.game.own_hand.some((card) => card.name === '保健委员'));
  assert.equal(state.game.harmony_card_count, 1);
  markScenario('home-club', '手牌保健委员与隐藏调和牌交换，调和区数量保持不变', [{ action: 'skill', scenario: 'home-club', player_id: 'player1' }]);
}

async function scenarioHealth(page) {
  await chooseVisibleCard(page, '保健委员', '特技');
  const modal = page.locator('.game-modal').filter({ hasText: '保健委员：选择一张场上正面朝上的卡牌' });
  await modal.waitFor({ state: 'visible' });
  await modal.getByLabel('卡牌：图书委员', { exact: true }).click();
  await saveScenarioScreenshot('health-committee-choice', page);
  await modal.getByRole('button', { name: '确认选择', exact: true }).click();
  await waitForAction(page, '特技', '保健委员', 'player2');
  const state = await readState(page);
  assert.equal(state.game.players.find((player) => player.id === 'player2').field_card_count, 0);
  assert.ok(state.game.own_hand.some((card) => card.name === '图书委员'));
  markScenario('health-committee', 'player2 的公开场牌被服务端移入行动者私有手牌', [{ action: 'skill', scenario: 'health-committee', player_id: 'player1' }]);
}

async function scenarioDiscipline(page, pagesById) {
  await chooseVisibleCard(page, '风纪委员', '特技');
  await page.getByRole('button', { name: '玩家2', exact: true }).click();
  const heading = page.getByRole('heading', { name: '风纪委员：玩家2 的手牌' });
  await heading.waitFor({ state: 'visible' });
  assert.equal(await page.locator('.game-modal [aria-label^="卡牌："]').count(), 3);
  for (const id of ['player2', 'player3', 'player4']) assert.equal(await pagesById.get(id).getByRole('heading', { name: '风纪委员：玩家2 的手牌' }).count(), 0);
  await saveScenarioScreenshot('discipline-private-result', page);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await waitForAction(page, '特技', '风纪委员', 'player2');
  markScenario('discipline-committee', '仅行动者收到并渲染 player2 的三张私有手牌', [{ action: 'skill', scenario: 'discipline-committee', player_id: 'player1' }]);
}

async function chooseFirstModalCard(page) {
  const modal = page.locator('.game-modal').filter({ hasText: /新闻部：选择一张手牌递给/ });
  await modal.waitFor({ state: 'visible' });
  const card = modal.locator('[aria-label^="卡牌："]').first();
  await card.click();
  await modal.getByRole('button', { name: '确认递给下家', exact: true }).click();
}

async function scenarioNews(page, pagesById) {
  await chooseVisibleCard(page, '新闻部', '特技');
  await waitForAction(page, '特技', '新闻部');
  const chooserOrder = ['player1', 'player2', 'player3', 'player4'];
  for (const chooser of chooserOrder) {
    await showScenarioTitle(`新闻部传牌 · ${chooser} 正在选择`, chooser);
    await chooseFirstModalCard(pagesById.get(chooser));
  }
  await waitForState(page, () => JSON.parse(window.render_game_to_text()).game?.turn_count > 0, 'news club rotation to complete');
  markScenario('news-club', '四名玩家依次在各自页面选择，最后才推进回合', [{ action: 'skill', scenario: 'news-club', player_id: 'player1' }]);
}

async function scenarioRichGirl(page, pagesById) {
  await chooseVisibleCard(page, '大小姐', '特技');
  await page.getByRole('button', { name: '玩家2', exact: true }).click();
  let modal = page.locator('.game-modal').filter({ hasText: /大小姐：从 玩家2 手牌选一张拿取/ });
  await modal.waitFor({ state: 'visible' });
  assert.ok(await modal.getByText('牌背', { exact: true }).count() > 0);
  assert.equal(await modal.locator('[aria-label^="卡牌："]').count(), 0, 'Target card identities must stay hidden before take confirmation');
  assert.equal(await pagesById.get('player2').getByText(/大小姐：从 玩家2 手牌选一张拿取/).count(), 0);
  await modal.getByText('牌背', { exact: true }).first().click();
  await saveScenarioScreenshot('rich-girl-hidden-take', page);
  await modal.getByRole('button', { name: '确认（查看拿到的牌）', exact: true }).click();
  modal = page.locator('.game-modal').filter({ hasText: /选择要交给 玩家2 的牌/ });
  await modal.waitFor({ state: 'visible' });
  assert.ok(await modal.locator('[aria-label^="卡牌："]').count() > 0, 'Actor should see its give choices after the private take');
  const giveChoices = modal.locator('.mb-4').filter({ hasText: '选择要交给对方的牌' });
  await giveChoices.locator('[aria-label^="卡牌："]').first().click();
  await saveScenarioScreenshot('rich-girl-give', page);
  await modal.getByRole('button', { name: '确认交换', exact: true }).click();
  await waitForAction(page, '特技', '大小姐', 'player2');
  markScenario('rich-girl', '目标手牌先保持牌背，行动者确认拿牌后私下选择交还牌', [{ action: 'skill', scenario: 'rich-girl', player_id: 'player1' }]);
}

async function scenarioAccomplice(page) {
  await chooseVisibleCard(page, '共犯', '特技');
  const modal = page.locator('.game-modal').filter({ hasText: '共犯：移动一张质疑牌' });
  await modal.getByRole('button', { name: '玩家2 的质疑牌 1', exact: true }).click();
  await modal.getByRole('button', { name: '玩家3', exact: true }).click();
  await saveScenarioScreenshot('accomplice-move', page);
  await modal.getByRole('button', { name: '确认移动', exact: true }).click();
  await waitForAction(page, '特技', '共犯', 'player3');
  const state = await readState(page);
  assert.equal(state.game.players.find((player) => player.id === 'player2').doubt_card_count, 0);
  assert.equal(state.game.players.find((player) => player.id === 'player3').doubt_card_count, 1);
  markScenario('accomplice', '质疑牌从 player2 原子移动到 player3', [{ action: 'skill', scenario: 'accomplice', player_id: 'player1' }]);
}

async function scenarioInfected(page, pagesById) {
  await chooseVisibleCard(page, '感染者', '特技');
  await waitForAction(page, '特技', '感染者');
  actions.push({ action: 'skill', scenario: 'infected', player_id: 'player1' });
  for (const follower of ['player2', 'player3', 'player4']) {
    await showScenarioTitle(`感染者等待下回合 · ${follower} 调和`, follower);
    await chooseFirstVisibleCard(pagesById.get(follower), '调和', ['犯人']);
    actions.push({ action: 'harmony', scenario: 'infected-setup', player_id: follower });
  }
  const modal = page.locator('.game-modal').filter({ hasText: '感染者：回合开始效果' });
  await modal.waitFor({ state: 'visible' });
  await saveScenarioScreenshot('infected-next-turn', page);
  await modal.getByRole('button', { name: '调和牌 1', exact: true }).click();
  await modal.getByRole('button', { name: '拿取所选牌', exact: true }).click();
  await waitForState(page, () => { const state = JSON.parse(window.render_game_to_text()); return state.game?.state === 'playing' && state.game?.own_hand?.length === 3; }, 'infected take to resolve');
  hits.add('infected');
  scenarioResults.push({ scenario: 'infected', label: LABELS.infected, result: 'passed', evidence: '三名其他玩家行动后，感染者仅在自己的下回合收到一次拿牌提示' });
}

async function scenarioClassRepresentative(page, pagesById) {
  await chooseVisibleCard(page, '班长', '特技');
  await page.getByRole('button', { name: '玩家2', exact: true }).click();
  let modal = page.locator('.game-modal').filter({ hasText: /班长：选一张手牌与 玩家2 交换/ });
  await modal.locator('[aria-label^="卡牌："]').first().click();
  await modal.getByRole('button', { name: '确认', exact: true }).click();
  await page.getByText('正在等待 玩家2 选牌', { exact: true }).waitFor({ state: 'visible' });
  hits.add('waiting-panel');
  await saveScenarioScreenshot('class-representative-waiting', page);
  const target = pagesById.get('player2');
  modal = target.locator('.game-modal').filter({ hasText: /班长：选一张手牌与 玩家1 交换/ });
  await modal.locator('[aria-label^="卡牌："]').first().click();
  await modal.getByRole('button', { name: '确认', exact: true }).click();
  await waitForAction(page, '特技', '班长', 'player2');
  const actorResult = page.getByRole('heading', { name: '班长：交换结果' });
  const targetResult = target.getByRole('heading', { name: '班长：交换结果' });
  await Promise.all([actorResult.waitFor({ state: 'visible' }), targetResult.waitFor({ state: 'visible' })]);
  hits.add('result-panel');
  await saveScenarioScreenshot('class-representative-result', page);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await target.getByRole('button', { name: '关闭', exact: true }).click();
  markScenario('class-representative', '行动者等待目标选牌，双方随后看到各自交换结果', [{ action: 'skill', scenario: 'class-representative', player_id: 'player1' }]);
}

async function scenarioHonorStudent(page, pagesById) {
  await chooseVisibleCard(page, '优等生', '特技');
  await page.getByText(/正在等待其他人举手/).first().waitFor({ state: 'visible' });
  hits.add('waiting-panel');
  await pagesById.get('player2').getByText('优等生特技：你持有犯人卡，必须举手示意', { exact: true }).waitFor({ state: 'visible' });
  await pagesById.get('player3').getByText('优等生特技：你持有外星人卡，可以假装犯人举手', { exact: true }).waitFor({ state: 'visible' });
  assert.equal(await pagesById.get('player4').getByText(/优等生特技：/).count(), 0);
  await saveScenarioScreenshot('honor-student-waiting', page);
  await pagesById.get('player2').getByRole('button', { name: '举手', exact: true }).click();
  await pagesById.get('player3').getByRole('button', { name: '举手（假装犯人）', exact: true }).click();
  const result = page.getByRole('heading', { name: '优等生：举手结果' });
  await result.waitFor({ state: 'visible' });
  await page.getByText('举手的人：玩家2、玩家3', { exact: true }).waitFor({ state: 'visible' });
  hits.add('result-panel');
  await saveScenarioScreenshot('honor-student-result', page);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await waitForAction(page, '特技', '优等生');
  markScenario('honor-student', '犯人强制举手、外星人主动伪装、无关玩家无私有提示，行动者收到汇总结果', [{ action: 'skill', scenario: 'honor-student', player_id: 'player1' }]);
}

const runners = {
  harmony: (page) => scenarioHarmony(page), doubt: (page) => scenarioDoubt(page),
  'library-committee': scenarioLibrary, 'home-club': (page) => scenarioHome(page),
  'health-committee': (page) => scenarioHealth(page), 'discipline-committee': scenarioDiscipline,
  'news-club': scenarioNews, 'rich-girl': scenarioRichGirl, accomplice: (page) => scenarioAccomplice(page),
  infected: scenarioInfected, 'class-representative': scenarioClassRepresentative,
  'honor-student': scenarioHonorStudent,
};

try {
  services = await startServices({ frontendRoot, backendRoot, backendPort, frontendPort, seed, enableScenarios: true });
  ({ browser, players, recordingStartedAt } = await openPlayers(accounts, { appUrl: services.appUrl, rawVideoRoot, viewport }));
  roomCode = await createRoomAndLogin(players);
  const host = await findHost(players);
  const pagesById = new Map();
  for (const player of players) pagesById.set((await readState(player.page)).connection.player_id, player.page);
  for (const scenario of planned) {
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
    await runners[scenario](pagesById.get('player1'), pagesById);
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
  if (players.length) screenshots = { ...screenshots, ...(await savePlayerArtifacts(players, outputRoot)) };
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
