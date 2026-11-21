/* LibLabTab · визуальный аудит: сдвиги, пустые зоны, обрезка, наложения.
   Проверяет каждую симуляцию, каталог и все страницы моделей на трёх размерах.
   node tools/layout-audit.mjs [--url https://liblabtab.ru] [--only=lever.html] [--shots]
   Отчёт: layout-audit.json. Код 1 при находках. */
import process from 'node:process';
import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const val = k => { const i = argv.indexOf('--' + k); return i > 0 ? argv[i + 1] : ''; };
const BASE = val('url') || 'http://localhost:4321';
const ONLY = val('only');
const SHOTS = argv.includes('--shots');
const OUT = 'layout-audit';
const SIZES = [[360, 640, 'phone'], [768, 1024, 'tablet'], [1280, 720, 'desktop']];
const GAP = 90, EMPTY = 40, OVER = 120;

if(!existsSync('public/sim')){ console.log('Запускайте из корня проекта'); process.exit(1); }
const sims = readdirSync('public/sim').filter(f => f.toLowerCase().endsWith('.html'))
  .filter(f => !ONLY || f === ONLY);
const slugs = (!ONLY && existsSync('src/content/models'))
  ? readdirSync('src/content/models').filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')) : [];

const targets = [
  ...sims.map(f => ({ kind: 'sim', name: f, path: '/sim/' + f })),
  ...(ONLY ? [] : [{ kind: 'catalog', name: 'index', path: '/' }]),
  ...(ONLY ? [] : slugs.map(s => ({ kind: 'model', name: s, path: '/models/' + s + '/' })))
];

const PROBE = `(() => {
  const GAP=${GAP}, EMPTY=${EMPTY}, OVER=${OVER};
  const vw=document.documentElement.clientWidth;
  const out={overflowX:0,empty:[],gaps:[],offscreen:[],clipped:[],overlap:[],scene:[],fixedCover:[]};
  out.overflowX=document.documentElement.scrollWidth-vw;

  const cls=el=>typeof el.className==='string'?el.className:'';
  const sel=el=>{let s=el.tagName.toLowerCase();if(el.id)s+='#'+el.id;
    if(cls(el))s+='.'+cls(el).trim().split(/\\s+/).slice(0,3).join('.');return s;};
  const vis=el=>{const c=getComputedStyle(el);
    if(c.display==='none'||c.visibility==='hidden'||c.opacity==='0')return false;
    const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
  const decor=el=>{
    if(el.getAttribute('aria-hidden')==='true')return true;
    if(el.closest('.offscreen,.sr,.cmt-hp,[data-llt-keep]'))return true;
    if(/(^|\\s)(bg|vig|corner|backdrop|scrim|offscreen|sr|cmt-hp)(\\s|$)/.test(cls(el)))return true;
    const c=getComputedStyle(el);
    if(c.pointerEvents==='none'&&!(el.textContent||'').trim())return true;
    return false;};
  const meaningful=el=>{
    if(!vis(el)||decor(el))return false;
    if(/^(SCRIPT|STYLE|LINK|META|TEMPLATE|NOSCRIPT)$/.test(el.tagName))return false;
    if(el.closest('svg'))return false;
    return true;};
  const scroller=el=>{let p=el.parentElement;
    while(p&&p!==document.body){const ox=getComputedStyle(p).overflowX;
      if(ox==='auto'||ox==='scroll')return true;p=p.parentElement;}
    return false;};
  const ink=el=>{
    if(el.querySelector('canvas,svg,img,iframe,input,select,textarea,button,table,details,summary'))return true;
    return (el.textContent||'').replace(/\\s+/g,'').length>0;};

  document.querySelectorAll('div,section,aside,main,ol,ul,table,tbody,details,header,footer').forEach(el=>{
    if(!meaningful(el))return;
    const r=el.getBoundingClientRect();
    if(r.height<EMPTY||r.width<40)return;
    if(ink(el))return;
    out.empty.push({sel:sel(el),h:Math.round(r.height),w:Math.round(r.width)});
  });

  document.querySelectorAll('.llt-main,.llt-side,.llt-sec-body,.wrap,main').forEach(box=>{
    const kids=[...box.children].filter(meaningful);
    for(let i=1;i<kids.length;i++){
      const a=kids[i-1].getBoundingClientRect(),b=kids[i].getBoundingClientRect();
      const g=Math.round(b.top-a.bottom);
      if(g>GAP)out.gaps.push({parent:sel(box),between:sel(kids[i-1])+' → '+sel(kids[i]),gap:g});
    }
    if(kids.length){
      const br=box.getBoundingClientRect();
      const tail=Math.round(br.bottom-kids[kids.length-1].getBoundingClientRect().bottom);
      if(tail>GAP)out.gaps.push({parent:sel(box),between:'хвост контейнера',gap:tail});
    }
  });

  document.querySelectorAll('body *').forEach(el=>{
    if(!meaningful(el))return;
    const cs=getComputedStyle(el);
    const r=el.getBoundingClientRect();
    if(r.width<8||r.height<8)return;
    if(cs.position!=='fixed'&&r.left>-2000&&!scroller(el)&&(r.right>vw+2||r.left<-2))
      out.offscreen.push({sel:sel(el),left:Math.round(r.left),right:Math.round(r.right),vw});
    if(el.scrollWidth-el.clientWidth>4&&cs.overflowX!=='auto'&&cs.overflowX!=='scroll'&&!scroller(el))
      out.clipped.push({sel:sel(el),extra:el.scrollWidth-el.clientWidth});
  });

  document.querySelectorAll('.llt-main,.llt-side,.llt-shell,.wrap').forEach(box=>{
    const kids=[...box.children].filter(meaningful);
    for(let i=0;i<kids.length;i++)for(let j=i+1;j<kids.length;j++){
      const a=kids[i].getBoundingClientRect(),b=kids[j].getBoundingClientRect();
      const ox=Math.min(a.right,b.right)-Math.max(a.left,b.left);
      const oy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
      if(ox>4&&oy>4&&ox*oy>OVER)out.overlap.push({a:sel(kids[i]),b:sel(kids[j]),area:Math.round(ox*oy)});
    }
  });

  // только главная сцена, и только если её обёртка действительно обёртка сцены
  document.querySelectorAll('[data-llt-stage]').forEach(c=>{
    const r=c.getBoundingClientRect();
    if(r.height<120||r.width<120)out.scene.push({sel:sel(c),w:Math.round(r.width),h:Math.round(r.height)});
    if(c.tagName==='CANVAS'&&c.width>0&&c.height>0){
      const box=r.width/Math.max(1,r.height),buf=c.width/c.height;
      if(Math.abs(box-buf)/buf>0.04)out.scene.push({sel:sel(c),distort:+(box/buf).toFixed(3)});
    }
    const p=c.parentElement;
    if(p&&/^(llt-stage|stagebox|holder)$/.test(cls(p).split(' ')[0]||'')&&p.querySelectorAll('canvas').length===1){
      const pr=p.getBoundingClientRect();
      if(pr.height-r.height>GAP)out.gaps.push({parent:sel(p),between:'под сценой',gap:Math.round(pr.height-r.height)});
    }
  });

  document.querySelectorAll('body *').forEach(el=>{
    const cs=getComputedStyle(el);
    if(cs.position!=='fixed'||!meaningful(el))return;
    if(cs.pointerEvents==='none')return;
    if(parseInt(cs.zIndex||'0',10)<=0)return;
    const r=el.getBoundingClientRect();
    if(r.width*r.height<4000)return;
    let covered=0;
    document.querySelectorAll('.llt-bar button,.llt-side input,.llt-side select,[data-llt-stage]').forEach(t=>{
      if(!vis(t)||el.contains(t))return;
      const q=t.getBoundingClientRect();
      const ox=Math.min(r.right,q.right)-Math.max(r.left,q.left);
      const oy=Math.min(r.bottom,q.bottom)-Math.max(r.top,q.top);
      if(ox>6&&oy>6)covered++;
    });
    if(covered)out.fixedCover.push({sel:sel(el),covers:covered,z:cs.zIndex});
  });

  return out;
})()`;

