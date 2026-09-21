#!/usr/bin/env python3
"""What an American family in each wealth group actually has, in money.

Everything else on the wealth face is a share, a multiple or a composition. None of
them is a figure a person can hold against their own bank balance. This one is: the
net worth of the family in the middle of each quarter of the country, in dollars.

Reads two files from data/raw/scf/ and writes data/us_networth.json:

  interactive_bulletin_charts_nwcat_median.csv   median net worth and its parts
  interactive_bulletin_charts_nwcat_have.csv     the share of families holding each thing

Survey of Consumer Finances, the Federal Reserve's triennial bulletin tables, 1989 to
2022. Values are thousands of dollars in the money of the latest survey, so they are
comparable down the column: median family income reads 60.1 in 1989 against 70.3 in
2022, which it would not if the series were nominal.

The groups are the bulletin's own, by net worth:

  bottom25   the poorest quarter of families
  lower_mid  25 to 50
  upper_mid  50 to 75
  next15     75 to 90
  top10      the richest tenth

A median inside a group, not a total. "The top tenth has 3,795" means the family in
the middle of the top tenth, not what the tenth holds between them. That makes the
groups comparable to each other, since each is a family, and it is why this file is
worth having next to the shares rather than instead of them.

Two things the app has to carry through:

  zero is real     the median family in the poorest quarter had a net worth of 0.0 in
                   2010 and again in 2013. That is the measurement, not a gap, and it
                   must never be drawn as missing.
  one country      the SCF is the United States. Every other country's refusal says so.

Usage: python3 build_scf.py
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
RAW = os.path.join(DATA, 'raw', 'scf')

GROUPS = [
    ('Less than 25', 'bottom25'),
    ('25-49.9', 'lower_mid'),
    ('50-74.9', 'upper_mid'),
    ('75-89.9', 'next15'),
    ('90-100', 'top10'),
]
# the columns worth carrying out of a table that has thirty-odd
MEDIAN_COLS = {
    'net': 'Net_Worth', 'income': 'Before_Tax_Income', 'assets': 'Assets',
    'debt': 'Debt', 'home': 'Primary_Residence', 'retirement': 'Retirement_Accounts',
}
# the share of families who hold the thing at all, which is the other half of the story:
# a median of nought means most of the group does not have one
HAVE_COLS = {
    'home': 'Primary_Residence', 'retirement': 'Retirement_Accounts',
    'stocks': 'Directly_Held_Stocks', 'business': 'Business_Equity',
    'debt': 'Debt', 'cards': 'Credit_Card_Balances',
}


def num(v):
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return None


def read(name):
    path = os.path.join(RAW, name)
    if not os.path.exists(path):
        raise SystemExit('missing %s\n%s' % (path, __doc__))
    return list(csv.DictReader(open(path, newline='', encoding='utf-8-sig')))


def main():
    med = read('interactive_bulletin_charts_nwcat_median.csv')
    have = read('interactive_bulletin_charts_nwcat_have.csv')
    years = sorted({int(r['year']) for r in med})

    out = {
        'unit': 'thousands of dollars in the money of the latest survey year',
        'source': "Federal Reserve Survey of Consumer Finances, bulletin chart tables by "
                  "net worth group. A median within each group, not a group total.",
        'years': years,
        'groups': {},
        'labels': {
            'bottom25': 'the poorest quarter', 'lower_mid': 'the second quarter',
            'upper_mid': 'the third quarter', 'next15': 'the next fifteen per cent',
            'top10': 'the richest tenth',
        },
    }
    for label, gid in GROUPS:
        block = {}
        for key, col in MEDIAN_COLS.items():
            block[key] = [next((num(r[col]) for r in med
                                if int(r['year']) == y and r['Category'] == label), None)
                          for y in years]
        block['have'] = {}
        for key, col in HAVE_COLS.items():
            block['have'][key] = [next((num(r[col]) for r in have
                                        if int(r['year']) == y and r['Category'] == label), None)
                                  for y in years]
        out['groups'][gid] = block

    path = os.path.join(DATA, 'us_networth.json')
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, separators=(',', ':'), sort_keys=True)

    print('years   %d to %d, %d surveys' % (years[0], years[-1], len(years)))
    print('wrote %s (%d KB)' % (os.path.relpath(path, HERE), os.path.getsize(path) // 1024))

    last = len(years) - 1
    print('\nmedian net worth, %d, thousands of dollars:' % years[last])
    for _, gid in GROUPS:
        print('   %-22s %10.1f' % (out['labels'][gid], out['groups'][gid]['net'][last]))
    b = out['groups']['bottom25']['net']
    zeros = [years[i] for i, v in enumerate(b) if v == 0]
    if zeros:
        print('\nthe median family in the poorest quarter held nothing at all in %s'
              % ', '.join(str(y) for y in zeros))
    print('\nshare holding each thing, %d:' % years[last])
    print('%-22s' % 'group' + ''.join('%13s' % k for k in HAVE_COLS))
    for _, gid in GROUPS:
        h = out['groups'][gid]['have']
        print('%-22s' % out['labels'][gid] + ''.join('%12.1f%%' % h[k][last] for k in HAVE_COLS))


if __name__ == '__main__':
    main()
