/* LibLabTab · убирает висячие ссылки на удалённый FrameBridge,
   сбрасывает кэш типов Astro и открывает мосту пересборку контролов.
   node tools/fix-refs.mjs --dry | node tools/fix-refs.mjs */
import process from 'node:process';
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, rmSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const dry = process.argv.includes('--dry');
const log = [];

function walk(dir, exts){
  if(!existsSync(dir)) return [];
  const out = [];
  for(const n of readdirSync(dir)){
    const p = join(dir, n);
    let st; try { st = statSync(p); } catch { continue; }
    if(st.isDirectory()){
      if(/^(node_modules|dist|\.git)$/.test(n)) continue;
      out.push(...walk(p, exts));
    } else if(exts.some(e => n.toLowerCase().endsWith(e))) out.push(p);
  }
  return out;
}

/* 1. Любые упоминания FrameBridge в исходниках */
for(const p of walk('src', ['.astro','.ts','.js','.mjs'])){
  const orig = readFileSync(p, 'utf8');
  if(!/FrameBridge/.test(orig)) continue;
  let s = orig
    .replace(/^[ \t]*import\s+FrameBridge\s+from\s+['"][^'"]+['"];?[ \t]*\r?\n?/gm, '')
    .replace(/^[ \t]*import\s+['"][^'"]*FrameBridge\.astro['"];?[ \t]*\r?\n?/gm, '')
    .replace(/[ \t]*<FrameBridge\s*\/>[ \t]*\r?\n?/g, '')
    .replace(/[ \t]*\{?\s*FrameBridge\s*\}?[ \t]*\r?\n?/g, '');
  if(s !== orig){
    if(!dry) writeFileSync(p, s, 'utf8');
    log.push((dry?'[dry] ':'[fix] ') + p + ' → ссылки на FrameBridge убраны');
  }
}
const fb = 'src/components/FrameBridge.astro';
if(existsSync(fb)){
  if(!dry) unlinkSync(fb);
  log.push((dry?'[dry] ':'[del] ') + fb);
} else log.push('[ok ] FrameBridge.astro отсутствует');

/* 2. Кэш сгенерированных типов держит удалённый файл в программе TS */
for(const d of ['.astro', 'node_modules/.astro', 'node_modules/.vite']){
  if(existsSync(d)){
    if(!dry) rmSync(d, { recursive:true, force:true });
    log.push((dry?'[dry] ':'[del] ') + d + ' (кэш типов и сборки)');
  }
}

/* 3. Мост должен уметь пересобрать список контролов по запросу модели */
{
  const p = 'public/sim/lib/bridge.js';
  let s = existsSync(p) ? readFileSync(p, 'utf8') : '';
  if(!s) log.push('[?] ' + p + ' отсутствует');
  else if(/window\.__lltRescan/.test(s)) log.push('[ok ] ' + p);
  else {
    const anchor = 'function boot(){';
    if(s.includes(anchor)){
      const hook = 'window.__lltRescan = function(){ if(MARKED) hello(); };\n\n';
      s = s.replace(anchor, hook + anchor);
      if(!dry) writeFileSync(p, s, 'utf8');
      log.push((dry?'[dry] ':'[fix] ') + p + ' → добавлен window.__lltRescan');
    } else log.push('[!] ' + p + ': не найден boot()');
  }
}

console.log(log.join('\n'));
console.log('\nДальше: npx astro sync, затем в VS Code «TypeScript: Restart TS Server».');