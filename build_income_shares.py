#!/usr/bin/env python3
"""Turn the WID pretax income share series into the atlas's per-ISO3 JSON.

Source: World Inequality Database, pretax national income, equal-split adults,
as published in the Our World in Data dataset mirror
(github.com/owid/owid-datasets, "World Inequality Database (WID) - Pretax income",
retrieved from WID on 2022-09-26, running to 2021).

This is the same unit convention as the WID wealth series the atlas already
carries: per adult, income split equally within the couple. That is what makes
an income share comparable to a wealth share here. It is NOT comparable to the
World Bank PIP income Gini, which is a post-tax household survey measure.

Writes, as {ISO3: [[year, share], ...]} with share as a fraction of the total:
  data/income_top1.json       top 1% share of pretax national income
  data/income_top10.json      top 10%
  data/income_middle40.json   the middle 40% (p50 to p90)
  data/income_bottom50.json   the bottom 50%

Usage: python3 build_income_shares.py <path-to-wid-pretax-income.csv>
"""
import csv
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')

COLS = {
    'income_top1': 'P99-P100 - share of the top 1%',
    'income_top10': 'P90-P100 - share of the top 10%',
    'income_middle40': 'P50-P90 - share of the middle 40%',
    'income_bottom50': 'P0-P50 - share of the bottom 50%',
}

# WID/OWID entity names that do not match the atlas's country names verbatim.
# Anything still unmatched after this is reported, never dropped in silence.
ALIAS = {
    'Bosnia and Herzegovina': 'BIH',
    'Cape Verde': 'CPV',
    'Cote d\'Ivoire': 'CIV',
    "Cote d'Ivoire": 'CIV',
    'Czechia': 'CZE',
    'Democratic Republic of Congo': 'COD',
    'East Timor': 'TLS',
    'Congo': 'COG',
    'Hong Kong': 'HKG',
    'Iran': 'IRN',
    'Laos': 'LAO',
    'Macao': 'MAC',
    'Micronesia (country)': 'FSM',
    'Moldova': 'MDA',
    'North Korea': 'PRK',
    'North Macedonia': 'MKD',
    'Palestine': 'PSE',
    'Russia': 'RUS',
    'South Korea': 'KOR',
    'Syria': 'SYR',
    'Taiwan': 'TWN',
    'Tanzania': 'TZA',
    'Timor': 'TLS',
    'Turkey': 'TUR',
    'United Kingdom': 'GBR',
    'United States': 'USA',
    'Venezuela': 'VEN',
    'Vietnam': 'VNM',
    'Brunei': 'BRN',
    'Swaziland': 'SWZ',
    'Eswatini': 'SWZ',
    'Sint Maarten (Dutch part)': 'SXM',
    'Saint Martin (French part)': 'MAF',
}

# WID publishes regional and world aggregates in the same file. The atlas builds
# its own aggregates from countries, so these are dropped on purpose, by name.
AGGREGATES = {
    'World', 'Africa', 'Asia', 'Europe', 'North America', 'South America',
    'Oceania', 'European Union', 'Latin America', 'Middle East',
    'Sub-Saharan Africa', 'North Africa', 'East Asia', 'South & South-East Asia',
    'Central Asia', 'Russia and Central Asia', 'Asia (excl. China and India)',
    'Europe (Eastern)', 'Europe (Western)', 'Middle East and North Africa',
    'Latin America and the Caribbean',
    'Asia (excluding Middle East)', 'East Africa', 'Eastern Europe', 'MENA',
    'Middle Africa', 'North America and Oceania', 'Other East Asia',
    'Other Latin America', 'Other MENA', 'Other Russia and Central Asia',
    'Other South & South-East Asia', 'Other Sub-Saharan Africa',
    'Other Western Europe', 'South Africa region', 'South Asia', 'South-East Asia',
    'West Africa', 'West Asia', 'Western Europe',
}

# below the country level, so there is no ISO3 to key them by. dropped by name
# rather than by falling through the matcher unnoticed.
SUBNATIONAL = {
    'China - rural', 'China - urban', 'East Germany', 'Zanzibar',
}


def main(src):
    names = json.load(open(os.path.join(DATA, 'geo_names.json')))
    by_name = {v: k for k, v in names.items()}

    out = {k: {} for k in COLS}
    unmatched, aggregates_seen, sub_seen = set(), set(), set()
    rows = 0

    with open(src, newline='', encoding='utf-8') as fh:
        for row in csv.DictReader(fh):
            ent = (row.get('Entity') or '').strip()
            if not ent:
                continue
            if ent in AGGREGATES:
                aggregates_seen.add(ent)
                continue
            if ent in SUBNATIONAL:
                sub_seen.add(ent)
                continue
            iso = ALIAS.get(ent) or by_name.get(ent)
            if not iso:
                unmatched.add(ent)
                continue
            try:
                year = int(row['Year'])
            except (KeyError, TypeError, ValueError):
                continue
            for key, col in COLS.items():
                raw = (row.get(col) or '').strip()
                if not raw:
                    continue
                try:
                    v = float(raw)
                except ValueError:
                    continue
                # WID publishes these as per cent; the atlas stores fractions
                out[key].setdefault(iso, []).append([year, round(v / 100.0, 5)])
            rows += 1

    for key in out:
        for iso in out[key]:
            out[key][iso].sort(key=lambda p: p[0])
        path = os.path.join(DATA, key + '.json')
        with open(path, 'w', encoding='utf-8') as fh:
            json.dump(out[key], fh, separators=(',', ':'), sort_keys=True)
        yrs = [p[0] for s in out[key].values() for p in s]
        print('%-20s %3d countries  %6d points  %d to %d  -> %s'
              % (key, len(out[key]), len(yrs), min(yrs), max(yrs),
                 os.path.relpath(path, HERE)))

    print('\nread %d country rows' % rows)
    if aggregates_seen:
        print('dropped %d WID aggregates (the atlas builds its own from countries): %s'
              % (len(aggregates_seen), ', '.join(sorted(aggregates_seen))))
    if sub_seen:
        print('dropped %d below country level (no ISO3 to key them by): %s'
              % (len(sub_seen), ', '.join(sorted(sub_seen))))
    if unmatched:
        print('NO ISO3 MATCH for %d entities, left out: %s'
              % (len(unmatched), ', '.join(sorted(unmatched))))
    else:
        print('every remaining entity matched an ISO3; nothing dropped unnamed')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
