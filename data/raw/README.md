# Raw downloads

Source files as they come off the publisher, before any build script has touched
them. Nothing in here is read by the app at runtime. Each one is turned into a
`data/*.json` by a `build_*.py` in the repo root, and it is that JSON the app loads.

Drop a download here, keep the publisher's own filename where it is meaningful, and
commit it. The build machine only ever sees what is pushed, so a file that stays on
your laptop cannot be built from.

Once a builder exists and its JSON is committed, a large raw file can be deleted
again: the builder documents where to get it and the JSON is what ships. Keep the
raw file if it is small, or if we are still iterating on the build.

Two rules from the files already here. Anything over about 50 MB should be gzipped
(`build_us.py` opens `.csv.gz` transparently) or trimmed to the countries and
indicators we actually use, because GitHub refuses at 100 MB. And whatever the
publisher calls its columns, leave them alone: the build script does the renaming,
so the raw file stays checkable against the source.

## What we are waiting on

| file | what it is | where from |
|---|---|---|
| `oecd_house_prices.csv` | price-to-income and price-to-rent ratios, about 50 countries, annual | OECD Analytical House Price Indicators |
| `social_capital_county.csv` | economic connectedness by US county | socialcapital.org |
| `health_le_by_income_cz.csv` | life expectancy by income percentile by US commuting zone | healthinequality.org |
| `bis_property_prices.csv` | long residential property price series, about 60 countries | BIS, only if the OECD file disappoints |

The first would turn the two-country house price chart on the Why page into a real
international one. The third is what would let the health face reopen.

## dfa-networth-levels.csv

The Federal Reserve's Distributional Financial Accounts, table "Levels by wealth
percentile group". Assets by class and liabilities by kind, for Bottom50, Next40,
Next9, RemainingTop1 and TopPt1, quarterly from 1989 Q3. Millions of current dollars.

This is what `build_composition.py` reads to produce `data/us_composition.json`, and
`dfa-data-definitions.txt` beside it is the Fed's own description of every column.

It is here because no other source the atlas can reach splits assets *and* debts by
wealth group on a run of years. The ECB's HFCS covers the euro area but publishes four
waves of household medians rather than a run of aggregate levels, and its asset split
by country goes no finer than real against financial, so the two do not join.

Downloaded from federalreserve.gov/releases/z1/dataviz/dfa/distribute/table/
