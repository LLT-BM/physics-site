/* LibLabTab · убирает хэштеги и переводит каталог на темы (разделы).
   node tools/drop-hashtags.mjs --dry | node tools/drop-hashtags.mjs */
import process from 'node:process';
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, rmSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const dry = process.argv.includes('--dry');
const log = [];
const rd = p => existsSync(p) ? readFileSync(p, 'utf8') : '';
function walk(dir, exts){
  if(!existsSync(dir)) return [];
  const out = [];
  for(const n of readdirSync(dir)){
    const p = join(dir, n); const st = statSync(p);
    if(st.isDirectory()) out.push(...walk(p, exts));
    else if(exts.some(e => n.toLowerCase().endsWith(e))) out.push(p);
  }
  return out;
}

const REDIRECTS = {
  'механика':'механика','электродинамика':'электричество','оптика':'оптика',
  'квантовая-физика':'квантовая-физика','молекулярная-физика':'молекулярная-физика',
  'гидродинамика':'гидродинамика','астрономия':'астрономия',
  'хаос':'нелинейная-динамика','колебания':'механика','статика':'механика',
  'клеточные-автоматы':'нелинейная-динамика','ван-дер-ваальс':'молекулярная-физика',
  'масштабы':'астрономия','масштабы-вселенной':'астрономия',
  'постоянный-ток':'электричество','переменный-ток':'электричество',
  'геометрическая-оптика':'оптика','самоорганизация':'нелинейная-динамика'
};

for(const p of walk('src', ['.astro'])){
  const orig = rd(p);
  let s = orig; const acts = [];

  const before = s;
  s = s.replace(/[ \t]*<div class="(?:tagline|mtags|tags)">[\s\S]*?<\/div>\r?\n?/g, '');
  s = s.replace(/[ \t]*<span class="tag">[\s\S]*?<\/span>\r?\n?/g, '');
  s = s.replace(/[ \t]*\{[^{}]*\.tags\.map\([\s\S]*?\)\}\r?\n?/g, '');
  s = s.replace(/#\{t\}/g, '{t}');
  if(s !== before) acts.push('блоки хэштегов');

  const b2 = s;
  s = s.replace(/[ \t]*<a[^>]*href=\{`\/tags\/[^`]*`\}[^>]*>[\s\S]*?<\/a>\r?\n?/g, '');
  s = s.replace(/[ \t]*<a[^>]*href="\/tags\/[^"]*"[^>]*>[\s\S]*?<\/a>\r?\n?/g, '');
  s = s.replace(/\sdata-tags=\{[^}]*\}/g, '');
  if(s !== b2) acts.push('ссылки /tags/');

  const b3 = s;
  s = s.replace(/[ \t]*\.(?:tag|tagline|mtags)\{[^}]*\}\r?\n?/g, '');
  s = s.replace(/[ \t]*\.tag:hover\{[^}]*\}\r?\n?/g, '');
  if(s !== b3) acts.push('стили тегов');

  const b4 = s;
  s = s.replace(/[ \t]*<div class="frow">\s*<span class="flab">Свойство<\/span>[\s\S]*?<\/div>\r?\n?/g, '');
  s = s.replace(/[ \t]*<div class="frow">\s*<span class="flab">Уровень<\/span>[\s\S]*?<\/div>\r?\n?/g, '');
  if(s !== b4) acts.push('фильтры свойств и уровня');

  const b5 = s;
  s = s.replace(/const tags = await tagIndex\(\);\r?\n/g, '');
  s = s.replace(/,\s*tagIndex/g, '').replace(/tagIndex\s*,\s*/g, '');
  if(s !== b5) acts.push('tagIndex');

  if(s !== orig){
    if(!dry) writeFileSync(p, s, 'utf8');
    log.push((dry ? '[dry] ' : '[fix] ') + p + ' → ' + acts.join(', '));
  } else log.push('[ok ] ' + p);
}

/* страницы тегов больше не нужны */
if(existsSync('src/pages/tags')){
  if(!dry) rmSync('src/pages/tags', { recursive: true, force: true });
  log.push((dry ? '[dry] ' : '[del] ') + 'src/pages/tags/');
} else log.push('[ok ] src/pages/tags/ отсутствует');

/* редиректы со старых адресов */
{
  const p = 'public/.htaccess';
  let s = rd(p);
  const add = [];
  for(const [old, sec] of Object.entries(REDIRECTS)){
    const line = `Redirect 301 /tags/${old}/ /sections/${sec}/`;
    if(!s.includes(line)) add.push(line);
  }
  for(const old of ['школьный-курс','3d','численные-методы']){
    const line = `Redirect 301 /tags/${old}/ /`;
    if(!s.includes(line)) add.push(line);
  }
  if(add.length){
    const block = '\n# Каталог только по темам: старые теги уводим на разделы\n' + add.join('\n') + '\n';
    if(!dry) appendFileSync(p, block, 'utf8');
    log.push((dry ? '[dry] ' : '[fix] ') + p + ' → редиректов: ' + add.length);
  } else log.push('[ok ] public/.htaccess');
}

console.log(log.join('\n'));
console.log('\nДалее: положите src/pages/index.astro и src/pages/sections/[section].astro');