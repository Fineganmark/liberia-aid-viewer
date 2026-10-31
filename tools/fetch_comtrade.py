#!/usr/bin/env python3
"""Fetch Liberia's yearly merchandise trade totals from UN Comtrade into site/data/live/comtrade_lbr.json.

Runs in the GitHub Pages workflow with the repository secret COMTRADE_KEY (a Comtrade API subscription key).
Standard library only. If the key is missing or the request fails, the script logs why and leaves the previous
file in place, so a bad week never blanks the page. It always exits 0 so the deploy continues.

Usage: COMTRADE_KEY=... python3 fetch_comtrade.py <site folder>
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

SITE = sys.argv[1] if len(sys.argv) > 1 else 'site'
OUT_DIR = os.path.join(SITE, 'data', 'live')
OUT = os.path.join(OUT_DIR, 'comtrade_lbr.json')
UA = 'LiberiaBrief/1.0 (trade refresh)'
REPORTER = '430'   # Liberia, UN M49 code
FIRST_YEAR = 2014  # the viewers start in 2014
API = 'https://comtradeapi.un.org/data/v1/get/C/A/HS'


def log(msg):
    print('comtrade: %s' % msg)


def fetch(key, years):
    # Try the key in the header first, then as a query parameter, since the portal's examples use both forms.
    last = None
    for how in ('header', 'query'):
        try:
            return fetch_once(key, years, how)
        except urllib.error.HTTPError as e:
            last = 'HTTP %s' % e.code
            log('key sent as %s: HTTP %s' % (how, e.code))
            if e.code != 401:
                break
    raise RuntimeError(last)


def fetch_once(key, years, how):
    params = {
        'reporterCode': REPORTER,
        'period': ','.join(str(y) for y in years),
        'partnerCode': '0',      # world
        'flowCode': 'M,X',       # imports, exports
        'cmdCode': 'TOTAL',      # all commodities, the free tier's allowed level
        'maxRecords': '500',
    }
    headers = {'User-Agent': UA, 'Accept': 'application/json'}
    if how == 'header':
        headers['Ocp-Apim-Subscription-Key'] = key
    else:
        params['subscription-key'] = key
    req = urllib.request.Request(API + '?' + urllib.parse.urlencode(params), headers=headers)
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise  # a bad key won't get better on retry
            if i == 2:
                raise
        except urllib.error.URLError:  # network errors: retry
            if i == 2:
                raise
        time.sleep(5 * (i + 1))
    raise RuntimeError('no response')


def main():
    key = os.environ.get('COMTRADE_KEY', '').strip()
    if not key:
        log('COMTRADE_KEY not set; keeping the previous file')
        return
    years = list(range(FIRST_YEAR, dt.date.today().year))  # complete years only
    try:
        j = fetch(key, years)
    except Exception as e:
        log('request failed (%s); keeping the previous file' % e)
        return
    rows = j.get('data') or []
    if not rows:
        log('no rows returned; keeping the previous file')
        return
    by_year = {}
    for r in rows:
        y = int(r.get('period') or r.get('refYear') or 0)
        flow = (r.get('flowDesc') or r.get('flowCode') or '').lower()
        value = r.get('primaryValue')
        if not y or value is None:
            continue
        slot = by_year.setdefault(y, {'imports_usd': None, 'exports_usd': None})
        if flow.startswith('import'):
            slot['imports_usd'] = value
        elif flow.startswith('export'):
            slot['exports_usd'] = value
    out = {
        'source': 'UN Comtrade (reporter Liberia, world partners, all commodities)',
        'unit': 'US dollars, current prices',
        'fetched': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d'),
        'years': [{'year': y, **by_year[y]} for y in sorted(by_year)],
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    tmp = OUT + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    os.replace(tmp, OUT)
    log('wrote %d years to %s' % (len(out['years']), OUT))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:  # never fail the deploy over this
        log('unexpected error (%s); keeping the previous file' % e)
