/* LibLabTab · публикует внутреннюю selfTest() наружу и подключает мост.
   node tools/export-selftest.mjs — идемпотентно. */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'public/sim';
if(!existsSync(join(DIR,'lib/selftest.js'))){
  console.log('Сначала создайте public/sim/lib/selftest.js'); process.exit(1);
}

let changed = 0, total = 0, exported = [];
for(const f of readdirSync(DIR).filter(x => x.toLowerCase().endsWith('.html'))){
  const p = join(DIR,f);
  const orig = readFileSync(p,'utf8'); total++;
  const eol = orig.includes('\r\n') ? '\r\n' : '\n';
  let s = orig; const acts = [];

  if(!/\/sim\/lib\/selftest\.js/.test(s)){
    if(/<\/body>/i.test(s)){
      s = s.replace(/<\/body>/i, '<script src="/sim/lib/selftest.js"></script>' + eol + '</body>');
    } else {
      s += eol + '<script src="/sim/lib/selftest.js"></script>' + eol;
    }
    acts.push('мост подключён');
  }

  if(/function\s+selfTest\s*\(/.test(s) && !/window\.__selfTest/.test(s)){
    const i = s.lastIndexOf('})();');
    if(i > 0){
      s = s.slice(0,i) + 'try{ window.__selfTest = selfTest; }catch(e){}' + eol + s.slice(i);
      acts.push('selfTest экспортирована');
      exported.push(f);
    }
  }

  if(s !== orig){ changed++; writeFileSync(p, s, 'utf8'); console.log('[fix] ' + f.padEnd(26) + ' → ' + acts.join(', ')); }
  else console.log('[ok ] ' + f);
}
console.log('\nИзменено файлов: ' + changed + ' из ' + total);
console.log(exported.length
  ? 'Живой самотест доступен в: ' + exported.join(', ')
  : 'Новых экспортов нет (уже сделано или selfTest отсутствует).');