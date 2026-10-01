import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.FIXTURE_BASE_URL ?? 'http://127.0.0.1:4173';
const output = path.resolve(process.env.FIXTURE_OUTPUT_DIR ?? 'test-results/turn-announcement');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/fixtures/game-table?turns=1`, { waitUntil: 'networkidle' });
  const banner = page.locator('.turn-announcement');
  assert.equal(await banner.locator('strong').textContent(), '轮到你了');
  const bounds = await banner.boundingBox();
  assert.ok(Math.abs(bounds.x + bounds.width / 2 - 640) < 4, 'Banner must be centered');
  assert.equal(await banner.evaluate(node => getComputedStyle(node).pointerEvents), 'none', 'Banner must not block play');
  await page.screenshot({ path: path.join(output, 'own-turn.png') });
  await banner.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '下一回合' }).click();
  assert.equal(await banner.locator('strong').textContent(), '轮到 小王 了');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(output, 'other-turn.png') });
  await page.getByRole('button', { name: '下一回合' }).click();
  assert.equal(await banner.locator('strong').textContent(), '轮到 小陈 了');
  await banner.waitFor({ state: 'detached' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '下一回合' }).click();
  assert.equal(await banner.evaluate(node => getComputedStyle(node).animationName), 'none');
  assert.equal(await banner.locator('strong').textContent(), '轮到你了');
  assert.deepEqual(errors, []);
  console.log('Own/other turns, timer, rapid transitions, center, pointer pass-through and reduced motion passed.');
} finally { await browser.close(); }
