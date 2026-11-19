/* LibLabTab · находит и чинит повреждённый CSS тем же парсером, что и сборка.
   node tools/fix-css-syntax.mjs --dry | node tools/fix-css-syntax.mjs
   Объявления не трогает: правит только структуру (огрызки селекторов,
   at-правила без блока, пустые правила, висячие комбинаторы). */
import process from 'node:process';
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { transform } from 'lightningcss';

const dry = process.argv.includes('--dry');
let fixed = 0, scanned = 0; const broken = [];

function walk(dir, exts){
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)){
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, exts));
    else if (exts.some(e => name.toLowerCase().endsWith(e))) out.push(p);
  }
  return out;
}

function check(css, label){
  try { transform({ filename: label, code: Buffer.from(css), minify: true }); return null; }
  catch (e){ return (e && e.message ? e.message : String(e)).split('\n')[0]; }
}

const bare = s => s.replace(/\/\*[\s\S]*?\*\//g, '').trim();

function skipSpecial(css, i){
  const ch = css[i];
  if (ch === '/' && css[i+1] === '*'){ const e = css.indexOf('*/', i+2); return e < 0 ? css.length : e+2; }
  if (ch === '"' || ch === "'"){
    let j = i+1;
    while (j < css.length){ if (css[j] === '\\'){ j += 2; continue; } if (css[j] === ch){ j++; break; } j++; }
    return j;
  }
  return i+1;
}

/* Убирает огрызки: строки-селекторы без своего блока и пустые правила */
function sanitize(css){
  let out = '', buf = '', i = 0;
  while (i < css.length){
    const ch = css[i];
    if ((ch === '/' && css[i+1] === '*') || ch === '"' || ch === "'"){
      const j = skipSpecial(css, i); buf += css.slice(i, j); i = j; continue;
    }
    if (ch === '{'){
      let depth = 1, j = i+1;
      while (j < css.length && depth > 0){
        const c = css[j];
        if ((c === '/' && c !== undefined && css[j+1] === '*') || c === '"' || c === "'"){ j = skipSpecial(css, j); continue; }
        if (c === '{') depth++; else if (c === '}') depth--;
        j++;
      }
      const inner = css.slice(i+1, j-1);
      let prelude = buf;

      /* Огрызок: предыдущая строка селектора без запятой/комбинатора на конце */
      const lines = prelude.split('\n');
      while (lines.length > 1){
        const prev = lines[lines.length-2].replace(/\/\*[\s\S]*?\*\//g,'').trim();
        const last = lines[lines.length-1].replace(/\/\*[\s\S]*?\*\//g,'').trim();
        if (!prev || !last) break;
        if (/[,>+~]$/.test(prev)) break;
        if (/^@/.test(prev) && !/{/.test(prev)) { lines.splice(lines.length-2,1); continue; }
        if (!/^@/.test(prev) && /[a-z*\[:.#]/i.test(prev)) { lines.splice(lines.length-2,1); continue; }
        break;
      }
      prelude = lines.join('\n');

      const sel = bare(prelude);
      const dangling = /[>+~]\s*$/.test(sel) || /^[>+~]/.test(sel);
      const innerClean = sel.startsWith('@') ? sanitize(inner) : inner;

      if (!sel || dangling || !bare(innerClean)){
        out += (prelude.match(/^\s*/) || [''])[0];
      } else {
        out += prelude + '{' + innerClean + '}';
      }
      buf = ''; i = j; continue;
    }
    buf += ch; i++;
  }
  /* Хвост без блока — огрызок, выбрасываем, сохраняя переводы строк */
  out += (buf.match(/^\s*/) || [''])[0] + buf.replace(/^\s*/,'').replace(/^[^{}]*$/,'');
  return out.replace(/\n{3,}/g, '\n\n');
}

const targets = [
  ...walk('src/styles', ['.css']),
  ...walk('public/sim/lib', ['.css']),
  ...walk('public/sim', ['.html'])
];

for (const p of targets){
  const orig = readFileSync(p, 'utf8');
  const isHtml = p.toLowerCase().endsWith('.html');
  const chunks = [];
  if (isHtml){
    const re = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi;
    let m; while ((m = re.exec(orig))) chunks.push({ a:m[1], body:m[2], z:m[3], at:m.index });
  } else chunks.push({ a:'', body:orig, z:'', at:0 });

  let next = orig, changed = false, report = [];
  for (let k = chunks.length - 1; k >= 0; k--){
    const c = chunks[k];
    const err = check(c.body, p);
    if (!err) continue;
    const healed = sanitize(c.body);
    const err2 = check(healed, p);
    if (!err2){
      next = next.slice(0, c.at) + c.a + healed + c.z + next.slice(c.at + c.a.length + c.body.length + c.z.length);
      changed = true; report.push('починено');
    } else {
      const line = orig.slice(0, c.at).split('\n').length;
      broken.push(p + ':' + line + ' → ' + err2);
    }
  }

  scanned++;
  if (changed){
    fixed++;
    if (!dry) writeFileSync(p, next, 'utf8');
    console.log((dry ? '[dry] ' : '[fix] ') + p.padEnd(36) + ' → ' + report.join(', '));
  } else {
    console.log('[ok ] ' + p);
  }
}

console.log('\nПросмотрено: ' + scanned + ' · ' + (dry ? 'будет починено' : 'починено') + ': ' + fixed);
if (broken.length){
  console.log('\nОСТАЛОСЬ НЕВАЛИДНЫМ (' + broken.length + '):');
  broken.forEach(x => console.log('  ' + x));
  process.exitCode = 1;
} else {
  console.log('Весь CSS проходит парсер сборки.');
}