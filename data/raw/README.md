# Upstream sources

**Nothing in this directory is in the repository, and nothing here is loaded by a
browser.** The files are fetched on demand and verified against
`../raw_manifest.json`, which records the sha256 of each one.

    make data      fetch them, check them, rebuild every data file
    make check     confirm they are the ones this repository was built from
    make clean     remove them again

A file whose checksum does not match the manifest is not used, and the build stops
and names it. That is the point of the arrangement: an upstream file cannot be
quietly revised and change the numbers here without somebody being told.

This README is the exception. It stays in the repository, because it is the contract
for adding new sources.

---

# Raw downloads

Source files as they come off the publisher, before any build script has touched
them. Nothing in here is read by the app at runtime. Each one is turned into a
`data/*.json` by a `build_*.py` in the repo root, and it is that JSON the app loads.

Drop a download here under the name in the table below. Do not commit it: git
ignores this directory on purpose. A new file reaches other machines through the
release archive, which means adding it to `../raw_manifest.json` and publishing a new
`raw-sources.tar.gz` (`make release-archive` builds and checks it).

Once a builder exists and its JSON is committed, a large raw file can be deleted
again: the builder documents where to get it and the JSON is what ships. Keep the
raw file if it is small, or if we are still iterating on the build.

Two rules from the files already here. Anything over about 50 MB should be gzipped
(`build_us.py` opens `.csv.gz` transparently) or trimmed to the countries and
indicators we actually use, because GitHub refuses at 100 MB. And whatever the
publisher calls its columns, leave them alone: the build script does the renaming,
so the raw file stays checkable against the source.

## What came in for version 1, and what did not

Version 1 closed in September 2026. Everything the old "waiting on" lists asked for is
either here, built and in the app, or recorded as not in version 1 with the reason.

| file | what it is | where from | built by | into |
|---|---|---|---|---|
| `oecd_house_prices.csv` | every measure, annual, 1956 to 2025, about 50 countries | OECD Data Explorer, Analytical house price indicators (`OECD.ECO.MPD`, `DSD_AN_HOUSE_PRICES@DF_HOUSE_PRICES`) | `build_house_prices.py` | `house_prices.json` (real index), `house_income.json` (price to income) |
| `oecd_productivity.csv` | GDP per person employed and per hour worked, annual | OECD Data Explorer, Productivity levels (`OECD.SDD.TPS`, `DSD_PDB@DF_PDB_LV`) | `build_productivity.py` | `gdp_hour.json` |
| `wdi_relative_poverty.csv` | share below 50% of the median, every country and survey year | World Bank WDI, indicator `SI.DST.50MD` | `build_relative_poverty.py` | `poverty_relative.json` |
| `cty_covariates.csv` | Opportunity Atlas county covariates, Table 8 | opportunityinsights.org/data | nothing: read once to test what `us_income_gini` is | FOUNDATION.md section 9a |
| `social_capital_county.csv` | economic connectedness by US county | socialcapital.org | `build_social.py` | `us_county.json` |

Not in version 1:

| what | why | what would bring it in |
|---|---|---|
| life satisfaction, spread within a country | the 2019 World Happiness Report chapter 2 file holds one row per country and no spread | a panel with the standard deviation of the ladder by country and year, and a short `build_wellbeing.py` |
| life expectancy by income beyond the US | nobody publishes it comparably across countries | nothing available; the health face stays US only |
| what `us_income_gini` is, settled | Table 8's census Gini is not it (FOUNDATION.md 9a) | the county file from the 2014 mobility paper, which carries `gini99` |
| `bis_property_prices.csv` | not needed: the OECD file covers the same countries annually | only if a country outside the OECD set is wanted |

## Two builders that cannot rebuild from the archive

`make data` runs every builder and names these two as skipped. Their JSON is committed
and correct, and the page uses it. What is missing is the source file, so they cannot be
reproduced from `raw-sources.tar.gz` alone.

| builder | writes | needs, in `data/raw/` | where from |
|---|---|---|---|
| `build_income_shares.py` | `income_top1.json`, `income_top10.json`, `income_middle40.json`, `income_bottom50.json` | `wid_pretax_income.csv` | the Our World in Data mirror of WID pretax income, `github.com/owid/owid-datasets`, dataset "World Inequality Database (WID) - Pretax income" |
| `build_us.py` | `us_county.json`, `us_state.json`, `us_names.json` | the county outcomes file (its header carries `kfr_pooled_pooled_p25`), and the county file that carries `us_income_gini` | opportunityinsights.org/data, county level; the second is the one FOUNDATION.md 9a says would settle what that column is |

`build_us.py` refuses to write a thinner file rather than dropping columns it cannot
rebuild, which is why it leaves the committed one alone.

## Anything not in those tables

Put it here under a name that says what it is, then tell the build script about it.
Every script in the repository root starts with a docstring naming the files it reads,
the columns it takes, and what it throws away. Follow that pattern and the next person
to look, including you in six months, can tell what a number is without opening a
spreadsheet.

## What the app actually loads

Only `data/*.json`, and only the files named in the `Promise.all` block near the
bottom of `index.html`. A new JSON file does nothing until it is added there.
