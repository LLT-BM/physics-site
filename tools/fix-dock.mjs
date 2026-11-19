/* LibLabTab · док-панель не перекрывает свои же оригиналы на телефоне.
   node tools/fix-dock.mjs — идемпотентно. */
import process from 'node:process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const TOUCH = 'public/sim/lib/touch.js';
const CSS = 'public/sim/lib/mobile.css';
if(!existsSync(TOUCH) || !existsSync(CSS)){ console.log('Нет lib/touch.js или lib/mobile.css'); process.exit(1); }

let t = readFileSync(TOUCH, 'utf8');
const before = t;

/* Снимаем метки перед каждой пересборкой дока */
if(!/data-llt-proxied/.test(t)){
  t = t.replace(/(function\s+buildDock\s*\(\s*\)\s*\{)/,
    '$1\n    [].forEach.call(document.querySelectorAll("[data-llt-proxied]"),function(el){el.removeAttribute("data-llt-proxied");});');
  /* Помечаем оригиналы, у которых есть прокси в доке */
  t = t.replace(/(proxies\.push\(\{\s*btn\s*:\s*b\s*,\s*src\s*:\s*it\.el\s*\}\);)/,
    '$1 it.el.setAttribute("data-llt-proxied","1");');
}
if(t !== before){ writeFileSync(TOUCH, t, 'utf8'); console.log('[fix] lib/touch.js → оригиналы помечены data-llt-proxied'); }
else console.log('[ok ] lib/touch.js');

let c = readFileSync(CSS, 'utf8');
if(!/data-llt-proxied/.test(c)){
  c += `
/* Док заменяет эти кнопки на узком экране — оригиналы не дублируются и не перекрываются */
@media (max-width:900px){
  body.llt-docked [data-llt-proxied]{display:none !important}
}
button,.tgl,.pbtn,.preset{scroll-margin-bottom:104px;scroll-margin-top:88px}
`;
  writeFileSync(CSS, c, 'utf8');
  console.log('[fix] lib/mobile.css → скрытие дублей и отступ прокрутки');
} else console.log('[ok ] lib/mobile.css');