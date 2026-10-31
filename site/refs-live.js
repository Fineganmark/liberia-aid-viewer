/* Latest reports: a live list at the top of References, from the World Bank documents API and
   ReliefWeb's Liberia feed. Both are fetched through this site's own address (/feeds/...), which
   relay.js maps to saved copies on GitHub Pages (formerly Netlify's relay). Results are kept in the browser for CACHE_HOURS so repeat visits
   don't use the relay (each relayed fetch counts against the Netlify allowance). Off Netlify (the
   preview copy) or if both feeds fail, the section says so and the curated list below stays. */
(() => {
  const root = document.getElementById('refs-live');
  if (!root) return;
  const LIVE = window.AidRelay.live;
  const CACHE_HOURS = 12, SHOW = 5, MAX = 15, MAX_AGE_DAYS = 540;
  const KEY = 'lbr-refs-live:v1';

  // World Bank: Liberia documents of type "Publications & Research", newest first
  const WB = AidRelay.url('/feeds/wbdocs?format=json&countrycode_exact=LR&rows=40&sort=docdt&order=desc'
    + '&fl=docdt,docty,display_title,url&majdocty_exact=' + encodeURIComponent('Publications & Research'));
  // ReliefWeb: all Liberia updates (the same feed News uses); only report-like titles are kept
  const RW = AidRelay.url('/feeds/reliefweb/country/lbr/rss.xml');
  const SKIP = /procurement|checklist|data ?sheet|safeguard|ISDS|ESMF|resettlement|terms of reference|vacanc|job/i;
  const REPORTY = /report|assessment|analysis|review|outlook|update|brief|plan\b|strategy|survey|evaluation|profile|bulletin|overview|snapshot|study|appeal|dashboard/i;

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const safeUrl = u => { try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href.replace(/^http:\/\/documents\.worldbank\.org/, 'https://documents.worldbank.org') : null; } catch (e) { return null; } };
  const plain = s => (new DOMParser().parseFromString('<body>' + (s || ''), 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim();
  const fmtDate = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  async function getWB() {
    const r = await fetch(WB, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('World Bank ' + r.status);
    const docs = (await r.json()).documents || {};
    return Object.keys(docs).filter(k => k !== 'facets').map(k => docs[k]).map(d => ({
      title: plain(d.display_title).replace(/\s+:\s+/g, ': '), link: safeUrl(d.url), date: Date.parse(d.docdt), src: 'World Bank', kind: d.docty || ''
    }));
  }

  async function getRW() {
    const r = await fetch(RW);
    if (!r.ok) throw new Error('ReliefWeb ' + r.status);
    const doc = new DOMParser().parseFromString(await r.text(), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('ReliefWeb: not a feed');
    const get = (n, tag) => { const c = n.getElementsByTagName(tag)[0]; return c ? (c.textContent || '').trim() : ''; };
    return Array.from(doc.getElementsByTagName('item')).map(n => {
      // ReliefWeb titles are often "Liberia: <title>"; the publishing organisation is in <source> or <author> when given
      const title = plain(get(n, 'title')).replace(/^Liberia:\s*/i, '');
      const by = plain(get(n, 'source') || get(n, 'author') || get(n, 'dc:creator'));
      return { title, link: safeUrl(get(n, 'link') || get(n, 'guid')), date: Date.parse(get(n, 'pubDate')), src: by ? by + ' (via ReliefWeb)' : 'ReliefWeb', kind: '' };
    }).filter(x => REPORTY.test(x.title));
  }

  function cached() {
    try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); return c && Date.now() - c.at < CACHE_HOURS * 3600e3 ? c : null; } catch (e) { return null; }
  }
  function store(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* private window: no cache */ } }

  function render(c) {
    root.textContent = '';
    const now = Date.now();
    const seen = new Set();
    const items = c.items.filter(x => x.title && x.link && !isNaN(x.date) && now - x.date < MAX_AGE_DAYS * 864e5 && !SKIP.test(x.title + ' ' + x.kind))
      .filter(x => { const k = x.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => b.date - a.date).slice(0, MAX);
    if (!items.length) {
      root.appendChild(el('p', 'note', c.failed ? 'The latest reports could not be loaded just now. The curated list below still applies.' : 'No new reports found. The curated list below still applies.'));
      return;
    }
    const ul = el('ul', 'reflist');
    items.forEach(x => {
      const li = el('li');
      const a = el('a', null, x.title); a.href = x.link; a.target = '_blank'; a.rel = 'noopener';
      li.append(a, ' ', el('span', null, fmtDate(x.date) + ' · ' + x.src + (x.kind ? ' · ' + x.kind : '')));
      li.hidden = ul.children.length >= SHOW;
      ul.appendChild(li);
    });
    root.appendChild(ul);
    if (items.length > SHOW) {
      const m = el('button', 'more-btn', 'Show ' + (items.length - SHOW) + ' more'); m.type = 'button';
      m.addEventListener('click', () => { [...ul.children].forEach(li => { li.hidden = false; }); m.remove(); });
      root.appendChild(m);
    }
    const p = el('p', 'note', 'Loaded automatically ' + fmtDate(c.at) + ' from the World Bank documents catalogue and ReliefWeb. These are listed as published and are not reflected in the summary above until it is next rewritten. ');
    const b = el('button', 'linkbtn', 'Refresh'); b.type = 'button';
    b.addEventListener('click', () => load(true));
    p.appendChild(b);
    root.appendChild(p);
  }

  let busy = false;
  async function load(force) {
    if (busy) return;
    const c = !force && cached();
    if (c) { render(c); return; }
    busy = true;
    root.textContent = '';
    root.appendChild(el('p', 'note', 'Loading the latest reports…'));
    const res = await Promise.allSettled([getWB(), getRW()]);
    const items = res.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    const fresh = { at: Date.now(), items, failed: res.every(r => r.status === 'rejected') };
    if (!fresh.failed) store(fresh);
    busy = false;
    render(fresh);
  }

  if (!LIVE) {
    root.appendChild(el('p', 'note', 'On the website, this space lists the newest Liberia reports from the World Bank and ReliefWeb, loaded automatically. In this copy, see the curated list below and the World Bank and ReliefWeb Liberia pages.'));
    return;
  }
  // fetch only once the list is near the screen, so visitors who never scroll here cost nothing
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); load(false); } }, { rootMargin: '200px' });
    io.observe(root);
  } else load(false);
})();
