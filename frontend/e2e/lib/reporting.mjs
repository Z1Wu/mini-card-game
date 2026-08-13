import fs from 'node:fs/promises';
import path from 'node:path';

export async function savePlayerArtifacts(players, outputRoot) {
  const screenshots = {};
  for (const player of players) {
    const screenshot = path.join(outputRoot, `${player.name}.png`);
    await player.page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    screenshots[player.name] = screenshot;
  }
  return screenshots;
}

export async function writeReport(reportPath, report) {
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
