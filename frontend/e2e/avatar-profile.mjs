import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { findFreePort, startServices, stopProcess, prepareOutput } from './lib/services.mjs';

const frontendRoot = path.resolve(import.meta.dirname, '..');
const backendRoot = path.resolve(frontendRoot, '..', 'backend');
const output = await prepareOutput(frontendRoot, 'test-results/avatar-profile');
const usersFile = path.join(output, 'users.json');
await fs.copyFile(path.join(backendRoot, 'auth/users.json'), usersFile);
process.env.AUTH_USERS_FILE = usersFile;
let services, browser;
try {
  services = await startServices({frontendRoot, backendRoot, backendPort: await findFreePort(), frontendPort: await findFreePort(), seed: 122});
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: {width:1280,height:720} });
  async function login() {
    await page.goto(services.appUrl);
    await page.getByLabel('用户名').fill('player1');
    await page.getByLabel('密码').fill('password1');
    await page.getByRole('button', {name:'登录',exact:true}).click();
    await page.waitForURL('**/avatar');
  }
  await login();
  const desktopBounds=await page.locator('.avatar-selection').boundingBox();
  assert.ok(Math.abs(desktopBounds.x + desktopBounds.width / 2 - 640) < 2);
  await page.getByRole('button', {name:'小熊头像',exact:true}).click();
  await page.screenshot({path:path.join(output,'avatar-desktop.png')});
  await page.getByRole('button', {name:'确认头像',exact:true}).click();
  await page.waitForURL('**/rooms');
  await page.getByRole('img', {name:'玩家1的头像'}).waitFor({state:'visible'});
  const saved = JSON.parse(await fs.readFile(usersFile,'utf8')).find(u=>u.username==='player1');
  assert.equal(saved.avatar_id,'rich-girl');
  await page.getByRole('button', {name:'创建房间',exact:true}).click();
  await page.waitForURL('**/lobby');
  await page.getByRole('img', {name:'玩家1的头像'}).waitFor({state:'visible'});
  const second = await browser.newPage({viewport:{width:390,height:844}});
  await second.goto(services.appUrl);
  await second.getByLabel('用户名').fill('player1');
  await second.getByLabel('密码').fill('password1');
  await second.getByRole('button',{name:'登录',exact:true}).click();
  await second.waitForURL('**/avatar');
  assert.equal(await second.getByRole('button',{name:'小熊头像',exact:true}).getAttribute('aria-pressed'),'true');
  const bounds=await second.locator('.avatar-selection').boundingBox();
  assert.ok(bounds.x>=0 && bounds.x+bounds.width<=390);
  await second.screenshot({path:path.join(output,'avatar-mobile.png')});
  console.log('Avatar selection, account persistence, lobby display and mobile layout passed');
} finally {
  await browser?.close();
  await stopProcess(services?.frontend);
  await stopProcess(services?.backend);
}

