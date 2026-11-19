/* LibLabTab · базовые/продвинутые настройки + память состояния.
   Разметка: контейнер .ctl, первые 3 карточки — базовые, остальные — продвинутые.
   Явно: data-level="adv" на блоке всегда уходит в продвинутые. */
(function(){
  'use strict';
  if(window.LLTui) return;
  function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
  var KEY='llt-adv-'+location.pathname.split('/').pop();

  function split(){
    document.querySelectorAll('.ctl').forEach(function(ctl){
      if(ctl.dataset.lltSplit) return;
      var kids=[].slice.call(ctl.children).filter(function(n){ return n.nodeType===1; });
      if(kids.length<4) return;
      var adv=kids.filter(function(n,i){ return n.dataset.level==='adv' || (n.dataset.level!=='basic' && i>=3); });
      if(!adv.length) return;
      ctl.dataset.lltSplit='1';
      var d=document.createElement('details');
      d.className='llt-adv';
      d.innerHTML='<summary>Расширенные настройки <span class="llt-adv-n">'+adv.length+'</span></summary>';
      var box=document.createElement('div'); box.className='llt-adv-body';
      adv.forEach(function(n){ box.appendChild(n); });
      d.appendChild(box); ctl.appendChild(d);
      d.open = store(KEY)==='1';
      d.addEventListener('toggle',function(){ store(KEY,d.open?'1':'0'); });
    });
  }

  function labelUnits(){
    document.querySelectorAll('input[type=range]').forEach(function(r){
      if(r.dataset.lltU) return;
      var lab=r.closest('label')||document.querySelector('label[for="'+r.id+'"]');
      if(!lab) return;
      r.dataset.lltU='1';
      if(!r.getAttribute('aria-label')) r.setAttribute('aria-label',lab.textContent.replace(/\s+/g,' ').trim());
    });
  }

  function backLink(slug){
    if(document.getElementById('lltBack')||!document.body) return;
    var a=document.createElement('a');
    a.id='lltBack'; a.href='/models/'+slug+'/';
    a.textContent='← к описанию модели';
    a.style.cssText='position:fixed;left:12px;top:12px;z-index:70;padding:7px 12px;border-radius:999px;'+
      'border:1px solid var(--line2);background:var(--scrim);color:var(--ink);'+
      'font:600 12px var(--mono);text-decoration:none;backdrop-filter:blur(6px)';
    document.body.appendChild(a);
  }

  function css(){
    if(document.getElementById('lltUiCss')) return;
    var s=document.createElement('style'); s.id='lltUiCss';
    s.textContent='.llt-adv{grid-column:1/-1;border:1px solid var(--line);border-radius:12px;'+
      'background:var(--surface);padding:10px 12px}'+
      '.llt-adv>summary{cursor:pointer;font:600 .9rem var(--mono);color:var(--aqua);list-style:none}'+
      '.llt-adv>summary::-webkit-details-marker{display:none}'+
      '.llt-adv>summary::before{content:"▸ ";}'+
      '.llt-adv[open]>summary::before{content:"▾ ";}'+
      '.llt-adv-n{color:var(--muted);font-weight:400}'+
      '.llt-adv-body{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-top:10px}'+
      '.llt-adv-body>.card{margin-top:0}';
    document.head.appendChild(s);
  }

  function init(opts){
    css(); split(); labelUnits();
    if(opts&&opts.slug) backLink(opts.slug);
  }
  window.LLTui={init:init,split:split};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ init(window.LLT_OPTS||{}); });
  else init(window.LLT_OPTS||{});
})();