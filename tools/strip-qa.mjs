/* LibLabTab · убирает вопросы и ответы, выносит короткую теорию в lead,
   переносит «Границы модели» в поле limits. Тело MD оставляет только физику.
   node tools/strip-qa.mjs --dry | node tools/strip-qa.mjs */
import process from 'node:process';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/content/models';
const dry = process.argv.includes('--dry');
if(!existsSync(DIR)){ console.log('Запускайте из корня проекта'); process.exit(1); }

const DROP = /^##\s*(Вопросы для самопроверки|Ответы на вопросы[^\n]*|Самопроверка)\s*$/i;
const LIMITS = /^##\s*(Границы модели|Ограничения модели)\s*$/i;
const KEEP_HEAD = /^##\s*(Как пользоваться|Физика|Что происходит|Управление)\s*$/i;

const q = s => '"' + String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"') + '"';

function splitMd(src){
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return m ? { fm:m[1], body:src.slice(m[0].length), eol:src.includes('\r\n')?'\r\n':'\n' } : null;
}
function field(fm, key){
  const m = fm.match(new RegExp('^' + key + ':\\s*(.+)$','m'));
  return m ? m[1].trim().replace(/^["']|["']$/g,'') : '';
}
function dropKeys(fm, keys){
  const out = []; let skip = false;
  for(const line of fm.split(/\r?\n/)){
    const k = (line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:/) || [])[1];
    if(k){ skip = keys.includes(k); if(!skip) out.push(line); continue; }
    if(!skip) out.push(line);
  }
  while(out.length && !out[out.length-1].trim()) out.pop();
  return out;
}

let changed = 0;
for(const f of readdirSync(DIR).filter(x => x.endsWith('.md'))){
  const p = join(DIR,f);
  const orig = readFileSync(p,'utf8');
  const parts = splitMd(orig);
  if(!parts){ console.log('[?] ' + f + ' — нет frontmatter'); continue; }

  const lines = parts.body.split(/\r?\n/);
  const kept = [], limits = [];
  let mode = 'keep', firstPara = '';
  for(const line of lines){
    if(/^##\s/.test(line)){
      if(DROP.test(line)){ mode = 'drop'; continue; }
      if(LIMITS.test(line)){ mode = 'limits'; continue; }
      mode = 'keep';
      if(KEEP_HEAD.test(line)) { kept.push(line); continue; }
      kept.push(line); continue;
    }
    if(mode === 'drop') continue;
    if(mode === 'limits'){
      const m = line.match(/^\s*[-*]\s+(.*)$/);
      if(m) limits.push(m[1].replace(/\*\*/g,'').trim());
      continue;
    }
    kept.push(line);
    if(!firstPara && line.trim() && !/^[#|>\-*]/.test(line.trim()) && line.trim().length > 60)
      firstPara = line.trim();
  }

  let body = kept.join(parts.eol).replace(/\n{3,}/g,'\n\n').trim() + parts.eol;
  body = body.replace(/^##\s*Как пользоваться\s*$/m, '## Как пользоваться');

  const fmLines = dropKeys(parts.fm, ['answers','questions','limits','lead']);
  const lead = field(parts.fm,'lead') || firstPara || field(parts.fm,'description');
  fmLines.push('lead: ' + q(lead.slice(0, 320)));
  if(limits.length){
    fmLines.push('limits:');
    limits.forEach(x => fmLines.push('  - ' + q(x)));
  }

  const out = '---' + parts.eol + fmLines.join(parts.eol) + parts.eol + '---' + parts.eol + body;
  if(out !== orig){
    changed++;
    if(!dry) writeFileSync(p, out, 'utf8');
    console.log((dry?'[dry] ':'[fix] ') + f.padEnd(26) + ' → вопросов убрано, limits: ' + limits.length + ', lead: ' + (lead ? 'есть' : 'нет'));
  } else console.log('[ok ] ' + f);
}
console.log('\n' + (dry?'Будет изменено':'Изменено') + ' файлов: ' + changed);