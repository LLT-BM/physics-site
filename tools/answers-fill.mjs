/* LibLabTab · добивает ответы на оставшиеся вопросы и добавляет контрольные точки.
   node tools/answers-fill.mjs --dry | node tools/answers-fill.mjs
   Существующие ответы сохраняются, мусорные записи отбрасываются. */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/content/models';
const dry = process.argv.includes('--dry');
if(!existsSync(DIR)){ console.log('Нет папки '+DIR); process.exit(1); }

/* Дополнительные ответы: подстрока вопроса → ответ */
const EXTRA = {
  'atomic-interactions': [
    ['Нагреть до T', 'При 90 К тепловая добавка kT/2 = 3,88 мэВ меньше глубины ямы 10,32 мэВ, полная энергия отрицательна — пара остаётся связанной и колеблется. При 300 К добавка 12,93 мэВ превышает яму, E ≥ 0, и атомы разлетаются. Порог связанности T ≈ 2ε/k = 239,6 К, а сама глубина ямы в температурных единицах ε/k = 119,8 К.'],
    ['He–Xe', 'Сильнее движется гелий: смещения обратно пропорциональны массам, x_He/x_Xe = m_Xe/m_He = 131,29/4,0026 = 32,8. Ксенон почти стоит, потому что приведённая масса μ = 3,88 u близка к массе гелия — в относительном движении лёгкий партнёр делает почти всю работу.'],
    ['в 6,8 раза выше', 'Потому что воду держат не ван-дер-ваальсовы силы, а водородные связи: около 21 кДж/моль ≈ 218 мэВ против 6,74 мэВ сферического леннард-джонсовского ε. Они направленные и на порядок сильнее, а модель 12-6 их не описывает вовсе. У аргона есть только изотропная дисперсия, поэтому правило T ≈ 0,7·ε/k для него выполняется.']
  ],
  'double-pendulum': [
    ['почти как линейная', 'При малых углах sin θ ≈ θ, нелинейные члены порядка θ³ отбрасываются, и система распадается на две независимые нормальные моды. Для равных масс и длин ω±² = (g/l)(2 ± √2): медленная мода T = 2,621 с, быстрая T = 1,086 с. Движение квазипериодическое, расхождение двойника линейное, а не экспоненциальное — хаоса нет.']
  ],
  'lenz-law': [
    ['неподвижен внутри катушки', 'Ноль. Магнитный поток при этом максимален, но ЭДС зависит от скорости его изменения: ε = −N·dΦ/dt, а dΦ/dt = 0. Стрелка гальванометра стоит на нуле, тока нет, сила взаимодействия исчезает. Это и есть суть опыта: важно изменение, а не величина потока.']
  ],
  'penrose-billiard': [
    ['Залейте светом комнату', 'Да, доля тёмной площади меняется: из-под свода свет заходит за грибы хуже, чем из точки между ними, и непокрытая область растёт. Но это численная оценка на сетке 176×176 при конечном числе лучей: малое значение не доказывает неосвещаемость, возможно, лучи просто ещё не нашли узкую зону. Увеличьте число лучей и отражений и сравните — если доля падает, зона освещается.']
  ]
};

/* Контрольные точки для моделей, где их не было */
const CPS = {
  'atom-model': [
    ['Наиболее вероятный радиус 1s','орбиталь 1s','r = a = 0,529 Å'],
    ['Узел 2s','орбиталь 2s','r = 2a = 1,058 Å'],
    ['Узел 3p','орбиталь 3p','r = 6a = 3,175 Å'],
    ['Узловые конусы 3d','орбиталь 3d_z²','cos θ = ±1/√3 → 54,7° и 125,3°'],
    ['Состав ядра','режим «Ядро», углерод-12','6 протонов + 6 нейтронов'],
    ['Заряд протона','режим «Протон», uud','⅔ + ⅔ − ⅓ = +1'],
    ['Отношение масштабов','атом ≈ 1 Å, ядро C-12 ≈ 2,47 фм','около 4·10⁴ раз']
  ],
  'double-pendulum': [
    ['Медленная нормальная мода','m₁ = m₂ = 1 кг, l₁ = l₂ = 1 м, θ ≤ 5°','T = 2,621 с'],
    ['Быстрая нормальная мода','те же настройки','T = 1,086 с'],
    ['Сохранение энергии','затухание 0, темп ×1','дрейф E меньше 10⁻⁶ за минуту'],
    ['Расхождение двойника','δ = 0,1°, θ₁ = 135°, θ₂ = 160°','заметно за 10–30 с'],
    ['Линейный режим','θ₁ = θ₂ = 3°, δ = 0,1°','расхождение линейное, не экспоненциальное']
  ],
  'lenz-law': [
    ['Неподвижный магнит','магнит стоит внутри катушки','ЭДС = 0, ток = 0'],
    ['Удвоение числа витков','N = 4 → N = 8, то же движение','амплитуда ЭДС вдвое больше'],
    ['Удвоение частоты','0,50 Гц → 1,00 Гц','амплитуда ЭДС вдвое больше'],
    ['Переворот полюсов','кнопка «⇄ полюса»','знак ЭДС меняется на противоположный'],
    ['Правило Ленца','магнит приближается','катушка отталкивает; удаляется — притягивает']
  ]
};

