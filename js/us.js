'use strict';
// the United States layer: commuting zones, counties and one US place.
// one of eight files loaded in order by index.html; they share one scope, so a
// function here can be used by any of them once the page has loaded

/* ── opportunity: the commuting-zone layer (Opportunity Insights) ──── */
let US_CZ = null;
const OPP_FIN = [
  { re: /\bmortgages?\b|\bhome ?loans?\b|\bhousing\b|\bowns? a home\b|\bhome ?owner\w*\b|\bon the ladder\b/, key: 'mort', label: 'mortgage balance', fmt: usd0 },
  { re: /\bdelinqu\w*|\bbehind on\b|\bmiss\w* payment/, key: 'delq', label: 'delinquency rate', fmt: v => (v * 100).toFixed(0) + '%' },
  { re: /\bcredit\b|\bscore\b/, key: 'cr', label: 'credit score', fmt: v => '' + Math.round(v) },
];
function czMed(sel) { const a = Object.values(US_CZ).map(sel).filter(v => v != null).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; }
/* ── one US place ────────────────────────────────────────────────────────
   American visitors typed "detroit", "social mobility in ohio", "my county" and got
   nothing: the layer holds 3,272 counties and 741 commuting zones by name and could not
   be asked about one. A typed state, county or zone now answers for that place, against
   the middle of all of them. Zone names are towns, and many towns share a name with
   somewhere abroad or with an ordinary word (London, Paris, Rome, Gary, Many, Price), so
   a town counts only with something American in the question, or when it is a city
   nobody would take for anywhere else. A name several zones share is said to be shared. */
const US_BIG = new Set(['detroit', 'chicago', 'houston', 'atlanta', 'boston', 'seattle', 'dallas', 'phoenix', 'denver',
  'baltimore', 'cleveland', 'pittsburgh', 'philadelphia', 'los angeles', 'san francisco', 'san diego', 'new orleans',
  'minneapolis', 'milwaukee', 'memphis', 'nashville', 'charlotte', 'indianapolis', 'st louis', 'kansas city', 'las vegas',
  'sacramento', 'san antonio', 'salt lake city', 'tampa', 'orlando', 'cincinnati', 'louisville', 'oklahoma city', 'tucson',
  'albuquerque', 'raleigh', 'honolulu', 'anchorage', 'fresno', 'el paso', 'jacksonville', 'omaha', 'tulsa', 'wichita',
  'des moines', 'spokane', 'knoxville', 'chattanooga', 'baton rouge', 'shreveport', 'savannah', 'grand rapids', 'little rock',
  'washington dc', 'miami', 'new york', 'columbus', 'portland']);
