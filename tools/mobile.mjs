/* LibLabTab · мобильный слой во все симуляции.
   node tools/mobile.mjs --dry | node tools/mobile.mjs — идемпотентно. */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR='public/sim';
const dry=process.argv.includes('--dry');
const need=['lib/mobile.css','lib/touch.js'];
for(const f of need) if(!existsSync(join(DIR,f))){ console.log('Сначала создайте public/sim/'+f); process.exit(1); }

const LINK='<link rel="stylesheet" href="/sim/lib/mobile.css">';
const SCRIPT='<script src="/sim/lib/touch.js"></script>';
let changed=0,total=0;

for(const f of readdirSync(DIR).filter(x=>x.toLowerCase().endsWith('.html'))){
  const p=join(DIR,f); const orig=readFileSync(p,'utf8'); total++;
  const eol=orig.includes('\r\n')?'\r\n':'\n';
  let s=orig; const acts=[];

  /* mobile.css — последним в head, чтобы перебить прежние правила */
  if(!/\/sim\/lib\/mobile\.css/.test(s)){
    if(/<\/head>/i.test(s)){ s=s.replace(/<\/head>/i,'  '+LINK+eol+'</head>'); }
    else s=LINK+eol+s;
    acts.push('mobile.css');
  }
  /* touch.js — сразу после theme.js, до основного скрипта модели */
  if(!/\/sim\/lib\/touch\.js/.test(s)){
    if(/<script src="\/sim\/lib\/theme\.js"><\/script>/i.test(s)){
      s=s.replace(/<script src="\/sim\/lib\/theme\.js"><\/script>/i, m=>m+eol+SCRIPT);
    } else if(/<script src="\/sim\/guard\.js"><\/script>/i.test(s)){
      s=s.replace(/<script src="\/sim\/guard\.js"><\/script>/i, m=>m+eol+SCRIPT);
    } else if(/<\/head>/i.test(s)){
      s=s.replace(/<\/head>/i,'  '+SCRIPT+eol+'</head>');
    } else s=SCRIPT+eol+s;
    acts.push('touch.js');
  }
  /* viewport-fit=cover */
  if(/name=["']viewport["']/i.test(s) && !/viewport-fit/i.test(s)){
    s=s.replace(/(<meta[^>]*name=["']viewport["'][^>]*content=["'])([^"']*)(["'])/i,
      (m,a,c,z)=>a+c+', viewport-fit=cover'+z);
    acts.push('viewport-fit');
  }
  /* поля ввода не должны зумить iOS */
  if(!/data-llt-ios/.test(s)){
    s=s.replace(/<\/head>/i,'  <style data-llt-ios>input,select,textarea{font-size:16px}</style>'+eol+'</head>');
    acts.push('поля 16px');
  }
  /* жёсткий overflow:hidden ломает прокрутку на телефоне (lenz) */
  if(/html\s*,\s*body\s*\{[^}]*overflow\s*:\s*hidden/i.test(s)){
    s=s.replace(/(html\s*,\s*body\s*\{[^}]*?)overflow\s*:\s*hidden/gi,'$1overflow:visible');
    acts.push('снят overflow:hidden');
  }

  if(s!==orig){ changed++; if(!dry) writeFileSync(p,s,'utf8');
    console.log((dry?'[dry] ':'[fix] ')+f+' → '+acts.join(', ')); }
  else console.log('[ok ] '+f);
}
console.log('');
console.log((dry?'Будет изменено':'Изменено')+' файлов: '+changed+' из '+total);