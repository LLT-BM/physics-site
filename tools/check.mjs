/* LibLabTab · статическая проверка симуляций.
   Запуск: node tools/check.mjs
   Код возврата 1, если есть проблемы — пригодно для CI. */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'public/sim';
const MAP = {
  'atom.html':                'atom-model',
  'atomic-interactions.html': 'atomic-interactions',
  'bernoulli.html':           'bernoulli',
  'circuit.html':             'circuit-lab',
  'lens.html':                'lens-image',
  'lenz.html':                'lenz-law',
  'lever.html':               'lever-moments',
  'life.html':                'life-game',
  'math-pendulum.html':       'math-pendulum',
  'pendulum.html':            'double-pendulum',
  'penrose-billiard.html':    'penrose-billiard',
  'scale.html':               'scale-of-universe',
  'spring-pendulum.html':     'spring-pendulum'
};

const fail = [], warn = [];
const bad = (f, m) => fail.push(`${f}: ${m}`);
const soft = (f, m) => warn.push(`${f}: ${m}`);

if(!existsSync(DIR)){
  console.log('[FAIL] Нет папки ' + DIR + '. Запускайте из корня проекта.');
  process.exit(1);
}

const files = readdirSync(DIR).filter(f => f.toLowerCase().endsWith('.html'));

for(const f of files){
  if(!MAP[f]) bad(f, 'файл не описан в MAP — добавьте его в tools/check.mjs и tools/fix-sims.mjs');
}
for(const f of Object.keys(MAP)){
  if(!files.includes(f)) bad(f, 'файл описан в MAP, но отсутствует в ' + DIR);
}

const stripBlocks = s => s
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<!--[\s\S]*?-->/g, '');

let ok = 0;
for(const f of files){
  const src = readFileSync(join(DIR, f), 'utf8');
  const before = fail.length + warn.length;

  const want = `https://liblabtab.ru/models/${MAP[f] || '?'}/`;
  const m = src.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i);
  const got = m ? (m[0].match(/href=["']([^"']*)["']/i) || [])[1] : undefined;
  if(!m) bad(f, 'нет <link rel="canonical">');
  else if(got !== want) bad(f, `canonical «${got}» вместо «${want}»`);

  if(!/\/sim\/guard\.js/.test(src)) bad(f, 'не подключён /sim/guard.js');

  if(/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(src))
    bad(f, 'внешний запрос к Google Fonts — шрифты должны быть локальными');

  const tags = stripBlocks(src).match(/<[a-zA-Z][^>]*>/g) || [];
  for(const t of tags){
    if((t.match(/\sclass\s*=/gi) || []).length > 1){
      bad(f, 'два атрибута class в одном теге: ' + t.slice(0, 70) + '…');
      break;
    }
  }

  if(!/\/fonts\/fonts\.css/.test(src)) soft(f, 'не подключён /fonts/fonts.css');
  if(!/id=["']reset["']|Сброс/.test(src)) soft(f, 'нет кнопки сброса — расхождение с остальными моделями');
  if(!/Пуск|Пауза|play|run/i.test(src)) soft(f, 'не найдено управления пуском/паузой');

  if(fail.length + warn.length === before) ok++;
}

console.log('Проверено файлов: ' + files.length);
console.log('');
if(fail.length){
  console.log('ОШИБКИ (' + fail.length + '):');
  fail.forEach(x => console.log('  [FAIL] ' + x));
  console.log('');
}
if(warn.length){
  console.log('ЗАМЕЧАНИЯ (' + warn.length + '):');
  warn.forEach(x => console.log('  [ !  ] ' + x));
  console.log('');
}
console.log(fail.length
  ? 'ИТОГ: ошибок ' + fail.length + ', замечаний ' + warn.length + ', чистых файлов ' + ok
  : 'ИТОГ: ошибок нет. Замечаний: ' + warn.length + '. Чистых файлов: ' + ok);
process.exit(fail.length ? 1 : 0);