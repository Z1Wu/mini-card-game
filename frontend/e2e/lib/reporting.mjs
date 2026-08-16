import fs from 'node:fs/promises';
import path from 'node:path';

export async function savePlayerArtifacts(players, outputRoot) {
  const screenshots = {};
  for (const player of players) {
    const screenshot = path.join(outputRoot, `${player.name}.png`);
    const clip = await player.page.evaluate(() => ({
      x: 0, y: 0, width: window.innerWidth, height: window.innerHeight,
    }));
    await player.page.screenshot({ path: screenshot, clip }).catch(() => {});
    screenshots[player.name] = screenshot;
  }
  return screenshots;
}

export async function writeReport(reportPath, report) {
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
