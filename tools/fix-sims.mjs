/* LibLabTab · приводит canonical и подключение guard.js к эталону.
   Запуск:  node tools/fix-sims.mjs --dry   — только показать
            node tools/fix-sims.mjs         — применить
   Идемпотентен: повторный запуск не меняет уже правильные файлы. */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
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

const dry = process.argv.includes('--dry');
if(!existsSync(DIR)){ console.log('Нет папки ' + DIR); process.exit(1); }
if(!existsSync(join(DIR, 'guard.js'))){
  console.log('Сначала создайте public/sim/guard.js (шаг 1).'); process.exit(1);
}

const CANON_RE = /<link\b[^>]*rel=["']canonical["'][^>]*>/i;
const FONTS_RE = /<link\b[^>]*href=["']\/fonts\/fonts\.css["'][^>]*>/i;
const GUARD = '<script src="/sim/guard.js"></script>';

let changed = 0, touched = 0;
for(const f of readdirSync(DIR).filter(x => x.toLowerCase().endsWith('.html'))){
  if(!MAP[f]){ console.log('[?] ' + f + ' — нет в MAP, пропущен'); continue; }
  const p = join(DIR, f);
  const orig = readFileSync(p, 'utf8');
  const eol = orig.includes('\r\n') ? '\r\n' : '\n';
  let s = orig;
  const acts = [];

  const want = 'https://liblabtab.ru/models/' + MAP[f] + '/';
  const tag = '<link rel="canonical" href="' + want + '">';
  if(CANON_RE.test(s)){
    const cur = (s.match(CANON_RE)[0].match(/href=["']([^"']*)["']/i) || [])[1];
    if(cur !== want){ s = s.replace(CANON_RE, tag); acts.push('canonical'); }
  } else {
    s = s.replace(/<\/head>/i, '  ' + tag + eol + '</head>');
    acts.push('canonical добавлен');
  }

  if(!/\/sim\/guard\.js/.test(s)){
    if(FONTS_RE.test(s)){
      s = s.replace(FONTS_RE, m => m + eol + GUARD);
      acts.push('guard.js после fonts.css');
    } else {
      s = s.replace(/<\/head>/i, '  ' + GUARD + eol + '</head>');
      acts.push('guard.js в head');
    }
  }

  touched++;
  if(s !== orig){
    changed++;
    if(!dry) writeFileSync(p, s, 'utf8');
    console.log((dry ? '[dry] ' : '[fix] ') + f + ' → ' + acts.join(', '));
  } else {
    console.log('[ok ] ' + f);
  }
}
console.log('');
console.log((dry ? 'Будет изменено' : 'Изменено') + ' файлов: ' + changed + ' из ' + touched);
if(dry && changed) console.log('Применить: node tools/fix-sims.mjs');