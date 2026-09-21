#!/usr/bin/env python3
"""Fetch the upstream source files, and refuse to use any that have changed.

The atlas ships `data/*.json`, about 2.5 MB, and a browser loads nothing else. The
files those are built from are an order of magnitude larger, they never change once
downloaded, and a git repository keeps every version of everything forever. So they
live in a release asset and this fetches them on demand.

What makes that safe rather than merely tidy is `data/raw_manifest.json`, which is in
the repository and records the sha256 and the byte count of every source file. This
script checks each one after extracting. A file whose checksum does not match is not
used, and the script stops and names it. That way the build cannot quietly produce
different numbers because an upstream file was silently revised, which is the failure
this whole arrangement exists to prevent.

  python3 fetch_raw.py            fetch anything missing, verify everything
  python3 fetch_raw.py --check    verify what is already there, fetch nothing
  python3 fetch_raw.py --force    fetch again even if the files look right

Exit status is 0 only when every file in the manifest is present and matches.
"""
import argparse
import hashlib
import json
import os
import sys
import tarfile
import tempfile
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'data', 'raw')
MANIFEST = os.path.join(HERE, 'data', 'raw_manifest.json')

REPO = 'conway1521/open-inequality-atlas'
TAG = 'raw-sources-v1'
URL = 'https://github.com/%s/releases/download/%s/raw-sources.tar.gz' % (REPO, TAG)


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def inspect(manifest):
    """Sort every file in the manifest into present-and-right, wrong, or absent."""
    ok, wrong, missing = [], [], []
    for row in manifest['files']:
        path = os.path.join(RAW, row['path'])
        if not os.path.exists(path):
            missing.append(row)
        elif os.path.getsize(path) != row['bytes'] or digest(path) != row['sha256']:
            wrong.append(row)
        else:
            ok.append(row)
    return ok, wrong, missing


def download(url, dest):
    print('fetching %s' % url)
    try:
        with urllib.request.urlopen(url, timeout=180) as r, open(dest, 'wb') as out:
            total = int(r.headers.get('Content-Length') or 0)
            got = 0
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                out.write(chunk)
                got += len(chunk)
                if total:
                    sys.stdout.write('\r  %d%%' % (100 * got // total))
                    sys.stdout.flush()
            if total:
                print()
    except urllib.error.HTTPError as e:
        raise SystemExit(
            '\nthe archive is not there yet (HTTP %s).\n\n'
            'It is published as a release asset, which has to be created once by\n'
            'somebody holding a token for the repository:\n\n'
            '  make release-archive        # builds and verifies raw-sources.tar.gz\n'
            '  gh release create %s raw-sources.tar.gz --repo %s \\\n'
            '      --title "Raw sources v1" --notes-file RELEASE_NOTES.md\n\n'
            'Without the gh command line, the same thing over the API:\n\n'
            '  make release-archive\n'
            '  make release-curl           # prints the two curl calls to run\n\n'
            'After that this script needs nothing from anyone, and `make data`\n'
            'rebuilds the whole atlas on a clean checkout.' % (e.code, TAG, REPO))
    except urllib.error.URLError as e:
        raise SystemExit('\ncould not reach GitHub: %s' % e.reason)


def main():
    ap = argparse.ArgumentParser(description=__doc__.strip().split('\n')[0])
    ap.add_argument('--check', action='store_true', help='verify only, never download')
    ap.add_argument('--force', action='store_true', help='download even if the files look right')
    args = ap.parse_args()

    if not os.path.exists(MANIFEST):
        raise SystemExit('missing %s, which records what every source file should be' % MANIFEST)
    manifest = json.load(open(MANIFEST))

    ok, wrong, missing = inspect(manifest)
    n = len(manifest['files'])
    print('%d source files: %d correct, %d altered, %d absent'
          % (n, len(ok), len(wrong), len(missing)))
    for row in wrong:
        print('  altered: %s' % row['path'])
    for row in missing:
        print('  absent:  %s' % row['path'])

    if args.check:
        if wrong or missing:
            raise SystemExit('\nrun `python3 fetch_raw.py` to restore them')
        print('every file matches the manifest')
        return

    if not (wrong or missing or args.force):
        print('nothing to fetch')
        return

    os.makedirs(RAW, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        archive = os.path.join(tmp, 'raw-sources.tar.gz')
        download(URL, archive)
        # extract beside the target and move into place only after checking, so a bad
        # archive cannot leave half-written files behind
        stage = os.path.join(tmp, 'stage')
        os.makedirs(stage)
        with tarfile.open(archive) as tf:
            for member in tf.getmembers():
                name = os.path.normpath(member.name).lstrip('./')
                if name.startswith('..') or os.path.isabs(name):
                    raise SystemExit('archive contains an unsafe path: %s' % member.name)
            tf.extractall(stage)
        moved = 0
        for row in manifest['files']:
            src = os.path.join(stage, row['path'])
            if not os.path.exists(src):
                raise SystemExit('the archive is missing %s' % row['path'])
            got = digest(src)
            if got != row['sha256']:
                raise SystemExit(
                    'checksum mismatch on %s\n  manifest %s\n  archive  %s\n'
                    'The archive does not hold the files this repository was built from. '
                    'Nothing has been written.' % (row['path'], row['sha256'], got))
            dst = os.path.join(RAW, row['path'])
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(src, 'rb') as a, open(dst, 'wb') as b:
                b.write(a.read())
            moved += 1
        print('verified and wrote %d files into %s' % (moved, os.path.relpath(RAW, HERE)))

    ok, wrong, missing = inspect(manifest)
    if wrong or missing:
        raise SystemExit('still not right after fetching: %d altered, %d absent'
                         % (len(wrong), len(missing)))
    print('every file matches the manifest')


if __name__ == '__main__':
    main()
