/* Aid news: a live news list built from public RSS feeds (Google News searches, ReliefWeb).
   Browsers can't read most news feeds from another site, so each feed is fetched through this
   site's own address (/feeds/...): relay.js maps it to the saved copy on GitHub Pages (or Netlify's live relay).
   Shared by the Irish Aid viewer and the Liberia aid viewer: AidNews.mount(element, config). */
(function () {
  'use strict';
  var CSS = [
    '.an { --an-accent: var(--ia-green-2, var(--accent, #0b5d43)); --an-muted: var(--color-fg-muted, #5f6368); --an-line: var(--color-border-line, #dadce0); --an-panel: var(--color-panel, #fff); --an-tint: var(--ia-tint, rgba(11,93,67,.08)); }',
    '.an-tools { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; margin: 0 0 14px; }',
    '.an-q { flex: 1 1 14rem; min-width: 0; font: inherit; font-size: 15px; padding: 8px 10px; border: 1px solid var(--an-line); border-radius: 6px; background: var(--an-panel); color: inherit; box-sizing: border-box; }',
    '.an-chips { display: flex; flex-wrap: wrap; gap: 6px; }',
    '.an-chip { font: inherit; font-size: 13px; padding: 4px 11px; border: 1px solid var(--an-line); border-radius: 999px; background: var(--an-panel); color: inherit; cursor: pointer; }',
    '.an-chip[aria-pressed="true"] { background: var(--an-accent); border-color: var(--an-accent); color: #fff; }',
    '.an-chip .an-n { opacity: .7; margin-left: 4px; }',
    '.an-status { font-size: 13px; color: var(--an-muted); margin: 0 0 12px; display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }',
    '.an-refresh { font: inherit; font-size: 13px; background: none; border: 0; padding: 0; color: var(--an-accent); cursor: pointer; text-decoration: underline; }',
    '.an h3.an-day { font-family: inherit; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--an-muted); margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid var(--an-line); }',
    '.an ul.an-list { list-style: none; margin: 0; padding: 0; }',
    '.an li.an-item { margin: 0; line-height: inherit; padding: 10px 0; border-bottom: 1px solid var(--an-line); }',
    '.an-item:last-child { border-bottom: 0; }',
    '.an-item a.an-t { color: inherit; font-size: 16px; line-height: 1.4; text-decoration: none; font-weight: 500; overflow-wrap: anywhere; }',
    '.an-item a.an-t:hover { color: var(--an-accent); text-decoration: underline; }',
    '.an-meta { font-size: 12.5px; color: var(--an-muted); margin-top: 3px; }',
    '.an-meta .an-tag { display: inline-block; padding: 0 7px; border-radius: 999px; background: var(--an-tint); margin-right: 6px; }',
    '.an-sn { font-size: 14px; line-height: 1.5; margin: 4px 0 0; color: inherit; opacity: .85; overflow-wrap: anywhere; }',
    '.an-more { font: inherit; font-size: 14px; margin-top: 14px; padding: 8px 16px; border: 1px solid var(--an-line); border-radius: 6px; background: var(--an-panel); color: inherit; cursor: pointer; }',
    '.an-empty, .an-note { font-size: 14px; color: var(--an-muted); line-height: 1.5; }',
    '.an-note a, .an-src a { color: var(--an-accent); }',
    '.an-src { font-size: 13px; color: var(--an-muted); line-height: 1.6; margin-top: 18px; }',
    '.an-src ul { margin: 4px 0 0; padding-left: 1.1rem; }'
  ].join('\n');

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function safeUrl(u) { try { var x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (e) { return null; } }
  function plain(html) {
    if (!html) return '';
    var d = new DOMParser().parseFromString('<body>' + html, 'text/html');
    return (d.body.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function clip(s, n) { return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s; }
  function norm(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

  // RSS 2.0 or Atom → [{title, link, date, publisher, snippet}]
  function parseFeed(text, feed) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('not a feed');
    var nodes = doc.getElementsByTagName('item');
    var atom = !nodes.length;
    if (atom) nodes = doc.getElementsByTagName('entry');
    var get = function (n, tag) { var c = n.getElementsByTagName(tag)[0]; return c ? (c.textContent || '').trim() : ''; };
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i], title = plain(get(n, 'title')), link, publisher = '';
      if (atom) { var l = n.getElementsByTagName('link')[0]; link = l ? l.getAttribute('href') : ''; }
      else link = get(n, 'link') || get(n, 'guid');
      link = safeUrl(link);
      if (!title || !link) continue;
      var srcEl = n.getElementsByTagName('source')[0];
      if (srcEl && srcEl.textContent) {
        publisher = srcEl.textContent.trim();
        // Google News titles end in " - Publisher"
        var tail = ' - ' + publisher;
        if (title.slice(-tail.length) === tail) title = title.slice(0, -tail.length);
      }
      var date = Date.parse(get(n, 'pubDate') || get(n, 'published') || get(n, 'updated') || get(n, 'dc:date'));
      var snippet = plain(get(n, 'description') || get(n, 'summary'));
      // Google News descriptions only repeat the headline and publisher
      if (feed.kind === 'gnews' || norm(snippet).indexOf(norm(title)) === 0) snippet = '';
      out.push({ title: title, link: link, date: isNaN(date) ? 0 : date, publisher: publisher || feed.publisher || '', snippet: clip(snippet, 260), feed: feed.id });
    }
    return out;
  }

  // Each feed's headlines are kept in the browser for a while (cfg.cacheMinutes, default 30), so
  // opening the news again, or on another page of the site, doesn't go back through the site's
  // feed relay. Every relayed fetch counts against the site's Netlify allowance. Refresh skips the copy.
  var KEY = 'aid-news:';
  function cached(feed, maxAge) {
    try {
      var c = JSON.parse(localStorage.getItem(KEY + feed.url) || 'null');
      return c && Date.now() - c.at < maxAge ? c : null;
    } catch (e) { return null; }
  }
  function keep(feed, items) {
    try { localStorage.setItem(KEY + feed.url, JSON.stringify({ at: Date.now(), items: items })); } catch (e) { /* storage full or blocked: just don't keep it */ }
  }

  function fetchFeed(feed, timeout) {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, timeout);
    return fetch(feed.url, { cache: 'no-cache', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (txt) { clearTimeout(t); var items = parseFeed(txt, feed); keep(feed, items); return items; })
      .catch(function (e) { clearTimeout(t); throw e; });
  }

  function dayLabel(ts) {
    if (!ts) return 'Date not given';
    var d = new Date(ts), now = new Date();
    var start = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
    var diff = Math.round((start(now) - start(d)) / 864e5);
    if (diff <= 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IE', { weekday: diff < 7 ? 'long' : undefined, day: 'numeric', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }
  function timeLabel(ts) { return ts ? new Date(ts).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' }) : ''; }

  function mount(root, cfg) {
    if (!document.getElementById('an-style')) { var st = el('style'); st.id = 'an-style'; st.textContent = CSS; document.head.appendChild(st); }
    var feeds = cfg.feeds, PAGE = cfg.pageSize || 30, MAXAGE = (cfg.maxAgeDays || 120) * 864e5;
    var state = { items: [], ok: {}, failed: {}, loading: false, loadedAt: 0, src: 'all', q: '', shown: PAGE };
    root.classList.add('an'); root.textContent = '';

    var tools = el('div', 'an-tools');
    var q = el('input', 'an-q'); q.type = 'search'; q.placeholder = 'Filter headlines, e.g. Malawi, climate, famine'; q.setAttribute('aria-label', 'Filter headlines');
    var chips = el('div', 'an-chips'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'News source');
    tools.appendChild(q); tools.appendChild(chips);
    var status = el('p', 'an-status'); status.setAttribute('role', 'status');
    var body = el('div');
    var more = el('button', 'an-more', 'Show more'); more.type = 'button'; more.hidden = true;
    var src = el('div', 'an-src');
    src.appendChild(el('span', null, cfg.sourceNote || 'Headlines are gathered automatically from these feeds and link to the original publishers. They are not checked or endorsed by this site.'));
    var ul = el('ul');
    feeds.forEach(function (f) { var li = el('li'), a = el('a', null, f.label); a.href = f.home; a.target = '_blank'; a.rel = 'noopener'; li.appendChild(a); if (f.about) li.appendChild(document.createTextNode(': ' + f.about)); ul.appendChild(li); });
    src.appendChild(ul);
    [tools, status, body, more, src].forEach(function (x) { root.appendChild(x); });

    var timer;
    q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { state.q = q.value.trim(); state.shown = PAGE; render(); }, 150); });
    more.addEventListener('click', function () { state.shown += PAGE; render(); });

    function visible() {
      var words = norm(state.q).split(' ').filter(Boolean);
      return state.items.filter(function (it) {
        if (state.src !== 'all' && it.feeds.indexOf(state.src) < 0) return false;
        if (!words.length) return true;
        var hay = norm(it.title + ' ' + it.snippet + ' ' + it.publisher);
        return words.every(function (w) { return hay.indexOf(w) >= 0; });
      });
    }

    function drawChips() {
      chips.textContent = '';
      [{ id: 'all', label: 'All' }].concat(feeds).forEach(function (f) {
        var n = f.id === 'all' ? state.items.length : state.items.filter(function (it) { return it.feeds.indexOf(f.id) >= 0; }).length;
        if (f.id !== 'all' && !state.ok[f.id]) return;
        var b = el('button', 'an-chip', f.short || f.label); b.type = 'button';
        b.appendChild(el('span', 'an-n', String(n)));
        b.setAttribute('aria-pressed', String(state.src === f.id));
        b.addEventListener('click', function () { state.src = f.id; state.shown = PAGE; render(); });
        chips.appendChild(b);
      });
    }

    function drawStatus() {
      status.textContent = '';
      if (state.loading) { status.appendChild(el('span', null, 'Loading the latest news…')); return; }
      var okN = Object.keys(state.ok).length;
      if (state.loadedAt) status.appendChild(el('span', null, 'Updated ' + timeLabel(state.loadedAt) + ' from ' + okN + ' of ' + feeds.length + ' sources'));
      var r = el('button', 'an-refresh', 'Refresh'); r.type = 'button'; r.addEventListener('click', load); status.appendChild(r);
      feeds.forEach(function (f) {
        if (!state.failed[f.id]) return;
        var s = el('span', 'an-note', f.label + ' could not be reached just now. '), a = el('a', null, 'Open it directly');
        a.href = f.home; a.target = '_blank'; a.rel = 'noopener'; s.appendChild(a); status.appendChild(s);
      });
    }

    function render() {
      drawChips(); drawStatus();
      body.textContent = '';
      var list = visible();
      if (!list.length) {
        if (!state.loading) body.appendChild(el('p', 'an-empty', state.items.length ? 'No headlines match that filter.' : 'No news could be loaded just now. The sources are listed below.'));
        more.hidden = true; return;
      }
      var lastDay = null, ulEl = null;
      list.slice(0, state.shown).forEach(function (it) {
        var d = dayLabel(it.date);
        if (d !== lastDay) { body.appendChild(el('h3', 'an-day', d)); ulEl = el('ul', 'an-list'); body.appendChild(ulEl); lastDay = d; }
        var li = el('li', 'an-item'), a = el('a', 'an-t', it.title);
        a.href = it.link; a.target = '_blank'; a.rel = 'noopener noreferrer';
        li.appendChild(a);
        var meta = el('div', 'an-meta');
        var tags = [];
        it.feeds.forEach(function (id) { var f = feeds.filter(function (x) { return x.id === id; })[0]; if (f) { tags.push(f.short || f.label); meta.appendChild(el('span', 'an-tag', f.short || f.label)); } });
        var pub = tags.indexOf(it.publisher) >= 0 ? '' : it.publisher;
        meta.appendChild(document.createTextNode([pub, timeLabel(it.date)].filter(Boolean).join(' · ')));
        li.appendChild(meta);
        if (it.snippet) li.appendChild(el('p', 'an-sn', it.snippet));
        ulEl.appendChild(li);
      });
      more.hidden = list.length <= state.shown;
      more.textContent = 'Show more (' + (list.length - state.shown) + ' left)';
    }

    function merge(items) {
      var byKey = {};
      state.items.forEach(function (it) { byKey[it.key] = it; });
      var cutoff = Date.now() - MAXAGE;
      items.forEach(function (it) {
        if (it.date && it.date < cutoff) return;
        var key = norm(it.title).slice(0, 90);
        var have = byKey[key];
        if (have) { if (have.feeds.indexOf(it.feed) < 0) have.feeds.push(it.feed); if (!have.snippet && it.snippet) have.snippet = it.snippet; return; }
        it.key = key; it.feeds = [it.feed]; byKey[key] = it; state.items.push(it);
      });
      state.items.sort(function (a, b) { return b.date - a.date; });
    }

    var KEEP = (cfg.cacheMinutes === undefined ? 30 : cfg.cacheMinutes) * 6e4;
    function load(ev) {
      if (state.loading) return;
      if (cfg.live === false) { offline(); return; }
      var fresh = !(ev && ev.type === 'click'); // the Refresh button always fetches
      state.loading = true; state.items = []; state.ok = {}; state.failed = {}; render();
      var left = feeds.length, oldest = Date.now();
      feeds.forEach(function (f) {
        var c = fresh && cached(f, KEEP);
        if (c) oldest = Math.min(oldest, c.at);
        (c ? Promise.resolve(c.items) : fetchFeed(f, cfg.timeout || 15000))
          .then(function (items) { state.ok[f.id] = true; merge(items); })
          .catch(function () { state.failed[f.id] = true; })
          .then(function () { if (--left === 0) { state.loading = false; state.loadedAt = oldest; } render(); });
      });
    }

    function offline() {
      body.textContent = ''; status.textContent = ''; chips.textContent = ''; tools.hidden = true;
      var p = el('p', 'an-note', 'Live news only loads on the public site. ');
      if (cfg.site) { var a = el('a', null, 'Open the news on the public site'); a.href = cfg.site; a.target = '_blank'; a.rel = 'noopener'; p.appendChild(a); p.appendChild(document.createTextNode(', or use the sources below.')); }
      body.appendChild(p);
    }

    var started = false;
    return {
      // call when the news is first shown; reloads if the list is older than the kept copies
      show: function () { if (!started || (state.loadedAt && Date.now() - state.loadedAt > Math.max(KEEP, 9e5))) { started = true; load(); } },
      refresh: function () { load({ type: 'click' }); },
      _parse: parseFeed
    };
  }

  // Google News search feed, fetched through this site's /feeds/gnews relay
  function gnews(query, lang) {
    lang = lang || { hl: 'en-IE', gl: 'IE', ceid: 'IE:en' };
    var qs = 'q=' + encodeURIComponent(query) + '&hl=' + lang.hl + '&gl=' + lang.gl + '&ceid=' + lang.ceid;
    return { url: (window.AidRelay ? AidRelay.url : String)('/feeds/gnews?' + qs), home: 'https://news.google.com/search?' + qs, kind: 'gnews' };
  }

  window.AidNews = { mount: mount, gnews: gnews };
})();
