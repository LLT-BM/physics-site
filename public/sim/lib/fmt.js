/* LibLabTab · единый вывод чисел и единиц (ru-RU).
   Глобальные LLTfix / LLTsigned / LLTround убирают «-0,0», ставят запятую
   и типографский минус. Подключается в <head> до скрипта модели. */
(function(){
  'use strict';

  function round(x, n){
    n = (n == null ? 2 : n);
    if (!isFinite(x)) return x;
    var p = Math.pow(10, n);
    var r = Math.round(x * p) / p;
    if (r === 0) r = 0;            /* снимает -0 */
    return r;
  }

  function fix(x, n){
    n = (n == null ? 2 : n);
    if (typeof x !== 'number' || isNaN(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    var r = round(x, n);
    var s = Math.abs(r).toFixed(n).replace('.', ',');
    return r < 0 ? '−' + s : s;
  }

  function signed(x, n){
    n = (n == null ? 2 : n);
    var r = round(x, n);
    var s = fix(x, n);
    return r > 0 ? '+' + s : s;
  }

  window.LLTround = round;
  window.LLTfix = fix;
  window.LLTsigned = signed;

  if (window.LLTfmt) {
    window.LLTfmt.nf = fix;
    window.LLTfmt.signed = signed;
    return;
  }

  var cache = {};
  function nf(x, n){ return fix(x, n); }

  var SUP = {'-':'⁻','−':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
  function sup(n){ return String(n).split('').map(function(c){ return SUP[c] || c; }).join(''); }
  function sci(x, n){
    if (typeof x !== 'number' || isNaN(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    if (x === 0) return '0';
    var e = Math.floor(Math.log10(Math.abs(x)));
    return nf(x / Math.pow(10, e), n == null ? 2 : n) + '·10' + sup(e);
  }
  function unit(x, n, u){ return nf(x, n) + ' ' + u; }

  function pick(x, steps){
    for (var i = 0; i < steps.length; i++){
      if (Math.abs(x) < steps[i][1]) return nf(x / steps[i][2], steps[i][3]) + ' ' + steps[i][0];
    }
    var l = steps[steps.length - 1];
    return nf(x / l[2], l[3]) + ' ' + l[0];
  }

  var LEN = [['нм',1e-6,1e9,2],['мкм',1e-3,1e6,2],['мм',1,1e3,2],['м',1e3,1,2],['км',1e6,1e-3,2],['км',Infinity,1e-3,2]];
  function len(m){ if (Math.abs(m) < 1e-9) return sci(m) + ' м'; return pick(m, LEN); }

  var TIME = [['нс',1e-6,1e9,1],['мкс',1e-3,1e6,2],['мс',1,1e3,2],['с',60,1,2],
              ['мин',3600,60,2],['ч',86400,3600,2],['сут',Infinity,86400,2]];
  function time(s){ if (Math.abs(s) < 1e-9) return sci(s) + ' с'; return pick(s, TIME); }

  var AMP = [['нА',1e-6,1e9,1],['мкА',1e-3,1e6,2],['мА',1,1e3,2],['А',Infinity,1,3]];
  function amp(a){ if (Math.abs(a) < 1e-9) return '0 А'; return pick(a, AMP); }

  var VOLT = [['мкВ',1e-3,1e6,2],['мВ',1,1e3,2],['В',1e3,1,3],['кВ',Infinity,1e-3,2]];
  function volt(v){ if (Math.abs(v) < 1e-6) return '0 В'; return pick(v, VOLT); }

  var WATT = [['нВт',1e-6,1e9,1],['мкВт',1e-3,1e6,2],['мВт',1,1e3,2],['Вт',1e3,1,3],['кВт',Infinity,1e-3,2]];
  function watt(w){ if (Math.abs(w) < 1e-9) return '0 Вт'; return pick(w, WATT); }

  function ohm(r){
    if (!isFinite(r)) return '∞';
    if (r < 1) return nf(r, 3) + ' Ом';
    if (r < 1e3) return nf(r, 2) + ' Ом';
    if (r < 1e6) return nf(r / 1e3, 2) + ' кОм';
    return nf(r / 1e6, 2) + ' МОм';
  }

  window.LLTfmt = {
    nf: nf, fix: fix, signed: signed, round: round, sci: sci, sup: sup,
    unit: unit, len: len, time: time, amp: amp, volt: volt, watt: watt, ohm: ohm
  };
})();