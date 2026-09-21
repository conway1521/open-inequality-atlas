# Foundation

What this atlas is for, what it may claim, and what it may not. Every question in
the catalogue and every chart in the app is checked against this file. If a chart
cannot be justified here, it does not ship.

Written against the data as it stood in August 2026. The numbers in this file are
real and were measured from `data/`, not asserted. Where a number moves when the
data is rebuilt, this file gets rebuilt with it.

---

## 0. The point, in one paragraph

Someone told you a number about your country. It was almost certainly the income
Gini, because that is the one that gets published. It describes pay. This atlas
puts the ownership number next to it, and they do not match: Sweden pays out more
evenly than almost anywhere and owns more unevenly than Britain, and its bottom
half takes 24 per cent of national income while owning less than nothing. Which of
those two numbers you happened to hear decided what you believe about where you
live. The pay number describes your month. The ownership number describes whether
you can buy a house, survive losing your job, or leave anything behind. The one
that decides your life is the one nobody quotes.

---

## 1. The premise

"Inequality" is used as one word for at least four different measurements that do
not agree with each other. When a newspaper says a country is unequal, it almost
always means the income Gini, because that is the number the World Bank publishes
most often. That number describes a pay slip. It does not describe what somebody
owns, how long they will live, or what their children will earn.

The atlas separates the measurements, puts them on comparable ground, and shows
that they disagree. That is the whole product. Everything else is in service of it.

Our particular angle is wealth, because wealth is the measurement that is hardest
to harmonise, least often quoted, and most decisive for how a life actually goes.
It is also the one where this project has something the sources do not: a single
comparable series assembled from WID, the ECB household survey, the Luxembourg
Wealth Study, the US Survey of Consumer Finances and the Fed's Distributional
Financial Accounts.

## 2. The reader

A person who has heard that inequality is rising, or that their country is one of
the fairer ones, and wants to know what that actually means where they live.
Someone who listens to Gary Stevenson and wants to check the argument against
harmonised numbers rather than take it on trust.

They should leave able to finish these four sentences about their own country,
and to be surprised by at least one of them:

1. My country ranks Nth of 23 on income concentration and Mth on wealth concentration.
2. The bottom half of my country owns X per cent of its wealth.
3. Since YEAR, ownership here has (or has not) pulled away from earning.
4. Around EVENT, this is what the lines did.

The point of the four together: **income inequality describes your pay. Wealth
inequality describes your life chances. They are not the same league table, and
you have only ever been shown the first one.**

## 3. What we claim, and how strongly

Graded. A claim may only be stated in the app at the strength it earns here.

### Claim 1: they are not one thing. STRONG.

Two versions of this, and the app leads with the second.

**On shares.** Wealth concentration runs roughly twice income concentration. The
top 1 per cent of Americans took 19.0 per cent of national income in 2021 and held
36.3 per cent of national wealth. Across the 51 countries of the richer third where
both are held, the wealth share is the larger in all 51, with a median ratio of 1.9
and a range of 1.1 to 3.4.

**Per person, which is the stronger form.** A share belongs to a group, and the top
1 per cent is a fiftieth the size of the bottom half, so two shares cannot be set
against each other as they stand. Divide each by the fraction of adults it covers
and both become a figure for one person. Do that on wealth and on income and the
gap in owning exceeds the gap in earning in **146 of the 146 countries** where both
can be worked out, with a median of 6 times wider. In 5 more the poorest half owes
more than it owns, so the division has no value at all: the same pattern carried
past the point the arithmetic survives.

Unanimity across 146 countries is not 146 independent measurements. Most of these
wealth figures are modelled by WID from the smaller set with tax records, so the
count is partly the model's verdict. Two things make it worth stating anyway: the
direction is the same in all 48 of the richer-third countries, where the underlying
data is best, and the claim is about a level rather than a change, which is what
survives modelling.

A multiple built by dividing by a one-per-cent share is fragile. The United States
reads about 1,800 times, and a tenth of a point on the bottom half's 1.0 per cent
share moves that to 1,600 or 2,000. **State the size, never the digits.** The app
rounds to two figures above a hundred and says what a revision would do.

