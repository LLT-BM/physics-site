/* LibLabTab · смоук-тест симуляций.
   node tools/smoke.mjs [--url https://liblabtab.ru] [--wide] */
import process from 'node:process';
import { readdirSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';

const a = process.argv.indexOf('--url');
const BASE = a > 0 ? process.argv[a + 1] : 'http://localhost:4321';
const wide = process.argv.includes('--wide');
const DIR = 'public/sim';
if(!existsSync(DIR)){ console.log('Запускайте из корня проекта'); process.exit(1); }
const files = readdirSync(DIR).filter(f => f.toLowerCase().endsWith('.html'));

const browser = await chromium.launch();
const problems = [];
let pass = 0;

for(const f of files){
  const page = await browser.newPage({ viewport: wide ? { width: 1280, height: 720 } : { width: 360, height: 640 } });
  const errs = [];
  page.on('console', m => { if(m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));

  const local = [];
  try{
    await page.goto(BASE + '/sim/' + f, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2600);

    if(await page.locator('text=Модель не запустилась').count()) local.push('страж показал ошибку');

    const painted = await page.evaluate(() => {
      const el = document.querySelector('[data-llt-stage]') ||
                 document.querySelector('canvas') || document.querySelector('svg');
      if(!el) return 'нет сцены';
      if(el.tagName.toLowerCase() === 'svg')
        return el.querySelectorAll('path,circle,rect,line,polyline,polygon,g').length > 3 ? true : 'svg пуст';
      if(!el.width || !el.height) return 'canvas без размеров';
      const d = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
      let n = 0;
      for(let i = 0; i < d.length; i += 404){ if(d[i+3] || d[i] || d[i+1] || d[i+2]){ if(++n > 8) return true; } }
      return 'canvas пуст';
    });
    if(painted !== true) local.push(String(painted));

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if(overflow > 2) local.push('горизонтальный скролл ' + overflow + ' px');

    const ranges = page.locator('input[type=range]:visible');
    if(await ranges.count()){
      const snap = () => page.evaluate(() => {
        const c = document.querySelector('[data-llt-stage]') || document.querySelector('canvas');
        let px = '';
        if(c && c.tagName.toLowerCase() === 'canvas'){
          const d = c.getContext('2d').getImageData(0, 0, Math.min(200, c.width), Math.min(200, c.height)).data;
          let s = 0; for(let i = 0; i < d.length; i += 97) s += d[i] + d[i+3];
          px = String(s);
        } else if(c) px = c.innerHTML.length + ':' + c.innerHTML.slice(0, 200);
        return document.body.innerText.replace(/\s+/g, ' ').slice(0, 6000) + '|' + px;
      });
      const before = await snap();
      await ranges.first().evaluate(el => {
        const min = parseFloat(el.min || '0'), max = parseFloat(el.max || '1');
        el.value = String(min + (max - min) * 0.75);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.waitForTimeout(700);
      if(before === await snap()) local.push('ползунок не меняет ни показания, ни сцену');
    }

    /* Сброс: сначала видимая кнопка дока, затем любая видимая в панели */
    const dockReset = page.locator('#lltDock button:visible', { hasText: /сброс|по умолчанию/i });
    const anyReset = page.locator('button:visible', { hasText: /сброс|по умолчанию/i });
    const target = (await dockReset.count()) ? dockReset.first()
                 : (await anyReset.count()) ? anyReset.first() : null;
    if(target){
      await target.scrollIntoViewIfNeeded().catch(() => {});
      await target.click({ timeout: 4000 }).catch(async e => {
        await target.click({ force: true, timeout: 3000 })
          .catch(() => local.push('кнопка сброса не нажимается: ' + e.message.split('\n')[0]));
      });
    } else local.push('нет видимой кнопки сброса');

    const bad = await page.evaluate(() => {
      const m = document.body.innerText.match(/.{0,26}(\bNaN\b|\bundefined\b|-0,0\b).{0,26}/);
      return m ? m[0].replace(/\s+/g, ' ').trim() : null;
    });
    if(bad) local.push('в показаниях: ' + bad);
  }catch(e){
    local.push('не открылась: ' + e.message.split('\n')[0]);
  }

  if(errs.length) local.push(...errs.slice(0, 3));
  await page.close();

  if(local.length){ problems.push(f); console.log('[FAIL] ' + f.padEnd(26) + ' → ' + local.join('; ')); }
  else { pass++; console.log('[ok ] ' + f); }
}

await browser.close();
console.log('\nПроверено: ' + files.length + ' · чисто: ' + pass + ' · с проблемами: ' + problems.length);
if(problems.length) process.exitCode = 1;