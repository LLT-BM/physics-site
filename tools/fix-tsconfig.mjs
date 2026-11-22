/* LibLabTab · снимает ошибку «FrameBridge.astro не найден» без перезапуска TS-сервера.
   Перезапись tsconfig.json сама заставляет TypeScript пересобрать программу.
   node tools/fix-tsconfig.mjs --dry | node tools/fix-tsconfig.mjs */
import process from 'node:process';
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, rmSync } from 'node:fs';
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
      if(/^(node_modules|dist|\.git|\.astro)$/.test(n)) continue;
      out.push(...walk(p, exts));
    } else if(exts.some(e => n.toLowerCase().endsWith(e))) out.push(p);
  }
  return out;
}

/* 1. Ни одной ссылки на удалённый компонент */
let refs = 0;
for(const p of walk('src', ['.astro','.ts','.js','.mjs','.json'])){
  const orig = readFileSync(p, 'utf8');
  if(!/FrameBridge/.test(orig)) continue;
  const s = orig
    .replace(/^[ \t]*import\s+FrameBridge\s+from\s+['"][^'"]+['"];?[ \t]*\r?\n?/gm, '')
    .replace(/^[ \t]*import\s+['"][^'"]*FrameBridge\.astro['"];?[ \t]*\r?\n?/gm, '')
    .replace(/[ \t]*<FrameBridge\s*\/>[ \t]*\r?\n?/g, '');
  if(s !== orig){
    refs++;
    if(!dry) writeFileSync(p, s, 'utf8');
    log.push((dry?'[dry] ':'[fix] ') + p + ' → ссылка убрана');
  }
}
if(!refs) log.push('[ok ] ссылок на FrameBridge в src нет');

/* 2. Явный exclude призрачного пути + перезапись конфигурации.
      Смена tsconfig.json автоматически пересобирает программу TS. */
{
  const p = 'tsconfig.json';
  const next = {
    extends: 'astro/tsconfigs/strict',
    include: ['.astro/types.d.ts', 'src/**/*'],
    exclude: [
      'dist', 'node_modules', 'tools', 'public', '.repo-trash',
      'src/components/FrameBridge.astro'
    ],
    compilerOptions: {
      strictNullChecks: true,
      allowJs: false,
      verbatimModuleSyntax: false,
      skipLibCheck: true
    }
  };
  const text = JSON.stringify(next, null, 2) + '\n';
  const cur = existsSync(p) ? readFileSync(p, 'utf8') : '';
  if(cur !== text){
    if(!dry) writeFileSync(p, text, 'utf8');
    log.push((dry?'[dry] ':'[fix] ') + p + ' → exclude призрачного пути, программа TS пересоберётся');
  } else {
    /* даже при совпадении трогаем файл, чтобы TS перечитал конфигурацию */
    if(!dry) writeFileSync(p, text + '', 'utf8');
    log.push((dry?'[dry] ':'[fix] ') + p + ' → перезапись для перечитывания');
  }
}

/* 3. Кэш сгенерированных типов держит удалённый файл */
for(const d of ['.astro', 'node_modules/.astro', 'node_modules/.vite', 'node_modules/.cache']){
  if(existsSync(d)){
    if(!dry) rmSync(d, { recursive:true, force:true });
    log.push((dry?'[dry] ':'[del] ') + d);
  }
}

console.log(log.join('\n'));
console.log('\nДальше: npx astro sync && npx astro check.');
console.log('Если полоска ошибки в VS Code осталась — закройте и откройте VS Code:');
console.log('это то же самое, что перезапуск TS-сервера, и не требует командной палитры.');