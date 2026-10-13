'use strict';
// the data stores, the palette, regions, country names, spelling, number formats and the measure registry.
// one of eight files loaded in order by index.html; they share one scope, so a
// function here can be used by any of them once the page has loaded


/* ── data stores ───────────────────────────────────────────────────── */
let LATEST = null;
let US_COMP = null;   // what wealth is made of, by group: the Fed's distributional accounts
let HFCS_NEG = null;  // how many households own less than nothing: the ECB's household survey
let HFCS_RES = null;  // and how many could take a hit: money left over, help, credit refused
let SCF_NW = null;    // what an American family in each quarter of the country actually has
let BY_ISO = {};            // iso -> wealth snapshot row + name
const SERIES = {};          // metric -> iso -> [{year, v}]

/* ── palette: validated categorical slots, fixed order ─────────────── */
const SLOTS = ['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300','#4a3aa7','#e34948'];
const colorOf = {};
let nextSlot = 0;
// mix a hex toward white or black: one hue, many steps
function shade(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = t < 0 ? [255, 255, 255] : [12, 14, 18], k = Math.abs(t);
  const mix = (c, i) => Math.round(c + (m[i] - c) * k);
  return '#' + [mix(r, 0), mix(g, 1), mix(b, 2)].map(v => v.toString(16).padStart(2, '0')).join('');
}
// n steps across one facet's hue, light to dark
function shadesOf(hex, n) {
  if (n <= 1) return [hex];
  return Array.from({ length: n }, (_, i) => shade(hex, -0.55 + (i / (n - 1)) * 1.05));
}
function assignColor(key) {
  if (!(key in colorOf)) { colorOf[key] = SLOTS[nextSlot % SLOTS.length]; nextSlot++; }
  return colorOf[key];
}

/* ── regions ───────────────────────────────────────────────────────── */
const REGION_DEF = {
  europe:  'ALB AND AUT BEL BGR BIH BLR CHE CYP CZE DEU DNK ESP EST FIN FRA FRO GBR GGY GIB GRC HRV HUN IMN IRL ISL ITA JEY LIE LTU LUX LVA MCO MDA MKD MLT MNE NLD NOR POL PRT ROU RUS SMR SRB SVK SVN SWE UKR XKX',
  africa:  'AGO BDI BEN BFA BWA CAF CIV CMR COD COG COM CPV DJI DZA EGY ERI ESH ETH GAB GHA GIN GMB GNB GNQ KEN LBR LBY LSO MAR MDG MLI MOZ MRT MUS MWI MYT NAM NER NGA REU RWA SDN SEN SHN SLE SOM SSD STP SWZ SYC TCD TGO TUN TZA UGA ZAF ZMB ZWE',
  asia:    'AFG ARE ARM AZE BGD BHR BRN BTN CHN GEO HKG IDN IND IRN IRQ ISR JOR JPN KAZ KGZ KHM KOR KWT LAO LBN LKA MAC MDV MMR MNG MYS NPL OMN PAK PHL PRK PSE QAT SAU SGP SYR THA TJK TKM TLS TUR TWN UZB VNM YEM',
  oceania: 'ASM AUS COK FJI FSM GUM KIR MHL MNP NCL NIU NRU NZL PLW PNG PYF SLB TKL TON TUV VUT WLF WSM',
  latam:   'ABW AIA ARG ATG BES BHS BLZ BOL BRA BRB CHL COL CRI CUB CUW CYM DMA DOM ECU GLP GRD GTM GUF GUY HND HTI JAM KNA LCA MAF MEX MSR MTQ NIC PAN PER PRI PRY SLV SPM SUR SXM TCA TTO URY VCT VEN VGB',
  northam: 'BMU CAN GRL USA',
  mideast: 'ARE BHR EGY IRN IRQ ISR JOR KWT LBN OMN PSE QAT SAU SYR TUR YEM',
};
REGION_DEF.americas = REGION_DEF.latam + ' ' + REGION_DEF.northam;
const REGION_SET = {};
for (const k in REGION_DEF) REGION_SET[k] = new Set(REGION_DEF[k].split(' '));
const REGION_TOKENS = [
  [/\blatin america(n)?\b|\bsouth america(n)?\b|\bcaribbean\b|\blatam\b/, 'latam', 'Latin America'],
  [/\bnorth america(n)?\b/, 'northam', 'North America'],
  [/\bthe americas\b|\bamericas\b/, 'americas', 'the Americas'],
  [/\bmiddle east(ern)?\b|\bmideast\b/, 'mideast', 'the Middle East'],
  [/\beurope(an)?\b/, 'europe', 'Europe'],
  [/\bafrica(n)?\b/, 'africa', 'Africa'],
  [/\basia(n)?\b/, 'asia', 'Asia'],
  [/\boceania\b|\bpacific\b/, 'oceania', 'Oceania'],
];
const REGION_LABEL = {};
for (const [, k, label] of REGION_TOKENS) REGION_LABEL[k] = label;
function inRegion(iso, region) { return !region || REGION_SET[region].has(iso); }

