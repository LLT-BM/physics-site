/* LibLabTab · единая публикация: проверки → коммит → пуш → (опционально) FTP.
   node tools/release.mjs "сообщение коммита"
   node tools/release.mjs "сообщение" --deploy     — ещё и deploy.bat
   node tools/release.mjs "сообщение" --fast       — без astro check и сборки
   node tools/release.mjs --dry                    — только показать план
   Безопасно: без force, без auto-merge, останавливается на первой ошибке. */
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter(a => a.startsWith('--')));
const message = argv.filter(a => !a.startsWith('--')).join(' ').trim();
const DRY = flags.has('--dry');
const FAST = flags.has('--fast');
const DEPLOY = flags.has('--deploy');
const WIN = process.platform === 'win32';

function sh(cmd, args, opts = {}){
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: WIN && /\.(bat|cmd)$/i.test(cmd) === false ? false : WIN,
    cwd: opts.cwd,
    stdio: opts.quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });
  return { code: r.status ?? 1, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
function git(args, quiet = true){ return sh('git', args, { quiet }); }
function must(res, label){
  if(res.code !== 0){
    console.error('\n✗ ' + label);
    if(res.err) console.error(res.err);
    if(res.out) console.error(res.out);
    process.exit(1);
  }
  return res;
}
function step(t){ console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length))); }

/* 1. Репозиторий и корень */
const top = git(['rev-parse', '--show-toplevel']);
if(top.code !== 0){ console.error('Это не git-репозиторий.'); process.exit(1); }
const ROOT = top.out;
process.chdir(ROOT);

const branch = git(['branch', '--show-current']).out;
if(!branch){ console.error('Detached HEAD: переключитесь на ветку (git checkout main).'); process.exit(1); }

const remote = git(['remote', 'get-url', 'origin']);
if(remote.code !== 0){ console.error('Нет remote "origin". Добавьте: git remote add origin <url>'); process.exit(1); }

const conflicts = git(['ls-files', '-u']).out;
if(conflicts){ console.error('Есть незакрытые конфликты слияния. Разрешите их и повторите.'); process.exit(1); }

const upstreamRes = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
const upstream = upstreamRes.code === 0 ? upstreamRes.out : null;

step('План');
console.log('репозиторий : ' + ROOT);
console.log('ветка       : ' + branch);
console.log('origin      : ' + remote.out);
console.log('upstream    : ' + (upstream || 'не задан → будет установлен при пуше'));
console.log('режим       : ' + [DRY ? 'предпросмотр' : 'запись', FAST ? 'без сборки' : 'с проверками', DEPLOY ? 'с FTP' : 'без FTP'].join(' · '));

/* 2. Проверки */
if(!FAST){
  if(existsSync(join('tools', 'check.mjs'))){
    step('Статическая проверка симуляций');
    if(!DRY) must(sh('node', ['tools/check.mjs']), 'tools/check.mjs');
    else console.log('node tools/check.mjs');
  }
  step('Типы и схемы контента');
  if(!DRY) must(sh('npx', ['astro', 'check']), 'astro check');
  else console.log('npx astro check');

  step('Сборка');
  if(!DRY) must(sh('npm', ['run', 'build']), 'npm run build');
  else console.log('npm run build');
}

/* 3. Что попадёт в коммит */
step('Изменения');
if(DRY){
  sh('git', ['status', '--short']);
  sh('git', ['diff', '--stat']);
} else {
  must(git(['add', '-A'], false), 'git add -A');
  sh('git', ['diff', '--cached', '--stat'], { quiet: false });
}

const staged = git(['diff', '--cached', '--name-only']).out;
const aheadRes = git(['rev-list', '--count', '@{u}..HEAD']);
const ahead = aheadRes.code === 0 ? parseInt(aheadRes.out, 10) || 0 : 0;

if(!staged && ahead === 0 && !DRY){
  console.log('\nНечего публиковать: рабочее дерево чистое, локальных коммитов впереди нет.');
  if(DEPLOY && existsSync('deploy.bat')){
    step('Выкладка на хостинг');
    must(sh('deploy.bat', []), 'deploy.bat');
  }
  process.exit(0);
}

/* 4. Коммит */
if(staged || DRY){
  const msg = message || 'Обновление моделей и инфраструктуры сайта';
  step('Коммит');
  console.log('сообщение: ' + msg);
  if(!DRY) must(git(['commit', '-m', msg], false), 'git commit');
}

/* 5. Пуш */
step('Отправка в GitHub');
const pushArgs = upstream ? ['push', 'origin', branch] : ['push', '-u', 'origin', branch];
console.log('git ' + pushArgs.join(' '));
if(!DRY){
  const p = git(pushArgs, false);
  if(p.code !== 0){
    console.error('\n✗ Пуш отклонён. Обычно на GitHub есть коммит, которого нет локально.');
    console.error('  git pull --rebase origin ' + branch);
    console.error('  node tools/release.mjs "' + (message || 'обновление') + '"');
    console.error('Force-push не выполняется намеренно.');
    process.exit(1);
  }
}

/* 6. FTP */
if(DEPLOY){
  step('Выкладка на хостинг');
  if(!existsSync('deploy.bat')){ console.error('Нет deploy.bat в корне.'); process.exit(1); }
  if(!DRY) must(sh('deploy.bat', []), 'deploy.bat');
  else console.log('deploy.bat');
}

/* 7. Итог */
step('Готово');
sh('git', ['status', '-sb'], { quiet: false });
sh('git', ['log', '--oneline', '-3'], { quiet: false });
console.log('\nрепозиторий : ' + remote.out.replace(/\.git$/, ''));
console.log('сайт        : https://liblabtab.ru');
if(!DRY) console.log('проверьте с Ctrl+F5 нужную страницу модели.');