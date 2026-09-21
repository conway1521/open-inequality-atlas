# Open Inequality Atlas

"Inequality" is one word for several different measurements that do not agree with
each other. Rank countries by what people earn and by what they own and you get two
different tables. This puts them side by side and lets you ask questions of either.

One HTML file, no build step, no framework, no backend. It loads `data/*.json` and
nothing else.

**[conway1521.github.io/open-inequality-atlas](https://conway1521.github.io/open-inequality-atlas)**

## Running it

```
make serve          # http://localhost:8744
```

That is the whole thing. `index.html` and `data/*.json` are all a browser needs, and
both are in the repository.

## Rebuilding the data

```
make deps           # openpyxl, only needed for the ECB survey workbooks
make data           # fetch the sources, verify them, rebuild every data file
```

`make data` reports which build scripts ran and which could not, and a script that
cannot rebuild its output leaves the existing file untouched rather than writing a
thinner one.

The upstream sources are not in this tree. They are about 12 MB, they never change
once downloaded, and git keeps every version of everything forever, so each one
committed would sit in every future clone. They live in a release asset instead, and
`fetch_raw.py` pulls them on demand.

What makes that safe is `data/raw_manifest.json`, which **is** in the repository and
records the sha256 of every source file. Nothing is used unless its checksum matches.
A silently revised upstream file cannot change the numbers here without the build
stopping and naming it.

```
make check          # confirm the sources are the ones this was built from
make clean          # remove them; make data brings them back
```

## Adding data

`data/raw/README.md` is the contract: what is still outstanding, the exact filename
to save each thing as, where to download it, and which script picks it up. The short
version is that a raw file goes in `data/raw/`, a build script turns it into
`data/<name>.json`, and the app only ever reads the JSON.

## What is in here

| | |
|---|---|
| `index.html` | the whole application, markup, styles and engine |
| `data/*.json` | what the page loads, about 2.5 MB |
| `data/raw_manifest.json` | the sha256 of every upstream source |
| `data/raw/README.md` | where to put data you collect |
| `build_*.py` | one script per source, each saying what it reads and what it drops |
| `fetch_raw.py` | fetch and verify the sources |
| `FOUNDATION.md` | what the atlas may claim and at what strength |

## FOUNDATION.md

Worth reading before changing anything. It grades every claim the app is allowed to
make, records what was checked and found wrong, and says what the atlas deliberately
does not do. Section 9a is the list of defects found by auditing every column against
the sentence that quotes it, including the ones still open. Section 11 is the argument
for why this describes and does not explain.

## Licence

Code MIT. Data CC BY 4.0, and each upstream source keeps its publisher's terms; they
are named on every chart and in `data/raw/README.md`.
