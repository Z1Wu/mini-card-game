import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const output = process.env.SETTLEMENT_OUTPUT ?? 'test-results/settlement-style';
await fs.mkdir(output,{recursive:true});
const browser = await chromium.launch();
try {
 for (const viewport of [{width:1280,height:720},{width:390,height:844},{width:844,height:390}]) {
  const page=await browser.newPage({viewport});
  await page.goto(`${process.env.SETTLEMENT_BASE_URL ?? 'http://127.0.0.1:3002'}/fixtures/settlement`);
  for(let stage=0;stage<4;stage++) {
   await page.getByRole('heading',{level:1}).waitFor();
   await page.waitForFunction(()=>[...document.querySelectorAll('.settlement-reveal-item')].every(n=>Number(getComputedStyle(n).opacity)>.99));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
   await page.screenshot({path:`${output}/${viewport.width}-stage-${stage+1}.png`,fullPage:true});
   if(stage<3) await page.getByRole('button',{name:'下一步',exact:true}).click();
  }
  assert.ok(await page.getByRole('button',{name:'重新开始一局',exact:true}).isEnabled());
  await page.getByRole('button',{name:'查看完整结算',exact:true}).click();
  await page.getByLabel('完整结算',{exact:true}).waitFor();
  await page.close();
 }
 console.log('All four settlement stages passed across desktop, portrait and landscape');
} finally {await browser.close();}

