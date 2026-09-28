#!/usr/bin/env python3
"""House prices, and house prices against income, for about forty countries.

Reads data/raw/oecd_house_prices.csv, the OECD Analytical house price indicators,
annual, every country and every measure, downloaded from the OECD Data Explorer
(dataflow OECD.ECO.MPD, DSD_AN_HOUSE_PRICES@DF_HOUSE_PRICES). Two measures are used:

  RHP      real house price index: nominal prices deflated by the private
           consumption deflator, 2015 = 100. Only growth means anything.
  HPI_YDH  price to income ratio: nominal house prices over nominal disposable
           income per head, from national accounts, 2015 = 100.

Writes
  data/house_prices.json   {ISO3: [[year, RHP], ...]}
  data/house_income.json   {ISO3: [[year, HPI_YDH], ...]}

The OECD's own aggregates (EA, EA17, OECD) are dropped: the atlas reads countries.

Earlier versions of this script built a two-country series by hand from Nationwide,
Case-Shiller and World Bank consumer prices, because the OECD could not be reached
from where it was built. This replaces that. The OECD's real index is deflated by
the consumption deflator rather than consumer prices, so the UK and US lines move a
little against the old ones; the direction does not change.

What HPI_YDH is not: the "house price to earnings" ratio quoted in the press, which
divides by one full-time worker's gross pay. This divides by disposable income per
person across the whole economy. Same direction, different denominator, and the app
says so wherever it quotes it.

Usage: python3 build_house_prices.py
"""
import csv
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
SRC = os.path.join(DATA, 'raw', 'oecd_house_prices.csv')
AGGREGATES = {'EA', 'EA17', 'EA19', 'EA20', 'EU', 'EU27_2020', 'OECD'}
OUT = {'RHP': 'house_prices.json', 'HPI_YDH': 'house_income.json'}


def main():
    if not os.path.exists(SRC):
        print('no OECD house price file at %s' % os.path.relpath(SRC, HERE))
        print('skipped: nothing written, the existing data files are unchanged.')
        print('See data/raw/README.md for where this file goes.')
        return
    names = json.load(open(os.path.join(DATA, 'geo_names.json')))
    series = {m: {} for m in OUT}
    dropped = set()
    with open(SRC, encoding='utf-8-sig') as fh:
        for row in csv.DictReader(fh):
            m = row['MEASURE']
            if m not in OUT or row['FREQ'] != 'A' or not row['OBS_VALUE']:
                continue
            iso = row['REF_AREA']
            if iso in AGGREGATES or iso not in names:
                dropped.add(iso)
                continue
            series[m].setdefault(iso, []).append([int(row['TIME_PERIOD']), round(float(row['OBS_VALUE']), 2)])
    for m, fname in OUT.items():
        out = {iso: sorted(v) for iso, v in series[m].items() if len(v) >= 2}
        path = os.path.join(DATA, fname)
        with open(path, 'w') as fh:
            json.dump(out, fh, separators=(',', ':'), sort_keys=True)
        yrs = [y for v in out.values() for y, _ in v]
        print('%s  %s: %d countries, %d to %d, 2015 = 100' % (fname, m, len(out), min(yrs), max(yrs)))
    if dropped:
        print('dropped, not countries the atlas reads: ' + ', '.join(sorted(dropped)))


if __name__ == '__main__':
    main()
