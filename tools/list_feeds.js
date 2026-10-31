// Writes <site>/feeds/list.txt: every /feeds/... address the pages ask relay.js for.
// Opens each page in headless Chromium (Playwright) and reads window.AidRelay.seen.
//   node tools/list_feeds.js <site dir> [query ...]     e.g. node tools/list_feeds.js site "" "?country=lr"
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const dir = path.resolve(process.argv[2] || 'site');
const queries = process.argv.length > 3 ? process.argv.slice(3) : [''];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(dir, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
server.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const all = new Set();
  for (const q of queries) {
    const page = await browser.newPage();
    await page.route(/^(?!http:\/\/127\.0\.0\.1)/, (r) => r.abort());   // nothing from outside
    await page.goto(base + q, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const seen = await page.evaluate(() => (window.AidRelay ? window.AidRelay.seen : null));
    if (!seen) throw new Error('relay.js not loaded on ' + q);
    console.log((q || '(home)') + ': ' + seen.length);
    seen.forEach((u) => all.add(u));
    await page.close();
  }
  await browser.close(); server.close();
  fs.mkdirSync(path.join(dir, 'feeds'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'feeds', 'list.txt'), '# written by tools/list_feeds.js; read by tools/fetch_feeds.py\n' + [...all].sort().join('\n') + '\n');
  console.log('feeds/list.txt: ' + all.size + ' addresses');
});
