/* LibLabTab · закрывает последний TODO: затухание математического маятника.
   Правит ВСЕ вхождения старых формулировок, а не только первое.
   node tools/fix-damping.mjs --dry | node tools/fix-damping.mjs */
import process from 'node:process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const P = 'src/content/models/math-pendulum.md';
const dry = process.argv.includes('--dry');
if(!existsSync(P)){ console.log('Нет файла ' + P); process.exit(1); }

const orig = readFileSync(P, 'utf8');
let s = orig;
const acts = [];

const NEW_ITEM = '- **Затухание линейное** по угловой скорости. Период складывается из двух эффектов: ' +
  'убывание амплитуды укорачивает его, а само трение удлиняет в 1/√(1 − ζ²) раз, где ζ = b/(2ω₀). ' +
  'При больших амплитудах доминирует первое, при малых второе, и в пределе T → T₀/√(1 − ζ²), ' +
  'то есть чуть больше T₀, а не ровно T₀. Реальное сопротивление воздуха квадратично по скорости, ' +
  'а трение в подвесе ближе к сухому.';

const NEW_PARA = 'Период затухающих колебаний складывается из двух эффектов: убывание амплитуды ' +
  'укорачивает его, а само трение удлиняет в 1/√(1 − ζ²) раз, где ζ = b/(2ω₀). При больших амплитудах ' +
  'доминирует первое, при малых второе; в пределе T → T₀/√(1 − ζ²). При b = 0,3 и амплитуде 120° ' +
  'отношение T/T₀ стремится к 1,0011, а не к единице.';

/* 1. Пункт списка в «Границах модели» */
{
  const re = /^-\s*\*\*Затухание линейное\*\*.*$/gm;
  const hits = s.match(re) || [];
  let n = 0;
  s = s.replace(re, m => { if(m === NEW_ITEM) return m; n++; return NEW_ITEM; });
  if(n) acts.push('пункт «Затухание линейное»: ' + n);
}

/* 2. Абзац в «Физике»: любая строка со старой формулировкой */
{
  const trig = /(стремясь к T₀|период при этом уменьшается|период уменьшается, стремясь)/;
  const lines = s.split(/\r?\n/);
  const eol = orig.includes('\r\n') ? '\r\n' : '\n';
  let n = 0;
  for(let i = 0; i < lines.length; i++){
    const L = lines[i];
    if(!trig.test(L)) continue;
    if(L.includes('T₀/√(1 − ζ²)')) continue;
    lines[i] = /^-\s/.test(L) ? NEW_ITEM : NEW_PARA;
    n++;
  }
  if(n){ s = lines.join(eol); acts.push('абзацев со старой формулировкой: ' + n); }
}

/* 3. Ответы во frontmatter: «к единице» → к 1,0011 */
{
  const before = s;
  s = s.replace(/падает от 1,373 к единице/g, 'падает от 1,373 к 1,0011');
  s = s.replace(/стремятся к единице/g, 'стремятся к 1,0011');
  s = s.replace(/к единице, а не к ровно T₀/g, 'к 1,0011, а не к ровно T₀');
  if(s !== before) acts.push('ответы про предел T/T₀');
}

/* 4. Если правильного предела нигде нет — добавляем абзац перед «Границами» */
if(!/T₀\/√\(1 − ζ²\)/.test(s)){
  const eol = orig.includes('\r\n') ? '\r\n' : '\n';
  if(/^##\s*Границы модели/m.test(s)){
    s = s.replace(/^##\s*Границы модели/m, NEW_PARA + eol + eol + '## Границы модели');
  } else {
    s = s.trimEnd() + eol + eol + NEW_PARA + eol;
  }
  acts.push('абзац про предел добавлен');
}

if(s !== orig){
  if(!dry) writeFileSync(P, s, 'utf8');
  console.log((dry ? '[dry] ' : '[fix] ') + P + ' → ' + acts.join(', '));
} else {
  console.log('[ok ] ' + P + ' — правки не требуются');
}

/* Контроль: показываем остаток, если он есть */
const left = [];
const re = /(стремясь к T₀(?!\/√)|период при этом уменьшается|к единице)/g;
let m;
while((m = re.exec(s))){
  const line = s.slice(0, m.index).split('\n').length;
  const from = s.lastIndexOf('\n', m.index) + 1;
  let to = s.indexOf('\n', m.index); if(to < 0) to = s.length;
  left.push('строка ' + line + ': ' + s.slice(from, to).trim().slice(0, 180));
}
const hasLimit = /T₀\/√\(1 − ζ²\)/.test(s);
console.log('\nпредел T₀/√(1 − ζ²) в тексте: ' + (hasLimit ? 'есть' : 'НЕТ'));
if(left.length){
  console.log('остались старые формулировки (' + left.length + '):');
  left.forEach(x => console.log('  ' + x));
  process.exitCode = 1;
} else {
  console.log('старых формулировок не осталось');
}