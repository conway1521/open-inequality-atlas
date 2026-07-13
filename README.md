# Open inequality atlas

An interactive atlas of household **net wealth inequality** across the world, built as the public front-end for the [Wealth Gini Atlas](https://github.com/conway1521/wealth_ineq) dataset.

The motivation is simple. Wealth inequality gets discussed constantly, but the underlying series are scattered across incompatible sources, each with its own definitions, coverage, and quality caveats. Most public charts pick one source and move on. I wanted a single place where the numbers are harmonized, the provenance stays visible, and you can actually see how concentrated wealth is, both across countries and over time, without having to trust an unlabeled aggregate.

Live site: https://conway1521.github.io/open-inequality-atlas/

## What it shows

- **Global wealth Gini** by country, latest available year (WID, per-adult equal-split basis). Higher values mean greater concentration, and wealth turns out to be far more unequal than income almost everywhere.
- **Country trends over time**, Wealth Gini from 1990 to 2024, with search to add or remove countries.
- **US wealth distribution, 1989 to 2025**: annual top-share series from the Fed's Distributional Financial Accounts (admin-anchored), with mean and median wealth from the Survey of Consumer Finances.

A theme I keep coming back to is that the story depends on whether you are looking at survey-based or administratively-anchored series. The atlas tries to make that difference legible rather than hiding it behind a single number.

## Data

The atlas reads three JSON extracts under `data/`, generated from the Wealth Gini Atlas panel:

- `wealth_latest.json` cross-country Gini, latest year
- `wealth_timeseries.json` country trends
- `us_longrun.json` US top-share and level series

The upstream panel harmonizes WID, HFCS, LWS, SCF, and DFA into a single long-format dataset with explicit source priority and comparability metadata. Every row carries a comparability tier (harmonized survey versus mixed methodology) and a top-tail flag (survey-only versus admin-enhanced), so quality filtering is one line rather than a hand-curated exclusion list.

## Running locally

It is a static site with no build step. Serve the folder and open it:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Relation to other work

This is the display layer. The data work, source harmonization, and versioned, citable releases live in [`wealth_ineq`](https://github.com/conway1521/wealth_ineq) (the Wealth Gini Atlas, plus its companion Moments Atlas of distributional moments for heterogeneous-agent and HANK calibration). I keep them separate so the dataset stays reproducible and citable on its own, while the atlas is free to iterate on presentation.
