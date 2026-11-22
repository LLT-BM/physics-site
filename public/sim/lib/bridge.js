/* LibLabTab · мост между страницей модели и симуляцией.
   Работает только с размеченными моделями:
     data-llt-stage-wrap, data-llt-stage, data-llt-ui,
     data-llt="basic|adv|action|preset|skip", data-label, data-unit, data-llt-read.
   Модели без разметки остаются автономными: мост сообщает «legacy»,
   страница отдаёт им весь кадр и не строит дублирующие органы управления.
   Никаких наблюдателей за DOM: скан один раз и по команде. */
(function(){
'use strict';
if(window.__lltBridge) return;
window.__lltBridge = true;

var script = document.currentScript || document.querySelector('script[data-llt-bridge]');
var SLUG = (script && script.dataset.slug) || location.pathname.split('/').pop().replace('.html','');
var EMBED = false;
try{ EMBED = window.parent !== window; }catch(e){ EMBED = false; }

var MARKED = !!document.querySelector('[data-llt-stage-wrap],[data-llt="basic"],[data-llt="adv"]');

function send(msg){
  try{ parent.postMessage(Object.assign({ llt:msg.type }, msg), location.origin); }catch(e){}
}
function txt(n){ return (n && n.textContent || '').replace(/\s+/g,' ').trim(); }
function skipped(n){ return !!n.closest('[data-llt="skip"],.cmt,.offscreen'); }
function labelOf(n){
  if(n.dataset.label) return n.dataset.label;
  var byFor = n.id && document.querySelector('label[for="' + CSS.escape(n.id) + '"]');
  var lab = byFor || n.closest('label');
  if(lab){
    var c = lab.cloneNode(true);
    c.querySelectorAll('input,select,output,button').forEach(function(x){ x.remove(); });
    var t = txt(c);
    if(t) return t;
  }
  return n.getAttribute('aria-label') || n.id || 'Параметр';
}
function levelOf(n){
  var own = n.getAttribute('data-llt');
  if(own === 'basic' || own === 'adv') return own;
  var host = n.closest('[data-llt="basic"],[data-llt="adv"]');
  return host ? host.getAttribute('data-llt') : 'adv';
}

var registry = new Map();
function scan(){
  var controls = [], actions = [], presets = [], i = 0;
  registry.clear();
  document.querySelectorAll('input,select').forEach(function(n){
    if(n.type === 'hidden' || n.disabled || skipped(n)) return;
    if(!n.closest('[data-llt="basic"],[data-llt="adv"],[data-llt]')) return;
    var key = n.id || n.name || ('c' + (i++));
    var c = { key:key, label:labelOf(n), unit:n.dataset.unit || '', level:levelOf(n) };
    if(n.tagName === 'SELECT'){
      c.kind = 'select'; c.value = n.value;
      c.options = Array.prototype.map.call(n.options, function(o){ return { value:o.value, label:txt(o) }; });
    } else if(n.type === 'checkbox' || n.type === 'radio'){
      c.kind = 'check'; c.value = n.checked;
    } else if(n.type === 'number'){
      c.kind = 'number';
      c.min = n.min === '' ? undefined : +n.min;
      c.max = n.max === '' ? undefined : +n.max;
      c.step = n.step === '' ? undefined : +n.step;
      c.value = +n.value;
    } else if(n.type === 'range'){
      c.kind = 'range';
      c.min = +n.min || 0; c.max = n.max === '' ? 100 : +n.max;
      c.step = n.step === '' ? 1 : +n.step; c.value = +n.value;
    } else return;
    registry.set(key, n);
    controls.push(c);
  });
  document.querySelectorAll('button,[role="button"]').forEach(function(n){
    if(skipped(n)) return;
    var mark = n.getAttribute('data-llt');
    if(mark !== 'action' && mark !== 'preset') return;
    var t = n.dataset.label || txt(n);
    if(!t) return;
    var key = n.id || ('b' + (i++));
    registry.set(key, n);
    (mark === 'preset' ? presets : actions).push({ key:key, kind:mark, label:t, level:'basic' });
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
function readings(){
  var rows = [], seen = new Set();
  document.querySelectorAll('[data-llt-read] b,[data-llt-read] output').forEach(function(n){
    var v = txt(n);
    if(!v || v.length > 30) return;
    var host = n.closest('div,li,span');
    var l = host && host.querySelector('span,.tl,i');
    var label = l && l !== n && !l.contains(n) ? txt(l) : '';
    if(!label) return;
    var key = n.id || label;
    if(seen.has(key)) return;
    seen.add(key);
    rows.push({ key:key, label:label, value:v });
  });
  return rows;
}

var lastSig = '', lastSend = 0;
function pushTelemetry(force){
  var now = Date.now();
  if(!force && now - lastSend < 400) return;
  var rows = readings(), sig = JSON.stringify(rows);
  if(!force && sig === lastSig) return;
  lastSig = sig; lastSend = now;
  send({ type:'telemetry', rows:rows });
}
function hello(){
  send({ type:'hello', manifest:scan() });
  send({ type:'values', values:values() });
  pushTelemetry(true);
}

window.addEventListener('message', function(e){
  var d = e.data;
  if(!d || d.llt !== 'cmd') return;
  if(d.op === 'ping'){ MARKED ? hello() : send({ type:'legacy' }); return; }
  if(d.op === 'rescan'){ if(MARKED) hello(); return; }
  if(d.op === 'set'){
    var n = registry.get(d.key);
    if(!n) return;
    if(n.type === 'checkbox' || n.type === 'radio') n.checked = !!d.value;
    else n.value = String(d.value);
    n.dispatchEvent(new Event('input', { bubbles:true }));
    n.dispatchEvent(new Event('change', { bubbles:true }));
    pushTelemetry(true);
    return;
  }
  if(d.op === 'press'){
    var b = registry.get(d.key);
    if(b){ b.click(); setTimeout(function(){ send({ type:'values', values:values() }); pushTelemetry(true); }, 60); }
  }
});

function embedStyle(){
  if(!EMBED || !MARKED || document.getElementById('llt-embed-css')) return;
  var s = document.createElement('style');
  s.id = 'llt-embed-css';
  s.textContent =
    'html,body{height:100% !important;margin:0 !important;padding:0 !important;overflow:hidden !important}'+
    'body.llt-embedded [data-llt-ui]{display:none !important}'+
    'body.llt-embedded .app{display:block !important;height:100% !important;padding:0 !important;gap:0 !important}'+
    'body.llt-embedded [data-llt-stage-wrap]{position:absolute !important;inset:0 !important;'+
      'width:100% !important;height:100% !important;max-width:none !important;margin:0 !important;'+
      'padding:0 !important;border:0 !important;border-radius:0 !important;display:block !important}'+
    'body.llt-embedded [data-llt-stage]{width:100% !important;height:100% !important;'+
      'max-width:none !important;margin:0 !important;display:block !important}';
  document.head.appendChild(s);
  document.body.classList.add('llt-embedded');
}

window.__lltRescan = function(){ if(MARKED) hello(); };

function boot(){
  if(!MARKED){ send({ type:'legacy' }); return; }
  embedStyle();
  hello();
  setTimeout(hello, 500);
  setInterval(function(){ pushTelemetry(false); }, 500);
  window.addEventListener('resize', function(){ pushTelemetry(true); }, { passive:true });
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();