/* Liberia viewer: theme pages. Each theme is a group of the existing sections; only one theme shows at a time.
   Hash links: #aid, #ireland, #census, #indicators, #reports, #about, or any section id (its theme opens and scrolls to it).
   Sections keep their ids, so older links and the masthead links still work. */
(function () {
  'use strict';
  var THEMES = {
    home: ['landing', 'news'],
    aid: ['overview', 'donors', 'sectors', 'channels', 'grants', 'iati'],
    trade: ['trade'],
    economy: ['economy'],
    politics: ['politics'],
    ireland: ['ireland'],
    census: ['census'],
    indicators: ['devind'],
    reports: ['reports'],
    about: ['about']
  };
  var DEFAULT = 'home';
  // which theme a section id opens under (first match wins, so #news opens Home)
  var of = {};
  Object.keys(THEMES).forEach(function (t) { THEMES[t].forEach(function (id) { if (!(id in of)) of[id] = t; }); });

  function show(theme, scrollTo) {
    if (!THEMES[theme]) theme = DEFAULT;
    var ids = {};
    Object.keys(THEMES).forEach(function (t) { THEMES[t].forEach(function (id) { ids[id] = true; }); });
    Object.keys(ids).forEach(function (id) {
      (function () {
        var el = document.getElementById(id);
        if (el) el.classList.toggle('theme-off', THEMES[theme].indexOf(id) < 0);
      })();
    });
    var bar = document.querySelector('.bar');
    if (bar) {
      bar.classList.toggle('hide-yrs', theme !== 'aid' && theme !== 'ireland');
      bar.classList.toggle('hide-donor', theme !== 'aid');
    }
    document.querySelectorAll('#themes a').forEach(function (a) {
      if (a.getAttribute('href') === '#' + theme) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    var target = scrollTo && document.getElementById(scrollTo);
    if (target) {
      if (target.tagName === 'DETAILS') target.open = true;
      target.scrollIntoView({ block: 'start' });
    } else {
      window.scrollTo(0, 0);
    }
  }

  function route() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return show(DEFAULT);
    if (THEMES[h]) return show(h);
    if (of[h]) return show(of[h], h);
    return show(DEFAULT);
  }

  window.addEventListener('hashchange', route);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', route);
  else route();
})();
