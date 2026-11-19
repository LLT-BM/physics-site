/* LibLabTab · миграция таксономии: раздел + уровень + класс + свойства.
   node tools/migrate-taxonomy.mjs --dry | node tools/migrate-taxonomy.mjs
   Идемпотентен. Тело Markdown не меняется, правится только frontmatter. */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/content/models';
const dry = process.argv.includes('--dry');
if(!existsSync(DIR)){ console.log('Нет папки '+DIR); process.exit(1); }

/* Раздел, уровень, класс, свойства — по слагу файла */
const PLAN = {
  'atom-model':          { section:'квантовая-физика',    level:'продвинутый', grade:'10-11', tags:['3d','численные-методы'] },
  'atomic-interactions': { section:'молекулярная-физика', level:'продвинутый', grade:'вуз',   tags:['ван-дер-ваальс','численные-методы'] },
  'bernoulli':           { section:'гидродинамика',       level:'продвинутый', grade:'10-11', tags:['школьный-курс','численные-методы'] },
  'circuit-lab':         { section:'электричество',       level:'продвинутый', grade:'10-11', tags:['постоянный-ток','переменный-ток','численные-методы'] },
  'double-pendulum':     { section:'нелинейная-динамика', level:'продвинутый', grade:'10-11', tags:['хаос','колебания','численные-методы'] },
  'lens-image':          { section:'оптика',              level:'базовый',     grade:'7-9',   tags:['школьный-курс','геометрическая-оптика'] },
  'lenz-law':            { section:'электричество',       level:'базовый',     grade:'10-11', tags:['школьный-курс'] },
  'lever-moments':       { section:'механика',            level:'базовый',     grade:'7-9',   tags:['школьный-курс','статика'] },
  'life-game':           { section:'нелинейная-динамика', level:'продвинутый', grade:'10-11', tags:['клеточные-автоматы','хаос'] },
  'math-pendulum':       { section:'механика',            level:'продвинутый', grade:'10-11', tags:['колебания','школьный-курс','численные-методы'] },
  'penrose-billiard':    { section:'оптика',              level:'продвинутый', grade:'вуз',   tags:['хаос','геометрическая-оптика','численные-методы'] },
  'scale-of-universe':   { section:'астрономия',          level:'базовый',     grade:'7-9',   tags:['масштабы','школьный-курс'] },
  'spring-pendulum':     { section:'механика',            level:'продвинутый', grade:'10-11', tags:['колебания','школьный-курс','численные-методы'] }
};

const MANAGED = ['tags','section','level','grade','order','coreVersion','draft'];

function split(src){
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if(!m) return null;
  return { fm: m[1], body: src.slice(m[0].length), eol: src.includes('\r\n') ? '\r\n' : '\n' };
}
function field(fm, key){
  const m = fm.match(new RegExp('^'+key+':\\s*(.+)$','m'));
  return m ? m[1].trim() : null;
}

/*Chronologический порядок: 1 — самая ранняя */
const files = readdirSync(DIR).filter(f => f.endsWith('.md'));
const dated = files.map(f => {
  const p = split(readFileSync(join(DIR,f),'utf8'));
  const raw = p ? field(p.fm,'date') : null;
  const t = raw ? Date.parse(raw.replace(/^["']|["']$/g,'')) : 0;
  return { f, t: isFinite(t) ? t : 0 };
}).sort((a,b) => a.t - b.t || a.f.localeCompare(b.f));
const orderOf = new Map(dated.map((d,i) => [d.f, i+1]));

let changed = 0, skipped = [];
for(const f of files){
  const slug = f.replace(/\.md$/,'');
  const plan = PLAN[slug];
  const p = join(DIR,f);
  const orig = readFileSync(p,'utf8');
  const parts = split(orig);
  if(!parts){ skipped.push(f+': frontmatter не найден'); continue; }
  if(!plan){ skipped.push(f+': нет в PLAN, оставлен без изменений'); continue; }

  const kept = parts.fm.split(/\r?\n/).filter(line => {
    const k = (line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:/) || [])[1];
    return !k || !MANAGED.includes(k);
  });
  const q = s => '"' + String(s).replace(/"/g,'\\"') + '"';
  const add = [
    'section: ' + q(plan.section),
    'level: ' + q(plan.level),
    'grade: ' + q(plan.grade),
    'tags: [' + plan.tags.map(q).join(', ') + ']',
    'order: ' + orderOf.get(f),
    'coreVersion: "1"',
    'draft: false'
  ];
  const fm = kept.concat(add).join(parts.eol);
  const out = '---' + parts.eol + fm + parts.eol + '---' + parts.eol + parts.body;

  if(out !== orig){
    changed++;
    if(!dry) writeFileSync(p, out, 'utf8');
    console.log((dry?'[dry] ':'[fix] ') + f.padEnd(26) +
      ' → ' + plan.section + ' · ' + plan.level + ' · ' + plan.grade +
      ' · order ' + orderOf.get(f) + ' · [' + plan.tags.join(', ') + ']');
  } else console.log('[ok ] ' + f);
}
console.log('\n' + (dry?'Будет изменено':'Изменено') + ' файлов: ' + changed + ' из ' + files.length);
if(skipped.length){ console.log('\nПропущено:'); skipped.forEach(s => console.log('  '+s)); }