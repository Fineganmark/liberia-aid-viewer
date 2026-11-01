/* Liberia aid data viewer: the Census 2022 and Ireland in Liberia map sections.
   Reads window.LBR_MAP (data/maps.js, built by tools/build_maps.py) and window.LBR (years, euro rates).
   Follows the page's Years and currency controls through the 'lbr-state' event that app.js sends on every render. */
(function () {
  'use strict';
  const M = window.LBR_MAP, D = window.LBR;
  if (!M || !D) return;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SVGNS = 'http://www.w3.org/2000/svg';
  const RAMP = ['var(--q1)', 'var(--q2)', 'var(--q3)', 'var(--q4)', 'var(--q5)'];
  const CRSY = D.meta.years, LASTY = CRSY[CRSY.length - 1];
  const ST = { y0: CRSY[0], y1: LASTY, cur: 'EUR' };
  const C = M.counties, NC = C.length;
  // county measures from the Demographic and Health Survey (data/indicators.js), shown with the census ones
  if (window.LBR_IND && window.LBR_IND.dhs && !M.cm.some((m) => m.src)) M.cm.push(...window.LBR_IND.dhs);

  function sv(tag, attrs, parent) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function svgBox(w, h) { const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', '0 0 ' + w + ' ' + h); s.setAttribute('role', 'img'); return s; }

  // ---------------------------------------------------------------- tooltip (the page's shared #tip)
  const tip = $('#tip');
  function showTip(ev, html) {
    tip.innerHTML = html; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
  }
  const hideTip = () => { tip.hidden = true; };
  function bindTip(node, html) {
    node.addEventListener('mousemove', (ev) => showTip(ev, typeof html === 'function' ? html() : html));
    node.addEventListener('mouseleave', hideTip);
  }

  // ---------------------------------------------------------------- numbers
  const nf = (v, dp) => Number(v).toLocaleString('en-IE', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  function fv(v, f) {
    if (v == null) return '—';
    if (f === 'n') return nf(Math.round(v), 0);
    if (f === 'p') return nf(v, 1) + '%';
    if (f === 'r') return nf(v, 3);
    return nf(v, v >= 1000 ? 0 : 1);
  }
  const short = (v) => (v >= 1e6 ? nf(v / 1e6, 1) + 'm' : v >= 1e3 ? nf(Math.round(v / 1e3), 0) + 'k' : nf(Math.round(v), 0));
  const sym = () => (ST.cur === 'USD' ? 'US$' : '€');
  const conv = (usd, y) => (ST.cur === 'USD' ? usd : usd / (D.meta.fx[y] || 1.1));
  function money(v) {
    const a = Math.abs(v);
    if (a >= 1e6) return sym() + nf(v / 1e6, a >= 1e8 ? 0 : 1) + 'm';
    if (a >= 1e3) return sym() + nf(Math.round(v / 1e3), 0) + 'k';
    return sym() + nf(Math.round(v), 0);
  }
  const pct = (a, b) => (b ? Math.round((100 * a) / b) + '%' : '—');

  /* Five classes with about the same number of places in each (values ranked), so one big county doesn't wash out the rest. */
  function classes(vals) {
    const s = vals.filter((v) => v != null && v > 0).sort((a, b) => a - b);
    if (!s.length) return { brk: [], col: () => 'var(--q0)' };
    const brk = [1, 2, 3, 4].map((i) => s[Math.min(s.length - 1, Math.floor((i * s.length) / 5))]);
    const uniq = brk.filter((b, i) => i === 0 || b > brk[i - 1]);
    return { brk: uniq, min: s[0], max: s[s.length - 1], col: (v) => (v == null || v <= 0 ? 'var(--q0)' : RAMP[Math.round((uniq.filter((b) => v >= b).length * 4) / Math.max(1, uniq.length))]) };
  }
  function scaleKey(box, cl, f, lead, zeroLab) {
    if (!cl.brk.length) { box.innerHTML = ''; return; }
    const edges = [cl.min].concat(cl.brk, [cl.max]);
    const items = [];
    for (let i = 0; i < edges.length - 1; i++) items.push('<span><i style="background:' + cl.col(edges[i] + 1e-9 > 0 ? (i === 0 ? cl.min : edges[i]) : 0) + '"></i>' + f(edges[i]) + '–' + f(edges[i + 1]) + '</span>');
    if (zeroLab) items.unshift('<span><i style="background:var(--q0)"></i>' + esc(zeroLab) + '</span>');
    box.innerHTML = (lead ? '<b>' + esc(lead) + '</b> ' : '') + items.join('');
  }

  /* Draw the outline map. opts: {fill(i), tip(i), click(i), sel, labels, under (extra layer before), over (extra layer after)} */
  function drawMap(box, items, opts) {
    box.innerHTML = '';
    const s = svgBox(M.w, M.h);
    s.setAttribute('aria-label', opts.label || 'Map of Liberia');
    const g = sv('g', { class: 'areas' }, s);
    items.forEach((it, i) => {
      const p = sv('path', { d: it.d, fill: opts.fill(i), class: 'area' + (opts.sel === i ? ' sel' : ''), tabindex: opts.click ? 0 : -1 }, g);
      bindTip(p, () => opts.tip(i));
      if (opts.click) {
        p.addEventListener('click', () => opts.click(i));
        p.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); opts.click(i); } });
      }
    });
    if (opts.outline) { const o = sv('g', { class: 'outline' }, s); C.forEach((c) => sv('path', { d: c.d }, o)); }
    if (opts.sel != null && opts.sel >= 0) sv('path', { d: items[opts.sel].d, class: 'selring' }, s);
    if (opts.over) opts.over(s);
    if (opts.labels) {
      const lg = sv('g', { class: 'maplbl' }, s);
      C.forEach((c) => { const t = sv('text', { x: c.c[0], y: c.c[1], 'text-anchor': 'middle' }, lg); t.textContent = c.n; });
    }
    box.appendChild(s);
  }

  // ================================================================ Census
  const CS = { m: 'poor', lv: 'c', sel: -1, grp: null };
  const cm = (k) => M.cm.find((x) => x.k === k);
  const dm = (k) => M.dm.find((x) => x.k === k);
  const CIRCLE = (m) => m.f === 'n' && m.k !== 'area'; // counts go on circles, not shaded areas

  function censusSelect() {
    const s = $('#cen-m');
    s.innerHTML = '';
    if (CS.lv === 'd') {
      M.dm.forEach((m) => s.appendChild(new Option(m.l, m.k)));
      if (!dm(CS.m)) CS.m = 'dens';
    } else {
      const groups = [];
      M.cm.forEach((m) => { if (!groups.includes(m.g)) groups.push(m.g); });
      groups.forEach((g) => {
        const og = document.createElement('optgroup'); og.label = g;
        M.cm.filter((m) => m.g === g).forEach((m) => og.appendChild(new Option(m.l, m.k)));
        s.appendChild(og);
      });
      if (!cm(CS.m)) CS.m = 'poor';
    }
    s.value = CS.m;
  }

  function renderCensus() {
    const box = $('#cen-map');
    if (!box) return;
    document.querySelectorAll('#cen-lv button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.l === CS.lv));
    const m = CS.lv === 'd' ? dm(CS.m) : cm(CS.m);
    const isD = CS.lv === 'd';
    const items = isD ? M.districts : C;
    const vals = m.v;
    const circles = CIRCLE(m);
    const cl = classes(vals);
    const where = isD ? 'district' : 'county';
    // the heading stays fixed; the measure is named in the caption under the buttons
    const src = isD ? 'LISGIS 2022 census, population by district (area measured from the LISGIS district boundaries).' : m.src || 'LISGIS 2022 census: ' + m.s + '.';
    $('#cen-note').textContent = (m.note ? m.note + ' ' : '') + (!isD && m.nat != null ? 'Liberia: ' + fv(m.nat, m.f) + '. ' : '') + src + (circles ? ' Circles are sized by the number; darker shading would only show which places are large.' : ' Five shades, each holding about the same number of ' + where.replace('y', 'ie') + 's.');
    const maxV = Math.max(...vals.filter((v) => v != null));
    const rad = (v) => Math.sqrt(Math.max(0, v) / maxV) * (isD ? 30 : 60);
    const tipOf = (i) => {
      const it = items[i];
      const parent = isD ? C[it.p].n + ' County' : 'Capital: ' + it.cap;
      return '<b>' + esc(it.n) + '</b><br>' + esc(parent) + '<br>' + esc(m.l) + ': <span class="tv">' + fv(vals[i], m.f) + '</span>' + (!isD && m.nat != null ? '<br>Liberia: ' + fv(m.nat, m.f) : '');
    };
    drawMap(box, items, {
      label: m.l + ' by ' + where + (m.src ? ', Liberia DHS 2019\u201320' : ', Liberia 2022 census'),
      fill: (i) => (circles ? 'var(--q0)' : cl.col(vals[i])),
      tip: tipOf,
      click: (i) => { CS.sel = isD ? items[i].p : i; renderCensus(); renderPanel(); },
      sel: isD ? null : CS.sel,
      outline: isD,
      labels: !isD,
      over: circles ? (s) => {
        const g = sv('g', { class: 'bubbles' }, s);
        items.map((it, i) => i).sort((a, b) => vals[b] - vals[a]).forEach((i) => {
          const c = sv('circle', { cx: items[i].c[0], cy: items[i].c[1], r: Math.max(2, rad(vals[i])) }, g);
          bindTip(c, () => tipOf(i));
          c.addEventListener('click', () => { CS.sel = isD ? items[i].p : i; renderCensus(); renderPanel(); });
        });
      } : null,
    });
    const key = $('#cen-scale');
    if (circles) {
      const ex = [maxV, maxV / 4].map((v) => Math.round(v / Math.pow(10, Math.floor(Math.log10(v)) - 1)) * Math.pow(10, Math.floor(Math.log10(v)) - 1));
      key.innerHTML = '<b>' + esc(m.l) + '</b> ' + ex.map((v) => '<span><svg width="' + (2 * rad(v) * 0.32 + 4) + '" height="' + (2 * rad(v) * 0.32 + 4) + '" aria-hidden="true"><circle cx="' + (rad(v) * 0.32 + 2) + '" cy="' + (rad(v) * 0.32 + 2) + '" r="' + rad(v) * 0.32 + '" class="keydot"/></svg>' + short(v) + '</span>').join('') + '<span class="note">(circle sizes are to scale with each other)</span>';
    } else scaleKey(key, cl, (v) => fv(v, m.f), m.l);
    renderRank(m, isD);
    renderTable();
  }

  function renderRank(m, isD) {
    const box = $('#cen-rank');
    const cmm = isD ? null : m;
    const rows = (isD ? M.districts : C).map((it, i) => ({ n: it.n, v: m.v[i], i })).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
    const show = isD ? rows.slice(0, 15) : rows;
    $('#cen-rank-h').textContent = isD ? m.l + ': the 15 highest districts' : m.l + ': counties ranked';
    box.innerHTML = '';
    const W = Math.max(320, box.clientWidth || 500), rh = 22, LW = 150, VW = 70, H = show.length * rh + 6;
    const s = svgBox(W, H);
    const max = Math.max(...show.map((r) => r.v), cmm && cmm.nat != null ? cmm.nat : 0, 1e-9);
    show.forEach((r, k) => {
      const y = 2 + k * rh;
      const g = sv('g', { class: 'row' }, s);
      sv('rect', { x: 0, y, width: W, height: rh, class: 'bg', fill: 'transparent' }, g);
      const t = sv('text', { x: LW - 8, y: y + rh / 2 + 4, 'text-anchor': 'end', class: 'lbl', 'font-weight': !isD && r.i === CS.sel ? 700 : 400 }, g);
      t.textContent = r.n.length > 22 ? r.n.slice(0, 21) + '…' : r.n;
      const bw = Math.max(1, ((W - LW - VW) * r.v) / max);
      sv('path', { d: 'M' + LW + ',' + (y + 5) + 'h' + Math.max(0, bw - 4) + 'q4,0 4,4v' + (rh - 18) + 'q0,4 -4,4h-' + Math.max(0, bw - 4) + 'z', fill: !isD && CS.sel >= 0 && r.i !== CS.sel ? 'var(--muted-mark)' : 'var(--lb-blue)', class: 'mk' }, g);
      const v = sv('text', { x: LW + bw + 6, y: y + rh / 2 + 4 }, g); v.textContent = fv(r.v, m.f);
      bindTip(g, '<b>' + esc(r.n) + '</b><br>' + esc(m.l) + ': <span class="tv">' + fv(r.v, m.f) + '</span>' + (isD ? '<br>' + esc(C[M.districts[r.i].p].n) + ' County' : ''));
      g.addEventListener('click', () => { CS.sel = isD ? M.districts[r.i].p : r.i; renderCensus(); renderPanel(); });
    });
    if (cmm && cmm.nat != null && m.f !== 'n') {
      const x = LW + ((W - LW - VW) * cmm.nat) / max;
      sv('line', { x1: x, x2: x, y1: 0, y2: H, class: 'natline' }, s);
      const t = sv('text', { x: x + 4, y: H - 4, class: 'natlbl' }, s); t.textContent = 'Liberia ' + fv(cmm.nat, m.f);
    }
    box.appendChild(s);
  }

  function renderTable() {
    const box = $('#cen-table');
    const m = CS.lv === 'd' ? null : cm(CS.m);
    const g = CS.grp || (m ? m.g : 'People');
    const tabs = $('#cen-tgrp');
    const groups = [];
    M.cm.forEach((x) => { if (!groups.includes(x.g)) groups.push(x.g); });
    tabs.innerHTML = groups.map((x) => '<button type="button" aria-pressed="' + (x === g) + '">' + esc(x.replace(/ \(.*/, '')) + '</button>').join('');
    tabs.querySelectorAll('button').forEach((b, i) => { b.onclick = () => { CS.grp = groups[i]; renderTable(); }; });
    const cols = M.cm.filter((x) => x.g === g);
    let sortK = box.dataset.sort && cols.some((c) => c.k === box.dataset.sort) ? box.dataset.sort : cols[0].k, dir = +(box.dataset.dir || -1);
    const rows = C.map((c, i) => ({ n: c.n, i })).sort((a, b) => {
      if (sortK === 'n') return a.n.localeCompare(b.n) * dir;
      const col = cols.find((c) => c.k === sortK);
      return ((col.v[a.i] || 0) - (col.v[b.i] || 0)) * dir;
    });
    let h = '<table><thead><tr><th scope="col" data-k="n"' + (sortK === 'n' ? ' aria-sort="' + (dir < 0 ? 'descending' : 'ascending') + '"' : '') + '>County</th>' + cols.map((c) => '<th scope="col" data-k="' + c.k + '"' + (c.k === sortK ? ' aria-sort="' + (dir < 0 ? 'descending' : 'ascending') + '"' : '') + '>' + esc(c.l) + '</th>').join('') + '</tr></thead><tbody>';
    rows.forEach((r) => { h += '<tr class="pick' + (r.i === CS.sel ? ' ie' : '') + '" data-i="' + r.i + '"><td>' + esc(r.n) + '</td>' + cols.map((c) => '<td>' + fv(c.v[r.i], c.f) + '</td>').join('') + '</tr>'; });
    h += '<tr class="tot"><td>Liberia</td>' + cols.map((c) => '<td>' + fv(c.nat, c.f) + '</td>').join('') + '</tr></tbody></table>';
    box.innerHTML = h;
    box.querySelectorAll('th').forEach((th) => { th.onclick = () => { const k = th.dataset.k; box.dataset.dir = k === sortK ? -dir : (k === 'n' ? 1 : -1); box.dataset.sort = k; renderTable(); }; });
    box.querySelectorAll('tr[data-i]').forEach((tr) => { tr.onclick = () => { CS.sel = +tr.dataset.i; renderCensus(); renderPanel(); $('#cen-map').scrollIntoView({ behavior: 'smooth', block: 'center' }); }; });
  }

  function pyramid(box, rows) {
    box.innerHTML = '';
    const W = 300, rh = 9, T = 4, H = T + rows.length * rh + 18, mid = W / 2, half = mid - 34;
    const s = svgBox(W, H);
    const tot = rows.reduce((a, r) => a + r[1] + r[2], 0);
    const max = Math.max(...rows.map((r) => Math.max(r[1], r[2]))) / tot;
    rows.slice().reverse().forEach((r, k) => {
      const y = T + k * rh, m = r[1] / tot, f = r[2] / tot;
      const wm = (half * m) / max, wf = (half * f) / max;
      sv('rect', { x: mid - 14 - wm, y: y + 1, width: wm, height: rh - 2, rx: 1.5, fill: 'var(--s1)' }, s);
      sv('rect', { x: mid + 14, y: y + 1, width: wf, height: rh - 2, rx: 1.5, fill: 'var(--s2)' }, s);
      if (k % 2 === 0 || k === rows.length - 1) { const t = sv('text', { x: mid, y: y + rh - 1.5, 'text-anchor': 'middle', class: 'age' }, s); t.textContent = r[0]; }
      const hit = sv('rect', { x: 0, y, width: W, height: rh, class: 'hit' }, s);
      bindTip(hit, '<b>Aged ' + esc(r[0]) + '</b><br>Men: <span class="tv">' + nf(r[1], 0) + '</span> (' + nf(100 * m, 1) + '%)<br>Women: <span class="tv">' + nf(r[2], 0) + '</span> (' + nf(100 * f, 1) + '%)');
    });
    const a = sv('text', { x: mid - 14, y: H - 4, 'text-anchor': 'end', class: 'age' }, s); a.textContent = 'Men';
    const b = sv('text', { x: mid + 14, y: H - 4, class: 'age' }, s); b.textContent = 'Women';
    box.appendChild(s);
  }

  function renderPanel() {
    const p = $('#cen-panel');
    const i = CS.sel;
    const pick = ['pop', 'share', 'dens', 'chg', 'urb', 'sexr', 'a014', 'hh', 'hhs', 'fhh', 'poor', 'mpi'];
    const row = (m, v) => '<tr><th scope="row">' + esc(m.l) + '</th><td>' + fv(v, m.f) + '</td>' + (i >= 0 ? '<td class="nat">' + fv(m.nat, m.f) + '</td>' : '') + '</tr>';
    const head = i >= 0 ? '<h3>' + esc(C[i].n) + ' County</h3><p class="note">Capital ' + esc(C[i].cap) + '. ' + (M.districts.filter((d) => d.p === i).length) + ' districts. <button type="button" class="linkbtn" id="cen-clear">Show Liberia</button></p>'
      : '<h3>Liberia</h3><p class="note">Click a county on the map, the chart or the table to see its figures.</p>';
    p.innerHTML = head + '<table class="facts"><thead><tr><th></th><th scope="col">' + (i >= 0 ? esc(C[i].n) : 'Liberia') + '</th>' + (i >= 0 ? '<th scope="col">Liberia</th>' : '') + '</tr></thead><tbody>' +
      pick.map((k) => { const m = cm(k); return row(m, i >= 0 ? m.v[i] : m.nat); }).join('') + '</tbody></table>' +
      '<h3>Age and sex</h3><div class="legend"><span><i style="background:var(--s1)"></i>Men</span><span><i style="background:var(--s2)"></i>Women</span></div><div class="chart pyr" id="cen-pyr"></div>';
    pyramid($('#cen-pyr'), M.pyr[i >= 0 ? C[i].k : 'LR'] || []);
    const cb = $('#cen-clear');
    if (cb) cb.onclick = () => { CS.sel = -1; renderCensus(); renderPanel(); };
  }

  function renderHist() {
    const box = $('#cen-hist');
    box.innerHTML = '';
    const pts = M.hist, W = Math.max(300, box.clientWidth || 420), H = 190, L = 40, R = 14, T = 22, B = 24;
    const s = svgBox(W, H);
    const max = 6e6, x0 = 1960, x1 = 2025;
    const X = (x) => L + ((x - x0) / (x1 - x0)) * (W - L - R), Y = (v) => T + (H - T - B) * (1 - v / max);
    const g = sv('g', { class: 'grid' }, s);
    [0, 2e6, 4e6, 6e6].forEach((v) => { sv('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v) }, g); const t = sv('text', { x: L - 6, y: Y(v) + 4, 'text-anchor': 'end' }, s); t.textContent = v ? v / 1e6 + 'm' : '0'; });
    sv('path', { d: 'M' + pts.map((p) => X(p[0]) + ',' + Y(p[1])).join('L'), fill: 'none', stroke: 'var(--lb-blue)', 'stroke-width': 2 }, s);
    pts.forEach((p) => {
      sv('circle', { cx: X(p[0]), cy: Y(p[1]), r: 4, fill: 'var(--lb-blue)', stroke: 'var(--panel)', 'stroke-width': 2 }, s);
      const t = sv('text', { x: X(p[0]), y: H - 6, 'text-anchor': 'middle' }, s); t.textContent = p[0];
      const v = sv('text', { x: X(p[0]), y: Y(p[1]) - 9, 'text-anchor': 'middle', class: 'lbl' }, s); v.textContent = nf(p[1] / 1e6, 1) + 'm';
      const hit = sv('circle', { cx: X(p[0]), cy: Y(p[1]), r: 14, class: 'hit' }, s);
      bindTip(hit, '<b>' + p[0] + ' census</b><br><span class="tv">' + nf(p[1], 0) + '</span> people');
    });
    box.appendChild(s);
  }

  function renderCensusTiles() {
    const v = (k) => cm(k).nat;
    const t = [
      { l: 'Population · 2022 census', b: nf(v('pop'), 0), s: '+' + nf(v('chg'), 1) + '% since 2008 (' + nf(v('agr'), 1) + '% a year)' },
      { l: 'Living in Montserrado', b: fv(cm('share').v[C.findIndex((c) => c.n === 'Montserrado')], 'p'), s: 'the county that includes Monrovia' },
      { l: 'Households', b: nf(v('hh'), 0), s: nf(v('hhs'), 1) + ' people each on average' },
      { l: 'Poor by the MPI', b: fv(v('poor'), 'p'), s: 'from ' + fv(Math.min(...cm('poor').v), 'p') + ' to ' + fv(Math.max(...cm('poor').v), 'p') + ' by county' },
      { l: 'Under 15', b: fv(v('a014'), 'p'), s: 'of the population; ' + fv(v('a65'), 'p') + ' are 65 or over' },
    ];
    $('#cen-tiles').innerHTML = t.map((x) => '<div class="card tile"><div class="tl">' + esc(x.l) + '</div><div class="big">' + x.b + '</div><div class="sub">' + esc(x.s) + '</div></div>').join('');
  }

  // ================================================================ Ireland in Liberia
  const IS = { mode: 't', f: 'all', sel: -1, shown: 10 };
  const KIND = { county: 'Names a county or town', region: 'Names a region only', national: 'National programme', unstated: 'Place not stated' };
  const inR = (y) => y >= ST.y0 && y <= Math.min(ST.y1, LASTY);
  const yrLab = () => { const a = ST.y0, b = Math.min(ST.y1, LASTY); return a > b ? '—' : a === b ? String(a) : a + '–' + b; };
  const pop = cm('pop').v;

  function ieRows() { return M.ie.filter((r) => inR(r[0])); }
  function byCounty(rows) {
    const v = new Array(NC).fill(0), n = new Array(NC).fill(0);
    rows.forEach((r) => { if (r[7].length) r[7].forEach((c) => { v[c] += conv(r[5], r[0]) / r[7].length; n[c]++; }); });
    return { v, n };
  }

  function renderIreland() {
    const box = $('#ie-map');
    if (!box) return;
    const rows = ieRows();
    const tot = rows.reduce((a, r) => a + conv(r[5], r[0]), 0);
    const k = {}; Object.keys(KIND).forEach((x) => { k[x] = rows.filter((r) => r[6] === x).reduce((a, r) => a + conv(r[5], r[0]), 0); });
    const tiles = [
      { l: 'Ireland · ' + yrLab(), b: money(tot), s: rows.length + ' project lines reported to the OECD' },
      { l: 'In named counties', b: money(k.county), s: pct(k.county, tot) + ' of the total: the project names its county or town' },
      { l: 'Regional', b: money(k.region), s: pct(k.region, tot) + ': names the south-east or north-west only' },
      { l: 'National', b: money(k.national), s: pct(k.national, tot) + ': government, elections, census, health pool fund' },
      { l: 'Place not stated', b: money(k.unstated), s: pct(k.unstated, tot) + ' of the total' },
    ];
    $('#ie-tiles').innerHTML = tiles.map((x) => '<div class="card tile"><div class="tl">' + esc(x.l) + '</div><div class="big">' + x.b + '</div><div class="sub">' + esc(x.s) + '</div></div>').join('');
    document.querySelectorAll('#ie-mode button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === IS.mode));
    const bc = byCounty(rows);
    const per = IS.mode === 'p';
    const val = bc.v.map((v, i) => (per ? v / pop[i] : v));
    const fmtv = (v) => (per ? sym() + nf(v, v < 1 ? 2 : 1) : money(v));
    const cl = classes(val);
    $('#ie-h').textContent = (per ? 'Irish funding per person' : 'Irish funding') + ' by county, ' + yrLab();
    $('#ie-note').textContent = 'Shading: the money for projects that name a county, county capital or larger town (or the south-east or north-west, spread over that region’s counties), split equally between the counties a project names.' + (per ? ' Divided by each county’s 2022 census population.' : '') + ' Dots: towns that projects name. National programmes and projects that don’t say where they are (' + pct(k.national + k.unstated, tot) + ' of the money) are not on the map; see the list below. Follows the Years and currency controls; the OECD has project detail to ' + LASTY + '.';
    const towns = {};
    rows.forEach((r) => r[8].forEach((t) => { towns[t] = towns[t] || { v: 0, n: 0 }; towns[t].v += conv(r[5], r[0]); towns[t].n++; }));
    const tipC = (i) => {
      const projs = rows.filter((r) => r[7].includes(i));
      return '<b>' + esc(C[i].n) + ' County</b><br>' + (projs.length ? 'Irish funding: <span class="tv">' + money(bc.v[i]) + '</span><br>Per person: ' + sym() + nf(bc.v[i] / pop[i], 2) + '<br>' + projs.length + ' project line' + (projs.length > 1 ? 's' : '') + (projs.some((r) => r[6] === 'region') ? ' (some regional, shared)' : '') : 'No project names this county in ' + yrLab());
    };
    drawMap(box, C, {
      label: 'Irish funding by county, Liberia, ' + yrLab(),
      fill: (i) => cl.col(val[i]),
      tip: tipC,
      click: (i) => { IS.sel = IS.sel === i ? -1 : i; IS.f = 'all'; IS.shown = 10; renderIreland(); },
      sel: IS.sel,
      labels: true,
      over: (s) => {
        const g = sv('g', { class: 'towns' }, s);
        Object.keys(towns).forEach((t) => {
          const p = M.towns[t]; if (!p) return;
          const c = sv('circle', { cx: p[0], cy: p[1], r: 7 }, g);
          bindTip(c, '<b>' + esc(t) + '</b><br>Named by ' + towns[t].n + ' project line' + (towns[t].n > 1 ? 's' : '') + '<br><span class="tv">' + money(towns[t].v) + '</span> (full amounts; most also name the county)');
        });
      },
    });
    scaleKey($('#ie-scale'), cl, fmtv, per ? 'Per person' : 'Irish funding', 'None named');
    $('#ie-scale').insertAdjacentHTML('beforeend', Object.keys(towns).length ? '<span><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" class="towndot"/></svg>Town named by a project</span>' : '');
    renderIePanel(rows, bc);
    renderIeList(rows);
  }

  function renderIePanel(rows, bc) {
    const p = $('#ie-panel');
    const i = IS.sel;
    let list, head;
    if (i >= 0) {
      list = rows.filter((r) => r[7].includes(i));
      head = '<h3>' + esc(C[i].n) + ' County</h3><p class="note">' + (list.length ? money(bc.v[i]) + ' from ' + list.length + ' project line' + (list.length > 1 ? 's' : '') + ' in ' + yrLab() + ' (each split between the counties it names). ' : 'No project names this county in ' + yrLab() + '. ') + 'Population ' + nf(pop[i], 0) + ', ' + fv(cm('poor').v[i], 'p') + ' poor by the MPI. <button type="button" class="linkbtn" id="ie-clear">Show all counties</button></p>';
    } else {
      list = rows.filter((r) => r[6] === 'county' || r[6] === 'region');
      const ranked = bc.v.map((v, k) => [k, v]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]);
      head = '<h3>Counties named, ' + yrLab() + '</h3><p class="note">Click a county for its projects.</p>' + (ranked.length ? '<ol class="ierank">' + ranked.map((x) => '<li><button type="button" class="linkbtn" data-c="' + x[0] + '">' + esc(C[x[0]].n) + '</button> <span class="tv">' + money(x[1]) + '</span></li>').join('') + '</ol>' : '<p class="note">No project names a county in these years.</p>');
    }
    p.innerHTML = head + (i >= 0 ? '<ul class="glist mini">' + list.slice(0, 8).map((r) => '<li><div class="gt"><b>' + esc(r[1]) + '</b><span class="ga">' + money(conv(r[5], r[0])) + '</span></div><div class="gm">' + r[0] + ' · ' + esc(r[3] || 'channel not given') + (r[6] === 'region' ? ' · ' + esc(r[9]) + (r[9].includes(' and ') ? ' regions' : ' region') : '') + '</div></li>').join('') + '</ul>' + (list.length > 8 ? '<p class="note">' + (list.length - 8) + ' more in the list below.</p>' : '') : '');
    p.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => { IS.sel = +b.dataset.c; renderIreland(); }; });
    const cb = $('#ie-clear');
    if (cb) cb.onclick = () => { IS.sel = -1; renderIreland(); };
  }

  function renderIeList(rows) {
    const f = $('#ie-f');
    const opts = [['all', 'All'], ['county', 'Named county'], ['region', 'Region'], ['national', 'National'], ['unstated', 'Not stated']];
    f.innerHTML = opts.map((o) => '<button type="button" data-f="' + o[0] + '" aria-pressed="' + (IS.f === o[0]) + '">' + o[1] + '</button>').join('');
    f.querySelectorAll('button').forEach((b) => { b.onclick = () => { IS.f = b.dataset.f; IS.shown = 10; renderIeList(ieRows()); }; });
    let L = rows.filter((r) => (IS.f === 'all' || r[6] === IS.f) && (IS.sel < 0 || r[7].includes(IS.sel)));
    L = L.slice().sort((a, b) => conv(b[5], b[0]) - conv(a[5], a[0]));
    const tot = L.reduce((a, r) => a + conv(r[5], r[0]), 0);
    $('#ie-sum').textContent = L.length + ' project lines, ' + money(tot) + ', ' + yrLab() + (IS.sel >= 0 ? ', naming ' + C[IS.sel].n + ' County' : '') + '. Largest first.';
    $('#ie-list').innerHTML = L.slice(0, IS.shown).map((r) => {
      const where = r[6] === 'county' ? r[7].map((c) => C[c].n).join(', ') + (r[8].length ? ' (' + r[8].join(', ') + ')' : '') : r[6] === 'region' ? r[9] + (r[9].includes(' and ') ? ' regions' : ' region') : KIND[r[6]];
      return '<li><div class="gt"><b>' + esc(r[1]) + '</b><span class="ga">' + money(conv(r[5], r[0])) + '</span></div>' +
        '<div class="gm"><span class="where w-' + r[6] + '">' + esc(where) + '</span> · ' + r[0] + ' · ' + esc(r[4]) + (r[3] ? ' · ' + esc(r[3]) : '') + '</div>' +
        (r[2] ? '<details><summary>Description</summary><p>' + esc(r[2]) + '</p></details>' : '') + '</li>';
    }).join('') || '<li class="note">No projects match.</li>';
    const more = $('#ie-more');
    more.hidden = L.length <= IS.shown;
    more.textContent = 'Show ' + Math.min(25, L.length - IS.shown) + ' more (' + (L.length - IS.shown) + ' not shown)';
    more.onclick = () => { IS.shown += 25; renderIeList(ieRows()); };
  }

  // ================================================================ wiring
  function init() {
    if (!$('#cen-map')) return;
    censusSelect();
    $('#cen-m').onchange = () => { CS.m = $('#cen-m').value; CS.grp = null; renderCensus(); };
    document.querySelectorAll('#cen-lv button').forEach((b) => { b.onclick = () => { CS.lv = b.dataset.l; censusSelect(); renderCensus(); }; });
    document.querySelectorAll('#ie-mode button').forEach((b) => { b.onclick = () => { IS.mode = b.dataset.m; renderIreland(); }; });
    renderCensusTiles(); renderCensus(); renderPanel(); renderHist(); renderIreland();
    let rt;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { renderCensus(); renderHist(); }, 200); });
  }
  addEventListener('lbr-state', (ev) => {
    const d = ev.detail || {};
    const ch = d.y0 !== ST.y0 || d.y1 !== ST.y1 || d.cur !== ST.cur;
    Object.assign(ST, d);
    if (ch && $('#ie-map') && $('#ie-map').firstChild) renderIreland();
  });
  if (window.LBR_STATE) Object.assign(ST, window.LBR_STATE);
  init();
})();
