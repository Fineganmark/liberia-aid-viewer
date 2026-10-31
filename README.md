# Liberia Development Assistance viewer

Unofficial viewer of public aid data (OECD CRS, IATI, World Bank). Live at
**https://fineganmark.github.io/liberia-aid-viewer/**

- `site/` is the website exactly as served. Sign-in uses the shared Firebase project `irish-aid-viewer`
  (`fineganmark.github.io` must be in Firebase > Authentication > Settings > Authorized domains).
- `.github/workflows/pages.yml` publishes `site/` to GitHub Pages on every push, and every 3 hours
  refreshes the news and report feeds: GitHub Pages can't relay feeds live the way Netlify's `_redirects` did,
  so `tools/fetch_feeds.py` saves each feed listed in `site/feeds/list.txt` as `site/feeds/<key>.txt`, and
  `site/relay.js` points the pages at those copies.
- After adding or changing a feed, rebuild the list: `node tools/list_feeds.js site [pages...]` (needs Playwright).
- Source and build tools live in the project files: /mnt/project-files/liberia-viewer (app/liberia-aid-viewer, tools/version_assets.py). Releases (zips + CHANGELOG) stay there under `releases/`.
- First version on GitHub Pages: v8.1. Moved from Netlify on 31 October 2026; the old Netlify address redirects here.