Three claims sit near this one and are weaker. The bottom half's share of wealth
*falling* is a steady majority and not a rule: 33 of the 54 richer-third countries
since 1995, landing between 31 and 34 whichever of 1990, 1995 and 2000 you start
from. The bottom half owning *less than a tenth* of its country is near-universal,
211 of 213, the exceptions being Canada and Malta. The bottom half owning less than
the top 1 per cent is universal, 213 of 213.

### Claim 2: the league tables disagree. STRONG. This is the atlas's best finding.

Rank 23 rich countries by top 1 per cent share, 2017:

| | income top 1% | wealth top 1% |
|---|---|---|
| Sweden | 9.8% (20th) | 27.1% (7th) |
| Switzerland | 10.8% (16th) | 31.5% (3rd) |
| France | 9.8% (21st) | 25.9% (10th) |
| United Kingdom | 13.3% (5th) | 21.2% (20th) |
| Denmark | 12.5% (10th) | 21.3% (19th) |

Spearman rank correlation between the two tables: **0.44**.

For the bottom half it is **0.07**. The two tables are unrelated. Sweden's bottom
half takes 24.1 per cent of national income, second best in the rich world, and
owns **minus 11.0 per cent** of the wealth, worst in the rich world. They earn
well and owe more than they own. Canada is the mirror: its bottom half owns 13.9
per cent, the best here, and earns 15.6 per cent, nearly the worst.

This is the finding that proves the premise, and it belongs on the landing page.

It now holds on a third pair. Rank the 22 countries carrying both by the poorest
half's share of national wealth and by the share of households whose debts exceed
everything they hold, and the two orderings correlate at **-0.14**. The Netherlands
has one of the healthier bottom-half shares here and the second-most households below
zero; Greece's bottom half is negative in aggregate while 1.1 per cent of its
households are. An aggregate share and a headcount of people are not two views of one
thing, and a few deeply indebted households can take a national total under without
being many.

### Claim 3: ownership pulled away from earning in the United States after 2008. MODERATE, and narrow.

- 1995 to 2007: US wealth top 1% +4.1 points, income top 1% +3.9. Together.
- 2007 to 2021: wealth +2.9, income +0.7. Apart.

State this for the United States, over those years. Do not generalise it. See
section 4.

### Claim 4: concentration and how long people live. WEAK across countries, STRONG inside one.

Across countries it is weak and the chart says so. Wealth top 1% against life
expectancy, rich countries only, latest shared year: r = **-0.38**, n = 25, about
p = 0.06. Income top 1% is weaker at -0.26. Across all 209 countries wealth falls
to -0.14, because development swamps it.

Inside the United States, where the data is by income group rather than a national
average, it is a different matter. Across 595 commuting zones a man in the poorest
quarter of households lives **8.7 years** less than one in the richest quarter of the
same place. For women it is 5.6 years. No zone has no gap: the narrowest is 1.7 years
and the widest 13.5.

Where you live carries about as much as being rich does. A poor man's life expectancy
runs from 72.2 in Pecos to 80.8 in Glenwood Springs, a spread of 8.6 years for the
same income group.

And it lines up with mobility: **r = +0.39** on 595 zones between how long poor men
live and how far poor children climb. It is one country and it is a correlation, not a
mechanism. Note that this is the level, not the gap: how long poor people live in a
place, rather than how far apart rich and poor are there. The gap itself is tied to
almost nothing, which is the next section.

### Claim 2, tested again inside one country. STRONG.

The United States is the only place where all four faces are measured at the same fine
geography, so it is the only place the claim can be checked a second way. Across US
counties, every pair:

| | climbing | who you know | income gap | house value | life gap |
|---|---|---|---|---|---|
| **children climbing** | | +0.72 | -0.49 | -0.05 | -0.05 |
| **who you know** | +0.72 | | -0.46 | +0.26 | +0.13 |
| **income gap** | -0.49 | -0.46 | | +0.20 | -0.10 |
| **house value** | -0.05 | +0.26 | +0.20 | | -0.12 |
| **rich-poor life gap** | -0.05 | +0.13 | -0.10 | -0.12 | |

Between 1,555 and 3,126 counties per pair. Two things stand out and both matter.

**Who a poor child grows up around beats everything else at predicting whether they
climb: r = +0.72,** against -0.49 for the county's own income gap. This is the
strongest relationship anywhere in the atlas.

