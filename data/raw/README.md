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

## hfcs/

Four workbooks of statistical tables from the ECB's Household Finance and Consumption
Survey, waves 2010, 2014, 2017 and 2021. `build_hfcs.py` reads table F3 out of each,
which counts households whose debts exceed everything they hold, and writes
`data/hfcs_negative.json`.

This is a survey of households. The wealth shares beside it in the atlas are WID's
per-adult shares of a national total, mostly imputed. They are not two versions of one
number and the app never draws them on one axis: ranked against each other across the
22 countries that carry both, they correlate at -0.14.

Waves are named by year and the fieldwork behind each ran in different years in
different countries, so the wave is a label rather than a reference date. The set of
countries changes between waves, which moves the euro-area aggregate too. The source
marks country-specific comparability issues for most members and reports some cells as
too few observations to give; those are dropped rather than read as zero.

Downloaded from ecb.europa.eu/pub/economic-research/research-networks/html/researcher_hfcn.en.html

Tables G2, G3 and H1 of the same workbooks feed `data/hfcs_resilience.json`: money left
over at the end of the month cut by net wealth fifth, whether a household could raise
money from friends or relatives in an emergency, and whether it was refused credit or
given less than it asked for.

This was going to be Eurostat SILC's "cannot face an unexpected expense", which is the
cleanest version of the question. Eurostat is not reachable from this environment. HFCS
is the better source regardless: same survey, same waves, same countries as the
headcount, so no new comparability seam between them.
