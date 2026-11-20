/* LibLabTab · единый каркас во всех симуляциях.
   Правит resize на контейнерный, снимает прошлые отключения, размечает панели.
   node tools/apply-layout.mjs --dry | node tools/apply-layout.mjs */
import process from 'node:process';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR='public/sim';
const dry=process.argv.includes('--dry');
if(!existsSync(join(DIR,'lib/layout.css'))||!existsSync(join(DIR,'lib/layout.js'))){
  console.log('Сначала создайте public/sim/lib/layout.css и layout.js'); process.exit(1);
}

const BASIC={
  'bernoulli.html':['Жидкость','Труба','Бак и отверстие'],
  'circuit.html':['Источник','Участки цепи'],
  'life.html':['Фигуры'],
  'scale.html':['Найти объект'],
  'math-pendulum.html':['Маятник','Гравитация'],
  'spring-pendulum.html':['Пружина и груз'],
  'atomic-interactions.html':['Пара частиц'],
  'penrose-billiard.html':['Полость','Лучи'],
  'lens.html':['Предмет','Линза','Экран'],
  'lever.html':['Грузы','Параметры','Рычаг'],
  'pendulum.html':['Исходное состояние'],
  'atom.html':[],
  'lenz.html':[]
};

/* resize от окна → resize от контейнера сцены */
function patchResize(src){
  const m=/function\s+resize\s*\([^)]*\)\s*\{/.exec(src);
  if(!m) return {src,changed:false};
  const start=m.index+m[0].length;
  let depth=1,i=start;
  while(i<src.length&&depth>0){const c=src[i];if(c==='{')depth++;else if(c==='}')depth--;i++;}
  const body=src.slice(start,i-1);
  if(!/\binnerWidth\b|\binnerHeight\b/.test(body)) return {src,changed:false};
  const head="\n  const __r=(document.querySelector('[data-llt-stage]')||document.querySelector('canvas')).getBoundingClientRect();\n";
  const nb=(head+body)
    .replace(/window\.innerWidth/g,'Math.round(__r.width)')
    .replace(/window\.innerHeight/g,'Math.round(__r.height)')
    .replace(/\binnerWidth\b/g,'Math.round(__r.width)')
    .replace(/\binnerHeight\b/g,'Math.round(__r.height)');
  return {src:src.slice(0,start)+nb+src.slice(i-1),changed:true};
}

let changed=0,total=0;
for(const f of readdirSync(DIR).filter(x=>x.toLowerCase().endsWith('.html'))){
  const p=join(DIR,f);
  const orig=readFileSync(p,'utf8'); total++;
  const eol=orig.includes('\r\n')?'\r\n':'\n';
  let s=orig; const acts=[];

  if(/\/sim\/lib\/ui\.js/.test(s)){
    s=s.replace(/<script src="\/sim\/lib\/ui\.js"><\/script>/i,'<script src="/sim/lib/layout.js"></script>');
    acts.push('ui.js → layout.js');
  } else if(!/\/sim\/lib\/layout\.js/.test(s)){
    s=s.replace(/<\/head>/i,'  <script src="/sim/lib/layout.js"></script>'+eol+'</head>');
    acts.push('layout.js подключён');
  }

  for(const tag of ['data-llt-lenz','data-llt-slider']){
    const re=new RegExp('[ \\t]*<style '+tag+'>[\\s\\S]*?</style>\\s*','i');
    if(re.test(s)){ s=s.replace(re,''); acts.push('убран <style '+tag+'>'); }
  }

  if(!/\/sim\/lib\/layout\.css/.test(s)){
    s=s.replace(/<\/head>/i,'  <link rel="stylesheet" href="/sim/lib/layout.css">'+eol+'</head>');
    acts.push('layout.css подключён');
  }

  if(!/data-llt-stage/.test(s)){
    let done=false;
    s=s.replace(/<canvas\b([^>]*)>/i,(m,a)=>{done=true;return '<canvas data-llt-stage="1"'+a+'>';});
    if(!done) s=s.replace(/<svg\b([^>]*)>/i,(m,a)=>'<svg data-llt-stage="1"'+a+'>');
    acts.push('сцена помечена');
  }

  const fixedCss=/(#scene|canvas)\s*\{[^}]*position\s*:\s*fixed/i.test(s);
  if(fixedCss && !/data-llt-fixed/.test(s)){
    s=s.replace(/<canvas\b([^>]*)>/i,(m,a)=>'<canvas data-llt-fixed="1"'+a+'>');
    acts.push('сцена fixed');
  }

  const r=patchResize(s);
  if(r.changed){ s=r.src; acts.push('resize переведён на контейнер'); }

  if(/data-llt-layout\s*=\s*["']off["']/.test(s)){
    const rectNow=/function\s+resize[\s\S]{0,900}?getBoundingClientRect/.test(s);
    if(rectNow){ s=s.replace(/\s*data-llt-layout\s*=\s*["']off["']/i,''); acts.push('каркас снова включён'); }
  }

  const basic=BASIC[f];
  if(basic && basic.length){
    let marked=0;
    s=s.replace(/<section\b([^>]*)>(\s*<h2[^>]*>)([\s\S]*?)(<\/h2>)/gi,(m,attrs,open,title,close)=>{
      if(/data-level=/.test(attrs)) return m;
      const name=title.replace(/<[^>]*>/g,'').trim();
      const lv=basic.some(b=>name.toLowerCase().startsWith(b.toLowerCase()))?'basic':'adv';
      marked++;
      return '<section'+attrs+' data-level="'+lv+'">'+open+title+close;
    });
    if(marked) acts.push('панелей размечено: '+marked);
  }

  let n=0;
  s=s.replace(/<canvas\b([^>]*)>/gi,(m,a)=>{
    n++;
    return (n>1 && !/data-llt-plot/.test(a)) ? '<canvas data-llt-plot="1"'+a+'>' : m;
  });

  if(s!==orig){ changed++; if(!dry) writeFileSync(p,s,'utf8');
    console.log((dry?'[dry] ':'[fix] ')+f.padEnd(26)+' → '+acts.join(', ')); }
  else console.log('[ok ] '+f);
}
console.log('\n'+(dry?'Будет изменено':'Изменено')+' файлов: '+changed+' из '+total);