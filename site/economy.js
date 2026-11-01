/* Liberia viewer: the Economy page. Cards come from window.LBR_IND (World Bank and IMF figures refreshed in the
   Pages run), and the list of sources and reports is static, with the date each source was checked.
   Figures are facts from the sources; the page adds no judgement. */
(function () {
  'use strict';
  var I = window.LBR_IND;
  var root = document.getElementById('econ-grid');
  if (!root) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var nf = function (v, dp) { return v.toLocaleString('en-IE', { minimumFractionDigits: dp, maximumFractionDigits: dp }); };
  function fv(v, f) {
    if (v == null) return '—';
    var a = Math.abs(v);
    if (f === 'p') return nf(v, a >= 100 ? 0 : 1) + '%';
    if (f === 'u') return 'US$' + nf(Math.round(v), 0);
    if (f === 'n') return a >= 1e6 ? nf(v / 1e6, 2) + 'm' : nf(Math.round(v), 0);
    return nf(v, a >= 100 ? 0 : 1);
  }
  function card(it) {
    var c = document.createElement('div');
    c.className = 'dev-card';
    var fc = it.fc && it.lbr && it.lbr.length ? it.lbr[it.lbr.length - 1] : null;
    c.innerHTML = '<div class="dev-l">' + esc(it.l) + '</div>' +
      '<div class="dev-v"><b>' + fv(it.v, it.f) + '</b> <span>' + esc(it.y) + '</span></div>' +
      '<div class="dev-sub">' + esc(it.n || '') + '</div>' +
      '<div class="dev-n"><a href="' + esc(it.u) + '" target="_blank" rel="noopener">' + esc(it.s) + '</a></div>';
    return c;
  }
  if (!I || !I.ind) { root.textContent = 'Economy figures load with the weekly refresh.'; return; }
  var eco = I.ind.filter(function (x) { return x.t === 0; });
  eco.forEach(function (it) { root.appendChild(card(it)); });
  var f = document.getElementById('econ-fetched');
  if (f && I.fetched) f.textContent = I.fetched;
})();
