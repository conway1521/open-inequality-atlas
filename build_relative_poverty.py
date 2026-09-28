#!/usr/bin/env python3
"""Relative poverty: the share of people below half of what the middle person has.

Reads data/raw/wdi_relative_poverty.csv, the World Development Indicators download of
SI.DST.50MD, "Proportion of people living below 50 percent of median income (%)",
which the World Bank computes from the same household surveys as the rest of its
Poverty and Inequality Platform (the SDG 10.2.1 indicator).

Writes data/poverty_relative.json as {ISO3: [[year, share], ...]}, the share as a
fraction (0.17, not 17) to match data/poverty_rate.json.

The extreme poverty line in poverty_rate.json is $2.15 a day, the line for
surviving, and reads close to zero in every rich country. This is the line the rich
countries themselves use, so it says something everywhere. Years are survey years,
so most countries have gaps; nothing is filled in.

The file is the World Bank's wide format: four lines of preamble, then one row per
country or aggregate with a column per year. Aggregates (World, regions, income
groups) are dropped by keeping only codes the atlas knows as countries.

Usage: python3 build_relative_poverty.py
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
SRC = os.path.join(DATA, 'raw', 'wdi_relative_poverty.csv')


def main():
    if not os.path.exists(SRC):
        print('no relative poverty file at %s' % os.path.relpath(SRC, HERE))
        print('skipped: nothing written, the existing data files are unchanged.')
        print('See data/raw/README.md for where this file goes.')
        return
    names = json.load(open(os.path.join(DATA, 'geo_names.json')))
    with open(SRC, encoding='utf-8-sig') as fh:
        rows = list(csv.reader(fh))
    head = next(i for i, r in enumerate(rows) if r[:2] == ['Country Name', 'Country Code'])
    years = rows[head][4:]
    out, skipped = {}, 0
    for r in rows[head + 1:]:
        if len(r) < 5 or r[3] != 'SI.DST.50MD':
            continue
        iso = r[1]
        pts = [[int(y), round(float(v) / 100, 4)] for y, v in zip(years, r[4:]) if y.strip() and v.strip()]
        if not pts:
            continue
        if iso not in names:
            skipped += 1
            continue
        out[iso] = pts
    path = os.path.join(DATA, 'poverty_relative.json')
    with open(path, 'w') as fh:
        json.dump(out, fh, separators=(',', ':'), sort_keys=True)
    yrs = [y for v in out.values() for y, _ in v]
    print('poverty_relative.json  below half the median: %d countries, %d surveys, %d to %d'
          % (len(out), len(yrs), min(yrs), max(yrs)))
    print('dropped %d aggregates (world, regions, income groups)' % skipped)


if __name__ == '__main__':
    main()
