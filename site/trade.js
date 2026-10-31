/* Liberia viewer: the Trade section. Reads data/live/comtrade_lbr.json, written by tools/fetch_comtrade.py in the weekly
   GitHub Pages run. Draws grouped bars (imports, exports) in US$ millions, with a table under the chart.
   If the file isn't there yet, the note says so and nothing else breaks. */
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var note = document.getElementById('trade-note');
  var box = document.getElementById('c-trade');
  var tab = document.getElementById('trade-tab');
  if (!note || !box) return;

  function el(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function fmt(v) { return v == null ? '—' : 'US$' + (v / 1e6).toLocaleString('en-IE', { maximumFractionDigits: 0 }) + 'm'; }

  function draw(d) {
    var years = (d.years || []).filter(function (y) { return y.imports_usd != null || y.exports_usd != null; });
    if (!years.length) throw new Error('no years');
    var W = 720, H = 280, L = 56, R = 8, T = 18, B = 30;
    var max = Math.max.apply(null, years.map(function (y) { return Math.max(y.imports_usd || 0, y.exports_usd || 0); })) || 1;
    var nice = Math.pow(10, Math.floor(Math.log10(max))), top = Math.ceil(max / nice) * nice;
    var Y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var slot = (W - L - R) / years.length, bw = Math.max(4, Math.min(22, slot * 0.34));
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Imports and exports by year, US$ millions' });
    [0, 0.5, 1].forEach(function (f) {
      var v = top * f, y = Y(v);
      el('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: 'var(--grid)' }, svg);
      var t = el('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', fill: 'var(--fg-muted)', 'font-size': '12.5' }, svg);
      t.textContent = '$' + (v / 1e6).toFixed(0) + 'm';
    });
    years.forEach(function (yr, i) {
      var cx = L + slot * i + slot / 2;
      [['imports_usd', 'var(--s1)', -bw - 1], ['exports_usd', 'var(--s3)', 1]].forEach(function (s) {
        var v = yr[s[0]];
        if (v == null) return;
        var x = s[2] < 0 ? cx - bw - 1 : cx + 1;
        var r = el('rect', { x: x, y: Y(v), width: bw, height: Math.max(0, Y(0) - Y(v)), fill: s[1], rx: 2 }, svg);
        var tt = el('title', {}, r); tt.textContent = yr.year + ' ' + (s[0] === 'imports_usd' ? 'imports ' : 'exports ') + fmt(v);
      });
      if (years.length <= 14 || i % 2 === 0) {
        var lx = el('text', { x: cx, y: H - 8, 'text-anchor': 'middle', fill: 'var(--fg-muted)', 'font-size': '12.5' }, svg);
        lx.textContent = yr.year;
      }
    });
    box.textContent = '';
    box.appendChild(svg);
    var legend = document.createElement('p');
    legend.className = 'note';
    legend.innerHTML = '<span style="color:var(--s1)">■</span> Imports (into Liberia)   <span style="color:var(--s3)">■</span> Exports (from Liberia)';
    box.parentNode.insertBefore(legend, box);

    var t = document.createElement('table');
    t.innerHTML = '<thead><tr><th scope="col">Year</th><th scope="col">Imports</th><th scope="col">Exports</th></tr></thead>';
    var tb = document.createElement('tbody');
    years.slice().reverse().forEach(function (yr) {
      var tr = document.createElement('tr');
      [yr.year, fmt(yr.imports_usd), fmt(yr.exports_usd)].forEach(function (c) {
        var td = document.createElement('td'); td.textContent = c; tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    tab.textContent = '';
    tab.appendChild(t);
    note.textContent = 'Total trade with all partner countries, in current US dollars. Source: UN Comtrade, fetched ' + (d.fetched || 'on the last refresh') + '. Figures are as reported to Comtrade and may be revised.';
  }

  fetch('data/live/comtrade_lbr.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(draw)
    .catch(function () {
      note.textContent = 'Trade figures load with the weekly refresh. They are not in this copy yet.';
    });
})();
