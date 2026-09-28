#!/usr/bin/env python3
"""Remove excluded countries from every data file the page loads.

The atlas does not include Israel. Rather than teach every builder the same rule, this
runs after all of them (`make data` calls it last, before the manifest) and strips the
excluded codes from each data/*.json, whatever its shape:

  {ISO3: ...}                  a series or a name table: the key is dropped
  [{"geo_id": ISO3, ...}, ...] the wealth panels: the rows are dropped

It is idempotent, so running it on files that are already clean changes nothing. It
prints what it removed from each file, and says so when a file had nothing to remove.
The page also refuses the name when it is asked for, saying the atlas does not include
it, so the exclusion is never silent.

Usage: python3 apply_exclusions.py
"""
import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
EXCLUDED = {'ISR'}


def strip(data):
    if isinstance(data, dict):
        gone = [k for k in data if k in EXCLUDED]
        for k in gone:
            del data[k]
        return data, len(gone)
    if isinstance(data, list):
        keep = [r for r in data if not (isinstance(r, dict) and r.get('geo_id') in EXCLUDED)]
        return keep, len(data) - len(keep)
    return data, 0


def main():
    total = 0
    for path in sorted(glob.glob(os.path.join(HERE, 'data', '*.json'))):
        if os.path.basename(path) in ('raw_manifest.json',):
            continue
        raw = open(path).read()
        data, n = strip(json.loads(raw))
        if not n:
            continue
        total += n
        # keep each file's own layout: the compact ones stay compact
        compact = '\n' not in raw.strip()
        with open(path, 'w') as fh:
            if compact:
                json.dump(data, fh, ensure_ascii=False, separators=(',', ':'), sort_keys=raw.lstrip().startswith('{') and _sorted(raw))
            else:
                json.dump(data, fh, ensure_ascii=False, indent=1 if raw.startswith('[\n {') or raw.startswith('{\n "') else 2)
                fh.write('\n' if raw.endswith('\n') else '')
        print('%-28s removed %d' % (os.path.relpath(path, HERE), n))
    print('excluded %s: %d entries removed' % (', '.join(sorted(EXCLUDED)), total) if total
          else 'excluded %s: nothing left to remove' % ', '.join(sorted(EXCLUDED)))


def _sorted(raw):
    keys = list(json.loads(raw).keys())
    return keys == sorted(keys)


if __name__ == '__main__':
    main()