/* ── country matching ──────────────────────────────────────────────── */
const ALIASES = {
  'usa':'USA','us':'USA','u s':'USA','america':'USA','united states':'USA','the states':'USA',
  'uk':'GBR','britain':'GBR','great britain':'GBR','united kingdom':'GBR',
  'south korea':'KOR','korea':'KOR','north korea':'PRK',
  'russia':'RUS','czech republic':'CZE','czechia':'CZE',
  'ivory coast':'CIV','cote d ivoire':'CIV',
  'drc':'COD','dr congo':'COD','democratic republic of the congo':'COD',
  'holland':'NLD','netherlands':'NLD',
  'uae':'ARE','emirates':'ARE','united arab emirates':'ARE',
  'vietnam':'VNM','viet nam':'VNM','laos':'LAO','syria':'SYR','iran':'IRN',
  'tanzania':'TZA','bolivia':'BOL','moldova':'MDA','macedonia':'MKD',
  'swaziland':'SWZ','eswatini':'SWZ','cape verde':'CPV','cabo verde':'CPV',
  'burma':'MMR','myanmar':'MMR','turkey':'TUR','turkiye':'TUR',
  'hong kong':'HKG','taiwan':'TWN','palestine':'PSE','venezuela':'VEN',
  'brasil':'BRA','deutschland':'DEU','espana':'ESP','italia':'ITA','nz':'NZL',
  // the same countries as they are written in the languages people most often type in
  'alemania':'DEU','allemagne':'DEU','francia':'FRA','frankreich':'FRA','suecia':'SWE','suede':'SWE','schweden':'SWE',
  'noruega':'NOR','norvege':'NOR','estados unidos':'USA','etats unis':'USA','reino unido':'GBR','royaume uni':'GBR',
  'italien':'ITA','spanien':'ESP','espagne':'ESP','japon':'JPN','china popular':'CHN','chine':'CHN','inde':'IND',
  'sudafrica':'ZAF','afrique du sud':'ZAF','mexique':'MEX','dinamarca':'DNK','danemark':'DNK','polonia':'POL','pologne':'POL',
  'holanda':'NLD','paises bajos':'NLD','pays bas':'NLD','irlanda':'IRL','irlande':'IRL','grecia':'GRC','grece':'GRC',
};
let NAME_INDEX = [];

function norm(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%.]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/* ── reading what people type, not what they meant to type ────────────
   One typed question in five went unread in the usability runs, most of them one
   letter out: "norwey", "sweeden", "what is weath". A word the atlas does not know is
   compared against country names and the words its questions are made of, and taken
   to the nearest one if it is one letter off (two for a long word). A word the atlas
   does know is never touched, so Iran never becomes Iraq and Austria never Australia.
   Every change is said in the answer. */
const FOREIGN = {
  desigualdad: 'inequality', desigualdade: 'inequality', inegalite: 'inequality', inegalites: 'inequality',
  ungleichheit: 'inequality', disuguaglianza: 'inequality', ongelijkheid: 'inequality',
  pobreza: 'poverty', pauvrete: 'poverty', armut: 'poverty', poverta: 'poverty', armoede: 'poverty',
  riqueza: 'wealth', richesse: 'wealth', vermogen: 'wealth', reichtum: 'wealth', ricchezza: 'wealth',
  ingresos: 'income', ingreso: 'income', renda: 'income', revenu: 'income', revenus: 'income', einkommen: 'income',
  reddito: 'income', inkomen: 'income', salario: 'wages', salarios: 'wages', salaire: 'wages', salaires: 'wages', lohn: 'wages',
  vivienda: 'housing', logement: 'housing', wohnung: 'housing', ricos: 'rich', riches: 'rich', reiche: 'rich', ricchi: 'rich',
  pobres: 'poor', pauvres: 'poor', poveri: 'poor', pais: 'country', pays: 'country', paese: 'country',
};
const SPELL_WORDS = ('wealth wealthy income incomes inequality inequalities unequal equality equal poorest richest poverty poor rich ' +
  'median average typical house houses housing affordability afford affordable mortgage mortgages rent renting wages wage salary ' +
  'salaries earnings earn country countries compare comparison between highest lowest most least concentration share shares ' +
  'bottom middle top half over time since life expectancy mobility children debt debts owe savings emergency happiness gini lorenz ' +
  'percent billionaires millionaires europe european africa african asia asian america american latin world global trend rising ' +
  'falling growth change history gap difference distribution population people person family families household households ' +
  'owns own owned property properties assets pension pensions inherit inheritance generation young younger older class workers ' +
  'unemployment economy economic government healthy health longer younger quarter tenth percentile comparable similar ' +
  'measure measured correlation relationship ranking ranked').split(' ');
const COMMON = new Set(('a an the is are was were be been being do does did done have has had having of in on at to for from by with ' +
  'about into over under than then so and or but if not no yes it its this that these those there here where when what which who whom ' +
  'whose why how much many more less very too also just only even still ever never always again all any each every some such own same ' +
  'other another my your our their his her them they we you i me us he she him one two three four five ten hundred thousand million ' +
  'can could should would will shall may might must get got gets make makes made go goes going went come comes see show tell give ' +
  'find know think want need like look say says said use used work works live lives lived die dies died pay paid buy bought sell sold ' +
  'keep kept take took let put set new old big small high low good bad best worst better worse fair fairer fairest free right wrong ' +
  'real really actually true false same different today now year years day days week month since until after before during while ' +
  'first last next per cent percent vs versus against compared compare near around across between within among everyone anyone ' +
  'someone nobody something anything nothing everything way lot lots bit kind sort part whole rest time times place places city ' +
  'town state states county counties area areas region regions world people kids child son daughter mum mom dad parents parent ' +
  'grow grew grown growing up down out off back home homes job jobs school rigged gary stevenson economics podcast hello hi hey thanks ' +
  'please explain define meaning mean means interesting data source sources csv download method methodology wid reliable pre post ' +
  'tax taxes taxing policy policies minimum universal basic unions union nordic model reduce reduces work working rise rose risen ' +
  'fall fell fallen went gone happened happening happen getting become becoming stay stayed move moved moving should ' +
  'detroit ohio chicago texas california york').split(' '));
