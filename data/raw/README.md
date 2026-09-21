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

---

# If you are collecting data, put it here

One rule: **a raw file goes in this directory, a build script turns it into
`data/<name>.json`, and the app only ever reads the JSON.** Nothing in `data/raw/`
is loaded by the page. That is what keeps the page fast and the numbers auditable,
because the JSON is small, diffable in a pull request, and traceable back to a script
that says what it dropped and why.

Save files under the exact name in the table. The build scripts look for these names
and fail with a message naming the path if they are absent, so a wrong filename tells
you immediately rather than silently producing a thinner file.

## What is outstanding, and exactly where it goes

| what | save it as | download from | then run |
|---|---|---|---|
| house prices against income, all countries | `data/raw/bis_house_prices.csv` | BIS, "Selected residential property prices", long series, all countries, **and** the price-to-income ratio series | `build_house_prices.py` (needs extending past its two countries) |
| the same from OECD, as a cross-check | `data/raw/oecd_house_prices.csv` | OECD Analytical house prices, measure `RHP` **and** `PIR`, full time range, not the last five years | as above |
| productivity per hour | `data/raw/oecd_productivity.csv` | OECD, GDP per hour worked, constant prices, all countries, full range | a new `build_productivity.py` |
| relative poverty, half of median | `data/raw/pip_relative_poverty.csv` | World Bank PIP, poverty line set to 50% of the national median, all countries and years | fold into `build_manifest.py`'s modules |
| life satisfaction, spread within a country | `data/raw/whr_dispersion.csv` | World Happiness Report data appendix, the standard deviation of the Cantril ladder by country-year | a new `build_wellbeing.py` |
| the county covariates behind `us_income_gini` | `data/raw/cty_covariates.csv` | Opportunity Insights, county covariates, **with its header row** | `build_us.py` picks it up automatically |

The last one is not a new measure. It is the file that would settle what
`us_income_gini` actually is, which the app currently cannot say. See section 9a of
FOUNDATION.md.

## Anything not in that table

Put it here under a name that says what it is, then tell the build script about it.
Every script in the repository root starts with a docstring naming the files it reads,
the columns it takes, and what it throws away. Follow that pattern and the next person
to look, including you in six months, can tell what a number is without opening a
spreadsheet.

## What the app actually loads

Only `data/*.json`, and only the files named in the `Promise.all` block near the
bottom of `index.html`. A new JSON file does nothing until it is added there.
