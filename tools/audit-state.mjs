/* LibLabTab · фактический аудит состояния репозитория.
   Сверяет то, что уже применено, с планом аудита от 18.11 и с последующими правками.
   node tools/audit-state.mjs                 — отчёт по группам
   node tools/audit-state.mjs --group=P0      — только одна группа
   node tools/audit-state.mjs --json          — машинный вывод
   Код возврата 1, если есть TODO или CONFLICT. */
import process from 'node:process';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const only = (argv.find(a => a.startsWith('--group=')) || '').split('=')[1] || '';

const ex = p => existsSync(p);
const rd = p => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
function walk(dir, exts){
  if(!ex(dir)) return [];
  const out = [];
  for(const name of readdirSync(dir)){
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if(st.isDirectory()){
      if(/^(node_modules|dist|\.astro|\.git)$/.test(name)) continue;
      out.push(...walk(p, exts));
    } else if(exts.some(e => name.toLowerCase().endsWith(e))) out.push(p);
  }
  return out;
}

const SIMS = ['atom.html','atomic-interactions.html','bernoulli.html','circuit.html','lens.html',
  'lenz.html','lever.html','life.html','math-pendulum.html','pendulum.html',
  'penrose-billiard.html','scale.html','spring-pendulum.html'];
const SLUG = {
  'atom.html':'atom-model','atomic-interactions.html':'atomic-interactions','bernoulli.html':'bernoulli',
  'circuit.html':'circuit-lab','lens.html':'lens-image','lenz.html':'lenz-law','lever.html':'lever-moments',
  'life.html':'life-game','math-pendulum.html':'math-pendulum','pendulum.html':'double-pendulum',
  'penrose-billiard.html':'penrose-billiard','scale.html':'scale-of-universe','spring-pendulum.html':'spring-pendulum'
};
const MD = f => join('src/content/models', f + '.md');
const SIM = f => join('public/sim', f);

const rows = [];
const add = (group, name, status, detail) => rows.push({ group, name, status, detail: detail || '' });

/* ── P0: содержательные ошибки из аудита ───────────────────────────── */
function p0(file, name, oldRe, newRe){
  const p = MD(file);
  if(!ex(p)){ add('P0', name, 'SKIP', file + '.md отсутствует'); return; }
  const s = rd(p);
  const hasNew = newRe && newRe.test(s);
  const hasOld = oldRe.test(s);
  if(hasNew && !hasOld) add('P0', name, 'OK', file);
  else if(hasOld) add('P0', name, 'TODO', file + ': старая формулировка на месте');
  else if(hasNew) add('P0', name, 'OK', file);
  else add('P0', name, 'CHECK', file + ': ни старой, ни новой формулировки');
}
p0('scale-of-universe','планковская длина: мяч > l_P',/меньше планковской длины/,/одного порядка с планковской/);
p0('scale-of-universe','горизонты: диаметр Солнца',/2,95 км на каждую массу Солнца/,/(диаметр горизонта 5,9|5,91 км на каждую)/);
p0('scale-of-universe','горизонты: диаметр Земли',/8,87 мм для Земли/,/(17,74 мм|17,7 мм)/);
p0('scale-of-universe','человек против протона',/в миллиарды раз меньше протона/,/в триллион раз/);
p0('scale-of-universe','радиус Хаббла 14,5',/14,4 млрд/,/14,5/);
p0('scale-of-universe','английское intuition',/intuition/,/интуици/);
p0('scale-of-universe','время пролёта для атома H',/3,3·10⁻¹⁹/,/3,5·10⁻¹⁹/);
p0('atomic-interactions','вода: 6,8 раза к правилу 0,7',/в 4,8 раза выше правила/,/в 6,8 раза/);
p0('atomic-interactions','CO₂: сублимация, не кипение',/\|\s*194,7\s*\|\s*1,00\s*\|/,/(194,7 \*|сублимации)/);
p0('lens-image','вопрос про Γ при удвоении d',/Во сколько раз изменится `Γ`, если увеличить/,/сравните Γ при d = 15/);
p0('lens-image','правило знаков вместо декартовой',/декартовой конвенции/,/школьном правиле знаков/);
p0('lens-image','тривиальный вопрос про рассеивающую',/максимально близко к линзе/,/к какому пределу/);
p0('math-pendulum','нить провисает при отпускании',/при θ₀ > 90° и большой скорости/,/нить провисает сразу/);
p0('math-pendulum','затухание: T₀/√(1−ζ²)',/стремясь к T₀|период при этом уменьшается/,/T₀\/√\(1 − ζ²\)/);
p0('bernoulli','площадь отверстия a = 1 см²',/d = 11,3 мм, C_d = 0,62/,/a = 1 см²/);
p0('lever-moments','опечатка «обратную пропорциональность»',/к обратную пропорциональность/,/к обратной пропорциональности/);
p0('lever-moments','путаный вопрос про l₃ = 0',/что было бы при `l₃ = 0`/,/точно над осью вращения/);
p0('spring-pendulum','строчная «для» после точки',/связь\. для пружины/,/связь\. Для/);
p0('spring-pendulum','необоснованные «полтора раза»',/вырос бы в полтора раза/,/1,37/);
p0('life-game','R-пентамино: 1103 и 6 планеров',/около \*\*1100 поколений\*\*/,/1103/);
p0('life-game','оговорка про бесконечную плоскость',/ожидаемыми ≈1100/,/бесконечной плоскости/);
p0('penrose-billiard','пять типов стенок',/[Шш]есть типов/,/[Пп]ять типов/);
add('P0','устаревшая страница ohm-law', ex(MD('ohm-law')) ? 'TODO' : 'OK',
    ex(MD('ohm-law')) ? 'файл ещё есть' : 'удалена');