let SPELL_KNOWN = null, SPELL_TARGETS = null;
function spellSetup() {
  SPELL_KNOWN = new Set(COMMON);
  const add = s => norm(s).split(' ').forEach(w => w && SPELL_KNOWN.add(w));
  SPELL_WORDS.forEach(w => SPELL_KNOWN.add(w));
  NAME_INDEX.forEach(n => add(n.norm));
  (typeof QUESTIONS !== 'undefined' ? QUESTIONS : []).forEach(g => g.qs.forEach(add));
  Object.values(META).forEach(m => m.label && add(m.label));
  // one-word targets: the key words, and every country name or alias of one word
  SPELL_TARGETS = { one: [...new Set([...SPELL_WORDS, ...NAME_INDEX.filter(n => !n.norm.includes(' ')).map(n => n.norm)])],
    two: NAME_INDEX.filter(n => n.norm.split(' ').length === 2).map(n => n.norm) };
}
// optimal string alignment distance: a swapped pair of letters counts as one slip
function osa(a, b, cap) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      best = Math.min(best, d[i][j]);
    }
    if (best > cap) return cap + 1;
  }
  return d[a.length][b.length];
}
function nearestWord(w, list) {
  const cap = w.length >= 8 ? 2 : 1;
  let best = null, bestD = cap + 1, tie = false;
  for (const t of list) {
    if (Math.abs(t.length - w.length) > cap || t[0] !== w[0] && cap === 1 && t[1] !== w[1]) continue;
    const dd = osa(w, t, cap);
    if (dd < bestD) { best = t; bestD = dd; tie = false; } else if (dd === bestD && t !== best) tie = true;
  }
  return bestD <= cap && !tie ? best : null;
}
// returns the corrected text and what was changed, for the answer to say
function spellFix(raw) {
  if (!SPELL_KNOWN) spellSetup();
  const words = norm(raw).split(' ').filter(Boolean);
  const out = [], changes = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (FOREIGN[w]) { out.push(FOREIGN[w]); changes.push([w, FOREIGN[w]]); continue; }
    if (SPELL_KNOWN.has(w) || w.length < 4 || /\d|%/.test(w)) { out.push(w); continue; }
    // a two-word country with a slip in one of the words: "south afrika", "new zeland"
    const pair = i + 1 < words.length ? w + ' ' + words[i + 1] : null;
    const prev = out.length ? out[out.length - 1] + ' ' + w : null;
    const two = (pair && nearestWord(pair, SPELL_TARGETS.two)) || null;
    if (two && two !== pair) { out.push(two); changes.push([pair, two]); i++; continue; }
    const two0 = (prev && nearestWord(prev, SPELL_TARGETS.two)) || null;
    if (two0 && two0 !== prev) { out.pop(); out.push(two0); changes.push([prev, two0]); continue; }
    const one = nearestWord(w, SPELL_TARGETS.one);
    if (one) { out.push(one); changes.push([w, one]); } else out.push(w);
  }
  return { text: changes.length ? out.join(' ') : raw, changes };
}
// "Read norwey as Norway." A country is named the way the atlas names it
function readAsNote(changes) {
  if (!changes.length) return '';
  const say = t => { const hit = NAME_INDEX.find(n => n.norm === t); return hit && BY_ISO[hit.iso] ? BY_ISO[hit.iso].name : t; };
  return '<em class="readas">Read ' + changes.map(([a, b]) => `"${esc(a)}" as ${esc(say(b))}`).join(', ') + '.</em>';
}
function buildIndex() {
  const seen = new Set();
  for (const iso in BY_ISO) {
    const n = norm(BY_ISO[iso].name);
    if (n && !seen.has(n)) { NAME_INDEX.push({ norm: n, iso }); seen.add(n); }
  }
  for (const [alias, iso] of Object.entries(ALIASES)) {
    if (BY_ISO[iso] && !seen.has(alias)) { NAME_INDEX.push({ norm: alias, iso }); seen.add(alias); }
  }
  NAME_INDEX.sort((a, b) => b.norm.length - a.norm.length);
}

// which series metrics a country actually has, in a sensible priority order
const METRIC_PRIORITY = ['wealth_gini', 'income_gini', 'life_exp', 'life_satisfaction',
  'poverty_rate', 'median_income', 'gdp_pc', 'co2_pc'];
function firstMetricFor(iso) {
  for (const m of METRIC_PRIORITY) {
    if (latestValOf(m, iso)) return m;
  }
  return null;
}

function findCountries(text) {
  let t = ' ' + norm(text) + ' ';
  const found = [];
  for (const { norm: n, iso } of NAME_INDEX) {
    const needle = ' ' + n + ' ';
    const at = t.indexOf(needle);
    if (at !== -1) {
      if (!found.some(f => f.iso === iso)) found.push({ iso, at });
      t = t.slice(0, at) + ' '.repeat(needle.length) + t.slice(at + needle.length);
    }
  }
  found.sort((a, b) => a.at - b.at);
  return { isos: found.map(f => f.iso), residual: t };
}

