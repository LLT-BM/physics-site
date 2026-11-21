/* LibLabTab · мост между страницей модели и симуляцией.
   Подключается страницей автоматически. Явная разметка имеет приоритет:
     data-llt-stage        — главная сцена (canvas/svg)
     data-llt-stage-wrap   — её обёртка, в iframe растягивается на весь кадр
     data-llt-ui           — интерфейсные блоки, скрываются при встраивании
     data-llt="basic|adv|action|preset|skip" — роль органа управления
     data-label, data-unit — подпись и единица для внешнего контрола
     data-llt-read         — контейнер показаний (телеметрия)
   Без разметки работает авто-скан: модель остаётся управляемой снаружи. */
(function(){
'use strict';
if(window.__lltBridge) return;
window.__lltBridge = true;

var script = document.currentScript || document.querySelector('script[data-llt-bridge]');
var SLUG = (script && script.dataset.slug) || location.pathname.split('/').pop().replace('.html','');
var EMBED = true;
try{ EMBED = window.parent !== window; }catch(e){ EMBED = false; }

var ACTION = /Пуск|Пауза|Стоп|Шаг|Сброс|Сбросить|По умолчанию|Очистить|Применить|автоколебания|Толчок|Залить|Случайное/i;
var PRESET_BOX = /chips|presets|quick|examples/i;
var ADV_BOX = /adv|advanced|extend|расшир|точн/i;
var HAS_MARKS = !!document.querySelector('[data-llt],[data-llt-stage-wrap],[data-llt-ui]');

function txt(n){ return (n && n.textContent || '').replace(/\s+/g,' ').trim(); }
function cls(n){ return typeof n.className === 'string' ? n.className : ''; }
function keyOf(n,i){ return n.id || n.name || ('c' + i); }
function skipped(n){ return !!n.closest('[data-llt="skip"]'); }

function labelOf(n){
  if(n.dataset.label) return n.dataset.label;
  var byFor = n.id && document.querySelector('label[for="' + CSS.escape(n.id) + '"]');
  var lab = byFor || n.closest('label');
  if(lab){
    var clone = lab.cloneNode(true);
    clone.querySelectorAll('input,select,output,button').forEach(function(x){ x.remove(); });
    var t = txt(clone);
    if(t) return t;
  }
  if(n.getAttribute('aria-label')) return n.getAttribute('aria-label');
  var prev = n.previousElementSibling;
  if(prev && /label|span|div/i.test(prev.tagName) && txt(prev).length < 60) return txt(prev);
  return n.id || 'Параметр';
}
function unitOf(n, label){
  if(n.dataset.unit) return n.dataset.unit;
  var m = label.match(/[,\s]([А-Яа-яA-Za-z°µμ·\/²³⁻¹0-9 ]{1,14})$/);
  return m ? m[1].trim() : '';
}
function stripUnit(label){
  return label.replace(/[,\s][А-Яа-яA-Za-z°µμ·\/²³⁻¹0-9 ]{1,14}$/,'');
}
function levelOf(n){
  var own = n.getAttribute('data-llt');
  if(own === 'basic' || own === 'adv') return own;
  var host = n.closest('[data-llt="basic"],[data-llt="adv"]');
  if(host) return host.getAttribute('data-llt');
  var lv = n.getAttribute('data-level');
  if(lv === 'basic' || lv === 'adv') return lv;
  var lh = n.closest('[data-level]');
  if(lh) return lh.getAttribute('data-level') === 'basic' ? 'basic' : 'adv';
  var sec = n.closest('details,section,.card,.panel,.grp');
  while(sec){
    if(sec.hasAttribute && sec.hasAttribute('data-sec'))
      return sec.getAttribute('data-sec') === 'basic' ? 'basic' : 'adv';
    if(ADV_BOX.test(cls(sec)) || ADV_BOX.test(txt(sec.querySelector('h2,summary') || {}))) return 'adv';
    sec = sec.parentElement && sec.parentElement.closest('details,section,.card,.panel,.grp');
  }
  return 'adv';
}
function visible(n){
  var cs = getComputedStyle(n);
  if(cs.display === 'none' || cs.visibility === 'hidden') return false;
  return !n.closest('.offscreen,.cmt-hp,[aria-hidden="true"]');
}

var registry = new Map();

function scan(){
  var controls = [], actions = [], presets = [], i = 0;
  registry.clear();

  document.querySelectorAll('input,select').forEach(function(n){
    if(n.type === 'hidden' || n.disabled || skipped(n)) return;
    if(n.closest('.cmt')) return;
    if(!visible(n) && !n.closest('details') && !n.closest('[data-llt-ui]')) return;
    var key = keyOf(n, i++);
    var label = labelOf(n);
    var c = { key:key, label:stripUnit(label), unit:unitOf(n,label), level:levelOf(n) };
    if(n.tagName === 'SELECT'){
      c.kind = 'select'; c.value = n.value;
      c.options = Array.prototype.map.call(n.options, function(o){ return { value:o.value, label:txt(o) }; });
    } else if(n.type === 'checkbox' || n.type === 'radio'){
      c.kind = 'check'; c.value = n.checked; c.label = label;
    } else if(n.type === 'number'){
      c.kind = 'number';
      c.min = n.min === '' ? undefined : +n.min;
      c.max = n.max === '' ? undefined : +n.max;
      c.step = n.step === '' ? undefined : +n.step;
      c.value = +n.value;
    } else if(n.type === 'range'){
      c.kind = 'range';
      c.min = +n.min || 0; c.max = n.max === '' ? 100 : +n.max;
      c.step = n.step === '' ? 1 : +n.step;
      c.value = +n.value;
    } else return;
    registry.set(key, n);
    controls.push(c);
  });

  document.querySelectorAll('button,[role="button"]').forEach(function(n){
    if(skipped(n) || n.closest('.cmt') || n.closest('.llt-side-head')) return;
    var t = n.dataset.label || txt(n);
    if(!t || t.length > 46) return;
    var mark = n.getAttribute('data-llt');
    var box = n.parentElement;
    var isPreset = mark === 'preset' ||
      (!mark && box && (PRESET_BOX.test(cls(box)) || PRESET_BOX.test(n.id || '')));
    var isAction = mark === 'action' || (!mark && !isPreset && ACTION.test(t));
    if(!isPreset && !isAction) return;
    var key = keyOf(n, i++);
    registry.set(key, n);
    (isPreset ? presets : actions).push({ key:key, kind:isPreset?'preset':'action', label:t, level:'basic' });
  });

  return { slug:SLUG, controls:controls, actions:actions, presets:presets };
}

function values(){
  var out = {};
  registry.forEach(function(n,k){
    out[k] = (n.type === 'checkbox' || n.type === 'radio') ? n.checked : n.value;
  });
  return out;
}

var READ_SEL = '[data-llt-read] b,[data-llt-read] output,output,.rd b,.mrow2 b,.meters b,.stat b,.readouts b';
function readings(){
  var rows = [], seen = new Set(), i = 0;
  document.querySelectorAll(READ_SEL).forEach(function(n){
    if(n.closest('.cmt') || skipped(n)) return;
    if(n.closest('details:not([open])') && !n.closest('[data-llt-read]')) return;
    var v = txt(n);
    if(!v || v.length > 30) return;
    var label = '';
    var host = n.closest('div,li,span');
    if(host){
      var l = host.querySelector('span,.tl,.mlab,i');
      if(l && l !== n && !l.contains(n)) label = txt(l);
    }
    if(!label && n.tagName === 'OUTPUT'){
      var lab = n.closest('label');
      if(lab){
        var c = lab.cloneNode(true);
        c.querySelectorAll('output,input,select').forEach(function(x){ x.remove(); });
        label = txt(c);
      }
    }
    if(!label) return;
    var key = n.id || (label + '#' + (i++));
    if(seen.has(key)) return;
    seen.add(key);
    rows.push({ key:key, label:label, value:v });
  });
  return rows;
}

function send(msg){
  try{ parent.postMessage(Object.assign({ llt:msg.type }, msg), location.origin); }catch(e){}
}
function hello(){
  send({ type:'hello', manifest:scan() });
  send({ type:'values', values:values() });
  pushTelemetry(true);
}
var lastSig = '';
function pushTelemetry(force){
  var rows = readings();
  var sig = JSON.stringify(rows);
  if(!force && sig === lastSig) return;
  lastSig = sig;
  send({ type:'telemetry', rows:rows });
}

window.addEventListener('message', function(e){
  var d = e.data;
  if(!d || d.llt !== 'cmd') return;
  if(d.op === 'ping'){ hello(); return; }
  if(d.op === 'rescan'){ hello(); return; }
  if(d.op === 'set'){
    var n = registry.get(d.key);
    if(!n) return;
    if(n.type === 'checkbox' || n.type === 'radio') n.checked = !!d.value;
    else n.value = String(d.value);
    n.dispatchEvent(new Event('input', { bubbles:true }));
    n.dispatchEvent(new Event('change', { bubbles:true }));
    setTimeout(function(){ send({ type:'values', values:values() }); pushTelemetry(true); }, 60);
    return;
  }
  if(d.op === 'press'){
    var b = registry.get(d.key);
    if(b){ b.click(); setTimeout(function(){ send({ type:'values', values:values() }); pushTelemetry(true); }, 90); }
  }
});

/* Встраивание: наружу отдаём только сцену */
function embedStyle(){
  if(!EMBED || document.getElementById('llt-embed-css')) return;
  var s = document.createElement('style');
  s.id = 'llt-embed-css';
  var marked =
    'html,body{height:100% !important;margin:0 !important;padding:0 !important;overflow:hidden !important}'+
    'body.llt-embedded [data-llt-ui]{display:none !important}'+
    'body.llt-embedded [data-llt-stage-wrap]{position:fixed !important;inset:0 !important;'+
      'width:100% !important;height:100% !important;max-width:none !important;margin:0 !important;'+
      'padding:0 !important;border:0 !important;border-radius:0 !important;display:block !important}'+
    'body.llt-embedded [data-llt-stage]{width:100% !important;height:100% !important;'+
      'max-width:none !important;margin:0 !important;display:block !important}';
  var legacy =
    'body.llt-embedded>*:not([data-llt-stage]):not(canvas):not(svg):not(script):not(style):not(link){display:none !important}'+
    'body.llt-embedded .llt-shell,body.llt-embedded .llt-side,body.llt-embedded .llt-head,'+
    'body.llt-embedded .llt-bar,body.llt-embedded .llt-read,body.llt-embedded .llt-status,'+
    'body.llt-embedded .llt-sec,body.llt-embedded .controls,body.llt-embedded .chain,'+
    'body.llt-embedded .panel,body.llt-embedded .tabs,body.llt-embedded .orbs,'+
    'body.llt-embedded .info,body.llt-embedded .note,body.llt-embedded .note2,'+
    'body.llt-embedded .legend,body.llt-embedded header,body.llt-embedded footer,'+
    'body.llt-embedded .vig,body.llt-embedded .corner{display:none !important}'+
    'body.llt-embedded .llt-stage,body.llt-embedded .stagebox,body.llt-embedded .holder,'+
    'body.llt-embedded .stage{position:fixed !important;inset:0 !important;width:100% !important;'+
      'height:100% !important;max-width:none !important;margin:0 !important;padding:0 !important;'+
      'border:0 !important;border-radius:0 !important;display:block !important}'+
    'body.llt-embedded [data-llt-stage]{position:absolute !important;inset:0 !important;'+
      'width:100% !important;height:100% !important;max-width:none !important}';
  s.textContent = marked + (HAS_MARKS ? '' : legacy) +
    'body.llt-embedded .hud{display:flex !important;position:absolute !important;left:10px !important;top:10px !important}'+
    'body.llt-embedded .bg{display:block !important;position:fixed !important;inset:0 !important;z-index:-1 !important}';
  document.head.appendChild(s);
  document.body.classList.add('llt-embedded');
}

function fitStage(){
  var c = document.querySelector('[data-llt-stage]') || document.querySelector('canvas');
  if(!c) return;
  var r = c.getBoundingClientRect();
  if(r.height > 40) send({ type:'stage-size', height:Math.round(r.height) });
}

function boot(){
  embedStyle();
  hello();
  setTimeout(hello, 400);
  setTimeout(hello, 1500);
  setInterval(function(){ pushTelemetry(false); }, 320);
  if(window.ResizeObserver){
    var ro = new ResizeObserver(fitStage);
    ro.observe(document.documentElement);
  }
  window.addEventListener('resize', fitStage, { passive:true });
  if(window.MutationObserver){
    var t = null;
    var mo = new MutationObserver(function(){ clearTimeout(t); t = setTimeout(hello, 300); });
    mo.observe(document.body, { childList:true, subtree:true });
  }
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();