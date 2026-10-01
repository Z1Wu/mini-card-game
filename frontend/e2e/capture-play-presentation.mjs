import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const root = process.env.PLAY_OUTPUT_DIR ?? 'C:/Users/wuziyi/AppData/Local/Temp/mini-card-game-local/play-presentation';
await mkdir(root, { recursive: true });
const browser = await chromium.launch();
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.soundStarts = [];
      const scheduled = new WeakMap();
      const setValue = AudioParam.prototype.setValueAtTime;
      AudioParam.prototype.setValueAtTime = function (value, time) { scheduled.set(this, value); return setValue.call(this, value, time); };
      const start = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (...args) { window.soundStarts.push({ frequency: scheduled.get(this.frequency), type: this.type }); return start.apply(this, args); };
    });
    await page.goto(`${process.env.PLAY_BASE_URL ?? 'http://127.0.0.1:3006'}/fixtures/game-table?players=5&plays`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '测试调和', exact: true }).click();
    assert.equal(await page.locator('.skill-play-reveal').count(), 0, 'Harmony keeps its face hidden');
    await page.getByRole('button', { name: '测试质疑', exact: true }).click();
    assert.equal(await page.locator('.skill-play-reveal').count(), 0, 'Doubt keeps its face hidden');
    await page.getByRole('button', { name: '测试特技', exact: true }).click();
    const reveal = page.getByRole('status', { name: '小王发动图书委员' });
    await reveal.waitFor({ state: 'visible' });
    assert.equal(await page.getByLabel('小王的场牌', { exact: true }).locator('.player-field-card').count(), 1, 'New skill card stays out of the owner field during reveal');
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${root}/${viewport.width}-reveal.png` });
    await reveal.waitFor({ state: 'hidden' });
    assert.equal(await page.getByLabel('小王的场牌', { exact: true }).locator('.player-field-card').count(), 2, 'Skill card reaches its owner after reveal');
    const starts = await page.evaluate(() => window.soundStarts);
    assert.equal(starts.length, 9, 'Three confirmed actions each play three tones exactly once');
    assert.notDeepEqual(starts.slice(0, 3), starts.slice(3, 6), 'Harmony and doubt sound different');
    assert.notDeepEqual(starts.slice(0, 3), starts.slice(6), 'Harmony and skill sound different');
    await page.screenshot({ path: `${root}/${viewport.width}-field.png` });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: '测试特技', exact: true }).click();
    await reveal.waitFor({ state: 'visible' });
    assert.equal(await page.locator('.skill-play-card').evaluate(node => getComputedStyle(node).animationName), 'none');
    await reveal.waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally { await browser.close(); }
console.log('Skill reveal, owner arrival, three distinct sounds and reduced motion passed');
