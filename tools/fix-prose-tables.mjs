/* LibLabTab · таблицы Markdown и контрольных точек больше не распирают страницу.
   Подключает rehype-обёртку, стиль таблиц и компонент прокрутки.
   node tools/fix-prose-tables.mjs --dry | node tools/fix-prose-tables.mjs */
import process from 'node:process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const dry = process.argv.includes('--dry');
const log = [];
const rd = p => existsSync(p) ? readFileSync(p, 'utf8') : '';
const wr = (p, s) => { if(!dry) writeFileSync(p, s, 'utf8'); };
const tag = ok => (dry ? '[dry] ' : '[fix] ') + ok;

/* 1. astro.config.mjs: регистрируем rehype-плагин */
{
  const p = 'astro.config.mjs';
  let s = rd(p);
  if(!s){ log.push('[?] ' + p + ' отсутствует'); }
  else {
    const acts = [];
    if(!/rehype-wrap-tables/.test(s)){
      const lines = s.split(/\r?\n/);
      let last = -1;
      for(let i = 0; i < lines.length; i++) if(/^\s*import\s/.test(lines[i])) last = i;
      const imp = "import rehypeWrapTables from './src/lib/rehype-wrap-tables.mjs';";
      if(last >= 0) lines.splice(last + 1, 0, imp); else lines.unshift(imp);
      s = lines.join('\n');
      acts.push('импорт плагина');
    }
    if(!/rehypePlugins\s*:\s*\[[^\]]*rehypeWrapTables/.test(s)){
      if(/rehypePlugins\s*:\s*\[/.test(s)){
        s = s.replace(/rehypePlugins\s*:\s*\[/, 'rehypePlugins: [rehypeWrapTables, ');
        acts.push('плагин в существующий rehypePlugins');
      } else if(/markdown\s*:\s*\{/.test(s)){
        s = s.replace(/markdown\s*:\s*\{/, 'markdown: {\n    rehypePlugins: [rehypeWrapTables],');
        acts.push('rehypePlugins в существующий markdown');
      } else if(/export default defineConfig\(\{/.test(s)){
        s = s.replace(/export default defineConfig\(\{/,
          'export default defineConfig({\n  markdown: { rehypePlugins: [rehypeWrapTables] },');
        acts.push('блок markdown');
      } else {
        log.push('[!] ' + p + ': не найден defineConfig — правка вручную');
      }
    }
    if(acts.length){ wr(p, s); log.push(tag(p + ' → ' + acts.join(', '))); }
    else log.push('[ok ] ' + p);
  }
}

/* 2. Base.astro: стиль таблиц последним и компонент прокрутки */
{
  const p = 'src/layouts/Base.astro';
  let s = rd(p);
  if(!s){ log.push('[?] ' + p + ' отсутствует'); }
  else {
    const acts = [];
    if(!/styles\/tables\.css/.test(s)){
      const imp = "import '../styles/tables.css';";
      if(/import\s+'\.\.\/styles\/mobile\.css';/.test(s)){
        s = s.replace(/import\s+'\.\.\/styles\/mobile\.css';/, m => m + '\n' + imp);
      } else if(/import\s+'\.\.\/styles\/global\.css';/.test(s)){
        s = s.replace(/import\s+'\.\.\/styles\/global\.css';/, m => m + '\n' + imp);
      } else {
        s = s.replace(/^(import[^\n]*\n)(?![\s\S]*^import)/m, m => m + imp + '\n');
      }
      acts.push('tables.css');
    }
    if(!/TableScroll/.test(s)){
      s = s.replace(/(import\s+'\.\.\/styles\/tables\.css';)/,
        "$1\nimport TableScroll from '../components/TableScroll.astro';");
      if(/<\/body>/.test(s)) s = s.replace(/<\/body>/, '  <TableScroll />\n</body>');
      else s = s.trimEnd() + '\n<TableScroll />\n';
      acts.push('TableScroll');
    }
    if(acts.length){ wr(p, s); log.push(tag(p + ' → ' + acts.join(', '))); }
    else log.push('[ok ] ' + p);
  }
}

/* 3. mobile.css: min-width только для таблиц внутри прокрутки */
{
  const p = 'src/styles/mobile.css';
  let s = rd(p);
  if(!s){ log.push('[?] ' + p + ' отсутствует'); }
  else {
    const before = s;
    s = s.replace(/(^|[\s;{}])table\s*\{\s*min-width\s*:\s*520px\s*\}/g,
      (m, pre) => pre + '.llt-tablewrap>table,.tw>table{min-width:520px}');
    s = s.replace(/(^|[\s;{}])table\s*\{\s*max-width\s*:\s*100%\s*\}/g,
      (m, pre) => pre + '.llt-tablewrap>table,.tw>table{max-width:none}');
    if(s !== before){ wr(p, s); log.push(tag(p + ' → min-width только внутри прокрутки')); }
    else log.push('[ok ] ' + p);
  }
}

/* 4. [slug].astro: убираем прежний display:block и метим существующие обёртки */
{
  const p = 'src/pages/models/[slug].astro';
  let s = rd(p);
  if(!s){ log.push('[?] ' + p + ' отсутствует'); }
  else {
    const acts = [];
    const before = s;
    s = s.replace(/[ \t]*\/\* llt-prose-tables \*\/\r?\n?/g, '');
    s = s.replace(/[ \t]*\.prose :global\(table\)\{[\s\S]*?\}\r?\n?/g, '');
    s = s.replace(/[ \t]*\.prose\{overflow-x:clip;min-width:0\}\r?\n?/g, '');
    if(s !== before) acts.push('убраны прежние правила prose-таблиц');

    const b2 = s;
    s = s.replace(/<div class="tw">/g, '<div class="tw llt-tablewrap">');
    if(s !== b2) acts.push('обёртки контрольных точек помечены');

    if(acts.length){ wr(p, s); log.push(tag(p + ' → ' + acts.join(', '))); }
    else log.push('[ok ] ' + p);
  }
}

console.log(log.join('\n'));