**The rich-poor gap in how long people live is tied to none of it.** Its strongest
link to anything else here is 0.13. A county can share out its income evenly and
still bury its poor a decade early.

That is claim 2 again, at a scale a thousand times finer, with the same answer. The
faces disagree between countries and they disagree between counties inside one of
them.

## 4. What we do not claim

**"Inequalities are detaching" as a general claim. Retired.**

It was the working thesis and the data does not support it. Rich world, 1995 to
2017: wealth concentration outran income concentration in 10 countries, income
outran wealth in 10, and 3 moved together. There is no general detachment.

Worse, the direction of the finding is an artifact of the start year. Measuring
the ownership premium (wealth top 1% divided by income top 1%) across rich
countries:

| window | rose | fell | median move |
|---|---|---|---|
| 1990 to 2017 | 6 | 14 | -0.39 |
| 1995 to 2017 | 6 | 16 | -0.28 |
| 2000 to 2017 | 8 | 11 | -0.05 |
| 2005 to 2017 | 15 | 7 | +0.10 |

The sign flips. Start in 1990 and the premium fell almost everywhere; start in
2005 and it rose almost everywhere. The early years for most countries are smooth
model output anchored to thin data, and starting there manufactures a trend.

The US ownership premium, year by year, is flat: 1.98 in 1990, 1.91 in 2021,
oscillating between 1.77 and 2.09 the whole time. Wealth and income concentration
have moved close to lockstep there for thirty years. Both rose. Neither detached.

**This does not weaken the project. It sharpens it.** They were never coupled.
The interesting fact is not that they came apart, it is that they were always
different measurements telling different stories, and only one of them was ever
quoted. Claim 2 is stronger than the detachment claim ever was.

**No attribution of a move to a government or a policy.**

A typical policy episode is indistinguishable from background variation:

| episode | wealth top 1% | income top 1% |
|---|---|---|
| Germany, Hartz I to IV, 2000-2005 | +1.21pt | +1.59pt |
| Germany, after Hartz, 2005-2010 | -0.58pt | +0.80pt |
| US, after the 2017 tax act, 2017-2021 | +0.78pt | -0.02pt |
| US, QE years, 2008-2014 | +1.84pt | +1.03pt |
| UK, after the Brexit vote, 2016-2021 | -0.13pt | no data |
| Greece, the bailouts, 2009-2015 | +7.80pt | +3.76pt |

The median five-year move in wealth top 1% across rich countries is 0.89 points
and the 90th percentile is 3.04. Every episode above except Greece sits inside
ordinary variation. Greece is the one that clears the noise, and it is worth
seeing precisely because it does.

So: draw the events, never compute their effect. A number attributing a move to a
party would be exactly the garbled claim this atlas exists to dismantle, and
publishing one would cost us the standing that everything else earns.

### 4a. What replaces attribution

Three moves, in order of value. None of them is causal and none pretends to be.

**Peer contrast, never before and after.** The question is not "what did this
policy do", it is "did this country move differently from comparable countries
over the same years". The global shock dominates every series, and subtracting it
changes the reading every time:

| episode | raw move | peer median | gap | rank |
|---|---|---|---|---|
| Germany, Hartz and after, 2003-2010 | +0.72pt | +0.80pt | -0.08 | 12 of 22 |
| US, after the 2017 tax act, 2017-2021 | +0.78pt | +0.12pt | +0.66 | 5 of 22 |
| US, QE years, 2008-2014 | +1.84pt | +1.40pt | +0.44 | 9 of 22 |
| UK, after the Brexit vote, 2016-2021 | -0.13pt | +0.46pt | -0.59 | 18 of 22 |
| Greece, the bailouts, 2009-2015 | +7.80pt | +1.17pt | +6.63 | 1 of 22 |

Read raw, Hartz coincides with rising wealth concentration and the story writes
itself. Read against peers, Germany was ordinary and the rise belonged to the
world. That is confirmation bias caught in the act, and the contrast is the cure.

**Let the data choose the turning points.** Importing a list of episodes we already
believe in and looking for movement around them is the bias. Detect each country's
steepest stretch first, then look up what was happening. Done that way the largest
moves are mostly not the episodes anyone would have gone looking for:

