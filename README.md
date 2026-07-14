# Open Inequality Atlas

This repo is the front-end of the full versioned panel behind it, which is currently in [wealth_ineq](https://github.com/conway1521/wealth_ineq). It shows an interactive look at how unequally household wealth is held, across countries and over time. The user can pick a country, see how concentrated its household wealth is and how that's moved over time. Wealth Gini and the top 1%, top 10%, and bottom 50% shares for 213 countries, plus a longer US series back to 1989 built from the Survey of Consumer Finances.

Wealth inequality gets talked about constantly, but the actual numbers live in a handful of sources that disagree with each other on definitions, coverage, and how far to trust the top tail. Most charts online just pick one and move on. This started as a way to put the harmonized series somewhere one can actually look at them, provenance attached. 
So this is a static site with no backend. `index.html` reads three JSON files from `data/` and makes the html. Open it locally, or see it live at https://conway1521.github.io/open-inequality-atlas/.

Speficially, this view shows:
- A world map of the wealth Gini by country, latest year, from WID. Wealth is far more concentrated than income almost everywhere which we can see clearly on the map.
- Country trends from 1990 to 2024, with the ability to search to drop countries in and out.
- A focus on the USA from 1989 to 2025, where we see the top shares from the Fed's Distributional Financial Accounts, with mean and median wealth from the SCF layered on.

As noted in the full repo, for reference: the numbers come from sources that don't naturally line up (WID, the SCF, the Fed's Distributional Financial Accounts, the ECB's HFCS), so every row has its own source and a comparability flag.
