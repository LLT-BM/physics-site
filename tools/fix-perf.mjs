/* LibLabTab · убирает тормоза и лишние подписи.
   1. Кэширует innerHTML HUD и легенды в переписанных моделях.
   2. Подсветка таблицы Менделеева — только при смене элемента.
   3. Удаляет устаревший FrameBridge, конфликтующий с ModelShell.
   node tools/fix-perf.mjs --dry | node tools/fix-perf.mjs */
import process from 'node:process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';

const dry = process.argv.includes('--dry');
const log = [];
const rd = p => existsSync(p) ? readFileSync(p, 'utf8') : '';
const wr = (p, s) => { if(!dry) writeFileSync(p, s, 'utf8'); };

const HELPER = [
  '/* LibLabTab · запись HTML только при изменении */',
  'function setHTML(el, html){ if(!el) return; if(el.__html === html) return; el.__html = html; el.innerHTML = html; }'
].join('\n');

const TARGETS = {
  'public/sim/life.html': [
    ["$('hud').innerHTML = chips.map(function(o){\n    return '<span class=\"' + (o.c||'') + '\">' + o.t + '</span>';\n  }).join('');",
     "setHTML($('hud'), chips.map(function(o){\n    return '<span class=\"' + (o.c||'') + '\">' + o.t + '</span>';\n  }).join(''));"]
  ],
  'public/sim/atom.html': [
    ["$('hud').innerHTML = chips.map(function(o){\n    return '<span class=\"'+(o.c||'')+'\">'+o.t+'</span>';\n  }).join('');",
     "setHTML($('hud'), chips.map(function(o){\n    return '<span class=\"'+(o.c||'')+'\">'+o.t+'</span>';\n  }).join(''));"],
    ["$('legend').innerHTML = legendHTML();",
     "setHTML($('legend'), legendHTML());"],
    ["  Array.prototype.forEach.call($('pt').querySelectorAll('button[data-z]'), function(b){\n    b.dataset.on = (+b.dataset.z === z) ? '1' : '0';\n  });",
     "  if(window.__ptZ !== z){\n    window.__ptZ = z;\n    Array.prototype.forEach.call($('pt').querySelectorAll('button[data-z]'), function(b){\n      b.dataset.on = (+b.dataset.z === z) ? '1' : '0';\n    });\n  }"]
  ],
  'public/sim/pendulum.html': [
    ["$('hud').innerHTML=chips.map(function(o){ return '<span class=\"'+(o.c||'')+'\">'+o.t+'</span>'; }).join('');",
     "setHTML($('hud'), chips.map(function(o){ return '<span class=\"'+(o.c||'')+'\">'+o.t+'</span>'; }).join(''));"],
    ["  $('legend').innerHTML =\n    '<span>груз m₁<i style=\"background:'+C('sand','#D9B98C')+'\"></i></span>'+\n    '<span>груз m₂<i style=\"background:'+C('aqua','#4FD8C4')+'\"></i></span>'+\n    (showGhost?'<span>двойник<i style=\"background:'+C('rose','#D69FA9')+'\"></i></span>':'');",
     "  setHTML($('legend'),\n    '<span>груз m₁<i style=\"background:'+C('sand','#D9B98C')+'\"></i></span>'+\n    '<span>груз m₂<i style=\"background:'+C('aqua','#4FD8C4')+'\"></i></span>'+\n    (showGhost?'<span>двойник<i style=\"background:'+C('rose','#D69FA9')+'\"></i></span>':''));"]
  ]
};

for(const [p, pairs] of Object.entries(TARGETS)){
  let s = rd(p);
  if(!s){ log.push('[?] ' + p); continue; }
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const acts = [];
  if(!/function setHTML\(/.test(s)){
    const anchor = s.indexOf('var $ = function(id)');
    const alt = s.indexOf('var $=function(id)');
    const at = anchor >= 0 ? anchor : alt;
    if(at >= 0){
      const lineEnd = s.indexOf('\n', at);
      s = s.slice(0, lineEnd + 1) + HELPER.replace(/\n/g, eol) + eol + s.slice(lineEnd + 1);
      acts.push('хелпер setHTML');
    }
  }
  for(const [from, to] of pairs){
    const a = from.replace(/\n/g, eol), b = to.replace(/\n/g, eol);
    if(s.includes(a)){ s = s.split(a).join(b); acts.push('кэш HTML'); }
    else if(!s.includes(b)) acts.push('якорь не найден');
  }
  if(acts.length){ wr(p, s); log.push((dry?'[dry] ':'[fix] ') + p + ' → ' + acts.join(', ')); }
  else log.push('[ok ] ' + p);
}

/* FrameBridge больше не нужен: ModelShell сам управляет кадром */
{
  const p = 'src/layouts/Base.astro';
  let s = rd(p);
  if(s && /FrameBridge/.test(s)){
    s = s.replace(/^.*import\s+FrameBridge.*$\r?\n?/gm, '');
    s = s.replace(/[ \t]*<FrameBridge\s*\/>\r?\n?/g, '');
    wr(p, s);
    log.push((dry?'[dry] ':'[fix] ') + p + ' → FrameBridge удалён');
  } else log.push('[ok ] ' + p);
  const f = 'src/components/FrameBridge.astro';
  if(existsSync(f)){
    if(!dry) unlinkSync(f);
    log.push((dry?'[dry] ':'[del] ') + f);
  }
}

console.log(log.join('\n'));