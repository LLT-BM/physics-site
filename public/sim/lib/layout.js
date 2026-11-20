/* LibLabTab · единый каркас модели.
   Сцена занимает основную область; справа «Базовые настройки» и «Продвинутые настройки».
   Кнопки жизненного цикла (пуск, пауза, шаг, сброс, очистить) всегда поднимаются
   в постоянно видимую панель под сценой, откуда бы они ни были перенесены.
   Все переносы защищены от циклов DOM; при невозможности собрать каркас
   страница остаётся в исходном виде. */
(function(){
'use strict';
if(window.LLTlayout) return;
window.LLTlayout={version:3};

var OPTS=window.LLT_OPTS||{};
var SLUG=OPTS.slug||location.pathname.split('/').pop()||'sim';
var MAIN_BAR=/Пуск|Пауза|▶|❚❚|Сброс|автоколебания|Применить/i;
var ACTION=/Пуск|Пауза|Стоп|Шаг|Сброс|Сбросить|По умолчанию|Очистить|автоколебания|Применить/i;
var RESET=/Сброс|Сбросить|По умолчанию/i;
var PANEL_SEL='.ctl>*,section.card,.card.grp,.card,.chain,.panel,.panels,.side,.sidebar,'+
              '.dock,.info,.tabs,.orbs,.row,.actions,.btns,fieldset,[data-llt-panel]';
var KEEP=/^(SCRIPT|LINK|STYLE|TEMPLATE|NOSCRIPT)$/;

function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}
function el(t,c,x){var n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n;}
function arr(l){return Array.prototype.slice.call(l);}
function uniq(l){var s=new Set();return l.filter(function(n){return n&&!s.has(n)&&(s.add(n),true);});}
function outermost(l){return l.filter(function(n){return !l.some(function(m){return m!==n&&m.contains(n);});});}
function txt(n){return (n&&n.textContent||'').replace(/\s+/g,' ').trim();}
function controls(n){return !!n.querySelector('input,select,textarea');}

var shell=null,barWrap=null;
function movable(n){
  return n && n.nodeType===1 && n!==document.body && n!==document.documentElement &&
         n!==shell && !(shell&&n.contains(shell)) && !!n.parentNode;
}
function move(n,target){
  if(!movable(n)||!target||n===target||n.contains(target)) return false;
  try{target.appendChild(n);return true;}catch(e){return false;}
}
function injectCss(){
  if(document.getElementById('llt-layout-css')) return;
  var s=el('style');s.id='llt-layout-css';
  s.textContent=
    '.llt-sec-body .bar:empty,.llt-sec-body .row:empty,.llt-sec-body .actions:empty,'+
    '.llt-sec-body .btns:empty,.llt-sec-body .controls:empty{display:none !important}'+
    '.llt-bar button{min-height:44px}'+
    '.llt-bar .llt-reset{border-color:var(--rose);color:var(--rose)}'+
    '.llt-bar .llt-reset:hover{background:rgba(214,159,169,.14)}';
  document.head.appendChild(s);
}

function build(){
  if(document.body.getAttribute('data-llt-layout')==='off') return;
  var stage=document.querySelector('[data-llt-stage]')||document.querySelector('canvas')||
            document.querySelector('svg.scene')||document.getElementById('svg');
  if(!stage||stage===document.body) return;

  var origin=document.querySelector('.wrap')||document.body;
  var box=stage.closest('.stagebox,.holder');
  if(!box||box===document.body||box===origin||box.contains(origin)||controls(box)) box=stage;

  injectCss();
  document.body.classList.add('llt-layout');
  shell=el('div','llt-shell');
  var main=el('main','llt-main');
  var side=el('aside','llt-side');
  side.setAttribute('aria-label','Настройки модели');

  var q=function(sel){return arr(document.querySelectorAll(sel));};
  var notStage=function(n){return n!==box&&!n.contains(stage)&&!box.contains(n);};

  var sliders=uniq(q('.spd,[data-llt-slider-group]')).filter(notStage);
  var bars=uniq(q('.bar,.controls,footer.controls,[data-llt-bar]'))
    .filter(function(n){return notStage(n)&&MAIN_BAR.test(txt(n))&&!sliders.some(function(s){return s===n;});});
  var reads=uniq(q('.rd,.meters,.stats,[data-llt-read]')).filter(notStage);
  var statuses=uniq(q('.status,#stat,[data-llt-status]')).filter(notStage);
  var presets=uniq(q('.chips,#presets,#quick,[data-llt-presets]')).filter(notStage);
  var teaching=uniq(q('.steps,.tabs,.orbs,[data-llt-basic]')).filter(notStage);
  var title=document.querySelector('h1');
  var lead=document.querySelector('.lead');
  var pageHead=document.querySelector('header.top,header');

  /* шапка */
  var head=el('div','llt-head');
  if(title&&movable(title)&&!title.contains(stage)){title.classList.add('llt-title');head.appendChild(title);}
  head.appendChild(el('span','llt-spacer'));
  var back=el('a','llt-btn','← к описанию');back.href='/models/'+SLUG+'/';head.appendChild(back);
  var toggle=el('button','llt-btn','⚙ Настройки');toggle.type='button';head.appendChild(toggle);
  main.appendChild(head);

  /* сцена */
  var stageWrap=el('div','llt-stage');
  if(!move(box,stageWrap)){document.body.classList.remove('llt-layout');shell=null;return;}
  main.appendChild(stageWrap);
  if(pageHead&&pageHead!==title&&notStage(pageHead)){pageHead.classList.add('llt-pagehead');move(pageHead,main);}

  /* постоянно видимая панель действий */
  barWrap=el('div','llt-bar');
  barWrap.setAttribute('role','toolbar');
  barWrap.setAttribute('aria-label','Управление моделью');
  bars=outermost(bars);
  bars.forEach(function(n){move(n,barWrap);});

  /* поднимаем кнопки жизненного цикла откуда угодно */
  function liftActions(){
    var moved=0;
    q('button,[role="button"]').forEach(function(b){
      if(!movable(b)||b.contains(stage)) return;
      if(barWrap.contains(b)||head.contains(b)) return;
      if(b.closest('.chips')||b.closest('.llt-side-head')) return;
      if(!ACTION.test(txt(b))) return;
      if(move(b,barWrap)) moved++;
    });
    return moved;
  }
  liftActions();

  /* гарантированный сброс */
  function ensureReset(){
    var has=arr(barWrap.querySelectorAll('button')).some(function(b){return RESET.test(txt(b));});
    if(has) return;
    var b=el('button','llt-btn llt-reset','⟲ Сброс');
    b.type='button';b.id='lltReset';
    b.addEventListener('click',function(){
      var names=['resetSim','resetAll','doReset','resetScene','reset','restart'];
      for(var i=0;i<names.length;i++){
        if(typeof window[names[i]]==='function'){
          try{window[names[i]]();return;}catch(e){}
        }
      }
      location.reload();
    });
    barWrap.appendChild(b);
  }
  ensureReset();
  if(barWrap.children.length) main.appendChild(barWrap);

  /* показания и статус */
  reads=outermost(reads).filter(function(n){return !bars.some(function(b){return b.contains(n);});});
  if(reads.length){var read=el('div','llt-read');reads.forEach(function(n){move(n,read);});if(read.children.length)main.appendChild(read);}
  if(statuses.length){var st=el('div','llt-status');statuses.forEach(function(n){move(n,st);});if(st.children.length)main.appendChild(st);}

  /* секции справа */
  var sideHead=el('div','llt-side-head');
  var expand=el('button','llt-btn','Развернуть всё');expand.type='button';
  var collapse=el('button','llt-btn','Свернуть всё');collapse.type='button';
  sideHead.appendChild(expand);sideHead.appendChild(collapse);
  var themeBtn=document.querySelector('.llt-theme-btn');
  if(themeBtn) move(themeBtn,sideHead);
  side.appendChild(sideHead);

  function section(key,label){
    var d=el('details','llt-sec');d.setAttribute('data-sec',key);
    var s=el('summary','',label);var n=el('span','llt-sec-n','0');s.appendChild(n);d.appendChild(s);
    var b=el('div','llt-sec-body');d.appendChild(b);
    var saved=store('llt-sec:'+SLUG+':'+key);
    d.open=saved===null?key==='basic':saved==='1';
    d.addEventListener('toggle',function(){store('llt-sec:'+SLUG+':'+key,d.open?'1':'0');ping();});
    side.appendChild(d);
    return {root:d,body:b,count:n};
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
  var na=0;
  panels.forEach(function(p,i){
    var lv=p.getAttribute('data-level');
    if(lv!=='basic'&&lv!=='adv'){
      var m=p.querySelector('[data-level]');
      lv=m?m.getAttribute('data-level'):(i===0?'basic':'adv');
    }
    if(lv==='basic') move(p,basic.body); else if(move(p,adv.body)) na++;
  });
  liftActions();
  basic.count.textContent=basic.body.children.length;
  adv.count.textContent=adv.body.children.length;
  if(!basic.body.children.length) basic.root.classList.add('llt-empty');
  if(!adv.body.children.length) adv.root.classList.add('llt-empty');

  /* всё оставшееся — под сцену, свёрнуто */
  var extra=el('div','llt-sec-body');
  var extraCount=0;
  if(lead&&movable(lead)&&!lead.contains(stage)){if(move(lead,extra))extraCount++;}
  q('canvas:not([data-llt-stage]),svg.scene:not([data-llt-stage]),table,.legend,.eq').forEach(function(n){
    if(!movable(n)||n.contains(stage)||stage.contains(n)) return;
    if(basic.body.contains(n)||adv.body.contains(n)||main.contains(n)) return;
    if(n.closest('.offscreen')) return;
    if(move(n,extra)) extraCount++;
  });
  arr(origin.children).forEach(function(n){
    if(n===shell||KEEP.test(n.tagName)) return;
    if(n.id==='fatal'||n.classList.contains('bg')||n.classList.contains('offscreen')||
       n.classList.contains('llt-shell')||n.hasAttribute('data-llt-keep')) return;
    if(n.contains(stage)) return;
    if(!n.children.length&&!txt(n)){n.style.display='none';return;}
    if(move(n,extra)) extraCount++;
  });
  liftActions();
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
  expand.addEventListener('click',function(){
    arr(document.querySelectorAll('.llt-shell details')).forEach(function(d){d.open=true;});ping();
  });
  collapse.addEventListener('click',function(){
    arr(document.querySelectorAll('.llt-shell details')).forEach(function(d){d.open=false;});ping();
  });

  function paint(){
    arr(document.querySelectorAll('input[type=range]')).forEach(function(r){
      var mn=parseFloat(r.min),mx=parseFloat(r.max),v=parseFloat(r.value);
      var f=(isFinite(mn)&&isFinite(mx)&&mx>mn)?(v-mn)/(mx-mn)*100:0;
      r.style.setProperty('--fill',Math.max(0,Math.min(100,f)).toFixed(2)+'%');
      if(!r.getAttribute('aria-label')){
        var lab=r.closest('label')||document.querySelector('label[for="'+r.id+'"]');
        if(lab) r.setAttribute('aria-label',txt(lab));
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
    },60);
  }
  window.LLTlayout.repaint=ping;
  applyOff();paint();ping();setTimeout(ping,320);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){try{build();}catch(e){}});
else {try{build();}catch(e){}}
})();