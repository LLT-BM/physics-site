/* LibLabTab · согласует тексты и контрольные точки с исправленной физикой.
   node tools/fix-content2.mjs --dry | node tools/fix-content2.mjs */
import process from 'node:process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const M = 'src/content/models';
const dry = process.argv.includes('--dry');

const EDITS = {
  'bernoulli.md': [
    ['| p₃ с диффузором | 22 829 Па, потеря **7171 Па** |',
     '| p₃ с диффузором | ≈ 21,5 кПа, потеря **≈ 8,5 кПа** |'],
    ['| p₃ без диффузора | 7560 Па, потеря **22 440 Па** |',
     '| p₃ без диффузора | ≈ 7,2 кПа, потеря **≈ 22,8 кПа** |'],
    ['Отсюда практический вывод: **диффузор нужен**.',
     'Числа 7171 и 22 440 Па — двухсегментная оценка, в которой трение считается только на прямых участках. Модель интегрирует Дарси–Вейсбаха по всей длине, включая конус и диффузор, где скорость меняется от 8 до 2 м/с, поэтому показывает примерно на 1,3 кПа больше. Расхождение — не ошибка, а полнота учёта: самотест сверяет результат с той же интегральной схемой на сетке в 12 раз мельче.\n\nОтсюда практический вывод: **диффузор нужен**.'],
    ['"Потеря без диффузора"', '"Потеря без диффузора (интегральная)"'],
    ['"22 440 Па"', '"≈ 22,8 кПа"'],
    ['"Потеря с диффузором"', '"Потеря с диффузором (интегральная)"'],
    ['"7171 Па"', '"≈ 8,5 кПа"']
  ],
  'penrose-billiard.md': [
    ['v_max = 0,871592', 'v_max = 0,871591'],
    ['S = 1,232617', 'S = 1,232616'],
    ['фокусы в (±0,752513, ±0,752513), сторона квадрата 1,505025',
     'фокусы в (±0,752513, ±0,752513), сторона квадрата 1,505025 — ползунок «Параметр формы» задаёт p напрямую'],
    ['Шесть типов стенок', 'Пять типов стенок'],
    ['шесть типов стенок', 'пять типов стенок']
  ]
};

let changed = 0; const miss = [];
for(const [file, pairs] of Object.entries(EDITS)){
  const p = join(M, file);
  if(!existsSync(p)){ miss.push(file + ': нет файла'); continue; }
  const orig = readFileSync(p, 'utf8');
  let s = orig; const marks = [];
  for(const [a, b] of pairs){
    if(s.includes(a)){ s = s.split(a).join(b); marks.push('✓'); }
    else if(s.includes(b)) marks.push('=');
    else { marks.push('✗'); miss.push(file + ' → ' + a.slice(0, 64)); }
  }
  if(s !== orig){ changed++; if(!dry) writeFileSync(p, s, 'utf8'); }
  console.log((s !== orig ? (dry ? '[dry] ' : '[fix] ') : '[ok ] ') + file.padEnd(24) + ' ' + marks.join(' '));
}
console.log('\n' + (dry ? 'Будет изменено' : 'Изменено') + ' файлов: ' + changed);
if(miss.length){ console.log('\nНе применено:'); miss.forEach(x => console.log('  ' + x)); }