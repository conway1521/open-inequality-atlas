'use strict';
// reading a question: the conversation context, the pool of countries, the parser and the helpers it shares.
// one of eight files loaded in order by index.html; they share one scope, so a
// function here can be used by any of them once the page has loaded

/* ── conversation context ──────────────────────────────────────────── */
const ctx = { lastIso: null, metric: 'wealth_top1', lastRankDir: null, lastRegion: null,
  lastAspect: null, pool: null, lastQuery: null, region: null };
function setRegion(r) { if (r !== ctx.region) { ctx.region = r; medianCache.gen = (medianCache.gen || 0) + 1; } }
function focusIsos() {
  const set = [];
  chain.forEach(f => (f.isos || []).forEach(i => { if (!set.includes(i)) set.push(i); }));
  return set;
}

/* ── Pool: the ambient "who counts as everyone" condition (the AMONG move) ── */
// ctx.pool = { label, metric, dir } → a tercile of some metric; null = all countries.
let POOL_SET = null;   // Set of allowed isos, or null for all
// "the whole world" as a set of its own. with no set chosen, rankings use the richer
// third; "all countries" used to clear the set and so landed back on the richer third,
// while every ranking told the reader to ask for the whole world to widen it
const ALL_POOL = { label: 'all countries', all: true, dir: 'all', metric: null };
const poolKey = pool => pool.all ? 'all' : pool.dir === 'high' ? 'rich' : 'poor';
function computePool() {
  if (!ctx.pool || ctx.pool.all) { POOL_SET = null; medianCache.gen = (medianCache.gen || 0) + 1; return; }
  const pool = poolOf(ctx.pool.metric).slice().sort((a, b) => b.val - a.val);
  const n = pool.length, cut = Math.floor(n / 3);
  const keep = ctx.pool.dir === 'high' ? pool.slice(0, cut) : pool.slice(n - cut);
  POOL_SET = new Set(keep.map(r => r.geo_id));
  medianCache.gen = (medianCache.gen || 0) + 1;   // pool change invalidates cached medians
}
function inScope(iso, region) {
  return inRegion(iso, region) && inRegion(iso, ctx.region) && (POOL_SET === null || POOL_SET.has(iso));
}

