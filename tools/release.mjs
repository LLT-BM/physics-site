/* LibLabTab · единая публикация: проверки → коммит → пуш → (опционально) FTP.
   node tools/release.mjs "сообщение коммита"
   node tools/release.mjs "сообщение" --deploy
   node tools/release.mjs "сообщение" --fast      — без astro check и сборки
   node tools/release.mjs --dry                   — только план
   Без force, без auto-merge, останов на первой ошибке. */
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

function sh(cmd, args = [], opts = {}){
  const isBat = /\.(bat|cmd)$/i.test(cmd);
  const isShim = /^(npm|npx|yarn|pnpm)$/i.test(cmd);
  const useShell = WIN && (isBat || isShim);
  const line = [cmd, ...args.map(a => (/[\s"]/.test(a) ? '"' + a.replace(/"/g, '\\"') + '"' : a))].join(' ');
  const r = useShell
    ? spawnSync(line, { shell: true, encoding: 'utf8', cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    : spawnSync(cmd, args, { encoding: 'utf8', cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  const out = (r.stdout || '').trim();
  const err = (r.stderr || '').trim() || (r.error ? r.error.message : '');
  if(!opts.quiet){ if(out) console.log(out); if(err) console.error(err); }
  return { code: r.status === null ? 1 : r.status, out, err };
}
function git(args, quiet = true){ return sh('git', args, { quiet }); }
function must(res, label){
  if(res.code !== 0){
    console.error('\n✗ ' + label + (res.err ? '\n' + res.err : ''));
    process.exit(1);
  }
  return res;
}
function step(t){ console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length))); }

const top = git(['rev-parse', '--show-toplevel']);
if(top.code !== 0){ console.error('Это не git-репозиторий.'); process.exit(1); }
process.chdir(top.out);

const branch = git(['branch', '--show-current']).out;
if(!branch){ console.error('Detached HEAD: git checkout main'); process.exit(1); }
const remote = git(['remote', 'get-url', 'origin']);
if(remote.code !== 0){ console.error('Нет remote "origin".'); process.exit(1); }
if(git(['ls-files', '-u']).out){ console.error('Незакрытые конфликты слияния.'); process.exit(1); }

const up = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
const upstream = up.code === 0 ? up.out : null;

step('План');
console.log('репозиторий : ' + top.out);
console.log('ветка       : ' + branch);
console.log('origin      : ' + remote.out);
console.log('upstream    : ' + (upstream || 'не задан → установится при пуше'));
console.log('режим       : ' + [DRY ? 'предпросмотр' : 'запись', FAST ? 'без сборки' : 'с проверками', DEPLOY ? 'с FTP' : 'без FTP'].join(' · '));

if(!FAST){
  if(existsSync(join('tools', 'check.mjs'))){
    step('Статическая проверка симуляций');
    if(DRY) console.log('node tools/check.mjs'); else must(sh('node', ['tools/check.mjs']), 'tools/check.mjs');
  }
  step('Типы и схемы контента');
  if(DRY) console.log('npx astro check'); else must(sh('npx', ['astro', 'check']), 'astro check');
  step('Сборка');
  if(DRY) console.log('npm run build'); else must(sh('npm', ['run', 'build']), 'npm run build');
}

step('Изменения');
if(DRY){
  sh('git', ['status', '--short']);
  sh('git', ['diff', '--stat']);
} else {
  must(git(['add', '-A'], false), 'git add -A');
  sh('git', ['diff', '--cached', '--stat']);
}

const staged = git(['diff', '--cached', '--name-only']).out;
const aheadRes = git(['rev-list', '--count', '@{u}..HEAD']);
const ahead = aheadRes.code === 0 ? parseInt(aheadRes.out, 10) || 0 : 0;

if(!staged && ahead === 0 && !DRY){
  console.log('\nНечего публиковать: дерево чистое, коммитов впереди нет.');
  if(DEPLOY && existsSync('deploy.bat')){ step('Выкладка на хостинг'); must(sh('deploy.bat', []), 'deploy.bat'); }
  process.exit(0);
}

if(staged || DRY){
  const msg = message || 'Обновление моделей и инфраструктуры сайта';
  step('Коммит');
  console.log('сообщение: ' + msg);
  if(!DRY) must(git(['commit', '-m', msg], false), 'git commit');
}

step('Отправка в GitHub');
const pushArgs = upstream ? ['push', 'origin', branch] : ['push', '-u', 'origin', branch];
console.log('git ' + pushArgs.join(' '));
if(!DRY){
  const p = git(pushArgs, false);
  if(p.code !== 0){
    console.error('\n✗ Пуш отклонён. Обычно на GitHub есть коммит, которого нет локально:');
    console.error('  git pull --rebase origin ' + branch);
    console.error('  node tools/release.mjs "' + (message || 'обновление') + '"');
    process.exit(1);
  }
}

if(DEPLOY){
  step('Выкладка на хостинг');
  if(!existsSync('deploy.bat')){ console.error('Нет deploy.bat в корне.'); process.exit(1); }
  if(DRY) console.log('deploy.bat'); else must(sh('deploy.bat', []), 'deploy.bat');
}

step('Готово');
sh('git', ['status', '-sb']);
sh('git', ['log', '--oneline', '-3']);
console.log('\nрепозиторий : ' + remote.out.replace(/\.git$/, ''));
console.log('сайт        : https://liblabtab.ru');