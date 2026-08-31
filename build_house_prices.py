#!/usr/bin/env python3
"""Real house prices, for holding against what people earn.

The BIS and the OECD both publish house price to income ratios for about sixty
countries. Neither is reachable from the build machine, so this script assembles
what can be reached instead: two countries, from long public series, deflated by
each country's own consumer price inflation.

Sources, all mirrored on GitHub because the primaries are unreachable:
  github.com/datasets/house-prices-uk  Nationwide average UK house price, actual
                                       pounds, quarterly from 1953
  github.com/datasets/house-prices-us  S&P Case-Shiller national index, monthly
                                       from 1975 (an index: only growth means
                                       anything, the level does not)
  github.com/datasets/cpi              World Bank annual consumer price inflation,
                                       chained here into a price level

Writes data/house_prices.json as {ISO3: [[year, index], ...]} with the index in
real terms, 2015 = 100. Two countries only. This is not a global series and the
app must not present it as one.

What it is NOT: the standard "house price to earnings" ratio, which divides by
individual gross earnings. The atlas holds median household income from the World
Bank PIP instead, so any ratio built from this is houses against household income.
Directionally the same story, a different denominator, and the charts say so.

Usage: python3 build_house_prices.py <scratch dir holding the three clones>
"""
import csv
import json
import os
import statistics
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
BASE_YEAR = 2015


def price_level(cpi_csv, code):
    """World Bank publishes annual inflation, not a level. Chain it into one."""
    rate = {}
    with open(cpi_csv, newline='', encoding='utf-8') as fh:
        for row in csv.DictReader(fh):
            if row['Country Code'] != code or not row['CPI']:
                continue
            try:
                rate[int(row['Year'])] = float(row['CPI'])
            except ValueError:
                continue
    level, cur = {}, 1.0
    for year in sorted(rate):
        cur *= (1 + rate[year] / 100.0)
        level[year] = cur
    return level


def annual(path, date_col, value_cols):
    """Monthly or quarterly rows collapsed to a yearly mean."""
    buckets = defaultdict(list)
    with open(path, newline='', encoding='utf-8') as fh:
        for row in csv.DictReader(fh):
            raw = None
            for c in value_cols:
                if row.get(c):
                    raw = row[c]
                    break
            if raw is None:
                continue
            try:
                buckets[int(row[date_col][:4])].append(float(raw))
            except ValueError:
                continue
    return {y: statistics.mean(v) for y, v in buckets.items()}


def deflate(nominal, level):
    """Into constant money, then rebased so the two countries can share an axis."""
    real = {y: v * level[BASE_YEAR] / level[y]
            for y, v in nominal.items() if y in level}
    if BASE_YEAR not in real:
        raise SystemExit('no %d in the deflated series' % BASE_YEAR)
    b = real[BASE_YEAR]
    return {y: round(v / b * 100, 3) for y, v in sorted(real.items())}


def main(scratch):
    cpi = os.path.join(scratch, 'cpi', 'data', 'cpi.csv')
    uk = os.path.join(scratch, 'hp_house-prices-uk', 'data', 'data.csv')
    us = os.path.join(scratch, 'hp_house-prices-us', 'data', 'national-month.csv')
    for p in (cpi, uk, us):
        if not os.path.exists(p):
            raise SystemExit('missing %s\n%s' % (p, __doc__))

    out = {}
    nom_uk = annual(uk, 'Date', ['Price (All)'])
    out['GBR'] = list(deflate(nom_uk, price_level(cpi, 'GBR')).items())
    nom_us = annual(us, 'Date', ['National-US', 'National-US-SA'])
    out['USA'] = list(deflate(nom_us, price_level(cpi, 'USA')).items())

    path = os.path.join(DATA, 'house_prices.json')
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, separators=(',', ':'), sort_keys=True)

    for iso, series in out.items():
        yrs = [p[0] for p in series]
        print('%s  %d years, %d to %d, real index %d = 100'
              % (iso, len(series), min(yrs), max(yrs), BASE_YEAR))
    print('\nwrote %s' % os.path.relpath(path, HERE))
    print('two countries only. the sixty-country series needs BIS or OECD, '
          'neither of which the build machine can reach.')

    # the UK series is in real pounds before rebasing, which is worth stating
    lvl = price_level(cpi, 'GBR')
    hi = max(y for y in nom_uk if y in lvl)
    for y in (1970, 1995, 2007, hi):
        if y in nom_uk and y in lvl:
            print('  UK %d: %s nominal, %s in %d money'
                  % (y, '{:,.0f}'.format(nom_uk[y]),
                     '{:,.0f}'.format(nom_uk[y] * lvl[hi] / lvl[y]), hi))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
