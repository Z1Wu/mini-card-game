import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.FIXTURE_BASE_URL ?? 'http://127.0.0.1:4173';
const output = path.resolve(process.env.FIXTURE_OUTPUT_DIR ?? 'test-results/card-art');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseUrl}/fixtures/card-art`, { waitUntil: 'networkidle' });
  const images = await page.locator('.game-card-art').evaluateAll(nodes => nodes.map(image => ({
    src: image.currentSrc, loaded: image.complete && image.naturalWidth > 0,
  })));
  assert.equal(images.length, 13, 'Every role must have portrait art');
  assert.equal(new Set(images.map(image => image.src)).size, 13, 'Roles must use distinct portraits');
  assert.ok(images.every(image => image.loaded && image.src.includes('-horror-v2')), 'All new portrait assets must load');
  assert.deepEqual(errors, [], 'Gallery must not produce page errors');
  await page.screenshot({ path: path.join(output, 'all-roles.png'), fullPage: true });
  console.log('13 distinct role portraits loaded; gallery screenshot saved.');
} finally {
  await browser.close();
}
