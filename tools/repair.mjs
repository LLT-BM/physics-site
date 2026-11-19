/* LibLabTab · чинит рантайм-поломки симуляций по итогам смоук-теста.
   node tools/repair.mjs --dry | node tools/repair.mjs — идемпотентно.
   1. PAL инициализируется до первого использования (крах трёх моделей).
   2. Таблицы оборачиваются в .tw, чтобы не распирать страницу.
   3. Кнопка сброса получает единое написание «Сброс».
   4. Главная сцена помечается data-llt-stage для смоук-теста. */
import process from 'node:process';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'public/sim';
const dry = process.argv.includes('--dry');
if(!existsSync(DIR)){ console.log('Запускайте из корня проекта'); process.exit(1); }

const BOOT = [
  '/* LibLabTab · палитра до первого использования */',
  'var PAL = (window.LLTtheme && window.LLTtheme.pal) || window.PAL || {};',
  'window.PAL = PAL;'
].join('\n');

let changed = 0, total = 0;

for(const f of readdirSync(DIR).filter(x => x.toLowerCase().endsWith('.html'))){
  const p = join(DIR, f);
  const orig = readFileSync(p, 'utf8'); total++;
  const eol = orig.includes('\r\n') ? '\r\n' : '\n';
  let s = orig; const acts = [];

  /* 1. Палитра: убираем поздние объявления var PAL={} и ставим бутстрап первым */
  if(/\bPAL\s*\./.test(s)){
    const before = s;
    s = s.replace(/var\s+PAL\s*=\s*\{\s*\}\s*;?/g, '');
    if(!/палитра до первого использования/.test(s)){
      let done = false;
      s = s.replace(/(\(function\s*\(\s*\)\s*\{)(\s*(?:'use strict';|"use strict";)?)/,
        (m, a, b) => { done = true; return a + b + eol + BOOT + eol; });
      if(!done){
        /* скрипт без IIFE — вставляем перед первым объявлением в основном скрипте */
        const i = s.lastIndexOf('<script>');
        if(i >= 0) s = s.slice(0, i + 8) + eol + BOOT + eol + s.slice(i + 8);
      }
    }
    if(s !== before) acts.push('PAL инициализирован до использования');
  }

  /* 2. Таблицы в прокручиваемую обёртку */
  let wrapped = 0;
  s = s.replace(/<table\b[\s\S]*?<\/table>/gi, (m, off, whole) => {
    const head = whole.slice(Math.max(0, off - 90), off);
    if(/class\s*=\s*["'][^"']*\btw\b/.test(head)) return m;
    wrapped++;
    return '<div class="tw">' + m + '</div>';
  });
  if(wrapped) acts.push('таблиц в .tw: ' + wrapped);

  /* 3. Единое написание кнопки сброса */
  let named = 0;
  s = s.replace(/(<button\b[^>]*>)([\s\S]*?)(<\/button>)/gi, (m, a, inner, z) => {
    if(!/сброс/i.test(inner) || /Сброс/.test(inner)) return m;
    named++;
    return a + inner.replace(/сброс/i, 'Сброс') + z;
  });
  if(named) acts.push('подпись «Сброс»: ' + named);

  /* 4. Метка главной сцены */
  if(!/data-llt-stage/.test(s)){
    let marked = false;
    s = s.replace(/<canvas\b([^>]*)>/i, (m, a) => { marked = true; return '<canvas data-llt-stage="1"' + a + '>'; });
    if(!marked){
      s = s.replace(/<svg\b([^>]*)>/i, (m, a) => { marked = true; return '<svg data-llt-stage="1"' + a + '>'; });
    }
    if(marked) acts.push('сцена помечена');
  }

  if(s !== orig){
    changed++;
    if(!dry) writeFileSync(p, s, 'utf8');
    console.log((dry ? '[dry] ' : '[fix] ') + f.padEnd(26) + ' → ' + acts.join(', '));
  } else console.log('[ok ] ' + f);
}
console.log('\n' + (dry ? 'Будет изменено' : 'Изменено') + ' файлов: ' + changed + ' из ' + total);