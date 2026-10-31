#!/usr/bin/env python3
"""Fetch Liberia's ACLED conflict events, summarised by month and event type, into site/data/live/acled_lbr.json.

Runs in the GitHub Pages workflow with the repository secrets ACLED_EMAIL and ACLED_PASSWORD (a myACLED login).
ACLED's API uses an OAuth password grant: a token is requested first, then the data. Standard library only.
If the secrets are missing or a request fails, the script logs why and keeps the previous file. It always exits 0.

Usage: ACLED_EMAIL=... ACLED_PASSWORD=... python3 fetch_acled.py <site folder>
"""
import collections
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

SITE = sys.argv[1] if len(sys.argv) > 1 else 'site'
OUT_DIR = os.path.join(SITE, 'data', 'live')
OUT = os.path.join(OUT_DIR, 'acled_lbr.json')
UA = 'LiberiaBrief/1.0 (conflict refresh)'
TOKEN_URL = 'https://acleddata.com/oauth/token'
READ_URL = 'https://acleddata.com/api/acled/read'
START = '2014-01-01'
FIELDS = 'event_date|event_type|fatalities'


def log(msg):
    print('acled: %s' % msg)


def post(url, form):
    req = urllib.request.Request(url, data=urllib.parse.urlencode(form).encode(), headers={
        'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode('utf-8'))


def get_token(email, password):
    j = post(TOKEN_URL, {'username': email, 'password': password, 'grant_type': 'password',
                         'client_id': 'acled', 'scope': 'authenticated'})
    return j['access_token']


def read_events(token):
    today = dt.date.today().isoformat()
    events, page = [], 1
    while True:
        q = urllib.parse.urlencode({
            '_format': 'json', 'country': 'Liberia', 'event_date': '%s|%s' % (START, today),
            'event_date_where': 'BETWEEN', 'fields': FIELDS, 'limit': 5000, 'page': page,
        })
        req = urllib.request.Request(READ_URL + '?' + q, headers={
            'User-Agent': UA, 'Authorization': 'Bearer ' + token, 'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=120) as r:
            j = json.loads(r.read().decode('utf-8'))
        batch = j.get('data') or []
        events.extend(batch)
        if len(batch) < 5000:
            break
        page += 1
    return events


def main():
    email = os.environ.get('ACLED_EMAIL', '').strip()
    password = os.environ.get('ACLED_PASSWORD', '')
    if not email or not password:
        log('ACLED_EMAIL or ACLED_PASSWORD not set; keeping the previous file')
        return
    try:
        token = get_token(email, password)
    except urllib.error.HTTPError as e:
        log('token request refused: HTTP %s at %s (check ACLED_EMAIL and ACLED_PASSWORD, and that API access is on for the account); keeping the previous file' % (e.code, TOKEN_URL))
        return
    except Exception as e:
        log('token request failed (%s); keeping the previous file' % e)
        return
    try:
        events = read_events(token)
    except urllib.error.HTTPError as e:
        body = e.read()[:300].decode('utf-8', 'replace').replace('\n', ' ')
        log('data request refused: HTTP %s at %s; ACLED said: %s; keeping the previous file' % (e.code, READ_URL, body))
        return
    except Exception as e:
        log('data request failed (%s); keeping the previous file' % e)
        return
    if not events:
        log('no events returned; keeping the previous file')
        return
    monthly = collections.defaultdict(lambda: collections.defaultdict(lambda: {'events': 0, 'fatalities': 0}))
    for e in events:
        month = (e.get('event_date') or '')[:7]
        if not month:
            continue
        kind = e.get('event_type') or 'Other'
        cell = monthly[month][kind]
        cell['events'] += 1
        try:
            cell['fatalities'] += int(e.get('fatalities') or 0)
        except ValueError:
            pass
    out = {
        'source': 'ACLED (Armed Conflict Location & Event Data), country Liberia',
        'fetched': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d'),
        'months': [{'month': m, 'by_type': {k: v for k, v in sorted(monthly[m].items())}}
                   for m in sorted(monthly)],
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    tmp = OUT + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    os.replace(tmp, OUT)
    log('wrote %d events in %d months to %s' % (len(events), len(out['months']), OUT))


if __name__ == '__main__':
    try:
        main()
    except urllib.error.HTTPError as e:
        log('HTTP %s from ACLED; keeping the previous file' % e.code)
    except Exception as e:  # never fail the deploy over this
        log('unexpected error (%s); keeping the previous file' % e)
