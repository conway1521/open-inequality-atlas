# Open Inequality Atlas

This repo is the front-end of the full versioned panel behind it, which is currently in [wealth_ineq](https://github.com/conway1521/wealth_ineq). The user can pick a country, see how concentrated its household wealth is and how that's moved over time. Wealth Gini and the top 1%, top 10%, and bottom 50% shares for 213 countries, plus a longer US series back to 1989 built from the Survey of Consumer Finances.

So this is a static site with no backend. `index.html` reads three JSON files from `data/` and makes the html. Open it locally, or see it live at https://conway1521.github.io/open-inequality-atlas/.

As noted in the full repo, for reference: the numbers come from sources that don't naturally line up (WID, the SCF, the Fed's Distributional Financial Accounts, the ECB's HFCS), so every row has its own source and a comparability flag.
