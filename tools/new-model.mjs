/* LibLabTab · каркас новой модели по образцу.
   node tools/new-model.mjs <slug> "<Название>" <раздел> [--level=базовый] [--grade=7-9]
   Создаёт MD и sim-файл, ничего существующего не перезаписывает. */
import process from 'node:process';
import { writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const opt = k => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const [slug, title, section] = args;
if(!slug || !title || !section){
  console.log('Использование: node tools/new-model.mjs <slug> "<Название>" <раздел> [--level=базовый] [--grade=7-9]');
  process.exit(1);
}
const level = opt('level') || 'базовый';
const grade = opt('grade') || '7-9';

const mdPath = join('src/content/models', slug + '.md');
const simPath = join('public/sim', slug + '.html');
if(existsSync(mdPath) || existsSync(simPath)){ console.log('Такая модель уже есть.'); process.exit(1); }

const orders = readdirSync('src/content/models').filter(f => f.endsWith('.md'))
  .map(f => +( (readFileSync(join('src/content/models',f),'utf8').match(/^order:\s*(\d+)/m) || [])[1] || 0 ));
const order = Math.max(0, ...orders) + 1;
const date = new Date().toISOString().replace(/\.\d+Z$/,'Z');

writeFileSync(mdPath, `---
title: "${title}"
date: ${date}
description: "Одно предложение для карточки каталога и поисковика."
lead: "Одна-две фразы под заголовком: что показывает модель и какой закон за этим стоит."
tags: ["школьный-курс"]
model: "${slug}.html"
cover: "/covers/${slug}.svg"
section: "${section}"
level: "${level}"
grade: "${grade}"
order: ${order}
coreVersion: "1"
draft: true
checkpoints:
  - name: "Первая контрольная точка"
    setup: "настройки по умолчанию"
    expected: "ожидаемое значение с единицей"
limits:
  - "Что модель упрощает и где перестаёт быть верной."
---

## Как пользоваться

Два-три предложения: что тянуть, что нажимать, что смотреть.

## Физика

Короткий вывод формулы и физический смысл. Без длинных выкладок: подробности
живут в свёрнутых блоках, а на виду остаётся сцена и простые настройки.
`, 'utf8');

writeFileSync(simPath, `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<link rel="canonical" href="https://liblabtab.ru/models/${slug}/">
<link rel="stylesheet" href="/fonts/fonts.css">
<script src="/sim/guard.js"><\/script>
<link rel="stylesheet" href="/sim/lib/theme.css">
<script src="/sim/lib/theme.js"><\/script>
<script src="/sim/lib/fmt.js"><\/script>
<style>
:root{box-sizing:border-box}
*{box-sizing:border-box}
body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.5 var(--sans);overflow:hidden}
#stage{display:block;width:100vw;height:100vh;touch-action:none}
.hud{position:fixed;left:12px;top:12px;display:flex;flex-direction:column;gap:5px;pointer-events:none}
.hud span{font:600 .72rem var(--mono);background:var(--scrim);border:1px solid var(--line);
  color:var(--ice);padding:4px 9px;border-radius:999px}
/* Панель ниже видна только в полноэкранном режиме: страница модели строит свои. */
.panel{position:fixed;right:12px;top:12px;width:280px;padding:12px;border-radius:12px;
  border:1px solid var(--line2);background:var(--scrim);backdrop-filter:blur(8px)}
.panel h2{font:700 .9rem var(--disp);margin:0 0 8px}
label{display:flex;justify-content:space-between;font-size:.85rem;color:var(--muted);margin-top:8px}
output{font-family:var(--mono);color:var(--sand)}
input[type=range]{width:100%}
button{font:inherit;min-height:42px;padding:8px 14px;border-radius:10px;
  border:1px solid var(--line2);background:var(--overlay);color:var(--ink);cursor:pointer;margin-top:8px}
.readouts{display:flex;gap:8px;margin-top:10px}
.readouts div{flex:1;border:1px solid var(--line);border-radius:9px;padding:7px 9px}
.readouts span{display:block;font:600 .68rem var(--mono);color:var(--muted)}
.readouts b{font:700 .95rem var(--mono);color:var(--aqua)}
</style>
</head>
<body>
<canvas id="stage" data-llt-stage="1" role="img" aria-label="${title}: интерактивная сцена"></canvas>
<div class="hud" id="hud"></div>

<section class="panel" data-sec="basic">
  <h2>Простые настройки</h2>
  <label for="p_main">Главный параметр, м <output id="o_main"></output></label>
  <input type="range" id="p_main" min="0.2" max="3" step="0.01" value="1" data-level="basic">
  <button id="run" data-level="basic">▶ Пуск</button>
  <button id="reset" data-level="basic">⟲ Сброс</button>
  <div class="readouts" data-llt-read>
    <div><span>величина</span><b id="v_main">—</b></div>
    <div><span>время, с</span><b id="v_t">0,00</b></div>
  </div>
</section>

<script>
(function(){
'use strict';
var NF = window.LLTfix || function(x,n){ return x.toFixed(n).split('.').join(','); };
var cv = document.getElementById('stage'), cx = cv.getContext('2d');
var W=0,H=0,DPR=1, running=false, t=0, last=0;
var P = { main:1 };

function resize(){
  var r = cv.getBoundingClientRect();
  W = Math.max(200, Math.round(r.width)); H = Math.max(200, Math.round(r.height));
  DPR = Math.min(2, window.devicePixelRatio||1);
  cv.width = Math.round(W*DPR); cv.height = Math.round(H*DPR);
  cx.setTransform(DPR,0,0,DPR,0,0);
}
if(window.ResizeObserver) new ResizeObserver(resize).observe(cv);
window.addEventListener('resize', resize);

function step(dt){ t += dt; }
function draw(){
  var pal = window.PAL || { canvas:'#071012', aqua:'#4FD8C4', sand:'#D9B98C', muted:'#8FA8A6' };
  cx.clearRect(0,0,W,H); cx.fillStyle = pal.canvas; cx.fillRect(0,0,W,H);
  var cxp = W/2, cyp = H/2, R = Math.min(W,H)*0.28*P.main;
  cx.strokeStyle = pal.aqua; cx.lineWidth = 3;
  cx.beginPath(); cx.arc(cxp, cyp, R, 0, Math.PI*2); cx.stroke();
  cx.fillStyle = pal.sand;
  cx.beginPath(); cx.arc(cxp + R*Math.cos(t*1.6), cyp + R*Math.sin(t*1.6), 9, 0, Math.PI*2); cx.fill();
  document.getElementById('v_main').textContent = NF(R/100, 3) + ' м';
  document.getElementById('v_t').textContent = NF(t, 2);
}
function loop(ts){
  requestAnimationFrame(loop);
  var dt = Math.min(.05, (ts-last)/1000 || 0); last = ts;
  if(running) step(dt);
  draw();
}

var main = document.getElementById('p_main'), out = document.getElementById('o_main');
function sync(){ out.textContent = NF(P.main,2) + ' м'; }
main.addEventListener('input', function(){ P.main = +main.value; sync(); });
document.getElementById('run').addEventListener('click', function(){
  running = !running; this.textContent = running ? '❚❚ Пауза' : '▶ Пуск';
});
document.getElementById('reset').addEventListener('click', function(){
  t = 0; P.main = +main.defaultValue; main.value = main.defaultValue; sync();
});

resize(); sync(); last = performance.now(); requestAnimationFrame(loop);
})();
<\/script>
</body>
</html>
`, 'utf8');

console.log('[new] ' + mdPath);
console.log('[new] ' + simPath);
console.log('\nДальше: обложка public/covers/' + slug + '.svg и .png, затем draft: false.');