/* LibLabTab · убирает нумерацию моделей из каталога, страниц, обложек и подвалов.
   node tools/remove-numbering.mjs --dry | node tools/remove-numbering.mjs */
import process from 'node:process';
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dry=process.argv.includes('--dry');
const report=[];

function walk(dir,exts){
  if(!existsSync(dir)) return [];
  const out=[];
  for(const name of readdirSync(dir)){
    const p=join(dir,name); const st=statSync(p);
    if(st.isDirectory()) out.push(...walk(p,exts));
    else if(exts.some(e=>name.toLowerCase().endsWith(e))) out.push(p);
  }
  return out;
}
function edit(path,rules){
  if(!existsSync(path)){ report.push('[?] '+path+' — нет файла'); return; }
  const orig=readFileSync(path,'utf8');
  let s=orig; const done=[],miss=[];
  for(const [name,re,to] of rules){
    if(re.test(s)){ s=s.replace(re,to); done.push(name); } else miss.push(name);
  }
  if(s!==orig){ if(!dry) writeFileSync(path,s,'utf8');
    report.push((dry?'[dry] ':'[fix] ')+path+' → '+done.join(', ')+(miss.length?'  (нет: '+miss.join(', ')+')':'')); }
  else report.push('[ok ] '+path+(miss.length?'  (нет: '+miss.join(', ')+')':''));
}

/* Каталог */
edit('src/pages/index.astro',[
  ['импорт numbered', /import\s*\{\s*numbered\s*,\s*sections\s*,\s*tagIndex\s*\}\s*from\s*'\.\.\/lib\/models';/,
   "import { published, sections, tagIndex } from '../lib/models';"],
  ['источник списка', /const items = await numbered\(\);/, 'const items = await published();'],
  ['разметка карточки', /\{items\.map\(\(\{ m, num \}\) => \{/, '{items.map((m) => {'],
  ['бейдж номера', /\s*<span class="num">\{num\}<\/span>\r?\n?/, '\n'],
  ['стиль бейджа', /\s*\.num\{[^}]*\}\r?\n?/, '\n']
]);

/* Страница модели */
edit('src/pages/models/[slug].astro',[
  ['импорт numbered', /import\s*\{\s*published\s*,\s*neighbours\s*,\s*numbered\s*\}\s*from\s*'\.\.\/\.\.\/lib\/models';/,
   "import { published, neighbours } from '../../lib/models';"],
  ['вычисление номера', /\s*const nums = await numbered\(\);\r?\n/, '\n'],
  ['константа num', /\s*const num = nums\.find\(x => x\.m\.id === m\.id\)\?\.num \?\? '';\r?\n/, '\n'],
  ['бейдж номера', /\s*<span class="mnum">\{num\}<\/span>\r?\n?/, '\n'],
  ['стиль бейджа', /\s*\.mnum\{[^}]*\}\r?\n?/, '\n']
]);

/* Обложки и подвалы симуляций */
let covers=0,sims=0;
for(const p of walk('public/covers',['.svg'])){
  const orig=readFileSync(p,'utf8');
  const s=orig.replace(/LIBLABTAB\s*·\s*\d+/g,'LIBLABTAB');
  if(s!==orig){ covers++; if(!dry) writeFileSync(p,s,'utf8'); }
}
for(const p of walk('public/sim',['.html'])){
  const orig=readFileSync(p,'utf8');
  const s=orig.replace(/LibLabTab\s*·\s*модель\s*№?\s*\d+/gi,'LibLabTab')
              .replace(/LIBLABTAB\s*·\s*\d+/g,'LIBLABTAB');
  if(s!==orig){ sims++; if(!dry) writeFileSync(p,s,'utf8'); }
}
report.push((dry?'[dry] ':'[fix] ')+'обложек без номера: '+covers);
report.push((dry?'[dry] ':'[fix] ')+'подвалов симуляций без номера: '+sims);

console.log(report.join('\n'));
console.log('\nПорядок сортировки сохранён: поле order в frontmatter отвечает за очерёдность, а не за номер на экране.');