/* ── parsing ───────────────────────────────────────────────────────── */
function detectMetrics(r) {
  const found = [];
  const push = (re, key) => { if (re.test(r) && !found.includes(key)) found.push(key); };
  // the global series, never the US-only snapshots the old US page read: "the top 1%"
  // typed by a reader in Leeds must reach the WID series that has Britain in it
  push(/\btop\s*10\b|\b10%|\b10\s*(per\s*cent|percent|pct)\b/, 'income_top10');
  push(/\btop\s*1\b|\b1%|\btop\s*one\b|\b1\s*(per\s*cent|percent|pct)\b|\brich(est)?\b|\bthe wealthy\b/, 'wealth_top1');
  push(/\bbottom\s*(50|half)\b|\b50%|\bpoor(est)?\s*half\b|\bordinary people\b|\beveryone else\b/, 'wealth_bottom50');
  push(/\bmiddle class\b|\bmiddle 40\b|\bthe middle\b(?! income)/, 'income_middle40');
  push(/\blife expectancy\b|\blongevity\b|\blifespan\b|\bhealth\b|\blive longer\b|\blive long\w*\b|\bhow long .*\blive\b|\bdie (young|earl\w*|soon\w*)\b|\bdying\b|\byears of life\b/, 'life_exp');
  push(/\bprice[- ]to[- ]income\b|\bhouse prices? (against|to|vs\.?|versus) (income|pay|earnings|wages)\b|\bhousing affordability\b/, 'house_income');
  push(/\bhous(e|es|ing)\b|\bhome ?prices?\b|\bproperty\b|\bmortgage\b|\brent\w*\b|\bafford\w*\b|\bon the ladder\b|\bget on the ladder\b/, 'house_price');
  push(/\bco2\b|\bcarbon\b|\bemissions?\b|\benvironment\w*\b|\bclimate\b/, 'co2_pc');
  push(/\brelative poverty\b|\bhalf (of )?the median\b|\bbelow half\b|\bpoverty line\b.*\bmedian\b/, 'poverty_relative');
  // "how much do the poor own" is the bottom half's wealth; it was read as extreme poverty
  push(/\b(the )?poor(est)?( people| half| households)?\b[\w\s]{0,24}\b(own|owns|hold|holds|have|has)\b|\b(own|owns|hold|holds)\b[\w\s]{0,24}\bthe poor(est)?\b/, 'wealth_bottom50');
  push(/\bpoverty\b|\bpoor\b(?!\s*(est\s*)?half)/, 'poverty_rate');
  push(/\bmedian income\b|\bmedian\b|\btypical income\b|\bmiddle income\b/, 'median_income');
  push(/\bproductiv\w*\b|\bper hour\b|\ban hour\b.*\b(worth|produce\w*|output)\b/, 'gdp_hour');
  push(/\bgdp\b|\boutput\b|\bprosper\w*\b|\beconomic size\b/, 'gdp_pc');
  push(/\bincome inequality\b|\bincome gini\b/, 'income_gini');
  push(/\bwealth gini\b/, 'wealth_gini');                                   // explicit Gini, for experts
  push(/\bwealth (inequality|concentration)\b|\bconcentration\b/, 'wealth_top1');  // default wealth measure = concentration
  // bare "income"/"wealth" only if no more specific income/wealth metric already matched
  // pay, wages and earnings are what a person takes home, which is the median. "income"
  // on its own is ambiguous and keeps the face's inequality measure
  // "top 1% income share" is the top 1% of income, not of wealth. the top 1% words claim
  // wealth by default, so income named alongside them, with no wealth word, takes it back
  if (found.includes('wealth_top1') && /\bincome\b|\bearn\w*\b|\bpay\b|\bwages?\b/.test(r) &&
      !/\bwealth\w*\b|\bowns?\b|\bassets?\b|\bnet worth\b|\bconcentration\b/.test(r)) {
    found.splice(found.indexOf('wealth_top1'), 1, 'income_top1');
  }
  if (!found.some(k => META[k].topic === 'income') && /\bwages?\b|\bearn\w*\b|\bpaid\b|\bsalar\w*\b|\bpay\b/.test(r)) found.push('median_income');
  if (!found.some(k => META[k].topic === 'income') && /\bincome\b/.test(r)) found.push('income_gini');
  if (!found.some(k => k === 'wealth_gini' || k === 'wealth_top1' || k === 'wealth_bottom50') && /\bwealth\b/.test(r)) found.push('wealth_top1');
  push(/\bhappiness\b|\bhappy\b|\bhappier\b|\bhappiest\b|\bunhapp\w*\b|\blife satisfaction\b|\bsatisfaction\b|\bcantril\b|\bladder\b/, 'life_satisfaction');
  if (/\bwell\s?being\b/.test(r) && !found.length) found.push('life_satisfaction');
  // bare "inequality"/"unequal" with nothing else: the concentration measure (fixes the dead front door)
  if (/\binequalit\w*\b|\bunequal\b/.test(r) && !found.some(k => isIneq(k) || k === 'wealth_top1')) {
    const cur = facetIneqDefault();
    found.push(isIneq(cur) || cur === 'wealth_bottom50' ? cur : (curFacet === 'income' ? 'income_top1' : 'wealth_top1'));
  }
  // a bare "gini" is a Gini: the income one on the income face, the wealth one otherwise.
  // it used to keep whatever measure was last read if that one counted as Gini family,
  // so "what is the gini of japan" answered with the top 1% share
  if (/\bgini\b/.test(r) && !found.length)
    found.push(curFacet === 'income' || (META[ctx.metric] && META[ctx.metric].topic === 'income') ? 'income_gini' : 'wealth_gini');
  return found;
}
function detectMetric(r) {
  const m = detectMetrics(r);
  return m.length ? m[0] : null;
}
const INEQ_METRICS = ['wealth_gini', 'wealth_top1', 'income_gini', 'income_top1', 'income_top10'];
function isIneq(key) { return INEQ_METRICS.includes(key); }
// each facet offers a few measures; the accordion lets you click between them
const FACET_MEASURES = {
  wealth: [['wealth_top1', 'top 1% share'], ['wealth_gini', 'wealth Gini'], ['wealth_bottom50', 'bottom 50% share'],
           ['house_price', 'house prices'], ['house_income', 'houses against income']],
  income: [['income_top1', 'top 1% share'], ['income_top10', 'top 10% share'], ['income_middle40', 'the middle 40%'], ['income_gini', 'income Gini'],
           ['median_income', 'median income'], ['poverty_relative', 'below half the median'], ['poverty_rate', 'living on under $2.15 a day']],
  // health has no measure of its own among these: its face reads the US life gap, and a
  // national life expectancy is something to hold inequality against, not inequality
};
const facetMeasureIdx = { wealth: 0, income: 0, health: 0 };
function facetMeasure(name) {
  const list = FACET_MEASURES[name]; if (!list) return null;
  return list[(facetMeasureIdx[name] || 0) % list.length][0];
}
function facetMeasureLabel(name) {
  const list = FACET_MEASURES[name]; if (!list) return null;
  return list[(facetMeasureIdx[name] || 0) % list.length][1];
}
// a bare "inequality" means the currently chosen measure of the facet you're on
function facetIneqDefault() {
  const m = (typeof curFacet !== 'undefined') && facetMeasure(curFacet);
  if (m && (SERIES[m] || m === 'wealth_gini')) return m;
  return SERIES.wealth_top1 ? 'wealth_top1' : 'wealth_gini';
}

