# Open inequality atlas

The web front end for the [Wealth Gini Atlas](https://github.com/conway1521/wealth_ineq): an interactive look at how unequally household wealth is held, across countries and over time.

Wealth inequality gets talked about constantly, but the actual numbers live in a handful of sources that disagree with each other on definitions, coverage, and how far to trust the top tail. Most charts online just pick one and move on. This started as a way to put the harmonized series somewhere you can actually look at them, provenance attached, instead of asking anyone to trust an unlabeled headline figure.

Live: https://conway1521.github.io/open-inequality-atlas/

## What you can look at

- A world map of the wealth Gini by country, latest year, from WID. Wealth is far more concentrated than income almost everywhere, and the map makes that hard to miss.
- Country trends from 1990 to 2024. Search to drop countries in and out.
- The US up close, 1989 to 2025: top shares from the Fed's Distributional Financial Accounts, with mean and median wealth from the SCF layered on.

The distinction I care about most here is survey-based versus administratively-anchored series, because that choice quietly changes the story. The atlas keeps it visible rather than smoothing it over.

## Data

Three JSON extracts in `data/`, cut from the Wealth Gini Atlas panel: `wealth_latest.json` (cross-country, latest year), `wealth_timeseries.json` (trends), and `us_longrun.json` (the US series).

The panel itself harmonizes WID, HFCS, LWS, SCF, and DFA into one long-format dataset. Each row carries a comparability tier and a top-tail flag, so filtering by quality is one line rather than a curated list of exceptions. That work lives upstream in [`wealth_ineq`](https://github.com/conway1521/wealth_ineq), not here.

## Running it

Static site, no build. Serve the folder:

```bash
python -m http.server 8000
```

## Why it is a separate repo

I keep the data and the display apart on purpose. The dataset has to stay reproducible and citable on its own; the atlas should be free to change how things look without disturbing any of that. The ingestion, the source-priority logic, and the versioned releases all sit in [`wealth_ineq`](https://github.com/conway1521/wealth_ineq).
