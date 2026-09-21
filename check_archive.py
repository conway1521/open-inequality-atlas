#!/usr/bin/env python3
"""Check raw-sources.tar.gz against data/raw_manifest.json before it is published.

The manifest is what `fetch_raw.py` verifies every download against, so an archive
that does not match it would be rejected by every clone that pulled it. Better to
find that out here than after publishing.

Run through `make release-archive`, which builds the archive first.
"""
import hashlib
import json
import os
import sys
import tarfile

HERE = os.path.dirname(os.path.abspath(__file__))
ARCHIVE = os.path.join(HERE, 'raw-sources.tar.gz')
MANIFEST = os.path.join(HERE, 'data', 'raw_manifest.json')


def main():
    if not os.path.exists(ARCHIVE):
        raise SystemExit('no raw-sources.tar.gz; run `make release-archive`')
    want = {r['path']: r['sha256'] for r in json.load(open(MANIFEST))['files']}

    got = {}
    with tarfile.open(ARCHIVE) as tf:
        for m in tf.getmembers():
            if not m.isfile():
                continue
            name = os.path.normpath(m.name).lstrip('./')
            got[name] = hashlib.sha256(tf.extractfile(m).read()).hexdigest()

    missing = sorted(set(want) - set(got))
    extra = sorted(set(got) - set(want))
    bad = sorted(p for p in want if p in got and want[p] != got[p])
    for p in missing:
        print('missing from the archive: %s' % p)
    for p in extra:
        print('in the archive but not the manifest: %s' % p)
    for p in bad:
        print('checksum mismatch: %s' % p)
    if missing or extra or bad:
        raise SystemExit('the archive does not match data/raw_manifest.json, so do not publish it')

    print('raw-sources.tar.gz: %d files, every checksum matching the manifest' % len(got))
    print('%.1f MB, ready to attach to the release' % (os.path.getsize(ARCHIVE) / 1e6))


if __name__ == '__main__':
    sys.exit(main())
