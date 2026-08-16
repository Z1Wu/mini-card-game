import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(frontendRoot, 'test-results', 'full-game', 'report.json');
const commentPath = path.join(frontendRoot, 'test-results', 'full-game', 'pr-comment.md');

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
      '## 🎮 Browser E2E — ⚠️ No report',
      '',
      '`report.json` was not produced. The run likely failed before the e2e finished — check the workflow logs and the `browser-e2e-artifacts` artifact.',
    ].join('\n'));
    return;
  }

  const passed = report.result === 'passed';
  const badge = passed ? '✅ Passed' : '❌ Failed';
  const url = runUrl();

  const videoUrl = process.env.WEBM_URL || '';
  const context = [`Recorded 3-player deterministic E2E (seed ${report.seed ?? '—'}).`];

  const rows = [
    `| Result | ${badge} |`,
    `| Turns played | ${report.turns_played ?? 0} |`,
    `| Seed | ${report.seed ?? '—'} |`,
    `| Room code | ${report.room_code ?? '—'} |`,
    `| Winner | ${winnerName(report)} |`,
  ];

  const sections = [];
  sections.push(`## 🎮 Browser E2E — ${badge}`, '', ...context);

  if (videoUrl) {
    sections.push('');
    sections.push(`**E2E recording:** [watch full-game.webm](${videoUrl})`);
    if (url) {
      sections.push('');
      sections.push(`_[Workflow run](${url}) — also available as the \`browser-e2e-artifacts\` artifact._`);
    }
  } else if (url) {
    sections.push('');
    sections.push(`[Workflow run](${url}) — the \`browser-e2e-artifacts\` artifact has the \`full-game.webm\` video, \`report.json\`, and per-player screenshots.`);
  }

  sections.push(
    '',
    '| Field | Value |',
    '| --- | --- |',
    ...rows,
    '',
    '### Turns',
    '',
    turnsTable(report),
    '',
    '### Browser errors',
    '',
    formatBrowserErrors(report.players),
  );

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
