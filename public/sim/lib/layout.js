/* LibLabTab · каркас модели: сцена слева, две сворачиваемые секции справа.
   Соседние служебные canvas переезжают вместе со сценой; таблицы — вместе с
   прокручиваемой обёрткой; всё фиксированное внутри каркаса становится поточным. */
(function(){
'use strict';
if(window.LLTlayout) return;
window.LLTlayout={version:5};

var OPTS=window.LLT_OPTS||{};
var SLUG=OPTS.slug||location.pathname.split('/').pop()||'sim';
var MAIN_BAR=/Пуск|Пауза|▶|❚❚|Сброс|автоколебания|Применить/i;
var ACTION=/Пуск|Пауза|Стоп|Шаг|Сброс|Сбросить|По умолчанию|Очистить|автоколебания|Применить/i;
var RESET=/Сброс|Сбросить|По умолчанию/i;
var PANEL_SEL='.ctl>*,section.card,.card.grp,.card,.chain,.panel,.panels,.side,.sidebar,'+
              '.dock,.info,.tabs,.orbs,.row,.actions,.btns,fieldset,[data-llt-panel]';
var KEEP=/^(SCRIPT|LINK|STYLE|TEMPLATE|NOSCRIPT)$/;
var DECOR=/(^|\s)(bg|vig|corner|backdrop|scrim|offscreen|sr|cmt-hp)(\s|$)/;

function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}
function el(t,c,x){var n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n;}
function arr(l){return Array.prototype.slice.call(l);}
function uniq(l){var s=new Set();return l.filter(function(n){return n&&!s.has(n)&&(s.add(n),true);});}
function outermost(l){return l.filter(function(n){return !l.some(function(m){return m!==n&&m.contains(n);});});}
function txt(n){return (n&&n.textContent||'').replace(/\s+/g,' ').trim();}
function cls(n){return typeof n.className==='string'?n.className:'';}
function controls(n){return !!n.querySelector('input,select,textarea');}
function decor(n){return DECOR.test(cls(n))||n.getAttribute('aria-hidden')==='true';}
function ink(n){
  if(n.querySelector('canvas,svg,img,iframe,input,select,textarea,button,table tbody tr,details,summary'))return true;
  return txt(n).length>0;
}

var shell=null,barWrap=null,stageWrap=null,tidyTimer=null;
function movable(n){
  return n&&n.nodeType===1&&n!==document.body&&n!==document.documentElement&&
         n!==shell&&!(shell&&n.contains(shell))&&!!n.parentNode;
}
function move(n,t){
  if(!movable(n)||!t||n===t||n.contains(t))return false;
  try{t.appendChild(n);return true;}catch(e){return false;}
}
function injectCss(){
  if(document.getElementById('llt-layout-css'))return;
  var s=el('style');s.id='llt-layout-css';
  s.textContent=
    '.llt-shell .panel,.llt-shell .panels,.llt-shell .gchip,.llt-shell .dock,'+
    '.llt-shell .side,.llt-shell .sidebar,.llt-shell .hud,.llt-shell .chain,'+
    '.llt-shell .controls,.llt-shell .row,.llt-shell .note,.llt-shell .note2,'+
    '.llt-shell .fnote,.llt-shell .hint,.llt-shell .legend,.llt-shell .eq,'+
    '.llt-shell header,.llt-shell footer{position:static !important;inset:auto !important;'+
      'transform:none !important;left:auto !important;right:auto !important;top:auto !important;'+
      'bottom:auto !important;width:auto !important;max-width:100% !important;margin:0 !important;'+
      'clip-path:none !important}'+
    '.llt-stage .hud{position:absolute !important;left:12px !important;top:12px !important;width:auto !important}'+
    '.llt-stage .prog{position:absolute !important;left:12px !important;right:12px !important;bottom:12px !important}'+
    '.llt-shell .info{display:grid !important;grid-template-columns:1fr !important;gap:10px}'+
    '.llt-shell .tw,.llt-shell .tablewrap{overflow-x:auto;max-width:100%;-webkit-overflow-scrolling:touch}'+
    '.llt-shell table{max-width:none}'+
    '.llt-bar button{min-height:44px}'+
    '.llt-bar .llt-reset{border-color:var(--rose);color:var(--rose)}'+
    '.llt-sec-body table:empty,.llt-sec-body tbody:empty{display:none !important}';
  document.head.appendChild(s);
}
function forceStatic(){
  if(!shell)return;
  arr(shell.querySelectorAll('*')).forEach(function(n){
    if(decor(n)||n.closest('.llt-stage .hud')||n.closest('.prog'))return;
    var cs=getComputedStyle(n);
    if(cs.position==='fixed'||cs.position==='absolute'){
      if(n.closest('.llt-stage')&&/^(CANVAS|SVG)$/.test(n.tagName))return;
      if(n.closest('.hud')||n.closest('.prog'))return;
      if(cs.position==='fixed'){
        n.style.setProperty('position','static','important');
        n.style.setProperty('inset','auto','important');
        n.style.setProperty('transform','none','important');
        n.style.setProperty('width','auto','important');
        n.style.setProperty('max-width','100%','important');
        n.style.setProperty('margin','0','important');
      }
    }
  });
}
function tidy(){
  if(!shell)return;
  forceStatic();
  arr(shell.querySelectorAll('.llt-sec')).forEach(function(d){
    var b=d.querySelector('.llt-sec-body');if(!b)return;
    var live=arr(b.children).some(ink);
    d.classList.toggle('llt-empty',!live);
    var n=d.querySelector('.llt-sec-n');
    if(n)n.textContent=arr(b.children).filter(ink).length;
  });
  arr(shell.querySelectorAll('.llt-bar,.llt-read,.llt-status,.llt-pagehead')).forEach(function(n){
    n.classList.toggle('llt-empty',!ink(n));
  });
  arr(shell.querySelectorAll('.llt-sec-body .bar,.llt-sec-body .row,.llt-sec-body .actions,.llt-sec-body .rd,.llt-sec-body .stats,.llt-sec-body .tw')).forEach(function(n){
    if(!ink(n))n.style.display='none';
  });
  if(stageWrap){
    var many=stageWrap.querySelectorAll('canvas,svg').length>1;
    var c=stageWrap.querySelector('[data-llt-stage]');
    if(!c||many||c.getAttribute('data-llt-fixed')==='1') stageWrap.style.height='';
    else{
      var h=Math.round(c.getBoundingClientRect().height);
      stageWrap.style.height=h>60?h+'px':'';
    }
  }
}
function queueTidy(){clearTimeout(tidyTimer);tidyTimer=setTimeout(tidy,80);}

function build(){
  if(document.body.getAttribute('data-llt-layout')==='off')return;
  var stage=document.querySelector('[data-llt-stage]')||document.querySelector('canvas')||
            document.querySelector('svg.scene')||document.getElementById('svg');
  if(!stage||stage===document.body)return;

  var origin=document.querySelector('.wrap')||document.body;
  var stageParent=stage.parentElement;
  var mates=stageParent?arr(stageParent.querySelectorAll('canvas:not([data-llt-stage]),svg:not([data-llt-stage])')):[];
  var box=stage.closest('.stagebox,.holder');
  if(!box||box===document.body||box===origin||box.contains(origin)||controls(box))box=stage;

  injectCss();
  document.body.classList.add('llt-layout');
  shell=el('div','llt-shell');
  var main=el('main','llt-main');
  var side=el('aside','llt-side');
  side.setAttribute('aria-label','Настройки модели');

  var q=function(s){return arr(document.querySelectorAll(s));};
  var notStage=function(n){return n!==box&&!n.contains(stage)&&!box.contains(n)&&mates.indexOf(n)<0;};

  var sliders=uniq(q('.spd,[data-llt-slider-group]')).filter(notStage);
  var bars=uniq(q('.bar,.controls,footer.controls,[data-llt-bar]'))
    .filter(function(n){return notStage(n)&&MAIN_BAR.test(txt(n))&&sliders.indexOf(n)<0;});
  var reads=uniq(q('.rd,.meters,.stats,[data-llt-read]')).filter(notStage);
  var statuses=uniq(q('.status,#stat,[data-llt-status]')).filter(notStage);
  var presets=uniq(q('.chips,#presets,#quick,[data-llt-presets]')).filter(notStage);
  var teaching=uniq(q('.steps,.tabs,.orbs,[data-llt-basic]')).filter(notStage);
  var title=document.querySelector('h1');
  var lead=document.querySelector('.lead');
  var pageHead=document.querySelector('header.top,header');

  var head=el('div','llt-head');
  if(title&&movable(title)&&!title.contains(stage)){title.classList.add('llt-title');head.appendChild(title);}
  head.appendChild(el('span','llt-spacer'));
  var back=el('a','llt-btn','← к описанию');back.href='/models/'+SLUG+'/';head.appendChild(back);
  var toggle=el('button','llt-btn','⚙ Настройки');toggle.type='button';head.appendChild(toggle);
  main.appendChild(head);

  stageWrap=el('div','llt-stage');
  if(!move(box,stageWrap)){document.body.classList.remove('llt-layout');shell=null;stageWrap=null;return;}
  mates.forEach(function(n){move(n,stageWrap);});
  main.appendChild(stageWrap);
  if(pageHead&&pageHead!==title&&notStage(pageHead)){pageHead.classList.add('llt-pagehead');move(pageHead,main);}

  barWrap=el('div','llt-bar');
  barWrap.setAttribute('role','toolbar');
  barWrap.setAttribute('aria-label','Управление моделью');
  bars=outermost(bars);
  bars.forEach(function(n){move(n,barWrap);});

  function lift(){
    q('button,[role="button"]').forEach(function(b){
      if(!movable(b)||b.contains(stage))return;
      if(barWrap.contains(b)||head.contains(b))return;
      if(b.closest('.chips')||b.closest('.llt-side-head')||b.closest('.cmt'))return;
      if(!ACTION.test(txt(b)))return;
      move(b,barWrap);
    });
  }
  lift();
  if(!arr(barWrap.querySelectorAll('button')).some(function(b){return RESET.test(txt(b));})){
    var rb=el('button','llt-btn llt-reset','⟲ Сброс');rb.type='button';rb.id='lltReset';
    rb.addEventListener('click',function(){
      var names=['resetSim','resetAll','doReset','resetScene','reset','restart'];
      for(var i=0;i<names.length;i++)if(typeof window[names[i]]==='function'){try{window[names[i]]();return;}catch(e){}}
      location.reload();
    });
    barWrap.appendChild(rb);
  }
  if(barWrap.children.length)main.appendChild(barWrap);

  reads=outermost(reads).filter(function(n){return !bars.some(function(b){return b.contains(n);});});
  if(reads.length){var read=el('div','llt-read');reads.forEach(function(n){move(n,read);});if(read.children.length)main.appendChild(read);}
  if(statuses.length){var st=el('div','llt-status');statuses.forEach(function(n){move(n,st);});if(st.children.length)main.appendChild(st);}

  var sideHead=el('div','llt-side-head');
  var expand=el('button','llt-btn','Развернуть всё');expand.type='button';
  var collapse=el('button','llt-btn','Свернуть всё');collapse.type='button';
  sideHead.appendChild(expand);sideHead.appendChild(collapse);
  var themeBtn=document.querySelector('.llt-theme-btn');
  if(themeBtn)move(themeBtn,sideHead);
  side.appendChild(sideHead);

  function section(key,label){
    var d=el('details','llt-sec');d.setAttribute('data-sec',key);
    var s=el('summary','',label);s.appendChild(el('span','llt-sec-n','0'));d.appendChild(s);
    var b=el('div','llt-sec-body');d.appendChild(b);
    var saved=store('llt-sec:'+SLUG+':'+key);
    d.open=saved===null?key==='basic':saved==='1';
    d.addEventListener('toggle',function(){store('llt-sec:'+SLUG+':'+key,d.open?'1':'0');ping();});
    side.appendChild(d);
    return {root:d,body:b};
  }
  var basic=section('basic','Базовые настройки');
  var adv=section('adv','Продвинутые настройки');

  presets.forEach(function(n){move(n,basic.body);});
  teaching.forEach(function(n){move(n,basic.body);});
  sliders.forEach(function(n){move(n,basic.body);});

  var panels=outermost(uniq(q(PANEL_SEL)).filter(function(n){
    return notStage(n)&&movable(n)&&controls(n)&&n!==origin&&
           !bars.some(function(b){return b.contains(n);})&&
           !reads.some(function(r){return r.contains(n);});
  }));
  panels.forEach(function(p,i){
    var lv=p.getAttribute('data-level');
    if(lv!=='basic'&&lv!=='adv'){
      var m=p.querySelector('[data-level]');
      lv=m?m.getAttribute('data-level'):(i===0?'basic':'adv');
    }
    move(p,lv==='basic'?basic.body:adv.body);
  });
  lift();

  var extra=el('div','llt-sec-body'),extraCount=0;
  function toExtra(n){
    if(!movable(n)||n.contains(stage)||stage.contains(n))return;
    if(basic.body.contains(n)||adv.body.contains(n)||main.contains(n))return;
    if(n.closest('.offscreen')||n.closest('.cmt'))return;
    if(decor(n))return;
    if(move(n,extra))extraCount++;
  }
  if(lead&&movable(lead)&&!lead.contains(stage)){if(move(lead,extra))extraCount++;}
  q('table').forEach(function(t){
    var wrap=t.closest('.tw,.tablewrap');
    toExtra(wrap||t);
    if(!wrap&&extra.contains(t)){
      var w=el('div','tw');t.parentNode.insertBefore(w,t);w.appendChild(t);
    }
  });
  q('canvas:not([data-llt-stage]),svg.scene:not([data-llt-stage]),.legend,.eq').forEach(toExtra);
  arr(origin.children).forEach(function(n){
    if(n===shell||KEEP.test(n.tagName))return;
    if(n.id==='fatal'||n.classList.contains('llt-shell')||n.classList.contains('cmt')||
       n.hasAttribute('data-llt-keep')||decor(n))return;
    if(n.contains(stage))return;
    if(!ink(n)){n.style.display='none';return;}
    toExtra(n);
  });
  lift();
  if(extraCount){
    var d=el('details','llt-sec');d.setAttribute('data-sec','extra');
    var s=el('summary','','Графики, таблицы и теория');
    s.appendChild(el('span','llt-sec-n',String(extraCount)));d.appendChild(s);
    d.appendChild(extra);
    d.open=store('llt-sec:'+SLUG+':extra')==='1';
    d.addEventListener('toggle',function(){store('llt-sec:'+SLUG+':extra',d.open?'1':'0');ping();});
    main.appendChild(d);
  }

  shell.appendChild(main);shell.appendChild(side);
  origin.appendChild(shell);

  var off=store('llt-side:'+SLUG)==='1';
  function applyOff(){
    document.body.classList.toggle('llt-side-off',off);
    toggle.setAttribute('aria-pressed',String(!off));
    toggle.textContent=off?'⚙ Показать настройки':'⚙ Скрыть настройки';
    ping();
  }
  toggle.addEventListener('click',function(){off=!off;store('llt-side:'+SLUG,off?'1':'0');applyOff();});
  expand.addEventListener('click',function(){arr(shell.querySelectorAll('details')).forEach(function(d){d.open=true;});ping();});
  collapse.addEventListener('click',function(){arr(shell.querySelectorAll('details')).forEach(function(d){d.open=false;});ping();});

  function paint(){
    arr(document.querySelectorAll('input[type=range]')).forEach(function(r){
      var mn=parseFloat(r.min),mx=parseFloat(r.max),v=parseFloat(r.value);
      var f=(isFinite(mn)&&isFinite(mx)&&mx>mn)?(v-mn)/(mx-mn)*100:0;
      r.style.setProperty('--fill',Math.max(0,Math.min(100,f)).toFixed(2)+'%');
      if(!r.getAttribute('aria-label')){
        var lab=r.closest('label')||document.querySelector('label[for="'+r.id+'"]');
        if(lab)r.setAttribute('aria-label',txt(lab));
      }
    });
  }
  document.addEventListener('input',function(e){if(e.target&&e.target.type==='range')paint();},true);

  var t=null;
  function ping(){
    clearTimeout(t);
    t=setTimeout(function(){
      paint();
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new CustomEvent('llt:layout'));
      queueTidy();
    },60);
  }
  window.LLTlayout.repaint=ping;
  window.LLTlayout.tidy=tidy;

  if(window.ResizeObserver){
    var ro=new ResizeObserver(queueTidy);
    ro.observe(stageWrap);
    arr(stageWrap.querySelectorAll('canvas,svg')).forEach(function(c){ro.observe(c);});
  }
  if(window.MutationObserver){
    var mo=new MutationObserver(function(recs){
      var onlyStage=recs.every(function(r){return stageWrap&&stageWrap.contains(r.target);});
      if(!onlyStage)queueTidy();
    });
    mo.observe(shell,{childList:true,subtree:true,characterData:true});
  }
  applyOff();paint();ping();setTimeout(ping,320);setTimeout(tidy,700);setTimeout(tidy,1500);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){try{build();}catch(e){}});
else{try{build();}catch(e){}}
})();