// a country whose name has a region inside it. matched as a region first, "south africa"
// lost its "south" and every answer after it was stuck on the whole continent
function regionIn(raw) {
  const t = norm(raw).replace(REGION_IN_NAME, ' ');
  for (const [re, key] of REGION_TOKENS) if (re.test(t)) return key;
  return null;
}
const REGION_IN_NAME = /\bsouth africa\b|\bcentral african republic\b|\bamerican samoa\b|\bsouth sudan\b/;
// "the whole world" said inside a question applies to that question. it used to be read
// as a question of its own that re-ran the last one, so "whole world ranking of wealth
// concentration" came back as "could not read that one"
const WHOLE_WORLD = /\b(among |across |in )?(all|every) (the )?countr(y|ies)\b|\b(in )?(the )?whole world\b|\bin the world\b|\bworldwide\b|\bglobally\b|\beveryone\b/;
function parse(raw) {
  const t = norm(raw);
  if (!WHOLE_WORLD.test(t)) return parseCore(raw);
  const rest = t.replace(WHOLE_WORLD, ' ').replace(/\s+/g, ' ').trim();
  const says = rest.split(' ').filter(w => w.length > 2 && !STOP.has(w)).length || findCountries(rest).isos.length;
  const p = says ? parseCore(rest) : { kind: 'unknown' };
  if (p.kind === 'unknown' || p.kind === 'pending') return { kind: 'among', pool: ALL_POOL };
  p.pool = ALL_POOL; if (p.region) p.region = null;
  // poverty across the whole world is the survival line, not half of each country's median
  if (p.metric === 'poverty_relative' && !/\brelative\b|\bhalf (of )?the median\b|\bbelow half\b/.test(t)) {
    p.metric = 'poverty_rate'; if (p.metrics) p.metrics = p.metrics.map(k => k === 'poverty_relative' ? 'poverty_rate' : k);
  }
  return p;
}
function parseCore(raw) {
  let text = norm(raw);
  let region = null;
  const shielded = text.replace(REGION_IN_NAME, ' ');
  for (const [re, key] of REGION_TOKENS) {
    if (re.test(shielded)) { region = key; text = text.replace(re, ' '); break; }
  }
  const { isos, residual: r } = findCountries(text);
  const years = (r.match(/\b(?:19|20)\d{2}\b/g) || []).map(Number).filter(y => y >= 1950 && y <= 2025);
  const metrics = detectMetrics(r);
  // "poverty" alone takes the line the place itself would use: half the median for the
  // richer third and for the whole world ranked together, $2.15 a day for a poorer
  // country. ranking rich countries on $2.15 was a ranking of rounding. "extreme" or a
  // dollar line asked for by name always gets that line
  if (metrics[0] === 'poverty_rate' && SERIES.poverty_relative &&
      !/\bextreme\b|\$|\bdollars?\b|\ba day\b|\bsurviv\w*\b|\b2\.15\b|\babsolute\b|\bglobal\w*\b|\bpoorest countries\b/.test(r) &&
      (!isos.length || isos.every(i => richThird().has(i))))
    metrics[0] = 'poverty_relative';
  const metric = metrics.length ? metrics[0] : null;
  if (metrics.includes('PENDING')) return { kind: 'pending' };

  // ── the per-face readings: what a share means for one person, rather than a block ──
  // These sit ahead of the general readings because they answer the same words more
  // concretely, and ahead of RATIO, which also claims "how many times".
  // a run of years named in the question carries into these the same way it does anywhere
  const winFrom = r.match(/\b(?:after|since|from|post|following)\s+((?:19|20)\d{2})\b/);
  const win = {
    since: winFrom ? +winFrom[1] : (years.length > 1 ? Math.min(...years) : null),
    until: years.length > 1 ? Math.max(...years) : null,
  };
  // HAVE: the money version. one country, and the refusal says why a share is not a
  // bank balance.
  // "how much do the richest 1% have" and "how much does the bottom half own in the uk"
  // were both sent here and answered with the poorest quarter of American families. a
  // question about a share, or about another country, is not this one
  const aboutShare = /\btop\b|\brichest\b|\b1%|\b10%|\bhalf\b|\bbottom\b|\bshare\b/.test(r);
  if (!aboutShare && !isos.some(i => i !== 'USA') &&
      /\bactually have\b|\bhow much (do|does).*(have|own)\b|\bnet worth\b|\bin (the )?bank\b|\bto (their|its|your|my) name\b|\bin (real )?money\b|\bin dollars\b|\bwhat would i have\b/.test(r))
    return { kind: 'have', isos: ['USA'], iso: isos[0] || 'USA',
      year: years.length ? Math.max(...years) : null };
  // WEATHER: whether a household could absorb a shock, which is what the rest of the
  // face is for. same survey as the headcount below it.
  if (/\btake a hit\b|\bweather\b|\bunexpected (expense|bill|cost)\b|\bemergency\b|\brainy day\b|\bsaving\b|\bsave anything\b|\bleft over\b|\bmake ends meet\b|\bboiler\b|\bcope with\b|\bresilien\w*\b|\blose (their|your|my) job\b/.test(r))
    return { kind: 'weather', isos, iso: isos[0] || null,
      year: years.length ? Math.max(...years) : null };
  // UNDERWATER: the headcount behind the share. household survey, euro area.
  if (!/\bpoverty\b|\bpoor\b/.test(r) && /\bhow many (people|households|of us)\b|\bowe more than\b|\bunder ?water\b|\bnegative (net )?wealth\b|\bin the red\b|\bhow many are in debt\b|\bmore debt than\b/.test(r)) {
    // the household survey covers the euro area. Sweden, Norway and Denmark are where the
    // bottom half is below zero as a group, and that is in the bottom half's share
    if (isos[0] && typeof HFCS_NEG !== 'undefined' && HFCS_NEG && !HFCS_NEG.by[isos[0]] && seriesOf('wealth_bottom50', isos[0]).length)
      return Object.assign({ kind: 'owns', isos, iso: isos[0] }, win);
    return { kind: 'underwater', isos, iso: isos[0] || null,
      year: years.length ? Math.max(...years) : null };
  }
  // MADE: not how much a group holds but what of. one country, said so on refusal.
  if (/\bmade of\b|\bmade up of\b|\bwhat kind of wealth\b|\bwhat do they actually own\b|\bwhat is (the |their )?wealth\b|\bcomposition\b|\bhouse or shares\b|\bassets? are\b|\bwhat their wealth is\b/.test(r))
    // one country carries this, so the parse names it rather than opening a place fold
    // that has exactly one answer in it
    return { kind: 'made', isos: ['USA'], iso: isos[0] || 'USA',
      year: years.length ? Math.max(...years) : null };
  // OWNS: what half a country holds, against what one per cent of it holds
  if (/\bowns? nothing\b|\bown nothing\b|\bowns? anything\b|\b(poorest|bottom) half own\w*\b|\bwho owns\b|\bowns? the country\b|\bhalf of us own\b/.test(r))
    return Object.assign({ kind: 'owns', isos, iso: isos[0] || null }, win);
  // the two divisions side by side. an owning word sends "how many times" to wealth;
  // without one it is about pay, which is the MULTIPLE below.
  // "gdp per person" and "co2 per person" are a measure's own name, not the multiple
  const perPerson = /\bone person\b|\bsomeone at the top\b|\bper[- ]person\b|\bhow many times more\b|\bfor every\b.*\bpound|\bfor every\b.*\bdollar/.test(r) &&
    !/\b(gdp|output|co2|carbon|emissions?)\b[\w\s]{0,12}\bper[- ]person\b/.test(r);
  if (perPerson && /\bowns?\b|\bowning\b|\bwealth\b|\bholds?\b|\bassets?\b|\bhave\b/.test(r))
    return { kind: 'wmultiple', isos, iso: isos[0] || null };
  if (/\bowning gap\b|\bearning gap\b|\bown against .*earn\b|\bwealth gap .*(income|pay|earn)\w* gap\b/.test(r))
    return { kind: 'wmultiple', isos, iso: isos[0] || null };
  // MULTIPLE: the same division on income, the shares turned into people
  if (perPerson)
    return Object.assign({ kind: 'multiple', isos, iso: isos[0] || null }, win);
  // BASKET: the middle income in dollars that buy the same goods everywhere
  if (/\blives? on\b|\bliving on\b|\ba day\b|\bbasket of goods\b|\bpurchasing power\b|\bsame money buy\b|\bgo further\b|\b(average|typical|normal|ordinary) (person|family|household|worker|people)\b.*\b(earn|make|get|take home|paid)\w*\b/.test(r))
    return Object.assign({ kind: 'basket', isos, iso: isos[0] || null }, win);
  // THREE: the top tenth, the forty in the middle, and the bottom half, summing to 100
  if (/\bthree parts\b|\bmiddle 40\b|\bmiddle forty\b|\bmiddle class\b|\bhappened to the middle\b|\bhollow\w*\b|\bsplit three ways\b|\bcut into three\b|\bsqueez\w*\b/.test(r))
    return Object.assign({ kind: 'three', isos, iso: isos[0] || null }, win);

  // REACH: did the country's growth arrive at the median, or somewhere else
  if (/\breach(ed)? me\b|\breach the median\b|\bgot the growth\b|\bwho got\b|\btypical (income|person|wage)\b|\bgrowth actually\b/.test(r) ||
      /\b(wages?|pay|earnings|salar\w*)\b.*\b(productivity|output|growth)\b|\b(productivity|output)\b.*\b(wages?|pay|earnings)\b|\bkeep up with\b/.test(r))
    return { kind: 'reach', isos, iso: isos[0] || null };
  // RATIO: the top against the bottom, said as a multiple instead of an index. "how much
  // does the top 10% own" is this too: the atlas holds the top tenth's wealth only beside
  // the bottom half's, and the question was answered with the top tenth's income
  if (/\brichest\b.*\bpoorest\b|\btop tenth\b|\bhow many times\b|\bhow much more\b.*\bhold\b|\btimes what\b/.test(r) ||
      (/\btop\s*10\b|\b10%|\btop ten\b|\brichest (10|ten)\b/.test(r) && /\bown\w*\b|\bwealth\b|\bhold\w*\b|\bassets?\b/.test(r) && !/\bincome\b|\bearn\w*\b/.test(r)))
    return { kind: 'ratio', isos, iso: isos[0] || null };
  // TRIPLE: the three measured faces held together, one dot per country
  if (/\bthree faces\b|\ball three\b|\bfaces together\b|\bfaces sit\b|\bsit together\b|\bhealth (sit|together)\b/.test(r))
    return { kind: 'triple' };
  // TABLES: the same countries ranked twice, once by earning and once by owning
  if (/\bleague table\b|\btwo tables\b|\brank\w* (twice|both)\b|\bsame ranking\b|\brank on each\b|\bearns? and .*owns?\b|\bown as unevenly as\b/.test(r))
    return { kind: 'tables', isos, region };
  // TURN: the years the data itself picks out, then what was going on around them
  if (/\bsharpest\b|\bsteepest\b|\bturning point\b|\bchanged most\b|\bbiggest (shift|change|move)\b|\bwhen did .*(change|shift|move) most\b/.test(r))
    return { kind: 'turn', iso: isos[0] || null, isos };
  // PEERS: the same years, against countries that started somewhere similar
  if (/\bpeers?\b|\bcomparable countries\b|\bsimilar countries\b|\bcompared with (other|similar)\b|\bdifferently from\b|\bvs its peers\b/.test(r))
    return { kind: 'peers', iso: isos[0] || null, isos,
      year: years.length ? Math.min(...years) : null,
      until: years.length > 1 ? Math.max(...years) : null };
  // ── the questions a listener actually types, routed to the readings that exist ──
  // "do rich people live longer": the rich, against how long people live
  if (metrics.includes('life_exp') && (metrics.includes('wealth_top1') || /\brich\b/.test(r)) && !isos.length)
    return { kind: 'correlate', x: 'wealth_top1', y: 'life_exp', region };
  // a year with "after" or "since" in front of it is a run of years from there
  // "1980 vs now", "1990 compared to today": a run from that year, not the one year
  const thenNow = r.match(/\b((?:19|20)\d{2})\s*(?:vs\.?|versus|to|and|compared (?:to|with)|against)\s*(?:now|today|the latest|latest|present)\b/);
  if (thenNow) return { kind: 'time', isos, year: +thenNow[1], region, metric };
  // is wealth worse than income: the owning gap against the earning gap, which is the
  // reading built for exactly this. "worse" used to send it to the income risers
  if (/\bwealth\b/.test(r) && /\bincome\b|\bearn\w*\b|\bpay\b|\bwages?\b/.test(r) &&
      /\bworse\b|\bmore unequal\b|\bwider\b|\bbigger\b|\bgreater\b|\bhigher\b|\bthan\b|\bor\b/.test(r) && !/\bover time\b|\bsince\b|\bpulling apart\b|\bdiverg/.test(r))
    return isos.length ? { kind: 'wmultiple', isos, iso: isos[0] } : { kind: 'owngap' };
  const afterYear = r.match(/\b(after|since|from|post|following)\s+((?:19|20)\d{2})\b/);
  const movingWords = /\b(become|became|got|gotten|grown|grew) more unequal\b|\bless equal\b|\bgetting (richer|poorer|worse|better|bigger|wider|more unequal)\b|\brising\b|\brisen\b|\bgone up\b|\bgoing up\b|\bgot worse\b|\bworse\b|\bincreas\w*\b|\bgrown\b|\bwiden\w*\b|\bchang(ed|ing)\b/;
  const fallingWords = /\b(become|became|got|gotten|grown|grew) (more equal|less unequal)\b|\bmore equal\b|\bless unequal\b|\bgetting better\b|\bfallen\b|\bfalling\b|\bgone down\b|\bgoing down\b|\bdecreas\w*\b|\bnarrow\w*\b|\bimprov\w*\b/;
  // "has inequality gone up since 2008" with no country used to hand the question to
  // whichever country the last one named, starting in 1990
  if (afterYear && !isos.length && (movingWords.test(r) || fallingWords.test(r)))
    return { kind: 'delta_rank', dir: fallingWords.test(r) ? 'down' : 'up', year: +afterYear[2], region, metric };
  if (afterYear) return { kind: 'time', isos, year: +afterYear[2], region, metric };
  // a place plus a direction word is a question about change, not about a level
  const trend = /\b(become|became|got|gotten|grown|grew) (more|less) (un)?equal\b|\bgetting (richer|poorer|worse|better|bigger|wider|more unequal)\b|\brising\b|\bfalling\b|\bgoing up\b|\bgone up\b|\bgot worse\b|\bworse\b|\bbetter\b|\bchang(ed|ing)\b|\bpulling away\b|\bwidening\b|\bwhat happened\b|\bhappened to\b/.test(r);
  const mine = /\bmy country\b|\bwhere i live\b|\bround here\b|\bmy place\b|\bback home\b/.test(r);
  if (trend && isos.length) return { kind: 'time', isos, year: years[0] || null, region, metric };
  // the same words with no country: which countries moved, and which way
  if (trend && !isos.length && !mine && !/\bhous|\bhome|\brent|\bmortgage|\bpropert/.test(r))
    return { kind: 'delta_rank', dir: fallingWords.test(r) ? 'down' : 'up', year: years[0] || 1995, region, metric };
  // houses: the price of one against what people earn, which is the picture the
  // question is actually asking for. the OECD's countries carry it and the fold shows which.
  if (/\bhous(e|es|ing)\b|\bhome ?prices?\b|\bproperty\b|\bmortgage\b|\brent\w*\b|\bafford\w*\b|\bon the ladder\b/.test(r))
    return { kind: 'houses', isos, iso: isos[0] || null };
  // "my country", with none named: nothing is computed, the place fold opens and asks
  if (mine && !isos.length) return { kind: 'profile', iso: null, needsPlace: true, metric };

  // BREAK: who defies the current relationship
  if (/\bbreaks? the pattern\b|\bbreaks? the trend\b|\boutliers?\b|\boff the (trend|line|pattern)\b|\bexceptions?\b|\bdefy\w*\b|\bover[- ]?perform\w*\b|\bunder[- ]?perform\w*\b|\bbeat the (trend|pattern)\b|\bpunch\w* above\b|\bbetter than\b.*\bsuggests?\b|\bdo better than\b/.test(r))
    return { kind: 'break', metrics };

  // AMONG: change the pool. "among rich countries", "all countries" (region is handled above)
  if (/\ball countries\b|\beveryone\b|\bwhole world\b|\bdrop the (filter|condition|pool)\b|\bunrestrict\w*\b|\bworldwide\b/.test(r) && !isos.length)
    return { kind: 'among', pool: ALL_POOL };
  {
    const cue = /\bamong\b|\bonly\b|\brestrict\w*\b|\bjust the\b|\bconditional\b/.test(r);
    const rich = /\brich(er|est)?\b|\bhigh[- ]?income\b|\bwealthy\b|\bdeveloped\b|\baffluent\b/.test(r);
    const poor = /\bpoor(er|est)?\b|\blow[- ]?income\b|\bdeveloping\b/.test(r);
    if (cue && (rich || poor) && !isos.length)
      return { kind: 'among', pool: { label: rich ? 'richer countries' : 'poorer countries',
        metric: 'gdp_pc', dir: rich ? 'high' : 'low' }, region };
  }

  // DIVERGENCE: the two inequalities pulling apart over time (the spine of the atlas)
  // "how does wealth inequality compare with income inequality in germany" named both and
  // drew only income, because "wealth inequality" reads as the top 1% share. both named, for
  // one country, is this reading whatever measure each word landed on
  const bothIneq = (metrics.includes('wealth_gini') && metrics.includes('income_gini')) ||
    (isos.length === 1 && /\bwealth (inequalit\w*|gini|gap)\b/.test(r) && /\bincome (inequalit\w*|gini|gap)\b/.test(r) &&
     /\bcompar\w*\b|\bagainst\b|\bwith\b|\bvs\.?\b|\bversus\b|\band\b/.test(r));
  if (bothIneq || /\bdivergence\b|\btwo inequalit\w*\b|\bwealth (and|vs\.?|versus) income\b|\bincome (and|vs\.?|versus) wealth\b/.test(r)) {
    const iso = isos[0] || (ctx.lastIso && ctx.lastIso !== 'reg' ? ctx.lastIso : null) || 'USA';
    return { kind: 'divergence', iso };
  }

  // PATH: one place's journey through lens x aspect space over the years
  if (/\bpath\b|\btrajectory\b|\bjourney\b|\bhas travell?ed\b/.test(r)) {
    const iso = isos[0] || ctx.lastIso;
    if (iso) {
      const y = metrics.find(m => !isIneq(m) && META[m].series) || ctx.lastAspect || 'life_exp';
      const x = metrics.find(isIneq) || (isIneq(ctx.metric) ? ctx.metric : 'wealth_gini');
      return { kind: 'path', iso, x, y };
    }
  }

  // correlate: relate two measures across countries
  const wantsCorr = /\bagainst\b|\bvs\b|\bversus\b|\bcorrelat\w*\b|\brelationship\b|\brelate[sd]?\b|\btrack[s]?\b|\btied to\b|\blinked to\b|\bpredict\w*\b/.test(r) && !isos.length;
  const wantsTiers = /\btiers?\b|\bbands?\b|\bterciles?\b|\bquartiles?\b|\bgroup(ed|s)?\b|\bhigh (vs|versus|and) low\b|\bunequal (vs|versus|and)\b|\bin more equal\b|\bmore equal countries\b/.test(r);
  if (wantsTiers) {
    const aspect = metrics.find(m => !isIneq(m) && META[m].series) ||
      (META[ctx.metric].series && !isIneq(ctx.metric) ? ctx.metric : null) ||
      ctx.lastAspect || 'life_exp';
    const lens = metrics.find(isIneq) || facetIneqDefault();
    return { kind: 'tiers', aspect, lens, region: region };
  }
  // an aspect is a second thing named in the words. the face's own measure, stood in for
  // a bare "inequality", is not one: with bottom 50% chosen, "india inequality" became
  // bottom 50% held against itself, across every country, with India dropped
  const standIn = facetIneqDefault();
  const aspectHere = metrics.find(m => !isIneq(m) && META[m].series && m !== standIn);
  const ineqWord = /\binequality\b|\bunequal\b|\bgini\b|\bconcentrat\w*\b/.test(r);
  if (wantsCorr || (aspectHere && ineqWord)) {
    const y = aspectHere || (META[ctx.metric].series && !isIneq(ctx.metric) ? ctx.metric : ctx.lastAspect) || 'life_exp';
    const wealthOnly = /\bwealth (inequality|gini|concentration)\b/.test(r) && !/\bincome\b/.test(r);
    const incomeOnly = /\bincome (inequality|gini)\b/.test(r) && !/\bwealth\b/.test(r);
    if (wealthOnly) return { kind: 'correlate', x: SERIES.wealth_top1 ? 'wealth_top1' : 'wealth_gini', y, region };
    if (incomeOnly) return { kind: 'correlate', x: 'income_gini', y, region };
    // otherwise it runs against the inequality of the facet you're on
    return { kind: 'correlate', x: facetIneqDefault(), y, region };
  }

  const hasEqual = /\bequal\b/.test(r), hasUnequal = /\bunequal\b|\binequality\b/.test(r);
  const most = /\bmost\b|\bhighest\b|\bworst\b/.test(r), least = /\bleast\b|\blowest\b/.test(r);
  let rankDir = null;
  if ((most && hasUnequal) || (least && hasEqual) || /\bhighest\b|\bworst\b/.test(r)) rankDir = 'high';
  if ((most && hasEqual) || (least && hasUnequal) || /\blowest\b/.test(r)) rankDir = 'low';
  if (!rankDir && (most || least) && !isos.length) rankDir = most ? 'high' : 'low';

  // metric-specific superlatives ("happiest", "healthiest", "greenest")
  const SUPER = [
    [/\bpoorest (country|countries|nations?|place)\b|\bpoorest in the world\b/, 'gdp_pc', 'low'],
    [/\brichest (country|countries|nations?|place)\b|\brichest in the world\b/, 'gdp_pc', 'high'],
    [/\bhappiest\b/, 'life_satisfaction', 'high'], [/\bunhappiest\b|\bsaddest\b|\bleast happy\b/, 'life_satisfaction', 'low'],
    [/\bhealthiest\b|\blongest[- ]liv\w*\b/, 'life_exp', 'high'], [/\bunhealthiest\b|\bshortest[- ]liv\w*\b/, 'life_exp', 'low'],
    [/\bgreenest\b|\bcleanest\b|\blowest emitters?\b/, 'co2_pc', 'low'], [/\bdirtiest\b|\bmost polluting\b|\bbiggest emitters?\b/, 'co2_pc', 'high'],
  ];
  for (const [re, mk, dir] of SUPER) if (re.test(r) && !isos.length) return { kind: 'rank', dir, region, metric: mk };

  const riser = /\brisers?\b|\brisen\b|\brising\b|\bincreas\w*\b|\bclimb\w*\b|\bgrown\b|\bgrowing\b|\bgoing up\b|\bgone up\b|\bworsen\w*\b|\bjump\w*\b/.test(r);
  const faller = /\bfallers?\b|\bfallen\b|\bdrop\w*\b|\bdeclin\w*\b|\bdecreas\w*\b|\bimprov\w*\b/.test(r);
  const th = r.match(/\b(above|over|below|under)\s+(\d{1,3}(?:\.\d+)?|\.\d+)\b/);
  const giniWords = hasEqual || hasUnequal;

  if (/\bother (end|extreme|side)\b|\bopposite\b|\bflip\b/.test(r))
    return { kind: 'rank', dir: ctx.lastRankDir === 'high' ? 'low' : 'high',
             region: region || ctx.lastRegion, metric, giniWords };
  if ((riser || faller) && isos.length === 0)
    return { kind: 'delta_rank', dir: riser ? 'up' : 'down', year: years[0] || 1995, region, metric };
  if (th)
    return { kind: 'threshold', op: (th[1] === 'above' || th[1] === 'over') ? 'above' : 'below',
             val: parseFloat(th[2]), region, metric };
  if (/\blorenz\b|\bconcentration curve\b|\bdivided up\b|\bsplit up\b|\bcarved up\b/.test(r) || (/\bdistribution\b|\bshares?\b/.test(r) && isos.length && !metric))
    return { kind: 'lorenz', isos: isos.length ? isos : focusIsos() };
  if (/\bspread\b|\bdistribution\b|\brange\b|\bhow varied\b|\bacross countries\b|\btypical country\b|\bnormal country\b/.test(r) && isos.length === 0)
    return { kind: 'spread', metric, region };
  if (rankDir && isos.length === 0) return { kind: 'rank', dir: rankDir, region, metric, giniWords };
  if (/\bcompared to (whom|what|who)\b|^\s*compared\s*$|\bneighbou?rs\b/.test(r))
    return { kind: 'context' };
  if (/\baverage\b|\bworld\b|\bmedian\b|\btypical\b|\boverall\b/.test(r) && isos.length === 0)
    return { kind: 'world', region, metric };
  if (/\bover time\b|\btrend\b|\bhistory\b|\bevolution\b/.test(r) || (/\bsince\b/.test(r) && years.length))
    return { kind: 'time', isos, year: years[0] || null, region, metric };
  // a country, a year, and a named series metric: read that one cell ("wealth gini France 2010")
  if (metric && isos.length === 1 && years.length && META[metric].series)
    return { kind: 'point', iso: isos[0], year: years[0], metric };
  // a measure and two or more countries is a comparison on that measure
  if (metric && isos.length >= 2) return { kind: 'compare', isos: isos.slice(0, 4), metric };
  if (metric) {
    // a series measure named with no country and no ranking words: the honest answer is
    // "which country?", not a world median and never the old US-only chart
    if (META[metric].series && !isos.length && !ctx.lastIso) return { kind: 'profile', iso: null, needsPlace: true, metric };
    return { kind: 'metric', metric, isos };
  }
  if (isos.length >= 2) return { kind: 'compare', isos: isos.slice(0, 4) };
  if (isos.length === 1 && years.length) return { kind: 'point', iso: isos[0], year: years[0], metric };
  if (isos.length === 1) return { kind: 'profile', iso: isos[0] };
  if (region) return { kind: 'world', region };
  return { kind: 'unknown' };
}

