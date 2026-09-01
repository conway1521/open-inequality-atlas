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