| country | steepest 6 years | move |
|---|---|---|
| Russia | 1995-2001 | +20.37pt |
| Hungary | 2011-2017 | +8.76pt |
| Netherlands | 1997-2003 | -8.57pt |
| Greece | 2011-2017 | +8.00pt |
| France | 1995-2001 | +7.72pt |

Events are a lookup layer beneath the chart. They never drive the reading.

**Composition is the only real explanation available.** Wealth concentration moves
through asset prices and through who owns which asset. If the bottom half's wealth
is a house and the top's is equities, an equity boom concentrates wealth
arithmetically. That is accounting, not causal inference, and it is the mechanism
the reader arrived wanting explained. It needs portfolio composition by wealth
group: the Fed's Distributional Financial Accounts for the US, the ECB's HFCS for
the euro area. Both are already in the wealth pipeline and neither reaches the app.

## 5. The unit is the country

The user asked whether to explore this overall, by country, or by bloc. The data
answers it. Change in wealth top 1%, 1995 to 2017:

| bloc | median | range within the bloc |
|---|---|---|
| EU core (FR DE IT ES NL BE AT) | +3.87pt | -6.77 to +6.79 |
| Nordics (SE NO DK FI) | +3.24pt | -0.68 to +4.55 |
| Anglo (US GB CA AU NZ IE) | +2.67pt | -0.68 to +6.18 |
| East Asia (JP KR) | +3.23pt | +1.24 to +3.23 |

Bloc medians span 1.2 points. Within-bloc ranges span 13. **Pooling by bloc
destroys the signal.** The Netherlands and France are both EU core and moved in
opposite directions by more than the entire spread between blocs.

Rules that follow:

- The country is the unit of analysis. Always.
- Blocs and regions may be used to filter a set of countries. They may never be
  averaged into a line that stands for the bloc.
- A world median is only shown with the composition guard already in the code:
  a year is dropped unless it carries at least half the peak sample.
- Any statement about change over time must name its window, and the window must
  be visible in the sentence, not only on the axis.

**Sensitivity is a feature, not a footnote.** Because the answer moves with the
start year, the app should be able to show that directly: a strip that reports
what the answer would have been from each of several start years. That is the most
honest possible treatment of a fragile trend, and no other inequality tool does it.

## 6. The four faces, and the cube

The cube is the composite. You can only see one face at a time, which is exactly
what happens when somebody says "inequality" and means the income Gini. Turning it
is the argument.

**What earns a face: a thing distributed among people.** Wealth, income, health and
opportunity are each spread unevenly across a population, which is what makes them
inequalities and what makes them comparable to one another. This is the only rule
that keeps the cube coherent, and it settles two open questions:

- **Productivity is not a face.** It is an aggregate. It is not distributed among
  anyone, so it cannot be unequal. It belongs inside the income face as the reading
  that answers "where did the growth go", which is the upgrade to `reach`.
  Productivity per hour against median pay is the clearest single picture of owning
  beating earning. A reading, not a face.
- **Subjective wellbeing could be a face, but not with what we hold.** Wellbeing is
  distributed across people and the World Happiness Report publishes the
  within-country dispersion. What `life_satisfaction.json` holds is the country
  mean of the Cantril ladder, which is a level. The spread would qualify. The mean
  does not.

**The cube promises four inequalities and delivers two.** Wealth and income hold
real distributions. Health holds a national average life expectancy, which by
construction cannot show a gap between rich and poor inside a country. Opportunity
holds a US-only single-cohort snapshot. Adding a fifth or sixth face while half the
existing ones are misnamed makes the problem worse. Fix the four first.

The remaining two faces of the solid stay as `link` and `extend`. Four things and
two moves is a good structure, and forcing six distributions would mean inventing
two we cannot measure.

| face | what it measures | source | standing |
|---|---|---|---|
| wealth | top 1% share, bottom 50% share, Gini | WID plus the harmonised release | core |
| income | top 1% / middle 40% / bottom 50% share, Gini, median | WID and World Bank PIP | core |
| health | closed | | **not open as a face** |
| opportunity | mobility, credit, debt and life expectancy by income, 741 US commuting zones | Opportunity Insights, Health Inequality Project | **beta, US only** |

