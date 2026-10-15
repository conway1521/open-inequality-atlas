'use strict';
// answering: the address bar, and every reading the atlas can give for countries.
// one of eight files loaded in order by index.html; they share one scope, so a
// function here can be used by any of them once the page has loaded

/* ── answering ─────────────────────────────────────────────────────── */
let factSeq = 0;
const chain = [];
function poolNote() { return ctx.pool ? ` <em>among ${ctx.pool.label}</em>` : ''; }

// the one editable cell: its coordinates are what's on screen. chat and the accordion
// both write to it, and runCell rebuilds the answer keeping every other coordinate.
// time is three-state: unset, one moment (a chosen year), or a run of years
const MAX_PLACES = 6;
const cell = { places: [], scope: null, span: null, year: null, since: null, until: null,
  against: null, form: null, view: null, raw: null, asked: null };
// one place is the ordinary case and most readings can only take one, so `place` is
// kept as the first of `places`. writing it collapses the selection to that one country.
Object.defineProperty(cell, 'place', {
  enumerable: true,
  get() { return this.places[0] || null; },
  set(v) { this.places = v ? [v] : []; },
});
function resetCell() { cell.places = []; cell.scope = null; cell.span = null; cell.year = null;
  cell.since = null; cell.until = null; cell.against = null; cell.form = null; cell.view = null;
  cell.raw = null; cell.asked = null; }
// the outer years the current reading could possibly run between: one country's own
// span if a place is set, otherwise the widest span the measure carries anywhere
function spanBounds(metric) {
  // a reading that brings its own measure is bounded by that measure's years, not by
  // whichever measure the face happens to be showing: the median runs 1969 to 2017 in
  // Britain while the income shares run 1980 to 2021, and the slider has to say which
  // the composition layer is its own file, not a series, so it names its own bounds
  if (cell.view === 'have' && SCF_NW) {
    const y = SCF_NW.years;
    return { lo: y[0], hi: y[y.length - 1] };
  }
  if (cell.view === 'weather' && HFCS_RES) {
    const w = HFCS_RES.waves;
    return { lo: w[0], hi: w[w.length - 1] };
  }
  if (cell.view === 'underwater' && HFCS_NEG) {
    const w = HFCS_NEG.waves;
    return { lo: w[0], hi: w[w.length - 1] };
  }
  if (cell.view === 'made' && US_COMP) {
    const y = US_COMP.years;
    return { lo: y[0], hi: y[y.length - 1] };
  }
  const own = cell.view && VIEW_DEF[cell.view] && VIEW_DEF[cell.view].spanOf;
  const key = metric || own || facetIneqDefault();
  if (cell.place) {
    const ys = seriesYears(cell.place, key);
    if (ys.length) return { lo: ys[0], hi: ys[ys.length - 1] };
  }
  const ser = SERIES[key] || {};
  let lo = Infinity, hi = -Infinity;
  for (const i in ser) {
    const a = ser[i];
    if (a && a.length) { lo = Math.min(lo, a[0].year); hi = Math.max(hi, a[a.length - 1].year); }
  }
  return isFinite(lo) ? { lo, hi } : null;
}
// the years that metric actually carries for that country
function seriesYears(iso, metric) {
  if (!iso) return [];
  const s = seriesOf(metric || facetIneqDefault(), iso) || [];
  return s.map(d => d.year);
}
/* ── the address bar ──────────────────────────────────────────────────
   The URL carries the answer on screen, so the address bar can be copied, a reload
   comes back to the same place, and Back steps to the answer before. It used to hold
   the question's label and nothing else ("what the bottom half owns", no country),
   and it was wiped on arrival, so every shared link opened on a blank cube. */
let restoring = false;
function urlState() {
  const last = chain[chain.length - 1];
  if (!last) return '';
  const s = new URLSearchParams();
  s.set('face', curFacet);
  const m = facetMeasure(curFacet);
  if (m && facetMeasureIdx[curFacet]) s.set('m', m);
  if (cell.scope) s.set('among', cell.scope);
  // a free-text reading and the opportunity face are rebuilt from the words; the rest
  // from the folds, which is what the accordion edits
  if (onUs() || RAW_KINDS.includes(last.kind) || last.kind === 'opp') {
    s.set('q', last.query || '');
    return s.toString();
  }
  if (cell.places.length) s.set('place', cell.places.join(','));
  if (cell.view) s.set('view', cell.view);
  if (cell.form) s.set('form', cell.form);
  if (cell.against) s.set('vs', cell.against);
  if (cell.span === 'run') s.set('t', ['run', cell.since || '', cell.until || ''].join(':'));
  else if (cell.span === 'moment') s.set('t', 'moment:' + (cell.year || ''));
  return s.toString();
}
function syncUrl() {
  if (restoring) return;
  const h = urlState();
  const want = h ? '#' + h : '';
  if (want === location.hash) return;
  history.pushState(null, '', location.pathname + want);
}
// rebuild an answer from a link. anything the link names that the atlas does not know
// is said out loud rather than dropped
function restoreFromUrl() {
  const raw = location.hash.slice(1);
  if (!raw) { restoring = true; resetAll(); restoring = false; return; }
  restoring = true;
  const lost = [];
  try {
    if (!raw.includes('=')) {
      // links made before the answer was written into the address: a list of questions
      const qs = raw.split('|').map(x => { try { return decodeURIComponent(x); } catch (err) { return x; } }).filter(Boolean);
      const q = qs[qs.length - 1];
      chain.length = 0; resetCell(); resetCtx();
      if (q) ask(q);
      if (!chain.length) showNotice(`That link came from an older version of the atlas and held only "${esc(q || '')}", ` +
        'which no longer reads as a full question. Ask it again below.');
      return;
    }
    const s = new URLSearchParams(raw);
    chain.length = 0; resetCell(); resetCtx();
    const face = s.get('face');
    if (face && FACETS[face] && !FACETS[face].soon) { if (face !== curFacet) chooseFacet(face); }
    else if (face) lost.push(`the face "${esc(face)}"`);
    const m = s.get('m');
    if (m) {
      const i = (FACET_MEASURES[curFacet] || []).findIndex(x => x[0] === m);
      if (i >= 0) { facetMeasureIdx[curFacet] = i; paintFacet(curFacet); }
      else lost.push(`the measure "${esc(m)}"`);
    }
    const among = s.get('among');
    if (among) setScope(among);
    if (s.has('q')) {
      ask(s.get('q'));
      if (!chain.length) {
        const qb = document.getElementById('q'); if (qb) qb.value = s.get('q');
        showNotice(`The link asked "${esc(s.get('q'))}" and it no longer reads. It is in the box below to edit.`);
      }
      return;
    }
    const places = (s.get('place') || '').split(',').filter(Boolean);
    const known = places.filter(i => BY_ISO[i] || i === 'USA');
    if (known.length < places.length) lost.push(places.filter(i => !known.includes(i)).join(', '));
    cell.places = known.slice(0, MAX_PLACES);
    const view = s.get('view');
    if (view && VIEW_DEF[view]) cell.view = view; else if (view) lost.push(`the reading "${esc(view)}"`);
    const form = s.get('form');
    if (form) cell.form = form;
    const vs = s.get('vs');
    if (vs && META[vs]) cell.against = vs; else if (vs) lost.push(`the measure "${esc(vs)}"`);
    const t = (s.get('t') || '').split(':');
    if (t[0] === 'run') { cell.span = 'run'; cell.since = +t[1] || null; cell.until = +t[2] || null; }
    else if (t[0] === 'moment') { cell.span = 'moment'; cell.year = +t[1] || null; }
    cell.scope = among || null;
    updateCell();
    sendCell();
  } finally {
    restoring = false;
    // the URL now says what is on screen, which may be less than the link asked for
    const h = urlState();
    history.replaceState(null, '', location.pathname + (h ? '#' + h : ''));
    if (lost.length) showNotice(`This link named ${lost.join(' and ')}, which the atlas does not have, ` +
      'so the answer below leaves it out.');
  }
}
window.addEventListener('popstate', restoreFromUrl);
function syncCellFromFact(f) {
  if (!f || f.kind === 'opp') { resetCell(); return; }
  cell.against = (f.mode === 'scatter' && f.scatter && f.scatter.y && !isIneq(f.scatter.y)) ? f.scatter.y
    : (f.mode === 'path' && f.path && f.path.y) ? f.path.y : null;
  cell.form = ['rank', 'delta_rank'].includes(f.kind) ? (['low', 'down'].includes(f.rankDir) ? 'least' : 'rank')

    : f.kind === 'spread' ? 'spread' : f.kind === 'lorenz' ? 'lorenz'
    : f.kind === 'tiers' ? 'tiers' : f.kind === 'break' ? 'break' : null;
  cell.view = ['reach', 'ratio', 'triple', 'tables', 'turn', 'peers', 'houses',
    'multiple', 'basket', 'three', 'owns', 'wmultiple', 'made', 'underwater', 'weather', 'have'].includes(f.kind) ? f.kind : null;
  cell.scope = ctx.pool ? ('pool:' + poolKey(ctx.pool))
    : ctx.region ? ('r:' + ctx.region) : null;
  cell.span = ['time', 'divergence', 'path', 'delta_rank'].includes(f.kind) ? 'run'
    : f.kind === 'point' ? 'moment' : null;
  cell.year = (f.kind === 'point' && f.marker) ? f.marker.year : null;
  cell.since = null; cell.until = null;
  const focus = (f.scatter && f.scatter.focus) || [];
  cell.place = (SINGLE_PLACE.includes(f.kind) && f.isos && f.isos.length) ? f.isos[f.isos.length - 1]
    : (focus.length === 1 ? focus[0] : null);
  // a comparison keeps every country it compared, or the next edit drops all but one
  if (f.kind === 'compare' && f.isos && f.isos.length > 1) cell.places = f.isos.slice(0, MAX_PLACES);
}
// build the answer straight from the cell's coordinates, keeping the others intact
function runCell() {
  if (onUs()) return;   // the US-zone facet has its own path
  ctx.metric = facetIneqDefault();
  ctx.lastIso = cell.place; ctx.lastAspect = cell.against;
  let p, q;
  if (cell.view === 'triple') { runParse({ kind: 'triple' }, 'wealth, income and life expectancy'); return; }
  if (cell.view === 'tables') {
    runParse({ kind: 'tables', isos: cell.places.slice(), region: ctx.region },
      'the two league tables'); return;
  }
  if (cell.view === 'turn') {
    runParse({ kind: 'turn', iso: cell.place }, 'the sharpest years'); return;
  }
  if (cell.view === 'peers') {
    runParse({ kind: 'peers', iso: cell.place, year: cell.since, until: cell.until },
      'against comparable countries'); return;
  }
  if (cell.view === 'reach') {
    runParse({ kind: 'reach', isos: cell.place ? [cell.place] : [], iso: cell.place || null },
      'did the growth reach the typical person'); return;
  }
  if (cell.view === 'houses') {
    runParse({ kind: 'houses', isos: cell.place ? [cell.place] : [], iso: cell.place || null },
      'houses against pay'); return;
  }
  if (cell.view === 'ratio') {
    runParse({ kind: 'ratio', isos: cell.place ? [cell.place] : [], iso: cell.place || null },
      'the richest tenth against the poorest half'); return;
  }
  // the five readings that bring their own measures but take the reader's years
  if (cell.view === 'have') {
    runParse({ kind: 'have', isos: cell.place ? [cell.place] : [], iso: cell.place || null,
      year: cell.span === 'moment' ? cell.year : null }, VIEW_DEF.have.label);
    return;
  }
  if (cell.view === 'weather') {
    runParse({ kind: 'weather', isos: cell.place ? [cell.place] : [], iso: cell.place || null,
      year: cell.span === 'moment' ? cell.year : null }, VIEW_DEF.weather.label);
    return;
  }
  if (cell.view === 'underwater') {
    runParse({ kind: 'underwater', isos: cell.place ? [cell.place] : [], iso: cell.place || null,
      year: cell.span === 'moment' ? cell.year : null }, VIEW_DEF.underwater.label);
    return;
  }
  if (cell.view === 'made') {
    runParse({ kind: 'made', isos: cell.place ? [cell.place] : [], iso: cell.place || null,
      year: cell.span === 'moment' ? cell.year : null }, VIEW_DEF.made.label);
    return;
  }
  if (['owns', 'wmultiple', 'multiple', 'basket', 'three'].includes(cell.view)) {
    const win = VIEW_DEF[cell.view].window && cell.span === 'run'
      ? { since: cell.since || null, until: cell.until || null } : {};
    runParse(Object.assign({ kind: cell.view, isos: cell.place ? [cell.place] : [],
      iso: cell.place || null }, win), VIEW_DEF[cell.view].label);
    return;
  }
  const F = cell.form;
  if (F === 'lorenz' && cell.place) {
    p = { kind: 'lorenz', isos: cell.places.slice(0, 5) };
    q = cell.places.length > 1 ? `Lorenz curves for ${cell.places.length} countries`
      : `Lorenz curve for ${BY_ISO[cell.place] ? BY_ISO[cell.place].name : cell.place}`;
  } else if (F === 'spread') {
    p = { kind: 'spread', metric: ctx.metric, region: ctx.region,
      year: cell.span === 'moment' ? cell.year : null,
      focus: cell.places.slice() };
    q = 'the spread';
  } else if (F === 'tiers' && cell.against && META[cell.against]) {
    p = { kind: 'tiers', aspect: cell.against, lens: ctx.metric, region: ctx.region,
      year: cell.span === 'moment' ? cell.year : null }; q = 'by tier';
  } else if (F === 'break' && cell.against && META[cell.against]) {
    p = { kind: 'break', metrics: [ctx.metric, cell.against],
      year: cell.span === 'moment' ? cell.year : null }; q = 'who breaks the pattern';
  } else if (F === 'rank' || F === 'least') {
    // a ranking still answers to the rest of the cell: the country is marked and its
    // place said, a chosen year ranks at that year, and a run of years ranks the moves
    const many = cell.places.length > 1 ? cell.places.slice() : null;
    if (cell.span === 'run') {
      p = { kind: 'delta_rank', dir: F === 'least' ? 'down' : 'up', region: ctx.region, metric: ctx.metric,
        year: cell.since, until: cell.until, highlight: cell.place, only: many };
      q = many ? `${many.length} countries, the moves` : 'the biggest moves';
    } else {
      p = { kind: 'rank', dir: F === 'least' ? 'low' : 'high', region: ctx.region, metric: ctx.metric, giniWords: true,
        year: cell.span === 'moment' ? cell.year : null, highlight: cell.place, only: many };
      q = many ? `${many.length} countries compared` : 'the ranking';
    }
  } else if (cell.place && cell.against && META[cell.against] && cell.span === 'run') {
    // a scatter that gains time becomes a trajectory: one country's path across the two
    p = { kind: 'path', iso: cell.place, x: ctx.metric, y: cell.against };
    q = `${BY_ISO[cell.place] ? BY_ISO[cell.place].name : cell.place} path`;
  } else if (cell.place && cell.against && META[cell.against]) {
    // one country held against another measure is the scatter across countries with it
    // marked. it used to fall to "one country, one year" below, and the measure picked in
    // the against fold changed nothing on screen
    p = { kind: 'correlate', x: ctx.metric, y: cell.against, region: ctx.region,
      year: cell.span === 'moment' ? cell.year : null };
    q = `${META[cell.against].label} and inequality`;
  } else if (cell.place && cell.span === 'moment' && cell.year) {   // one country, one year
    p = { kind: 'point', iso: cell.place, year: cell.year, metric: ctx.metric };
    q = `${BY_ISO[cell.place] ? BY_ISO[cell.place].name : cell.place} in ${cell.year}`;
  } else if (cell.places.length > 1) {
    // more than one country only draws as lines through time or as a bar of the set;
    // anything else would quietly read the first one and drop the rest
    if (cell.span === 'run' || !cell.span) {
      p = { kind: 'time', isos: cell.places.slice(), year: cell.since, until: cell.until,
        region: null, metric: ctx.metric };
      q = `${cell.places.length} countries over time`;
    } else {
      p = { kind: 'rank', dir: 'high', region: null, metric: ctx.metric, only: cell.places.slice(),
        year: cell.year };
      q = `${cell.places.length} countries compared`;
    }
  } else if (cell.place && cell.span === 'run') {   // a run of years wins when a place is set
    p = { kind: 'time', isos: [cell.place], year: cell.since, until: cell.until, region: null, metric: ctx.metric };
    q = `${BY_ISO[cell.place] ? BY_ISO[cell.place].name : cell.place} over time`;
  } else if (cell.against && META[cell.against]) {
    p = { kind: 'correlate', x: ctx.metric, y: cell.against, region: ctx.region,
      year: cell.span === 'moment' ? cell.year : null };
    q = `${META[cell.against].label} and inequality`;
  } else if (cell.place) {
    p = { kind: 'profile', iso: cell.place };
    q = BY_ISO[cell.place] ? BY_ISO[cell.place].name : cell.place;
  } else if (cell.span === 'run') {
    p = { kind: 'time', isos: [], year: cell.since, until: cell.until, region: ctx.region, metric: ctx.metric };
    q = 'over time';
  } else {
    p = { kind: 'rank', dir: 'high', region: ctx.region, metric: ctx.metric, giniWords: true,
      highlight: cell.place };
    q = 'most concentrated';
  }
  const prev = chain.slice();
  chain.length = 0;   // so the highlight comes from the cell, not the answer we're replacing
  // the last answer's complaint is not about this one: "No data" from a refused fold
  // pick stayed on screen under the next answer that worked
  hideNotice();
  let f = buildAnswer(p, q);
  // two measures at one year: "a single moment" picks the latest wealth year, 2024, and
  // income surveys stop around 2021, so a comparison there found nobody and said only
  // "no data". it reads each at its latest year instead, and says so
  if (!f && p.year && ['tiers', 'break', 'correlate'].includes(p.kind)) {
    hideNotice();
    f = buildAnswer(Object.assign({}, p, { year: null }), q);
    if (f) f.text += ` <em class="readas">Too few countries carry both measures at ${p.year}, so this reads each at its latest year.</em>`;
  }
  if (!f) { chain.push(...prev); render(); return; }
  chain.push(f); ctx.lastQuery = q; render();
}
// set one coordinate from the accordion and rebuild
function runParse(p, q) {
  const prev = chain.slice();
  chain.length = 0;
  const f = buildAnswer(p, q);
  if (!f) { chain.push(...prev); render(); return; }
  chain.push(f); ctx.lastQuery = q; render();
}
// who counts as everyone: a region, the richer or poorer half, or the whole world
function setScope(val) {
  cell.scope = val || null;
  if (!val) { setRegion(null); ctx.pool = null; computePool(); }
  else if (val.slice(0, 2) === 'r:') { setRegion(val.slice(2)); ctx.pool = null; computePool(); }
  else if (val === 'pool:all') { setRegion(null); ctx.pool = ALL_POOL; computePool(); }
  else if (val.slice(0, 5) === 'pool:') {
    setRegion(null);
    const rich = val.slice(5) === 'rich';
    ctx.pool = { label: rich ? 'richer countries' : 'poorer countries', metric: 'gdp_pc', dir: rich ? 'high' : 'low' };
    computePool();
  }
}
function applyDim(dim, val) {
  if (dim === 'place') {
    if (val && val[0] === '+') {          // toggle one country in or out of the comparison
      const iso = val.slice(1), at = cell.places.indexOf(iso);
      if (at >= 0) cell.places.splice(at, 1);
      else if (cell.places.length < MAX_PLACES) cell.places.push(iso);
      else showNotice(`Six countries is as many as one reading can carry. Drop one first.`);
    } else cell.place = val || null;      // naming one outright clears the rest
  } else if (dim === 'time') {
    const bits = String(val || '').split(':');
    cell.span = bits[0] === 'run' ? 'run' : bits[0] === 'moment' ? 'moment' : null;
    cell.since = cell.span === 'run' && bits[1] ? +bits[1] : null;
    cell.until = cell.span === 'run' && bits[2] ? +bits[2] : null;
    cell.year = cell.span === 'moment' && bits[1] ? +bits[1] : null;
    if (cell.since && cell.until && cell.until < cell.since) {   // dragged past itself: swap, don't refuse
      const t = cell.since; cell.since = cell.until; cell.until = t;
    }
    if (cell.span === 'moment' && !cell.year) {   // no year named: read the latest one there is
      const ys = seriesYears(cell.place); cell.year = ys.length ? ys[ys.length - 1] : null;
    }
  } else if (dim === 'against') {
    cell.against = val || null;
    if (!cell.against && ['tiers', 'break'].includes(cell.form)) cell.form = null;
    if (cell.against && ['rank', 'least', 'spread', 'lorenz'].includes(cell.form)) cell.form = null;
    if (cell.against && cell.view) cell.view = null;   // a view brings its own measures
  }
  else if (dim === 'form') {
    // one fold, two kinds of thing: a view replaces the reading, a form only redraws it
    if (VIEW_DEF[val]) { cell.view = val; cell.form = null; }
    else { cell.form = val || null; cell.view = null; }
  }
  else if (dim === 'scope') setScope(val);
  else if (dim === 'facet') {   // the measure of the face you're on
    const list = FACET_MEASURES[curFacet] || [];
    const i = list.findIndex(m => m[0] === val);
    if (i >= 0) { facetMeasureIdx[curFacet] = i; ctx.metric = val; paintFacet(curFacet); }
    if (!chain.length) { updateCell(); return; }   // browsing the faces must not force an answer
  }
  // while composing, editing the chain edits a draft. only sending computes.
  if (stage === 'result') runCell(); else updateCell();
}
// re-read the current cell under a changed facet or measure (never drops back to the landing)
function rerunCurrent() {
  if (!chain.length) return;
  if (onUs()) {
    if (!US_CZ) return;
    // a global cell doesn't translate, so open the face's own view of the zones
    const f = oppAnswer(curFacet === 'health' ? 'how much longer do the rich live here?' : 'upward mobility');
    if (f) { chain.length = 0; chain.push(f); render(); }
    return;
  }
  runCell();
}

