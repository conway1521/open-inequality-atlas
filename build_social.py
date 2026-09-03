#!/usr/bin/env python3
"""Add the two halves of connectedness to the county layer.

The Social Capital Atlas asks who a low-income person's friends are. Its headline
measure, economic connectedness, is already in data/us_county.json as us_econ_conn.
What is not there, and what makes the measure worth arguing with, is the split
underneath it:

  exposure        are higher-income people around at all, in the settings this person
                  moves through
  friending bias  given that they are around, how much less likely a friendship is
                  than it would be if people mixed at random

A place can fail at either one, and they are close to independent across counties
(r = -0.22), so a single connectedness number hides which of the two is going on.
That is the whole reason to carry them.

Reads data/raw/social_capital_county.csv (Chetty et al, socialcapital.org), writes
two new blocks into data/us_county.json:

  us_exposure   exposure_grp_mem_county
  us_bias       bias_grp_mem_county

County level, because that is how it is published and because us_county.json already
holds mobility for 3208 counties. It is deliberately not rolled up to commuting
zones: the only crosswalk in the repo covers 1559 of 3089 counties and skews to the
large ones, which would drop the small rural counties, the ones where connectedness
runs highest.

Usage: python3 build_social.py
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
SRC = os.path.join(DATA, 'raw', 'social_capital_county.csv')

COLS = {
    'us_exposure': 'exposure_grp_mem_county',
    'us_bias': 'bias_grp_mem_county',
}


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def main():
    if not os.path.exists(SRC):
        raise SystemExit('missing %s\n%s' % (SRC, __doc__))
    path = os.path.join(DATA, 'us_county.json')
    county = json.load(open(path, encoding='utf-8'))

    with open(SRC, newline='', encoding='utf-8-sig') as fh:
        rows = list(csv.DictReader(fh))

    for key, col in COLS.items():
        block = {}
        for r in rows:
            v = num(r.get(col))
            if v is None:
                continue
            block[str(r['county']).zfill(5)] = round(v, 4)
        county[key] = block
        print('%-14s %5d counties' % (key, len(block)))

    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(county, fh, separators=(',', ':'), sort_keys=True)
    print('\nwrote %s' % os.path.relpath(path, HERE))

    # the point of splitting them: the two failures are nearly independent
    ex, bi, mob = county['us_exposure'], county['us_bias'], county.get('us_mobility', {})
    pairs = [(ex[c], bi[c]) for c in ex if c in bi]
    both = [(ex[c], bi[c], mob[c]) for c in ex if c in bi and c in mob and mob[c] is not None]

    def pearson(xs, ys):
        n = len(xs)
        mx, my = sum(xs) / n, sum(ys) / n
        sx = sum((x - mx) ** 2 for x in xs) ** 0.5
        sy = sum((y - my) ** 2 for y in ys) ** 0.5
        return (sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (sx * sy)) if sx and sy else None

    print('exposure against friending bias: r = %+.2f on %d counties'
          % (pearson([p[0] for p in pairs], [p[1] for p in pairs]), len(pairs)))
    print('  against upward mobility: exposure r = %+.2f, bias r = %+.2f, on %d'
          % (pearson([p[0] for p in both], [p[2] for p in both]),
             pearson([p[1] for p in both], [p[2] for p in both]), len(both)))


if __name__ == '__main__':
    main()
