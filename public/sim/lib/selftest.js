/* LibLabTab · мост самотеста: страница модели просит прогнать проверку,
   симуляция отвечает строками своей контрольной таблицы. */
(function(){
  'use strict';
  if(window.LLTselftest) return;

  function collect(){
    var tbl = document.getElementById('testTbl');
    if(!tbl){
      var foot = document.querySelector('table tfoot');
      if(foot) tbl = foot.closest('table');
    }
    if(!tbl) return null;
    var rows = [].slice.call(tbl.querySelectorAll('tbody tr')).map(function(tr){
      var c = [].slice.call(tr.children).map(function(td){ return td.textContent.trim(); });
      return { name:c[0]||'', got:c[1]||'', want:c[2]||'', ok:/✓/.test(c[3]||'') };
    }).filter(function(r){ return r.name; });
    if(!rows.length) return null;
    return { rows:rows, ok:rows.filter(function(r){ return r.ok; }).length, total:rows.length };
  }

  function run(){
    if(typeof window.__selfTest === 'function'){
      try{ window.__selfTest(); }catch(e){}
    }
    return collect();
  }

  window.LLTselftest = { run:run, collect:collect };

  window.addEventListener('message', function(e){
    var d = e.data;
    if(!d || d.llt !== 'selftest-run') return;
    var res = run();
    try{ e.source.postMessage({ llt:'selftest-result', id:d.id||'', result:res }, '*'); }catch(err){}
  });
})();