/* pick the metric a question should run on */
function resolveMetric(p) {
  let key = p.metric || ctx.metric;
  if (p.giniWords && !META[key].giniFam) key = facetIneqDefault();   // "most unequal" follows the facet you're on
  return key;
}
function valAt(metric, iso, year) {
  if (!year || META[metric].snap) return latestValOf(metric, iso);
  const s = seriesOf(metric, iso);
  let best = null;
  for (const d of s) if (!best || Math.abs(d.year - year) < Math.abs(best.year - year)) best = d;
  if (!best || Math.abs(best.year - year) > POOL_YEAR_TOL) return null;
  return { val: best.v, year: best.year };
}
function latestValOf(metric, iso) {
  if (META[metric].snap) {
    const r = BY_ISO[iso] && BY_ISO[iso].latest;
    return r && r[metric] != null ? { val: r[metric], year: r.year } : null;
  }
  const s = seriesOf(metric, iso);
  return s.length ? { val: s[s.length - 1].v, year: s[s.length - 1].year } : null;
}

/* ── cross-metric helpers ──────────────────────────────────────────── */
// pair each country on the latest year BOTH measures actually carry. a country with no
// shared year is dropped rather than matched across a gap and counted as evidence.
// with no year, each country is paired at the latest year both were measured. with a
// year, at the shared year nearest to it, and a country whose nearest shared year is
// further off than the tolerance is left out rather than stretched to reach.
function pairedPoints(xMetric, yMetric, region, year) {
  const out = [], dropped = [], far = [];
  const xSer = META[xMetric] && META[xMetric].series, ySer = META[yMetric] && META[yMetric].series;
  for (const iso in BY_ISO) {
    if (!inScope(iso, region)) continue;
    if (xSer && ySer) {
      const xs = seriesOf(xMetric, iso), ys = seriesOf(yMetric, iso);
      if (xs.length && ys.length) {
        const yv = new Map(ys.map(d => [d.year, d.v]));
        let hit = null;
        if (year) {
          for (const d of xs) if (yv.has(d.year)) {
            if (!hit || Math.abs(d.year - year) < Math.abs(hit.year - year))
              hit = { year: d.year, x: d.v, y: yv.get(d.year) };
          }
          if (hit && Math.abs(hit.year - year) > POOL_YEAR_TOL) { far.push(iso); hit = null; }
        } else {
          for (let i = xs.length - 1; i >= 0; i--) {
            if (yv.has(xs[i].year)) { hit = { year: xs[i].year, x: xs[i].v, y: yv.get(xs[i].year) }; break; }
          }
        }
        if (hit) {
          out.push({ iso, name: BY_ISO[iso].name, x: hit.x, y: hit.y,
            xy: hit.year, xYear: hit.year, yYear: hit.year, gap: 0 });
          continue;
        }
        dropped.push(iso);
        continue;
      }
    }
    // one side is a snapshot, so there is no year to match on: take latest and say the gap
    const xv = latestValOf(xMetric, iso), yv2 = latestValOf(yMetric, iso);
    if (xv && yv2) out.push({ iso, name: BY_ISO[iso].name, x: xv.val, y: yv2.val,
      xy: yv2.year, xYear: xv.year, yYear: yv2.year, gap: Math.abs(xv.year - yv2.year) });
  }
  out.dropped = dropped.length;
  out.far = far.length;
  out.atYear = year || null;
  return out;
}