let US_PLACES = null;
function usPlaces() {
  if (US_PLACES) return US_PLACES;
  const states = {}, counties = [], zones = [];
  for (const [fips, full] of Object.entries(US_NAMES || {})) {
    const [cname, sname, abbr] = full.split(',').map(s => s.trim());
    const st = fips.slice(0, 2);
    if (sname && !states[st]) states[st] = { fips: st, name: sname, abbr, n: norm(sname) };
    counties.push({ fips, name: cname, state: st, stateName: sname, n: norm(cname) });
  }
  for (const [id, z] of Object.entries(US_CZ || {})) if (z.name) zones.push({ id, name: z.name, n: norm(z.name) });
  return (US_PLACES = { states: Object.values(states).sort((a, b) => b.n.length - a.n.length), counties, zones });
}
function usPlaceFind(raw) {
  if (!US_NAMES || !US_CZ) return null;
  const t = ' ' + norm(raw) + ' ';
  const has = n => t.includes(' ' + n + ' ');
  const P = usPlaces();
  const usWords = /\b(us|usa|u s|america|american|americans|united states|county|counties|parish|state)\b/.test(t);
  const abroad = findCountries(raw).isos.filter(i => i !== 'USA');
  const bigNamed = [...US_BIG].some(n => has(n));
  let state = P.states.find(s => has(s.n) && !(s.n === 'new york' && / city /.test(t)));
  // Georgia the country is Georgia the country, unless the question says otherwise
  // ("atlanta georgia" says otherwise)
  if (state && abroad.length && !usWords && !bigNamed) state = null;
  if (abroad.length && !usWords && !state && !bigNamed) return null;
  if (!SPELL_KNOWN) spellSetup();
  const cm = t.match(/ ([a-z .'-]+?) (county|parish|borough) /);
  if (cm) {
    const words = cm[1].trim().split(' ');
    for (let k = Math.min(3, words.length); k >= 1; k--) {
      const nm = words.slice(-k).join(' ');
      let hits = P.counties.filter(c => c.n === nm);
      if (state) hits = hits.filter(c => c.state === state.fips);
      if (cm[2] === 'parish') hits = hits.filter(c => c.state === '22');     // only Louisiana has parishes
      if (cm[2] === 'borough') hits = hits.filter(c => c.state === '02' || c.state === '36');
      if (hits.length === 1) return Object.assign({ type: 'county' }, hits[0]);
      if (hits.length > 1) return { type: 'shared-county', name: hits[0].name, states: hits.map(h => h.stateName) };
    }
  }
  // a zone named after an ordinary word (Many, Price, Center) needs its state beside it
  const zs = P.zones.filter(z => z.n.length > 3 && has(z.n) && (US_BIG.has(z.n) || state ||
      (usWords && !SPELL_KNOWN.has(z.n))))
    .sort((a, b) => b.n.length - a.n.length);
  if (zs.length) {
    const same = P.zones.filter(z => z.n === zs[0].n);
    if (same.length === 1 && !(state && state.n === zs[0].n)) return Object.assign({ type: 'zone' }, same[0]);
    if (same.length > 1 && !state) return { type: 'shared-zone', name: same[0].name, count: same.length };
    if (same.length > 1 && state) return Object.assign({ type: 'state', sharedZone: same[0].name, sharedN: same.length }, state);
  }
  if (state) return Object.assign({ type: 'state' }, state);
  return null;
}
// where one value sits among all of them: the share of places it is above
function usPos(block, v) {
  const vals = Object.values(block).filter(x => x != null && isFinite(x));
  if (!vals.length || v == null) return null;
  const below = vals.filter(x => x < v).length;
  const sorted = vals.slice().sort((a, b) => a - b);
  return { pct: Math.round(100 * below / vals.length), med: sorted[Math.floor(sorted.length / 2)], n: vals.length,
    rankHigh: vals.filter(x => x > v).length + 1 };
}
function usPlaceAnswer(pl, q) {
  const f = { id: ++factSeq, query: q, kind: 'opp', isos: [], mode: 'opp', text: '', opp: { kind: 'place' } };
  if (pl.type === 'shared-zone') {
    showNotice(`${pl.count} commuting zones are called ${esc(pl.name)}, and the source does not say which state each is in, ` +
      `so the atlas cannot pick one. Name the county instead, for example "Franklin County, Ohio", or ask about the state.`);
    return null;
  }
  if (pl.type === 'shared-county') {
    showNotice(`There is a ${esc(pl.name)} County in ${pl.states.length} states (${esc(pl.states.slice(0, 6).join(', '))}` +
      `${pl.states.length > 6 ? ', and more' : ''}). Add the state, for example "${esc(pl.name)} County, ${esc(pl.states[0])}".`);
    return null;
  }
  const bars = [];
  // each bar carries the face its measure belongs to, and is drawn in that face's colour
  const bar = (label, pos, better, face = 'opportunity') => { if (pos) bars.push({ label, pct: pos.pct, better, face }); };
  if (pl.type === 'zone') {
    const z = US_CZ[pl.id], zones = Object.values(US_CZ);
    const col = k => Object.fromEntries(Object.entries(US_CZ).map(([id, r]) => [id, r[k]]));
    const gapOf = r => (r.leq4M != null && r.leq1M != null) ? r.leq4M - r.leq1M : null;
    const mob = usPos(col('mob'), z.mob), cr = usPos(col('cr25'), z.cr25), dq = usPos(col('delq25'), z.delq25);
    const gaps = Object.fromEntries(Object.entries(US_CZ).map(([id, r]) => [id, gapOf(r)]));
    const gp = usPos(gaps, gapOf(z));
    f.opp.placeName = `${pl.name} (commuting zone)`;
    const climbS = `a child from a family in the poorest quarter reaches the ` +
      `<strong>${ord(Math.round(z.mob * 100))} percentile</strong> of income by adulthood. The middle of the ${mob.n} zones is the ` +
      `${ord(Math.round(mob.med * 100))}, so ${esc(pl.name)} is ${ord(mob.rankHigh)} of ${mob.n} for how far poor children climb.`;
    const lifeS = gapOf(z) != null ? `a man of forty in the poorest quarter lives to <strong>${z.leq1M.toFixed(1)}</strong> and one in the ` +
      `richest to ${z.leq4M.toFixed(1)}, a gap of <strong>${gapOf(z).toFixed(1)} years</strong> against ${gp.med.toFixed(1)} in the middle zone` +
      (z.leq1F != null && z.leq4F != null ? `; for women the gap is ${(z.leq4F - z.leq1F).toFixed(1)} years.` : '.') : null;
    const health = curFacet === 'health';
    let t = `In the <strong>${esc(pl.name)}</strong> commuting zone, `;
    if (health) t += lifeS ? lifeS + ` Poor children here reach the ${ord(Math.round(z.mob * 100))} percentile by adulthood (the middle zone: ${ord(Math.round(mob.med * 100))}).`
      : `there is no life expectancy by income: the source measures it only in the 595 zones large enough. ` + climbS;
    else t += climbS + (lifeS ? ' ' + cap(lifeS) : '');
    if (z.cr25 != null && !health) t += ` Children of the poorest quarter have a credit score of ${Math.round(z.cr25)} by their mid thirties, ` +
      `children of the richest ${Math.round(z.cr75)}.`;
    t += ` <em>A commuting zone is a local job market, the counties people travel between for work. Children born in the early ` +
      `1980s, measured in their mid thirties, from Opportunity Insights. Life expectancy covers the ${Object.keys(gaps).filter(k => gaps[k] != null).length} zones large enough to measure it.</em>`;
    f.text = t;
    if (curFacet === 'health') bar('rich-poor life gap at forty', gp, 'lower', 'health');
    bar('how far poor children climb', mob, 'higher'); bar('credit score, poorest quarter', cr, 'higher');
    bar('behind on payments, poorest quarter', dq, 'lower'); if (curFacet !== 'health') bar('rich-poor life gap at forty', gp, 'lower', 'health');
    f.opp.unit = 'commuting zones';
  } else {
    const src = pl.type === 'county' ? US_COUNTY : US_STATE;
    const id = pl.type === 'county' ? pl.fips : pl.fips;
    if (!src) { showNotice('The US state figures did not load. Ask about a county or a city instead.'); return null; }
    const v = k => src[k] ? src[k][id] : null;
    const pos = k => src[k] ? usPos(src[k], v(k)) : null;
    const name = pl.type === 'county' ? `${pl.name} County, ${pl.stateName}` : pl.name;
    const unit = pl.type === 'county' ? 'counties' : 'states';
    const abbr = (usPlaces().states.find(s => s.fips === pl.state) || {}).abbr;
    f.opp.placeName = pl.type === 'county' && abbr ? `${pl.name} County, ${abbr}` : name; f.opp.unit = unit;
    const mob = pos('us_mobility'), ec = pos('us_econ_conn'), gi = pos('us_income_gini'), lg = pos('us_le_gap');
    if (v('us_mobility') == null) { showNotice(`The source carries no figures for ${esc(name)}.`); return null; }
    let t = `In <strong>${esc(name)}</strong>, a child from a low-income family reaches the <strong>${ord(Math.round(v('us_mobility') * 100))} ` +
      `percentile</strong> of income by adulthood. The middle of the ${mob.n} ${pl.type === 'state' && mob.n > 50 ? 'states, with DC and Puerto Rico,' : unit} is the ${ord(Math.round(mob.med * 100))}, so ` +
      `${pl.type === 'county' ? 'the county' : pl.name} is ${ord(mob.rankHigh)} of ${mob.n} for how far poor children climb.`;
    if (v('us_econ_conn') != null) t += ` People on low incomes here have <strong>${v('us_econ_conn').toFixed(2)}</strong> times as many ` +
      `better-off friends as they would if friendship ignored income (the middle ${unit.replace(/ies$/, 'y').replace(/s$/, '')} has ${ec.med.toFixed(2)}).`;
    if (v('us_le_gap') != null) {
      const gapS = `At forty the rich outlive the poor by <strong>${v('us_le_gap').toFixed(1)} years</strong> here (the middle of the ${unit}: ${lg.med.toFixed(1)}).`;
      // on the health face the gap leads
      t = curFacet === 'health' ? `In <strong>${esc(name)}</strong>, ` + gapS[0].toLowerCase() + gapS.slice(1) + ' ' + t.replace(/^In <strong>[^<]*<\/strong>, a /, 'A ') : t + ' ' + gapS;
    } else if (curFacet === 'health') t = `The source has no life expectancy by income for ${esc(name)}. ` + t;
    if (pl.sharedZone) t += ` <em>${pl.sharedN} commuting zones are called ${esc(pl.sharedZone)} and the source does not say which state each is in, so this is ${esc(pl.name)} as a whole.</em>`;
    t += ` <em>Upward mobility is for children born in the early 1980s, measured in their mid thirties (Opportunity Insights); ` +
      `friendships are from Facebook's social capital study.</em>`;
    f.text = t;
    bar('how far poor children climb', mob, 'higher'); bar('better-off friends', ec, 'higher');
    bar('income Gini', gi, 'lower', 'income'); bar('rich-poor life gap at forty', lg, 'lower', 'health');
  }
  f.opp.bars = bars;
  return f;
}
function oppAnswer(q, strict) {
  let r = norm(q);
  const usp = usPlaceFind(q);
  if (usp) return usPlaceAnswer(usp, q);
  // on the health face a question that does not ask for another reading of the layer
  // is about the gap in how long people live, which is the one thing that face shows
  if (curFacet === 'health' && !/\b(mobility|climb\w*|credit|mortgages?|delinquen\w*|behind on|owns? a home|friends?|connect\w*|mix\w*|faces|agree)\b/.test(r)) {
    q = 'how much longer do the rich live here?'; r = norm(q);
  }
  const f = { id: ++factSeq, query: q, kind: 'opp', isos: [], mode: 'opp', text: '', opp: {} };
  const zones = Object.values(US_CZ);
  const fin = OPP_FIN.find(x => x.re.test(r));
  if (fin || /\bby (their )?parents\b|\bparents.? income\b|\brich[- ]?poor gap\b|\bp25\b|\bp75\b|\bstart\w* poor\b|\bborn poor\b/.test(r)) {
    const g = fin || OPP_FIN[2];
    const pts = zones.filter(z => z[g.key + '25'] != null && z[g.key + '75'] != null)
      .map(z => ({ name: z.name, x: z[g.key + '25'], y: z[g.key + '75'] }));
    const m25 = czMed(z => z[g.key + '25']), m75 = czMed(z => z[g.key + '75']);
    const ahead = pts.filter(z => (g.key === 'delq' ? z.y < z.x : z.y > z.x)).length;
    f.opp = { kind: 'gap', label: g.label, fmt: g.fmt, pts, m25, m75, ahead };
    // Each of the three is a different kind of number and none of them reads as
    // "reaches a value of X", which is what one shared sentence was making them say.
    const lead = `In the middle commuting zone of ${pts.length}, `;
    f.text = g.key === 'cr'
      ? lead + `children whose parents were in the poorest quarter have a credit score of ` +
        `<strong>${g.fmt(m25)}</strong> by their mid thirties. Children of the richest quarter have ` +
        `<strong>${g.fmt(m75)}</strong>. The richer children score higher in ${ahead} of the ${pts.length} zones.`
      : g.key === 'delq'
      ? lead + `<strong>${g.fmt(m25)}</strong> of children whose parents were in the poorest quarter have ` +
        `fallen ninety days behind on a payment by their mid thirties, against <strong>${g.fmt(m75)}</strong> ` +
        `of children of the richest quarter. The poorer children are further behind in ${ahead} of the ` +
        `${pts.length} zones.`
      : lead + `children whose parents were in the poorest quarter carry <strong>${g.fmt(m25)}</strong> of ` +
        `mortgage debt by their mid thirties, against <strong>${g.fmt(m75)}</strong> for children of the ` +
        `richest quarter. <em>Read that as who holds a mortgage at all rather than how large one is: a ` +
        `mortgage in the United States runs well over a hundred thousand dollars, so an average of ` +
        `${g.fmt(m25)} across a whole group is mostly counting how many of them have one.</em>`;
    return f;
  }
  // The whole point of the cube, asked inside one country. The US is the only place
  // where all four faces are measured at the same fine geography, so it is the only
  // place the atlas can test whether they agree with each other. They mostly do not.
  const FACE_COLS = [
    { k: 'us_mobility',    lab: 'children climbing', face: 'opportunity', fmt: v => Math.round(v * 100) + 'th' },
    { k: 'us_econ_conn',   lab: 'who you know',      face: 'opportunity', fmt: v => v.toFixed(2) },
    { k: 'us_income_gini', lab: 'income gap',        face: 'income',      fmt: v => v.toFixed(2) },
    { k: 'us_house_value', lab: 'house value',       face: 'wealth',      fmt: v => '$' + Math.round(v).toLocaleString('en-US') },
    { k: 'us_le_gap',      lab: 'rich-poor life gap at 40', face: 'health', fmt: v => v.toFixed(1) + 'y' },
  ];
  if (/\bfaces\b|\bagree\b|\bfour\b|\ball of (them|it)\b|\btogether\b|\bsame places\b|\boverlap\b|\bsame counties\b|\bone country\b/.test(r)) {
    if (!US_COUNTY || !US_COUNTY.us_mobility) { showNotice('The county layer is not loaded.'); return null; }
    const cols = FACE_COLS.filter(c => US_COUNTY[c.k] && Object.keys(US_COUNTY[c.k]).length > 200);
    if (cols.length < 3) return null;
    const grid = [], ns = [];
    for (const a of cols) {
      const row = [], nrow = [];
      for (const b2 of cols) {
        if (a.k === b2.k) { row.push(null); nrow.push(0); continue; }
        const A = US_COUNTY[a.k], B = US_COUNTY[b2.k];
        const pts = [];
        for (const c in A) { const y = B[c]; if (y == null || A[c] == null) continue; pts.push({ x: A[c], y }); }
        const rr = pts.length > 100 ? pearson(pts) : null;
        row.push(rr); nrow.push(pts.length);
      }
      grid.push(row); ns.push(nrow);
    }
    const at = (a, b2) => grid[cols.findIndex(c => c.k === a)][cols.findIndex(c => c.k === b2)];
    const health = cols.findIndex(c => c.k === 'us_le_gap');
    const worst = health >= 0
      ? Math.max(...grid[health].filter(v => v != null).map(Math.abs)) : null;
    f.opp = { kind: 'faces', cols, grid, ns };
    f.text = `The United States is the only country where all four faces are measured at the same ` +
      `fine geography, so it is the only place the atlas can ask whether they agree. Across roughly ` +
      `three thousand counties, mostly they do not. A poor child climbs furthest where they grow up ` +
      `around better-off people (<strong>${at('us_mobility', 'us_econ_conn').toFixed(2)}</strong>), and ` +
      `climbs less far where the local income gap is wide ` +
      `(<strong>${at('us_mobility', 'us_income_gini').toFixed(2)}</strong>, the minus sign meaning a ` +
      `wider gap goes with a shorter climb). ` +
      (worst != null ? `The rich-poor gap in how long people live is tied to <strong>none of it</strong>: ` +
        `its strongest link to anything else here is ${worst.toFixed(2)}. A county can share out its ` +
        `income evenly and still bury its poor a decade early.` : '');
    return f;
  }
  // any two of those five held against each other, at county level
  {
    const pick = [];
    for (const c of FACE_COLS) {
      const re = c.k === 'us_mobility' ? /\bmobilit\w*|\bclimb\w*|\bmove up\b/
        : c.k === 'us_econ_conn' ? /\bconnect\w*|\bknow\w*|\bfriend\w*/
        : c.k === 'us_income_gini' ? /\bincome (gap|inequalit\w*|gini)\b|\bgini\b/
        : c.k === 'us_house_value' ? /\bhouse\w*|\bhome\w*|\bproperty\b/
        : /\blife (gap|expectanc\w*)\b|\bhow long\b|\blive longer\b|\bdie\b|\bhealth gap\b/;
      if (re.test(r) && US_COUNTY && US_COUNTY[c.k]) pick.push(c);
    }
    const keys = pick.map(c => c.k).sort().join('|');
    if (pick.length >= 2 && keys !== 'us_econ_conn|us_mobility') {
      const [X, Y] = pick.slice(0, 2);
      const A = US_COUNTY[X.k], B = US_COUNTY[Y.k];
      const nameOf = c => (US_NAMES && US_NAMES[c]) ? US_NAMES[c].split(',')[0] : c;
      const pts = [];
      for (const c in A) { if (B[c] == null || A[c] == null) continue; pts.push({ name: nameOf(c), x: A[c], y: B[c] }); }
      if (pts.length > 100) {
        const rr = pearson(pts);
        f.opp = { kind: 'pair', x: X, y: Y, pts, r: rr };
        // a negative correlation is two things moving apart, and calling that "moving
        // together closely" says the opposite of what the number says
        const strength = Math.abs(rr) > 0.5 ? 'closely' : Math.abs(rr) > 0.25 ? 'loosely' : 'barely';
        const how = Math.abs(rr) < 0.15 ? `have little to do with each other`
          : rr < 0 ? `pull against each other <strong>${strength}</strong>: where one is high the other ` +
              `tends to be low`
          : `move together <strong>${strength}</strong>`;
        f.text = `Across <strong>${pts.length}</strong> US counties, ${X.lab} and ${Y.lab} ${how}. ` +
          `r = <strong>${rr.toFixed(2)}</strong>. ` +
          `<em>Two of the atlas's faces, measured in the same places, which is something it cannot do ` +
          `anywhere outside this one country.</em>`;
        return f;
      }
    }
  }

  // Who a poor child grows up around. County level, not commuting zone: this is how
  // it is published, us_county.json already holds mobility for 3208 counties, and the
  // only crosswalk in the repo covers half of them, skewed to the large ones.
  if (/\bconnect\w*|\bknow\w*|\bfriend\w*|\bsocial capital\b|\bnetworks?\b|\bmix\w*\b|\bsegregat\w*\b|\bexposure\b|\bbias\b|\bbetter[- ]off people\b|\bgrow up around\b|\bwho they meet\b/.test(r)) {
    if (!US_COUNTY || !US_COUNTY.us_econ_conn) { showNotice('The social capital layer is not loaded.'); return null; }
    const mob = US_COUNTY.us_mobility || {}, ec = US_COUNTY.us_econ_conn || {};
    const ex = US_COUNTY.us_exposure || {}, bi = US_COUNTY.us_bias || {};
    const nameOf = c => (US_NAMES && US_NAMES[c]) ? US_NAMES[c].split(',')[0] : c;
    // "is it that they are not here, or that nobody mixes": the split underneath the
    // headline number, and the more interesting half of it
    const wantsSplit = /\bmix\w*|\bsegregat\w*|\bexposure\b|\bbias\b|\bwhy\b|\bsplit\b|\bapart\b/.test(r);
    if (wantsSplit && Object.keys(ex).length) {
      const pts = [];
      for (const c in ex) {
        if (bi[c] == null || mob[c] == null) continue;
        pts.push({ id: c, name: nameOf(c), x: ex[c], y: bi[c], mob: mob[c] });
      }
      if (pts.length < 100) return null;
      const med = a => { const v = a.slice().sort((m, n2) => m - n2); return v[Math.floor(v.length / 2)]; };
      const mx = med(pts.map(q => q.x)), my = med(pts.map(q => q.y));
      const rEx = pearson(pts.map(q => ({ x: q.x, y: q.mob })));
      const rBi = pearson(pts.map(q => ({ x: q.y, y: q.mob })));
      const rXY = pearson(pts.map(q => ({ x: q.x, y: q.y })));
      const quad = (lo, hi) => pts.filter(q => (lo ? q.x < mx : q.x >= mx) && (hi ? q.y >= my : q.y < my));
      const mm = a => a.length ? a.reduce((t, q) => t + q.mob, 0) / a.length : null;
      f.opp = { kind: 'mix', pts, mx, my };
      f.text = `Two things have to happen before a poor child knows anyone richer. Higher-income ` +
        `people have to be around at all, and once they are, people have to actually mix. ` +
        `Across <strong>${pts.length}</strong> US counties those two barely move together ` +
        `(r = ${rXY.toFixed(2)}), so a place can fail at either. Being around them tracks climbing at ` +
        `<strong>r = ${rEx.toFixed(2)}</strong>; not mixing tracks it at <strong>${rBi.toFixed(2)}</strong>. ` +
        `Where both go well children reach the <strong>${Math.round(mm(quad(false, false)) * 100)}th</strong> ` +
        `percentile on average; where neither does, the <strong>${Math.round(mm(quad(true, true)) * 100)}th</strong>.`;
      return f;
    }
    const pts = [];
    for (const c in ec) { if (mob[c] == null) continue; pts.push({ name: nameOf(c), x: ec[c], y: mob[c] }); }
    if (pts.length < 100) return null;
    const rr = pearson(pts.map(q => ({ x: q.x, y: q.y })));
    const sorted = pts.slice().sort((a, b2) => a.x - b2.x);
    const lo = sorted.slice(0, Math.floor(sorted.length / 5)), hi = sorted.slice(-Math.floor(sorted.length / 5));
    const avg = a => a.reduce((t, q) => t + q.y, 0) / a.length;
    f.opp = { kind: 'conn', pts, r: rr };
    f.text = `Across <strong>${pts.length}</strong> US counties, how many higher-income friends a ` +
      `low-income child has predicts how far they climb better than anything else in this atlas: ` +
      `<strong>r = ${rr.toFixed(2)}</strong>. In the fifth of counties where poor children know the ` +
      `fewest richer people they reach the <strong>${Math.round(avg(lo) * 100)}th</strong> percentile ` +
      `by adulthood; in the fifth where they know the most, the ` +
      `<strong>${Math.round(avg(hi) * 100)}th</strong>. ` +
      `<em>A correlation across places, not a mechanism inside one.</em>`;
    return f;
  }

  // Health, inside the one layer that can carry it. Life expectancy at 40 by household
  // income quarter, per zone, which is a gap between people in the same place rather
  // than an average over a country. The global health face stays closed for want of
  // anything comparable across borders.
  if (/\blive\b|\blives\b|\blife expect\w*|\bhow long\b|\bdie\b|\bdying\b|\blongevit\w*|\bhealth\b/.test(r)) {
    const pts = zones.filter(z => z.leq1M != null && z.leq4M != null && z.leq1F != null && z.leq4F != null)
      .map(z => ({ name: z.name, m1: z.leq1M, m4: z.leq4M, f1: z.leq1F, f4: z.leq4F, mob: z.mob }));
    if (pts.length < 20) { showNotice('The life expectancy layer is not loaded.'); return null; }
    const med = a => { const v = a.slice().sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
    const gm = med(pts.map(p => p.m4 - p.m1)), gf = med(pts.map(p => p.f4 - p.f1));
    const poor = pts.map(p => p.m1);
    const lo = pts.reduce((a, b) => a.m1 < b.m1 ? a : b), hi = pts.reduce((a, b) => a.m1 > b.m1 ? a : b);
    const withMob = pts.filter(p => p.mob != null);
    const rr = pearson(withMob.map(p => ({ x: p.m1, y: p.mob })));
    f.opp = { kind: 'life', pts, gm, gf };
    // These are ages reached, not years remaining: the source measures from forty, so a
    // value of 76 means a forty-year-old is expected to reach seventy-six. Saying "lives
    // to 76" keeps that straight; saying "life expectancy is 76" would not, because the
    // country figures elsewhere on this page are measured from birth.
    f.text = `Across <strong>${pts.length}</strong> US commuting zones, a man of forty in the poorest ` +
      `quarter of households lives <strong>${gm.toFixed(1)} years</strong> less than one in the richest ` +
      `quarter of the same zone. For women it is <strong>${gf.toFixed(1)} years</strong>. ` +
      `Where you live matters about as much: a poor man of forty lives to ` +
      `<strong>${lo.m1.toFixed(1)}</strong> in ${esc(lo.name)} and to <strong>${hi.m1.toFixed(1)}</strong> ` +
      `in ${esc(hi.name)}, a spread of ${(hi.m1 - lo.m1).toFixed(1)} years for the same income group.` +
      (rr != null ? ` <em>Poor men live longer in the zones where poor children climb furthest ` +
        `(r = ${rr.toFixed(2)} against upward mobility, ${withMob.length} zones).</em>` : '');
    return f;
  }
  const cov = /\bpoverty\b/.test(r) ? { key: 'pov', label: 'poverty rate' }
    : /\brent\b|\bhousing cost\b/.test(r) ? { key: 'rent', label: 'two-bed rent' }
    : /\bincome\b|\bagainst\b|\bvs\b|\btrack|\bcorrelat/.test(r) ? { key: 'inc', label: 'median income' } : null;
  if (cov) {
    const pts = zones.filter(z => z.mob != null && z[cov.key] != null).map(z => ({ name: z.name, x: z[cov.key], y: z.mob }));
    const rr = pearson(pts);
    f.opp = { kind: 'scatter', covLabel: cov.label, pts };
    f.text = `Across ${pts.length} US commuting zones, upward mobility is ${rr >= 0 ? 'higher' : 'lower'} where ` +
      `${cov.label} is higher. <em>r = ${rr.toFixed(2)}</em>`;
    return f;
  }
  const mobWords = /\bmobilit\w*|\bclimb\w*|\bmove up\b|\bopportunit\w*|\brank\w*|\bbest\b|\bworst\b|\bhighest\b|\blowest\b|\bwhere\b|\bzones?\b|\bgrow up poor\b|\bearn later\b|\bborn poor\b/.test(r);
  if (strict && !mobWords) return null;   // a question that doesn't translate to this facet drops, it doesn't get faked
  if (!strict && !mobWords) {
    showNotice('Opportunity is the US layer. Ask about climbing, about credit, mortgages, delinquency or ' +
      'how long people live by their parents\' income, or about who a poor child grows up around.');
    return null;
  }
  const ranked = zones.filter(z => z.mob != null).sort((a, b) => b.mob - a.mob);
  const top = ranked[0], bot = ranked[ranked.length - 1];
  f.opp = { kind: 'mobility', ranked };
  f.text = `Across ${ranked.length} US commuting zones, the income percentile a child from a low-income family reaches by adulthood ` +
    `runs from the <strong>${ord(Math.round(bot.mob * 100))}</strong> in ${esc(bot.name)} to the <strong>${ord(Math.round(top.mob * 100))}</strong> in ${esc(top.name)}.`;
  return f;
}
// a logged dollar axis labelled at round values, not at every minor decade tick
const HOUSE_TICKS = { tickvals: [2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 2e6], ticktext: ['$20k', '$50k', '$100k', '$200k', '$500k', '$1m', '$2m'] };
function drawOpp(f) {
  const el = document.getElementById('chart'), title = document.getElementById('chart-title'), src = document.getElementById('chart-src');
  // amber is the opportunity face, not the US layer: a chart of how long people live is
  // health and wears rose, a county Gini is income and wears teal
  const o = f.opp, AM = FACET_HEX.opportunity, FC = face => FACET_HEX[face] || AM;
  if (o.kind === 'place') {
    const b = o.bars.slice().reverse();
    const narrow = el.clientWidth < 520;
    const wrap = t => { if (!narrow) return t; const w = t.split(' '), out = ['']; for (const x of w) {
      if ((out[out.length - 1] + ' ' + x).trim().length > 16) out.push(x); else out[out.length - 1] = (out[out.length - 1] + ' ' + x).trim(); }
      return out.join('<br>'); };
    Plotly.react(el, [{ type: 'bar', orientation: 'h', x: b.map(r => r.pct), y: b.map(r => wrap(r.label)),
      marker: { color: b.map(r => FC(r.face)) }, text: b.map(r => `above ${r.pct}%`), textposition: 'outside', cliponaxis: false,
      hovertemplate: '%{y}: higher than %{x}% of ' + o.unit + '<extra></extra>' }],
      Object.assign({}, BASE_LAYOUT, { margin: { t: 10, r: 60, b: 44, l: 200 },
        xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { range: [0, 100], autorange: false, ticksuffix: '%',
          title: { text: narrow ? 'share it is higher than' : 'share of ' + o.unit + ' this one is higher than', font: { size: 11 } } }),
        yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { type: 'category', autorange: true }),
        shapes: [{ type: 'line', x0: 50, x1: 50, y0: -0.5, y1: b.length - 0.5, line: { color: cssVar('--ink-3', '#999'), width: 1, dash: 'dot' } }] }), CFG);
    title.textContent = `${o.placeName}, against every other one of the ${o.unit}`;
    src.textContent = `Each bar is the share of ${o.unit} this place is higher than; the dotted line is the middle. Higher is ` +
      `better for climbing, friends and credit; lower is better for the life gap, the income Gini and falling behind on payments. ` +
      `Source: Opportunity Insights and the Social Capital Atlas.`;
    return;
  }
  if (o.kind === 'gap') {
    const all = o.pts.flatMap(p => [p.x, p.y]), lo = Math.min(...all), hi = Math.max(...all);
    Plotly.react(el, [
      { x: [lo, hi], y: [lo, hi], mode: 'lines', line: { color: '#cbd5e1', width: 1, dash: 'dash' }, hoverinfo: 'skip' },
      { x: o.pts.map(p => p.x), y: o.pts.map(p => p.y), text: o.pts.map(p => p.name), mode: 'markers',
        marker: { color: AM, size: 6, opacity: dotOp(0.45) }, hovertemplate: '%{text}<extra></extra>' },
    ], Object.assign({}, BASE_LAYOUT, {
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { title: 'parents in the bottom quarter', type: 'linear', autorange: true }),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { title: 'parents in the top quarter', type: 'linear', autorange: true }),
    }), CFG);
    title.textContent = `${cap(o.label)} by parents' income, across commuting zones`;
    src.textContent =
      `Each dot is one of ${o.pts.length} commuting zones, placed by how children from the poorest ` +
      `quarter of families there turned out against how children from the richest quarter did. On the ` +
      `dashed line the two groups come out the same. Everyone counted here was born between 1978 and ` +
      `1983 and was in their late thirties when this was measured in 2020, so it is one cohort at one ` +
      `moment and not a trend. Estimates are shrunk toward the national mean, which pulls small zones ` +
      `in and makes the spread here narrower than the raw spread. ` +
      (o.label === 'mortgage balance'
        ? `The balance is an average across everyone in the group, so a zone reading low is telling you ` +
          `that few of them hold a mortgage rather than that their mortgages are small. `
        : '') +
      `Source: Chetty et al, the Opportunity Atlas, linked tax and credit-bureau records.`;
  } else if (o.kind === 'faces') {
    // a correlation matrix, which is the only honest way to show "do these agree":
    // a scatter can carry two, and the claim is about all of them at once
    // on a phone five columns get about 45 pixels each, and two-decimal figures at full
    // size ran into each other ("-0.50.050.05"): one decimal, smaller, and short labels
    const narrowH = el.clientWidth < 520;
    const SHORT_LAB = { 'children climbing': 'climbing', 'who you know': 'who you know', 'income gap': 'income gap',
      'house value': 'house value', 'rich-poor life gap at 40': 'life gap' };
    const lab = o.cols.map(c => narrowH ? (SHORT_LAB[c.lab] || c.lab) : c.lab);
    const txt = o.grid.map(row => row.map(v => v == null ? '' : v.toFixed(narrowH ? 1 : 2)));
    Plotly.react(el, [{
      type: 'heatmap', x: lab, y: lab, z: o.grid,
      zmin: -1, zmax: 1, xgap: 3, ygap: 3,
      colorscale: [[0, metricColor('life_exp')], [0.5, cssVar('--surface', '#ffffff')], [1, metricColor('wealth_top1')]],
      showscale: true,
      colorbar: { thickness: 9, len: 0.6, tickfont: { size: 9 },
        tickvals: [-1, 0, 1], ticktext: ['opposite', 'unrelated', 'together'] },
      hovertemplate: '%{y} and %{x}<br>r = %{z:.2f}<extra></extra>',
      hoverongaps: false,
    }], Object.assign({}, BASE_LAYOUT, {
      margin: narrowH ? { t: 8, r: 8, b: 70, l: 78 } : { t: 12, r: 12, b: 92, l: 132 },
      annotations: o.grid.flatMap((row, i) => row.map((v, j) => ({
        x: lab[j], y: lab[i], text: txt[i][j], showarrow: false,
        font: { size: narrowH ? 9.5 : 11.5, color: v == null ? 'rgba(0,0,0,0)'
          : Math.abs(v) > 0.55 ? '#ffffff' : cssVar('--ink', '#0a0a0a') },
      }))),
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { type: 'category', autorange: true,
        tickangle: -35, tickfont: { size: 10.5 }, gridcolor: 'rgba(0,0,0,0)' }),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { type: 'category', autorange: 'reversed',
        tickfont: { size: 10.5 }, gridcolor: 'rgba(0,0,0,0)' }),
    }), CFG);
    title.textContent = 'Do the faces agree, inside one country?';
    src.textContent =
      `Every pair of measures held against each other across US counties. Blue means they rise ` +
      `together, rose means one rises as the other falls, pale means they have nothing to do with ` +
      `each other. Between ${Math.min(...o.ns.flat().filter(Boolean)).toLocaleString('en-US')} and ` +
      `${Math.max(...o.ns.flat()).toLocaleString('en-US')} counties carry each pair; the life gap is ` +
      `published for the fewest. This is the atlas's own claim tested at a second scale: the four ` +
      `faces disagree between countries, and they disagree between counties inside one of them. ` +
      `Sources: Opportunity Insights, the Social Capital Atlas, the Health Inequality Project, ` +
      `and the American Community Survey.` +
      o.cols.map(c => droppedNote(c.k)).join('');
  } else if (o.kind === 'pair') {
    const sx = o.x.k === 'us_mobility', sy = o.y.k === 'us_mobility';
    Plotly.react(el, [{
      type: 'scatter', mode: 'markers',
      x: o.pts.map(q => sx ? q.x * 100 : q.x), y: o.pts.map(q => sy ? q.y * 100 : q.y),
      text: o.pts.map(q => q.name),
      marker: { color: FC(o.y.face), size: 5, opacity: dotOp(0.4) },
      hovertemplate: '%{text}<br>%{x}<br>%{y}<extra></extra>',
    }], Object.assign({}, BASE_LAYOUT, {
      margin: { t: 16, r: 18, b: 46, l: 62 },
      // house values run from tens of thousands to millions: on a straight axis a few
      // coastal counties flatten every other dot onto the floor, so that axis is logged
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { type: o.x.k === 'us_house_value' ? 'log' : 'linear', autorange: true,
        ...(o.x.k === 'us_house_value' ? HOUSE_TICKS : {}),
        title: { text: cap(o.x.lab) + (sx ? ', income percentile' : o.x.k === 'us_house_value' ? ', log scale' : ''), font: { size: 11 } } }),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { type: o.y.k === 'us_house_value' ? 'log' : 'linear', autorange: true,
        ...(o.y.k === 'us_house_value' ? HOUSE_TICKS : {}),
        title: { text: cap(o.y.lab) + (sy ? ', income percentile' : o.y.k === 'us_house_value' ? ', log scale' : ''), font: { size: 11 } } }),
    }), CFG);
    title.textContent = `${cap(o.x.lab)} and ${o.y.lab}, by county`;
    src.textContent =
      `One dot per US county, ${o.pts.length.toLocaleString('en-US')} of them. r = ${o.r.toFixed(2)}. ` +
      `These are two different faces of the cube measured in the same places, which is only possible ` +
      `in this one country. A correlation across counties, not a mechanism inside any of them. ` +
      `Sources: Opportunity Insights, the Social Capital Atlas, the Health Inequality Project, ` +
      `and the American Community Survey.` +
      droppedNote(o.x.k) + droppedNote(o.y.k);
  } else if (o.kind === 'conn') {
    Plotly.react(el, [{
      type: 'scatter', mode: 'markers',
      x: o.pts.map(q => q.x), y: o.pts.map(q => q.y * 100), text: o.pts.map(q => q.name),
      marker: { color: AM, size: 5, opacity: dotOp(0.4) },
      hovertemplate: '%{text}<br>connectedness %{x:.2f}<br>reaches the %{y:.0f}th percentile<extra></extra>',
    }], Object.assign({}, BASE_LAYOUT, {
      margin: { t: 16, r: 18, b: 46, l: 56 },
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { type: 'linear', autorange: true,
        title: { text: 'how many of a poor child\u2019s friends are better off', font: { size: 11 } } }),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { type: 'linear', autorange: true,
        title: { text: 'where they end up, income percentile', font: { size: 11 } } }),
    }), CFG);
    title.textContent = `Who you grow up around, and where you end up`;
    src.textContent =
      `One dot per US county. Across is economic connectedness: among a low-income person\u2019s ` +
      `friends, the share who are high-income, scaled so 1 means no sorting by income at all. Up is ` +
      `the income percentile a child with poor parents reaches by their mid thirties. r = ${o.r.toFixed(2)}, ` +
      `the strongest relationship in this atlas. It is a correlation across places and not a mechanism ` +
      `inside one: the same counties differ in a hundred other ways. ` +
      `Source: Chetty et al, the Social Capital Atlas and Opportunity Insights.`;
  } else if (o.kind === 'mix') {
    // the tails are thin and stretch the ramp flat, so the colour runs over the middle
    // ninety per cent and the few beyond it sit at the ends
    const mobs = o.pts.map(q => q.mob).sort((a2, b2) => a2 - b2);
    const band = [mobs[Math.floor(mobs.length * 0.05)], mobs[Math.floor(mobs.length * 0.95)]];
    Plotly.react(el, [{
      type: 'scatter', mode: 'markers',
      x: o.pts.map(q => q.x), y: o.pts.map(q => q.y),
      text: o.pts.map(q => q.name), customdata: o.pts.map(q => Math.round(q.mob * 100)),
      marker: { size: 5.5, opacity: 0.72, color: o.pts.map(q => q.mob),
        colorscale: [[0, shade(AM, -0.62)], [1, shade(AM, 0.45)]], cmin: band[0], cmax: band[1],
        colorbar: { title: { text: 'where a poor<br>child ends up', font: { size: 10 } },
          thickness: 9, len: 0.62, tickfont: { size: 9 },
          tickvals: band, ticktext: ['lower', 'higher'] } },
      hovertemplate: '%{text}<br>exposure %{x:.2f}<br>friending bias %{y:.2f}' +
        '<br>reaches the %{customdata}th percentile<extra></extra>',
    }], Object.assign({}, BASE_LAYOUT, {
      margin: { t: 22, r: 18, b: 46, l: 58 },
      shapes: [
        { type: 'line', xref: 'x', yref: 'paper', x0: o.mx, x1: o.mx, y0: 0, y1: 1,
          line: { color: 'rgba(128,132,140,0.45)', width: 1, dash: 'dot' } },
        { type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: o.my, y1: o.my,
          line: { color: 'rgba(128,132,140,0.45)', width: 1, dash: 'dot' } },
      ],
      annotations: [
        { x: 0.99, y: 0.02, xref: 'paper', yref: 'paper', xanchor: 'right', yanchor: 'bottom',
          text: 'they are here,<br>and people mix', showarrow: false, align: 'right',
          font: { size: 10, color: cssVar('--ink-3', '#999999') } },
        { x: 0.01, y: 0.98, xref: 'paper', yref: 'paper', xanchor: 'left', yanchor: 'top',
          text: 'they are not here,<br>and nobody mixes', showarrow: false, align: 'left',
          font: { size: 10, color: cssVar('--ink-3', '#999999') } },
      ],
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { type: 'linear', autorange: true,
        title: { text: 'are better-off people around at all', font: { size: 11 } } }),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { type: 'linear', autorange: true,
        title: { text: 'how much less people mix', font: { size: 11 } } }),
    }), CFG);
    title.textContent = 'Not here, or here and not mixing';
    src.textContent =
      `One dot per US county, darker where poor children climb further. Across: how many better-off ` +
      `people a low-income person meets in the settings they move through. Up: friending bias, how ` +
      `much less likely a friendship across the income line is than it would be if people mixed at ` +
      `random, so higher means less mixing. The dotted lines are the middle county on each. ` +
      `The two are close to independent, which is the point: a single connectedness number cannot ` +
      `tell you which of the two a place is failing at, and they call for different things. ` +
      `Source: Chetty et al, the Social Capital Atlas and Opportunity Insights.`;
  } else if (o.kind === 'life') {
    const all = o.pts.flatMap(p => [p.m1, p.m4, p.f1, p.f4]);
    const lo = Math.min(...all) - 0.6, hi = Math.max(...all) + 0.6;
    const series = (key1, key4, name, colour, op) => ({
      type: 'scatter', mode: 'markers', name,
      x: o.pts.map(p => p[key1]), y: o.pts.map(p => p[key4]), text: o.pts.map(p => p.name),
      marker: { color: colour, size: 6, opacity: op },
      hovertemplate: '%{text}<br>poorest quarter %{x:.1f}<br>richest quarter %{y:.1f}<extra></extra>',
    });
    Plotly.react(el, [
      { x: [lo, hi], y: [lo, hi], mode: 'lines', showlegend: false,
        line: { color: '#cbd5e1', width: 1, dash: 'dash' }, hoverinfo: 'skip' },
      series('f1', 'f4', 'women', shade(FC('health'), -0.35), 0.5),
      series('m1', 'm4', 'men', FC('health'), 0.55),
    ], Object.assign({}, BASE_LAYOUT, {
      showlegend: true, legend: { orientation: 'h', y: 1.14, font: { size: 11 } },
      margin: { t: 14, r: 16, b: 44, l: 54 },
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { range: [lo, hi], autorange: false,
        title: { text: 'life expectancy at 40, poorest quarter', font: { size: 11 } } }),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { range: [lo, hi], autorange: false,
        title: { text: 'richest quarter', font: { size: 11 } } }),
    }), CFG);
    title.textContent = 'How long the rich and the poor live, by commuting zone';
    src.textContent =
      `Each dot is one commuting zone, plotted by the age its poorest quarter reaches against the ` +
      `age its richest quarter reaches. On the dashed line they would live the same length of time; ` +
      `nowhere does. Both axes are life expectancy measured from age forty, so 76 means a ` +
      `forty-year-old is expected to reach seventy-six, and these numbers are not the ones you see ` +
      `quoted for a whole country, which are measured from birth and run lower. Race-adjusted, so ` +
      `zones are compared on something other than who lives in them. ` +
      `Median gap ${o.gm.toFixed(1)} years for men and ${o.gf.toFixed(1)} for ` +
      `women. Source: Chetty et al, the Health Inequality Project, deaths 2001 to 2014. This is one ` +
      `country: no source publishes the same gap in a form that compares across borders.`;
  } else if (o.kind === 'scatter') {
    Plotly.react(el, [{ x: o.pts.map(p => p.x), y: o.pts.map(p => p.y), text: o.pts.map(p => p.name),
      mode: 'markers', marker: { color: AM, size: 6, opacity: dotOp(0.45) }, hovertemplate: '%{text}<extra></extra>' }],
      Object.assign({}, BASE_LAYOUT, {
        xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { title: o.covLabel, type: 'linear', autorange: true }),
        yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { title: 'upward mobility (rank at p25)', type: 'linear', autorange: true }),
      }), CFG);
    title.textContent = `Upward mobility and ${o.covLabel}, by commuting zone`;
    src.textContent = 'Each dot is a US commuting zone. Source: Opportunity Insights.';
  } else {
    const rows = o.ranked.slice(-8).concat(o.ranked.slice(0, 8));
    Plotly.react(el, [{ type: 'bar', orientation: 'h', y: rows.map(z => z.name), x: rows.map(z => Math.round(z.mob * 100)),
      marker: { color: rows.map((z, i) => i < 8 ? '#e0c194' : AM) },
      text: rows.map(z => Math.round(z.mob * 100)), textposition: 'outside', textfont: { size: 11, color: cssVar('--ink-2', '#555555') }, hoverinfo: 'skip' }],
      Object.assign({}, BASE_LAYOUT, {
        margin: { t: 8, r: 26, b: 40, l: 150 },
        xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { title: 'income percentile a poor kid reaches', type: 'linear', autorange: true }),
        yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { type: 'category', autorange: true }),
      }), CFG);
    title.textContent = 'Upward mobility, highest and lowest commuting zones';
    src.textContent =
      'Where a child born to parents at the 25th percentile of the national income distribution ends ' +
      'up themselves, as a percentile of their own generation. 50 would mean landing in the middle of ' +
      'the country; nowhere reaches it on average. Everyone counted was born between 1978 and 1983 and ' +
      'was measured in their mid thirties, so this is one cohort at one moment rather than a trend, ' +
      'and it describes where children raised in a zone ended up rather than what the zone does to ' +
      'anyone arriving now. Estimates are shrunk toward the national mean, which pulls the small zones ' +
      'in. Source: Chetty, Hendren, Kline and Saez, the Opportunity Atlas, from linked tax records.';
  }
}