/* ── formatting ────────────────────────────────────────────────────── */
const g2 = v => v == null ? 'n/a' : v.toFixed(2);
const g3 = v => v == null ? 'n/a' : v.toFixed(3);
const pc = v => v == null ? 'n/a' : (v * 100).toFixed(1) + '%';
// a change in a share is a change in points: 21.3% to 23.9% is 2.6 points, not 2.6%,
// which would be a rise of about half a point. every difference on a share uses this
const pts = v => v == null ? 'n/a' : (v * 100).toFixed(1) + (Math.abs(v * 100).toFixed(1) === '1.0' ? ' point' : ' points');
const yrs1 = v => v == null ? 'n/a' : v.toFixed(1) + ' years';
const t1 = v => v == null ? 'n/a' : v.toFixed(1) + ' t';
const usd0 = v => v == null ? 'n/a' : '$' + Math.round(v).toLocaleString('en-US');
const usdDay = v => v == null ? 'n/a' : '$' + v.toFixed(1) + '/day';
function ord(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function cap(s) { return s[0].toUpperCase() + s.slice(1); }
function medianOf(arr) {
  const v = arr.slice().sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

/* ── metric registry ───────────────────────────────────────────────── */
const META = {
  wealth_gini: {
    label: 'wealth Gini', topic: 'wealth', series: true, giniFam: true, fmt: g2, fmtD: g3, hover: '%{y:.3f}',
    lineSrc: 'Source: WID, 1990 to 2024. Per-adult equal-split basis, negative net wealth zeroed. Gaps are years without published data.',
    poolSrc: 'Source: WID, latest available year per country.',
  },
  income_gini: {
    label: 'income Gini', topic: 'income', series: true, giniFam: true, file: 'data/income_gini.json',
    fmt: g2, fmtD: g3, hover: '%{y:.3f}',
    lineSrc: 'Source: World Bank Poverty and Inequality Platform, via Our World in Data. Income where surveys measure it, consumption otherwise.',
    poolSrc: 'Source: World Bank PIP via OWID, latest survey per country.',
  },
  life_exp: {
    label: 'life expectancy', topic: 'wellbeing', series: true, file: 'data/life_expectancy.json',
    fmt: yrs1, fmtD: yrs1, hover: '%{y:.1f}',
    lineSrc: 'Source: UN WPP, Clio Infra, and Riley, via Our World in Data. Life expectancy at birth, both sexes.',
    poolSrc: 'Source: UN WPP and predecessors via OWID, latest year per country.',
  },
  co2_pc: {
    label: 'CO2 per person', topic: 'wellbeing', series: true, file: 'data/co2_per_capita.json',
    fmt: t1, fmtD: t1, hover: '%{y:.1f}',
    lineSrc: 'Source: Global Carbon Budget, via Our World in Data. Territorial emissions per person, tonnes of CO2.',
    poolSrc: 'Source: Global Carbon Budget via OWID, latest year per country.',
  },
  poverty_rate: {
    label: 'extreme poverty', topic: 'wellbeing', series: true, file: 'data/poverty_rate.json',
    higherWorse: true, fmt: pc, fmtD: pts, hover: '%{y:.1%}',
    lineSrc: 'Source: World Bank Poverty and Inequality Platform, via Our World in Data. The share of people living on less than $2.15 a day in 2017 purchasing power dollars, which is the line for surviving, not the line for getting by. In the richer third of countries the median reading is a quarter of one per cent and eight countries read exactly zero, so this measure says almost nothing about a rich country. A relative line, half of what the middle person has, says something everywhere, and the atlas holds that too as relative poverty.',
    poolSrc: 'Source: World Bank PIP via OWID. The share below $2.15 a day in 2017 purchasing power dollars, latest survey per country. This is the survival line: across the richer third of countries the median reading is a quarter of one per cent, so a ranking of rich countries on it is a ranking of rounding.',
  },
  wealth_top1: {
    label: 'top 1% wealth share', topic: 'wealth', series: true, giniFam: true, concFam: true, file: 'data/wealth_top1.json',
    fmt: pc, fmtD: pts, hover: '%{y:.1%}',
    lineSrc: 'Source: WID. Share of household net wealth held by the top 1%.',
    poolSrc: 'Source: WID, top 1% wealth share, latest year per country.',
  },
  wealth_bottom50: {
    label: 'bottom 50% wealth share', topic: 'wealth', series: true, file: 'data/wealth_bottom50.json',
    fmt: pc, fmtD: pts, hover: '%{y:.1%}',
    lineSrc: 'Source: WID. Share of household net wealth held by the bottom 50%.',
    poolSrc: 'Source: WID, bottom 50% wealth share, latest year per country.',
  },
  // WID pretax national income, equal-split adults: the same unit convention as the
  // WID wealth shares above, which is what makes an income share and a wealth share
  // comparable here. Not comparable to the PIP income Gini, which is post-tax survey.
  income_top1: {
    label: 'top 1% income share', topic: 'income', series: true, concFam: true, file: 'data/income_top1.json',
    fmt: pc, fmtD: pts, hover: '%{y:.1%}',
    lineSrc: 'Source: WID. Share of pretax national income taken by the top 1%, per adult, split equally within the couple.',
    poolSrc: 'Source: WID, top 1% pretax income share, latest year per country.',
  },
  income_top10: {
    label: 'top 10% income share', topic: 'income', series: true, concFam: true, file: 'data/income_top10.json',
    fmt: pc, fmtD: pts, hover: '%{y:.1%}',
    lineSrc: 'Source: WID. Share of pretax national income taken by the top 10%, per adult, split equally within the couple.',
    poolSrc: 'Source: WID, top 10% pretax income share, latest year per country.',
  },
  income_middle40: {
    label: 'middle 40% income share', topic: 'income', series: true, file: 'data/income_middle40.json',
    fmt: pc, fmtD: pts, hover: '%{y:.1%}',
    lineSrc: 'Source: WID. Share of pretax national income taken by the middle 40%, the people between the median and the top tenth.',
    poolSrc: 'Source: WID, middle 40% pretax income share, latest year per country.',
  },
  income_bottom50: {
    label: 'bottom 50% income share', topic: 'income', series: true, file: 'data/income_bottom50.json',
    fmt: pc, fmtD: pts, hover: '%{y:.1%}',
    lineSrc: 'Source: WID. Share of pretax national income taken by the bottom 50%, per adult, split equally within the couple.',
    poolSrc: 'Source: WID, bottom 50% pretax income share, latest year per country.',
  },
  house_price: {
    label: 'real house prices (2015 = 100)', topic: 'wealth', series: true, file: 'data/house_prices.json',
    fmt: v => v == null ? 'n/a' : v.toFixed(0), fmtD: v => v == null ? 'n/a' : v.toFixed(0), hover: '%{y:.0f}',
    lineSrc: 'Source: OECD Analytical house price indicators. Real house prices, deflated by what households spend, 2015 = 100: only the growth means anything, not the level.',
    poolSrc: 'Source: OECD Analytical house price indicators, real house price index, 2015 = 100, latest year per country. About forty-five countries, mostly OECD members.',
  },
  house_income: {
    label: 'house prices against income (2015 = 100)', topic: 'wealth', series: true, higherWorse: true, file: 'data/house_income.json',
    fmt: v => v == null ? 'n/a' : v.toFixed(0), fmtD: v => v == null ? 'n/a' : v.toFixed(0), hover: '%{y:.0f}',
    lineSrc: 'Source: OECD Analytical house price indicators. The price of a house divided by disposable income per person, both before inflation, 2015 = 100. Above 100, a house costs more years of income than it did in 2015. The income here is the national accounts average, not the full-time earnings figure the press ratio uses: same direction, different denominator.',
    poolSrc: 'Source: OECD, price to income ratio, 2015 = 100, latest year per country. Each country is measured against its own 2015, so this ranks how far houses have moved against pay since then, not which country is dearest.',
  },
  gdp_hour: {
    label: 'output per hour worked', topic: 'income', series: true, money: true, file: 'data/gdp_hour.json',
    fmt: v => v == null ? 'n/a' : '$' + v.toFixed(0), fmtD: v => v == null ? 'n/a' : '$' + v.toFixed(1), hover: '$%{y:.0f}',
    lineSrc: 'Source: OECD Productivity database. GDP per hour worked, whole economy, US dollars at 2020 prices and 2020 purchasing power.',
    poolSrc: 'Source: OECD Productivity database, GDP per hour worked in 2020 dollars at 2020 purchasing power, latest year per country.',
  },
  poverty_relative: {
    label: 'relative poverty', topic: 'wellbeing', series: true, higherWorse: true, file: 'data/poverty_relative.json',
    fmt: pc, fmtD: pts, hover: '%{y:.1%}',
    lineSrc: 'Source: World Bank, World Development Indicators (SI.DST.50MD), from the Poverty and Inequality Platform surveys. The share of people living on less than half of what the person in the middle has, the line rich countries use for themselves. One point per survey year, nothing filled in between.',
    poolSrc: 'Source: World Bank WDI, share below half the national median, latest survey per country.',
  },
  life_satisfaction: {
    label: 'life satisfaction', topic: 'wellbeing', series: true, file: 'data/life_satisfaction.json',
    fmt: v => v == null ? 'n/a' : v.toFixed(2), fmtD: v => v == null ? 'n/a' : v.toFixed(2), hover: '%{y:.2f}',
    lineSrc: 'Source: World Happiness Report, Cantril ladder from 0 to 10, Gallup World Poll. Panel 2005 to 2022.',
    poolSrc: 'Source: World Happiness Report, Cantril ladder (0 to 10), latest year per country.',
  },
  median_income: {
    label: 'median income', topic: 'income', series: true, file: 'data/median_income.json',
    fmt: usdDay, fmtD: usdDay, hover: '$%{y:.1f}/day',
    lineSrc: 'Source: World Bank Poverty and Inequality Platform, via Our World in Data. Median daily income or consumption, 2017 PPP.',
    poolSrc: 'Source: World Bank PIP via OWID, latest survey per country.',
  },
  gdp_pc: {
    label: 'GDP per person', topic: 'income', series: true, file: 'data/gdp_pc.json',
    fmt: usd0, fmtD: usd0, hover: '$%{y:,.0f}',
    lineSrc: 'Source: Maddison Project Database 2023, via the Global Carbon Budget dataset at Our World in Data. GDP per person in international dollars at 2011 prices, a different base year and a different accounting basis from the 2017 purchasing power dollars the daily income figures use.',
    poolSrc: 'Source: Maddison Project Database 2023 via OWID. GDP per person, 2011 international dollars, latest year per country.',
  },
  top1_wealth_share: { label: 'top 1% share', topic: 'wealth', snap: true, fmt: pc, fmtD: pts },
  top10_wealth_share: { label: 'top 10% share', topic: 'wealth', snap: true, fmt: pc, fmtD: pts },
  bottom50_wealth_share: { label: 'bottom 50% share', topic: 'wealth', snap: true, fmt: pc, fmtD: pts },
};

// how each series came to exist. this is stated on every chart that draws it.
const BASIS = {
  survey:    'measured in household surveys, one point per survey year',
  // The release carries comparability_tier and observed_vs_modeled per row and neither
  // separates a measured country from an imputed one: every row the atlas draws is tier B
  // ("same broad concept, different source machinery") and "imported" ("published series
  // ingested verbatim"), which describe the pipeline's relation to WID, not WID's relation
  // to the world. What does separate them is the shape of the file, so that is what this
  // says instead of a flag that would read the same everywhere.
  modelled:  'modelled, with annual values imputed for most countries from the smaller set that has tax records',
  estimated: 'an estimated annual series, interpolated between benchmark years',
  dina:      'built from tax records, surveys and national accounts together, in a snapshot taken from WID in September 2022',
  oecd:      'an index the OECD builds from each country\'s own house price statistics, 2015 = 100, so each country is measured against itself',
  accounts:  'from national accounts, one value a year',
};
const SERIES_BASIS = {
  wealth_gini: 'modelled', wealth_top1: 'modelled', wealth_bottom50: 'modelled',
  income_gini: 'survey', poverty_rate: 'survey', median_income: 'survey',
  life_exp: 'estimated', co2_pc: 'estimated', gdp_pc: 'estimated',
  life_satisfaction: 'survey',
  income_top1: 'dina', income_top10: 'dina', income_middle40: 'dina', income_bottom50: 'dina',
  house_price: 'oecd', house_income: 'oecd', gdp_hour: 'accounts', poverty_relative: 'survey',
};
// the last year the series actually carries, read from the data rather than assumed
const vintageCache = {};
function vintageOf(key) {
  if (key in vintageCache) return vintageCache[key];
  const ser = SERIES[key]; let hi = null;
  if (ser) for (const i in ser) { const a = ser[i]; if (a && a.length) {
    const y = a[a.length - 1].year; if (hi == null || y > hi) hi = y; } }
  vintageCache[key] = hi;
  return hi;
}
// one plain sentence naming what a measure is and how far it runs
// how far apart the two sides of each pair are, and how many are contemporaneous
function pairFitness(pts) {
  const withYears = pts.filter(p => p.xYear && p.yYear);
  if (!withYears.length) return { n: pts.length, level: 'ok' };
  const gaps = withYears.map(p => p.gap).sort((a, b) => a - b);
  const same = gaps.filter(g => g === 0).length;
  const med = gaps[Math.floor(gaps.length / 2)];
  const maxGap = gaps[gaps.length - 1];
  let level = 'ok';
  if (same === 0 && med >= 3) level = 'refuse';      // nothing is contemporaneous: not a relationship
  else if (med >= 2 || same / withYears.length < 0.25) level = 'weak';
  if (pts.length < 25 && level === 'ok') level = 'weak';
  return { n: pts.length, same, med, maxGap, level, paired: withYears.length };
}
// the flag that sits beside the answer, where the eye already is
function fitnessFlag(fit, note) {
  if (!fit || fit.level === 'ok') return '';
  const cls = fit.level === 'refuse' ? 'bad' : 'thin';
  return ` <span class="flag ${cls}">${esc(note)}</span>`;
}
// the house price series is the OECD's, which is its members and a few more; a country
// outside it is named, with how many are held, rather than left as a blank
// the OECD's own price to income ratio: both sides from national accounts, one value a
// year, so unlike the survey median it has no gaps to draw across. said beside the chart
// rather than instead of it, because it answers the same question a second way
function houseRatio(iso) {
  const r = seriesOf('house_income', iso);
  if (r.length < 2) return '';
  const last = r[r.length - 1], lo = r.reduce((a, d) => d.v < a.v ? d : a), hi = r.reduce((a, d) => d.v > a.v ? d : a);
  const since = r.find(d => d.year >= 2000) || r[0];
  const move = (last.v / since.v - 1) * 100;
  return ` On the OECD's own measure, a house against disposable income per person, ${esc(theName(iso))} ` +
    `stood at <strong>${last.v.toFixed(0)}</strong> in ${last.year} against 100 in 2015` +
    (since.year < last.year ? `, ${move >= 0 ? 'up' : 'down'} ${Math.abs(move).toFixed(0)}% since ${since.year}` : '') +
    `. Its dearest year on that measure was ${hi.year} (${hi.v.toFixed(0)}), its cheapest ${lo.year} (${lo.v.toFixed(0)}).`;
}
function housesMissing(iso) {
  const n = Object.keys(SERIES.house_price || {}).filter(i => BY_ISO[i]).length;
  return `No house price series for ${esc(theName(iso))}. The atlas holds ${n} countries from the ` +
    `OECD, which are its members and a few others, and ${esc(theName(iso))} is not among them.`;
}
// A measure sitting on its floor everywhere in the set being read is not answering the
// question, and the reading should say so rather than print a confident 0.0%. Extreme
// poverty is the case the atlas actually has: across the richer third of countries the
// median reading is a quarter of one per cent.
// the line a rich country uses for itself, said where the survival line reads zero
function relativeLine(isos) {
  const got = isos.map(i => { const s = seriesOf('poverty_relative', i); return s.length ? { i, d: s[s.length - 1] } : null; }).filter(Boolean);
  if (!got.length) return ' What the person in the middle lives on carries more.';
  if (got.length === 1) return ` The line rich countries use, half of what the person in the middle has, ` +
    `counts <strong>${(got[0].d.v * 100).toFixed(1)}%</strong> of ${esc(theName(got[0].i))} below it in ${got[0].d.year}.`;
  const lo = got.reduce((a, b) => b.d.v < a.d.v ? b : a), hi = got.reduce((a, b) => b.d.v > a.d.v ? b : a);
  return ` The line rich countries use, half of what the person in the middle has, runs from ` +
    `${(lo.d.v * 100).toFixed(1)}% in ${esc(theName(lo.i))} to ${(hi.d.v * 100).toFixed(1)}% in ${esc(theName(hi.i))}.`;
}
function floorNote(f) {
  if (!f || !f.text) return f;
  if ((f.metricUsed || ctx.metric) !== 'poverty_rate') return f;
  const isos = (f.isos || []).filter(i => BY_ISO[i]);
  const vals = isos.map(i => { const s = seriesOf('poverty_rate', i); return s.length ? s[s.length - 1].v : null; })
    .filter(v => v != null);
  if (!vals.length || vals.some(v => v >= 0.01)) return f;
  f.text += ` <em>This counts people living on under $2.15 a day, which is the line for surviving ` +
    `rather than the line for getting by. ${isos.length === 1 ? 'Here it runs' : 'For every one of these it runs'} ` +
    `under one per cent, as it does across nearly every rich country, so what you are reading is the ` +
    `floor of the measure and not the state of the place.` + relativeLine(isos) + `</em>`;
  return f;
}
function provenance(keys) {
  // series that came to exist the same way and run to the same year are named together,
  // rather than repeating one sentence twice with only the label swapped
  const seen = [], groups = [];
  for (const k of [].concat(keys)) {
    if (!k || !META[k] || seen.includes(k)) continue;
    seen.push(k);
    const b = SERIES_BASIS[k], v = vintageOf(k);
    if (!b) continue;
    const g = groups.find(x => x.b === b && x.v === v);
    if (g) g.labels.push(META[k].label);
    else groups.push({ b, v, labels: [META[k].label] });
  }
  return groups.map(g => {
    const l = g.labels;
    const names = l.length === 1 ? l[0]
      : l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1];
    return `${cap(names)} ${l.length === 1 ? 'is' : 'are'} ${BASIS[g.b]}, running to ${g.v}.` +
      (g.b === 'modelled' ? ' ' + gaplessNote() : '');
  }).join(' ');
}
// How much of it is imputed, said with the evidence rather than asserted. The release
// carries comparability_tier and observed_vs_modeled per row and neither separates a
// measured country from an imputed one: every row drawn here is tier B, "same broad
// concept, different source machinery", and "imported", "published series ingested
// verbatim". Those describe the pipeline's relation to WID, not WID's relation to the
// world. The shape of the file does separate them, so the shape is what gets said.
function gaplessNote() {
  const s = SERIES.wealth_top1 || {};
  const isos = Object.keys(s).filter(i => s[i].length);
  if (!isos.length) return '';
  let lo = Infinity, hi = -Infinity, full = 0;
  for (const i of isos) {
    const a = s[i];
    lo = Math.min(lo, a[0].year); hi = Math.max(hi, a[a.length - 1].year);
  }
  for (const i of isos) {
    const a = s[i];
    if (a[0].year === lo && a[a.length - 1].year === hi && a.length === hi - lo + 1) full++;
  }
  if (full < isos.length) return '';
  return `How much of it: every one of the ${isos.length} countries carries a value for every ` +
    `year from ${lo} to ${hi}, with no gap anywhere, which no measurement programme produces. ` +
    `The completeness is the model. Nothing in the release marks which countries sit on tax ` +
    `records and which are filled in, so this page cannot tell you either.`;
}
const poolCache = {};
function poolOf(metric) {
  if (poolCache[metric]) return poolCache[metric];
  const m = META[metric];
  let pool;
  if (m.snap) {
    pool = LATEST.filter(r => r[metric] != null)
      .map(r => ({ geo_id: r.geo_id, geo_name: r.geo_name, val: r[metric], year: r.year }));
  } else {
    pool = [];
    const s = SERIES[metric] || {};
    for (const iso in s) {
      const pts = s[iso];
      if (!pts.length || !BY_ISO[iso]) continue;
      const last = pts[pts.length - 1];
      pool.push({ geo_id: iso, geo_name: BY_ISO[iso].name, val: last.v, year: last.year });
    }
  }
  return (poolCache[metric] = pool);
}
// how far from the year you asked for a reading may sit before it stops counting
const POOL_YEAR_TOL = 3;
// the pool as it stood in a given year: each country's nearest reading to that year,
// with how far off it was kept on the row so the answer can say
function poolAt(metric, year) {
  if (!year || (META[metric] && META[metric].snap)) return poolOf(metric);
  const out = [];
  const ser = SERIES[metric] || {};
  for (const iso in ser) {
    const pts = ser[iso];
    if (!pts.length || !BY_ISO[iso]) continue;
    let best = null;
    for (const d of pts) if (!best || Math.abs(d.year - year) < Math.abs(best.year - year)) best = d;
    if (!best || Math.abs(best.year - year) > POOL_YEAR_TOL) continue;
    out.push({ geo_id: iso, geo_name: BY_ISO[iso].name, val: best.v, year: best.year,
      gap: Math.abs(best.year - year) });
  }
  return out;
}
function rankedPool(metric, dir, region, year) {
  return poolAt(metric, year).filter(r => inScope(r.geo_id, region)).slice()
    .sort((a, b) => dir === 'low' ? a.val - b.val : b.val - a.val);
}
// 1st, 2nd, 3rd, 11th: a rank reads as a position, not as a bare number
// "in the United Kingdom", not "in United Kingdom": the names that take an article
const THE = new Set(['GBR', 'USA', 'NLD', 'PHL', 'ARE', 'DOM', 'BHS', 'MDV', 'COD', 'COG', 'CAF', 'GMB', 'COM', 'SYC', 'SLB', 'MHL']);
// Six names arrive inverted or parenthesised from the source file, which is right for a
// table and wrong in a sentence: "the Congo, Democratic Republic lives on $1.46 a day".
// The table keeps the source spelling; only prose uses these.
const SAYS = {
  COD: 'the Democratic Republic of Congo', PRK: 'North Korea',
  MAF: 'the French side of Saint Martin', SXM: 'the Dutch side of Sint Maarten',
  BES: 'Bonaire, Sint Eustatius and Saba', SHN: 'Saint Helena',
  RUS: 'Russia', SYR: 'Syria',   // "half the adults in Russian Federation" is a table heading, not a sentence
};
function theName(iso) {
  if (SAYS[iso]) return SAYS[iso];
  const n = BY_ISO[iso] ? BY_ISO[iso].name : iso;
  return (THE.has(iso) ? 'the ' : '') + n;
}
// A multiple built on a one-per-cent share carries no fourth digit worth printing, so it
// is rounded to two figures once it is past a hundred and the sentence says which way to
// read it.
// The years the reader asked for, applied to a series. A window that leaves fewer than
// two readings is refused by name rather than quietly widened back out, because a
// reading that silently ignores the years you set is worse than one that will not run.
function windowed(arr, since, until) {
  if (!since && !until) return arr;
  return arr.filter(d => (!since || d.year >= since) && (!until || d.year <= until));
}
function windowNote(since, until) {
  if (since && until) return ` between ${since} and ${until}`;
  if (since) return ` from ${since} on`;
  if (until) return ` up to ${until}`;
  return '';
}
function tooNarrow(iso, since, until, what) {
  showNotice(`${cap(theName(iso))} carries fewer than two readings of ${what}` +
    windowNote(since, until) + '. Widen the years, or clear them to read the whole record.');
  return null;
}
function roughly(v) {
  if (v == null) return 'n/a';
  if (v < 100) return v.toFixed(0);
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / p) * p >= 1000
    ? (Math.round(v / p) * p).toLocaleString('en-US') : String(Math.round(v / p) * p);
}
// Shares belong to groups of wildly different sizes, so dividing one share by another
// says nothing about a person. Divide each by the fraction of adults it covers first and
// both become incomes, or holdings, for one person. Returns null on the side whose bottom
// half owes more than it owns, because there is nothing there to divide by.
function multiplePair(iso) {
  const pick = k => { const s = seriesOf(k, iso); return s.length ? s[s.length - 1] : null; };
  const w1 = pick('wealth_top1'), wbS = seriesOf('wealth_bottom50', iso);
  const i1 = pick('income_top1'), ibS = seriesOf('income_bottom50', iso);
  const atYear = (arr, y) => { const q = arr.filter(d => d.year <= y); return q.length ? q[q.length - 1] : null; };
  const wb = w1 ? atYear(wbS, w1.year) : null;
  const ib = i1 ? atYear(ibS, i1.year) : null;
  if (!w1 && !i1) return null;
  const per = (top, bot) => (top != null && bot != null && bot > 0) ? (top / 0.01) / (bot / 0.50) : null;
  return {
    iso,
    w1: w1 ? w1.v : null, wb: wb ? wb.v : null, wYear: w1 ? w1.year : null,
    i1: i1 ? i1.v : null, ib: ib ? ib.v : null, iYear: i1 ? i1.year : null,
    wm: per(w1 && w1.v, wb && wb.v), im: per(i1 && i1.v, ib && ib.v),
  };
}
// The set a country is being measured against, named the way the reader chose it. A
// reading that says "richer countries" while the fold says Europe is describing a set
// nobody asked for.
function setLabel(n) {
  if (ctx.region) return `the ${n} countries in ${REGION_LABEL[ctx.region]}`;
  if (ctx.pool && ctx.pool.all) return `all ${n} countries`;
  if (ctx.pool) return `the ${n} ${ctx.pool.label}`;
  if (rankNarrowed()) return `the ${n} countries in the richer third`;
  return `${n} countries`;
}
// the same two divisions done for every country in the set the rest of the page ranks on
const sweepCache = {};
function multipleSweep() {
  const key = (rankNarrowed() ? 'rich' : 'all') + '|' + (ctx.region || '');
  if (sweepCache[key]) return sweepCache[key];
  const rt = rankNarrowed() ? richThird() : null;
  const both = [], owing = [];
  for (const iso in BY_ISO) {
    if (rt && !rt.has(iso)) continue;
    if (!inScope(iso, null)) continue;
    const p = multiplePair(iso);
    if (!p || p.im == null) continue;
    if (p.wm == null) { if (p.wb != null) owing.push(p); continue; }
    both.push(p);
  }
  const ratios = both.map(p => p.wm / p.im).sort((a, b) => a - b);
  return (sweepCache[key] = {
    both, owing,
    wider: both.filter(p => p.wm > p.im).length,
    medRatio: ratios.length ? ratios[Math.floor(ratios.length / 2)] : 0,
  });
}
function ordinal(n) {
  const t = n % 100, u = n % 10;
  const suf = (t >= 11 && t <= 13) ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th';
  return n + suf;
}
// A ranking compares like with like by default: the richer third of countries by GDP
// per person, which is close to the set with tax records behind their wealth figures.
// Against all 213 the United Kingdom ranks 207th on wealth concentration, which is true
// and tells a British reader the opposite of what is true about their country, because
// the 150 places above it are modelled. "the whole world" in the among fold widens it,
// and every sentence a ranking touches says which set it ran on.
function richThird() {
  if (richThird.cache && richThird.gen === (medianCache.gen || 0)) return richThird.cache;
  const gp = poolOf('gdp_pc').slice().sort((a, b) => b.val - a.val);
  richThird.gen = medianCache.gen || 0;
  return (richThird.cache = new Set(gp.slice(0, Math.floor(gp.length / 3)).map(r => r.geo_id)));
}
function rankNarrowed() { return !ctx.pool && !ctx.region; }
const RANK_SET_NOTE = ' among the richer third of countries';
function rankOf(iso, metric) {
  const all = rankedPool(metric, 'high', null);
  let pool = all;
  if (rankNarrowed()) { const rt = richThird(); pool = all.filter(r => rt.has(r.geo_id)); }
  let i = pool.findIndex(r => r.geo_id === iso), outside = false;
  // China, India and Brazil are outside the richer third, so they were "0th of 54": a
  // rank in a set they were never in. they are ranked against every country instead,
  // and the sentence says so
  if (i < 0 && pool !== all) { pool = all; i = pool.findIndex(r => r.geo_id === iso); outside = i >= 0; }
  return { rank: i + 1, of: pool.length, row: i >= 0 ? pool[i] : null, outside };
}
// "48th most concentrated of the 54 countries in the richer third", always naming the set
function rankPhrase(rk, m) {
  if (!rk.rank) return 'not in the ranking, which has no figure for it';
  // "7th of 213" on a bottom-half share did not say whether 1st was the most or the least
  const word = m.concFam ? ' most concentrated' : m.giniFam ? ' most unequal' : ' highest';
  if (rk.outside) return `${ord(rk.rank)}${word} of all ${rk.of} countries with a figure ` +
    '(it is outside the richer third that rankings here use by default, so it is ranked against all of them)';
  return `${ord(rk.rank)}${word} of ${setLabel(rk.of)}`;
}
function seriesOf(metric, iso) { return (SERIES[metric] || {})[iso] || []; }

const medianCache = {};
function medianSeriesOf(metric, region) {
  const key = metric + '|' + (region || 'world') + '|' + (ctx.region || '') + '|' + (medianCache.gen || 0);
  if (medianCache[key]) return medianCache[key];
  const byYear = {};
  const s = SERIES[metric] || {};
  for (const iso in s) {
    if (!inScope(iso, region)) continue;
    for (const p of s[iso]) (byYear[p.year] = byYear[p.year] || []).push(p.v);
  }
  // A median over whichever countries happened to report that year measures the sample, not
  // the world: income coverage swings between 19 and 85 countries. Keep only years reaching
  // half the peak coverage, and carry the count so a chart can say what stands behind it.
  const min = region ? 5 : 10;
  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
  const peak = years.reduce((m, y) => Math.max(m, byYear[y].length), 0);
  const floor = Math.max(min, Math.ceil(peak * 0.5));
  const kept = years.filter(y => byYear[y].length >= floor);
  const out = kept.map(y => ({ year: y, v: medianOf(byYear[y]), n: byYear[y].length }));
  out.peak = peak; out.floor = floor; out.dropped = years.length - kept.length;
  return (medianCache[key] = out);
}
