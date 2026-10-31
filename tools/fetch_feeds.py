"""Save every feed the site reads into <site>/feeds/<key>.txt (run by .github/workflows/pages.yml).

GitHub Pages can't relay feeds the way Netlify's _redirects did, so this runs every few hours and
the pages read the saved copies (relay.js). The list of /feeds/... addresses is <site>/feeds/list.txt.
If a feed can't be fetched, the copy already on the live site is kept.

    python3 tools/fetch_feeds.py site
"""
import os, sys, time, urllib.request

UPSTREAM = [  # same rules as the old Netlify _redirects
    ('/feeds/gnews?', 'https://news.google.com/rss/search?'),
    ('/feeds/reliefweb/', 'https://reliefweb.int/'),
    ('/feeds/wbdocs?', 'https://search.worldbank.org/api/v3/wds?'),
]
UA = 'Mozilla/5.0 (compatible; aid-viewer-feeds; +https://github.com/Fineganmark)'


def key(u):
    x = 0x811c9dc5
    for ch in u:
        x ^= ord(ch)
        x = (x * 0x01000193) & 0xffffffff
    return '%08x' % x


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main(site):
    out = os.path.join(site, 'feeds')
    live = os.environ.get('SITE_URL', '').rstrip('/') + '/'
    lines = [l.strip() for l in open(os.path.join(out, 'list.txt'), encoding='utf-8') if l.strip() and not l.startswith('#')]
    ok = kept = failed = 0
    for u in lines:
        up = next((b + u[len(a):] for a, b in UPSTREAM if u.startswith(a)), None)
        dest = os.path.join(out, key(u) + '.txt')
        if up is None:
            print('no rule for', u); failed += 1; continue
        body = None
        for attempt in range(3):
            try:
                body = get(up)
                if body.lstrip(b'\xef\xbb\xbf \t\r\n')[:1] in (b'<', b'{'):
                    break
                print('  not a feed', attempt + 1, u, body[:60])
                body = None
            except Exception as e:
                print('  retry', attempt + 1, u, e)
            time.sleep(2 + 3 * attempt)
        if body is None and live != '/':
            try:
                body = get(live + 'feeds/' + key(u) + '.txt'); kept += 1
            except Exception:
                pass
        else:
            ok += body is not None
        if body is None:
            failed += 1; print('FAILED', u); continue
        open(dest, 'wb').write(body)
        time.sleep(1)
    print('feeds: %d fetched, %d kept from live site, %d failed, %d listed' % (ok, kept, failed, len(lines)))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'site')