Health is closed as a face and that is the honest position. Life expectancy across
countries is a national average, which cannot show a gap between rich and poor inside
one, and no source publishes that gap in a form that compares across borders. The face
says so and hands the cube back rather than setting a measure.

The gap itself is now visible, in the only place it can be: 595 US commuting zones,
life expectancy at 40 by household income quarter, race-adjusted, from the Health
Inequality Project. It lives inside the opportunity layer because that is the same
geography and the same kind of claim, about people in one place rather than between
countries. National life expectancy stays available to hold any measure against.

## 7. Opportunity is a beta layer

Keep it, label it, stop pretending it sits alongside the others. It is one country,
741 commuting zones, one cohort born around 1980, one snapshot with no time
dimension. It is the deepest and most vivid data in the atlas and it is not
comparable to anything else here. A beta badge is honest and costs nothing.

## 8. The events catalogue

Events are annotation, not inference. They are drawn so a reader from a country
can look for themselves. Section 4 governs what may be said about them.

The wealth series begins in 1990. Anything before that cannot be drawn against it,
which rules out a lot of what gets reached for.

**In range and worth drawing:**

| event | years | scope |
|---|---|---|
| Maastricht, the EU formed | 1993 | Europe |
| WTO founded | 1995 | global |
| Asian financial crisis | 1997-1998 | East and Southeast Asia |
| Euro introduced, then in cash | 1999, 2002 | eurozone |
| China joins the WTO | 2001 | global |
| Germany, Hartz I to IV | 2003-2005 | Germany |
| EU enlargement, ten states | 2004 | central and eastern Europe |
| Global financial crisis | 2007-2009 | global |
| Euro debt crisis and the bailouts | 2010-2012 | eurozone, Greece sharpest |
| Arab Spring | 2011 | MENA |
| TTIP negotiated, then abandoned | 2013-2016 | US and EU |
| Brexit vote, then exit | 2016, 2020 | UK |
| US tax act | 2017 | US |
| US and China tariffs | 2018-2019 | global |
| Covid | 2020-2021 | global |
| Russia invades Ukraine | 2022 | global |

**Out of range, do not offer:** Bretton Woods and its collapse (1944 to 1971),
NATO founded (1949), the founding of the EEC (1957). Mercosur (1991) is technically
in range but the member states are mostly heavily imputed in WID, so it would be
drawing a line under noise.

Political party control is a separate layer, not an event. V-Party, ParlGov and the
Comparative Political Data Set all publish clean government-composition series. Draw
it as a band beneath the chart so a reader can see what was in office. Never a
number, never a claim, for the reason in section 4.

## 9. What is missing, in priority order

The atlas can currently show that the inequalities disagree. It cannot yet show
what that does to a person, which is the entire point of claim 4 and the reason a
Gary listener would come.

1. **Housing cost to income.** BIS and OECD both publish long series. This is the
   single most requested fact about inequality in daily life and we do not hold it.
2. ~~**Household debt and financial resilience.**~~ **Half done.** The headcount is in:
   the ECB's HFCS table F3 counts households whose debts exceed everything they hold,
   for the euro area and a few neighbours, over four waves, cut by housing status and
   by the age of the reference person. 4.1 per cent of euro-area households, 10.5 in
   Finland, 23.7 per cent of Dutch households headed by someone under 35.

   It earned its place by disagreeing with the measure beside it. Rank the 22 countries
   carrying both by the poorest half's share of national wealth and by the share of
   households below zero and the two orderings have a Spearman correlation of **-0.14**.
   The Netherlands holds one of the healthier bottom-half shares in the atlas and has
   the second-most households in debt beyond their assets; Greece's bottom half is
   negative in aggregate while only 1.1 per cent of its households are. This is claim 2
   on a third pair of measures, and it is the reason the reading exists rather than a
   caveat on it.

   The two must never share an axis. One is WID, per adult, an aggregate share of a
   national total, mostly imputed. The other is a survey counting households. Section
   9a records what happens when that rule is broken.

   Still missing: resilience itself. Eurostat SILC carries "cannot face an unexpected
   expense", which is the question a reader actually has, and we do not hold it.
