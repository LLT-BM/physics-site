/* LibLabTab · чистка репозитория: одноразовые патчеры, артефакты, архивы.
   По умолчанию переносит в .repo-trash (вне Git). Флаг --purge удаляет совсем.
   node tools/clean-repo.mjs --dry | node tools/clean-repo.mjs [--purge] */
import process from 'node:process';
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync,
         mkdirSync, renameSync, rmSync, appendFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const dry = process.argv.includes('--dry');
const purge = process.argv.includes('--purge');
const TRASH = '.repo-trash';

const KEEP_TOOLS = new Set([
  'check.mjs','smoke.mjs','release.mjs','layout-audit.mjs','audit-state.mjs',
  'clean-repo.mjs','strip-qa.mjs','new-model.mjs','cover-export.html'
]);
const DROP_FILES = [
  'site.zip','vercel.json','audit-state.json','layout-audit.json',
  'deploy.log','package-lock.json.bak','tsconfig.json.bak'
];
const DROP_DIRS = ['layout-audit','.vercel','.astro','dist'];
const KEEP_ROOT = new Set(['node_modules','public','src','tools','.git','.github','.vscode']);

function size(p){ try{ return statSync(p).size; }catch{ return 0; } }
const moved = [];

function take(p, why){
  if(!existsSync(p)) return;
  const kb = Math.round(size(p)/1024);
  if(dry){ moved.push('[dry] ' + p + '  (' + why + (kb ? ', ' + kb + ' КБ' : '') + ')'); return; }
  if(purge){
    rmSync(p, { recursive:true, force:true });
    moved.push('[del] ' + p + '  (' + why + ')');
  } else {
    if(!existsSync(TRASH)) mkdirSync(TRASH, { recursive:true });
    const dest = join(TRASH, p.replace(/[\\/]/g,'__'));
    rmSync(dest, { recursive:true, force:true });
    renameSync(p, dest);
    moved.push('[mov] ' + p + ' → ' + dest + '  (' + why + ')');
  }
}

if(existsSync('tools')){
  for(const f of readdirSync('tools')){
    if(KEEP_TOOLS.has(f)) continue;
    take(join('tools', f), 'одноразовый патчер');
  }
}
for(const f of DROP_FILES) take(f, 'артефакт');
for(const d of DROP_DIRS) take(d, 'сборка или отчёт');
for(const f of readdirSync('.')){
  if(KEEP_ROOT.has(f)) continue;
  if(/\.(zip|tar|gz|7z|rar|log|bak|tmp)$/i.test(f)) take(f, 'архив или лог');
}

/* .gitignore: артефакты больше не попадают в Git */
{
  const p = '.gitignore';
  const need = ['.repo-trash/','layout-audit/','layout-audit.json','audit-state.json',
                'dist/','.astro/','*.log','*.zip','deploy.secret.txt'];
  const cur = existsSync(p) ? readFileSync(p,'utf8') : '';
  const add = need.filter(x => !cur.split(/\r?\n/).includes(x));
  if(add.length){
    if(!dry) appendFileSync(p, '\n# артефакты и корзина чистки\n' + add.join('\n') + '\n', 'utf8');
    moved.push((dry?'[dry] ':'[fix] ') + p + ' → ' + add.join(', '));
  }
}

console.log(moved.join('\n') || 'Чисто: убирать нечего.');
console.log('\n' + (dry ? 'Предпросмотр' : purge ? 'Удалено' : 'Перенесено в ' + TRASH) + ': ' + moved.length);
if(!dry && !purge && existsSync(TRASH))
  console.log('Проверьте сайт, затем удалите корзину: node tools/clean-repo.mjs --purge');
console.log('Оставлены инструменты: ' + [...KEEP_TOOLS].join(', '));