const browser = await chromium.launch();
const findings = [];
let clean = 0, checked = 0;
if(SHOTS && !existsSync(OUT)) mkdirSync(OUT, { recursive: true });

for(const t of targets){
  for(const [w, h, label] of SIZES){
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if(m.type() === 'error') errs.push(m.text()); });
    const rec = { kind: t.kind, name: t.name, size: label, path: t.path, issues: {}, errors: [] };
    try{
      await page.goto(BASE + t.path, { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(t.kind === 'sim' ? 2800 : 1400);
      await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
      await page.waitForTimeout(800);
      const r = await page.evaluate(PROBE);
      for(const k of Object.keys(r)){
        if(k === 'overflowX'){ if(r[k] > 2) rec.issues.overflowX = r[k]; continue; }
        if(Array.isArray(r[k]) && r[k].length) rec.issues[k] = r[k].slice(0, 12);
      }
      if(errs.length) rec.errors = errs.slice(0, 4);
      if(SHOTS) await page.screenshot({ path: join(OUT, `${t.name}.${label}.png`), fullPage: true });
    }catch(e){ rec.issues.load = e.message.split('\n')[0]; }
    await page.close();
    checked++;
    const n = Object.keys(rec.issues).length + (rec.errors.length ? 1 : 0);
    if(n){ findings.push(rec);
      console.log(`[FAIL] ${t.name} · ${label} → ` +
        Object.entries(rec.issues).map(([k, v]) => k + (typeof v === 'number' ? '=' + v : ':' + v.length)).join(', ') +
        (rec.errors.length ? ', console:' + rec.errors.length : ''));
    } else { clean++; console.log(`[ok ] ${t.name} · ${label}`); }
  }
}
await browser.close();
writeFileSync('layout-audit.json', JSON.stringify({ base: BASE, checked, clean, findings }, null, 2), 'utf8');
console.log(`\nПроверок: ${checked} · чисто: ${clean} · с находками: ${findings.length}`);
console.log('Подробности: layout-audit.json' + (SHOTS ? ', снимки: ' + OUT + '/' : ''));
process.exit(findings.length ? 1 : 0);