3. **Productivity against pay.** OECD GDP per hour worked. The productivity and pay
   gap is the clearest single picture of ownership beating earning, and it is what
   ties the atlas to the argument the reader arrived with. Right now `reach` uses
   GDP per person against median survey income, which is not like for like and is
   flagged as such. Productivity per hour would make it honest.
4. ~~**Portfolio composition by wealth group.**~~ **Done for one country.** The Fed's
   DFA was already sitting in the wealth pipeline and is now in the atlas: what each
   group's assets are, and what they owe against them, per year from 1989. Two thirds
   of what the poorest half of American households own is the house and the car; 54
   per cent of the richest thousandth's is shares. The poorest half owes 58 cents per
   dollar of assets and the richest thousandth owes one.

   This is description at a finer grain and not a mechanism, which is why it belongs
   here. It does not say why the shares outran the house. It says which group held
   which, which is the fact a reader needs before any why is worth arguing about.

   **Still open: everywhere else.** No other source splits assets *and* debts by
   wealth group on a run of years. The ECB's HFCS comes closest and is a different
   animal: four waves rather than a run, household medians rather than aggregate
   levels, and its asset split by country is only real against financial. Putting the
   two on one chart would be the SCF-against-WID mistake in section 9a. What HFCS
   does carry, and the atlas does not yet, is the share of households with negative
   net wealth per country, which is the headcount behind claim 1's five countries
   whose poorest half owes more than it owns.
5. **Within-country dispersion of life satisfaction.** Published by the World
   Happiness Report. Turns a level we already hold into an inequality, and is the
   only cheap route to a fifth real face.
6. ~~**Comparability tiers, which we already have and throw away.**~~ **Checked, and
   they do not do the job.** This item used to say the release carries
   `comparability_tier` and `observed_vs_modeled` per row, that the JSON build drops
   them, and that carrying them through would let every chart say how solid each
   country's line is. Two of those three are true and the third is not.

   Every one of the 7,455 rows the atlas draws reads `comparability_tier: B` and
   `observed_vs_modeled: imported`. The codebook defines B as "same broad concept,
   different source machinery (e.g. WID)" and imported as "published series ingested
   verbatim". Both describe the pipeline's relationship to WID. Neither describes
   WID's relationship to the world, which is the thing a reader needs. The columns
   are constant across everything shown, so carrying them through would add a column
   that reads the same on every chart.

   `negative_wealth_share` and `median_net_wealth` are in the schema and empty for
   all 7,455 rows, so neither is available either.

   What does separate a measured country from an imputed one is the shape of the
   file: all 213 countries carry a value for every year from 1990 to 2024 with no gap
   anywhere. No measurement programme produces that, and the income shares next to it
   show what real coverage looks like, with gaps in 81 of 154 countries and series
   running from 1 year to 135. Every wealth chart now says this, and says that the
   atlas cannot name which countries are which.

   **To actually fix it** the pipeline would have to record, per country-year, whether
   WID's own value rests on that country's tax records or on a regional imputation.
   That is upstream of this repo.

Item 4 is done for one country and is the reason the rest of the wealth face means
anything: a share of a national total is abstract until you know it is a mortgaged
house and a depreciating car. Item 2's headcount is in and turned out to disagree
with the shares, which makes it a finding rather than a footnote. Item 1, housing
cost against income, is now the one a reader would notice missing.

### 9a. Known defects in what we already hold

Every column was checked against the sentence that quotes it. These are what came
out, with the ones still open marked.

**Fixed, and the fix is in the app.**

- County life expectancy is measured from age forty, not from birth. The page called
  it life expectancy and printed 83.0 beside country figures that run 77 to 79. It
  now says an age reached, and the source line says why the two are not the same
  number.
- GDP per person is the Maddison Project series in 2011 international dollars. The
  median is a survey in 2017 purchasing power dollars. The growth chart puts them on
  one axis and never said they were different money.
- Two of the 3,036 county Ginis are above 1, which no Gini can be, and one county
  carries a median house value of zero. Dropped at load, with the count said out
  loud, so a re-export of the source files cannot put them back silently.
- The poverty rate is the $2.15 line. Across the richer third the median reading is
  a quarter of one per cent and eight countries read exactly zero. Any answer that
  lands on that floor now says so.
