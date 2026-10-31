/* Liberia aid data viewer. Reads window.LBR (data/data.js, built by tools/build_data.py). */
(function () {
  'use strict';
  const D = window.LBR;
  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs, html) => { const e = document.createElement(tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SVGNS = 'http://www.w3.org/2000/svg';
  const TYPE_COL = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];
  const IRELAND = D.donors.findIndex((d) => d.c === 'IRL');

  // ---------------------------------------------------------------- state
  // OECD CRS years, plus an estimate for the year after (2025) when the data has one: see tools/build_data.py
  const CRSY = D.meta.years, LASTY = CRSY[CRSY.length - 1];
  const EST = D.est && D.est.rows && D.est.rows.length ? D.est : null, EY = EST ? EST.y : null;
  const years = EST ? CRSY.concat([EY]) : CRSY;
  // donor-level rows: CRS plus the estimate (sector, channel and type unknown: -1)
  const DF = EST ? D.flows.concat(EST.rows.map((r) => [r[0], r[1], -1, -1, -1, r[2]])) : D.flows;
  const ylab = (y) => (y === EY ? y + '*' : String(y));
  const estNote = () => (EST ? '* ' + EY + ' is an estimate for the ' + EST.rows.length + ' donors that gave ' + Math.round(EST.cover * 100) + '% of ' + LASTY + '\u2019s aid, until the OECD publishes ' + EY + ': each donor\u2019s ' + LASTY + ' OECD figure moved by the change in what it has published to IATI for Liberia so far. Other donors are left out, so it understates the total.' : '');
  const crsYs = (ys) => ys.filter((y) => y <= LASTY);
  const S = { y0: years[Math.max(0, years.length - 5)], y1: years[years.length - 1], cur: 'EUR', donor: -1 };
  try {
    const p = new URLSearchParams(location.search);
    if (p.get('cur') === 'USD') S.cur = 'USD';
    if (years.includes(+p.get('from'))) S.y0 = +p.get('from');
    if (years.includes(+p.get('to'))) S.y1 = +p.get('to');
    const dn = p.get('donor');
    if (dn) { const i = D.donors.findIndex((d) => d.c === dn); if (i >= 0) S.donor = i; }
  } catch (e) { /* ignore */ }

  function saveUrl() {
    const p = new URLSearchParams();
    p.set('from', S.y0); p.set('to', S.y1);
    if (S.cur === 'USD') p.set('cur', 'USD');
    if (S.donor >= 0) p.set('donor', D.donors[S.donor].c);
    try { history.replaceState(null, '', '?' + p.toString() + location.hash); } catch (e) { /* file:// */ }
  }

  // ---------------------------------------------------------------- money
  const conv = (usd, y) => (S.cur === 'USD' ? usd : usd / (D.meta.fx[y] || 1.1));
  const sym = () => (S.cur === 'USD' ? 'US$' : '€');
  function fmt(v, dp) {
    const a = Math.abs(v);
    if (a >= 1e9) return sym() + (v / 1e9).toFixed(dp == null ? 2 : dp) + 'bn';
    if (a >= 1e6) return sym() + (v / 1e6).toFixed(dp == null ? (a >= 1e8 ? 0 : 1) : dp) + 'm';
    if (a >= 1e3) return sym() + Math.round(v / 1e3) + 'k';
    return sym() + Math.round(v);
  }
  const fmtAxis = (v) => (v === 0 ? '0' : fmt(v, v >= 1e9 ? 1 : 0));
  const pct = (a, b) => (b ? Math.round((100 * a) / b) + '%' : '—');
  const inRange = (y) => y >= S.y0 && y <= S.y1;
  const rangeLab = () => (S.y0 === S.y1 ? String(S.y0) : S.y0 + '–' + S.y1);

  // ---------------------------------------------------------------- tooltip
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

  // ---------------------------------------------------------------- svg helpers
  function svg(w, h) { const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', '0 0 ' + w + ' ' + h); s.setAttribute('role', 'img'); return s; }
  function sv(tag, attrs, parent) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return ([1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].find((s) => n <= s)) * p; }
  // rounded top for the data end, flat at the baseline
  function topRound(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    if (h <= 0) return '';
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }
  function rightRound(x, y, w, h, r) {
    r = Math.min(r, h / 2, w);
    if (w <= 0) return '';
    return 'M' + x + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h - r) + 'Q' + (x + w) + ',' + (y + h) + ' ' + (x + w - r) + ',' + (y + h) + 'H' + x + 'Z';
  }

  /* Stacked vertical bars. cols: [{x, segs:[{v, col, name}], tip}]; line: optional [{x, v}] reference series. */
  function vbars(box, cols, opt) {
    opt = opt || {};
    box.innerHTML = '';
    const W = Math.max(320, box.clientWidth || 600), H = opt.h || 250, L = 56, R = 8, T = 10, B = 26;
    const max = niceMax(Math.max(1, ...cols.map((c) => c.segs.reduce((a, s) => a + s.v, 0)), ...(opt.line || []).map((p) => p.v)));
    const s = svg(W, H);
    const iw = W - L - R, ih = H - T - B;
    const g = sv('g', { class: 'grid' }, s);
    for (let i = 0; i <= 4; i++) {
      const y = T + ih - (ih * i) / 4;
      sv('line', { x1: L, x2: W - R, y1: y, y2: y }, g);
      const t = sv('text', { x: L - 6, y: y + 4, 'text-anchor': 'end' }, s); t.textContent = fmtAxis((max * i) / 4);
    }
    const bw = iw / cols.length, gap = Math.min(10, bw * 0.25), w = bw - gap;
    cols.forEach((c, i) => {
      const x = L + i * bw + gap / 2;
      let acc = 0;
      const n = c.segs.filter((sg) => sg.v > 0).length;
      let k = 0;
      c.segs.forEach((sg) => {
        if (sg.v <= 0) return;
        k++;
        const h = (ih * sg.v) / max, y = T + ih - ((acc + sg.v) * ih) / max;
        const hh = Math.max(0, h - (k < n ? 2 : 0)); // 2px surface gap between stacked segments
        const yy = y + (h - hh);
        const op = c.x === EY ? { 'fill-opacity': 0.45 } : {};
        if (k === n) sv('path', Object.assign({ d: topRound(x, yy, w, hh, 4), fill: sg.col }, op), s);
        else sv('rect', Object.assign({ x: x, y: yy, width: w, height: hh, fill: sg.col }, op), s);
        acc += sg.v;
      });
      const t = sv('text', { x: x + w / 2, y: H - 8, 'text-anchor': 'middle' }, s); t.textContent = typeof c.x === 'number' ? ylab(c.x) : c.x;
      const hit = sv('rect', { x: L + i * bw, y: T, width: bw, height: ih, class: 'hit' }, s);
      bindTip(hit, c.tip);
    });
    sv('line', { x1: L, x2: W - R, y1: T + ih, y2: T + ih, class: 'base' }, s);
    if (opt.line && opt.line.length) {
      const pts = opt.line.map((p) => { const i = cols.findIndex((c) => c.x === p.x); return [L + i * bw + bw / 2, T + ih - (ih * p.v) / max]; }).filter((p) => p[0] >= L);
      sv('path', { d: 'M' + pts.map((p) => p.join(',')).join('L'), fill: 'none', stroke: 'var(--fg)', 'stroke-width': 2, 'stroke-dasharray': '5 4', 'pointer-events': 'none' }, s);
      pts.forEach((p) => sv('circle', { cx: p[0], cy: p[1], r: 4, fill: 'var(--fg)', stroke: 'var(--panel)', 'stroke-width': 2, 'pointer-events': 'none' }, s));
    }
    box.appendChild(s);
  }

  /* Horizontal bars. rows: [{name, v, col, tip, click, bold}] */
  function hbars(box, rows, opt) {
    opt = opt || {};
    box.innerHTML = '';
    if (!rows.length) { box.innerHTML = '<p class="note">Nothing to show for this selection.</p>'; return; }
    const W = Math.max(320, box.clientWidth || 600), rh = 24, T = 4, H = T + rows.length * rh + 4;
    const LW = Math.min(opt.lw || 210, W * 0.42), VW = 64;
    const max = Math.max(...rows.map((r) => r.v), 1);
    const s = svg(W, H);
    rows.forEach((r, i) => {
      const y = T + i * rh;
      const g = sv('g', { class: 'row' }, s);
      sv('rect', { x: 0, y: y, width: W, height: rh, class: 'bg', fill: 'transparent' }, g);
      const mc = Math.floor((LW - 10) / 6.0), name = r.name.length > mc ? r.name.slice(0, mc - 1).trim() + '…' : r.name;
      const t = sv('text', { x: LW - 8, y: y + rh / 2 + 4, 'text-anchor': 'end', class: 'lbl', 'font-weight': r.bold ? 700 : 400 }, g); t.textContent = name;
      const bw = Math.max(1, ((W - LW - VW) * r.v) / max);
      sv('path', { d: rightRound(LW, y + 5, bw, rh - 10, 4), fill: r.col || 'var(--s1)', class: 'mk' }, g);
      const v = sv('text', { x: LW + bw + 6, y: y + rh / 2 + 4 }, g); v.textContent = r.lab || fmt(r.v);
      bindTip(g, r.tip || '<b>' + esc(r.name) + '</b><br><span class="tv">' + fmt(r.v) + '</span>');
      if (r.click) g.addEventListener('click', r.click); else g.style.cursor = 'default';
    });
    sv('line', { x1: LW, x2: LW, y1: T, y2: H - 4, class: 'base' }, s);
    box.appendChild(s);
  }

  /* Simple line (single series, its own units). pts: [{x, v}] */
  function line(box, pts, fv) {
    box.innerHTML = '';
    pts = pts.filter((p) => p.v != null);
    if (!pts.length) { box.innerHTML = '<p class="note">No data.</p>'; return; }
    const W = Math.max(280, box.clientWidth || 400), H = 170, L = 44, R = 12, T = 10, B = 24;
    const max = niceMax(Math.max(...pts.map((p) => p.v)));
    const xs = pts.map((p) => p.x), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const X = (x) => L + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * (W - L - R), Y = (v) => T + (H - T - B) * (1 - v / max);
    const s = svg(W, H);
    const g = sv('g', { class: 'grid' }, s);
    for (let i = 0; i <= 3; i++) { const y = Y((max * i) / 3); sv('line', { x1: L, x2: W - R, y1: y, y2: y }, g); const t = sv('text', { x: L - 6, y: y + 4, 'text-anchor': 'end' }, s); t.textContent = fv((max * i) / 3, true); }
    const step = Math.ceil(pts.length / 8);
    pts.forEach((p, i) => { if (i % step === 0 || i === pts.length - 1) { const t = sv('text', { x: X(p.x), y: H - 6, 'text-anchor': 'middle' }, s); t.textContent = p.x; } });
    sv('path', { d: 'M' + pts.map((p) => X(p.x) + ',' + Y(p.v)).join('L'), fill: 'none', stroke: 'var(--s1)', 'stroke-width': 2 }, s);
    const last = pts[pts.length - 1];
    sv('circle', { cx: X(last.x), cy: Y(last.v), r: 4, fill: 'var(--s1)', stroke: 'var(--panel)', 'stroke-width': 2 }, s);
    const lt = sv('text', { x: X(last.x) - 6, y: Y(last.v) - 8, 'text-anchor': 'end', class: 'lbl' }, s); lt.textContent = fv(last.v);
    // crosshair
    const cross = sv('line', { y1: T, y2: H - B, stroke: 'var(--ref)', 'stroke-width': 1, visibility: 'hidden' }, s);
    const dot = sv('circle', { r: 4, fill: 'var(--s1)', stroke: 'var(--panel)', 'stroke-width': 2, visibility: 'hidden' }, s);
    const hit = sv('rect', { x: L, y: T, width: W - L - R, height: H - T - B, class: 'hit' }, s);
    hit.addEventListener('mousemove', (ev) => {
      const r = s.getBoundingClientRect(), mx = ((ev.clientX - r.left) / r.width) * W;
      let best = pts[0];
      pts.forEach((p) => { if (Math.abs(X(p.x) - mx) < Math.abs(X(best.x) - mx)) best = p; });
      cross.setAttribute('x1', X(best.x)); cross.setAttribute('x2', X(best.x)); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', X(best.x)); dot.setAttribute('cy', Y(best.v)); dot.setAttribute('visibility', 'visible');
      showTip(ev, '<b>' + best.x + '</b><br><span class="tv">' + fv(best.v) + '</span>');
    });
    hit.addEventListener('mouseleave', () => { hideTip(); cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); });
    box.appendChild(s);
  }

  function legend(box, items) { box.innerHTML = items.map((i) => '<span><i style="background:' + i.col + '"></i>' + esc(i.name) + '</span>').join(''); }

  /* Sortable table. cols: [{h, k, num, fmt}], rows: objects. */
  function table(box, cols, rows, opt) {
    opt = opt || {};
    let sortK = opt.sort || cols[cols.length - 1].k, dir = -1, limit = opt.limit || 1e9;
    function draw() {
      const rs = rows.slice().sort((a, b) => { const x = a[sortK], y = b[sortK]; return (typeof x === 'string' ? x.localeCompare(y) : (x || 0) - (y || 0)) * dir; });
      const t = el('table');
      const tr = el('tr');
      cols.forEach((c) => { const th = el('th', { scope: 'col' }, esc(c.h)); if (c.k === sortK) th.setAttribute('aria-sort', dir < 0 ? 'descending' : 'ascending'); th.onclick = () => { if (sortK === c.k) dir = -dir; else { sortK = c.k; dir = c.num ? -1 : 1; } draw(); }; tr.appendChild(th); });
      t.appendChild(el('thead')).appendChild(tr);
      const tb = el('tbody');
      rs.slice(0, limit).forEach((r) => {
        const row = el('tr', r._cls ? { class: r._cls } : null);
        cols.forEach((c) => { row.appendChild(el('td', null, c.fmt ? c.fmt(r[c.k], r) : esc(r[c.k]))); });
        if (r._click) { row.classList.add('pick'); row.onclick = r._click; }
        tb.appendChild(row);
      });
      t.appendChild(tb);
      box.innerHTML = '';
      box.appendChild(t);
      if (rs.length > limit) {
        const b = el('button', { type: 'button', class: 'more-btn' }, 'Show all ' + rs.length);
        b.onclick = () => { limit = 1e9; draw(); };
        box.appendChild(b);
      }
    }
    draw();
  }

  // ---------------------------------------------------------------- aggregation
  function flows(filter) {
    return D.flows.filter((f) => inRange(f[0]) && (S.donor < 0 || f[1] === S.donor) && (!filter || filter(f)));
  }
  function sumBy(rows, keyFn) {
    const m = new Map();
    rows.forEach((f) => { const k = keyFn(f); m.set(k, (m.get(k) || 0) + conv(f[5], f[0])); });
    return m;
  }
  const yrsSel = () => years.filter(inRange);

  // ---------------------------------------------------------------- render
  function render() {
    saveUrl();
    window.LBR_STATE = { y0: S.y0, y1: S.y1, cur: S.cur }; // for the map sections (mapview.js)
    dispatchEvent(new CustomEvent('lbr-state', { detail: window.LBR_STATE }));
    document.querySelectorAll('.yr-lab').forEach((e) => { e.textContent = rangeLab(); });
    const crsLab = S.y0 > LASTY ? '—' : S.y0 === Math.min(S.y1, LASTY) ? String(S.y0) : S.y0 + '–' + Math.min(S.y1, LASTY);
    document.querySelectorAll('.yr-lab-crs').forEach((e) => { e.textContent = crsLab; });
    document.querySelectorAll('.crs-only').forEach((e) => { e.textContent = inRange(EY) ? EY + ' isn\u2019t broken down yet: these figures cover ' + crsLab + '.' : ''; });
    const dn = S.donor >= 0 ? D.donors[S.donor].n : '';
    document.querySelectorAll('.dn-lab').forEach((e) => { e.textContent = dn ? 'Showing ' + dn + ' only.' : ''; });
    $('#dnote').hidden = S.donor < 0;
    $('#dnote-n').textContent = dn;
    $('#dsel').value = S.donor;
    document.querySelectorAll('#cur button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.c === S.cur));
    document.querySelectorAll('#ypreset button').forEach((b) => {
      const n = +b.dataset.n, on = n === 0 ? S.y0 === years[0] && S.y1 === years[years.length - 1] : S.y1 === years[years.length - 1] && S.y0 === years[years.length - n];
      b.setAttribute('aria-pressed', on);
    });
    $('#yfrom').value = S.y0; $('#yto').value = S.y1;
    renderTake(); renderTiles(); renderTrend(); renderCtx(); renderDonors(); renderSectors(); renderChannels(); renderGrants(true); renderIati();
  }

  function renderTake() {
    const y = LASTY;
    const tot = D.flows.filter((f) => f[0] === y).reduce((a, f) => a + conv(f[5], y), 0);
    const nd = new Set(D.flows.filter((f) => f[0] === y && f[5] > 0).map((f) => f[1])).size;
    $('#take').innerHTML = 'Liberia received <b>' + fmt(tot) + '</b> in aid in ' + y + ' from ' + nd + ' donors.';
    $('#upd').textContent = D.meta.updated;
  }

  function renderTiles() {
    const ys = yrsSel(), y0 = S.y0, isEst = S.y1 === EY, y1 = isEst ? LASTY : S.y1;
    const f = flows();
    const byY = sumBy(DF.filter((r) => inRange(r[0]) && (S.donor < 0 || r[1] === S.donor)), (r) => r[0]);
    const total = ys.reduce((a, y) => a + (byY.get(y) || 0), 0);
    const byD = sumBy(D.flows.filter((r) => r[0] === y1 && (S.donor < 0 || r[1] === S.donor)), (r) => r[1]);
    const top = [...byD.entries()].sort((a, b) => b[1] - a[1])[0];
    const last = byY.get(y1) || 0, first = byY.get(y0) || 0;
    const ch = first ? Math.round((100 * (last - first)) / first) : null;
    const tiles = [];
    if (isEst) tiles.push({ l: (S.donor >= 0 ? D.donors[S.donor].n : 'Aid received') + ' · ' + EY + '*', b: byY.get(EY) ? fmt(byY.get(EY)) : '—', s: S.donor >= 0 ? (byY.get(EY) ? 'Estimate from its ' + LASTY + ' OECD figure and its IATI reports' : 'No estimate for this donor yet') : 'Estimate for donors that gave ' + Math.round(EST.cover * 100) + '% of ' + LASTY + '\u2019s aid' });
    tiles.push({ l: (S.donor >= 0 ? D.donors[S.donor].n : 'Aid received') + ' · ' + y1, b: fmt(last), s: y0 < y1 && ch != null ? (ch >= 0 ? '+' : '') + ch + '% since ' + y0 : 'Gross disbursements, OECD CRS' });
    if (y0 < y1 && !isEst) tiles.push({ l: 'Total · ' + rangeLab(), b: fmt(total), s: 'Average ' + fmt(total / ys.length) + ' a year' });
    if (S.donor < 0) {
      tiles.push({ l: 'Largest donor · ' + y1, b: top ? esc(D.donors[top[0]].n) : '—', s: top ? fmt(top[1]) + ', ' + pct(top[1], last) + ' of the total' : '' });
      tiles.push({ l: 'Donors · ' + y1, b: String(byD.size), s: 'reporting disbursements to the OECD' });
      if (IRELAND >= 0) {
        const all = sumBy(D.flows.filter((r) => r[0] === y1), (r) => r[1]);
        const rank = [...all.entries()].sort((a, b) => b[1] - a[1]).findIndex((e) => e[0] === IRELAND);
        const ie = all.get(IRELAND) || 0;
        tiles.push({ l: 'Ireland · ' + y1, b: fmt(ie), s: rank >= 0 ? 'Number ' + (rank + 1) + ' of ' + all.size + ' donors, ' + pct(ie, last) + ' of the total' : 'Not among reporting donors' });
      }
    } else {
      const all = sumBy(D.flows.filter((r) => r[0] === y1), (r) => r[1]);
      const tot = [...all.values()].reduce((a, b) => a + b, 0);
      const rank = [...all.entries()].sort((a, b) => b[1] - a[1]).findIndex((e) => e[0] === S.donor);
      tiles.push({ l: 'Share of all aid · ' + y1, b: pct(all.get(S.donor) || 0, tot), s: rank >= 0 ? 'Number ' + (rank + 1) + ' of ' + all.size + ' donors' : '' });
      const bs = sumBy(f, (r) => r[2]);
      const ts = [...bs.entries()].sort((a, b) => b[1] - a[1])[0];
      const crsTot = [...bs.values()].reduce((x, v) => x + v, 0);
      tiles.push({ l: 'Main sector · ' + (inRange(EY) ? (S.y0 === y1 ? String(S.y0) : S.y0 + '–' + y1) : rangeLab()), b: ts ? esc(D.sectors[ts[0]]) : '—', s: ts ? fmt(ts[1]) + ', ' + pct(ts[1], crsTot) : '' });
    }
    $('#tiles').innerHTML = tiles.map((t) => '<div class="card tile"><div class="tl">' + esc(t.l) + '</div><div class="big">' + t.b + '</div><div class="sub">' + t.s + '</div></div>').join('');
  }

  function renderTrend() {
    const ys = yrsSel();
    const showYs = ys.length > 1 ? ys : years;
    const f = DF.filter((r) => showYs.includes(r[0]) && (S.donor < 0 || r[1] === S.donor));
    let cols, leg, line = null;
    if (S.donor >= 0) {
      const byY = sumBy(f, (r) => r[0]);
      cols = showYs.map((y) => ({ x: y, segs: [{ v: byY.get(y) || 0, col: 'var(--s1)' }], tip: '<b>' + ylab(y) + '</b><br>' + esc(D.donors[S.donor].n) + ': <span class="tv">' + (y === EY && !byY.get(y) ? 'no estimate yet' : fmt(byY.get(y) || 0)) + '</span>' + (y === EY ? '<br>Estimate, see the note below' : '') }));
      leg = [];
      $('#trend-h').textContent = D.donors[S.donor].n + ': aid to Liberia by year';
      $('#trend-note').textContent = 'Gross disbursements reported to the OECD Creditor Reporting System.' + (showYs.includes(EY) ? ' ' + estNote() : '');
    } else {
      const m = sumBy(f, (r) => r[0] + '|' + D.donors[r[1]].t);
      cols = showYs.map((y) => {
        const segs = D.types.map((t, i) => ({ v: m.get(y + '|' + i) || 0, col: TYPE_COL[i], name: t }));
        const tot = segs.reduce((a, s) => a + s.v, 0);
        const dac = D.dac2a[y];
        return { x: y, segs, tip: '<b>' + ylab(y) + '</b>' + (y === EY ? ' (estimate)' : '') + ' · <span class="tv">' + fmt(tot) + '</span><br>' + segs.filter((s) => s.v).map((s) => esc(s.name) + ': <span class="tv">' + fmt(s.v) + '</span>').join('<br>') + (dac ? '<br>Net ODA (DAC2A): <span class="tv">' + fmt(conv(dac.net, y)) + '</span>' : '') };
      });
      line = showYs.filter((y) => D.dac2a[y]).map((y) => ({ x: y, v: conv(D.dac2a[y].net, y) }));
      leg = D.types.map((t, i) => ({ name: t, col: TYPE_COL[i] }));
      if (line.length) leg.push({ name: 'Net ODA, all donors (OECD DAC2A)', col: 'var(--fg)' });
      $('#trend-h').textContent = 'Aid received by year';
      $('#trend-note').textContent = 'Bars: gross disbursements by type of donor (OECD CRS project data: ODA from countries and multilateral organisations, plus private foundations). Dashed line: net ODA from all donors (OECD DAC2A), which subtracts loan repayments and counts some flows the CRS leaves out.' + (ys.length > 1 ? '' : ' Showing all years.') + (showYs.includes(EY) ? ' ' + estNote() : '');
    }
    legend($('#trend-leg'), leg);
    vbars($('#c-trend'), cols, { line });
  }

  function renderCtx() {
    const ys = Object.keys(D.dac2a).map(Number).sort((a, b) => a - b);
    $('#ctx-y').textContent = ys[ys.length - 1];
    const pts = (k) => ys.filter((y) => D.dac2a[y][k] != null).map((y) => ({ x: y, v: D.dac2a[y][k] }));
    const usd = (v, ax) => 'US$' + (v >= 1e9 ? (v / 1e9).toFixed(ax ? 1 : 2) + 'bn' : Math.round(v / 1e6) + 'm');
    line($('#c-net'), pts('net'), usd);
    line($('#c-gni'), pts('pct_gni'), (v, ax) => v.toFixed(ax ? 0 : 1) + '%');
    line($('#c-pc'), pts('per_capita'), (v) => 'US$' + Math.round(v));
  }

  function selectDonor(i) { S.donor = i; render(); }

  function renderDonors() {
    const ys = yrsSel();
    const f = DF.filter((r) => inRange(r[0]));
    const byD = sumBy(f, (r) => r[1]);
    const tot = [...byD.values()].reduce((a, b) => a + b, 0);
    const ranked = [...byD.entries()].filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]);
    const top = ranked.slice(0, 15);
    if (IRELAND >= 0 && !top.some((e) => e[0] === IRELAND)) { const ie = ranked.find((e) => e[0] === IRELAND); if (ie) top.push(ie); }
    const typeLeg = D.types.map((t, i) => ({ name: t, col: TYPE_COL[i] }));
    legend($('#type-leg'), typeLeg);
    legend($('#type-leg2'), typeLeg);
    hbars($('#c-donors'), top.map(([d, v]) => ({
      name: D.donors[d].n, v, col: S.donor >= 0 && S.donor !== d ? 'var(--muted-mark)' : TYPE_COL[D.donors[d].t], bold: d === IRELAND,
      tip: '<b>' + esc(D.donors[d].n) + '</b><br>' + esc(D.types[D.donors[d].t]) + '<br><span class="tv">' + fmt(v) + '</span>, ' + pct(v, tot) + ' of the total' + (d === IRELAND ? '<br>Rank ' + (ranked.findIndex((e) => e[0] === d) + 1) + ' of ' + ranked.length : ''),
      click: () => selectDonor(S.donor === d ? -1 : d),
    })), { lw: 230 });
    // by type, share of total per year
    const showYs = ys.length > 1 ? ys : years;
    const m = sumBy(DF.filter((r) => showYs.includes(r[0])), (r) => r[0] + '|' + D.donors[r[1]].t);
    vbars($('#c-types'), showYs.map((y) => {
      const segs = D.types.map((t, i) => ({ v: m.get(y + '|' + i) || 0, col: TYPE_COL[i], name: t }));
      const t = segs.reduce((a, s) => a + s.v, 0);
      return { x: y, segs, tip: '<b>' + ylab(y) + '</b>' + (y === EY ? ' (estimate)' : '') + '<br>' + segs.filter((s) => s.v).map((s) => esc(s.name) + ': <span class="tv">' + fmt(s.v) + '</span> (' + pct(s.v, t) + ')').join('<br>') };
    }), { h: 230 });
    // table
    const byDY = sumBy(f, (r) => r[1] + '|' + r[0]);
    const cols = [{ h: 'Donor', k: 'name', fmt: (v, r) => '<span class="ty" style="background:' + TYPE_COL[r.t] + '"></span>' + esc(v) }, { h: 'Type', k: 'type' }];
    ys.forEach((y) => cols.push({ h: ylab(y), k: 'y' + y, num: true, fmt: (v) => (v ? fmt(v) : '') }));
    if (ys.length > 1) cols.push({ h: 'Total', k: 'total', num: true, fmt: (v) => fmt(v) });
    cols.push({ h: 'Share', k: 'share', num: true, fmt: (v) => (v >= 0.0005 ? (v * 100).toFixed(1) + '%' : '<0.1%') });
    const rows = ranked.map(([d, v]) => {
      const r = { name: D.donors[d].n, t: D.donors[d].t, type: D.types[D.donors[d].t], total: v, share: v / tot, _click: () => { selectDonor(d); $('#overview').scrollIntoView({ behavior: 'smooth' }); } };
      ys.forEach((y) => { r['y' + y] = byDY.get(d + '|' + y) || 0; });
      if (ys.length === 1) r.total = v;
      if (d === IRELAND) r._cls = 'ie';
      return r;
    });
    table($('#t-donors'), cols, rows, { sort: ys.length > 1 ? 'total' : 'y' + ys[0], limit: 10 });
    const ieR = ranked.findIndex((e) => e[0] === IRELAND);
    $('#ie-note').textContent = (ieR >= 0 ? 'Ireland (in bold) is number ' + (ieR + 1) + ' of ' + ranked.length + ' over ' + rangeLab() + '.' : '') + (inRange(EY) ? ' ' + estNote() : '');
  }

  function topN(map, n, labels) {
    const e = [...map.entries()].filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]);
    return e.slice(0, n).map(([k, v]) => ({ k, name: labels[k], v }));
  }

  function renderSectors() {
    const f = flows();
    const bs = sumBy(f, (r) => r[2]);
    const tot = [...bs.values()].reduce((a, b) => a + b, 0);
    hbars($('#c-sectors'), topN(bs, 20, D.sectors).map((r) => ({ name: r.name, v: r.v, tip: '<b>' + esc(r.name) + '</b><br><span class="tv">' + fmt(r.v) + '</span>, ' + pct(r.v, tot), click: () => { $('#gsec').value = r.k; renderGrants(true); $('#grants').scrollIntoView({ behavior: 'smooth' }); } })), { lw: 220 });
    const ys = crsYs(yrsSel().length > 1 ? yrsSel() : years);
    const all = D.flows.filter((r) => ys.includes(r[0]) && (S.donor < 0 || r[1] === S.donor));
    const t5 = topN(sumBy(all, (r) => r[2]), 5, D.sectors).map((r) => r.k);
    const m = sumBy(all, (r) => r[0] + '|' + (t5.includes(r[2]) ? r[2] : -1));
    const series = t5.map((k, i) => ({ k, name: D.sectors[k], col: 'var(--s' + (i + 1) + ')' })).concat([{ k: -1, name: 'Other', col: 'var(--muted-mark)' }]);
    legend($('#sec-leg'), series);
    vbars($('#c-sectrend'), ys.map((y) => {
      const segs = series.map((s) => ({ v: m.get(y + '|' + s.k) || 0, col: s.col, name: s.name }));
      return { x: y, segs, tip: '<b>' + y + '</b><br>' + segs.filter((s) => s.v).map((s) => esc(s.name) + ': <span class="tv">' + fmt(s.v) + '</span>').join('<br>') };
    }), { h: 250 });
    const yr = crsYs(yrsSel());
    const by = sumBy(f, (r) => r[2] + '|' + r[0]);
    const cols = [{ h: 'Sector', k: 'name' }];
    yr.forEach((y) => cols.push({ h: String(y), k: 'y' + y, num: true, fmt: (v) => (v ? fmt(v) : '') }));
    cols.push({ h: yr.length > 1 ? 'Total' : 'Amount', k: 'total', num: true, fmt: (v) => fmt(v) }, { h: 'Share', k: 'share', num: true, fmt: (v) => (v * 100).toFixed(1) + '%' });
    table($('#t-sectors'), cols, [...bs.entries()].filter((e) => e[1] > 0).map(([k, v]) => { const r = { name: D.sectors[k], total: v, share: v / tot }; yr.forEach((y) => { r['y' + y] = by.get(k + '|' + y) || 0; }); return r; }), { sort: 'total', limit: 10 });
  }

  function renderChannels() {
    const f = flows();
    const bc = sumBy(f, (r) => r[3]);
    const tot = [...bc.values()].reduce((a, b) => a + b, 0);
    hbars($('#c-channels'), topN(bc, 15, D.channels).map((r) => ({ name: r.name, v: r.v, col: 'var(--s3)', tip: '<b>' + esc(r.name) + '</b><br><span class="tv">' + fmt(r.v) + '</span>, ' + pct(r.v, tot), click: () => { $('#gch').value = r.k; renderGrants(true); $('#grants').scrollIntoView({ behavior: 'smooth' }); } })), { lw: 230 });
    const bm = sumBy(f, (r) => r[4]);
    const tm = [...bm.values()].reduce((a, b) => a + b, 0);
    hbars($('#c-modal'), topN(bm, 12, D.modal).map((r) => ({ name: r.name, v: r.v, col: 'var(--s7)', tip: '<b>' + esc(r.name) + '</b><br><span class="tv">' + fmt(r.v) + '</span>, ' + pct(r.v, tm) })), { lw: 230 });
  }

  // ---------------------------------------------------------------- grants
  let gShown = 10, gRows = [];
  function grantRows() {
    const q = $('#gq').value.trim().toLowerCase();
    const sec = +$('#gsec').value, ch = +$('#gch').value, min = +$('#gmin').value;
    const words = q ? q.split(/\s+/) : [];
    return D.grants.filter((g) => {
      if (!inRange(g[0]) || (S.donor >= 0 && g[1] !== S.donor) || (sec >= 0 && g[2] !== sec) || (ch >= 0 && g[3] !== ch)) return false;
      if (min && conv(g[4], g[0]) < min) return false;
      if (words.length) {
        const hay = (g[5] + ' ' + (g[6] >= 0 ? D.texts[g[6]] : '') + ' ' + D.donors[g[1]].n + ' ' + (g[8] || '')).toLowerCase();
        return words.every((w) => hay.includes(w));
      }
      return true;
    }).sort((a, b) => conv(b[4], b[0]) - conv(a[4], a[0]));
  }
  function renderGrants(reset) {
    if (reset) gShown = 10;
    gRows = grantRows();
    const tot = gRows.reduce((a, g) => a + conv(g[4], g[0]), 0);
    $('#gsum').textContent = gRows.length.toLocaleString() + ' project lines, ' + fmt(tot) + ' in ' + (inRange(EY) ? (S.y0 === Math.min(S.y1, LASTY) ? String(S.y0) : S.y0 + '–' + Math.min(S.y1, LASTY)) + ' (no project detail for ' + EY + ' yet)' : rangeLab()) + (S.donor >= 0 ? ', ' + D.donors[S.donor].n : '') + '. Largest first.';
    const ul = $('#glist');
    ul.innerHTML = gRows.slice(0, gShown).map((g) => {
      const txt = g[6] >= 0 ? D.texts[g[6]] : '';
      return '<li><div class="gt"><b>' + esc(g[5]) + '</b><span class="ga">' + fmt(conv(g[4], g[0])) + '</span></div>' +
        '<div class="gm">' + g[0] + ' · ' + esc(D.donors[g[1]].n) + ' · ' + esc(D.sectors[g[2]]) + ' · ' + esc(D.channels[g[3]]) + (g[8] ? ' · ' + esc(g[8]) : '') + '</div>' +
        (txt ? '<details><summary>Description</summary><p>' + esc(txt) + '</p></details>' : '') + '</li>';
    }).join('') || '<li class="note">No projects match.</li>';
    $('#gmore').hidden = gRows.length <= gShown;
    $('#gmore').textContent = 'Show ' + Math.min(25, gRows.length - gShown) + ' more (' + (gRows.length - gShown).toLocaleString() + ' not shown)';
  }
  function csv() {
    const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const lines = [['year', 'donor', 'donor_type', 'sector', 'channel', 'organisation', 'title', 'description', 'amount_' + S.cur.toLowerCase(), 'crs_id'].join(',')];
    gRows.forEach((g) => lines.push([g[0], q(D.donors[g[1]].n), q(D.types[D.donors[g[1]].t]), q(D.sectors[g[2]]), q(D.channels[g[3]]), q(g[8]), q(g[5]), q(g[6] >= 0 ? D.texts[g[6]] : ''), Math.round(conv(g[4], g[0])), q(g[7])].join(',')));
    const a = el('a', { href: URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' })), download: 'liberia-aid-projects-' + rangeLab() + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------------------------------------------------------------- IATI
  function renderIati() {
    const I = D.iati;
    if (!I || !I.rows || !I.rows.length) { $('#iati').hidden = true; return; }
    const ysel = $('#iati-y');
    if (!ysel.options.length) {
      I.years.slice().reverse().forEach((y) => ysel.appendChild(el('option', { value: y }, y + (y > LASTY ? ' (so far)' : ''))));
      ysel.onchange = renderIati;
    }
    const y = +ysel.value;
    const m = new Map();
    I.rows.filter((r) => r[0] === y).forEach((r) => m.set(r[1], (m.get(r[1]) || 0) + conv(r[2], y)));
    const tot = [...m.values()].reduce((a, b) => a + b, 0);
    $('#iati-note').textContent = 'Disbursements and expenditure that organisations published to IATI for Liberia in ' + y + (y > LASTY ? ' so far' : '') + ': ' + fmt(tot) + ' from ' + m.size + ' publishers. IATI includes NGOs and foundations that don\u2019t report to the OECD, counts expenditure as well as disbursements, and some money appears in both a funder\u2019s and an implementer\u2019s file, so it doesn\u2019t add up to the OECD figures. Use it for the most recent picture. Not affected by the Years and Donor controls.';
    hbars($('#c-iati'), topN(m, 20, I.pubs).map((r) => ({ name: r.name, v: r.v, col: 'var(--s1)' })), { lw: 260 });
  }

  /* Long static lists: show the first n items, with a button to show the rest (and hide them again).
     count (optional) is what to count inside the hidden items for the button label. */
  function clipList(box, sel, n, label, count) {
    if (!box) return;
    const items = [...box.querySelectorAll(sel)];
    if (items.length <= n) return;
    const rest = items.slice(n);
    const k = count ? rest.reduce((a, it) => a + it.querySelectorAll(count).length, 0) : rest.length;
    const more = label.replace('{n}', items.length).replace('{k}', k);
    const b = el('button', { type: 'button', class: 'more-btn', 'aria-expanded': 'false' }, more);
    const set = (open) => { rest.forEach((it) => { it.hidden = !open; }); b.textContent = open ? 'Show less' : more; b.setAttribute('aria-expanded', open); };
    b.onclick = () => set(b.getAttribute('aria-expanded') !== 'true');
    box.after(b);
    set(false);
  }

  // ---------------------------------------------------------------- about
  function renderAbout() {
    $('#about-body').innerHTML = D.meta.about || '';
  }

  // ---------------------------------------------------------------- controls
  function init() {
    const yf = $('#yfrom'), yt = $('#yto');
    years.forEach((y) => { yf.appendChild(el('option', { value: y }, ylab(y))); yt.appendChild(el('option', { value: y }, ylab(y))); });
    yf.onchange = () => { S.y0 = +yf.value; if (S.y1 < S.y0) S.y1 = S.y0; render(); };
    yt.onchange = () => { S.y1 = +yt.value; if (S.y0 > S.y1) S.y0 = S.y1; render(); };
    document.querySelectorAll('#ypreset button').forEach((b) => { b.onclick = () => { const n = +b.dataset.n; S.y1 = years[years.length - 1]; S.y0 = n ? years[Math.max(0, years.length - n)] : years[0]; render(); }; });
    document.querySelectorAll('#cur button').forEach((b) => { b.onclick = () => { S.cur = b.dataset.c; render(); }; });
    const ds = $('#dsel');
    ds.appendChild(el('option', { value: -1 }, 'All donors'));
    const tot = new Map();
    D.flows.forEach((f) => tot.set(f[1], (tot.get(f[1]) || 0) + f[5]));
    D.types.forEach((t, ti) => {
      const og = el('optgroup', { label: t });
      D.donors.map((d, i) => [d, i]).filter(([d, i]) => d.t === ti && tot.get(i) > 0).sort((a, b) => a[0].n.localeCompare(b[0].n)).forEach(([d, i]) => og.appendChild(el('option', { value: i }, esc(d.n))));
      if (og.children.length) ds.appendChild(og);
    });
    ds.onchange = () => selectDonor(+ds.value);
    $('#dnote-x').onclick = () => selectDonor(-1);
    const gs = $('#gsec'), gc = $('#gch');
    gs.appendChild(el('option', { value: -1 }, 'All sectors'));
    D.sectors.map((s, i) => [s, i]).sort((a, b) => a[0].localeCompare(b[0])).forEach(([s, i]) => gs.appendChild(el('option', { value: i }, esc(s))));
    gc.appendChild(el('option', { value: -1 }, 'All channels'));
    D.channels.map((s, i) => [s, i]).sort((a, b) => a[0].localeCompare(b[0])).forEach(([s, i]) => gc.appendChild(el('option', { value: i }, esc(s))));
    let tm;
    $('#gq').oninput = () => { clearTimeout(tm); tm = setTimeout(() => renderGrants(true), 200); };
    gs.onchange = gc.onchange = $('#gmin').onchange = () => renderGrants(true);
    $('#gmore').onclick = () => { gShown += 25; renderGrants(false); };
    $('#gcsv').onclick = csv;
    let rt;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 200); });
    addEventListener('lbr-guest', () => { if (S.donor >= 0) selectDonor(-1); });
    renderAbout();
    clipList($('#reports .trends'), ':scope > li', 3, 'Show all {n} points');
    clipList($('#refs-key'), ':scope > .refgrp', 2, 'Show {k} more key reports', '.reflist li');
    render();
  }
  init();
})();
