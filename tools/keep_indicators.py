"""Exit 1 (so the workflow keeps the live copy) when a freshly built indicators.js has under half the
indicators of the live one, e.g. when the World Bank API was down during the weekly refresh.

    python3 tools/keep_indicators.py <live indicators.js> <new indicators.js>
"""
import json, os, sys


def count(p):
    if not os.path.exists(p) or not os.path.getsize(p):
        return 0
    s = open(p, encoding='utf-8').read()
    return len(json.loads(s[s.index('=') + 1:s.rstrip().rindex(';')]).get('ind', []))


live, new = count(sys.argv[1]), count(sys.argv[2])
print('indicators: live %d, new build %d' % (live, new))
sys.exit(1 if new < live / 2 else 0)
