/* LibLabTab · снимает rehype-плагин из конфигурации: обёртка таблиц
   перенесена в браузер, сборочная зависимость не нужна.
   node tools/drop-rehype.mjs --dry | node tools/drop-rehype.mjs */
import process from 'node:process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';

const dry = process.argv.includes('--dry');
const p = 'astro.config.mjs';
if(!existsSync(p)){ console.log('Нет файла ' + p); process.exit(1); }

const orig = readFileSync(p, 'utf8');
let s = orig;
const acts = [];

const beforeImport = s;
s = s.replace(/^[ \t]*import\s+rehypeWrapTables\s+from\s+['"][^'"]+['"];?[ \t]*\r?\n?/gm, '');
if(s !== beforeImport) acts.push('убран импорт плагина');

const beforeList = s;
s = s.replace(/(rehypePlugins\s*:\s*\[)([^\]]*)(\])/g, (m, a, body, c) => {
  const items = body.split(',').map(x => x.trim()).filter(x => x && x !== 'rehypeWrapTables');
  return a + (items.length ? ' ' + items.join(', ') + ' ' : '') + c;
});
if(s !== beforeList) acts.push('плагин вынут из rehypePlugins');

const beforeEmpty = s;
s = s.replace(/rehypePlugins\s*:\s*\[\s*\]\s*,?/g, '');
s = s.replace(/markdown\s*:\s*\{\s*,?\s*\}\s*,?/g, '');
s = s.replace(/\{\s*,/g, '{');
s = s.replace(/,\s*,/g, ',');
s = s.replace(/,(\s*\})/g, '$1');
s = s.replace(/\n{3,}/g, '\n\n');
if(s !== beforeEmpty) acts.push('убраны пустые ключи markdown');

if(s !== orig){
  if(!dry) writeFileSync(p, s, 'utf8');
  console.log((dry ? '[dry] ' : '[fix] ') + p + ' → ' + acts.join(', '));
  console.log('\nТекущая конфигурация:\n' + s);
} else {
  console.log('[ok ] ' + p + ' — правки не требуются');
}

const plugin = 'src/lib/rehype-wrap-tables.mjs';
if(existsSync(plugin)){
  if(!dry) unlinkSync(plugin);
  console.log((dry ? '[dry] ' : '[del] ') + plugin);
} else console.log('[ok ] ' + plugin + ' отсутствует');