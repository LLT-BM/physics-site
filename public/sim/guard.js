/* LibLabTab · страж симуляций.
   Ловит необработанные ошибки и пустой canvas, показывает причину на экране.
   Подключается в <head> ДО основного скрипта модели. */
(function(){
  'use strict';
  if(window.__lltGuard) return;
  window.__lltGuard = true;
  window.__simOK = true;
  var shown = false;

  function paint(msg){
    try{
      var c = document.querySelector('canvas'); if(!c) return;
      var x = c.getContext('2d'); if(!x) return;
      x.setTransform(1,0,0,1,0,0);
      x.globalAlpha = 1; x.shadowBlur = 0; x.setLineDash([]);
      x.fillStyle = '#071012'; x.fillRect(0,0,c.width,c.height);
      x.fillStyle = '#D69FA9'; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      x.font = '15px ui-monospace, SFMono-Regular, Consolas, monospace';
      var words = String(msg).split(/\s+/), line = '', y = 36;
      for(var i=0;i<words.length;i++){
        var t = line ? line+' '+words[i] : words[i];
        if(line && x.measureText(t).width > c.width-32){ x.fillText(line,16,y); y += 22; line = words[i]; }
        else line = t;
      }
      if(line) x.fillText(line,16,y);
    }catch(e){}
  }

  function banner(msg){
    if(shown) return;
    shown = true; window.__simOK = false;
    var host = document.body || document.documentElement;
    if(host){
      var box = document.createElement('div');
      box.setAttribute('role','alert');
      box.style.cssText = 'position:fixed;left:10px;right:10px;top:10px;z-index:2147483647;'+
        'display:flex;gap:10px;align-items:flex-start;padding:11px 13px;border-radius:10px;'+
        'border:1px solid #D69FA9;background:rgba(22,12,16,.95);color:#F4DADE;'+
        'font:13px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;'+
        'box-shadow:0 14px 38px rgba(0,0,0,.6)';
      var txt = document.createElement('div');
      txt.style.cssText = 'flex:1;white-space:pre-wrap;word-break:break-word';
      txt.textContent = 'Модель не запустилась: ' + msg +
        '\nПришлите этот текст — по нему место поломки находится сразу.';
      var btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = '\u00D7'; btn.setAttribute('aria-label','Закрыть');
      btn.style.cssText = 'flex:none;width:26px;height:26px;border-radius:7px;cursor:pointer;'+
        'border:1px solid rgba(214,159,169,.5);background:transparent;color:#F4DADE;font:16px/1 monospace';
      btn.onclick = function(){ if(box.parentNode) box.parentNode.removeChild(box); };
      box.appendChild(txt); box.appendChild(btn); host.appendChild(box);
    }
    paint(msg);
  }

  window.__simFail = function(msg){ banner(String(msg || 'неизвестная ошибка')); };

  window.addEventListener('error', function(e){
    banner((e && (e.message || (e.error && e.error.message))) || 'неизвестно');
  });
  window.addEventListener('unhandledrejection', function(e){
    var r = e && e.reason;
    banner(r && r.message ? r.message : String(r));
  });

  /* Через 2,5 с проверяем, что на canvas хоть что-то нарисовано.
     Смотрим и альфу: некоторые модели делают clearRect и рисуют только в центре. */
  setTimeout(function(){
    if(shown) return;
    var c = document.querySelector('canvas');
    if(!c || !c.width || !c.height) return;
    try{
      var x = c.getContext('2d'); if(!x) return;
      var d = x.getImageData(0,0,c.width,c.height).data, painted = 0;
      for(var i=0;i<d.length;i+=404){
        if(d[i+3] > 0 || d[i] > 0 || d[i+1] > 0 || d[i+2] > 0){
          if(++painted > 8) break;
        }
      }
      if(!painted) banner('canvas пуст через 2,5 с после загрузки');
    }catch(e){}
  }, 2500);
})();