// robust line: Theil-Sen slope (median pairwise) + median intercept. Outliers can't define their own baseline.
function theilSen(pts) {
  const n = pts.length; if (n < 3) return null;
  const slopes = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const dx = pts[j].x - pts[i].x;
    if (dx !== 0) slopes.push((pts[j].y - pts[i].y) / dx);
  }
  if (!slopes.length) return null;
  const slope = medianOf(slopes);
  const intercept = medianOf(pts.map(p => p.y - slope * p.x));
  return { slope, intercept };
}
function pearson(pts) {
  const n = pts.length; if (n < 3) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; sxx += p.x * p.x; syy += p.y * p.y; sxy += p.x * p.y; }
  const cov = n * sxy - sx * sy;
  const dx = Math.sqrt(n * sxx - sx * sx), dy = Math.sqrt(n * syy - sy * sy);
  if (dx === 0 || dy === 0) return null;
  return cov / (dx * dy);
}
// Correlation on ranks rather than levels, for two measures that are not on the same
// scale and are not meant to be: a share of a national total against a count of
// households. Ties take the average rank, which is what makes it Spearman rather than
// Pearson on a sort order.
// the survey lists a country but does not always publish every indicator for it:
// Finland has the credit questions and no saving figure, so for this reading it is
// uncovered, and the drawer and the die both have to know that
function resilienceFor(iso) {
  const b = HFCS_RES && HFCS_RES.by[iso];
  return !!(b && b.save && b.save.all && b.save.all.some(v => v != null));
}
function spearman(xs, ys) {
  if (!xs || xs.length < 4 || xs.length !== ys.length) return null;
  const rank = a => {
    const order = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length);
    for (let i = 0; i < order.length;) {
      let j = i; while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
      const mean = (i + j) / 2;
      for (let k = i; k <= j; k++) r[order[k][1]] = mean;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs), ry = rank(ys);
  return pearson(rx.map((v, i) => ({ x: v, y: ry[i] })));
}
function corrClause(r, xlabel) {
  const a = Math.abs(r);
  if (a < 0.15) return `barely moves with ${xlabel}`;
  const lo = r < 0 ? 'lower' : 'higher';
  if (a < 0.35) return `tends to run ${lo} where ${xlabel} is higher`;
  if (a < 0.6) return `runs ${lo} where ${xlabel} is higher`;
  return `runs much ${lo} where ${xlabel} is higher`;
}
function terciles(lensMetric, region, year) {
  const pool = rankedPool(lensMetric, 'high', region, year).map(r => r.val);
  const n = pool.length;
  return { hi: pool[Math.floor(n / 3)], lo: pool[Math.floor(2 * n / 3)] };
}
