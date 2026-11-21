/* LibLabTab · убирает наследие старых карточек в метриках canvas и
   дописывает правила каркаса для панелей и таблиц.
   node tools/fix-layout-metrics.mjs --dry | node tools/fix-layout-metrics.mjs */
import process from 'node:process';
import { readdirSync, readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const dry = process.argv.includes('--dry');
const log = [];

/* 1. resize больше не вычитает padding несуществующей карточки */
for(const f of readdirSync('public/sim').filter(x => x.toLowerCase().endsWith('.html'))){
  const p = join('public/sim', f);
  const orig = readFileSync(p, 'utf8');
  let s = orig, n = 0;
  s = s.replace(/(parentNode\.clientWidth)\s*-\s*28/g, (m, a) => { n++; return a; });
  s = s.replace(/(getBoundingClientRect\(\)\.width)\s*-\s*28/g, (m, a) => { n++; return a; });
  s = s.replace(/(parentNode\.clientWidth)\s*-\s*24/g, (m, a) => { n++; return a; });
  if(s !== orig){
    if(!dry) writeFileSync(p, s, 'utf8');
    log.push((dry ? '[dry] ' : '[fix] ') + p + ' → метрик canvas исправлено: ' + n);
  } else log.push('[ok ] ' + p);
}

/* 2. правила каркаса: поточные панели, скролл таблиц, одна колонка у .info */
{
  const p = 'public/sim/lib/layout.css';
  let s = existsSync(p) ? readFileSync(p, 'utf8') : '';
  if(!s){ log.push('[?] ' + p + ' отсутствует'); }
  else if(s.includes('/* llt-metrics-v2 */')){ log.push('[ok ] ' + p); }
  else {
    const block = `
/* llt-metrics-v2 */
.llt-shell .panel,.llt-shell .panels,.llt-shell .gchip,.llt-shell .dock,
.llt-shell .side,.llt-shell .sidebar,.llt-shell .chain,.llt-shell .controls,
.llt-shell .row,.llt-shell .note,.llt-shell .note2,.llt-shell .fnote,
.llt-shell .hint,.llt-shell .legend,.llt-shell .eq,.llt-shell header,.llt-shell footer{
  position:static !important;inset:auto !important;transform:none !important;
  left:auto !important;right:auto !important;top:auto !important;bottom:auto !important;
  width:auto !important;max-width:100% !important;margin:0 !important;clip-path:none !important}
.llt-stage .hud{position:absolute !important;left:12px !important;top:12px !important;width:auto !important}
.llt-stage .prog{position:absolute !important;left:12px !important;right:12px !important;bottom:12px !important}
.llt-stage>canvas+canvas,.llt-stage>canvas+svg{margin-top:8px}
.llt-shell .info{display:grid !important;grid-template-columns:1fr !important;gap:10px}
.llt-shell .tw,.llt-shell .tablewrap{overflow-x:auto;max-width:100%;-webkit-overflow-scrolling:touch}
.llt-shell table{max-width:none}
.llt-sec-body>.tw{margin:0 !important}
`;
    if(!dry) appendFileSync(p, block, 'utf8');
    log.push((dry ? '[dry] ' : '[fix] ') + p + ' → правила поточных панелей и скролла таблиц');
  }
}

/* 3. таблицы Markdown на страницах моделей прокручиваются, а не распирают prose */
{
  const p = 'src/pages/models/[slug].astro';
  let s = existsSync(p) ? readFileSync(p, 'utf8') : '';
  if(!s){ log.push('[?] ' + p + ' отсутствует'); }
  else if(s.includes('/* llt-prose-tables */')){ log.push('[ok ] ' + p); }
  else {
    const rule = `
  /* llt-prose-tables */
  .prose{overflow-x:clip;min-width:0}
  .prose :global(table){display:block;max-width:100%;overflow-x:auto;white-space:nowrap;
    -webkit-overflow-scrolling:touch}
  .prose :global(pre){max-width:100%;overflow-x:auto}
  .prose :global(img),.prose :global(svg){max-width:100%}
`;
    const i = s.lastIndexOf('</style>');
    if(i >= 0){
      s = s.slice(0, i) + rule + s.slice(i);
      if(!dry) writeFileSync(p, s, 'utf8');
      log.push((dry ? '[dry] ' : '[fix] ') + p + ' → прокрутка таблиц и pre в prose');
    } else log.push('[?] ' + p + ': нет блока </style>');
  }
}

console.log(log.join('\n'));