- The top-tenth-against-the-poorest-half reading was dropping Sweden, Ireland,
  Greece and Poland without a word, because you cannot divide by a negative. They
  are named now and their bars cross to the left of zero.
- `us_longrun.json` contained bare `NaN`, which is not JSON. The loader was patching
  it with a regex on every load.

**Open, and needing something we cannot get from here.**

- `mean_net_wealth` in `wealth_gini_atlas_v0.4.0.csv` is labelled `EUR_PPP` for
  every row and is actually local currency: Iran 7.9bn, Lebanon 2.3bn, Sweden 3.16M
  SEK. Fixing it needs World Bank `PA.NUS.PPP`, which this environment cannot reach.
  This is a defect in the upstream pipeline, not in the app.
- `us_income_gini` comes from a county covariates file no longer in the repo, so its
  exact definition cannot be traced. A median of 0.37 fits Opportunity Insights'
  `gini99`, the Gini excluding the top one per cent; the two impossible values above
  1 fit a Gini computed over incomes including capital losses. It is labelled
  "income gap" in the app rather than "income Gini" because that is what can be
  defended. Re-exporting the source file with its header would settle it.
- Relative poverty, a line at half the median, would say something about a rich
  country where the $2.15 line says nothing. The PIP files in the mirror we can
  reach are zero bytes.
- The OECD housing export covers 2021-Q3 to 2026-Q2 on measure `RHP`, and the BIS
  export is a single "advanced economies" aggregate. Neither is usable. House prices
  remain two countries.

**Checked and correct, recorded so nobody checks twice.** The three income shares
sum to one in all 4,428 country-years. The top 1 per cent sits inside the top 10 per
cent everywhere. House prices are 2015 = 100 in both countries. The commuting-zone
credit, mortgage and delinquency columns are not topcoded. Negative bottom-50 wealth
shares are real, not sign errors: eight countries have been below zero at some point
and five are there now.

## 10. Checking a new question

A question earns its place in the catalogue if it can answer all five:

1. Which claim in section 3 does it serve, at what strength?
2. Is the unit the country, or is it pooling something section 5 forbids?
3. If it reports a change, does the sentence name the window, and is the finding
   robust to moving the start year by five years?
4. Does the answer say what it rests on: how many countries, which years, how far
   apart the paired measurements are?
5. Can a reader from one country see themselves in it?

A question that only demonstrates what the query grammar can express is not a
question. That is the failure mode this file exists to prevent: the app has a
complete grammar of `facet x place x scope x when x against x form`, every
combination is legal, and so a catalogue assembled from the grammar is an
arbitrary sample rather than an argument. The claims come first. The grammar
serves them.

## 11. What an exploratory atlas owes, given it explains nothing

This atlas describes and does not explain. Section 4 already rules out attributing
a move to a policy. That is a deliberate limit, not a stage on the way to
something else: the explanation is contested and the facts are not, and an atlas
that supplies its own explanation inherits the argument instead of settling the
ground under it. A reader who wants the mechanism has Gary for that. What nobody
has is the verified ground truth in a form you can poke at.

Refusing to explain is only defensible if four other things hold.

1. **Every number is right.** Section 9a is the record of checking, including the
   times it was not.
2. **Every number says what it is and what it is not.** The provenance line, the
   dropped-value counts, the floor note on extreme poverty, the note that the
   completeness of the wealth file is the model.
3. **Every answer opens onto the next question.** An atlas that only answers is a
   lookup. Each answer carries at most three next steps worked out from *that*
   answer: a bottom half that owes offers the other countries in that position by
   name, a league table offers the country that came top, an income multiple
   offers its wealth twin. Each is checked against the data before it is drawn, so
   no step is a dead end, and the last few answers are remembered so that following
   the first step repeatedly walks somewhere rather than bouncing between two
   readings. A step that would change which country is being read says so on its
   own face.
4. **Nothing is implied that has not been shown.** Two shares on one axis, never an
   index; correlations named as correlations across places; events drawn as
   background and never as causes.

The thing this atlas is still missing is not a mechanism. It is composition: what
the bottom half actually owns, a house or a pension or nothing. That is section 9
item 4, and it is description at a finer grain rather than explanation, which is
why it belongs here and a policy story does not.