add('P0','редирект ohm-law в .htaccess',
    /Redirect 301 \/models\/ohm-law/.test(rd('public/.htaccess')) ? 'OK' : 'TODO', 'public/.htaccess');

/* ── SIM: инфраструктура каждой симуляции ──────────────────────────── */
for(const f of SIMS){
  const p = SIM(f);
  if(!ex(p)){ add('SIM', f, 'SKIP', 'файл отсутствует'); continue; }
  const s = rd(p);
  const canon = (s.match(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
                 s.match(/href=["']([^"']+)["'][^>]*rel=["']canonical["']/i) || [])[1] || '';
  const want = 'https://liblabtab.ru/models/' + SLUG[f] + '/';
  add('SIM', f + ' · canonical', canon === want ? 'OK' : 'TODO', canon || 'нет');
  add('SIM', f + ' · guard.js', /\/sim\/guard\.js/.test(s) ? 'OK' : 'TODO');
  add('SIM', f + ' · theme.js', /\/sim\/lib\/theme\.js/.test(s) ? 'OK' : 'TODO');
  add('SIM', f + ' · fmt.js', /\/sim\/lib\/fmt\.js/.test(s) ? 'OK' : 'TODO');
  add('SIM', f + ' · viewport-fit', /viewport-fit=cover/.test(s) ? 'OK' : 'TODO');
  add('SIM', f + ' · кнопка сброса', /id=["']reset["']|Сброс|По умолчанию/.test(s) ? 'OK' : 'TODO');
  add('SIM', f + ' · aria-label сцены', /<canvas[^>]*aria-label|<svg[^>]*aria-label/.test(s) ? 'OK' : 'TODO');
  add('SIM', f + ' · ru-RU числа', /(LLTfmt|LLTfix|\bNF\()/.test(s) ? 'OK' : 'TODO',
      (s.match(/\.toFixed\(/g) || []).length + ' вызовов toFixed');
}

/* ── LAYOUT: единый каркас ─────────────────────────────────────────── */
add('LAYOUT','lib/layout.css', ex('public/sim/lib/layout.css') ? 'OK' : 'TODO');
add('LAYOUT','lib/layout.js', ex('public/sim/lib/layout.js') ? 'OK' : 'TODO');
add('LAYOUT','lib/selftest.js', ex('public/sim/lib/selftest.js') ? 'OK' : 'TODO');
{
  const noLayout = [], legacyUi = [], off = [];
  for(const f of SIMS){
    const s = rd(SIM(f)); if(!s) continue;
    if(!/\/sim\/lib\/layout\.js/.test(s)) noLayout.push(f);
    if(/\/sim\/lib\/ui\.js/.test(s)) legacyUi.push(f);
    if(/data-llt-layout\s*=\s*["']off["']/.test(s)) off.push(f);
  }
  add('LAYOUT','layout.js подключён везде', noLayout.length ? 'TODO' : 'OK', noLayout.join(', '));
  add('LAYOUT','старый ui.js отключён', legacyUi.length ? 'CONFLICT' : 'OK', legacyUi.join(', '));
  add('LAYOUT','каркас не отключён (off)', off.length ? 'TODO' : 'OK', off.join(', '));
}

/* ── NUM: нумерация моделей убрана ─────────────────────────────────── */
{
  const idx = rd('src/pages/index.astro');
  const slugPage = rd('src/pages/models/[slug].astro');
  add('NUM','каталог без бейджа num', /class="num"/.test(idx) ? 'TODO' : 'OK');
  add('NUM','каталог без numbered()', /numbered\(/.test(idx) ? 'TODO' : 'OK');
  add('NUM','страница без mnum', /class="mnum"/.test(slugPage) ? 'TODO' : 'OK');
  const cov = walk('public/covers', ['.svg']).filter(p => /LIBLABTAB\s*·\s*\d+/.test(rd(p)));
  add('NUM','обложки без номера', cov.length ? 'TODO' : 'OK', cov.length + ' шт.');
  const foot = walk('public/sim', ['.html']).filter(p => /модель\s*№?\s*\d+/i.test(rd(p)));
  add('NUM','подвалы симуляций без номера', foot.length ? 'TODO' : 'OK', foot.length + ' шт.');
}

/* ── CONTENT: схема и данные ───────────────────────────────────────── */
{
  const cfg = rd('src/content.config.ts');
  add('CONTENT','z из astro/zod', /from ['"]astro\/zod['"]/.test(cfg) ? 'OK' : 'TODO');
  add('CONTENT','схема: section', /section:\s*z\.enum\(SECTIONS\)/.test(cfg) ? 'OK' : 'TODO');
  add('CONTENT','схема: level', /level:\s*z\.enum\(LEVELS\)/.test(cfg) ? 'OK' : 'TODO');
  add('CONTENT','схема: order', /order:\s*z\.number\(\)/.test(cfg) ? 'OK' : 'TODO');
  add('CONTENT','схема: answers', /answers:\s*z\.array/.test(cfg) ? 'OK' : 'TODO');
  add('CONTENT','схема: checkpoints', /checkpoints:\s*z\.array/.test(cfg) ? 'OK' : 'TODO');
  const mds = walk('src/content/models', ['.md']);
  const noSec = [], noAns = [], future = [];
  const now = Date.now();
  for(const p of mds){
    const s = rd(p);
    if(!/^section:/m.test(s)) noSec.push(p);
    if(!/^answers:/m.test(s)) noAns.push(p);
    const d = (s.match(/^date:\s*(.+)$/m) || [])[1];
    if(d && Date.parse(d.replace(/["']/g, '')) > now) future.push(p);
  }
  add('CONTENT','все md с section', noSec.length ? 'TODO' : 'OK', noSec.join(', '));
  add('CONTENT','ответы у всех моделей', noAns.length ? 'TODO' : 'OK', noAns.length + ' без ответов');
  add('CONTENT','дат из будущего нет', future.length ? 'TODO' : 'OK', future.join(', '));
}

/* ── COMMENTS: комментарии на PHP+SQLite, без Supabase ─────────────── */
{
  const php = walk('public', ['.php']);
  add('COMMENTS','PHP-обработчик комментариев', php.length ? 'OK' : 'TODO', php.join(', '));
  const srcAll = walk('src', ['.astro', '.ts', '.js']).concat(walk('public/sim', ['.html']));
  const supa = srcAll.filter(p => /supabase/i.test(rd(p)));
  add('COMMENTS','следов Supabase нет', supa.length ? 'CONFLICT' : 'OK', supa.join(', '));
  const pkg = rd('package.json');
  add('COMMENTS','зависимость supabase убрана', /@supabase\/supabase-js/.test(pkg) ? 'CONFLICT' : 'OK');
  add('COMMENTS','account.astro удалён', ex('src/pages/account.astro') ? 'CONFLICT' : 'OK');
  add('COMMENTS','auth.ts удалён', ex('src/lib/auth.ts') ? 'CONFLICT' : 'OK');
  const base = rd('src/layouts/Base.astro');
  add('COMMENTS','нет ссылки на /account/', /\/account\//.test(base) ? 'CONFLICT' : 'OK');
}

/* ── HYGIENE: репозиторий ──────────────────────────────────────────── */
{
  const readme = rd('README.md');
  add('HYGIENE','site.zip удалён', ex('site.zip') ? 'TODO' : 'OK');
  add('HYGIENE','vercel.json удалён', ex('vercel.json') ? 'TODO' : 'OK');
  add('HYGIENE','README не шаблон Astro', /Astro Starter Kit/i.test(readme) ? 'TODO' : 'OK');
  add('HYGIENE','README перечисляет 13 моделей',
      (readme.match(/^\|\s*[А-ЯЁ]/gm) || []).length >= 13 ? 'OK' : 'TODO',
      (readme.match(/^\|\s*[А-ЯЁ]/gm) || []).length + ' строк каталога');
  add('HYGIENE','LICENSE', ex('LICENSE') ? 'OK' : 'TODO');
  add('HYGIENE','.nvmrc', ex('.nvmrc') ? 'OK' : 'TODO');
  add('HYGIENE','engines в package.json', /"engines"/.test(rd('package.json')) ? 'OK' : 'TODO');
  const ts = rd('tsconfig.json');
  add('HYGIENE','tsconfig исключает tools', /"tools"/.test(ts) ? 'OK' : 'TODO');
  add('HYGIENE','редиректы старых тегов',
      /Redirect 301 \/tags\/механика/.test(rd('public/.htaccess')) ? 'OK' : 'TODO');
}

/* ── CODE: сквозные требования ─────────────────────────────────────── */
{
  add('CODE','tools/check.mjs', ex('tools/check.mjs') ? 'OK' : 'TODO');
  add('CODE','tools/smoke.mjs', ex('tools/smoke.mjs') ? 'OK' : 'TODO');
  add('CODE','tools/release.mjs', ex('tools/release.mjs') ? 'OK' : 'TODO');
  add('CODE','CI GitHub Actions', ex('.github/workflows') ? 'OK' : 'TODO');
  add('CODE','тесты физического ядра', ex('tests') || ex('src/lib/physics') ? 'OK' : 'TODO');
  const noTouch = SIMS.filter(f => { const s = rd(SIM(f)); return s && !/touch-action/.test(s); });
  add('CODE','touch-action во всех сценах', noTouch.length ? 'TODO' : 'OK', noTouch.join(', '));
}

/* ── вывод ─────────────────────────────────────────────────────────── */
const filtered = only ? rows.filter(r => r.group === only.toUpperCase()) : rows;
const counts = { OK: 0, TODO: 0, CONFLICT: 0, CHECK: 0, SKIP: 0 };
filtered.forEach(r => counts[r.status] = (counts[r.status] || 0) + 1);

if(asJson){
  console.log(JSON.stringify({ counts, rows: filtered }, null, 2));
} else {
  const groups = [...new Set(filtered.map(r => r.group))];
  for(const g of groups){
    console.log('\n── ' + g + ' ' + '─'.repeat(Math.max(0, 60 - g.length)));
    for(const r of filtered.filter(x => x.group === g)){
      const mark = r.status === 'OK' ? '[ok ]' : r.status === 'CONFLICT' ? '[!! ]' :
                   r.status === 'SKIP' ? '[-  ]' : r.status === 'CHECK' ? '[?  ]' : '[TODO]';
      console.log(mark + ' ' + r.name + (r.detail ? '  → ' + r.detail : ''));
    }
  }
  console.log('\n' + '═'.repeat(64));
  console.log('OK ' + counts.OK + ' · TODO ' + counts.TODO + ' · CONFLICT ' + counts.CONFLICT +
              ' · CHECK ' + counts.CHECK + ' · SKIP ' + counts.SKIP);
  if(counts.CONFLICT) console.log('CONFLICT — противоречия между применёнными правками, чинить первыми.');
  if(counts.TODO) console.log('TODO — пункт плана ещё не применён к файлам.');
}
process.exit(asJson ? 0 : ((counts.TODO + counts.CONFLICT) ? 1 : 0));