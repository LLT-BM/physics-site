/* LibLabTab · закрывает оставшиеся TODO аудита.
   node tools/close-todo.mjs --dry | node tools/close-todo.mjs */
import process from 'node:process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const dry = process.argv.includes('--dry');
const log = [];
const rd = p => existsSync(p) ? readFileSync(p, 'utf8') : '';
const wr = (p, s) => { if(!dry) writeFileSync(p, s, 'utf8'); };

/* ── 1. P0: планковская длина ─────────────────────────────────────── */
{
  const p = 'src/content/models/scale-of-universe.md';
  let s = rd(p), n = 0;
  if(s){
    const before = s;
    s = s.replace(/меньше планковской длины/g, 'одного порядка с планковской длиной');
    s = s.replace(/Оба числа одного порядка с планковской длиной/,
      'Мяч даёт 4,8 планковской длины, человек — 0,59: оба значения одного порядка с планковской длиной');
    if(s !== before){ n++; wr(p, s); }
    log.push((n ? (dry?'[dry] ':'[fix] ') : '[ok ] ') + p + ' → планковская длина');
  } else log.push('[?] ' + p);
}

/* ── 2. P0: затухание математического маятника ────────────────────── */
{
  const p = 'src/content/models/math-pendulum.md';
  let s = rd(p), hit = false;
  const NEW = '- **Затухание линейное** по угловой скорости. Период складывается из двух эффектов: ' +
    'убывание амплитуды укорачивает его, а само трение удлиняет в 1/√(1 − ζ²) раз, где ζ = b/(2ω₀). ' +
    'При больших амплитудах доминирует первое, при малых второе, и в пределе T → T₀/√(1 − ζ²), ' +
    'то есть чуть больше T₀, а не ровно T₀. Реальное сопротивление воздуха квадратично по скорости, ' +
    'а трение в подвесе ближе к сухому.';
  if(s){
    if(/^- \*\*Затухание линейное\*\*.*$/m.test(s)){
      s = s.replace(/^- \*\*Затухание линейное\*\*.*$/m, NEW); hit = true;
    } else if(/стремясь к T₀/.test(s)){
      s = s.replace(/[^\n]*стремясь к T₀[^\n]*/, NEW); hit = true;
    } else if(/период при этом уменьшается/.test(s)){
      s = s.replace(/[^\n]*период при этом уменьшается[^\n]*/, NEW); hit = true;
    }
    if(hit) wr(p, s);
    log.push((hit ? (dry?'[dry] ':'[fix] ') : '[ok ] ') + p + ' → затухание T₀/√(1−ζ²)');
  } else log.push('[?] ' + p);
}

/* ── 3. Форматирование чисел и aria-label в трёх симуляциях ───────── */
const BOOT = [
  '/* LibLabTab · форматирование чисел ru-RU */',
  "var NF=(typeof window.LLTfix==='function')?window.LLTfix:function(x,n){",
  "  if(typeof x!=='number'||!isFinite(x))return '—';",
  '  n=(n==null?2:n);var p=Math.pow(10,n),r=Math.round(x*p)/p;if(r===0)r=0;',
  "  var t=Math.abs(r).toFixed(n).split('.').join(',');",
  "  return r<0?'−'+t:t;",
  '};',
  "var NS=(typeof window.LLTsigned==='function')?window.LLTsigned:function(x,n){",
  "  if(typeof x!=='number'||!isFinite(x))return '—';",
  '  n=(n==null?2:n);var p=Math.pow(10,n),r=Math.round(x*p)/p;if(r===0)r=0;',
  "  return (r>0?'+':'')+NF(x,n);",
  '};'
].join('\n');

function operandStart(s, dot){
  let i = dot - 1;
  while(i >= 0 && /\s/.test(s[i])) i--;
  if(i < 0) return null;
  const end = i + 1;
  const backIdent = () => {
    while(i >= 0){
      const c = s[i];
      if(/[\w$.]/.test(c)){ i--; continue; }
      if(c === ']'){ let d=1; i--; while(i>=0&&d>0){ if(s[i]===']')d++; else if(s[i]==='[')d--; i--; } continue; }
      break;
    }
  };
  if(s[i] === ')'){
    let d = 1; i--;
    while(i >= 0 && d > 0){ const c=s[i]; if(c===')')d++; else if(c==='(')d--; i--; }
    backIdent();
  } else backIdent();
  const start = i + 1;
  return start < end ? { start, end } : null;
}
const DISPLAY = /textContent|innerHTML|innerText|fillText|strokeText/;

