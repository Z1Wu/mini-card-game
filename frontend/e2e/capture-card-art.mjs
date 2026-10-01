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
  const strips = await page.locator('.game-card-title-wrap').evaluateAll(nodes => nodes.map(node => {
    const left = node.querySelector('.game-card-stat-harmony').getBoundingClientRect();
    const title = node.querySelector('.game-card-title').getBoundingClientRect();
    const right = node.querySelector('.game-card-stat-priority').getBoundingClientRect();
    return { ordered: title.right <= left.left + 1 && left.bottom <= right.top + 1, priority: node.querySelector('.game-card-stat-priority').textContent };
  }));
  assert.ok(strips.every(strip => strip.ordered), 'Vertical name and right-side symbols must not overlap');
  assert.ok(strips.every(strip => /^[ⅠⅡⅢⅣⅤ]$/.test(strip.priority)), 'Priority uses Roman numerals');
  assert.deepEqual(errors, [], 'Gallery must not produce page errors');
  assert.ok(await page.locator('.game-card-back').evaluate(node => getComputedStyle(node).backgroundImage.includes('card-back-classroom-v1')), 'Back uses the abandoned classroom asset');
  assert.equal(await page.locator('.game-card-back-title span').textContent(), '冰冷的她醒来前');
  assert.equal(await page.locator('.game-card-back-title small').textContent(), 'Embalming Girl');
  await page.screenshot({ path: path.join(output, 'all-roles.png'), fullPage: true });
  for (const width of [40, 48, 96]) for (const harmony of [false, true]) {
    await page.goto(`${baseUrl}/fixtures/card-art?width=${width}${harmony ? '&harmony=1' : ''}`, { waitUntil: 'networkidle' });
    const titles = await page.locator('.game-card-title').evaluateAll(nodes => nodes.map(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      const text = range.getBoundingClientRect(); const card = node.closest('.game-card').getBoundingClientRect();
      return { name: node.textContent, fits: text.left >= card.left && text.right <= card.right && text.top >= card.top && text.bottom <= card.bottom,
        singleLine: getComputedStyle(node).writingMode === 'vertical-rl' && getComputedStyle(node).whiteSpace === 'nowrap' };
    }));
    assert.ok(titles.every(title => title.fits && title.singleLine), `${width}px ${harmony ? 'harmony' : 'hand'} names must fit one vertical column: ${JSON.stringify(titles.filter(title => !title.fits || !title.singleLine))}`);
    assert.equal(await page.locator('.game-card-stat-priority').count(), harmony ? 0 : 13);
    if (width === 96 && harmony) await page.screenshot({ path: path.join(output, 'harmony-names.png'), fullPage: true });
  }
  console.log('13 distinct role portraits loaded; gallery screenshot saved.');
} finally {
  await browser.close();
}
