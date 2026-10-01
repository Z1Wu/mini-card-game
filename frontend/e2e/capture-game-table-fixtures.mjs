import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = process.env.FIXTURE_OUTPUT_DIR
  ? path.resolve(process.env.FIXTURE_OUTPUT_DIR)
  : path.resolve(frontendRoot, '..', 'docs', 'issue-80-screenshots');
const baseUrl = process.env.FIXTURE_BASE_URL ?? 'http://127.0.0.1:4173';
const viewports = [{ width: 1280, height: 720 }, { width: 1024, height: 768 }, { width: 844, height: 390 }];
const playerCounts = [3, 4, 5];
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of viewports) for (const players of playerCounts) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${baseUrl}/fixtures/game-table?players=${players}&fields=${process.env.FIXTURE_FIELD_COUNT ?? 1}`, { waitUntil: 'networkidle' });
    await page.locator('.game-table').waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, `${viewport.width}×${viewport.height}, ${players} players has page-level horizontal overflow`);
    const seatBoxes = await page.locator('.table-seat').evaluateAll(seats => seats.map(seat => {
      const box = seat.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }));
    for (let first = 0; first < seatBoxes.length; first += 1) for (let second = first + 1; second < seatBoxes.length; second += 1) {
      assert.equal(overlaps(seatBoxes[first], seatBoxes[second]), false, `${viewport.width}×${viewport.height}, ${players} players has overlapping opponent seats`);
    }
    await page.locator('.table-hand-scroll').getByLabel(/^卡牌：/).first().focus();
    await page.keyboard.press('Enter');
    const selectedBounds = await page.locator('.table-hand-card-lifted').boundingBox();
    const scrollBounds = await page.locator('.table-hand-scroll').boundingBox();
    assert.ok(selectedBounds.y >= scrollBounds.y && selectedBounds.y + selectedBounds.height <= scrollBounds.y + scrollBounds.height, 'Selected hand card remains fully inside the scroll viewport');
    const objectiveBox = await page.locator('.table-objective').boundingBox();
    const decisionBox = await page.locator('.table-decision').boundingBox();
    assert.ok(objectiveBox && decisionBox, `${viewport.width}×${viewport.height}, ${players} players is missing objective or decision bounds`);
    assert.equal(overlaps(objectiveBox, decisionBox), false, `${viewport.width}×${viewport.height}, ${players} players has decision sheet covering the harmony objective ${JSON.stringify(objectiveBox)} ${JSON.stringify(decisionBox)}`);
    assert.ok(Math.abs(objectiveBox.x + objectiveBox.width / 2 - viewport.width / 2) < 2, 'Harmony status is horizontally centered');
    assert.ok(Math.abs(objectiveBox.y + objectiveBox.height / 2 - viewport.height / 2) < 2, 'Harmony status is vertically centered');
    assert.equal(await page.locator('.table-hand-info').count(), 0, 'Own player information is omitted');
    const actionBoxes = await page.locator('.table-hand-actions button:not(.table-hand-action-cancel)').evaluateAll(nodes => nodes.map(node => { const b = node.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; }));
    assert.equal(actionBoxes.length, 3);
    assert.ok(actionBoxes.every((b, index) => !index || (b.x >= actionBoxes[index - 1].x + actionBoxes[index - 1].width && Math.abs(b.y - actionBoxes[0].y) < 1)), 'Actions run left to right');
    const doubtBox = await page.locator('.table-objective-doubt').boundingBox();
    assert.ok(actionBoxes[0].y >= doubtBox.y + doubtBox.height, 'Actions are below own doubt count');
    for (const box of actionBoxes) {
      assert.equal(overlaps(box, decisionBox), false, 'Preview does not cover actions');
      assert.ok(decisionBox.y + decisionBox.height <= box.y, 'Information sheet sits above actions');
      assert.ok(box.y + box.height <= selectedBounds.y, 'Actions sit above the hand ' + JSON.stringify({ viewport, box, selectedBounds }));
    }
    assert.equal(await page.locator('.table-seat-cards').count(), 0, 'Opponent hand backs must be absent');
    assert.equal(await page.locator('.player-field').count(), players, 'Every owner has a separate field');
    const exposedNames = await page.locator('.player-field').evaluateAll(fields => fields.every(field => {
      const cards = [...field.querySelectorAll('.player-field-card')];
      return cards.slice(0, -1).every((card, index) => {
        const title = card.querySelector('.game-card-title').getBoundingClientRect();
        const next = cards[index + 1].getBoundingClientRect();
        return title.right <= next.left + 1;
      });
    }));
    assert.ok(exposedNames, 'Stacked cards must leave each vertical name exposed');
    const fieldBoxes = await page.locator('.player-field').evaluateAll(nodes => nodes.map(node => {
      const b = node.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height };
    }));
    for (const field of fieldBoxes) assert.equal(overlaps(field, objectiveBox), false, `Owner field must not cover objective ${viewport.width}x${viewport.height} ${players}: ${JSON.stringify(field)} objective ${JSON.stringify(objectiveBox)}`);
    for (let i = 0; i < fieldBoxes.length; i++) for (let j = i + 1; j < fieldBoxes.length; j++) assert.equal(overlaps(fieldBoxes[i], fieldBoxes[j]), false, 'Owner fields must not overlap');
    await page.screenshot({ path: path.join(outputDirectory, `${viewport.width}x${viewport.height}-${players}-selected.png`) });
    const harmonyAction = page.getByRole('button', { name: '调和', exact: true });
    await harmonyAction.waitFor({ state: 'visible' });
    await harmonyAction.click();
    await page.locator('.game-table-fixture-header [role="status"]').getByText(/已选择/).waitFor({ state: 'attached' });
    await page.waitForTimeout(250);
    const filename = `${viewport.width}x${viewport.height}-${players}-players.png`;
    await page.screenshot({ path: path.join(outputDirectory, filename), fullPage: true });
    results.push({ viewport: `${viewport.width}x${viewport.height}`, players, screenshot: filename, page_horizontal_overflow: overflow, opponent_seats_overlap: false, decision_overlaps_objective: false, keyboard_card_action: true });
    await page.close();
  }
} finally { await browser.close(); }

await writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify({ fixture: '/fixtures/game-table', results }, null, 2)}\n`);
console.log(`Captured ${results.length} tabletop fixture screenshots in ${outputDirectory}`);


