#!/usr/bin/env python3
"""Fold life expectancy by income into the US commuting zone layer.

This measures something inside a place rather than between places, which is what the
rest of the atlas cannot do. It joins onto the same 741 commuting zones the opportunity
data already uses.

Reads, from data/raw/:
  health_ineq_online_table_6.csv    life expectancy at 40 by household income quartile,
                                    by sex, race-adjusted, per commuting zone.
                                    Chetty et al, the Health Inequality Project.

Rewrites data/us_cz.json in place, adding to each zone:
  leq1M leq4M leq1F leq4F   life expectancy at 40, poorest and richest income quarter

Life expectancy here is race-adjusted, which is the published default: it holds the
racial composition of each zone at the national average so that zones are compared on
something other than who lives in them. The unadjusted columns are in the source if we
ever want to say something different.

Usage: python3 build_us_deep.py
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
RAW = os.path.join(DATA, 'raw')


def rows(name):
    path = os.path.join(RAW, name)
    if not os.path.exists(path):
        raise SystemExit('missing %s\n%s' % (path, __doc__))
    with open(path, newline='', encoding='utf-8-sig', errors='replace') as fh:
        return list(csv.DictReader(fh))


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def main():
    cz = json.load(open(os.path.join(DATA, 'us_cz.json'), encoding='utf-8'))

    # life expectancy, straight onto the zone
    le_added = 0
    for r in rows('health_ineq_online_table_6.csv'):
        z = cz.get(r['cz'])
        if z is None:
            continue
        got = {}
        for key, col in (('leq1M', 'le_raceadj_q1_M'), ('leq4M', 'le_raceadj_q4_M'),
                         ('leq1F', 'le_raceadj_q1_F'), ('leq4F', 'le_raceadj_q4_F')):
            v = num(r.get(col))
            if v is not None:
                got[key] = round(v, 2)
        if len(got) == 4:
            z.update(got)
            le_added += 1

    # No social capital here. Economic connectedness already sits in us_county.json for
    # 3018 counties, and the only county-to-zone crosswalk we hold covers 1559 of them,
    # skewed to the large ones. Rolling it up through that would quietly drop the small
    # rural counties, which are exactly the ones where connectedness runs highest.

    path = os.path.join(DATA, 'us_cz.json')
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(cz, fh, separators=(',', ':'), sort_keys=True)

    print('zones in file            %d' % len(cz))
    print('with life expectancy     %d' % le_added)
    print('\nwrote %s' % os.path.relpath(path, HERE))

    have = [z for z in cz.values() if 'leq1M' in z]
    if have:
        gapM = sorted(z['leq4M'] - z['leq1M'] for z in have)
        gapF = sorted(z['leq4F'] - z['leq1F'] for z in have)
        mid = len(gapM) // 2
        print('median rich-poor gap in life expectancy at 40: '
              '%.1f years for men, %.1f for women' % (gapM[mid], gapF[mid]))
        print('widest zone %.1f years, narrowest %.1f' % (gapM[-1], gapM[0]))


if __name__ == '__main__':
    main()
