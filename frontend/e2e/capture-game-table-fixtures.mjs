import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.resolve(frontendRoot, '..', 'docs', 'issue-80-screenshots');
const baseUrl = process.env.FIXTURE_BASE_URL ?? 'http://127.0.0.1:4173';
const viewports = [{ width: 1280, height: 720 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 568 }];
const playerCounts = [3, 4, 5];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of viewports) for (const players of playerCounts) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${baseUrl}/fixtures/game-table?players=${players}`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: `${players} 人牌桌布局` }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, `${viewport.width}×${viewport.height}, ${players} players has page-level horizontal overflow`);
    await page.getByLabel('我的手牌').getByLabel(/^卡牌：/).first().focus();
    await page.keyboard.press('Enter');
    const harmonyAction = page.getByRole('button', { name: '调和', exact: true });
    await harmonyAction.waitFor({ state: 'visible' });
    await harmonyAction.click();
    await page.getByRole('status').getByText(/已选择/).waitFor();
    const filename = `${viewport.width}x${viewport.height}-${players}-players.png`;
    await page.screenshot({ path: path.join(outputDirectory, filename), fullPage: true });
    results.push({ viewport: `${viewport.width}x${viewport.height}`, players, screenshot: filename, page_horizontal_overflow: overflow, keyboard_card_action: true });
    await page.close();
  }
} finally { await browser.close(); }

await writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify({ fixture: '/fixtures/game-table', results }, null, 2)}\n`);
console.log(`Captured ${results.length} tabletop fixture screenshots in ${outputDirectory}`);
