/* LibLabTab · удаляет всё, что осталось от Supabase.
   node tools/remove-supabase.mjs --dry | node tools/remove-supabase.mjs */
import process from 'node:process';
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dry = process.argv.includes('--dry');
const say = (tag, m) => console.log('[' + tag + '] ' + m);

/* 1. Файлы */
for (const f of ['tools/comments.sql']) {
  if (existsSync(f)) { if (!dry) unlinkSync(f); say(dry ? 'dry' : 'del', f); }
}

/* 2. Переменные окружения */
for (const f of ['.env', '.env.example', '.env.local', '.env.production']) {
  if (!existsSync(f)) continue;
  const src = readFileSync(f, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const next = src.split(/\r?\n/).filter(l => !/^\s*PUBLIC_(SUPABASE|COMMENTS)/i.test(l)).join(eol);
  if (next === src) { say('ok ', f); continue; }
  if (!dry) { next.trim() ? writeFileSync(f, next, 'utf8') : unlinkSync(f); }
  say(dry ? 'dry' : 'fix', f + ' → убраны PUBLIC_SUPABASE_* и PUBLIC_COMMENTS');
}

/* 3. База комментариев не должна попадать в git */
const GI = '.gitignore', rule = 'public/api/data/';
const gi = existsSync(GI) ? readFileSync(GI, 'utf8') : '';
if (!gi.split(/\r?\n/).includes(rule)) {
  if (!dry) writeFileSync(GI, gi.replace(/\s*$/, '\n') + rule + '\n', 'utf8');
  say(dry ? 'dry' : 'fix', '.gitignore → ' + rule);
} else say('ok ', '.gitignore');

/* 4. Остаточные упоминания */
function walk(d, out = []) {
  if (!existsSync(d)) return out;
  for (const n of readdirSync(d)) {
    if (['node_modules', 'dist', '.git', '.astro'].includes(n)) continue;
    const p = join(d, n), s = statSync(p);
    s.isDirectory() ? walk(p, out) : /\.(astro|ts|js|mjs|md|json|html|bat|sql|env)$/i.test(n) && out.push(p);
  }
  return out;
}
let left = 0;
for (const f of [...walk('src'), ...walk('public'), ...walk('tools'), 'package.json', 'deploy.bat']) {
  if (!existsSync(f) || f.endsWith('remove-supabase.mjs')) continue;
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((l, i) => { if (/supabase/i.test(l)) { left++; say('???', f + ':' + (i + 1) + ' ' + l.trim().slice(0, 90)); } });
}
console.log(left ? '\nОстались упоминания: ' + left + ' (проверьте вручную)' : '\nУпоминаний Supabase не осталось.');