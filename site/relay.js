/* Feed relay: news and report feeds are read from this site's own /feeds/... address.
   On Netlify that address was relayed live (_redirects). On GitHub Pages a scheduled job
   (.github/workflows/pages.yml running tools/fetch_feeds.py) saves each feed as feeds/<key>.txt,
   where <key> is a short hash of the /feeds/... address. tools/list_feeds.js collects the addresses
   from window.AidRelay.seen into feeds/list.txt. */
(function () {
  var h = location.hostname;
  var pages = /\.github\.io$/.test(h);
  function key(u) {
    var x = 0x811c9dc5;
    for (var i = 0; i < u.length; i++) { x ^= u.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
    return ('0000000' + x.toString(16)).slice(-8);
  }
  var seen = [];
  window.AidRelay = {
    live: pages || /\.netlify\.app$/.test(h) || /^(localhost|127\.0\.0\.1)$/.test(h),
    seen: seen,
    key: key,
    url: function (u) { if (seen.indexOf(u) < 0) seen.push(u); return pages ? 'feeds/' + key(u) + '.txt' : u; }
  };
})();