function answer(q) { return buildAnswer(parse(q), q); }
// build an answer from a parse object; runCell constructs the same shape from the cell's coordinates
function buildAnswer(p, q) {
  if (p.kind === 'unknown') {
    showNotice('Could not read that one. Try a country, "least equal", "over time", "income inequality", or "life expectancy".');
    return null;
  }
  if (p.kind === 'pending') {
    showNotice('Subjective wellbeing is on the way. Life expectancy and CO2 per person are in; try those.');
    return null;
  }

  if (p.region) setRegion(p.region);   // a named region becomes the standing geography

  let f = { id: ++factSeq, query: q, kind: p.kind, isos: [], mode: 'lines', bar: null, metric: null, marker: null,
    rankDir: p.dir || null };

  if (p.kind === 'contrast') {
    const y = p.y, my = META[y];
    // wealth axis is the top 1% share: real wealth concentration, measured across all 213 countries by WID
    const wealthLens = SERIES.wealth_top1 ? 'wealth_top1' : 'wealth_gini';
    const wLog = false;
    const wPts = [], iPts = [];
    for (const iso in BY_ISO) {
      if (!inScope(iso, p.region)) continue;
      const yv = latestValOf(y, iso), wv = latestValOf(wealthLens, iso), iv = latestValOf('income_gini', iso);
      if (yv && wv && (!wLog || wv.val > 0)) wPts.push({ iso, name: BY_ISO[iso].name, x: wv.val, y: yv.val });
      if (yv && iv) iPts.push({ iso, name: BY_ISO[iso].name, x: iv.val, y: yv.val });
    }
    const rW = pearson(wLog ? wPts.map(p2 => ({ x: Math.log(p2.x), y: p2.y })) : wPts), rI = pearson(iPts);
    if (rW == null && rI == null) return miss();
    ctx.metric = wealthLens; ctx.lastAspect = y;
    const focus = focusIsos().filter(i => wPts.some(p2 => p2.iso === i) || iPts.some(p2 => p2.iso === i));
    if (focus.length) { f.isos = focus; ctx.lastIso = focus[focus.length - 1]; }
    f.mode = 'contrast';
    f.contrast = { y, wPts, iPts, rW, rI, focus, region: p.region, wealthLens, wLog };
    const where = p.region ? ` in ${REGION_LABEL[p.region]}` : '';
    // lead with a plain reading of the wealth axis; keep the r's as a quiet second layer
    const wLabel = wealthLens === 'wealth_top1' ? 'the top 1% share' : 'the wealth Gini';
    const lead = rW != null
      ? `Across ${wPts.length} countries${where}, ${my.label} ${corrClause(rW, wLabel)}.`
      : `Across ${iPts.length} countries${where}, ${my.label} ${corrClause(rI, 'the income Gini')}.`;
    const stats = [];
    if (rW != null) stats.push(`wealth r = ${rW.toFixed(2)}`);
    if (rI != null) stats.push(`income r = ${rI.toFixed(2)}`);
    f.text = `${lead} <em>${stats.join(', ')}</em>`;
  }

  else if (p.kind === 'correlate') {
    const mx = META[p.x], my = META[p.y];
    const pts = pairedPoints(p.x, p.y, p.region, p.year);
    const r = pearson(pts);
    if (!pts.length || r == null) {
      if (p.year) { showNotice(`Too few countries carry both measures within ${POOL_YEAR_TOL} years of ${p.year}.`); return null; }
      return miss();
    }
    ctx.metric = p.x; if (!isIneq(p.y)) ctx.lastAspect = p.y;
    const focus = [...new Set([ctx.lastIso, ...focusIsos()].filter(Boolean))].filter(i => pts.some(pt => pt.iso === i));
    if (focus.length) { f.isos = focus; ctx.lastIso = focus[focus.length - 1]; }
    f.mode = 'scatter';
    f.scatter = { x: p.x, y: p.y, pts, r, region: p.region, focus };
    const fit = pairFitness(pts);
    f.fit = fit;
    const where = p.region ? ` in ${REGION_LABEL[p.region]}` : '';
    let t;
    if (fit.level === 'refuse') {
      // the two sides are years apart for every country: this is not a relationship we can read
      t = `This one cannot be read. Every one of the ${fit.paired} countries pairs a ${mx.label} figure ` +
        `with a ${my.label} figure from a different year, typically ${fit.med} years apart. ` +
        `A correlation across that gap is arithmetic, not evidence.` +
        fitnessFlag(fit, 'no matching years');
    } else {
      const yrsP = pts.map(x => x.xy).filter(Boolean);
      t = `Across ${pts.length} countries${where}${poolNote()}${p.year ? ' around ' + p.year : ''}, ` +
        `${my.label} ${corrClause(r, mx.label)} (r = ${r.toFixed(2)}).` + focusLine() +
        (p.year && yrsP.length ? ` <em>Each country at the year nearest ${p.year} that carries both ` +
          `(${Math.min(...yrsP)} to ${Math.max(...yrsP)}).</em>` : '') +
        (pts.far ? ` <em>${pts.far} more countries carry both but never within ${POOL_YEAR_TOL} years of ` +
          `${p.year}, so they are left out.</em>` : '') +
        (pts.dropped ? ` <em>${pts.dropped} more countries carry both measures but never in the same year, so they are left out.</em>` : '') +
        fitnessFlag(fit, fit.n < 25 ? `only ${fit.n} countries` : `years ${fit.med} apart`);
    }
    // the country asked about, said beside the finding rather than as "the highlighted
    // point" at the end: its two readings, and which side of the line it falls
    function focusLine() {
      if (focus.length !== 1) return '';
      const pt = pts.find(x => x.iso === focus[0]); if (!pt) return '';
      const n = pts.length, mxv = pts.reduce((a, q) => a + q.x, 0) / n, myv = pts.reduce((a, q) => a + q.y, 0) / n;
      const sxx = pts.reduce((a, q) => a + (q.x - mxv) ** 2, 0), sxy = pts.reduce((a, q) => a + (q.x - mxv) * (q.y - myv), 0);
      const slope = sxx ? sxy / sxx : 0, res = q => q.y - (myv + slope * (q.x - mxv));
      const sd = Math.sqrt(pts.reduce((a, q) => a + res(q) ** 2, 0) / n), d = res(pt);
      // short enough to stay in the answer's first lines beside the finding
      const side = Math.abs(d) < sd * 0.35 ? 'on the trend' : `${my.fmtD(Math.abs(d))} ${d > 0 ? 'above' : 'below'} the trend`;
      return ` <strong>${esc(cap(theName(pt.iso)))}</strong> sits ${side}, at ${mx.fmt(pt.x)} and ${my.fmt(pt.y)}.`;
    }
    // across countries this is a national average against a national average, which is
    // why it is weak. the sharp version is inside one country, by income group.
    if (p.y === 'life_exp' && US_CZ && Object.values(US_CZ).some(z => z.leq1M != null))
      t += ` <em>Across countries this holds one average against another. Measured by income group ` +
        `inside the United States, the poorest quarter live 8.7 years less than the richest in the same ` +
        `place: turn to the health face and ask "how much longer do the rich live here?"</em>`;
    // a weak global link often sharpens among rich countries: point there instead of leaving it flat
    if (Math.abs(r) < 0.22 && !p.region && !ctx.pool && SERIES.gdp_pc && pts.length > 30) {
      const rich = new Set(rankedPool('gdp_pc', 'high').slice(0, 60).map(rr => rr.geo_id));
      const rr = pearson(pts.filter(pt => rich.has(pt.iso)));
      if (rr != null && Math.abs(rr) - Math.abs(r) >= 0.12)
        t += ` <em>Among rich countries it sharpens to r = ${rr.toFixed(2)}.</em>`;
    }
    f.text = t;
  }

  else if (p.kind === 'reach') {
    // output against the income of the person in the middle. per hour worked where the
    // OECD measures it, because that is what the productivity and pay argument is about
    // and it does not move when people retire early or work shorter weeks; per person
    // everywhere else, and the answer says which it used
    const iso = p.iso || ctx.lastIso || (focusIsos()[0] || null);
    if (!iso || !BY_ISO[iso]) { showNotice('Name a country: this one holds a country\'s growth against its own median income.'); return null; }
    const m = seriesOf('median_income', iso), gh = seriesOf('gdp_hour', iso);
    const hour = gh.length >= 2 && m.length >= 2 && gh.filter(d => d.year >= m[0].year).length >= 2 && gh[0].year <= m[m.length - 2].year;
    const g = hour ? gh : seriesOf('gdp_pc', iso);
    if (g.length < 2 || m.length < 2) return miss();
    const base = Math.max(g[0].year, m[0].year);
    const gs = g.filter(d => d.year >= base), ms = m.filter(d => d.year >= base);
    if (gs.length < 2 || ms.length < 2) return miss();
    const gPct = (gs[gs.length - 1].v / gs[0].v - 1) * 100;
    const mPct = (ms[ms.length - 1].v / ms[0].v - 1) * 100;
    ctx.lastIso = iso; f.isos = [iso];
    f.mode = 'reach';
    f.reach = { iso, base, gs, ms, gPct, mPct, hour,
      labels: hour ? { top: 'output per hour worked', mid: 'the income in the middle' } : null };
    const pc1 = v => (v >= 0 ? '+' : '') + v.toFixed(0) + '%';
    f.text = `In <strong>${esc(theName(iso))}</strong> from ${base}, output ${hour ? 'per hour worked' : 'per person'} grew ` +
      `<strong>${pc1(gPct)}</strong> to ${gs[gs.length - 1].year}. The income of the person in the middle grew ` +
      `<strong>${pc1(mPct)}</strong> to ${ms[ms.length - 1].year}.` +
      (gPct - mPct > 5 ? ' The growth did not arrive in the middle.' : '') +
      ` <em>The median rests on ${ms.length} survey${ms.length === 1 ? '' : 's'} between ${ms[0].year} and ${ms[ms.length - 1].year}.` +
      (hour ? ' Output is per hour worked, from the OECD.' :
        ' Output is per person, because the OECD does not measure output per hour here.') + `</em>`;
  }

  else if (p.kind === 'have') {
    // Every other reading on this face is a share, a multiple or a composition, and
    // none of them is a number a reader can hold against their own bank balance. This
    // one is. A median inside each group, so every figure is a family rather than a
    // total, which is what makes the groups comparable to each other.
    if (!SCF_NW) { showNotice('The net worth tables are not loaded.'); return null; }
    const asked = p.iso || ctx.lastIso || (focusIsos()[0] || null);
    if (asked && asked !== 'USA') {
      showNotice(`What a family in each part of the country actually has, in money, comes from ` +
        `the Survey of Consumer Finances, which is the United States. The atlas holds nothing ` +
        `like it for ${esc(theName(asked))}: the wealth shares run for 213 countries, but a share ` +
        `is not a bank balance.`);
      return null;
    }
    const yrs = SCF_NW.years;
    const want = p.year || yrs[yrs.length - 1];
    let at = 0;
    for (let k = 0; k < yrs.length; k++) if (Math.abs(yrs[k] - want) < Math.abs(yrs[at] - want)) at = k;
    const year = yrs[at];
    const ORDER = ['bottom25', 'lower_mid', 'upper_mid', 'next15', 'top10'];
    const rows = ORDER.map(g => {
      const b = SCF_NW.groups[g];
      if (!b || b.net[at] == null) return null;
      return { g, lab: SCF_NW.labels[g], net: b.net[at], series: b.net, have: b.have };
    }).filter(Boolean);
    if (rows.length < 2) return miss();
    const lo = rows[0], hi = rows[rows.length - 1];
    // a net worth of nought is a measurement here, not a gap, and it happened twice
    const zeros = lo.series.map((v, i) => (v === 0 ? yrs[i] : null)).filter(Boolean);
    ctx.metric = 'wealth_bottom50'; ctx.lastIso = 'USA'; f.isos = ['USA'];
    f.mode = 'have'; f.have = { rows, year, years: yrs, at, zeros };
    const money = v => v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'm'
      : '$' + Math.round(v * 1000).toLocaleString('en-US');
    let t = `The family in the middle of the poorest quarter of the United States has ` +
      `<strong>${money(lo.net)}</strong> to its name, counting everything it owns and taking off ` +
      `everything it owes (${year}). The family in the middle of the richest tenth has ` +
      `<strong>${money(hi.net)}</strong>. `;
    // the year being read is already in the sentence above; only the others are news
    const otherZeros = zeros.filter(y => y !== year);
    if (zeros.includes(year))
      t += `That is not a rounding: the middle of that quarter owed exactly what it owned` +
        (otherZeros.length ? `, as it did in ${otherZeros.join(' and ')}` : '') + `. `;
    else if (otherZeros.length)
      t += `In ${otherZeros.join(' and ')} that first figure was <strong>nothing at all</strong>: ` +
        `the middle of the poorest quarter owed exactly what it owned. `;
    const H = (g, k) => { const r = rows.find(x => x.g === g); return r && r.have[k] ? r.have[k][at] : null; };
    const hl = H('bottom25', 'home'), hh = H('top10', 'home');
    const rl = H('bottom25', 'retirement'), rh = H('top10', 'retirement');
    if (hl != null && hh != null)
      t += `<strong>${hl.toFixed(0)}%</strong> of the poorest quarter own the home they live in, ` +
        `against <strong>${hh.toFixed(0)}%</strong> of the richest tenth`;
    if (rl != null && rh != null)
      t += `${(hl != null && hh != null) ? ', and ' : ''}` +
        `<strong>${rl.toFixed(0)}%</strong> have a retirement account against ` +
        `<strong>${rh.toFixed(0)}%</strong>`;
    if ((hl != null && hh != null) || (rl != null && rh != null)) t += '. ';
    t += `<em>Each figure is the family in the middle of its group, so these are families and ` +
      `not totals. Thousands of dollars in the money of the latest survey, so the run of years ` +
      `can be read straight down.</em>`;
    f.text = t;
  }

  else if (p.kind === 'weather') {
    // What the rest of the wealth face is for. A share of a national total, a multiple,
    // a composition: all of it is in service of one question, which is whether a
    // household can take a hit without going under. This asks it directly.
    if (!HFCS_RES) { showNotice('The household survey is not loaded.'); return null; }
    const B = HFCS_RES.by, waves = HFCS_RES.waves;
    const named = p.iso || null;
    const standing = ctx.lastIso || (focusIsos()[0] || null);
    const hasSave = resilienceFor;
    if (named && !B[named]) {
      showNotice(`Whether a household could absorb a shock comes from a household survey, and ` +
        `the one the atlas holds covers the euro area and a few of its neighbours, not ` +
        `${esc(theName(named))}. Ask it without a country for the euro area.`);
      return null;
    }
    const iso = (named && hasSave(named)) ? named : (standing && hasSave(standing)) ? standing : null;
    const here = iso || 'EA';
    if (!hasSave(here)) return miss();
    // Two different absences, and they should not read the same. A country the survey
    // does not cover is one thing; a country it covers but does not publish this for,
    // which is Finland, is another.
    const fellBack = (!iso && (named || standing)) ? (named || standing) : null;
    const dropped = (fellBack && BY_ISO[fellBack]) ? fellBack : null;
    const inSurvey = dropped ? !!B[dropped] : false;
    const want = p.year || waves[waves.length - 1];
    let at = 0;
    for (let k = 0; k < waves.length; k++)
      if (Math.abs(waves[k] - want) < Math.abs(waves[at] - want)) at = k;
    const sv = B[here].save;
    // the source counts households whose expenses came to less than their income; the
    // reading is about the others, so everything here is the complement of it
    const short = cut => (sv[cut] && sv[cut][at] != null) ? 100 - sv[cut][at] : null;
    const FIFTHS = ['w_bottom20', 'w_20_40', 'w_40_60', 'w_60_80', 'w_80_90', 'w_90_100'];
    const all = short('all');
    if (all == null) return miss();
    const lines = FIFTHS.map(k => ({ k, vals: waves.map((y, j) => (sv[k] && sv[k][j] != null) ? 100 - sv[k][j] : null) }))
      .filter(d => d.vals.some(v => v != null));
    const flat = k => (B[here][k] && B[here][k][at] != null) ? B[here][k][at] : null;
    const help = flat('help'), refused = flat('refused');
    const wave = waves[at];
    ctx.metric = 'wealth_bottom50'; ctx.lastIso = iso; f.isos = iso ? [iso] : [];
    f.mode = 'weather';
    f.weather = { here, iso, all, wave, waves, at, lines, help, refused, series: sv.all };
    const pct = v => v.toFixed(0) + '%';
    const where = iso ? `<strong>${esc(theName(iso))}</strong>` : 'the <strong>euro area</strong>';
    let t = `In ${where}, <strong>${pct(all)}</strong> of households have nothing left over at the ` +
      `end of the month: what they spend comes to as much as what they bring in, or more ` +
      `(${wave} wave). ` +
      (dropped ? (inSurvey
        ? `The survey covers ${esc(theName(dropped))} but does not publish this indicator for it, ` +
          `so this is the euro area as a whole. `
        : `The survey does not reach ${esc(theName(dropped))}, so this is the euro area as a ` +
          `whole. `) : '');
    const lo = short('w_bottom20'), hi = short('w_90_100');
    if (lo != null && hi != null)
      t += `Among the poorest fifth by wealth it is <strong>${pct(lo)}</strong>, against ` +
        `<strong>${pct(hi)}</strong> of the richest tenth. `;
    if (help != null)
      t += `<strong>${pct(100 - help)}</strong> could not raise money from family or friends in ` +
        `an emergency. `;
    if (refused != null)
      t += `Of the households that went looking for credit in the last three years, ` +
        `<strong>${pct(refused)}</strong> were refused or given less than they asked for. `;
    t += `<em>This is what the shares on the rest of this face are for. Owning nothing is not a ` +
      `statistic about a national total; it is the month a boiler goes.</em>`;
    f.text = t;
  }

  else if (p.kind === 'have') {
    cell.view = 'have'; cell.place = 'USA';        // the only country that publishes it
    if (p.year) { cell.span = 'moment'; cell.year = p.year; }
  }
  else if (p.kind === 'weather') {
    cell.view = 'weather';
    if (p.iso) cell.place = p.iso;
    if (p.year) { cell.span = 'moment'; cell.year = p.year; }
  }
  else if (p.kind === 'underwater') {
    // The face already says the poorest half of five countries owns less than nothing.
    // That is a share of a national total, and a total can be dragged under by a few
    // households deeply in debt. This counts the households instead. Different basis,
    // different survey, and the two do not agree, which is the reading's whole point.
    if (!HFCS_NEG) { showNotice('The household survey is not loaded.'); return null; }
    const B = HFCS_NEG.by, waves = HFCS_NEG.waves;
    // A country named outright is refused by name. A country left standing from the last
    // question is not: it falls back to the euro area and the sentence says whose country
    // it could not use, because a reader who asked about Britain and then clicked this
    // wanted the reading, not a wall.
    const named = p.iso || null;
    const standing = ctx.lastIso || (focusIsos()[0] || null);
    if (named && !B[named]) {
      showNotice(`Counting the households below zero takes a household survey, and the one the ` +
        `atlas holds covers the euro area and a few of its neighbours, not ${esc(theName(named))}. ` +
        `Ask it without a country for the euro area, or ask what the poorest half owns, which ` +
        `runs for 213.`);
      return null;
    }
    const iso = (named && B[named]) ? named : (standing && B[standing]) ? standing : null;
    const dropped = (!iso && standing && BY_ISO[standing]) ? standing : null;
    const want = p.year || waves[waves.length - 1];
    let at = 0;
    for (let k = 0; k < waves.length; k++)
      if (Math.abs(waves[k] - want) < Math.abs(waves[at] - want)) at = k;
    const here = iso || 'EA';
    const rowOf = (code, cut) => (B[code] && B[code][cut]) ? B[code][cut][at] : null;
    const all = rowOf(here, 'all');
    if (all == null) return miss();
    const wave = waves[at];
    const pool = Object.keys(B).filter(c => c !== 'EA' && rowOf(c, 'all') != null)
      .map(c => ({ c, v: rowOf(c, 'all') })).sort((x, y) => y.v - x.v);
    const rk = iso ? pool.findIndex(r => r.c === iso) + 1 : 0;
    // the two measures held against each other, worked out here rather than asserted
    const paired = pool.filter(r => seriesOf('wealth_bottom50', r.c).length);
    const rho = spearman(paired.map(r => seriesOf('wealth_bottom50', r.c).slice(-1)[0].v),
      paired.map(r => r.v));
    const cuts = ['own_outright', 'own_mortgage', 'renting', 'age_16_34', 'age_35_44',
      'age_45_54', 'age_55_64', 'age_65_74', 'age_75_plus']
      .map(k => ({ k, v: rowOf(here, k) })).filter(d => d.v != null);
    const firstAt = B[here].all.findIndex(v => v != null);
    ctx.metric = 'wealth_bottom50'; ctx.lastIso = iso; f.isos = iso ? [iso] : [];
    f.mode = 'underwater';
    f.underwater = { here, iso, all, wave, waves, at, cuts, rank: rk, of: pool.length,
      series: B[here].all, rho, paired: paired.length, ea: rowOf('EA', 'all') };
    const get = k => { const d = cuts.find(x => x.k === k); return d ? d.v : null; };
    // 43 cells round to nought in this table, and '0.0%' reads as a measurement rather
    // than as what it is: a share too small for the survey to put a figure on
    const pct = v => v < 0.05 ? 'almost none' : v.toFixed(1) + '%';
    const where = iso ? `<strong>${esc(theName(iso))}</strong>` : 'the <strong>euro area</strong>';
    let t = `In ${where}, <strong>${pct(all)}</strong> of households own less than nothing: what ` +
      `they owe comes to more than everything they hold (${wave} wave). ` +
      (dropped ? `The survey does not reach ${esc(theName(dropped))}, so this is the euro area ` +
        `as a whole. ` : '');
    if (firstAt >= 0 && firstAt !== at)
      t += `In the ${waves[firstAt]} wave it was <strong>${pct(B[here].all[firstAt])}</strong>. `;
    if (iso && rk) t += `That is ${rk === 1 ? 'the highest' : ordinal(rk) + ' highest'} of the ` +
      `${pool.length} countries the survey covers, against ${pct(f.underwater.ea)} across the ` +
      `euro area. `;
    const rent = get('renting'), outr = get('own_outright');
    const young = get('age_16_34'), old = get('age_75_plus');
    const bits = [];
    if (rent != null && outr != null)
      bits.push(`<strong>${pct(rent)}</strong> of renters against ` +
        (outr < 0.05 ? `<strong>almost none</strong> of the people who own their home outright`
          : `<strong>${pct(outr)}</strong> of them where the home is owned outright`));
    if (young != null && old != null)
      bits.push(`<strong>${pct(young)}</strong> of households run by someone under 35 against ` +
        (old < 0.05 ? `<strong>almost none</strong> over 75` : `<strong>${pct(old)}</strong> over 75`));
    if (bits.length) t += `It is not spread evenly: ${bits.join(', and ')}. `;
    if (rho != null)
      t += `<em>This counts households; the shares elsewhere on this face divide a national ` +
        `total. Across the ${paired.length} countries carrying both they hardly line up, at a ` +
        `rank correlation of ${rho.toFixed(2)}, so a country can hold a healthy bottom-half ` +
        `share and still have a great many households in debt beyond what they own.</em>`;
    f.text = t;
  }

  else if (p.kind === 'have') {
    cell.view = 'have'; cell.place = 'USA';        // the only country that publishes it
    if (p.year) { cell.span = 'moment'; cell.year = p.year; }
  }
  else if (p.kind === 'weather') {
    cell.view = 'weather';
    if (p.iso) cell.place = p.iso;
    if (p.year) { cell.span = 'moment'; cell.year = p.year; }
  }
  else if (p.kind === 'underwater') {
    cell.view = 'underwater';
    if (p.iso) cell.place = p.iso;
    if (p.year) { cell.span = 'moment'; cell.year = p.year; }
  }
  else if (p.kind === 'made') {
    // Every other wealth reading here is a share: the poorest half hold 4.6% of Britain.
    // A share says how much and never what of. This says what of, which is the thing a
    // reader can picture and the thing that makes the rest of the face mean something.
    if (!US_COMP) { showNotice('The composition layer is not loaded.'); return null; }
    const iso = p.iso || ctx.lastIso || (focusIsos()[0] || null);
    if (iso && iso !== 'USA') {
      showNotice(`What wealth is made of is published by wealth group in the United States ` +
        `and nowhere else the atlas can reach, so it cannot be drawn for ` +
        `${esc(theName(iso))}. The shares themselves run for 213 countries: ask what the ` +
        `poorest half owns.`);
      return null;
    }
    const yrs = US_COMP.years;
    const want = p.year || yrs[yrs.length - 1];
    let at = 0;
    for (let k = 0; k < yrs.length; k++) if (Math.abs(yrs[k] - want) < Math.abs(yrs[at] - want)) at = k;
    const year = yrs[at];
    const ORDER = ['bottom50', 'middle40', 'top10', 'top1', 'top01'];
    const LAB = { bottom50: 'the poorest half', middle40: 'the middle 40%', top10: 'the richest tenth',
      top1: 'the richest 1%', top01: 'the richest thousandth' };
    const rows = ORDER.map(g => {
      const b = US_COMP.groups[g];
      const a = b.assets[at];
      if (!a) return null;
      const part = {}; for (const k in b.parts) part[k] = b.parts[k][at] / a;
      return { g, lab: LAB[g], assets: a, net: b.net[at], part,
        debt: b.liab[at] / a, mort: b.mortgages[at] / a, credit: b.credit[at] / a };
    }).filter(Boolean);
    if (rows.length < 2) return miss();
    const lo = rows[0], hi = rows[rows.length - 1];
    const bricks = lo.part.real_estate + lo.part.durables;
    // the bars are all the same length, so the picture has to say how far apart they are.
    // per household, since a group total divided by a group of a different size is not a
    // comparison. the DFA's own group names give the fractions.
    const SHARE = { bottom50: 0.50, middle40: 0.40, top10: 0.10, top1: 0.01, top01: 0.001 };
    const per = r => r.assets / SHARE[r.g];
    f.scaleGap = (SHARE[lo.g] && SHARE[hi.g]) ? per(hi) / per(lo) : null;
    ctx.metric = 'wealth_bottom50'; ctx.lastIso = 'USA'; f.isos = ['USA'];
    f.mode = 'made'; f.made = { rows, year, years: yrs, at, gap: f.scaleGap, loLab: lo.lab, hiLab: hi.lab };
    f.text = `Of everything the poorest half of American households own, ` +
      `<strong>${pc(bricks)}</strong> is the house they live in and the car and the furniture ` +
      `in it (${year}). <strong>${pc(lo.part.equities)}</strong> is shares in companies. They owe ` +
      `<strong>${(lo.debt * 100).toFixed(0)} cents</strong> against every dollar of it, most of it ` +
      `a mortgage and the rest a card or a car loan. For the richest thousandth it is ` +
      `<strong>${pc(hi.part.real_estate)}</strong> housing and <strong>${pc(hi.part.equities)}</strong> ` +
      `shares, against <strong>${(hi.debt * 100).toFixed(0)} cent${Math.round(hi.debt * 100) === 1 ? '' : 's'}</strong> ` +
      `of debt per dollar. <em>Two households, the same country, holding different kinds of thing.</em>`;
  }

  else if (p.kind === 'owns') {
    // What half a country owns, against what one per cent of it owns. Both are shares of
    // the same total on the same WID basis, so they belong on one axis in levels.
    const iso = p.iso || ctx.lastIso || (focusIsos()[0] || null);
    if (!iso || !BY_ISO[iso]) { showNotice('This reads one country. Name a place first.'); return null; }
    const B = windowed(seriesOf('wealth_bottom50', iso), p.since, p.until);
    const T = windowed(seriesOf('wealth_top1', iso), p.since, p.until);
    if (B.length < 2 || T.length < 2) return tooNarrow(iso, p.since, p.until, 'its wealth shares');
    const lo = Math.max(B[0].year, T[0].year);
    const b = B.filter(d => d.year >= lo), t = T.filter(d => d.year >= lo);
    if (b.length < 2 || t.length < 2) return tooNarrow(iso, p.since, p.until, 'its wealth shares');
    const hi = Math.min(b[b.length - 1].year, t[t.length - 1].year);
    const at = (arr, y) => { const q = arr.filter(d => d.year <= y); return q.length ? q[q.length - 1].v : arr[0].v; };
    const b0 = b[0].v, b1 = at(b, hi), t1 = at(t, hi);
    ctx.metric = 'wealth_bottom50'; ctx.lastIso = iso; f.isos = [iso];
    f.mode = 'owns'; f.owns = { iso, b, t, lo, hi };
    const now = b1 < 0
      ? `Half the adults in <strong>${esc(theName(iso))}</strong> own <strong>less than nothing</strong>. ` +
        `Their debts come to ${pc(Math.abs(b1))} of all the household wealth in the country more than ` +
        `their assets do (${hi}). `
      : `Half the adults in <strong>${esc(theName(iso))}</strong> own <strong>${pc(b1)}</strong> of ` +
        `everything owned there (${hi}). `;
    const then = b0 <= 0
      ? `In ${lo} that same half was already in debt, by ${pc(Math.abs(b0))}. `
      : `In ${lo} they owned <strong>${pc(b0)}</strong>` +
        (b1 > 0 && b1 < b0 * 0.9 ? `, so their share has fallen by ${Math.round((1 - b1 / b0) * 100)}%. `
          : b1 > b0 * 1.1 ? `, so their share has risen by ${Math.round((b1 / b0 - 1) * 100)}%. ` : '. ');
    const top = `The richest 1% hold <strong>${pc(t1)}</strong>` +
      (b1 > 0 ? `, which is ${(t1 / b1).toFixed(1)} times what fifty times as many people hold between them.`
        : `, and there is no share left for the half below to be measured against.`);
    f.text = now + then + top +
      ` <em>Two shares of one total, so they can be read straight against each other: household net ` +
      `wealth, per adult, with a couple's holdings split equally between them. A share can go ` +
      `negative because debts count.</em>`;
  }

  // is owning more unequal than earning, asked of no country in particular: the claim the
  // landing page makes, answered across every country where both can be worked out. it
  // used to take one country at random and answer for that
  else if (p.kind === 'owngap') {
    const sw = multipleSweep();
    if (!sw.both.length) return miss();
    const rows = sw.both.map(x => ({ iso: x.iso, wm: x.wm, im: x.im, ratio: x.wm / x.im }))
      .sort((a, b) => b.ratio - a.ratio);
    const n = rows.length, wider = sw.wider, mid = rows[Math.floor(n / 2)];
    f.mode = 'owngap'; f.owngap = { rows, set: setLabel(n) }; f.isos = [];
    f.text = (wider === n ? `Yes, in every one of ${setLabel(n)} where both can be worked out` :
        `In ${wider} of ${setLabel(n)} where both can be worked out`) +
      `, the gap in what people own is wider than the gap in what they earn. In the country in the middle, ` +
      `<strong>${esc(theName(mid.iso))}</strong>, one person in the top 1% owns <strong>${roughly(mid.wm)} times</strong> what one ` +
      `person in the poorest half owns and earns <strong>${roughly(mid.im)} times</strong> as much.` +
      (sw.owing.length ? ` <em>In ${sw.owing.length} more the poorest half owes more than it owns, so there is no multiple to give; ` +
        `those are the far end of the same answer.</em>` : '') +
      ` <em>Both come from WID shares per adult, a couple's holdings split equally between them, each divided by the share ` +
      `of adults it covers so a block becomes one person. Name a country to read it there.</em>`;
  }
  else if (p.kind === 'wmultiple') {
    // The same division done twice: what one person at the top owns against one at the
    // bottom, and what one earns against the other. The distance between those two
    // numbers is the argument this atlas exists to make, so both are given together.
    const iso = p.iso || ctx.lastIso || (focusIsos()[0] || null);
    if (!iso || !BY_ISO[iso]) { showNotice('This reads one country. Name a place first.'); return null; }
    const pair = multiplePair(iso);
    if (!pair || (pair.wm == null && pair.im == null)) return miss();
    const all = multipleSweep();
    ctx.metric = 'wealth_top1'; ctx.lastIso = iso; f.isos = [iso];
    f.mode = 'wmultiple'; f.wmultiple = { iso, pair, all };
    const here = esc(theName(iso));
    let lead;
    if (pair.wm != null && pair.im != null) {
      lead = `In <strong>${here}</strong>, one person in the top 1% owns ` +
        `<strong>${roughly(pair.wm)} times</strong> what one person in the poorest half owns ` +
        `(${pair.wYear}), and earns <strong>${roughly(pair.im)} times</strong> as much (${pair.iYear}). ` +
        `The gap in what people own is <strong>${(pair.wm / pair.im).toFixed(0)} times</strong> the gap ` +
        `in what they earn.`;
    } else if (pair.im != null) {
      // the reason first: led by the earning figure, an answer to "how many times more does
      // one person own" read as if it had answered about pay
      lead = `In <strong>${here}</strong> the poorest half <strong>owes more than it owns</strong> ` +
        `(${pair.wYear}), so there is no multiple for owning: there is nothing to divide by. On earning, one ` +
        `person in the top 1% takes <strong>${roughly(pair.im)} times</strong> what one in the poorest half does ` +
        `(${pair.iYear}). That is the far end of this question rather than a gap in it.`;
    } else {
      lead = `In <strong>${here}</strong>, one person in the top 1% owns ` +
        `<strong>${roughly(pair.wm)} times</strong> what one person in the poorest half owns ` +
        `(${pair.wYear}). The atlas holds no income shares for it, so the gap in earning cannot be ` +
        `set beside that.`;
    }
    const across = all.both.length
      ? ` Of ${setLabel(all.both.length)} where both can be worked out, the gap in owning is ` +
        `wider than the gap in earning in ` +
        (all.wider === all.both.length ? `every one` : `${all.wider} of them`) +
        `, and the middle of that set is ${all.medRatio.toFixed(0)} times wider.`
      : '';
    // a multiple built by dividing by a share of one per cent moves a long way on a small
    // revision, and the reading says how far rather than printing four digits
    const shaky = pair.wm != null && pair.wb > 0 && pair.wb < 0.02
      ? ` <em>Read the size of it, not the digits: the poorest half here holds ${pc(pair.wb)}, and ` +
        `moving that by a tenth of a point would put the multiple at ` +
        `${roughly((pair.w1 / 0.01) / ((pair.wb + 0.001) / 0.50))} or ` +
        `${roughly((pair.w1 / 0.01) / ((pair.wb - 0.001) / 0.50))}.</em>`
      : '';
    f.text = lead + across + shaky;
  }

  else if (p.kind === 'multiple') {
    // Shares are per group, and the groups are wildly different sizes, so a share says
    // nothing about a person. Divide each by how many people are in it and you get the
    // thing anyone can picture: what one person at the top takes against one at the bottom.
    const iso = p.iso || ctx.lastIso || (focusIsos()[0] || null);
    if (!iso || !BY_ISO[iso]) { showNotice('This reads one country. Name a place first.'); return null; }
    const T = windowed(seriesOf('income_top1', iso), p.since, p.until);
    const B = windowed(seriesOf('income_bottom50', iso), p.since, p.until);
    if (T.length < 2 || B.length < 2) return tooNarrow(iso, p.since, p.until, 'its income shares');
    const bm = new Map(B.map(d => [d.year, d.v]));
    const pts = [];
    for (const d of T) { const b = bm.get(d.year); if (b) pts.push({ year: d.year, v: (d.v / 0.01) / (b / 0.50) }); }
    if (pts.length < 2) return tooNarrow(iso, p.since, p.until, 'both income shares in the same year');
    // the year to measure against is the narrowest the country ever got, which the series
    // picks for itself. anchoring on a round year instead would be a choice nobody made.
    const last = pts[pts.length - 1];
    const then = pts.reduce((lo, d) => d.v < lo.v ? d : lo, pts[0]);
    ctx.metric = 'income_top1'; ctx.lastIso = iso; f.isos = [iso];
    f.mode = 'multiple'; f.multiple = { iso, pts, then, last };
    const near = Math.abs(last.year - then.year) <= 2;
    // "ever" is only true of the whole record. Once the reader clips the years, the
    // narrowest point is the narrowest in what they asked for, and the sentence says so.
    const clipped = !!(p.since || p.until);
    const span = clipped ? 'came over the years you have set' : 'have ever come';
    f.text = `In <strong>${esc(theName(iso))}</strong>, one person in the top 1% takes ` +
      `<strong>${last.v.toFixed(0)} times</strong> what one person in the bottom half takes (${last.year}). ` +
      (near
        ? `That is as close together as the two got ${clipped ? 'over the years you have set' : 'at any point here'}, ` +
          `across ${pts.length} readings. `
        : `The closest they ${span} was ${then.year}, at <strong>${then.v.toFixed(0)} times</strong>, ` +
          `and the gap is ${(last.v / then.v).toFixed(1)} times wider now than it was then. `) +
      `<em>Each group's share of national income divided by how many people are in it, so a share of ` +
      `a block becomes an income for a person. Pretax, before any tax and before any benefit.</em>`;
  }

  else if (p.kind === 'basket') {
    // The same basket of goods everywhere: PIP reports the median in 2017 purchasing power
    // dollars, so a day in Warsaw and a day in Chicago are priced the same way.
    const iso = p.iso || ctx.lastIso || (focusIsos()[0] || null);
    if (!iso || !BY_ISO[iso]) { showNotice('This reads one country. Name a place first.'); return null; }
    const m = windowed(seriesOf('median_income', iso), p.since, p.until);
    if (m.length < 2) return tooNarrow(iso, p.since, p.until, 'a median income');
    const a = m[0], z = m[m.length - 1];
    // the ranking is taken at this country's own latest year, not against whatever each
    // other country last happened to report: a 2019 median against a 2012 one is not a rank
    const pool = poolAt('median_income', z.year).slice().sort((x, y) => y.val - x.val);
    const rk = pool.findIndex(r => r.geo_id === iso) + 1;
    ctx.metric = 'median_income'; ctx.lastIso = iso; f.isos = [iso];
    f.mode = 'basket'; f.basket = { iso, pts: m, rank: rk, of: pool.length, at: z.year };
    const yr = v => '$' + Math.round(v * 365).toLocaleString('en-US');
    const grew = z.v / a.v;
    f.text = `The person in the middle of <strong>${esc(theName(iso))}</strong> lives on ` +
      `<strong>$${z.v.toFixed(2)} a day</strong>, which is ${yr(z.v)} over a year (${z.year}). ` +
      `In ${a.year} it was <strong>$${a.v.toFixed(2)}</strong>, so the middle has ` +
      (grew >= 1.05 ? `${grew.toFixed(1)} times as much to live on as it did then` :
       grew <= 0.95 ? `${(1 / grew).toFixed(1)} times less to live on than it did then` :
       `about what it had then`) + '. ' +
      (rk ? `Among the ${pool.length} countries that also report around ${z.year}, that is ` +
        `<strong>${ordinal(rk)}</strong>. ` : '') +
      `<em>Priced in 2017 purchasing power dollars, which means the same basket of goods costs the ` +
      `same number of dollars everywhere on this measure. Household income after tax and after ` +
      `benefits, one reading per survey.</em>`;
  }

  else if (p.kind === 'three') {
    // WID's own preferred cut, and the one that answers "what happened to the middle":
    // a country divided into the top tenth, the middle forty per cent, and the bottom half.
    const iso = p.iso || ctx.lastIso || (focusIsos()[0] || null);
    if (!iso || !BY_ISO[iso]) { showNotice('This reads one country. Name a place first.'); return null; }
    const T = windowed(seriesOf('income_top10', iso), p.since, p.until);
    const M = windowed(seriesOf('income_middle40', iso), p.since, p.until);
    const B = windowed(seriesOf('income_bottom50', iso), p.since, p.until);
    if (T.length < 2 || M.length < 2 || B.length < 2) return tooNarrow(iso, p.since, p.until, 'all three income shares');
    const lo = Math.max(T[0].year, M[0].year, B[0].year);
    const t = T.filter(d => d.year >= lo), mm = M.filter(d => d.year >= lo), b = B.filter(d => d.year >= lo);
    const hi = Math.min(t[t.length - 1].year, mm[mm.length - 1].year, b[b.length - 1].year);
    const at = (arr, y) => { const q = arr.filter(d => d.year <= y); return q.length ? q[q.length - 1].v : arr[0].v; };
    // the year the middle held the most is the year to measure from, and the series picks
    // it. reading 1913 against 2021 in the United States nets off a fall and a rise that
    // happened to be the same size, and reports that nothing happened.
    const pk = mm.reduce((best, d) => d.v > best.v ? d : best, mm[0]);
    const from = pk.year - lo <= 3 ? lo : pk.year;
    const sg = v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' points';
    const mv = arr => sg((at(arr, hi) - at(arr, from)) * 100);
    ctx.metric = 'income_middle40'; ctx.lastIso = iso; f.isos = [iso];
    f.mode = 'three'; f.three = { iso, t, m: mm, b, lo, hi, from, peak: pk };
    // the same care as above: with the years clipped, "the most it has ever held" becomes
    // "the most it held in what you asked for", and "where the record opens" becomes
    // "where you started it"
    const clipped = !!(p.since || p.until);
    f.text = `<strong>${cap(esc(theName(iso)))}</strong> cut into three. From ${from}, ` +
      (from === lo
        ? (clipped ? `where you have started the run` : `where this record opens`)
        : `the year the middle forty per cent held its largest share of national income ` +
          (clipped ? `anywhere in this stretch` : `on record here`)) +
      `, to ${hi}: the ` +
      `middle went from <strong>${pc(at(mm, from))}</strong> to <strong>${pc(at(mm, hi))}</strong>, ` +
      `${mv(mm)}. The top tenth went from <strong>${pc(at(t, from))}</strong> to ` +
      `<strong>${pc(at(t, hi))}</strong>, ${mv(t)}. The bottom half from ` +
      `<strong>${pc(at(b, from))}</strong> to <strong>${pc(at(b, hi))}</strong>, ${mv(b)}. ` +
      `<em>The three are the whole country and add to a hundred at every point, so a point one group ` +
      `gains is a point another loses. ` +
      (clipped
        ? `The years are the ones you set; clear them to read the whole record, which runs further ` +
          `back in most countries than this.`
        : from === lo ? `${cap(theName(iso))} carries no reading before ${lo}, so what came earlier is ` +
            `outside the atlas rather than flat.`
        : `The record opens in ${lo} and the chart draws all of it. Reading ${lo} straight against ` +
          `${hi} would set a fall and a rise against each other and report that nothing happened.`) +
      `</em>`;
  }

  else if (p.kind === 'houses') {
    // the price of a house against what people earn, both after inflation, both from 100.
    // the same shape as growth against the middle, because it is the same question with
    // the thing the growth went into on the top line.
    const iso = p.iso || ctx.lastIso || (focusIsos()[0] || null);
    if (!iso || !BY_ISO[iso]) { showNotice('Name a country: this holds house prices against what people there earn.'); return null; }
    const h = seriesOf('house_price', iso), m = seriesOf('median_income', iso);
    if (h.length < 2) {
      showNotice(housesMissing(iso));
      return null;
    }
    if (m.length < 2) return miss();
    const base = Math.max(h[0].year, m[0].year);
    const gs = h.filter(d => d.year >= base), ms = m.filter(d => d.year >= base);
    if (gs.length < 2 || ms.length < 2) return miss();
    const both = Math.min(gs[gs.length - 1].year, ms[ms.length - 1].year);
    const at = (a, y) => { const q = a.filter(d => d.year <= y); return q.length ? q[q.length - 1].v : a[0].v; };
    const gPct = (at(gs, both) / gs[0].v - 1) * 100, mPct = (at(ms, both) / ms[0].v - 1) * 100;
    ctx.lastIso = iso; f.isos = [iso];
    f.mode = 'reach';
    f.reach = { iso, base, gs, ms, gPct, mPct, houses: true,
      labels: { top: 'the price of a house', mid: 'what people earn' } };
    const pc1 = v => (v >= 0 ? '+' : '') + v.toFixed(0) + '%';
    f.text = `In <strong>${esc(theName(iso))}</strong> from ${base} to ${both}, the price of a house rose ` +
      `<strong>${pc1(gPct)}</strong> after inflation. What the typical household earns rose ` +
      `<strong>${pc1(mPct)}</strong>.` +
      (gPct - mPct > 20 ? ' Houses pulled away from pay.' : gPct - mPct < -20 ? ' Pay pulled away from houses.' : '') +
      houseRatio(iso) +
      ` <em>Pay here is median household income after transfers, not the individual earnings the usual ` +
      `house-price-to-earnings ratio divides by: same direction, smaller gap. The median rests on ` +
      `${ms.length} survey${ms.length === 1 ? '' : 's'}.</em>`;
  }

  else if (p.kind === 'ratio') {
    // The top tenth against the bottom half, as a multiple anyone can hold in their head.
    // In five countries the poorest half owns less than nothing, so there is no multiple
    // to quote: you cannot divide by a negative and get a number that means anything.
    // Those countries are named rather than dropped, because they are the far end of the
    // same question, not a gap in it.
    // the same set every other ranking on this page uses: most of the 213 countries are
    // regional fills rather than measurements, and a middle of the pack taken over those
    // describes the model, not the world
    const rt = rankNarrowed() ? richThird() : null;
    const usable = LATEST.filter(x => x.top10_wealth_share != null && x.bottom50_wealth_share != null
      && (!rt || rt.has(x.geo_id)) && inScope(x.geo_id, null));
    const rows = usable.filter(x => x.bottom50_wealth_share > 0.0005)
      .map(x => ({ geo_id: x.geo_id, geo_name: x.geo_name, val: x.top10_wealth_share / x.bottom50_wealth_share, year: x.year }))
      .sort((a, b) => b.val - a.val);
    const owing = usable.filter(x => x.bottom50_wealth_share <= 0.0005)
      .map(x => ({ geo_id: x.geo_id, geo_name: x.geo_name, v: x.bottom50_wealth_share, year: x.year }))
      .sort((a, b) => a.v - b.v);
    if (!rows.length) return miss();
    const iso = p.iso || ctx.lastIso || null;
    let hit = iso ? rows.find(x => x.geo_id === iso) : null;
    const owe = iso ? owing.find(x => x.geo_id === iso) : null;
    const med = rows[Math.floor(rows.length / 2)];
    // a country outside the set the ranking runs on was dropped without a word: China in
    // the place fold, and an answer about the United States and Estonia. it is read on
    // its own now and the sentence says it sits outside the set
    let outside = null, noFigure = false;
    if (iso && !hit && !owe) {
      const r = LATEST.find(x => x.geo_id === iso);
      if (r && r.top10_wealth_share != null && r.bottom50_wealth_share != null && r.bottom50_wealth_share > 0.0005)
        outside = { geo_id: iso, val: r.top10_wealth_share / r.bottom50_wealth_share, year: r.year };
      else noFigure = true;
    }
    f.mode = 'ratio';
    f.ratio = { rows, owing, highlight: hit ? hit.geo_id : owe ? owe.geo_id : null,
      inRanking: !!hit };
    const names = a => a.length === 1 ? esc(theName(a[0].geo_id))
      : a.slice(0, -1).map(x => esc(theName(x.geo_id))).join(', ') + ' and ' + esc(theName(a[a.length - 1].geo_id));
    const set = setLabel(rows.length);
    const tail = owing.length
      ? ` In ${names(owing)} there is no multiple to give, because the poorest half there owes more ` +
        `than it owns. ${owing.length === 1 ? 'That country sits' : 'Those sit'} outside both the ranking ` +
        `and the middle of the pack.`
      : '';
    if (owe) {
      ctx.lastIso = owe.geo_id; f.isos = [owe.geo_id];
      f.text = `In <strong>${esc(theName(owe.geo_id))}</strong> the poorest half of adults owns ` +
        `<strong>less than nothing</strong>, so there is no multiple to give: the richest tenth hold more than ` +
        `everything there is. The poorest half's debts come to ${pc(Math.abs(owe.v))} of all the household ` +
        `wealth in the country more than their assets do (${owe.year}). Where the poorest half ` +
        `does own something, the widest gap among ${set} is ${rows[0].val.toFixed(1)} times, in ` +
        `${esc(theName(rows[0].geo_id))}, and the middle of that pack is ${med.val.toFixed(1)} times.` +
        (owing.length > 1 ? ` ${owing.length - 1} other ${owing.length === 2 ? 'country is' : 'countries are'} in the same position: ` +
          names(owing.filter(x => x.geo_id !== owe.geo_id)) + '.' : '');
    } else if (hit) {
      ctx.lastIso = hit.geo_id; f.isos = [hit.geo_id];
      f.text = `In <strong>${esc(theName(hit.geo_id))}</strong> the richest tenth hold ` +
        `<strong>${hit.val.toFixed(1)} times</strong> what the poorest half hold (${hit.year}). ` +
        `Across ${set} the middle of the pack is ${med.val.toFixed(1)} times.` + tail;
    } else if (outside) {
      ctx.lastIso = iso; f.isos = [iso];
      f.text = `In <strong>${esc(theName(iso))}</strong> the richest tenth hold <strong>${outside.val.toFixed(1)} times</strong> ` +
        `what the poorest half hold (${outside.year}). It sits outside ${set}, the set this reading ranks by default, where ` +
        `the middle of the pack is ${med.val.toFixed(1)} times and the widest gap is ${rows[0].val.toFixed(1)} times, in ` +
        `${esc(theName(rows[0].geo_id))}.`;
    } else {
      f.text = (noFigure ? `There is no top tenth and bottom half split of wealth for <strong>${esc(theName(iso))}</strong> here, ` +
        'so this is the ranking without it. ' : '') +
        `The richest tenth hold <strong>${rows[0].val.toFixed(1)} times</strong> what the poorest half hold in ` +
        `${esc(theName(rows[0].geo_id))}, ${rows[1].val.toFixed(1)} times in ${esc(theName(rows[1].geo_id))}. ` +
        `Across ${set} the middle of the pack is <strong>${med.val.toFixed(1)} times</strong>.` + tail;
    }
  }

  else if (p.kind === 'turn') {
    // the turn is found in the data first. we do not go looking around an episode we
    // already believe in, because that only ever finds what it went looking for.
    const key = META[ctx.metric] && META[ctx.metric].series ? ctx.metric : facetIneqDefault();
    const m = META[key];
    const iso = p.iso || cell.place || ctx.lastIso;
    if (!iso || !BY_ISO[iso]) { showNotice('This one reads one country. Add a place first.'); return null; }
    const ser = seriesOf(key, iso);
    const SPAN = 6;
    if (ser.length < SPAN + 1) return miss();
    const at = {}; ser.forEach(d => { at[d.year] = d.v; });
    let best = null;
    for (const d of ser) {
      const y2 = d.year + SPAN;
      if (at[y2] == null) continue;
      const dv = at[y2] - d.v;
      if (!best || Math.abs(dv) > Math.abs(best.dv)) best = { a: d.year, b: y2, dv };
    }
    if (!best) return miss();
    const ev = eventsNear(iso, best.a, best.b);
    ctx.lastIso = iso;
    f.isos = [iso]; f.mode = 'turn'; f.metricUsed = key;
    f.turn = { iso, key, ser, a: best.a, b: best.b, dv: best.dv, span: SPAN, events: ev };
    const dir = best.dv >= 0 ? 'rose' : 'fell';
    f.text = `The sharpest ${SPAN} years for ${m.label} in <strong>${esc(theName(iso))}</strong> ` +
      `were <strong>${best.a} to ${best.b}</strong>, when it ${dir} ` +
      `<strong>${m.fmtD(Math.abs(best.dv))}</strong>. ` +
      (ev.length
        ? `What was going on then, or in the ${EVENT_LAG} years before: ` +
          ev.map(e => `${esc(e.k)} (${e.a === e.b ? e.a : e.a + ' to ' + e.b})`).join(', ') + '. '
        : `Nothing in the atlas's event list falls in that window or the ${EVENT_LAG} years before it. `) +
      `<em>The window was chosen by the size of the move, not by the events. Nothing here says ` +
      `one caused the other.</em>`;
  }

  else if (p.kind === 'peers') {
    // never before and after on its own: the world moved too. the question is whether
    // this country moved differently from countries starting in a similar place.
    const key = META[ctx.metric] && META[ctx.metric].series ? ctx.metric : facetIneqDefault();
    const m = META[key];
    const iso = p.iso || cell.place || ctx.lastIso;
    if (!iso || !BY_ISO[iso]) { showNotice('This one holds a country against its peers. Add a place first.'); return null; }
    const own = seriesOf(key, iso);
    if (own.length < 2) return miss();
    let b = p.until || own[own.length - 1].year;
    // peers are countries in the same third of GDP per person, which is a stated rule
    // rather than a hand-picked club
    const gp = rankedPool('gdp_pc', 'high', null);
    const meAt = gp.findIndex(rr => rr.geo_id === iso);
    const third = gp.length ? Math.floor(gp.length / 3) : 0;
    const bandOf = k => k < third ? 0 : k < 2 * third ? 1 : 2;
    const myBand = meAt >= 0 ? bandOf(meAt) : null;
    const val = (i, y) => { const s2 = seriesOf(key, i); const h = s2.filter(d => d.year <= y);
      return h.length && h[h.length - 1].year >= y - 2 ? h[h.length - 1].v : null; };
    // with no start year asked for, the window opens at the first year enough of the
    // peers carry the measure. opening at the country's own first year meant a series
    // reaching back to 1900 was compared with nobody, and the reading refused. the
    // sentence names the years either way
    let a = p.year || own[0].year;
    const band = gp.filter((rr, k) => rr.geo_id !== iso && (myBand == null || bandOf(k) === myBand));
    const peersAt = (y1, y2) => band.filter(rr => val(rr.geo_id, y1) != null && val(rr.geo_id, y2) != null).length;
    // the same for the end: a country whose record runs to 2021 while its peers stop in
    // 2017 is held to the last year they share, ten peers if there are, six if not
    for (const need of [10, 6]) {
      let bb = b, aa = a;
      if (!p.until) { bb = null; for (let y = own[own.length - 1].year; y >= own[0].year + 3; y--)
        if (val(iso, y) != null && peersAt(y, y) >= need) { bb = y; break; } }
      if (bb == null) continue;
      if (!p.year) { aa = null; for (let y = own[0].year; y <= bb - 3; y++)
        if (val(iso, y) != null && peersAt(y, bb) >= need) { aa = y; break; } }
      if (aa == null) continue;
      a = aa; b = bb; break;
    }
    if (b - a < 3) { showNotice('Hold it over at least a few years, or there is nothing to compare.'); return null; }
    const moves = [];
    for (const rr of gp) {
      if (myBand != null && bandOf(gp.indexOf(rr)) !== myBand) continue;
      const va = val(rr.geo_id, a), vb = val(rr.geo_id, b);
      if (va == null || vb == null) continue;
      moves.push({ iso: rr.geo_id, name: BY_ISO[rr.geo_id].name, dv: vb - va });
    }
    // a country with no GDP figure is in no band; it is still measured against everyone
    if (!moves.some(x => x.iso === iso) && val(iso, a) != null && val(iso, b) != null)
      moves.push({ iso, name: BY_ISO[iso].name, dv: val(iso, b) - val(iso, a) });
    if (moves.length < 6) { showNotice('Too few comparable countries carry this measure over those years.'); return null; }
    moves.sort((x, y) => y.dv - x.dv);
    const mine = moves.find(x => x.iso === iso);
    if (!mine) return miss();
    const others = moves.filter(x => x.iso !== iso).map(x => x.dv).sort((x, y) => x - y);
    const med = others[Math.floor(others.length / 2)];
    const rank = moves.findIndex(x => x.iso === iso) + 1;
    ctx.lastIso = iso;
    f.isos = [iso]; f.mode = 'peers'; f.metricUsed = key;
    f.peers = { iso, key, a, b, moves, med, rank, band: myBand };
    const sgn = v => (v >= 0 ? '+' : '-') + m.fmtD(Math.abs(v));
    const bandName = myBand === 0 ? 'the richest third of countries'
      : myBand === 1 ? 'the middle third by income per person' : 'the poorest third of countries';
    f.text = `From ${a} to ${b}, ${m.label} in <strong>${esc(theName(iso))}</strong> moved ` +
      `<strong>${sgn(mine.dv)}</strong>. Across ${moves.length - 1} comparable countries the middle ` +
      `one moved <strong>${sgn(med)}</strong>, which puts it <strong>${ordinal(rank)} of ` +
      `${moves.length}</strong>. The gap against the middle is <strong>${sgn(mine.dv - med)}</strong>. ` +
      `<em>Peers are ${bandName}, by GDP per person, which is how the set was chosen rather than ` +
      `hand-picked. Subtracting them takes out what moved everybody.</em>`;
  }

  else if (p.kind === 'tables') {
    // rank every country twice, by what the top 1% earns and by what it owns, and
    // put the two ranks against each other. a country on the diagonal is ranked the
    // same way by both. the distance off it is the whole argument of the atlas.
    const X = 'income_top1', Y = 'wealth_top1';
    if (!SERIES[X] || !SERIES[Y]) return miss();
    const pts = [];
    for (const iso in BY_ISO) {
      if (!inScope(iso, p.region)) continue;
      const xs = seriesOf(X, iso), ys = seriesOf(Y, iso);
      if (!xs.length || !ys.length) continue;
      const ym = new Map(ys.map(d => [d.year, d.v]));
      let hit = null;
      for (let i = xs.length - 1; i >= 0; i--) if (ym.has(xs[i].year)) {
        hit = { year: xs[i].year, x: xs[i].v, y: ym.get(xs[i].year) }; break;
      }
      if (hit) pts.push({ iso, name: BY_ISO[iso].name, year: hit.year, inc: hit.x, wea: hit.y });
    }
    if (pts.length < 12) return miss();
    const byInc = pts.slice().sort((a, b) => b.inc - a.inc);
    const byWea = pts.slice().sort((a, b) => b.wea - a.wea);
    byInc.forEach((q, i) => { q.ri = i + 1; });
    byWea.forEach((q, i) => { q.rw = i + 1; });
    const n = pts.length;
    const dsq = pts.reduce((t, q) => t + (q.ri - q.rw) * (q.ri - q.rw), 0);
    const rho = 1 - 6 * dsq / (n * (n * n - 1));
    // the countries the two tables disagree about most, which is what to label
    const far = pts.slice().sort((a, b) => Math.abs(b.ri - b.rw) - Math.abs(a.ri - a.rw));
    const focus = (p.isos && p.isos.length ? p.isos : (ctx.lastIso ? [ctx.lastIso] : []))
      .filter(i => pts.some(q => q.iso === i));
    ctx.metric = Y;
    f.mode = 'tables';
    f.tables = { pts, rho, x: X, y: Y, focus, far: far.slice(0, 3).map(q => q.iso) };
    f.isos = focus;
    const yrs = pts.map(q => q.year);
    let t = `Ranked by what the top 1% earns and by what it owns, ${n} countries make two ` +
      `different tables. They agree at <strong>${rho.toFixed(2)}</strong> ` +
      `(${rho > 0.7 ? 'closely' : rho > 0.4 ? 'loosely' : 'barely'}); a single ranking would ` +
      `be one of them pretending to be both.`;
    if (focus.length) {
      t += ' ' + focus.map(i => {
        const q = pts.find(z => z.iso === i);
        return `<strong>${esc(q.name)}</strong> is ${ordinal(q.ri)} on income and ` +
          `<strong>${ordinal(q.rw)}</strong> on wealth`;
      }).join('; ') + '.';
    } else {
      const w = far[0];
      t += ` The two disagree most about <strong>${esc(w.name)}</strong>: ${ordinal(w.ri)} on ` +
        `income, ${ordinal(w.rw)} on wealth. Name a country to find your own.`;
    }
    t += ` <em>Each country at the latest year both were measured (${Math.min(...yrs)} to ` +
      `${Math.max(...yrs)}).</em>`;
    f.text = t;
  }

  else if (p.kind === 'triple') {
    // the same top hundredth in wealth and in income, against how long people live:
    // three faces of the cube, and the two economic ones now read the same way
    const X = 'wealth_top1', Y = SERIES.income_top1 ? 'income_top1' : 'income_gini', Z = 'life_exp';
    const pts = [];
    for (const iso in BY_ISO) {
      const xs = seriesOf(X, iso), ys = seriesOf(Y, iso), zs = seriesOf(Z, iso);
      if (!xs.length || !ys.length || !zs.length) continue;
      const ym = new Map(ys.map(d => [d.year, d.v])), zm = new Map(zs.map(d => [d.year, d.v]));
      let hit = null;
      for (let i = xs.length - 1; i >= 0; i--) {
        const yr = xs[i].year;
        if (ym.has(yr) && zm.has(yr)) { hit = { year: yr, x: xs[i].v, y: ym.get(yr), z: zm.get(yr) }; break; }
      }
      if (hit) pts.push({ iso, name: BY_ISO[iso].name, year: hit.year, x: hit.x, y: hit.y, z: hit.z });
    }
    if (pts.length < 10) return miss();
    ctx.metric = X;
    f.mode = 'triple';
    f.triple = { pts, x: X, y: Y, z: Z };
    const want = (p.isos && p.isos.length ? p.isos : (ctx.lastIso ? [ctx.lastIso] : []))
      .filter(i => pts.some(q => q.iso === i));
    f.isos = want;
    const yrs = pts.map(q => q.year);
    const mx = META[X], my = META[Y], mz = META[Z];
    // a phone draws this flat, with the third measure as the colour of each dot
    const flat = matchMedia('(max-width: 720px)').matches;
    let t = `Every country is one point, placed by three numbers at once: ` +
      (flat ? `${mx.label} across, ${my.label} up, ${mz.label} as the colour of the dot. `
        : `${mx.label} across, ${my.label} deep, ${mz.label} up. `) +
      `<strong>${pts.length} countries</strong> carry all three, each at the latest year all three ` +
      `were measured (${Math.min(...yrs)} to ${Math.max(...yrs)}).`;
    if (want.length) {
      const hits = want.map(i => pts.find(q => q.iso === i));
      t += ' ' + hits.map(h => `<strong>${esc(h.name)}</strong> sits at ${mx.fmt(h.x)} wealth, ` +
        `${my.fmt(h.y)} income, ${mz.fmt(h.z)} (${h.year})`).join('; ') + '.';
    } else {
      t += flat ? ' Name a country to have it marked.' : ' Name a country to have it marked and its three readings dropped to the walls.';
    }
    f.text = t;
  }

  else if (p.kind === 'break') {
    // fit the current relationship, name who sits furthest from the robust line
    let x, y;
    const lastSc = chain.slice().reverse().find(ff => ff.scatter);
    if (lastSc) { x = lastSc.scatter.x; y = lastSc.scatter.y; }
    else { x = isIneq(ctx.metric) ? ctx.metric : facetIneqDefault(); y = ctx.lastAspect; }
    const aspNamed = p.metrics.find(m => !isIneq(m) && META[m].series);
    if (aspNamed) y = aspNamed;
    if (!y) y = SERIES.life_exp ? 'life_exp' : 'income_gini';   // a sensible relationship to break by default
    const mx = META[x], my = META[y];
    const pts = pairedPoints(x, y, null, p.year);
    const fit = theilSen(pts);
    if (!fit || pts.length < 8) return miss();
    for (const pt of pts) pt.resid = pt.y - (fit.slope * pt.x + fit.intercept);
    const sorted = pts.slice().sort((a, b) => b.resid - a.resid);
    const over = sorted.slice(0, 2), under = sorted.slice(-2).reverse();
    ctx.metric = x; if (!isIneq(y)) ctx.lastAspect = y;
    const focus = focusIsos().filter(i => pts.some(pt => pt.iso === i));
    const labelIsos = [...over, ...under].map(p => p.iso);
    if (focus.length) { f.isos = focus; ctx.lastIso = focus[focus.length - 1]; }
    f.mode = 'scatter';
    f.scatter = { x, y, pts, r: pearson(pts), region: null, focus, fit, labelIsos };
    const say = a => `${esc(a.name)} <strong>${my.fmtD(Math.abs(a.resid))}</strong> ${a.resid >= 0 ? 'above' : 'below'}`;
    let t = `Against ${mx.label}, the countries furthest off the line: ` +
      `${say(over[0])} and ${say(over[1])} what their inequality predicts on ${my.label}; ` +
      `${say(under[0])} and ${say(under[1])}.`;
    if (focus.length === 1) {
      const pt = pts.find(x => x.iso === focus[0]);
      t += ` ${esc(pt.name)} sits <strong>${my.fmtD(Math.abs(pt.resid))}</strong> ${pt.resid >= 0 ? 'above' : 'below'} the line.`;
    }
    f.text = t;
  }

  else if (p.kind === 'divergence') {
    // the same top hundredth, once in what it owns and once in what it earns. both are
    // shares of a total on the same WID basis, so they go on one axis in levels.
    // indexing them would mislead: see FOUNDATION.md section 4.
    const iso = p.iso;
    if (!iso || !BY_ISO[iso]) { showNotice('This one reads one country. Name a place.'); return null; }
    const W = seriesOf('wealth_top1', iso), I = seriesOf('income_top1', iso);
    if (W.length < 3 || I.length < 3) {
      showNotice(`The atlas does not hold both a wealth and an income top 1% share for ` +
        `${esc(BY_ISO[iso].name)}. Try a country with tax records behind it.`);
      return null;
    }
    const lo = Math.max(W[0].year, I[0].year);
    const w = W.filter(d => d.year >= lo), i = I.filter(d => d.year >= lo);
    if (w.length < 2 || i.length < 2) return miss();
    const both = Math.min(w[w.length - 1].year, i[i.length - 1].year);
    const at = (arr, y) => { const m2 = arr.filter(d => d.year <= y); return m2.length ? m2[m2.length - 1].v : arr[0].v; };
    const dw = at(w, both) - w[0].v, di = at(i, both) - i[0].v;
    ctx.metric = 'wealth_top1'; ctx.lastIso = iso; f.isos = [iso];
    f.mode = 'divergence'; f.diverge = { iso, w, i, lo, both };
    const pp = v => (v >= 0 ? '+' : '') + (v * 100).toFixed(1);
    f.text = `In <strong>${esc(theName(iso))}</strong>, the top 1% took ` +
      `<strong>${pc(i[0].v)}</strong> of national income in ${lo} and held ` +
      `<strong>${pc(w[0].v)}</strong> of national wealth. By ${both} that was ` +
      `<strong>${pc(at(i, both))}</strong> and <strong>${pc(at(w, both))}</strong>: ` +
      `${pp(di)} points of income against ${pp(dw)} of wealth. ` +
      `<em>Both are WID, per adult, split equally within the couple, so the two can be read ` +
      `against each other directly.</em>`;
  }

  else if (p.kind === 'break') {
    // fit the current relationship, name who sits furthest from the robust line
    let x, y;
    const lastSc = chain.slice().reverse().find(ff => ff.scatter);
    if (lastSc) { x = lastSc.scatter.x; y = lastSc.scatter.y; }
    else { x = isIneq(ctx.metric) ? ctx.metric : facetIneqDefault(); y = ctx.lastAspect; }
    const aspNamed = p.metrics.find(m => !isIneq(m) && META[m].series);
    if (aspNamed) y = aspNamed;
    if (!y) y = SERIES.life_exp ? 'life_exp' : 'income_gini';   // a sensible relationship to break by default
    const mx = META[x], my = META[y];
    const pts = pairedPoints(x, y, null, p.year);
    const fit = theilSen(pts);
    if (!fit || pts.length < 8) return miss();
    for (const pt of pts) pt.resid = pt.y - (fit.slope * pt.x + fit.intercept);
    const sorted = pts.slice().sort((a, b) => b.resid - a.resid);
    const over = sorted.slice(0, 2), under = sorted.slice(-2).reverse();
    ctx.metric = x; if (!isIneq(y)) ctx.lastAspect = y;
    const focus = focusIsos().filter(i => pts.some(pt => pt.iso === i));
    const labelIsos = [...over, ...under].map(p => p.iso);
    if (focus.length) { f.isos = focus; ctx.lastIso = focus[focus.length - 1]; }
    f.mode = 'scatter';
    f.scatter = { x, y, pts, r: pearson(pts), region: null, focus, fit, labelIsos };
    const say = a => `${esc(a.name)} <strong>${my.fmtD(Math.abs(a.resid))}</strong> ${a.resid >= 0 ? 'above' : 'below'}`;
    let t = `Against ${mx.label}, the countries furthest off the line: ` +
      `${say(over[0])} and ${say(over[1])} what their inequality predicts on ${my.label}; ` +
      `${say(under[0])} and ${say(under[1])}.`;
    if (focus.length === 1) {
      const pt = pts.find(x => x.iso === focus[0]);
      t += ` ${esc(pt.name)} sits <strong>${my.fmtD(Math.abs(pt.resid))}</strong> ${pt.resid >= 0 ? 'above' : 'below'} the line.`;
    }
    f.text = t;
  }

  // There is no second divergence branch. One stood here reading the Fed's
  // distributional accounts for the United States and WID for everyone else, which put
  // the US top 1% at 30.6 per cent against WID's 35.1 for the same year and the same
  // idea. It sat unreachable behind the branch above, and is gone rather than left to
  // be found and used.

  else if (p.kind === 'path') {
    const mx = META[p.x], my = META[p.y];
    const sx = seriesOf(p.x, p.iso), sy = seriesOf(p.y, p.iso);
    const yv = {}; for (const d of sy) yv[d.year] = d.v;
    const pts = sx.filter(d => yv[d.year] != null).map(d => ({ year: d.year, x: d.v, y: yv[d.year] }));
    if (pts.length < 3) return miss();
    ctx.metric = p.x; ctx.lastAspect = p.y; ctx.lastIso = p.iso; f.isos = [p.iso];
    f.mode = 'path'; f.path = { iso: p.iso, x: p.x, y: p.y, pts };
    const a = pts[0], z = pts[pts.length - 1];
    f.text = `<strong>${esc(BY_ISO[p.iso].name)}</strong>'s path, ${a.year} to ${z.year}: as ${mx.label} went ` +
      `<strong>${mx.fmt(a.x)}</strong> to <strong>${mx.fmt(z.x)}</strong>, ${my.label} went ` +
      `<strong>${my.fmt(a.y)}</strong> to <strong>${my.fmt(z.y)}</strong>.`;
  }

  else if (p.kind === 'among') {
    ctx.pool = p.pool; computePool();
    if (!p.pool || p.pool.all) setRegion(null);   // "all countries" also drops any region
    // always apply the pool to a real question: the last one, or the everyday health cut
    const base = ctx.lastQuery || (ctx.lastAspect && ASPECT_CHIP[ctx.lastAspect]) || 'life expectancy and inequality';
    const inner = answer(base);
    if (!inner) { ctx.pool = null; computePool(); return null; }
    inner.id = f.id; inner.query = q;      // this line represents the AMONG move
    const label = p.pool ? p.pool.label : 'all countries';
    if (!/among /i.test(inner.text)) inner.text = inner.text.replace(/\s*$/, '') + ` <em>among ${label}</em>`;
    return inner;
  }

  else if (p.kind === 'tiers') {
    const my = META[p.aspect], ml = META[p.lens];
    const { hi, lo } = terciles(p.lens, p.region, p.year);
    if (hi == null || lo == null) {
      showNotice(`Too few countries carry ${ml.label} within ${POOL_YEAR_TOL} years of ${p.year} to cut into thirds.`);
      return null;
    }
    const groups = { high: [], mid: [], low: [] };
    const yrsUsed = [];
    for (const iso in BY_ISO) {
      if (!inScope(iso, p.region)) continue;
      const lv = valAt(p.lens, iso, p.year), av = valAt(p.aspect, iso, p.year);
      if (!lv || !av) continue;
      yrsUsed.push(lv.year, av.year);
      const g = lv.val >= hi ? 'high' : lv.val <= lo ? 'low' : 'mid';
      groups[g].push(av.val);
    }
    if (!groups.high.length || !groups.low.length) return miss();
    if (!isIneq(p.aspect)) ctx.lastAspect = p.aspect;
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    const mh = mean(groups.high), mm = mean(groups.mid), mlo = mean(groups.low);
    ctx.metric = p.lens;
    f.mode = 'tiers';
    f.tiers = { aspect: p.aspect, lens: p.lens, rows: [
      { label: `Most unequal third`, val: mh, n: groups.high.length },
      { label: `Middle third`, val: mm, n: groups.mid.length },
      { label: `Least unequal third`, val: mlo, n: groups.low.length },
    ] };
    const dir = mh > mlo ? 'higher' : 'lower';
    const n = groups.high.length + groups.mid.length + groups.low.length;
    f.text = `Grouping countries by ${ml.label}${poolNote()}${p.year ? ' in ' + p.year : ''}: ` +
      `the most unequal third average <strong>${my.fmt(mh)}</strong> on ${my.label}, the least unequal ` +
      `third <strong>${my.fmt(mlo)}</strong> (${dir} where inequality is greater). ` +
      `<em>${n} countries carry both` +
      (p.year && yrsUsed.length ? `, each at its nearest reading within ${POOL_YEAR_TOL} years ` +
        `(${Math.min(...yrsUsed)} to ${Math.max(...yrsUsed)})` : '') + `.</em>`;
  }

  else if (p.kind === 'lorenz') {
    const isos = (p.isos || []).filter(i => BY_ISO[i] && BY_ISO[i].latest.bottom50_wealth_share != null).slice(0, 5);
    if (!isos.length) { showNotice('Name a country to draw its wealth Lorenz curve.'); return null; }
    f.mode = 'lorenz'; f.isos = isos; ctx.lastIso = isos[isos.length - 1];
    f.lorenz = { isos };
    const bits = isos.map(i => {
      const c = BY_ISO[i].latest;
      return `<strong>${esc(BY_ISO[i].name)}</strong> ${pc(c.bottom50_wealth_share)} and ` +
        `${pc(c.top10_wealth_share)}`;
    });
    f.text = `The share held by the bottom half, and by the top tenth: ${bits.join('; ')}.` +
      (p.isos && p.isos.length > isos.length
        ? ` <em>${p.isos.length - isos.length} of the countries chosen carry no wealth split, so ` +
          `${p.isos.length - isos.length === 1 ? 'it is' : 'they are'} not drawn.</em>` : '');
  }

  else if (p.kind === 'spread') {
    const key = p.metric && META[p.metric].series ? p.metric : (META[ctx.metric].series ? ctx.metric : 'wealth_gini');
    ctx.metric = key;
    const m = META[key];
    const pool = rankedPool(key, 'high', p.region, p.year);
    if (pool.length < 3) {
      if (p.year) { showNotice(`Too few countries carry ${m.label} within ${POOL_YEAR_TOL} years of ${p.year} to show a spread.`); return null; }
      return miss();
    }
    const med = medianOf(pool.map(r => r.val));
    const want = (p.focus && p.focus.length ? p.focus : focusIsos());
    const foc = want.filter(i => pool.some(r => r.geo_id === i));
    if (foc.length) { f.isos = foc; ctx.lastIso = foc[foc.length - 1]; }
    f.mode = 'strip';
    f.strip = { key, pool, region: p.region, focus: foc, atYear: p.year || null };
    const where = p.region ? ` in ${REGION_LABEL[p.region]}` : '';
    const yrs = pool.map(r => r.year).filter(Boolean);
    f.text = `${cap(m.label)}${where}${poolNote()}${p.year ? ' in ' + p.year : ''} ranges from ` +
      `<strong>${m.fmt(pool[pool.length - 1].val)}</strong> ` +
      `(${esc(pool[pool.length - 1].geo_name)}) to <strong>${m.fmt(pool[0].val)}</strong> ` +
      `(${esc(pool[0].geo_name)}), median <strong>${m.fmt(med)}</strong>, across ${pool.length} countries.` +
      (p.year && yrs.length ? ` <em>Each at its nearest reading within ${POOL_YEAR_TOL} years ` +
        `(${Math.min(...yrs)} to ${Math.max(...yrs)}).</em>` : '');
  }

  else if (p.kind === 'profile') {
    const c = BY_ISO[p.iso]; if (!c) return miss();
    let key = ctx.metric;
    if (!latestValOf(key, p.iso)) key = firstMetricFor(p.iso);   // fall back to what this country has
    if (!key) { showNotice(`No data yet for ${esc(c.name)} in this atlas.`); return null; }
    ctx.metric = key;
    const m = META[key];
    const lv = latestValOf(key, p.iso); if (!lv) return miss();
    const rk = rankOf(p.iso, key);
    f.isos = [p.iso]; ctx.lastIso = p.iso; f.metricUsed = m.series ? key : 'wealth_gini';
    const rankBit = rankPhrase(rk, m);
    if (key === 'wealth_top1')
      f.text = `<strong>${esc(c.name)}</strong>: the top 1% hold <strong>${m.fmt(lv.val)}</strong> of the wealth (${lv.year}), ${rankBit}.`;
    else {
      f.text = `<strong>${esc(c.name)}</strong>: ${m.label} <strong>${m.fmt(lv.val)}</strong> in ${lv.year}, ${rankBit}.`;
      if (key === 'wealth_gini' && c.latest && c.latest.top1_wealth_share != null)
        f.text += ` The top 1% hold <strong>${pc(c.latest.top1_wealth_share)}</strong>.`;
    }
    if (!m.series) f.mode = 'bars', f.bar = barFor(key, p.iso);
  }

  else if (p.kind === 'regions') {
    // two regions held side by side by the country in the middle of each. a median rather
    // than a pooled figure, for the reason in FOUNDATION section 5: a bloc is not a unit
    const key = p.metric && META[p.metric] && META[p.metric].series ? p.metric : (META[ctx.metric].series ? ctx.metric : facetIneqDefault());
    ctx.metric = key;
    const m = META[key];
    // each region read whole, whatever region the page is standing in: the first region
    // named was being set as the standing one, and Africa inside Europe is nobody
    if (ctx.region) setRegion(null);
    if (cell.scope && /^r:/.test(cell.scope)) cell.scope = null;
    const rows = p.regions.map(reg => {
      const pool = poolOf(key).filter(r => REGION_SET[reg] && REGION_SET[reg].has(r.geo_id)).sort((a, b) => b.val - a.val);
      return pool.length ? { geo_id: 'reg:' + reg, geo_name: cap(REGION_LABEL[reg]), val: medianOf(pool.map(r => r.val)), n: pool.length,
        lo: pool[pool.length - 1], hi: pool[0] } : null;
    }).filter(Boolean).sort((a, b) => b.val - a.val);
    if (rows.length < 2) return miss();
    f.mode = 'bars'; f.isos = []; f.metricUsed = key;
    f.bar = { key, dir: 'high', rows, highlight: null, note: ', the middle country of each region' };
    f.text = `On ${m.label}, the middle country of ${rows.map(r => `${esc(r.geo_name)} sits at <strong>${m.fmt(r.val)}</strong>`).join(' and of ')}.` +
      ` <em>${rows.map(r => `${esc(r.geo_name)} runs from ${esc(r.lo.geo_name)} at ${m.fmt(r.lo.val)} to ${esc(r.hi.geo_name)} at ${m.fmt(r.hi.val)}, across ${r.n} countries`).join('; ')}. ` +
      `The spread inside each region is wider than the gap between them, which is why the atlas reads countries rather than blocs.</em>`;
  }

  else if (p.kind === 'compare') {
    const named = p.metric && META[p.metric] && (META[p.metric].series || META[p.metric].snap) ? p.metric : null;
    const key = named || (META[ctx.metric].series || META[ctx.metric].snap ? ctx.metric : 'wealth_gini');
    const m = META[key];
    const rows = p.isos.map(i => ({ iso: i, lv: latestValOf(key, i) })).filter(x => x.lv);
    if (rows.length < 2) return miss();
    f.isos = rows.map(x => x.iso); ctx.lastIso = f.isos[f.isos.length - 1];
    f.metricUsed = m.series ? key : 'wealth_gini';
    const parts = rows.map(x => `${esc(BY_ISO[x.iso].name)} <strong>${m.fmt(x.lv.val)}</strong>`).join(' vs ');
    const spread = Math.max(...rows.map(x => x.lv.val)) - Math.min(...rows.map(x => x.lv.val));
    f.text = `On ${m.label}: ${parts}. Spread: <strong>${m.fmtD(spread)}</strong>.`;
    if (!m.series) { f.mode = 'bars'; f.bar = barFor(key, rows[0].iso); }
  }

  else if (p.kind === 'rank') {
    const key = resolveMetric(p);
    ctx.metric = key;
    const m = META[key];
    let pool = rankedPool(key, p.dir, p.region, p.year);
    // ranking the poorest countries inside the richer third would be a ranking of nothing
    const narrowed = rankNarrowed() && !(p.only && p.only.length) && key !== 'gdp_pc';
    if (narrowed) { const rt = richThird(); pool = pool.filter(r => rt.has(r.geo_id)); }
    // a survey measure ranked at "the latest year" put Uzbekistan's 2003 survey at the top
    // of extreme poverty against everyone else's 2019. readings more than fifteen years
    // older than the newest are left out of the ranking, and named
    let stale = [];
    if (!p.year && !(p.only && p.only.length) && SERIES_BASIS[key] === 'survey') {
      const newest = Math.max(...pool.map(r => r.year || 0));
      stale = pool.filter(r => r.year && r.year < newest - 15);
      if (stale.length && stale.length < pool.length) pool = pool.filter(r => !stale.includes(r));
      else stale = [];
    }
    if (p.only && p.only.length) {
      const want = p.only;
      pool = pool.filter(r => want.includes(r.geo_id));
      const missing = want.filter(i => !pool.some(r => r.geo_id === i));
      if (missing.length) f.missNote = missing.map(i => BY_ISO[i] ? BY_ISO[i].name : i);
    }
    if (!pool.length) {
      if (p.year) { showNotice(`No country carries ${META[key].label} within ${POOL_YEAR_TOL} years of ${p.year}.`); return null; }
      return miss();
    }
    let top = p.only && p.only.length ? pool : pool.slice(0, 10);
    // a chosen country is not dropped for ranking low: it is kept, and its place said
    const hl = p.highlight && pool.some(r => r.geo_id === p.highlight) ? p.highlight : null;
    let hlRank = null;
    if (hl) {
      hlRank = pool.findIndex(r => r.geo_id === hl) + 1;
      if (!top.some(r => r.geo_id === hl)) top = top.concat([pool[hlRank - 1]]);
    }
    const where = p.only && p.only.length ? '' : p.region ? ` in ${REGION_LABEL[p.region]}` : narrowed ? RANK_SET_NOTE : '';
    const three = top.slice(0, 3).map(r => `${esc(r.geo_name)} <strong>${m.fmt(r.val)}</strong>`).join(', ');
    ctx.lastRankDir = p.dir; ctx.lastIso = hl || top[0].geo_id; ctx.lastRegion = p.region || ctx.lastRegion;
    f.mode = 'bars';
    // years actually used, which is only the same as the year asked for when the
    // series happens to carry it; a survey measure lands where the surveys landed
    const yrs = top.map(r => r.year).filter(Boolean);
    const when = p.year
      ? ` <em>Ranked at ${p.year}: each country at its nearest reading within ${POOL_YEAR_TOL} years` +
        (yrs.length ? ` (${Math.min(...yrs)} to ${Math.max(...yrs)})` : '') +
        `, ${pool.length} of them carry one.</em>`
      : '';
    f.bar = { key, dir: p.dir, rows: top, highlight: hl, note: where, atYear: p.year || null };
    f.isos = p.only && p.only.length ? top.map(r => r.geo_id) : [hl || top[0].geo_id];
    f.text = (p.only && p.only.length
      ? `${cap(m.label)}, ${top.length} countries: ${three}.`
      : `${p.dir === 'high' ? 'Highest' : 'Lowest'} ${m.label}${where}${poolNote()}: ${three}.`) +
      (hl && !(p.only && p.only.length)
        ? ` <strong>${esc(BY_ISO[hl].name)}</strong> is <strong>${ordinal(hlRank)}</strong> of ` +
          `${pool.length}${p.region || ctx.pool || narrowed ? ' here' : ''}, at ` +
          `<strong>${m.fmt(pool[hlRank - 1].val)}</strong>.` : '') +
      (narrowed ? ` <em>Ranked among the richer third of countries by GDP per person, which is close to ` +
        `the set with tax records behind the figure. Ask for the whole world to widen it.</em>` : '') +
      when +
      (stale.length ? ` <em>Left out because their latest survey is more than fifteen years older than the ` +
        `newest: ${stale.slice(0, 6).map(r => `${esc(r.geo_name)} (${r.year})`).join(', ')}` +
        `${stale.length > 6 ? ` and ${stale.length - 6} more` : ''}.</em>` : '') +
      (f.missNote ? ` <em>${esc(f.missNote.join(', '))} ${f.missNote.length === 1 ? 'has' : 'have'} ` +
        `no ${esc(m.label)} on record, so ${f.missNote.length === 1 ? 'it is' : 'they are'} not drawn.</em>` : '');
  }

  else if (p.kind === 'delta_rank') {
    const key = p.metric && META[p.metric].series ? p.metric : (META[ctx.metric].series ? ctx.metric : 'wealth_gini');
    ctx.metric = key;
    const m = META[key];
    const pool = [];
    const s = SERIES[key] || {};
    const dNarrow = rankNarrowed() && !(p.only && p.only.length);
    const dRich = dNarrow ? richThird() : null;
    // ten years is the rule, because a shorter move is mostly noise. a question that names
    // a shorter period ("did covid make it worse", five years) gets the period it asked
    // for, at least three years, and the sentence says how short that is
    let lastYr = 0; for (const iso in s) { const a = s[iso]; if (a.length) lastYr = Math.max(lastYr, a[a.length - 1].year); }
    const minRun = p.year && !p.until ? Math.min(10, Math.max(3, lastYr - p.year - 1)) : 10;
    for (const iso in s) {
      if (!inScope(iso, p.region) || !BY_ISO[iso]) continue;
      if (dRich && !dRich.has(iso)) continue;
      const pts = s[iso].filter(d => (!p.year || d.year >= p.year) && (!p.until || d.year <= p.until));
      if (pts.length < 2) continue;
      const from = pts[0];
      const to = pts[pts.length - 1];
      if (to.year - from.year < minRun) continue;
      pool.push({ geo_id: iso, geo_name: BY_ISO[iso].name, val: to.v - from.v,
        from: from.year, to: to.year });
    }
    let dPool = pool;
    if (p.only && p.only.length) {
      dPool = pool.filter(x => p.only.includes(x.geo_id));
      const gone = p.only.filter(i => !dPool.some(x => x.geo_id === i));
      if (gone.length) f.missNote = gone.map(i => BY_ISO[i] ? BY_ISO[i].name : i);
    }
    if (!dPool.length) {
      showNotice(p.year || p.until
        ? 'No country carries a run of ten years or more inside those years. Widen the range.'
        : 'That measure has no run of years to rank moves over.');
      return null;
    }
    dPool.sort((a, b) => p.dir === 'up' ? b.val - a.val : a.val - b.val);
    let top = p.only && p.only.length ? dPool : dPool.slice(0, 10);
    const dhl = p.highlight && dPool.some(x => x.geo_id === p.highlight) ? p.highlight : null;
    let dRank = null;
    if (dhl) {
      dRank = dPool.findIndex(x => x.geo_id === dhl) + 1;
      if (!top.some(x => x.geo_id === dhl)) top = top.concat([dPool[dRank - 1]]);
    }
    const where = p.region ? ` in ${REGION_LABEL[p.region]}` : dNarrow ? RANK_SET_NOTE : '';
    const rose = dPool.filter(x => x.val > 0).length, fell = dPool.filter(x => x.val < 0).length;
    const three = top.slice(0, 3).map(x =>
      `${esc(x.geo_name)} ${x.val >= 0 ? '+' : ''}<strong>${m.fmtD(Math.abs(x.val))}</strong>`).join(', ');
    ctx.lastIso = dhl || top[0].geo_id; ctx.lastRegion = p.region || ctx.lastRegion;
    f.isos = [dhl || top[0].geo_id];
    f.mode = 'bars';
    // the window each country was actually measured over, which is not the window
    // that was asked for whenever its series starts late or stops early
    const lo = Math.min(...top.map(x => x.from)), hi = Math.max(...top.map(x => x.to));
    // the years said are the years read: "1980 to the latest year" over a record that
    // starts in 1990 claimed a decade the ranking never saw
    const span = (p.year || p.until)
      ? `${p.year ? Math.max(p.year, lo) : 'the start'} to ${p.until || 'the latest year'}`
      : 'the whole run';
    f.bar = { key: 'delta', metric: key, dir: p.dir, rows: top, highlight: dhl,
              note: `${where}, ${m.label}, ${span}` };
    const chosen = p.only && p.only.length;
    f.isos = chosen ? top.map(x => x.geo_id) : f.isos;
    f.text = (chosen
      ? `${cap(m.label)}, the move over ${span}, ${top.length} countries: ${three}.`
      : `Biggest ${p.dir === 'up' ? 'rises' : 'falls'} in ${m.label}${where}${poolNote()}, ${span}: ${three}.`) +
      (dhl && !chosen ? ` <strong>${esc(BY_ISO[dhl].name)}</strong> is <strong>${ordinal(dRank)}</strong> of ` +
        `${dPool.length}, at ${dPool[dRank - 1].val >= 0 ? '+' : '-'}` +
        `<strong>${m.fmtD(Math.abs(dPool[dRank - 1].val))}</strong>.` : '') +
      (chosen ? '' : ` Overall ${rose} rose and ${fell} fell.`) +
      ` <em>Each country is measured over its own years inside that window (${lo} to ${hi}), and only ` +
      `those with ${minRun < 10 ? minRun : 'ten'} years or more are ${chosen ? 'shown' : 'ranked'}: ${dPool.length} of them.` +
      (minRun < 10 ? ` That is a short run: moves this small over so few years are as likely to be revisions as change.` : '') + `</em>` +
      (p.year && lo > p.year + 1 ? ` <em class="readas">You asked from ${p.year}; the record starts in ${lo}, so that is where this begins.</em>` : '') +
      (f.missNote ? ` <em>${esc(f.missNote.join(', '))} ${f.missNote.length === 1 ? 'has' : 'have'} ` +
        `no run that long inside those years, so ${f.missNote.length === 1 ? 'it is' : 'they are'} not drawn.</em>` : '');
  }

  else if (p.kind === 'threshold') {
    const key = p.metric || ctx.metric;
    ctx.metric = key;
    const m = META[key];
    const pool = rankedPool(key, p.op === 'above' ? 'high' : 'low', p.region);
    if (!pool.length) return miss();
    const val = m.snap && p.val > 1 ? p.val / 100 : p.val;
    const hits = pool.filter(r => p.op === 'above' ? r.val >= val : r.val <= val);
    const where = p.region ? ` in ${REGION_LABEL[p.region]}` : '';
    ctx.lastRegion = p.region || ctx.lastRegion;
    if (hits.length) { ctx.lastIso = hits[0].geo_id; f.isos = [hits[0].geo_id]; }
    f.mode = 'bars';
    f.bar = { key, dir: p.op === 'above' ? 'high' : 'low', rows: hits.slice(0, 10), highlight: null, note: where };
    const three = hits.slice(0, 3).map(r => `${esc(r.geo_name)} <strong>${m.fmt(r.val)}</strong>`).join(', ');
    f.text = `<strong>${hits.length}</strong> of ${pool.length} countries${where} are ${p.op} ${p.val} on ${m.label}` +
      (three ? `: ${three}` : '') + (hits.length > 3 ? ', and more in the chart.' : '.');
  }

  else if (p.kind === 'context') {
    if (!ctx.lastIso) { showNotice('Ask about a country first, then "compared to whom".'); return null; }
    const key = ctx.metric, m = META[key];
    const pool = rankedPool(key, 'high', null);
    const i = pool.findIndex(r => r.geo_id === ctx.lastIso);
    if (i === -1) return miss();
    const lo = Math.max(0, i - 4), win = pool.slice(lo, lo + 9);
    const c = pool[i], above = pool[i - 1], below = pool[i + 1];
    const med = medianOf(pool.map(r => r.val));
    f.mode = 'bars'; f.isos = [ctx.lastIso];
    f.bar = { key, dir: 'high', rows: win, highlight: ctx.lastIso };
    f.text = `<strong>${esc(c.geo_name)}</strong> sits ${ord(i + 1)} of ${pool.length} on ${m.label}` +
      (above ? `, just below ${esc(above.geo_name)} <strong>${m.fmt(above.val)}</strong>` : '') +
      (below ? `, just above ${esc(below.geo_name)} <strong>${m.fmt(below.val)}</strong>` : '') +
      `. World median: <strong>${m.fmt(med)}</strong>.`;
  }

  else if (p.kind === 'world') {
    if (p.metric && META[p.metric].series) ctx.metric = p.metric;
    const key = META[ctx.metric].series ? ctx.metric : 'wealth_gini';
    const m = META[key];
    const regLabel = p.region ? REGION_LABEL[p.region] : '';
    // "World median median income" read as a stutter; a measure that is itself a median says "of"
    const label = (p.region ? `${cap(regLabel)} median` : 'World median') + (/^median\b/.test(META[key].label) ? ' of' : '');
    const pool = rankedPool(key, 'high', p.region);
    if (!pool.length) return miss();
    const med = medianOf(pool.map(r => r.val));
    if (p.region) { f.regionKey = p.region; ctx.lastRegion = p.region; } else f.world = true;
    f.metricUsed = key;
    const foc = ctx.lastIso && latestValOf(key, ctx.lastIso);
    if (foc && !pool.every(r => r.geo_id === ctx.lastIso)) {
      const d = foc.val - med;
      f.isos = [ctx.lastIso];
      f.text = `${label} ${m.label}: <strong>${m.fmt(med)}</strong>. ` +
        `${esc(BY_ISO[ctx.lastIso].name)} is <strong>${m.fmtD(Math.abs(d))}</strong> ${d >= 0 ? 'above' : 'below'} it.`;
    } else {
      f.text = `${label} ${m.label}: <strong>${m.fmt(med)}</strong>, across ${pool.length} countries and territories.`;
    }
  }

  else if (p.kind === 'time') {
    const key = p.metric && META[p.metric].series ? p.metric : (META[ctx.metric].series ? ctx.metric : 'wealth_gini');
    ctx.metric = key;
    const m = META[key];
    const isos = p.isos.length ? p.isos : focusIsos().length ? focusIsos() : (ctx.lastIso ? [ctx.lastIso] : []);
    const reg = p.region || (!isos.length ? ctx.lastRegion : null);
    // a chosen window clips the series itself, so the sentence reports the window
    // that was asked for rather than the whole run with the axis cropped over it
    const clip = a => a.filter(d => (!p.year || d.year >= p.year) && (!p.until || d.year <= p.until));
    if (!isos.length && reg) {
      const whole = medianSeriesOf(key, reg);
      const series = clip(whole);
      if (series.length < 2) return miss();
      const from = series[0];
      const to = series[series.length - 1];
      const d = to.v - from.v;
      f.regionKey = reg; f.fromYear = p.year || null; f.toYear = p.until || null; f.metricUsed = key; ctx.lastRegion = reg;
      f.text = `${REGION_LABEL[reg]} median ${m.label} over time: <strong>${m.fmt(from.v)}</strong> in ${from.year} to ` +
        `<strong>${m.fmt(to.v)}</strong> in ${to.year}, ${d >= 0 ? '+' : ''}<strong>${m.fmtD(Math.abs(d))}</strong>.`;
      return floorNote(f);
    }
    if (!isos.length) { showNotice('Ask about a country first, then "over time".'); return null; }
    f.isos = isos.slice(0, 8); ctx.lastIso = f.isos[f.isos.length - 1];
    f.fromYear = p.year || null; f.toYear = p.until || null; f.metricUsed = key;
    const short = [], lateStart = [];
    const bits = f.isos.slice(0, 3).map(iso => {
      const whole = seriesOf(key, iso); if (!whole.length) return null;
      const s = clip(whole);
      if (s.length < 2) { short.push(BY_ISO[iso].name); return null; }
      const from = s[0], to = s[s.length - 1];
      if (p.year && from.year > p.year + 1) lateStart.push([iso, from.year]);
      const d = to.v - from.v;
      return `${esc(BY_ISO[iso].name)} ${d >= 0 ? '+' : '-'}<strong>${m.fmtD(Math.abs(d))}</strong> ` +
        `from ${from.year} to ${to.year}`;
    }).filter(Boolean);
    if (!bits.length) {
      showNotice(p.year || p.until
        ? 'No country here carries two points inside those years. Widen the range.'
        : 'That measure has no run of years for this place.');
      return null;
    }
    // three are spelled out; any others are drawn, and the sentence says so rather
    // than leaving a reader to count lines against names
    const extra = f.isos.length - Math.min(3, f.isos.length);
    f.text = `${cap(m.label)} over time: ${bits.join(', ')}.` +
      (extra > 0 ? ` <em>${extra} more ${extra === 1 ? 'country is' : 'countries are'} drawn.</em>` : '') +
      (short.length ? ` <em>${esc(short.join(', '))} ${short.length === 1 ? 'has' : 'have'} ` +
        `fewer than two points inside those years, so ${short.length === 1 ? 'it is' : 'they are'} ` +
        `not summarised.</em>` : '') +
      // "since 1980" answered from 1990 without a word, and read as a claim about 1980
      // on the notes line, not in the fold: it changes what the answer is about
      (lateStart.length ? ` <em class="readas">You asked from ${p.year}; the record here starts in ${lateStart.map(([i, y]) =>
        `${y}${f.isos.length > 1 ? ' for ' + esc(theName(i)) : ''}`).join(', ')}, so that is where this begins.` +
        // the wealth record starts in 1990 but the top 1% income share often runs much
        // further back, so the years asked for are one face away
        (() => {
          const alt = { wealth_top1: 'income_top1', wealth_bottom50: 'income_bottom50', wealth_gini: 'income_top1' }[key];
          const reaches = alt && lateStart.every(([i]) => { const a = seriesOf(alt, i); return a.length && a[0].year <= p.year; });
          return reaches ? ` The ${esc(META[alt].label)} reaches back that far: ask for income to see it from ${p.year}.` : '';
        })() + `</em>` : '');
  }

  else if (p.kind === 'point') {
    const key = (p.metric && META[p.metric].series) ? p.metric
      : (META[ctx.metric].series ? ctx.metric : 'wealth_gini');
    ctx.metric = key;
    const m = META[key];
    const c = BY_ISO[p.iso]; if (!c) return miss();
    const s = seriesOf(key, p.iso);
    if (!s.length) return miss();
    // snap to the nearest year the series actually carries
    let at = s.find(d => d.year === p.year);
    if (!at) at = s.reduce((best, d) => Math.abs(d.year - p.year) < Math.abs(best.year - p.year) ? d : best, s[0]);
    f.isos = [p.iso]; ctx.lastIso = p.iso;
    f.marker = { iso: p.iso, year: at.year }; f.metricUsed = key;
    const asked = at.year === p.year ? '' : ` (nearest to ${p.year})`;
    f.text = `<strong>${esc(c.name)}</strong> in ${at.year}${asked}: ${m.label} <strong>${m.fmt(at.v)}</strong>.`;
  }

  else if (p.kind === 'metric') {
    ctx.metric = p.metric;
    const m = META[p.metric];
    const isos = p.isos.length ? p.isos : (ctx.lastIso ? [ctx.lastIso] : []);
    // A United States branch stood here, reading the Fed's distributional accounts while
    // every other country read WID. Nothing could reach it: the parser never produces the
    // metric keys it tested for. It is gone rather than left as a second basis to fall into.
    if (m.series && isos.length) {
      const iso = isos[0];
      const lv = latestValOf(p.metric, iso); if (!lv) return miss();
      const rk = rankOf(iso, p.metric);
      f.isos = isos.slice(0, 8); ctx.lastIso = iso; f.metricUsed = p.metric;
      const rankBit = rankPhrase(rk, m);
      f.text = `<strong>${esc(BY_ISO[iso].name)}</strong>: ${m.label} <strong>${m.fmt(lv.val)}</strong> in ${lv.year}, ${rankBit}.`;
    } else if (m.snap && isos.length) {
      const iso = isos[0], lv = latestValOf(p.metric, iso);
      if (!lv) return miss();
      const rk = rankOf(iso, p.metric);
      f.mode = 'bars'; f.metric = p.metric; f.isos = [iso]; ctx.lastIso = iso;
      f.bar = barFor(p.metric, iso);
      f.text = `<strong>${esc(BY_ISO[iso].name)}</strong>: ${m.label} <strong>${m.fmt(lv.val)}</strong> ` +
        `(${lv.year}), ${rankPhrase(rk, m)}.`;
    } else return miss();
  }


  return floorNote(f);

  function barFor(key, highlightIso) {
    const pool = rankedPool(key, 'high', null);
    let rows = pool.slice(0, 10);
    if (highlightIso && !rows.some(r => r.geo_id === highlightIso)) {
      const own = pool.find(r => r.geo_id === highlightIso);
      if (own) rows = rows.concat([own]);
    }
    return { key, dir: 'high', rows, highlight: highlightIso };
  }
  function miss() {
    showNotice('No data for that one in this panel. The release files may go further.');
    return null;
  }
}
