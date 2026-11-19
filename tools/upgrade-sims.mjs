/* LibLabTab · внедрение общей библиотеки в существующие симуляции.
   Запуск:  node tools/upgrade-sims.mjs --dry
            node tools/upgrade-sims.mjs
   Идемпотентен. */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR='public/sim';
const MAP={
  'atom.html':'atom-model','atomic-interactions.html':'atomic-interactions',
  'bernoulli.html':'bernoulli','circuit.html':'circuit-lab','lens.html':'lens-image',
  'lenz.html':'lenz-law','lever.html':'lever-moments','life.html':'life-game',
  'math-pendulum.html':'math-pendulum','pendulum.html':'double-pendulum',
  'penrose-billiard.html':'penrose-billiard','scale.html':'scale-of-universe',
  'spring-pendulum.html':'spring-pendulum'
};
/* Точные цветовые литералы → ключ палитры. Только полные совпадения в кавычках. */
const HEX={
  '#4FD8C4':'aqua','#5fe0ff':'aqua','#54e8ff':'aqua','#3FC9AE':'ok','#4cc58d':'ok',
  '#D9B98C':'sand','#ffb454':'sand','#D8B98C':'sand','#C9A96E':'brass','#B08A5C':'brass',
  '#ABA6DC':'lilac','#ff7ab6':'lilac','#D69FA9':'rose','#ff7a6e':'rose',
  '#E9F4F1':'ink','#eaf3fa':'ink','#EAF3FA':'ink','#EAFAF6':'ink',
  '#8FA8A6':'muted','#8ba3b8':'muted','#8FA8A6':'muted',
  '#0A1417':'bg','#070c15':'bg','#102024':'surface','#0d1626':'surface',
  '#071012':'canvas','#05080f':'canvas','#14262A':'overlay','#9FE8DC':'ice','#2E9E96':'deep'
};
const dry=process.argv.includes('--dry');
if(!existsSync(DIR)){ console.log('Нет '+DIR); process.exit(1); }
for(const f of ['lib/theme.css','lib/theme.js','lib/fmt.js','lib/ui.js','lib/loop.js','guard.js']){
  if(!existsSync(join(DIR,f))){ console.log('Сначала создайте public/sim/'+f); process.exit(1); }
}

let changed=0,total=0;
for(const f of readdirSync(DIR).filter(x=>x.toLowerCase().endsWith('.html'))){
  if(!MAP[f]){ console.log('[?] '+f+' — нет в MAP'); continue; }
  const p=join(DIR,f); const orig=readFileSync(p,'utf8'); total++;
  const eol=orig.includes('\r\n')?'\r\n':'\n';
  let s=orig; const acts=[];

  /* 1. Библиотека в <head>: тема первой, затем остальное. */
  const HEAD=[
    '<link rel="stylesheet" href="/sim/lib/theme.css">',
    '<script src="/sim/lib/theme.js"></script>',
    '<script src="/sim/lib/fmt.js"></script>',
    '<script src="/sim/lib/loop.js"></script>',
    '<script>window.LLT_OPTS={slug:"'+MAP[f]+'"};</script>',
    '<script src="/sim/lib/ui.js"></script>'
  ].join(eol);
  if(!/\/sim\/lib\/theme\.js/.test(s)){
    if(/<\/head>/i.test(s)){ s=s.replace(/<\/head>/i,'  '+HEAD+eol+'</head>'); acts.push('библиотека в head'); }
    else { s=HEAD+eol+s; acts.push('библиотека в начало файла'); }
  }

  /* 2. Старый :root больше не задаёт цвета — оставляем только не-цветные свойства. */
  if(!/data-llt-tokens/.test(s)){
    s=s.replace(/:root\s*\{([^}]*)\}/g,(m,body)=>{
      if(!/--(bg|ink|cyan|aqua|surface|amber|sand)\s*:/.test(body)) return m;
      const kept=body.split(';').filter(d=>{
        const k=(d.split(':')[0]||'').trim();
        return k && !/^--/.test(k);           /* box-sizing, padding и прочее */
      }).join(';').trim();
      return '/* data-llt-tokens: цвета перенесены в /sim/lib/theme.css */'+eol+
             ':root{'+(kept?kept+';':'')+'}';
    });
    acts.push('цвета из :root убраны');
  }

  /* 3. Цветовые литералы в JS → палитра темы. */
  let hits=0;
  for(const [hex,key] of Object.entries(HEX)){
    const re=new RegExp("(['\"])"+hex.replace('#','#')+"\\1",'gi');
    s=s.replace(re,()=>{ hits++; return 'PAL.'+key; });
  }
  if(hits) acts.push('canvas-цветов на палитру: '+hits);

  /* 4. Подписка на смену темы: перерисовать палитру и кадр. */
  if(!/llt:theme/.test(s)){
    const SUB=[
      '<script>',
      '/* LibLabTab · перекраска при смене темы */',
      '(function(){',
      '  function refresh(){',
      '    if(window.LLTtheme) window.LLTtheme.readPal();',
      '    if(typeof readPal==="function"){ try{ readPal(); }catch(e){} }',
      '    if(typeof resize==="function"){ try{ resize(); }catch(e){} }',
      '    if(typeof drawGridCache==="function"){ try{ drawGridCache(); }catch(e){} }',
      '    if(typeof render==="function"){ try{ render(); }catch(e){} }',
      '    if(typeof draw==="function"){ try{ draw(); }catch(e){} }',
      '  }',
      '  window.addEventListener("llt:theme",refresh);',
      '})();',
      '</script>'
    ].join(eol);
    s=s.replace(/<\/body>/i,SUB+eol+'</body>');
    acts.push('подписка на смену темы');
  }

  /* 5. Единый вывод чисел: локальные nf → LLTfmt.nf. */
  const NF=/function nf\((\w+),(\w+)\)\{[^}]*toFixed\(\2\)\.replace\('\.',','\)[^}]*\}/;
  if(NF.test(s)){
    s=s.replace(NF,(m,a,b)=>'function nf('+a+','+b+'){ return window.LLTfmt?LLTfmt.nf('+a+','+b+'):(isFinite('+a+')?'+a+'.toFixed('+b+').replace(".",","):"—"); }');
    acts.push('nf → ru-RU');
  }

  /* 6. viewport-fit=cover всем. */
  if(/name=["']viewport["']/.test(s)&&!/viewport-fit=cover/.test(s)){
    s=s.replace(/(<meta[^>]*name=["']viewport["'][^>]*content=["'])([^"']*)(["'])/i,
      (m,a,c,z)=>a+(/viewport-fit/.test(c)?c:c+', viewport-fit=cover')+z);
    acts.push('viewport-fit=cover');
  }

  if(s!==orig){ changed++; if(!dry) writeFileSync(p,s,'utf8');
    console.log((dry?'[dry] ':'[fix] ')+f+' → '+acts.join(', ')); }
  else console.log('[ok ] '+f);
}
console.log('');
console.log((dry?'Будет изменено':'Изменено')+' файлов: '+changed+' из '+total);