#!/usr/bin/env python3
"""What a country's wealth is actually made of, by wealth group.

Every other wealth reading in the atlas is a share: the poorest half hold 4.6% of
Britain's wealth. A share tells you how much, never what of. This tells you what of.

Reads data/raw/dfa-networth-levels.csv, the Federal Reserve's Distributional Financial
Accounts, and writes data/us_composition.json.

The DFA is the only source the atlas holds that splits assets AND liabilities by wealth
percentile group on a quarterly run. It is one country. That is stated on the chart and
in the refusal for every other country, the same way house prices are.

Its groups are the atlas's own, which is why it fits: Bottom50, Next40, Next9,
RemainingTop1 (the 0.9% below the top thousandth), TopPt1. The file emits the five the
atlas talks in:

  bottom50   the poorest half
  middle40   the forty per cent above them
  top10      Next9 + RemainingTop1 + TopPt1
  top1       RemainingTop1 + TopPt1
  top01      TopPt1, the richest thousandth

Groups overlap on purpose. top10 contains top1 contains top01, because a reader asks
about the top 1% and about the top 10% and should get either without a second file.

Asset classes are collapsed from the DFA's own, with the two pension lines added
together because a reader does not distinguish a defined-benefit entitlement from a
defined-contribution pot, and the distinction is not what this reading is for:

  real_estate  owner-occupied housing, at market value
  durables     the car, the furniture, the appliances, at current cost
  equities     corporate equities and mutual funds held directly, so NOT the equities
               inside a pension, which sit under pensions
  pensions     DB entitlements plus DC pots
  business     equity in a business that is not publicly traded
  other        everything else, which is mostly deposits and bonds

Liabilities are kept split, because the whole point of the bottom half's line is which
kind of debt it is:

  mortgages    residential mortgage debt as lenders report it
  credit       consumer credit: cards, student loans, car loans
  other_debt   the rest

Values are millions of current US dollars, not deflated. The atlas reads shares of
assets from them, which inflation does not touch, and one level for scale. One reading
a year, the fourth quarter, because a composition is a standing state rather than
something to average.

Usage: python3 build_composition.py
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
SRC = os.path.join(DATA, 'raw', 'dfa-networth-levels.csv')

# the atlas's groups, built from the DFA's
GROUPS = {
    'bottom50': ['Bottom50'],
    'middle40': ['Next40'],
    'top10':    ['Next9', 'RemainingTop1', 'TopPt1'],
    'top1':     ['RemainingTop1', 'TopPt1'],
    'top01':    ['TopPt1'],
}
PARTS = {
    'real_estate': ['Real estate'],
    'durables':    ['Consumer durables'],
    'equities':    ['Corporate equities and mutual fund shares'],
    'pensions':    ['DB pension entitlements', 'DC pension entitlements'],
    'business':    ['Private businesses'],
    'other':       ['Other assets'],
}
TOTALS = {
    'assets': ['Assets'], 'net': ['Net worth'], 'liab': ['Liabilities'],
    'mortgages': ['Home mortgages'], 'credit': ['Consumer credit'],
    'other_debt': ['Other liabilities'],
}


def main():
    if not os.path.exists(SRC):
        raise SystemExit('missing %s\n%s' % (SRC, __doc__))
    rows = list(csv.DictReader(open(SRC, newline='', encoding='utf-8-sig')))

    by_date = {}
    for r in rows:
        by_date.setdefault(r['Date'], {})[r['Category']] = r

    # one reading a year: the fourth quarter, and whatever the latest year reached
    years = sorted({int(d.split(':')[0]) for d in by_date})
    pick = {}
    for y in years:
        qs = sorted(d for d in by_date if d.startswith('%d:' % y))
        if qs:
            pick[y] = qs[-1]        # Q4 where the year is complete, else the last quarter
    years = [y for y in years if y in pick]

    def total(date, cats, cols):
        got = 0.0
        for cat in cats:
            r = by_date[date].get(cat)
            if r is None:
                return None
            for c in cols:
                got += float(r[c])
        return round(got)

    out = {
        'unit': 'millions of current US dollars, not deflated',
        'source': "Federal Reserve Distributional Financial Accounts, table 'Levels by "
                  "wealth percentile group'. One reading a year, the last quarter of it.",
        'years': years,
        'parts': list(PARTS),
        'groups': {},
    }
    for gid, cats in GROUPS.items():
        block = {k: [] for k in TOTALS}
        block['parts'] = {p: [] for p in PARTS}
        for y in years:
            d = pick[y]
            for k, cols in TOTALS.items():
                block[k].append(total(d, cats, cols))
            for p, cols in PARTS.items():
                block['parts'][p].append(total(d, cats, cols))
        out['groups'][gid] = block

    path = os.path.join(DATA, 'us_composition.json')
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, separators=(',', ':'), sort_keys=True)

    print('years          %d to %d' % (years[0], years[-1]))
    print('groups         %s' % ', '.join(GROUPS))
    print('wrote %s (%d KB)' % (os.path.relpath(path, HERE), os.path.getsize(path) // 1024))

    # the reading this exists for, printed so a rebuild shows whether it still holds
    last = len(years) - 1
    print('\nwhat each group owns, %d, as a share of that group\'s assets:' % years[last])
    head = '%-10s' % 'group' + ''.join('%11s' % p for p in PARTS) + '%13s' % 'debt/assets'
    print(head)
    for gid in GROUPS:
        b = out['groups'][gid]
        a = b['assets'][last]
        if not a:
            continue
        print('%-10s' % gid
              + ''.join('%10.0f%%' % (100 * b['parts'][p][last] / a) for p in PARTS)
              + '%12.0f%%' % (100 * b['liab'][last] / a))
    b = out['groups']['bottom50']
    a = b['assets'][last]
    house = 100 * (b['parts']['real_estate'][last] + b['parts']['durables'][last]) / a
    print('\nthe house and the car come to %.0f%% of what the poorest half owns, '
          'and they owe %.0f cents against every dollar of it'
          % (house, 100 * b['liab'][last] / a))


if __name__ == '__main__':
    main()
