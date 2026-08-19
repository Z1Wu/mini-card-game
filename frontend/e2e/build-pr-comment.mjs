import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(frontendRoot, process.env.E2E_REPORT_PATH ?? 'test-results/full-game/report.json');
const commentPath = path.join(frontendRoot, process.env.E2E_COMMENT_PATH ?? 'test-results/full-game/pr-comment.md');
const titlePrefix = process.env.E2E_TITLE_PREFIX ?? '🎮 Browser E2E';
const artifactName = process.env.E2E_ARTIFACT_NAME ?? 'browser-e2e-artifacts';

const MAX_ERROR_CHARS = 4000;
const MAX_LOG_CHARS = 3000;
const MAX_LINE_CHARS = 500;
const MAX_TURNS = 25;

function truncate(value, limit) {
  const text = String(value ?? '').trimEnd();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n…(truncated)`;
}

function runUrl() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  if (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID) {
    return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
  }
  return null;
}

function playerNames(report) {
  const map = new Map();
  for (const player of report.final_state?.game?.players ?? []) {
    if (player.id && player.name) map.set(player.id, player.name);
  }
  return map;
}

function winnerName(report) {
  const game = report.final_state?.game;
  if (!game?.winner_id) return '— (game did not finish)';
  const winner = game.players?.find((player) => player.id === game.winner_id);
  return winner?.name ?? game.winner_id;
}

function formatBrowserErrors(players) {
  const lines = [];
  for (const player of players ?? []) {
    const errors = [...(player.console_errors ?? []), ...(player.page_errors ?? [])];
    if (errors.length === 0) continue;
    lines.push(`**${player.name}**`);
    for (const error of errors) lines.push(`- ${truncate(error, MAX_LINE_CHARS)}`);
  }
  return lines.length ? lines.join('\n') : '_No console or page errors._';
}

function turnsTable(report) {
  const turns = report.turns ?? [];
  if (turns.length === 0) return '_No turns were recorded before the run ended._';
  const names = playerNames(report);
  const lines = ['| # | Player | Action | Card |', '| --- | --- | --- | --- |'];
  for (const turn of turns.slice(0, MAX_TURNS)) {
    const player = names.get(turn.player_id) ?? turn.player_id ?? '—';
    lines.push(`| ${turn.turn ?? '?'} | ${player} | ${turn.action ?? '—'} | ${turn.card ?? '—'} |`);
  }
  if (turns.length > MAX_TURNS) lines.push(`| … | _${turns.length - MAX_TURNS} more turns omitted_ | | |`);
  return lines.join('\n');
}

function scenarioTable(report) {
  const results = report.scenarios ?? [];
  if (results.length === 0) return '_No deterministic scenario results were recorded._';
  const lines = ['| Scenario | Result | Evidence |', '| --- | --- | --- |'];
  for (const result of results) lines.push(`| ${result.label ?? result.scenario} | ${result.result === 'passed' ? '✅' : '❌'} | ${result.evidence ?? '—'} |`);
  return lines.join('\n');
}

function actionDistribution(report) {
  const distribution = report.action_distribution ?? {};
  return `调和 ${distribution.harmony ?? 0} · 质疑 ${distribution.doubt ?? 0} · 特技 ${distribution.skill ?? 0}`;
}

function fence(content, language = '') {
  return ` \`\`\`${language}\n${content}\n\`\`\``;
}

async function writeComment(markdown) {
  await fs.mkdir(path.dirname(commentPath), { recursive: true });
  await fs.writeFile(commentPath, `${markdown}\n`, 'utf8');
  console.log(`Wrote PR comment: ${commentPath}`);
}

async function main() {
  let report;
  try {
    report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  } catch {
    await writeComment([
      `## ${titlePrefix} — ⚠️ No report`,
      '',
      '`report.json` was not produced. The run likely failed before the e2e finished — check the workflow logs and the `browser-e2e-artifacts` artifact.',
    ].join('\n'));
    return;
  }

  const passed = report.result === 'passed';
  const badge = passed ? '✅ Passed' : '❌ Failed';
  const url = runUrl();

  const previewUrl = process.env.MULTIVIEW_URL || process.env.WEBM_URL || '';
  const isScenarioSuite = Array.isArray(report.planned_scenarios);
  const context = [isScenarioSuite
    ? `Server-owned deterministic gameplay scenarios at ${report.viewport?.width ?? '—'}×${report.viewport?.height ?? '—'}.`
    : `Complete three-player match smoke test (seed ${report.seed ?? '—'}).`];

  const rows = [`| Result | ${badge} |`, `| Seed | ${report.seed ?? '—'} |`, `| Room code | ${report.room_code ?? '—'} |`];
  if (isScenarioSuite) {
    rows.push(
      `| Planned / hit | ${(report.planned_scenarios ?? []).length} / ${(report.hit_scenarios ?? []).length} |`,
      `| Missing coverage | ${(report.missing_coverage ?? []).join(', ') || 'none' } |`,
      `| Action distribution | ${actionDistribution(report)} |`,
    );
  } else {
    rows.push(`| Turns played | ${report.turns_played ?? 0} |`, `| Winner | ${winnerName(report)} |`, `| Action distribution | ${actionDistribution(report)} |`);
  }

  const sections = [];
  sections.push(`## ${titlePrefix} — ${badge}`, '', ...context);

  if (previewUrl) {
    sections.push('');
    sections.push(`**Multi-player recording:** [open synchronized multiview](${previewUrl})`);
    if (url) {
      sections.push('');
      sections.push(`_[Workflow run](${url}) — also available as the \`${artifactName}\` artifact._`);
    }
  } else if (url) {
    sections.push('');
    sections.push(`[Workflow run](${url}) — the \`${artifactName}\` artifact has the synchronized multiview, timeline, every player's WebM, \`report.json\`, and screenshots.`);
  }

  sections.push('', '| Field | Value |', '| --- | --- |', ...rows, '');
  if (isScenarioSuite) sections.push('### Scenario evidence', '', scenarioTable(report), '');
  else sections.push('### Turns', '', turnsTable(report), '');
  sections.push('### Browser errors', '', formatBrowserErrors(report.players));

  if (!passed) {
    sections.push('', '### Failure detail');
    if (report.error) {
      sections.push('', '<details><summary>Error stack</summary>', '', fence(truncate(report.error, MAX_ERROR_CHARS)), '</details>');
    } else {
      sections.push('', '_No captured error stack._');
    }
    for (const [name, value] of Object.entries(report.service_logs ?? {})) {
      const text = Array.isArray(value) ? value.join('') : String(value ?? '');
      if (text.trim()) {
        sections.push('', `<details><summary>${name} log (tail)</summary>`, '', fence(truncate(text, MAX_LOG_CHARS)), '</details>');
      }
    }
  }

  await writeComment(sections.join('\n'));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
