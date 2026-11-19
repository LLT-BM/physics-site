/* LibLabTab · единый вывод чисел во всех симуляциях.
   Убирает «-0,0», ставит десятичную запятую и типографский минус,
   согласует знак «+» с округлённым значением.
   node tools/fix-numbers.mjs --dry | node tools/fix-numbers.mjs — идемпотентно. */
import process from 'node:process';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'public/sim';
const dry = process.argv.includes('--dry');
if (!existsSync(join(DIR, 'lib/fmt.js'))) { console.log('Сначала создайте public/sim/lib/fmt.js'); process.exit(1); }

/* Начало операнда слева от точки перед .toFixed */
function operandStart(s, dot){
  let i = dot - 1;
  while (i >= 0 && /\s/.test(s[i])) i--;
  if (i < 0) return null;
  const end = i + 1;

  const backIdent = () => {
    while (i >= 0){
      const c = s[i];
      if (/[\w$.]/.test(c)) { i--; continue; }
      if (c === ']'){
        let d = 1; i--;
        while (i >= 0 && d > 0){ if (s[i] === ']') d++; else if (s[i] === '[') d--; i--; }
        continue;
      }
      break;
    }
  };

  if (s[i] === ')'){
    let d = 1; i--;
    while (i >= 0 && d > 0){
      const c = s[i];
      if (c === ')') d++;
      else if (c === '(') d--;
      i--;
    }
    backIdent();
  } else {
    backIdent();
  }

  let start = i + 1;
  if (start >= end) return null;

  /* унарный минус включаем в операнд */
  let k = start - 1;
  while (k >= 0 && /\s/.test(s[k])) k--;
  if (k >= 0 && s[k] === '-'){
    let p = k - 1;
    while (p >= 0 && /\s/.test(s[p])) p--;
    const prev = p >= 0 ? s[p] : '(';
    if ('(,=:+?[{;|&!<>'.includes(prev)) start = k;
  }
  return { start, end };
}

const TOFIXED = /\.toFixed\(\s*([^()]*?)\s*\)\s*\.replace\(\s*['"]\.['"]\s*,\s*['"],['"]\s*\)/g;
const SIGN_PLAIN = /\(\s*([A-Za-z_$][\w$.]*)\s*>\s*0\s*\?\s*'\+'\s*:\s*''\s*\)\s*\+\s*(?:fmt|nf|LLTfix)\(\s*([^,]+?)\s*,\s*(\d+)\s*\)/g;
const SIGN_ABS = /\(\s*([A-Za-z_$][\w$.]*)\s*>=?\s*0\s*\?\s*'\+'\s*:\s*'[−-]'\s*\)\s*\+\s*Math\.abs\(\s*([^)]+?)\s*\)\s*(?:\.toFixed\(\s*(\d+)\s*\)(?:\s*\.replace\(\s*['"]\.['"]\s*,\s*['"],['"]\s*\))?|(?:fmt|nf)\(\s*([^,]+?)\s*,\s*(\d+)\s*\))/g;

let changed = 0, total = 0;

for (const f of readdirSync(DIR).filter(x => x.toLowerCase().endsWith('.html'))){
  const p = join(DIR, f);
  const orig = readFileSync(p, 'utf8'); total++;
  const eol = orig.includes('\r\n') ? '\r\n' : '\n';
  let s = orig; const acts = [];

  /* 1. Библиотека чисел должна быть подключена */
  if (!/\/sim\/lib\/fmt\.js/.test(s)){
    const tag = '<script src="/sim/lib/fmt.js"></script>';
    if (/<script src="\/sim\/lib\/theme\.js"><\/script>/i.test(s)){
      s = s.replace(/<script src="\/sim\/lib\/theme\.js"><\/script>/i, m => m + eol + tag);
    } else if (/<\/head>/i.test(s)){
      s = s.replace(/<\/head>/i, '  ' + tag + eol + '</head>');
    } else {
      s = tag + eol + s;
    }
    acts.push('fmt.js подключён');
  }

  /* 2. Знак «+»/«−» вместе с округлением */
  let signs = 0;
  s = s.replace(SIGN_ABS, (m, cond, absArg, n1, fmtArg, n2) => {
    const arg = absArg || fmtArg;
    const n = n1 || n2 || '2';
    signs++;
    return 'LLTsigned(' + arg + ', ' + n + ')';
  });
  s = s.replace(SIGN_PLAIN, (m, cond, arg, n) => { signs++; return 'LLTsigned(' + arg + ', ' + n + ')'; });
  if (signs) acts.push('знак согласован с округлением: ' + signs);

  /* 3. Все выводные toFixed → LLTfix (запятая, без -0) */
  const hits = [];
  let m;
  TOFIXED.lastIndex = 0;
  while ((m = TOFIXED.exec(s))){
    const op = operandStart(s, m.index);
    if (!op) continue;
    const operand = s.slice(op.start, op.end).trim();
    if (!operand || /^LLTfix$/.test(operand)) continue;
    hits.push({ from: op.start, to: m.index + m[0].length, text: 'LLTfix(' + operand + ', ' + m[1] + ')' });
  }
  for (let i = hits.length - 1; i >= 0; i--){
    const h = hits[i];
    s = s.slice(0, h.from) + h.text + s.slice(h.to);
  }
  if (hits.length) acts.push('выводных чисел нормализовано: ' + hits.length);

  /* 4. Локальные помощники формата переводим на общий */
  const helper = /function\s+(fmt|nfx)\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*\{[^{}]*?\.toFixed\(\s*\3\s*\)[^{}]*?\}/g;
  let helpers = 0;
  s = s.replace(helper, (mm, name, a, b) => {
    helpers++;
    return 'function ' + name + '(' + a + ',' + b + '){ return LLTfix(' + a + ',' + b + '); }';
  });
  if (helpers) acts.push('локальных помощников переведено: ' + helpers);

  if (s !== orig){
    changed++;
    if (!dry) writeFileSync(p, s, 'utf8');
    console.log((dry ? '[dry] ' : '[fix] ') + f.padEnd(26) + ' → ' + acts.join(', '));
  } else console.log('[ok ] ' + f);
}

console.log('\n' + (dry ? 'Будет изменено' : 'Изменено') + ' файлов: ' + changed + ' из ' + total);