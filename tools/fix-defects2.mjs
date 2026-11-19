/* LibLabTab · добор якорей, не сработавших из-за CRLF.
   Все шаблоны нечувствительны к переводу строк и пробелам.
   node tools/fix-defects2.mjs --dry | node tools/fix-defects2.mjs */
import process from 'node:process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dry = process.argv.includes('--dry');
const SIM = 'public/sim';
const MD = 'src/content/models';
const report = [];

function apply(path, rules){
  if(!existsSync(path)){ report.push('[?] ' + path + ' — нет файла'); return; }
  const orig = readFileSync(path, 'utf8');
  let s = orig; const done = [], already = [], missed = [];
  for(const r of rules){
    if(r.applied && r.applied.test(s)){ already.push(r.name); continue; }
    if(r.re.test(s)){ s = s.replace(r.re, r.to); done.push(r.name); }
    else missed.push(r.name);
  }
  if(s !== orig && !dry) writeFileSync(path, s, 'utf8');
  report.push((s !== orig ? (dry ? '[dry] ' : '[fix] ') : '[ok ] ') + path.padEnd(34) +
    ' → ' + (done.join(', ') || 'без изменений') +
    (already.length ? '  (уже: ' + already.join(', ') + ')' : '') +
    (missed.length ? '  (НЕ НАЙДЕНО: ' + missed.join(', ') + ')' : ''));
}

apply(join(SIM, 'bernoulli.html'), [
  { name: 'compute(NN)',
    re: /function\s+compute\s*\(\s*\)\s*\{/,
    to: 'function compute(NN){',
    applied: /function\s+compute\s*\(\s*NN\s*\)/ },
  { name: 'N = NN||320',
    re: /(var\s+gp\s*=\s*geomPipe\(\)\s*,\s*N\s*=\s*)320(\s*,)/,
    to: '$1NN||320$2',
    applied: /N\s*=\s*NN\s*\|\|\s*320/ },
  { name: 'эталон l1 по сетке',
    re: /var\s+l1\s*=\s*compute\(\)\.loss\s*\*\s*P\.rho\s*\*\s*G\s*;/,
    to: 'var l1=compute().loss*P.rho*G,r1=compute(4000).loss*P.rho*G;',
    applied: /r1\s*=\s*compute\(4000\)/ },
  { name: 'проверка потери с диффузором',
    re: /chk\(\s*'Потеря с диффузором[^']*'\s*,\s*l1\s*,\s*7170\.7\s*,\s*0\.10\s*,\s*'Па'\s*\)/,
    to: "chk('Потеря с диффузором: сходимость сетки',l1,r1,0.01,'Па')",
    applied: /сходимость сетки'\s*,\s*l1\s*,\s*r1/ },
  { name: 'эталон l2 по сетке',
    re: /var\s+l2\s*=\s*compute\(\)\.loss\s*\*\s*P\.rho\s*\*\s*G\s*;/,
    to: 'var l2=compute().loss*P.rho*G,r2=compute(4000).loss*P.rho*G;',
    applied: /r2\s*=\s*compute\(4000\)/ },
  { name: 'проверка потери без диффузора',
    re: /chk\(\s*'Потеря без диффузора[^']*'\s*,\s*l2\s*,\s*22440\.1\s*,\s*0\.10\s*,\s*'Па'\s*\)/,
    to: "chk('Потеря без диффузора: сходимость сетки',l2,r2,0.01,'Па')",
    applied: /сходимость сетки'\s*,\s*l2\s*,\s*r2/ }
]);

apply(join(SIM, 'penrose-billiard.html'), [
  { name: 'пучок: два отражения',
    re: /(for\s*\(\s*var\s+k\s*=\s*0\s*;\s*k\s*<\s*)3(\s*;\s*k\s*\+\+\s*\)\s*\{\s*var\s+h\s*=\s*hit\(g\s*,\s*p\[0\]\s*,\s*p\[1\]\s*,\s*d\[0\]\s*,\s*d\[1\]\))/,
    to: '$12$2',
    applied: /k\s*<\s*2\s*;\s*k\s*\+\+\s*\)\s*\{\s*var\s+h\s*=\s*hit\(g\s*,\s*p\[0\]/ }
]);

/* Формулировка «шесть типов» уже исправлена в верхнем регистре — считаем закрытой */
apply(join(MD, 'penrose-billiard.md'), [
  { name: 'пять типов стенок',
    re: /[Шш]есть(\s+типов)/g,
    to: (m, p1) => (m[0] === 'Ш' ? 'Пять' : 'пять') + p1,
    applied: /[Пп]ять\s+типов/ }
]);

console.log(report.join('\n'));
const bad = report.filter(l => l.includes('НЕ НАЙДЕНО'));
console.log('\n' + (dry ? 'Предпросмотр' : 'Готово') + (bad.length ? ' · осталось: ' + bad.length : ' · все правки на месте'));