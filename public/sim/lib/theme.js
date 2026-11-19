/* LibLabTab · тема: localStorage → prefers-color-scheme → postMessage с родителем.
   Экспортирует window.LLTtheme и window.PAL (цвета для canvas). */
(function(){
  'use strict';
  if(window.LLTtheme) return;
  var KEY='llt-theme';
  var KEYS=['bg','surface','overlay','canvas','ink','muted','line','line2',
            'aqua','sand','lilac','rose','ok','deep','brass','ice','on','scrim'];
  var FALLBACK={bg:'#0A1417',surface:'#102024',overlay:'#14262A',canvas:'#071012',
    ink:'#E9F4F1',muted:'#8FA8A6',line:'rgba(126,214,199,.16)',line2:'rgba(126,214,199,.30)',
    aqua:'#4FD8C4',sand:'#D9B98C',lilac:'#ABA6DC',rose:'#D69FA9',ok:'#3FC9AE',
    deep:'#2E9E96',brass:'#C9A96E',ice:'#9FE8DC',on:'#06110F',scrim:'rgba(6,17,15,.72)'};
  var PAL={}; window.PAL=PAL;

  function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
  function system(){ try{ return matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'; }catch(e){ return 'dark'; } }

  function readPal(){
    var cs=getComputedStyle(document.documentElement);
    KEYS.forEach(function(k){
      var v=(cs.getPropertyValue('--'+k)||'').trim();
      PAL[k]=v||FALLBACK[k];
    });
    PAL.cyan=PAL.aqua; PAL.amber=PAL.sand; PAL.pink=PAL.lilac; PAL.warn=PAL.rose;
    PAL.mut=PAL.muted; PAL.panel=PAL.surface; PAL.grid=PAL.line; PAL.acc=PAL.aqua;
    return PAL;
  }

  function apply(t,announce){
    document.documentElement.setAttribute('data-theme',t);
    readPal();
    var b=document.getElementById('lltThemeBtn');
    if(b){ b.textContent = t==='light' ? '☾ Тёмная' : '☀ Светлая';
           b.setAttribute('aria-label', t==='light'?'Включить тёмную тему':'Включить светлую тему'); }
    window.dispatchEvent(new CustomEvent('llt:theme',{detail:{theme:t,pal:PAL}}));
    if(announce){
      try{ if(parent!==window) parent.postMessage({llt:'theme',theme:t},'*'); }catch(e){}
    }
  }

  function set(t,announce){ store(KEY,t); apply(t,announce!==false); }
  function toggle(){ set(document.documentElement.getAttribute('data-theme')==='light'?'dark':'light'); }

  function mountButton(){
    if(document.getElementById('lltThemeBtn')||!document.body) return;
    var b=document.createElement('button');
    b.id='lltThemeBtn'; b.type='button'; b.className='llt-theme-btn';
    b.addEventListener('click',toggle);
    document.body.appendChild(b);
  }

  window.LLTtheme={ set:set, toggle:toggle, readPal:readPal, pal:PAL,
    get:function(){ return document.documentElement.getAttribute('data-theme')||'dark'; } };

  /* Начальная тема: сохранённая → системная. Ставится до первой отрисовки. */
  apply(store(KEY)||system(),false);

  /* Родитель присылает тему — подчиняемся, чтобы страница и iframe совпадали. */
  window.addEventListener('message',function(e){
    var d=e.data; if(!d||d.llt!=='theme-set') return;
    if(d.theme==='light'||d.theme==='dark'){ store(KEY,d.theme); apply(d.theme,false); }
  });
  try{
    matchMedia('(prefers-color-scheme: light)').addEventListener('change',function(){
      if(!store(KEY)) apply(system(),false);
    });
  }catch(e){}

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ mountButton(); apply(LLTtheme.get(),false); });
  else { mountButton(); apply(LLTtheme.get(),false); }

  /* Просим родителя прислать актуальную тему */
  try{ if(parent!==window) parent.postMessage({llt:'theme-ask'},'*'); }catch(e){}
})();