#!/usr/bin/env python3
"""Output per hour worked, for holding against what the typical household earns.

Reads data/raw/oecd_productivity.csv, the OECD Productivity levels dataset, annual,
downloaded from the OECD Data Explorer (dataflow OECD.SDD.TPS, DSD_PDB@DF_PDB_LV).
Uses GDP per hour worked (MEASURE GDPHRS), whole economy, in US dollars at constant
prices and constant purchasing power parities (UNIT_MEASURE USD_PPP_H, PRICE_BASE Q,
reference year 2020).

Writes data/gdp_hour.json as {ISO3: [[year, dollars per hour], ...]}.

Why this and not GDP per person: the gap between productivity and pay is a claim
about what an hour of work produces against what it is paid. GDP per person also
moves with how many people work and how long, so a country that retires early or
works short weeks reads as "growth that did not reach the middle" when it is
nothing of the kind. Per hour removes most of that. It is still national accounts
set against a household survey, and the app says so.

Usage: python3 build_productivity.py
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
SRC = os.path.join(DATA, 'raw', 'oecd_productivity.csv')


def main():
    if not os.path.exists(SRC):
        print('no OECD productivity file at %s' % os.path.relpath(SRC, HERE))
        print('skipped: nothing written, the existing data files are unchanged.')
        print('See data/raw/README.md for where this file goes.')
        return
    names = json.load(open(os.path.join(DATA, 'geo_names.json')))
    out, dropped = {}, set()
    with open(SRC, encoding='utf-8-sig') as fh:
        for row in csv.DictReader(fh):
            if (row['MEASURE'], row['UNIT_MEASURE'], row['PRICE_BASE'], row['FREQ']) != ('GDPHRS', 'USD_PPP_H', 'Q', 'A'):
                continue
            if not row['OBS_VALUE']:
                continue
            iso = row['REF_AREA']
            if iso not in names:
                dropped.add(iso)
                continue
            out.setdefault(iso, []).append([int(row['TIME_PERIOD']), round(float(row['OBS_VALUE']), 2)])
    out = {iso: sorted(v) for iso, v in out.items() if len(v) >= 2}
    path = os.path.join(DATA, 'gdp_hour.json')
    with open(path, 'w') as fh:
        json.dump(out, fh, separators=(',', ':'), sort_keys=True)
    yrs = [y for v in out.values() for y, _ in v]
    print('gdp_hour.json  GDP per hour worked: %d countries, %d to %d, 2020 dollars at 2020 PPPs'
          % (len(out), min(yrs), max(yrs)))
    if dropped:
        print('dropped, not countries the atlas reads: ' + ', '.join(sorted(dropped)))


if __name__ == '__main__':
    main()
