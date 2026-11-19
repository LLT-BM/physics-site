/* LibLabTab · починка penrose-billiard.html + проверка синтаксиса всех симуляций.
   В режиме --dry проверка идёт по исправленному тексту, а не по старому.
   node tools/fix-penrose.mjs --dry | node tools/fix-penrose.mjs */
import process from 'node:process';
import vm from 'node:vm';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'public/sim';
const dry = process.argv.includes('--dry');
if(!existsSync(DIR)){ console.log('Запускайте из корня проекта'); process.exit(1); }

const pending = new Map();
const P = join(DIR, 'penrose-billiard.html');

if(existsSync(P)){
  const orig = readFileSync(P, 'utf8');
  const eol = orig.includes('\r\n') ? '\r\n' : '\n';
  let s = orig; const acts = [];

  /* 1. Незакрытая Math.min в ветке circle */
  const CIRCLE = /loops\.push\(\{pts:pc[\s\S]*?\}\);/;
  const CIRCLE_OK = 'loops.push({pts:pc,gs:pc.map(function(q,i){return Math.min(7,Math.floor(i/(pc.length/8)));}),hole:false});';
  if(CIRCLE.test(s)){
    if(s.match(CIRCLE)[0] !== CIRCLE_OK){ s = s.replace(CIRCLE, CIRCLE_OK); acts.push('скобка в ветке circle'); }
  } else acts.push('ВНИМАНИЕ: оператор circle не найден');

  /* 2. Лишний помощник */
  const HELPER = /^[ \t]*function\s+pe2len\s*\([^)]*\)\s*\{[^}]*\}[ \t]*\r?\n?/m;
  if(HELPER.test(s)){ s = s.replace(HELPER, ''); acts.push('убран pe2len'); }

  /* 3. Английское слово в подсказке */
  if(/distributes/.test(s)){
    s = s.replace(/Разброс 360° distributes лучи/g, 'Разброс 360° раскладывает лучи');
    s = s.replace(/distributes/g, 'раскладывает');
    acts.push('опечатка distributes');
  }

  /* 4. Запасные форматтеры на случай отсутствия fmt.js */
  if(!/\bvar\s+NF\s*=/.test(s)){
    const FALLBACK = [
      '/* LibLabTab · форматирование чисел с запасным вариантом */',
      "var NF=(typeof window.LLTfix==='function')?window.LLTfix:function(x,n){",
      "  if(typeof x!=='number'||!isFinite(x))return '—';",
      '  n=(n==null?2:n);var p=Math.pow(10,n),r=Math.round(x*p)/p;if(r===0)r=0;',
      "  var t=Math.abs(r).toFixed(n).replace('.',',');",
      "  return r<0?'−'+t:t;",
      '};',
      "var NS=(typeof window.LLTsigned==='function')?window.LLTsigned:function(x,n){",
      "  if(typeof x!=='number'||!isFinite(x))return '—';",
      '  n=(n==null?2:n);var p=Math.pow(10,n),r=Math.round(x*p)/p;if(r===0)r=0;',
      "  return (r>0?'+':'')+NF(x,n);",
      '};'
    ].join(eol);
    s = s.replace(/(window\.PAL\s*=\s*PAL;)/, '$1' + eol + FALLBACK);
    acts.push('запасные форматтеры');
  }
  const nfHits = (s.match(/\bLLTfix\(/g) || []).length;
  const nsHits = (s.match(/\bLLTsigned\(/g) || []).length;
  if(nfHits || nsHits){
    s = s.replace(/\bLLTfix\(/g, 'NF(').replace(/\bLLTsigned\(/g, 'NS(');
    acts.push('вызовов форматтера переведено: ' + (nfHits + nsHits));
  }

  /* 5. Двойной setRun(false) при инициализации */
  const DUP = /(try\{selfTest\(\);\}catch\(e\)\{\})\s*\r?\n\s*setRun\(false\);/;
  if(DUP.test(s)){ s = s.replace(DUP, '$1'); acts.push('убран повторный setRun'); }

  if(s !== orig){
    pending.set(P, s);
    console.log((dry ? '[dry] ' : '[fix] ') + 'penrose-billiard.html → ' + acts.join(', '));
  } else console.log('[ok ] penrose-billiard.html');
}

/* Проверка синтаксиса: по исправленному тексту, если он есть */
console.log('\n── Синтаксис inline-скриптов ' + (dry ? '(после правок) ' : '') + '─'.repeat(24));
let bad = 0, files = 0, scripts = 0;
for(const f of readdirSync(DIR).filter(x => x.toLowerCase().endsWith('.html'))){
  const path = join(DIR, f);
  const src = pending.has(path) ? pending.get(path) : readFileSync(path, 'utf8');
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, idx = 0, localBad = 0;
  while((m = re.exec(src))){
    if(/\bsrc\s*=/i.test(m[1])) continue;
    const body = m[2];
    if(!body.trim()) continue;
    idx++; scripts++;
    const startLine = src.slice(0, m.index).split('\n').length;
    try{
      new vm.Script(body, { filename: f + ':script' + idx });
    }catch(e){
      localBad++; bad++;
      console.log('[FAIL] ' + f + ' · скрипт #' + idx + ' (начинается со строки ' + startLine + ')');
      console.log((e.stack || String(e)).split('\n').slice(0, 4).join('\n').replace(/^/gm, '       '));
    }
  }
  files++;
  if(!localBad) console.log('[ok ] ' + f);
}

if(!dry){
  for(const [path, text] of pending) writeFileSync(path, text, 'utf8');
}

console.log('\nФайлов: ' + files + ' · скриптов: ' + scripts + ' · с ошибками: ' + bad);
if(dry && pending.size) console.log('Применить: node tools/fix-penrose.mjs');
if(bad) process.exitCode = 1;