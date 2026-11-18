/* LibLabTab · добавляет единый «Сброс» в модели, где его нет.
   Запуск:  node tools/add-reset.mjs --dry   — показать
            node tools/add-reset.mjs         — применить
   Идемпотентен: файлы, где сброс уже есть, не трогает. */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'public/sim';
const dry = process.argv.includes('--dry');
if(!existsSync(DIR)){ console.log('Нет папки ' + DIR + '. Запускайте из корня проекта.'); process.exit(1); }

const BTN_RE = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
const plain = h => h.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
const hasReset = s => /id=["']reset["']/.test(s) || /Сброс/.test(s);

const HANDLER = [
  '<script>',
  '/* LibLabTab · единый сброс */',
  '(function(){',
  '  var b=document.getElementById("reset"); if(!b||b.__wired) return; b.__wired=true;',
  '  b.addEventListener("click",function(){',
  '    var names=["reset","resetSim","doReset","resetAll","restart"],fn=null;',
  '    for(var i=0;i<names.length;i++){ if(typeof window[names[i]]==="function"){ fn=window[names[i]]; break; } }',
  '    if(fn){ try{ fn(); return; }catch(e){} }',
  '    location.reload();',
  '  });',
  '})();',
  '</script>'
].join('\n');

let changed = 0, total = 0;

for(const f of readdirSync(DIR).filter(x => x.toLowerCase().endsWith('.html'))){
  const p = join(DIR, f);
  const orig = readFileSync(p, 'utf8');
  total++;

  if(hasReset(orig)){ console.log('[ok ] ' + f); continue; }

  const eol = orig.includes('\r\n') ? '\r\n' : '\n';
  let s = orig, act = '';

  /* 1. Ищем уже существующую кнопку сброса с другим именем — просто русифицируем подпись,
        её собственный обработчик остаётся нетронутым. */
  const btns = [...orig.matchAll(BTN_RE)];
  let target = null;
  for(const m of btns){
    const attrs = m[1], text = plain(m[2]);
    if(/(id|class|title|aria-label)\s*=\s*["'][^"']*(reset|rst|сброс)[^"']*["']/i.test(attrs)
       || /reset|сброс|↺|⟲|⟳/i.test(text)){ target = m; break; }
  }

  if(target){
    const rebuilt = '<button' + target[1] + '>Сброс</button>';
    s = orig.slice(0, target.index) + rebuilt + orig.slice(target.index + target[0].length);
    act = 'существующая кнопка подписана «Сброс», обработчик не тронут';
  } else {
    /* 2. Кнопки сброса нет — вставляем новую в панель управления. */
    let anchor = null, cls = '';
    const panel = orig.match(/<(footer|div|section)\b[^>]*class=["'][^"']*(controls|bar|panel|btns|toolbar)[^"']*["'][^>]*>[\s\S]*?<\/\1>/i);
    const scope = panel ? panel[0] : orig;
    const inScope = [...scope.matchAll(BTN_RE)];
    if(inScope.length){
      const pick = panel ? inScope[inScope.length - 1] : inScope[0];
      const cm = pick[1].match(/class\s*=\s*["']([^"']*)["']/i);
      cls = cm ? cm[1].replace(/\b(on|active|pri|primary)\b/g, '').trim() : '';
      const abs = (panel ? orig.indexOf(panel[0]) : 0) + pick.index + pick[0].length;
      anchor = abs;
    }
    const btn = eol + '    <button id="reset"' + (cls ? ' class="' + cls + '"' : '') + ' type="button">Сброс</button>';
    if(anchor !== null){
      s = orig.slice(0, anchor) + btn + orig.slice(anchor);
      act = 'кнопка добавлена в ' + (panel ? 'панель управления' : 'первую группу кнопок');
    } else {
      s = orig.replace(/<\/body>/i, '  <div style="position:fixed;left:12px;bottom:12px;z-index:60">' + btn + eol + '  </div>' + eol + '</body>');
      act = 'кнопка добавлена отдельным блоком (панель не найдена)';
    }
    s = s.replace(/<\/body>/i, HANDLER + eol + '</body>');
    act += ', обработчик подключён';
  }

  changed++;
  if(!dry) writeFileSync(p, s, 'utf8');
  console.log((dry ? '[dry] ' : '[fix] ') + f + ' → ' + act);
}

console.log('');
console.log((dry ? 'Будет изменено' : 'Изменено') + ' файлов: ' + changed + ' из ' + total);
if(dry && changed) console.log('Применить: node tools/add-reset.mjs');