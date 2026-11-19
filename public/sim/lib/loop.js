/* LibLabTab · единый цикл: фиксированный шаг физики, накопитель времени,
   пауза при уходе со вкладки, DPR и ResizeObserver. Подключается по желанию. */
(function(){
  'use strict';
  if(window.LLTloop) return;
  function make(o){
    var step=o.step||1/240, maxSteps=o.maxSteps||12, onStep=o.onStep, onDraw=o.onDraw;
    var acc=0, last=0, running=o.running!==false, raf=null, hidden=false;
    function frame(ts){
      raf=requestAnimationFrame(frame);
      var dt=(ts-last)/1000; last=ts;
      if(!isFinite(dt)||dt<0) dt=0;
      if(dt>0.25) dt=0;                 /* возврат со вкладки: без гигантского шага */
      if(running&&!hidden){
        acc+=dt*(o.speed?o.speed():1);
        var n=0;
        while(acc>=step&&n<maxSteps){ onStep(step); acc-=step; n++; }
        if(acc>step*maxSteps) acc=0;
      }
      if(onDraw) onDraw(dt);
    }
    document.addEventListener('visibilitychange',function(){
      hidden=document.hidden; if(!hidden){ last=performance.now(); acc=0; }
    });
    last=performance.now(); raf=requestAnimationFrame(frame);
    return {
      set:function(v){ running=!!v; if(running){ last=performance.now(); acc=0; } },
      get:function(){ return running; },
      toggle:function(){ this.set(!running); return running; },
      stop:function(){ if(raf) cancelAnimationFrame(raf); raf=null; }
    };
  }
  function canvas(cv,draw){
    var ctx=cv.getContext('2d'), W=0,H=0,dpr=1;
    function fit(){
      var r=cv.getBoundingClientRect();
      W=Math.max(1,Math.round(r.width));
      H=Math.max(1,Math.round(r.height||cv.clientHeight||W*0.56));
      dpr=Math.min(2,window.devicePixelRatio||1);
      cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      if(draw) draw(ctx,W,H);
    }
    if(window.ResizeObserver) new ResizeObserver(fit).observe(cv);
    else window.addEventListener('resize',fit);
    window.addEventListener('llt:theme',function(){ if(draw) draw(ctx,W,H); });
    fit();
    return { ctx:ctx, fit:fit, size:function(){ return {W:W,H:H,dpr:dpr}; } };
  }
  window.LLTloop={make:make,canvas:canvas};
})();