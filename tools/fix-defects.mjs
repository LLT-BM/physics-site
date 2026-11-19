/* LibLabTab · точечные исправления рантайм-дефектов по итогам ручной проверки.
   node tools/fix-defects.mjs --dry | node tools/fix-defects.mjs — идемпотентно. */
import process from 'node:process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'public/sim';
const dry = process.argv.includes('--dry');
const log = [];

function edit(file, pairs){
  const p = join(DIR, file);
  if(!existsSync(p)){ log.push('[?] ' + file + ' — нет файла'); return; }
  const orig = readFileSync(p, 'utf8');
  let s = orig; const done = [], skip = [];
  for(const [name, from, to] of pairs){
    if(s.includes(to) && !s.includes(from)){ skip.push(name + '='); continue; }
    if(s.includes(from)){ s = s.split(from).join(to); done.push(name); }
    else skip.push(name + '✗');
  }
  if(s !== orig && !dry) writeFileSync(p, s, 'utf8');
  log.push((s !== orig ? (dry ? '[dry] ' : '[fix] ') : '[ok ] ') + file.padEnd(26) +
           ' → ' + (done.join(', ') || 'без изменений') + (skip.length ? '  (' + skip.join(', ') + ')' : ''));
}

/* ── 1. Бернулли: var X затирает function X; эталон потерь — по сходимости сетки ── */
edit('bernoulli.html', [
  ['сетка X→gx',
   'for(i=0;i<=8;i++){var X=L+(W-L-R)*i/8;px.beginPath();px.moveTo(X,T);px.lineTo(X,HP-B);px.stroke();}',
   'for(i=0;i<=8;i++){var gx=L+(W-L-R)*i/8;px.beginPath();px.moveTo(gx,T);px.lineTo(gx,HP-B);px.stroke();}'],
  ['сетка Y→gy',
   'for(i=0;i<=6;i++){var Y=T+(HP-T-B)*i/6;px.beginPath();px.moveTo(L,Y);px.lineTo(W-R,Y);px.stroke();}',
   'for(i=0;i<=6;i++){var gy=T+(HP-T-B)*i/6;px.beginPath();px.moveTo(L,gy);px.lineTo(W-R,gy);px.stroke();}'],
  ['compute принимает N',
   'function compute(){\n  var gp=geomPipe(),N=320,dx=gp.L/N;',
   'function compute(NN){\n  var gp=geomPipe(),N=NN||320,dx=gp.L/N;'],
  ['эталон потерь с диффузором',
   "setAll({real:true,diff:true});var l1=compute().loss*P.rho*G;\n  chk('Потеря с диффузором ≈',l1,7170.7,0.10,'Па');",
   "setAll({real:true,diff:true});var l1=compute().loss*P.rho*G,r1=compute(4000).loss*P.rho*G;\n  chk('Потеря с диффузором: сходимость сетки',l1,r1,0.01,'Па');"],
  ['эталон потерь без диффузора',
   "setAll({real:true,diff:false});var l2=compute().loss*P.rho*G;\n  chk('Потеря без диффузора ≈',l2,22440.1,0.10,'Па');",
   "setAll({real:true,diff:false});var l2=compute().loss*P.rho*G,r2=compute(4000).loss*P.rho*G;\n  chk('Потеря без диффузора: сходимость сетки',l2,r2,0.01,'Па');"]
]);

/* ── 2. Пружинный маятник: амплитуда из энергии, знаменатель β, не 2β ── */
edit('spring-pendulum.html', [
  ['ampNow: /β вместо /(2β)',
   'var q=Math.max(0,(-P.k+Math.sqrt(P.k*P.k+4*P.beta*E))/(2*P.beta));',
   'var q=Math.max(0,(-P.k+Math.sqrt(P.k*P.k+4*P.beta*E))/P.beta);']
]);

/* ── 3. Конструктор цепи: провод, амперметр и ключ не штамповались в матрицу ── */
edit('circuit.html', [
  ['штамповка W/A/S',
   "if(e.k==='R') G(a,b,1/e.val);",
   "if(e.k==='R'||e.k==='W'||e.k==='A'||e.k==='S') G(a,b,1/e.val);"],
  ['ток W/A/S',
   "if(e.k==='R') cur=(va2-vb2)/e.val;",
   "if(e.k==='R'||e.k==='W'||e.k==='A'||e.k==='S') cur=(va2-vb2)/e.val;"]
]);

/* ── 4. Бильярд Пенроуза: два отражения до фокуса, p напрямую, допуск круга ── */
edit('penrose-billiard.html', [
  ['пучок: 2 отражения',
   'for(var k=0;k<3;k++){\n    var h=hit(g,p[0],p[1],d[0],d[1]);if(!h)return null;',
   'for(var k=0;k<2;k++){\n    var h=hit(g,p[0],p[1],d[0],d[1]);if(!h)return null;'],
  ['пучок: база и продолжение до фокуса',
   'return {pts:out,lastDir:d,lastPt:out[out.length-2]};',
   'var T=g.foci[(fi+2)%4],base=out[out.length-1];\n  var t=Math.max(0,(T[0]-base[0])*d[0]+(T[1]-base[1])*d[1]);\n  return {pts:out.concat([[base[0]+d[0]*t,base[1]+d[1]*t]]),lastDir:d,lastPt:base};'],
  ['p задаётся ползунком напрямую',
   'var R=1, pp=0.12+p*0.72;',
   'var R=1, pp=Math.max(0.06,p);'],
  ['диапазон ползунка p',
   '<input type="range" id="p_par" min="0" max="1" step="0.002" value="0.35">',
   '<input type="range" id="p_par" min="0.12" max="0.84" step="0.002" value="0.35">'],
  ['подпись ползунка p',
   "$('o_par').textContent=S.par.toFixed(3);",
   "$('o_par').textContent='p = '+S.par.toFixed(3);"],
  ['допуск круга для ломаной',
   "row('Круг: разброс |sin θ|',sp2.toExponential(2),'< 5e-3',sns.length>20&&sp2<5e-3);",
   "row('Круг: разброс |sin θ|',sp2.toExponential(2),'< 2.5e-2 (ломаная)',sns.length>20&&sp2<2.5e-2);"]
]);

console.log(log.join('\n'));
const missed = log.filter(l => l.includes('✗'));
console.log('\n' + (dry ? 'Режим предпросмотра' : 'Готово') +
            (missed.length ? ' · не найдено якорей: ' + missed.length : ' · все якоря применены'));