const norm = s => s.toLowerCase().replace(/\s+/g,' ').replace(/ё/g,'е').trim();
const q = s => '"' + String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"') + '"';

function questionsOf(body){
  const m = body.match(/##\s*Вопросы для самопроверки([\s\S]*?)(?=\n##\s|$)/);
  if(!m) return [];
  return m[1].split(/\r?\n/).filter(l => /^\s*[-*]\s+/.test(l))
    .map(l => l.replace(/^\s*[-*]\s+/,'').trim()).filter(Boolean);
}

/* Читает существующие пары q/a из frontmatter */
function readAnswers(fm){
  const lines = fm.split(/\r?\n/);
  const out = []; let inBlock = false, cur = null;
  for(const line of lines){
    if(/^answers\s*:/.test(line)){ inBlock = true; continue; }
    if(inBlock){
      if(/^\S/.test(line)) break;
      const mq = line.match(/^\s*-\s*q\s*:\s*(.+)$/);
      const ma = line.match(/^\s*a\s*:\s*(.+)$/);
      if(mq){ if(cur) out.push(cur); try{ cur = { q: JSON.parse(mq[1]), a:'' }; }catch{ cur = null; } }
      else if(ma && cur){ try{ cur.a = JSON.parse(ma[1]); }catch{} }
    }
  }
  if(cur) out.push(cur);
  return out.filter(x => x.q && x.a);
}

function readCheckpoints(fm){
  const lines = fm.split(/\r?\n/);
  const out = []; let inBlock = false, cur = null;
  for(const line of lines){
    if(/^checkpoints\s*:/.test(line)){ inBlock = true; continue; }
    if(inBlock){
      if(/^\S/.test(line)) break;
      const mn = line.match(/^\s*-\s*name\s*:\s*(.+)$/);
      const ms = line.match(/^\s*setup\s*:\s*(.+)$/);
      const me = line.match(/^\s*expected\s*:\s*(.+)$/);
      if(mn){ if(cur) out.push(cur); try{ cur = { name: JSON.parse(mn[1]), setup:'', expected:'' }; }catch{ cur = null; } }
      else if(ms && cur){ try{ cur.setup = JSON.parse(ms[1]); }catch{} }
      else if(me && cur){ try{ cur.expected = JSON.parse(me[1]); }catch{} }
    }
  }
  if(cur) out.push(cur);
  return out.filter(x => x.name && x.expected);
}

function stripBlocks(fm){
  const out = []; let skip = false;
  for(const line of fm.split(/\r?\n/)){
    if(/^(answers|checkpoints)\s*:/.test(line)){ skip = true; continue; }
    if(skip){
      if(/^\S/.test(line)) skip = false;
      else continue;
    }
    out.push(line);
  }
  while(out.length && out[out.length-1].trim()==='') out.pop();
  return out;
}

let changed = 0; const left = [];
for(const f of readdirSync(DIR).filter(x => x.endsWith('.md'))){
  const slug = f.replace(/\.md$/,'');
  const p = join(DIR,f);
  const orig = readFileSync(p,'utf8');
  const mm = orig.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if(!mm){ console.log('[?] '+f+' — нет frontmatter'); continue; }
  const eol = orig.includes('\r\n') ? '\r\n' : '\n';
  const fm = mm[1], body = orig.slice(mm[0].length);

  const have = readAnswers(fm);
  const byQ = new Map(have.map(x => [norm(x.q), x.a]));
  const extra = EXTRA[slug] || [];
  const qs = questionsOf(body);
  const pairs = [];
  for(const question of qs){
    const nq = norm(question);
    let a = byQ.get(nq);
    if(!a){ const hit = extra.find(([k]) => nq.includes(norm(k))); if(hit) a = hit[1]; }
    if(a) pairs.push({ q: question, a });
    else left.push(slug + ': ' + question.slice(0,72));
  }

  let cps = readCheckpoints(fm);
  if(!cps.length && CPS[slug]) cps = CPS[slug].map(([name,setup,expected]) => ({name,setup,expected}));

  const lines = stripBlocks(fm);
  if(pairs.length){
    lines.push('answers:');
    for(const it of pairs) lines.push('  - q: ' + q(it.q), '    a: ' + q(it.a));
  }
  if(cps.length){
    lines.push('checkpoints:');
    for(const c of cps) lines.push('  - name: ' + q(c.name), '    setup: ' + q(c.setup), '    expected: ' + q(c.expected));
  }
  const out = '---' + eol + lines.join(eol) + eol + '---' + eol + body;
  if(out !== orig){
    changed++;
    if(!dry) writeFileSync(p, out, 'utf8');
    console.log((dry?'[dry] ':'[fix] ')+f.padEnd(26)+' → ответов '+pairs.length+'/'+qs.length+', точек '+cps.length);
  } else console.log('[ok ] '+f);
}
console.log('\n'+(dry?'Будет изменено':'Изменено')+' файлов: '+changed);
if(left.length){ console.log('\nОстались без ответа ('+left.length+'):'); left.forEach(x => console.log('  '+x)); }
else console.log('Все вопросы самопроверки имеют ответы.');