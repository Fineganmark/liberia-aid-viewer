/* Liberia aid data viewer: the Development indicators section.
   Reads window.LBR_IND (data/indicators.js, built by tools/build_indicators.py): one card per indicator with
   Liberia's latest value, a trend line from 2000 and a comparison group (Sub-Saharan Africa or low-income countries). */
(function () {
  'use strict';
  const I = window.LBR_IND;
  const root = document.getElementById('dev-grid');
  if (!I || !I.ind || !I.ind.length || !root) return;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SVGNS = 'http://www.w3.org/2000/svg';
  const ST = { t: 0, cmp: 'ssf' };
  try { const p = new URLSearchParams(location.search).get('dev'); if (p != null && I.themes[+p]) ST.t = +p; } catch (e) { /* ignore */ }

  const nf = (v, dp) => v.toLocaleString('en-IE', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  function fv(v, f) {
    if (v == null) return '—';
    const a = Math.abs(v);
    if (f === 'p') return nf(v, a >= 100 ? 0 : 1) + '%';
    if (f === 'n') return a >= 1e6 ? nf(v / 1e6, 2) + 'm' : nf(Math.round(v), 0);
    if (f === 'u') return 'US$' + nf(Math.round(v), 0);
    if (f === 'r') return nf(v, 3);
    if (f === 'g') return (v > 0 ? '+' : v < 0 ? '−' : '') + nf(a, 2);
    return nf(v, a >= 100 ? 0 : 1);
  }
  const at = (pts, y) => { const p = pts && pts.find((x) => x[0] === y); return p ? p[1] : null; };
  const latest = (pts, upTo) => { const q = (pts || []).filter((x) => upTo == null || x[0] <= upTo); return q.length ? q[q.length - 1] : null; };

  function sv(tag, attrs, parent) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }

  // small line chart: Liberia (solid; IMF projections dashed) and the comparison group (grey)
  function spark(it, cmp) {
    const W = 260, H = 70, L = 2, R = 2, T = 6, B = 14;
    const lb = it.lbr, cp = it[cmp] || [];
    const all = lb.concat(cp);
    const xs = all.map((p) => p[0]), vs = all.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    let v0 = Math.min(...vs), v1 = Math.max(...vs);
    if (it.f !== 'g' && v0 > 0 && v0 < (v1 - v0) * 1.5) v0 = 0; // start at zero when it doesn't flatten the line
    if (v1 === v0) { v1 += 1; v0 -= 1; }
    const X = (y) => L + ((W - L - R) * (y - x0)) / Math.max(1, x1 - x0), Y = (v) => T + (H - T - B) * (1 - (v - v0) / (v1 - v0));
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 ' + W + ' ' + H); s.setAttribute('class', 'dev-spark'); s.setAttribute('aria-hidden', 'true');
    if (v0 < 0 && v1 > 0) sv('line', { x1: L, x2: W - R, y1: Y(0), y2: Y(0), class: 'zero' }, s);
    const path = (pts) => 'M' + pts.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join('L');
    if (cp.length > 1) sv('path', { d: path(cp), class: 'cmp' }, s);
    const act = it.fc ? lb.filter((p) => p[0] <= it.fc) : lb, fc = it.fc ? lb.filter((p) => p[0] >= it.fc) : [];
    if (act.length > 1) sv('path', { d: path(act), class: 'lb' }, s);
    if (fc.length > 1) sv('path', { d: path(fc), class: 'lb fc' }, s);
    const last = act[act.length - 1];
    if (last) sv('circle', { cx: X(last[0]), cy: Y(last[1]), r: 3, class: 'dot' }, s);
    if (act.length === 1) sv('circle', { cx: X(act[0][0]), cy: Y(act[0][1]), r: 3, class: 'dot' }, s);
    [x0, x1].forEach((y, i) => { const t = sv('text', { x: i ? W - R : L, y: H - 2, 'text-anchor': i ? 'end' : 'start' }, s); t.textContent = y; });
    return s;
  }

  function change(it) {
    // compare with about ten years before the latest value
    const pts = it.lbr.filter((p) => p[0] <= it.y);
    const base = pts.filter((p) => p[0] <= it.y - 8).pop() || (pts.length > 1 ? pts[0] : null);
    if (!base || base[0] === it.y) return '';
    const d = it.v - base[1];
    let cls = '';
    if (it.b && Math.abs(d) > 1e-9) cls = (d > 0) === (it.b === 'up') ? 'good' : 'bad';
    return '<span class="dev-ch ' + cls + '">' + (d >= 0 ? '▲' : '▼') + ' from ' + fv(base[1], it.f) + ' in ' + base[0] + '</span>';
  }

  function card(it) {
    const c = document.createElement('div');
    c.className = 'dev-card';
    const cp = it[ST.cmp];
    const cv = cp ? (at(cp, it.y) != null ? [it.y, at(cp, it.y)] : latest(cp, it.y)) : null;
    const fcPt = it.fc ? latest(it.lbr) : null;
    c.innerHTML = '<div class="dev-l">' + esc(it.l) + '</div>' +
      '<div class="dev-v"><b>' + fv(it.v, it.f) + '</b> <span>' + it.y + '</span></div>' +
      '<div class="dev-sub">' + change(it) + '</div>' +
      '<div class="dev-sub">' + (cv ? esc(I.groups[ST.cmp.toUpperCase()]) + ': ' + fv(cv[1], it.f) + ' (' + cv[0] + ')' : 'No ' + esc(I.groups[ST.cmp.toUpperCase()]).replace('Low-income', 'low-income') + ' average') +
      (fcPt && fcPt[0] > it.y ? ' · IMF projects ' + fv(fcPt[1], it.f) + ' for ' + fcPt[0] : '') + '</div>';
    c.appendChild(spark(it, ST.cmp));
    const n = document.createElement('div');
    n.className = 'dev-n';
    n.innerHTML = (it.n ? esc(it.n) + ' ' : '') + '<a href="' + esc(it.u) + '" target="_blank" rel="noopener">' + esc(it.s) + '</a>';
    c.appendChild(n);
    return c;
  }

  function render() {
    const tabs = $('#dev-tabs');
    tabs.innerHTML = '';
    I.themes.forEach((t, i) => {
      const k = I.ind.filter((x) => x.t === i).length;
      if (!k) return;
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = t; b.setAttribute('aria-pressed', i === ST.t);
      b.onclick = () => { ST.t = i; render(); };
      tabs.appendChild(b);
    });
    document.querySelectorAll('#dev-cmp button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.g === ST.cmp));
    root.innerHTML = '';
    I.ind.filter((x) => x.t === ST.t).forEach((it) => root.appendChild(card(it)));
  }

  document.querySelectorAll('#dev-cmp button').forEach((b) => { b.onclick = () => { ST.cmp = b.dataset.g; render(); }; });
  const f = $('#dev-fetched');
  if (f && I.fetched) f.textContent = I.fetched;
  render();
})();
