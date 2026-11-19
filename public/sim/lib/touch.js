/* LibLabTab · касания, док-панель, авто-высота iframe, экономия кадров.
   Подключается ПОСЛЕ theme.js и ДО основного скрипта модели. */
(function(){
  'use strict';
  if(window.LLTmobile) return;

  var coarse = matchMedia('(hover:none) and (pointer:coarse)').matches;
  var narrow = function(){ return innerWidth < 720; };
  var mem = navigator.deviceMemory || 4;
  var cores = navigator.hardwareConcurrency || 4;
  var tier = (mem <= 2 || cores <= 4) ? 'low' : (mem <= 4 || cores <= 6 ? 'mid' : 'high');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- viewport ---------- */
  function viewport(){
    var m = document.querySelector('meta[name="viewport"]');
    if(!m){ m = document.createElement('meta'); m.name='viewport'; document.head.appendChild(m); }
    var c = m.content || '';
    if(!/width\s*=/.test(c)) c = 'width=device-width' + (c?','+c:'');
    if(!/initial-scale/.test(c)) c += ',initial-scale=1';
    if(!/viewport-fit/.test(c)) c += ',viewport-fit=cover';
    m.content = c;                     /* user-scalable НЕ отключаем */
  }

  /* ---------- канвасы: захват жеста, pinch, прокрутка двумя пальцами ---------- */
  function scrollPage(dy){
    try{
      if(parent !== window){ parent.postMessage({llt:'scroll',dy:dy},'*'); return; }
    }catch(e){}
    window.scrollBy(0,dy);
  }
  function wireCanvas(cv){
    if(cv.dataset.lltTouch) return; cv.dataset.lltTouch='1';
    cv.style.touchAction='none';
    var pts = new Map(), lastDist=0, lastY=0, moved=0;
    function dist(){
      var a=[...pts.values()]; if(a.length<2) return 0;
      return Math.hypot(a[0].x-a[1].x, a[0].y-a[1].y);
    }
    function mid(){
      var a=[...pts.values()];
      return { x:(a[0].x+a[1].x)/2, y:(a[0].y+a[1].y)/2 };
    }
    cv.addEventListener('pointerdown',function(e){
      pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      moved=0;
      if(pts.size===2){ lastDist=dist(); lastY=mid().y; }
      try{ cv.setPointerCapture(e.pointerId); }catch(_){}
    },{passive:true});
    cv.addEventListener('pointermove',function(e){
      if(!pts.has(e.pointerId)) return;
      var p=pts.get(e.pointerId);
      moved += Math.abs(e.clientX-p.x)+Math.abs(e.clientY-p.y);
      p.x=e.clientX; p.y=e.clientY;
      if(pts.size===2){
        var d=dist(), c=mid();
        if(lastDist>0 && d>0){
          var k=d/lastDist;
          if(Math.abs(k-1)>0.01){
            cv.dispatchEvent(new CustomEvent('llt:pinch',{detail:{scale:k,cx:c.x,cy:c.y},bubbles:true}));
          }
        }
        var dy=c.y-lastY;
        if(Math.abs(dy)>1.5) scrollPage(-dy);
        lastDist=d; lastY=c.y;
      }
    },{passive:true});
    function up(e){ pts.delete(e.pointerId); if(pts.size<2) lastDist=0; }
    cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
    cv.addEventListener('lostpointercapture',up);
    cv.addEventListener('contextmenu',function(e){ e.preventDefault(); });
    cv.addEventListener('gesturestart',function(e){ e.preventDefault(); });
  }

  /* ---------- док-панель: прокси к существующим кнопкам ---------- */
  var dock=null, syncing=false, proxies=[];
  function pick(){
    var all=[...document.querySelectorAll('button')].filter(function(b){
      return b.offsetParent!==null && !b.closest('#lltDock') && !b.closest('#lltThemeBtn');
    });
    function find(re){ return all.find(function(b){ return re.test((b.textContent||'').trim()); }); }
    var out=[];
    var play=find(/Пуск|Пауза|▶|❚❚|Стоп/i); if(play) out.push({el:play,main:true});
    var step=find(/^Шаг$/i); if(step) out.push({el:step});
    var rst=find(/Сброс|По умолчанию/i); if(rst) out.push({el:rst});
    var clr=find(/^Очистить$/i); if(clr && out.length<4) out.push({el:clr});
    return out.slice(0,4);
  }
  function buildDock(){
    [].forEach.call(document.querySelectorAll("[data-llt-proxied]"),function(el){el.removeAttribute("data-llt-proxied");});
    if(!narrow() || !coarse){ if(dock){ dock.classList.remove('on'); document.body.classList.remove('llt-docked'); } return; }
    var items=pick();
    if(items.length<2){ if(dock){ dock.classList.remove('on'); document.body.classList.remove('llt-docked'); } return; }
    if(!dock){
      dock=document.createElement('div'); dock.id='lltDock';
      dock.setAttribute('role','toolbar'); dock.setAttribute('aria-label','Основные действия');
      document.body.appendChild(dock);
    }
    syncing=true;
    dock.innerHTML=''; proxies=[];
    items.forEach(function(it){
      var b=document.createElement('button');
      b.type='button'; b.textContent=it.el.textContent.trim();
      if(it.main) b.className='main';
      b.addEventListener('click',function(){ it.el.click(); sync(); });
      dock.appendChild(b); proxies.push({btn:b,src:it.el}); it.el.setAttribute("data-llt-proxied","1");
    });
    dock.classList.add('on'); document.body.classList.add('llt-docked');
    syncing=false;
  }
  function sync(){
    if(syncing) return;
    syncing=true;
    proxies.forEach(function(p){
      var t=p.src.textContent.trim();
      if(p.btn.textContent!==t) p.btn.textContent=t;
    });
    syncing=false;
  }

  /* ---------- авто-высота для iframe ---------- */
  var lastH=0, hTimer=null;
  function reportHeight(){
    if(parent===window) return;
    var h=Math.ceil(Math.max(document.documentElement.scrollHeight, document.body?document.body.scrollHeight:0));
    if(Math.abs(h-lastH)<8) return;
    lastH=h;
    try{ parent.postMessage({llt:'height',h:h},'*'); }catch(e){}
  }
  function queueHeight(){ clearTimeout(hTimer); hTimer=setTimeout(reportHeight,120); }

  /* ---------- пауза, когда вкладка скрыта или сцена вне экрана ---------- */
  var paused=false, pending=new Map(), nativeRaf=window.requestAnimationFrame.bind(window);
  function gate(){
    window.requestAnimationFrame=function(cb){
      if(!paused) return nativeRaf(cb);
      var id=nativeRaf(function(){}); pending.set(id,cb); return id;
    };
  }
  function setPaused(v){
    if(paused===v) return; paused=v;
    if(!paused){ var list=[...pending.values()]; pending.clear(); list.forEach(function(cb){ nativeRaf(cb); }); }
    window.dispatchEvent(new CustomEvent('llt:visible',{detail:{visible:!v}}));
  }

  /* ---------- инициализация ---------- */
  function init(){
    viewport();
    document.querySelectorAll('canvas').forEach(wireCanvas);
    buildDock(); sync(); reportHeight();
    gate();

    document.addEventListener('visibilitychange',function(){ setPaused(document.hidden); });
    if(window.IntersectionObserver){
      var io=new IntersectionObserver(function(es){
        var any=es.some(function(e){ return e.isIntersecting; });
        if(!document.hidden) setPaused(!any);
      },{threshold:0.01});
      document.querySelectorAll('canvas').forEach(function(c){ io.observe(c); });
    }
    if(window.ResizeObserver){
      var ro=new ResizeObserver(function(){ queueHeight(); buildDock(); });
      ro.observe(document.documentElement);
      if(document.body) ro.observe(document.body);
    }
    var mo=new MutationObserver(function(){
      if(syncing) return;
      document.querySelectorAll('canvas').forEach(wireCanvas);
      sync(); queueHeight();
    });
    if(document.body) mo.observe(document.body,{childList:true,subtree:true,characterData:true});

    var rt=null;
    addEventListener('resize',function(){ clearTimeout(rt); rt=setTimeout(function(){ buildDock(); queueHeight(); },160); });
    addEventListener('orientationchange',function(){ setTimeout(function(){ buildDock(); queueHeight(); },300); });
    addEventListener('load',queueHeight);
  }

  window.LLTmobile={
    tier:tier, coarse:coarse, reduce:reduce,
    dpr:function(max){ return Math.min(tier==='low'?1.5:(max||2), window.devicePixelRatio||1); },
    budget:function(n){ return tier==='low'?Math.round(n*0.45):(tier==='mid'?Math.round(n*0.75):n); },
    narrow:narrow, dock:buildDock, height:reportHeight
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();