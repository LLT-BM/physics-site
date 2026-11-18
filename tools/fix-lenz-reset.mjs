/* LibLabTab · явный сброс для lenz.html вместо универсального.
   Запуск: node tools/fix-lenz-reset.mjs
   Идемпотентен. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const P = 'public/sim/lenz.html';
if(!existsSync(P)){ console.log('Нет файла ' + P); process.exit(1); }

const orig = readFileSync(P, 'utf8');
const eol = orig.includes('\r\n') ? '\r\n' : '\n';
let s = orig;

/* 1. Убираем прежний универсальный блок, если он есть. */
const OLD = /<script>\s*\/\* LibLabTab · единый сброс \*\/[\s\S]*?<\/script>\s*/i;
const hadOld = OLD.test(s);
if(hadOld) s = s.replace(OLD, '');

/* 2. Убеждаемся, что кнопка есть. */
if(!/id=["']reset["']/.test(s)){
  const btn = '    <button id="reset" class="tgl" type="button">Сброс</button>' + eol;
  if(/<\/footer>/i.test(s)) s = s.replace(/<\/footer>/i, btn + '  </footer>');
  else s = s.replace(/<\/body>/i, btn + '</body>');
}

/* 3. Ставим явный обработчик. */
const MARK = '/* LibLabTab · сброс Ленца */';
if(s.includes(MARK)){
  console.log('[ok ] явный сброс уже установлен');
} else {
  const block = [
    '<script>',
    MARK,
    '(function(){',
    '  var b=document.getElementById("reset");',
    '  if(!b||b.__lenzWired)return; b.__lenzWired=true;',
    '  b.addEventListener("click",function(){',
    '    try{',
    '      setAuto(false);',
    '      var f=$("freq"), t=$("turns");',
    '      f.value=f.defaultValue; S.freq=(+f.value)/100;',
    '      $("freqVal").textContent=S.freq.toFixed(2)+" Гц";',
    '      t.value=t.defaultValue; S.turns=+t.value;',
    '      $("turnsVal").textContent="N = "+S.turns;',
    '      S.s=1; S.phase=0; S.emf=0; S.dAbsS=0; S.needle=0; S.vS=0;',
    '      S.phiPrev=null; S.absPrev=null; S.prevMx=null;',
    '      S.drag=false; S.hover=false;',
    '      geo=layout();',
    '      S.mx=geo.xmin+(geo.xmax-geo.xmin)*0.35;',
    '    }catch(e){',
    '      if(window.__simFail) window.__simFail("сброс: "+e.message);',
    '      else location.reload();',
    '    }',
    '  });',
    '})();',
    '</script>'
  ].join(eol);
  s = s.replace(/<\/body>/i, block + eol + '</body>');
}

if(s !== orig){
  writeFileSync(P, s, 'utf8');
  console.log('[fix] lenz.html → ' + (hadOld ? 'универсальный блок заменён на явный' : 'явный сброс добавлен'));
} else {
  console.log('[ok ] изменений не требуется');
}