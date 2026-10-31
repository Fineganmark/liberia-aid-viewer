/* Liberia feeds for the shared News section (news.js). /feeds/... addresses go through relay.js (saved copies on GitHub Pages). */
(() => {
  const root = document.getElementById('news-root');
  const LIVE = window.AidRelay.live;
  const L = { hl: 'en-US', gl: 'US', ceid: 'US:en' };
  const G = q => AidNews.gnews(q, L);
  const feeds = [
    Object.assign({ id: 'aid', label: 'Aid and development in Liberia', short: 'Aid news', about: 'Google News search for Liberia with aid, donors, grants, World Bank, IMF and humanitarian terms' },
      G('Liberia (aid OR donor OR donors OR grant OR "development partners" OR "World Bank" OR IMF OR USAID OR humanitarian OR "budget support")')),
    Object.assign({ id: 'reliefweb', label: 'ReliefWeb: Liberia', short: 'ReliefWeb', publisher: 'ReliefWeb', about: 'reports and updates on Liberia from the UN’s humanitarian information service',
      url: AidRelay.url('/feeds/reliefweb/country/lbr/rss.xml'), home: 'https://reliefweb.int/country/lbr' }),
    Object.assign({ id: 'govlr', label: 'Government of Liberia announcements', short: 'Gov. of Liberia', about: 'Google News search of Liberian government sites (MFDP, Executive Mansion)' },
      G('Liberia (site:mfdp.gov.lr OR site:emansion.gov.lr OR "Ministry of Finance and Development Planning")')),
    Object.assign({ id: 'ireland', label: 'Ireland and Liberia', short: 'Ireland', about: 'Google News search for Irish Aid and Ireland in Liberia' },
      G('Liberia ("Irish Aid" OR "Embassy of Ireland" OR Ireland)'))
  ];
  const news = AidNews.mount(root, { feeds, live: LIVE, pageSize: 10, site: 'https://fineganmark.github.io/liberia-aid-viewer/#news', maxAgeDays: 180 });
  // load when the section is opened (or straight away if it starts open)
  const sec = document.getElementById('news');
  sec.addEventListener('toggle', () => { if (sec.open) news.show(); });
  if (sec.open || location.hash === '#news') { sec.open = true; news.show(); }
})();