for(const f of ['atom.html','life.html','pendulum.html']){
  const p = join('public/sim', f);
  let s = rd(p);
  if(!s){ log.push('[?] ' + p); continue; }
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const acts = [];

  if(!/\bvar\s+NF\s*=/.test(s)){
    const anchor = s.search(/<script(?![^>]*\bsrc=)[^>]*>/i);
    if(anchor >= 0){
      const open = s.indexOf('>', anchor) + 1;
      s = s.slice(0, open) + eol + BOOT + eol + s.slice(open);
      acts.push('форматтер NF/NS');
    }
  }

  /* меняем toFixed только там, где число идёт на экран */
  const lines = s.split(/\r?\n/);
  let changedLines = 0;
  for(let li = 0; li < lines.length; li++){
    let line = lines[li];
    if(!DISPLAY.test(line) || !/\.toFixed\(/.test(line)) continue;
    const re = /\.toFixed\(\s*([^()]*?)\s*\)/g;
    let m, hits = [];
    while((m = re.exec(line))){
      const op = operandStart(line, m.index);
      if(!op) continue;
      const operand = line.slice(op.start, op.end).trim();
      if(!operand || /^NF$/.test(operand)) continue;
      hits.push({ from: op.start, to: m.index + m[0].length, text: 'NF(' + operand + ', ' + m[1] + ')' });
    }
    for(let i = hits.length - 1; i >= 0; i--){
      const h = hits[i];
      line = line.slice(0, h.from) + h.text + line.slice(h.to);
    }
    if(hits.length){ lines[li] = line; changedLines += hits.length; }
  }
  if(changedLines){ s = lines.join(eol); acts.push('выводных чисел: ' + changedLines); }

  if(f === 'pendulum.html' && !/<canvas[^>]*aria-label/i.test(s)){
    s = s.replace(/<canvas\b([^>]*)>/i, (mm, a) =>
      '<canvas role="img" aria-label="Двойной маятник: два груза на шарнирах, след и двойник с отличием 0,1 градуса"' + a + '>');
    acts.push('aria-label сцены');
  }

  if(acts.length){ wr(p, s); log.push((dry?'[dry] ':'[fix] ') + p + ' → ' + acts.join(', ')); }
  else log.push('[ok ] ' + p);
}

/* ── 4. Гигиена ───────────────────────────────────────────────────── */
if(existsSync('site.zip')){
  if(!dry) unlinkSync('site.zip');
  log.push((dry?'[dry] ':'[del] ') + 'site.zip');
} else log.push('[ok ] site.zip отсутствует');

if(!existsSync('.nvmrc')){ wr('.nvmrc', '22\n'); log.push((dry?'[dry] ':'[fix] ') + '.nvmrc → 22'); }
else log.push('[ok ] .nvmrc');

{
  const p = 'package.json';
  const raw = rd(p);
  if(raw){
    let j; try { j = JSON.parse(raw); } catch { j = null; }
    if(j){
      j.scripts = j.scripts || {};
      let touched = false;
      if(j.scripts.test !== 'node --test tests/'){ j.scripts.test = 'node --test tests/'; touched = true; }
      if(j.scripts.audit !== 'node tools/audit-state.mjs'){ j.scripts.audit = 'node tools/audit-state.mjs'; touched = true; }
      if(touched){ wr(p, JSON.stringify(j, null, 2) + '\n'); log.push((dry?'[dry] ':'[fix] ') + p + ' → scripts.test, scripts.audit'); }
      else log.push('[ok ] package.json scripts');
    }
  }
}

/* ── 5. Машинный режим аудита не должен считаться падением ────────── */
{
  const p = 'tools/audit-state.mjs';
  let s = rd(p);
  if(s && /process\.exit\(\(counts\.TODO \+ counts\.CONFLICT\) \? 1 : 0\);/.test(s)){
    s = s.replace(/process\.exit\(\(counts\.TODO \+ counts\.CONFLICT\) \? 1 : 0\);/,
      'process.exit(asJson ? 0 : ((counts.TODO + counts.CONFLICT) ? 1 : 0));');
    wr(p, s);
    log.push((dry?'[dry] ':'[fix] ') + p + ' → --json возвращает 0');
  } else log.push('[ok ] tools/audit-state.mjs');
}

console.log(log.join('\n'));
console.log('\n' + (dry ? 'Предпросмотр' : 'Готово') +
  '. Далее: положите public/sim/lib/physics.js, tests/physics.test.mjs, .github/workflows/ci.yml');