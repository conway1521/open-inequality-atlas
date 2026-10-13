'use strict';
// the session, the cube that picks a face, and the drawer of folds.
// one of eight files loaded in order by index.html; they share one scope, so a
// function here can be used by any of them once the page has loaded

/* ── session ───────────────────────────────────────────────────────── */
// answer + the standing-context annotations, shared by ask() and recomputeChain()
function runQuery(q) {
  const isAmong = /\bamong\b|\ball countries\b|\beveryone\b|\bonly (rich|poor|the)\b|\brestrict\b|\bdrop the (filter|condition|pool)\b/.test(norm(q));
  const f = answer(q);
  if (!f) return null;
  if (META[ctx.metric] && META[ctx.metric].series && !isIneq(ctx.metric)) ctx.lastAspect = ctx.metric;
  if (ctx.region && !f.noChart) {
    const rl = REGION_LABEL[ctx.region];
    if (!f.text.includes(rl)) f.text = f.text.replace(/\s*$/, '') + ` <em>in ${rl}</em>`;
  }
  if (ctx.pool && !/among /i.test(f.text)) f.text = f.text.replace(/\s*$/, '') + poolNote();
  if (!isAmong) ctx.lastQuery = q;   // AMONG re-runs this; never re-runs itself
  return f;
}

function resetCtx() {
  ctx.lastIso = null; ctx.lastRankDir = null; ctx.lastRegion = null;
  ctx.metric = (typeof FACETS !== 'undefined' && FACETS[curFacet] && FACETS[curFacet].metric)
    || (SERIES.wealth_top1 ? 'wealth_top1' : 'wealth_gini');
  ctx.lastAspect = null; ctx.pool = null; ctx.lastQuery = null; ctx.region = null; computePool();
}

// A reading drawn for one country, asked without one named, is not a refusal: the
// question is answerable and is one click short of a place. Hand it to the accordion
// with the place fold open rather than answering a notice.
function askNeedsPlace(q) {
  let p;
  try { p = parse(q); } catch (e) { return false; }
  const v = VIEW_DEF[p.kind];
  if (!v || !v.needsPlace) return false;
  return !(p.iso || (p.isos && p.isos.length) || ctx.lastIso);
}
function ask(q) {
  hideNotice();
  stopIdle(false);   // the cube stops drifting once you ask
  if (!onUs() && askNeedsPlace(q)) {
    const box = document.getElementById('q');
    if (box) box.value = q;
    if (previewQuestion(q)) { setStage('chain'); return; }
  }
  const f = (onUs() && US_CZ) ? oppAnswer(q) : runQuery(q);
  if (!f) return;
  // one editable cell: a new question refines it in place, it doesn't pile up
  chain.length = 0;
  chain.push(f);
  syncCellFromFact(f);   // the typed question becomes the cell the accordion can amend
  render();
  const qb = document.getElementById('q');
  if (qb) qb.value = q;          // kept, so reopening the box shows what you asked
  setStage('result');
}

// re-run the whole chain from its queries on a fresh context; flag lines whose answer shifted
function recomputeChain() {
  const items = chain.map(f => ({ id: f.id, query: f.query, oldText: f.text }));
  resetCtx();
  chain.length = 0;
  for (const it of items) {
    // route by the facet the cube is on now; questions that don't translate drop out
    const nf = (onUs() && US_CZ) ? oppAnswer(it.query, true) : runQuery(it.query);
    if (!nf) continue;                    // query no longer resolves under new state: drop it
    nf.id = it.id;
    nf.changed = nf.text !== it.oldText;
    chain.push(nf);
  }
}

function removeFact(id) {
  const i = chain.findIndex(f => f.id === id);
  if (i === -1) return;
  chain.splice(i, 1);
  recomputeChain();                       // deletion may change later answers; re-run and mark them
  render();
}

// the cube: six faces, one per dimension of the ask cube. It turns to whichever
// dimension the last question moved, so the abstract cube stays in view.
/* ── the cube: the facet selector ─────────────────────────────────── */
const FACETS = {
  wealth:      { i: 0, side: true, color: 'var(--wealth)', metric: 'wealth_top1', sub: 'top 1% share' },
  income:      { i: 1, side: true, color: 'var(--income)', metric: 'income_gini', sub: 'income Gini' },
  opportunity: { i: 2, side: true, color: 'var(--opportunity)', metric: null, sub: '741 US commuting zones',
                 note: 'Opportunity is not measured the way the other three are. It is 741 United States commuting zones, ' +
                   'for children born in the early 1980s: one country, one cohort, no run of years. ' +
                   'It is here because it is the clearest picture of the mechanism that exists anywhere, not because it is global.' },
  // Open, and US only, on purpose. Life expectancy by country is a national average, so it
  // cannot show a gap between rich and poor inside a country, which is what a face of this
  // cube claims to do. Nobody publishes health inequality in a form that compares across
  // borders: the WHO has child deaths by wealth quintile for poorer countries, the OECD
  // life expectancy by education for richer ones, and the two do not join. The one place
  // the gap itself is measured, by household income, is the United States, so that is
  // what this face shows, labelled the way opportunity is. The national average stays in
  // the atlas as something to hold inequality against, never as this face's measure.
  health:      { i: 3, side: true, color: 'var(--health)', metric: null, sub: 'the rich-poor life gap, US',
                 note: 'Health, measured where the gap between rich and poor can be seen: life expectancy by ' +
                   'household income across 595 US commuting zones, and the gap county by county. No source ' +
                   'measures that gap the same way across countries, so this face is the United States only.' },
};
// the faces that read the US layer rather than the country panels
const US_FACES = ['opportunity', 'health'];
function onUs(face) { return US_FACES.includes(face === undefined ? curFacet : face); }
// the two poles of the cube are not faces of inequality: they are what you do to a
// face. link holds it against another face; extend takes the same face somewhere finer.
const INTERACTIONS = { link: 'link', extend: 'extend' };
// example prompts, per facet, all runnable: enter on the empty box executes the one showing
// ten distinct things the accordion and chat can do; each cycles through the box, fillable
const PROMPT_SETS = {
  default: [
    'how many times more does one person at the top own?',
    'what does the poorest half own?',
    'what is that wealth actually made of?',
    'does my country own as unevenly as it earns?',
    'how much more do the richest hold than the poorest?',
    'have houses pulled away from pay?',
    'are wealth and income pulling apart here?',
    'where is wealth most concentrated?',
    'when did this country change most?',
    'did it move differently from comparable countries?',
    'how has France changed over time?',
    'does life expectancy track inequality?',
    'what about among rich countries?',
  ],
  income: [
    'how many times more does one person at the top earn?',
    'what does the person in the middle live on a day?',
    'what happened to the middle here?',
    'did the growth reach the typical person?',
    'how many times more does one person at the top own?',
    'where is income most unequal?',
    'how has Brazil changed over time?',
    'who breaks the pattern?',
    'what about among rich countries?',
  ],
  health: [
    'how much longer do the rich live here?',
    'where do poor people live longest?',
    'life expectancy gap in Detroit',
  ],
  opportunity: [
    'if you grow up poor here, what do you earn later?',
    'does knowing better-off people help you climb?',
    'are they not here, or here and not mixing?',
    "does credit depend on your parents' income?",
    "who owns a home, by their parents' income?",
    "who falls behind on payments, by their parents' income?",
    'do the four faces agree inside one country?',
    'does the income gap track climbing?',
    'how much longer do the rich live here?',
    'does mobility follow income?',
  ],
};
// one question per kind of analysis the atlas can do. the strip tunes them from here.
// The catalogue is the argument, in order, not a sample of what the grammar can
// express. Each question serves a claim in FOUNDATION.md section 3 and has to pass
// the five tests in section 10. The comment on each line says which claim it serves.
const QUESTIONS = [
  // Questions about how the faces sit against each other. They belong to no single face,
  // and they carry the argument the atlas exists to make.
  { k: 'the faces against each other', qs: [
    'does my country own as unevenly as it earns?',       // claim 2, the strongest
    'are wealth and income pulling apart here?',          // claim 1, inside one country
    'does life expectancy track inequality?',             // claim 4, drawn weak on purpose
    'how do wealth, income and life expectancy sit together?',
  ] },
  // The grammar, asked of whichever face is up, so a face you have just turned to can
  // still be read without leaving the question set behind.
  { k: 'any face, any country', qs: [
    'how has inequality changed over time?',
    'when did this country change most?',                 // claim 3, turn picks the years
    'did it move differently from comparable countries?', // the peer contrast
  ] },
  // The wealth face: what half a country holds, and what one person at the top holds
  // against one at the bottom, set beside the same division done on pay. That second one
  // is the atlas's own argument, computed live rather than asserted.
  { k: 'the wealth face', facet: 'wealth', qs: [
    'how many times more does one person at the top own?',
    'what is that wealth actually made of?',
    'how many people own less than nothing?',
    'could you take a hit here?',
    'what does a family actually have?',
    'what does the poorest half own?',
    'how much more do the richest hold than the poorest?',
    'have houses pulled away from pay?',
    'where is wealth most concentrated?',
  ] },
  // The income face asks what a share means for a person rather than for a block: what
  // one of them takes against one of the others, what the money buys, and which of the
  // three parts of the country the movement came out of.
  { k: 'the income face', facet: 'income', qs: [
    'how many times more does one person at the top earn?',
    'what does the person in the middle live on a day?',
    'what happened to the middle here?',
    'did the growth reach the typical person?',
  ] },
  { k: 'health, US only', facet: 'health', qs: [
    'how much longer do the rich live here?',
    'where do poor people live longest?',
    'life expectancy gap in Detroit'] },
  { k: 'opportunity, US counties only', facet: 'opportunity', qs: [
    'do the four faces agree inside one country?',
    'if you grow up poor here, what do you earn later?',
    'does knowing better-off people help you climb?',
    'are they not here, or here and not mixing?',
    'does the income gap track climbing?',
    "does credit depend on your parents' income?",
    "who owns a home, by their parents' income?",
    "who falls behind on payments, by their parents' income?"] },
];
let promptIdx = 0;
function nextPrompt(jump) {
  const el = document.getElementById('q'); if (!el) return;
  const set = PROMPT_SETS[curFacet] || PROMPT_SETS.default;
  if (jump) promptIdx = 0;
  else { if (el.value || document.activeElement === el) return; promptIdx += 1; }
  el.placeholder = set[promptIdx % set.length];
}
// step the suggestion by hand, so you can flick through the premade questions
function cyclePrompt(dir) {
  const el = document.getElementById('q'); if (!el || el.value) return;
  const set = PROMPT_SETS[curFacet] || PROMPT_SETS.default;
  promptIdx = (promptIdx + dir + set.length) % set.length;
  el.placeholder = set[promptIdx];
}
// a written question is read into the chain first; nothing runs until you send it
function runPrompt(text) {
  if (!DATA_READY) { showNotice('The figures are still loading. The cube turns meanwhile; ask again in a moment.'); return; }
  const q = text.replace(/^\w+:\s*/, '').trim();
  const el = document.getElementById('q');
  if (el) el.value = q;
  if (previewQuestion(q)) { setStage('chain'); return true; }
  return false;
}
const FACET_HEX = { wealth: '#2a78d6', income: '#2f9e8f', opportunity: '#c98a2b', health: '#c0607a' };
const ACC = () => FACET_HEX[curFacet] || '#2a78d6';   // the UI accent follows the facet you're on
// a chart is coloured by the variable it shows, and every colour comes from the
// four-facet palette: wealth blue, income teal, health rose, opportunity amber.
// an aspect borrows the colour of the facet family it belongs to.
const METRIC_HEX = {
  wealth_top1: '#2a78d6', wealth_gini: '#2a78d6', wealth_bottom50: '#2a78d6',
  income_gini: '#2f9e8f', median_income: '#2f9e8f', gdp_pc: '#2f9e8f', poverty_rate: '#2f9e8f',
  house_price: '#2a78d6', house_income: '#2a78d6', gdp_hour: '#2f9e8f', poverty_relative: '#2f9e8f',
  income_top1: '#2f9e8f', income_top10: '#2f9e8f', income_middle40: '#2f9e8f', income_bottom50: '#2f9e8f',
  // CO2 belongs to no face; amber would read as opportunity, so it takes the neutral slate
  life_exp: '#c0607a', life_satisfaction: '#c0607a', co2_pc: '#6b7280',
};
const metricColor = key => METRIC_HEX[key] || '#7a7f88';
// the mark for "this is the one you asked about". an orange that belongs to no face
// was doing this before; now it is the measure's own colour at full strength, and it
// stands out by being outlined and darker than the ramp around it, not by being other.
function hlFill(key) { return shade(metricColor(key || ctx.metric), 0.22); }
function hlEdge() { return cssVar('--ink', '#0a0a0a'); }
const cubeEl = () => document.getElementById('cube');
let curFacet = 'wealth', cRotX = 0, cRotY = 0;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STATIC_TILT = 'rotateX(-15deg) rotateY(-20deg) ';
function cubeApply() {
  const c = cubeEl(); if (!c) return;
  c.style.transform = `scale(${cubeScale}) ` + (reduceMotion ? STATIC_TILT : '') + `rotateX(${cRotX}deg) rotateY(${cRotY}deg)`;
}
// which face points at the viewer, for ANY orientation: rotate each face's
// outward normal by the cube's transform and take the one with the largest +z.
// M = Rx(cRotX)*Ry(cRotY); the z-row of M is [-ca*sb, sa, ca*cb].
function facetFromAngles() {
  const a = cRotX * Math.PI / 180, b = cRotY * Math.PI / 180;
  const sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b);
  const z = {
    wealth: ca * cb, income: -ca * sb, opportunity: -ca * cb,
    health: ca * sb, link: -sa, extend: sa,
  };
  return Object.keys(z).reduce((best, k) => z[k] > z[best] ? k : best, 'wealth');
}
// the same wound target, shifted by whole turns to sit closest to where we are now,
// so snapping back to a face never unwinds several full spins
function nearestEquivalent(target, current) { return target + 360 * Math.round((current - target) / 360); }
function paintFacet(name) {
  const f = FACETS[name]; if (!f) return;
  curFacet = name;
  document.documentElement.style.setProperty('--accent', f.color);
  document.querySelectorAll('#cube .face').forEach(el => el.classList.toggle('lit', el.dataset.facet === name));
  document.querySelectorAll('.fchip').forEach(el => el.setAttribute('aria-pressed', el.dataset.facet === name ? 'true' : 'false'));
  const vf = document.getElementById('v-facet');
  if (vf) {
    const list = FACET_MEASURES[name];
    const label = facetMeasureLabel(name) || f.sub;
    vf.innerHTML = `${name}<span class="fmeasure">${esc(label)}</span>`;
  }
  const hl = document.getElementById('here-label');   // the reminder in the results header
  if (hl) hl.textContent = name;
  if (typeof updateCell === 'function') updateCell();   // keep the coordinates current
}
/* ── the drawer: a map of the dimension, not a list of what we happen to hold ──
   Each fold opens onto the whole space of its variable, grouped by family and
   ordered so the nearest alternatives come first: those are the slight
   alterations. Options the atlas carries amend the cell. Options it doesn't are
   drawn dim, and they never fabricate an answer: they name the gap and hand you
   the closest measure that is real. */
const AGAINST_FAMILY = {
  life_exp: 'health', life_satisfaction: 'health',
  income_gini: 'income', median_income: 'income', gdp_pc: 'income', poverty_rate: 'income',
  gdp_hour: 'income', poverty_relative: 'income',
  income_top1: 'income', income_top10: 'income', income_middle40: 'income', income_bottom50: 'income',
  wealth_top1: 'wealth', wealth_gini: 'wealth', wealth_bottom50: 'wealth',
  co2_pc: 'environment',
};
// the next measures you'd reach for, and the nearest thing the atlas actually holds
// how much ground a measure actually covers, straight from the series
function coverageOf(k) {
  const ser = SERIES[k]; if (!ser) return '';
  const isos = Object.keys(ser).filter(i => ser[i] && ser[i].length);
  if (!isos.length) return '';
  let lo = Infinity, hi = -Infinity;
  for (const i of isos) { lo = Math.min(lo, ser[i][0].year); hi = Math.max(hi, ser[i][ser[i].length - 1].year); }
  return `${isos.length} countries, ${lo} to ${hi}`;
}
const REGION_KEYS = ['europe', 'africa', 'asia', 'latam', 'northam', 'mideast', 'oceania'];
function regionOf(iso) {
  for (const k of REGION_KEYS) if (REGION_SET[k] && REGION_SET[k].has(iso)) return k;
  return null;
}
// every country the facet's own measure actually covers
function placePool() {
  const key = cell.view === 'houses' ? 'house_price' : facetIneqDefault();
  const s = SERIES[key] || {};
  let isos = Object.keys(s).filter(i => BY_ISO[i] && s[i].length);
  // a measure the atlas holds for nowhere falls back to every country; a measure it
  // holds for a few shows those few, because offering 213 for a series of 2 is a lie
  if (!isos.length) isos = Object.keys(BY_ISO);
  return isos.map(i => [BY_ISO[i].name, i]).sort((a, b) => a[0].localeCompare(b[0]));
}
// what the fold currently reads, in the same vocabulary the options use
function dimCurrent(dim) {
  if (dim === 'place') return cell.place || '';
  if (dim === 'scope') return cell.scope || '';
  if (dim === 'form') return cell.view || cell.form || '';
  if (dim === 'time') return cell.span === 'run'
    ? 'run' + (cell.since ? ':' + cell.since : '') + (cell.until ? ':' + cell.until : '')
    : cell.span === 'moment' ? 'moment' + (cell.year ? ':' + cell.year : '') : '';
  if (dim === 'facet') return facetMeasure(curFacet) || '';
  if (dim === 'against') return cell.against || '';
  return '';
}
function dimGroups(dim, filter) {
  const g = [];
  if (onUs()) {
    if (dim === 'facet' && curFacet === 'health') {
      g.push({ k: 'measure', rows: [['the rich-poor life gap', 'how much longer do the rich live here?', '595 US commuting zones']] });
      g.push({ k: 'not in the atlas', gaps: [['the gap outside the US',
        'No source measures life expectancy by income the same way across countries, so this face is the United States only.', null]] });
      return g;
    }
    if (dim === 'facet') {
      g.push({ k: 'measure', rows: [['upward mobility', 'upward mobility', '741 US commuting zones']] });
      g.push({ k: 'not in the atlas', gaps: [['mobility outside the US',
        'This layer is US commuting zones only.', null]] });
      return g;
    }
    if (dim === 'against') {
      g.push({ k: "by parents' income", opts: [['credit score', "credit by parents' income"],
        ['mortgage balance', "mortgages by parents' income"], ['delinquency', "delinquency by parents' income"],
        ['how long people live', 'how much longer do the rich live here?']] });
      g.push({ k: 'who they grow up around', opts: [
        ['who they know', 'does knowing better-off people help you climb?'],
        ['not here, or not mixing', 'are they not here, or here and not mixing?']] });
      g.push({ k: 'the other faces, same counties', opts: [
        ['all four at once', 'do the four faces agree inside one country?'],
        ['the income gap', 'does the income gap track climbing?'],
        ['the life gap', 'does the life gap track climbing?'],
        ['house values', 'do house values track climbing?']] });
      g.push({ k: 'against the place', opts: [['median income', 'mobility and income'],
        ['poverty', 'mobility and poverty'], ['rent', 'mobility and rent']] });
      g.push({ k: 'not in the atlas', gaps: [['mobility outside the US',
        'This layer is US commuting zones only.', null]] });
    } else if (dim === 'place') {
      g.push({ k: 'not in the atlas', gaps: [['a country',
        'Opportunity is measured across 741 US commuting zones, so the place is fixed.', null]] });
    } else if (dim === 'scope') {
      g.push({ k: 'not in the atlas', gaps: [['a region, or a group of countries',
        'This layer is one country, so there is no set of countries to choose from.', null]] });
    } else if (dim === 'form') {
      g.push({ k: 'not in the atlas', gaps: [
        ['a ranking, a spread, a Lorenz curve',
          'Those read a measure across countries. This layer has one country and 741 zones.', null],
        ['wealth, income and life expectancy at once',
          'That needs wealth, income and health for the same place. Opportunity is not measured that way.', null]] });
    } else {
      g.push({ k: 'not in the atlas', gaps: [['over time',
        'The zone data is one snapshot, of children born in the early 1980s.', null]] });
    }
    return g;
  }
  if (dim === 'place') {
    const pool = placePool(), cur = cell.place || '';
    const picked = cell.places.slice();
    // whatever is already chosen, shown together and removable, so a comparison of
    // four or five countries is something you can see and edit rather than infer
    if (picked.length) g.push({ k: picked.length > 1 ? `comparing ${picked.length}` : 'chosen',
      opts: picked.map(i => [BY_ISO[i] ? BY_ISO[i].name : i, '+' + i]), chosen: 1 });
    const f = norm(filter || '');
    if (f) {
      const hit = pool.filter(p => norm(p[0]).includes(f) && !picked.includes(p[1])).slice(0, 30);
      g.push({ k: hit.length ? 'countries' : 'nothing by that name', opts: hit.map(p => [p[0], '+' + p[1]]) });
      return g;
    }
    const reg = cur ? regionOf(cur) : null;
    if (reg) {
      const near = pool.filter(p => !picked.includes(p[1]) && regionOf(p[1]) === reg).slice(0, 9);
      if (near.length) g.push({ k: 'nearby', opts: near.map(p => [p[0], '+' + p[1]]) });
    }
    // every country the measure covers, in full, so the fold is browsable not a sample
    g.push({ k: pool.length < 20 ? `the ${pool.length} countries that carry this`
        : reg ? `all ${pool.length} countries` : `every country (${pool.length})`,
      opts: pool.filter(p => !picked.includes(p[1])).map(p => [p[0], '+' + p[1]]) });
    if (picked.length) g.push({ k: '', opts: [['all countries', '']] });
    return g;
  }
  if (dim === 'scope') {
    g.push({ k: 'the set', opts: [['the richer third (the default)', ''], ['the whole world', 'pool:all'],
      ['the poorer third', 'pool:poor']] });
    g.push({ k: 'a region', opts: REGION_KEYS.map(k => [REGION_LABEL[k], 'r:' + k]) });
    return g;
  }
  if (dim === 'form') {
    // every shape, always, with the ones this cell cannot take greyed rather than
    // hidden. hiding them teaches nothing; greying shows the whole space and names
    // the single thing standing in the way. whyNot decides which is which.
    g.push({ k: 'drawn as', opts: [['the plain reading', '']].concat(
      Object.keys(FORM_DEF).map(k => [FORM_DEF[k], k])) });
    g.push({ k: 'a reading of its own', opts: Object.keys(VIEW_DEF).map(v => [VIEW_DEF[v].label, v]) });
    return g;
  }
  if (dim === 'time') {
    const b = spanBounds();
    const since = ['run:1990', 'run:2000', 'run:2010'].filter(v => !b || +v.split(':')[1] <= b.hi);
    g.push({ k: 'a span', opts: [['a single moment', 'moment'], ['over the years', 'run']]
      .concat(since.map(v => ['since ' + v.split(':')[1], v])) });
    // the pills are shortcuts, not the whole vocabulary: any two years can be named
    if (b) {
      g.push(cell.span === 'moment'
        ? { k: 'or a year of your own', year: { lo: b.lo, hi: b.hi, at: cell.year } }
        : { k: 'or a range of your own', range: { lo: b.lo, hi: b.hi,
            from: cell.since, to: cell.until } });
    }
    return g;
  }
  if (dim === 'facet') {
    const list = FACET_MEASURES[curFacet] || [];
    if (list.length) g.push({ k: 'measure', rows: list.map(m => [m[1], m[0], coverageOf(m[0])]) });
    return g;
  }
  if (dim === 'against') {
    const own = new Set((FACET_MEASURES[curFacet] || []).map(m => m[0]));
    own.add(facetIneqDefault());
    const order = ['income_gini', 'income_top1', 'income_top10', 'income_middle40', 'income_bottom50',
      'wealth_top1', 'wealth_gini', 'wealth_bottom50',
      'life_exp', 'life_satisfaction', 'poverty_rate', 'median_income', 'gdp_pc', 'co2_pc'];
    const fams = [];
    for (const k of order) {
      if (!SERIES[k] || !META[k] || own.has(k)) continue;
      const fam = AGAINST_FAMILY[k] || 'other';
      let e = fams.find(x => x.k === fam);
      if (!e) { e = { k: fam, opts: [] }; fams.push(e); }
      e.opts.push([META[k].label, k]);
    }
    const curFam = cell.against && AGAINST_FAMILY[cell.against];
    fams.sort((a, b) => (b.k === curFam ? 1 : 0) - (a.k === curFam ? 1 : 0));
    g.push(...fams);
    g.push({ k: '', opts: [['nothing', '']] });
    return g;
  }
  return g;
}
let keepOpen = null, reopenAfter = null, lastYearField = null;
// the ribbon: one path across every section, pinching at every other seam so the
// strip reads as a folded band, the way the cube's net would hinge open
function drawRibbon(foldAt) {
  const ribs = document.getElementById('ribs'), svg = document.getElementById('ribbon');
  if (!ribs || !svg) return;
  const panels = [...ribs.children].filter(r => r.offsetWidth > 0);
  if (!panels.length) { svg.innerHTML = ''; return; }
  const box = ribs.getBoundingClientRect();
  if (!box.height) return;
  const fold = foldAt == null ? FOLD : foldAt;   // 0 is a plain rectangle: the box before it folds
  // on a narrow screen the folds wrap onto two or three rows, and each row is its own
  // band. drawing them as one strip made the outline as wide as every fold laid end
  // to end, and a phone zoomed the whole page out to fit it
  const rows = [];
  for (const p of panels) {
    const r = p.getBoundingClientRect();
    const y = Math.round(r.top - box.top);
    let row = rows.find(w => Math.abs(w.y - y) < 4);
    if (!row) { row = { y, h: 0, cells: [] }; rows.push(row); }
    row.h = Math.max(row.h, Math.round(r.height));
    row.cells.push({ p, x0: Math.round(r.left - box.left), x1: Math.round(r.right - box.left) });
  }
  let face = '', edges = '', seams = '';
  for (const row of rows) {
    const { y, h, cells } = row;
    const xs = [cells[0].x0, ...cells.map(c => c.x1)];
    const top = i => y + (i % 2 ? fold : 0);
    const bot = i => y + (i % 2 ? h - fold : h);
    let d = `M ${xs[0]} ${top(0)}`;
    for (let i = 1; i < xs.length; i++) d += ` L ${xs[i]} ${top(i)}`;
    for (let i = xs.length - 1; i >= 0; i--) d += ` L ${xs[i]} ${bot(i)}`;
    face += `<path class="rb-face" d="${d} Z"/>`;
    // clip each section to the exact fold it is drawn as, so what you click is what you see
    cells.forEach((c, i) => {
      c.p.style.clipPath = `polygon(0 ${top(i) - y}px, 100% ${top(i + 1) - y}px, 100% ${bot(i + 1) - y}px, 0 ${bot(i) - y}px)`;
      const col = getComputedStyle(c.p).getPropertyValue('--rc').trim() || 'currentColor';
      edges += `<path class="rb-edge" style="stroke:${col}" d="M ${xs[i]} ${top(i)} L ${xs[i + 1]} ${top(i + 1)}"/>` +
        `<path class="rb-edge" style="stroke:${col}" d="M ${xs[i]} ${bot(i)} L ${xs[i + 1]} ${bot(i + 1)}"/>`;
      if (i === 0) edges += `<path class="rb-edge" style="stroke:${col}" d="M ${xs[0]} ${top(0)} L ${xs[0]} ${bot(0)}"/>`;
      if (i === cells.length - 1) edges += `<path class="rb-edge" style="stroke:${col}" d="M ${xs[i + 1]} ${top(i + 1)} L ${xs[i + 1]} ${bot(i + 1)}"/>`;
    });
    for (let i = 1; i < xs.length - 1; i++) {
      seams += `<line class="rb-seam" x1="${xs[i]}" y1="${top(i)}" x2="${xs[i]}" y2="${bot(i)}"/>`;
    }
  }
  const W = Math.round(box.width), H = Math.round(box.height);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.innerHTML = face + seams + edges;
}
const FOLD = 11;
let foldRAF = null;
// the box does not get swapped for the ribbon: the same outline folds into it,
// from a flat rectangle (fold 0) to the pleated band (fold FOLD)
function morphRibbon() {
  cancelAnimationFrame(foldRAF);
  const t0 = performance.now(), dur = 460;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    drawRibbon(FOLD * (1 - Math.pow(1 - k, 3)));
    if (k < 1) foldRAF = requestAnimationFrame(step);
  };
  foldRAF = requestAnimationFrame(step);
}
window.addEventListener('resize', () => requestAnimationFrame(() => drawRibbon()));
// whatever changes the strip's size -- a fold opening, a font landing, the window --
// redraws the outline. no call site has to remember.
function watchLayout() {
  if (!window.ResizeObserver) return;
  const ribs = document.getElementById('ribs');
  if (ribs) new ResizeObserver(() => requestAnimationFrame(() => drawRibbon())).observe(ribs);
  const deck = document.getElementById('deck');
  if (deck) new ResizeObserver(() => requestAnimationFrame(syncDeck)).observe(deck);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => drawRibbon());
}
function closeDrawer() {
  document.querySelectorAll('.rib.expanded').forEach(r => r.classList.remove('expanded'));
  document.querySelectorAll('.rib-head').forEach(h => h.setAttribute('aria-expanded', 'false'));
  const d = document.getElementById('rib-drawer');
  if (d) { d.hidden = true; d.innerHTML = ''; }
}
function renderDrawer(dim, rib, opts, filter) {
  const groups = dimGroups(dim, filter), cur = dimCurrent(dim);
  // groups only earn a heading when there is more than one and they are named
  const named = groups.filter(g => g.k && (g.opts || g.rows || []).length);
  const heads = named.length > 1;
  const pills = [], gaps = [];
  let range = null, yearPick = null, rangeK = '';
  for (const grp of groups) {
    if (grp.range) { range = grp.range; rangeK = grp.k || ''; continue; }
    if (grp.year) { yearPick = grp.year; rangeK = grp.k || ''; continue; }
    if (heads && grp.k && (grp.opts || grp.rows || []).length) pills.push(['\u0001' + grp.k, '']);
    for (const o of grp.opts || []) {
      const bad = grp.chosen ? null : whyNot(dim, o[1]);
      pills.push(grp.chosen ? [o[0], o[1], 'chosen'] : (bad ? [o[0], o[1], 'off', bad] : o));
    }
    for (const r of grp.rows || []) pills.push([r[0], r[1]]);
    for (const gp of grp.gaps || []) gaps.push(gp);
  }
  const capped = dim === 'place' ? pills
    : filter ? pills.slice(0, 20) : pills.slice(0, heads ? 14 : 8);
  let html = '';
  if (dim === 'place' && !onUs())
    html += `<input type="text" class="opt-find" id="opt-q" autocomplete="off" spellcheck="false" placeholder="find a country" value="${esc(filter || '')}">`;
  html += `<div class="opt-wrap${dim === 'place' ? ' opt-scroll' : ''}">` + capped.map(o =>
    (o[0][0] === '\u0001'
      ? `<span class="opt-group-k">${esc(o[0].slice(1))}</span>`
      : `<button type="button" class="opt${o[2] === 'chosen' ? ' on picked' : o[2] === 'off' ? ' off' : o[1] === cur ? ' on' : ''}" ` +
        `data-val="${esc(o[1])}"${o[2] === 'off' ? ` data-why="${esc(o[3])}" aria-disabled="true"` : ''}` +
        `>${esc(o[0])}${o[2] === 'chosen' ? '<span class="opt-x">\u00d7</span>' : ''}</button>`)
  ).join('') + '</div>';
  // typing a year is the precise way in; the pills above are only the common cases
  const yrIn = (id, val, lo, hi, lab) =>
    `<label class="opt-yr"><span>${esc(lab)}</span>` +
    `<input type="number" id="${id}" inputmode="numeric" step="1" min="${lo}" max="${hi}" ` +
    `placeholder="${lo === hi ? lo : (id === 'yr-to' ? hi : lo)}" value="${val == null ? '' : val}"></label>`;
  if (range) html += `<div class="opt-range"><span class="opt-group-k">${esc(rangeK)}</span>` +
    yrIn('yr-from', range.from, range.lo, range.hi, 'from') +
    yrIn('yr-to', range.to, range.lo, range.hi, 'to') +
    `<span class="opt-yr-note">${range.lo} to ${range.hi} on record</span></div>`;
  if (yearPick) html += `<div class="opt-range"><span class="opt-group-k">${esc(rangeK)}</span>` +
    yrIn('yr-at', yearPick.at, yearPick.lo, yearPick.hi, 'year') +
    `<span class="opt-yr-note">${yearPick.lo} to ${yearPick.hi} on record</span></div>`;
  if (gaps.length) html += '<p class="opt-miss">not in the atlas: ' + gaps.map((gp, i) =>
    `<button type="button" class="opt-gap" data-g="${i}">${esc(gp[0])}</button>`).join(', ') + '</p>';
  html += '<p class="opt-note" hidden></p>';
  opts.innerHTML = html;
  // the drawer takes the colour of the thing being chosen, so the pick reads as that measure
  opts.style.setProperty('--pick', dim === 'against' && cur && META[cur] ? metricColor(cur)
    : dim === 'facet' ? ACC() : 'var(--accent)');

  const offNote = opts.querySelector('.opt-note');
  opts.querySelectorAll('.opt').forEach(btn => btn.addEventListener('click', () => {
    const v = btn.dataset.val;
    if (btn.dataset.why) {   // greyed: say what is in the way, change nothing
      if (offNote) { offNote.textContent = btn.dataset.why; offNote.hidden = false; }
      return;
    }
    if (onUs() && dim !== 'facet') { closeDrawer(); ask(v); return; }
    if (dim === 'place' && v) { keepOpen = dim; applyDim(dim, v); keepOpen = null; return; }
    closeDrawer();
    applyDim(dim, v);
  }));
  // a gap never answers: it says what is missing, and offers the nearest real measure
  const note = opts.querySelector('.opt-note');
  opts.querySelectorAll('.opt-gap').forEach(btn => btn.addEventListener('click', () => {
    const gp = gaps[+btn.dataset.g], near = gp[2];
    note.innerHTML = `<b>${esc(gp[0])}</b> is not in the atlas.` + (gp[1] ? ' ' + esc(gp[1]) : '') +
      (near && META[near] ? ` Closest: <button type="button" class="opt-near" data-val="${esc(near)}">${esc(META[near].label)}</button>` : '');
    note.hidden = false;
    const nb = note.querySelector('.opt-near');
    if (nb) nb.addEventListener('click', () => { closeDrawer(); applyDim(dim, nb.dataset.val); });
  }));
  const num = el => { const v = parseInt(el.value, 10); return isFinite(v) ? v : null; };
  const commitYears = () => {
    if (yearPick) {
      const at = num(opts.querySelector('#yr-at'));
      keepOpen = dim; applyDim('time', 'moment' + (at ? ':' + at : '')); keepOpen = null;
      return;
    }
    const a = num(opts.querySelector('#yr-from')), b = num(opts.querySelector('#yr-to'));
    keepOpen = dim;
    applyDim('time', 'run' + (a || b ? ':' + (a || '') : '') + (b ? ':' + b : ''));
    keepOpen = null;
  };
  opts.querySelectorAll('.opt-yr input').forEach(inp => {
    inp.addEventListener('change', commitYears);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commitYears(); } });
    // a fold that reopens under the cursor should put you back where you were typing
    inp.addEventListener('focus', () => { lastYearField = inp.id; });
  });
  const find = opts.querySelector('#opt-q');
  if (find) find.addEventListener('input', () => {
    const v = find.value;
    renderDrawer(dim, rib, opts, v);
    const nf = opts.querySelector('#opt-q');
    if (nf) { nf.focus(); nf.setSelectionRange(v.length, v.length); }
  });
}
// walk to the next value of a variable without opening anything
function randomOf(a) { return a[Math.floor(Math.random() * a.length)]; }
// ── the die ─────────────────────────────────────────────────────────
// Building a question is work, and a reader who does not yet know what the atlas can
// answer has no way to start. The die asks one for them and answers it outright: it
// turns the cube, picks a question from the catalogue, finds a country that question
// actually runs for, and sends it. It never lands on a refusal, because it checks each
// candidate against whyNot, the same rule the drawer greys options with, and rolls
// again if it somehow does.
const DIE = ['\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];
function shuffled(a) {
  const c = a.slice();
  for (let i = c.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    const t = c[i]; c[i] = c[k]; c[k] = t;
  }
  return c;
}
// Every catalogue question, carrying the face it belongs to, ordered so that a face
// with seven questions does not come up seven times as often as one with two. Pick a
// face first and a question inside it second: the wealth face had grown to where three
// rolls in five landed on it.
function rollable() {
  const byFace = new Map();
  for (const g of QUESTIONS) {
    const face = g.facet || 'any';
    if (!byFace.has(face)) byFace.set(face, []);
    for (const q of g.qs) byFace.get(face).push({ q, face: g.facet || null });
  }
  const faces = shuffled([...byFace.keys()]);
  const out = [];
  // one question from each face in turn, then the next from each, and so on
  const queues = faces.map(f => shuffled(byFace.get(f)));
  for (let i = 0; queues.some(q => q.length); i++) {
    for (const q of queues) if (q.length) out.push(q.shift());
  }
  return out;
}
// A reading drawn for one country, asked without one, used to stop and ask. Typing a
// question and getting nothing back reads as the box being broken, so it picks a
// country the reading actually supports and shows it in the place pill, where it can
// be changed. whyNot is the same rule the drawer greys options with, so a pick that
// passes it cannot refuse later.
const recentPlaces = [];
function pickPlaceFor(shape) {
  if (cell.place && !whyNot('form', shape) && !whyNot('place', cell.place)) return cell.place;
  const fits = iso => {
    const keep = cell.place;
    cell.place = iso;
    const bad = whyNot('form', shape) || whyNot('place', iso);
    cell.place = keep;
    return !bad;
  };
  if (ctx.lastIso && BY_ISO[ctx.lastIso] && fits(ctx.lastIso)) return ctx.lastIso;
  const pool = placePool().map(p => p[1]);
  // somewhere the reading covers, preferring the better-measured set and somewhere
  // the last few answers have not already been about
  const rt = richThird();
  // Somewhere well measured first, then anywhere at all, then repeats. Trying the
  // richer third twice before anywhere else made almost every answer European, since
  // that is what the richer third mostly is.
  const tiers = [
    shuffled(pool.filter(i => rt.has(i) && !recentPlaces.includes(i))),
    shuffled(pool.filter(i => !rt.has(i) && !recentPlaces.includes(i))),
    shuffled(pool.filter(i => !recentPlaces.includes(i))),
    shuffled(pool),
  ];
  for (const tier of tiers) for (const iso of tier) if (fits(iso)) return iso;
  return null;
}
function notePlace(iso) {
  if (!iso) return;
  recentPlaces.unshift(iso);
  if (recentPlaces.length > 8) recentPlaces.length = 8;
}
let lastRolled = null;
let rolling = false;
function rollOnce() {
  rolling = true;
  try { return rollOnceInner(); } finally { rolling = false; }
}
function rollOnceInner() {
  const picks = rollable().filter(x => x.q !== lastRolled);   // already face-interleaved
  for (const pick of picks) {
    // A question that belongs to no face used to be shown on whichever face happened to
    // be up, so a wealth roll kept the cube on wealth and the next unfaceted question
    // stayed there too. It gets a face of its own instead.
    const OPEN = ['wealth', 'income'];
    const face = pick.face || randomOf(OPEN);
    if (FACETS[face] && !FACETS[face].soon && face !== curFacet) { paintFacet(face); faceToFront(face); }
    hideNotice();
    chain.length = 0;
    if (US_FACES.includes(face)) {                 // that layer answers in one step
      ask(pick.q);
      if (chain.length) { lastRolled = pick.q; return pick.q; }
      continue;
    }
    setStage('compose'); resetCell(); ctx.lastIso = null;
    if (!previewQuestion(pick.q)) continue;
    // a reading drawn for one country needs one it can actually be drawn for, and
    // whyNot is what already knows which those are
    const shape = cell.view || cell.form || '';
    if (cellNeedsPlace() || (cell.view && VIEW_DEF[cell.view] && VIEW_DEF[cell.view].oneOnly)) {
      const found = pickPlaceFor(shape);
      if (!found) continue;
      cell.place = found;
      notePlace(found);
    }
    updateCell();
    sendCell();
    if (chain.length) { lastRolled = pick.q; return pick.q; }
  }
  return null;
}
// Bring the thing that just changed onto the screen. Without this an answer lands
// below the fold on a laptop, the eye is still on the cube, and a roll or a new
// question reads as nothing having happened.
let revealT = null;
let revealLater = [];
function revealAnswer(sel) {
  // every look-again from the last reveal goes too: left running, a second roll within a
  // couple of seconds was scrolled back to where the first answer had been
  clearTimeout(revealT);
  revealLater.forEach(clearTimeout); revealLater = [];
  revealT = setTimeout(() => {
    const el = document.querySelector(sel || '#answer');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The cube, the ask box and the accordion sit in a sticky deck at the top of the
    // page. Scrolling the answer to a fixed offset put it underneath them, which looked
    // exactly like no answer at all, so the deck's real height is measured each time.
    // the deck scrolls away with the page and the minibar takes its place, so the
    // answer goes to just under the minibar
    const clear = () => { const bar = document.getElementById('minibar'); return (bar ? bar.offsetHeight : 0) + 12; };
    // on a laptop an answer whose chart runs off the bottom is brought up under the
    // minibar, where the sentence and the whole chart fit; it used to stop with the deck
    // still taking the top half and the chart cut off below
    const chartCut = () => {
      if (sel && sel !== '#answer') return false;
      if (window.matchMedia('(max-width: 720px)').matches) return false;
      const ch = document.getElementById('chart');
      return !!ch && ch.getBoundingClientRect().bottom > window.innerHeight;
    };
    const go = () => {
      const box = el.getBoundingClientRect();
      const top = clear();
      if (box.top >= top - 4 && box.top < window.innerHeight * 0.7 && !chartCut()) return;
      window.scrollTo({ top: Math.max(0, window.scrollY + box.top - top),
        behavior: smooth ? 'smooth' : 'auto' });
    };
    // on a phone the deck scrolls with the page, so its shrink moves the answer: the first
    // scroll waits for it rather than aiming at where the answer was and overshooting
    if (window.matchMedia('(max-width: 720px)').matches) revealLater.push(setTimeout(go, 420)); else go();
    // the cube shrinks once there is an answer, which pulls everything up under the
    // scroll that just ran, so the position is taken again while it settles. one second
    // look was not enough on a phone: the shrink outlasted it and the answer ended above
    // the top of the screen. later looks correct only a real drift, and without easing
    const settle = () => {
      const box = el.getBoundingClientRect(), top = clear();
      if (box.top < top - 24 || box.top > window.innerHeight * 0.7 || (chartCut() && box.top > top + 24))
        window.scrollTo({ top: Math.max(0, window.scrollY + box.top - top), behavior: 'auto' });
    };
    revealLater.push(setTimeout(go, 900), setTimeout(settle, 1300), setTimeout(settle, 1700));
  }, 140);
}
function shakeCube() {
  // one clean revolution that lands square on a face. no tumbling off into space.
  motion = 'still';
  if (motRAF) { cancelAnimationFrame(motRAF); motRAF = null; }
  clearTimeout(settleT);
  cRotX = Math.round(cRotX / 90) * 90;
  cRotY = Math.round(cRotY / 90) * 90 + 360 + (1 + Math.floor(Math.random() * 3)) * 90;
  baseX = cRotX; baseY = cRotY;
  cubeApply();
  const pip = document.getElementById('die-pip');
  if (pip) pip.textContent = randomOf(DIE);
  setTimeout(() => {
    const q = rollOnce();
    if (!q) showNotice('Nothing came up. Roll again.');
    else { const el = document.getElementById('q'); if (el) el.value = q; }
    settle();
    revealAnswer();
  }, 560);
}
function stepDim(dim, dir) {
  // the place fold lists its countries as toggles ("+GBR", add or drop it), and the
  // arrows compared those with the bare "GBR" on screen. nothing matched, so the next
  // arrow toggled the current country off and the answer was left with no place.
  // the arrows move the one place along; they never add, drop or land on a refusal.
  const bare = v => (dim === 'place' && v[0] === '+') ? v.slice(1) : v;
  const flat = [];
  for (const g of dimGroups(dim, '')) for (const o of (g.opts || [])) {
    const v = o[1] && bare(o[1]);
    if (v && !flat.includes(v) && !whyNot(dim, v)) flat.push(v);
  }
  if (!flat.length) return;
  const at = flat.indexOf(dimCurrent(dim));
  if (at >= 0 && flat.length === 1) {
    showNotice(`There is nothing else to step to here: this reading has figures for ${
      dim === 'place' ? (BY_ISO[flat[0]] ? esc(BY_ISO[flat[0]].name) : esc(flat[0])) + ' only' : 'this choice only'}.`);
    return;
  }
  applyDim(dim, flat[(at + dir + flat.length) % flat.length]);
}
// A fold with nothing it can change for this reading: 23 of 74 opened in the usability
// runs offered only greyed options. It is drawn as fixed and says why when touched.
function foldDead(dim) {
  if (!['scope', 'against'].includes(dim)) return null;
  if (onUs()) return 'The US layer is one country, read against its own measures, so this does not apply to it.';
  if (!chain.length && stage !== 'chain') return null;
  const cur = dimCurrent(dim);
  const opts = (dimGroups(dim, '') || []).flatMap(g => g.opts || []).map(o => o[1]).filter(v => v != null);
  if (opts.some(v => v !== cur && !whyNot(dim, v))) return null;
  const first = opts.find(v => v !== cur);
  return (first != null && whyNot(dim, first)) || 'Nothing here changes this reading.';
}
function markFixedFolds() {
  for (const dim of ['scope', 'against']) {
    const rib = document.getElementById('rib-' + dim); if (!rib) continue;
    const why = foldDead(dim);
    rib.classList.toggle('fixed', !!why);
    const head = rib.querySelector('.rib-head');
    if (head) { if (why) head.setAttribute('title', why); else head.removeAttribute('title'); }
  }
}
function toggleRib(dim) {
  const rib = document.getElementById('rib-' + dim); if (!rib) return;
  const drawer = document.getElementById('rib-drawer'); if (!drawer) return;
  const wasOpen = rib.classList.contains('expanded');
  closeDrawer();
  if (wasOpen) return;             // touching the open pleat folds it back
  const dead = foldDead(dim);
  if (dead) {
    drawer.innerHTML = `<p class="opt-note fold-fixed">${esc(dead)}</p>`;
    drawer.hidden = false; rib.classList.add('expanded');
    const h = rib.querySelector('.rib-head'); if (h) h.setAttribute('aria-expanded', 'true');
    return;
  }
  renderDrawer(dim, rib, drawer, '');
  drawer.hidden = false;
  rib.classList.add('expanded');
  const head = rib.querySelector('.rib-head');
  if (head) head.setAttribute('aria-expanded', 'true');
}
function wireCell() {
  ['facet', 'place', 'scope', 'time', 'against', 'form'].forEach(dim => {   // every fold opens onto its alternatives
    const head = document.querySelector('#rib-' + dim + ' .rib-head');
    if (head) head.addEventListener('click', () => toggleRib(dim));
  });
  document.querySelectorAll('.rib-x').forEach(x => x.addEventListener('click', e => {
    e.stopPropagation(); applyDim(x.dataset.clear, '');   // X out a branch of the cell
  }));
  document.querySelectorAll('.rib-step').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation(); stepDim(btn.dataset.step, +btn.dataset.dir);
  }));
  const ub = document.getElementById('us-back');
  if (ub) ub.addEventListener('click', () => flipTo('ask', true));
}
// click the measure in the accordion to swap it, e.g. top 1% share to wealth Gini
function cycleMeasure() {
  const list = FACET_MEASURES[curFacet]; if (!list || list.length < 2) return;
  facetMeasureIdx[curFacet] = ((facetMeasureIdx[curFacet] || 0) + 1) % list.length;
  ctx.metric = facetMeasure(curFacet);
  paintFacet(curFacet);
  if (chain.length) runCell();
}
let baseX = 0, baseY = 0, cubeScale = 1;   // the resting orientation of the active face
function faceToFront(name) {
  const f = FACETS[name];
  let tx, ty;
  if (f && f.side) { tx = 0; ty = -90 * f.i; }
  else if (name === 'link') { tx = -90; ty = 0; }
  else { tx = 90; ty = 0; }
  // land on the nearest wound copy of the target so the turn is always the short way
  cRotX = nearestEquivalent(tx, cRotX);
  cRotY = nearestEquivalent(ty, cRotY);
  // the wobble has to start from the wound angles too, or it unwinds a whole turn
  baseX = cRotX; baseY = cRotY;
  cubeApply();
}
// user turns to a facet: switch the lens, refresh the starters, recompute what's on screen
// an interaction acts on the face you're on, then hands the cube back to it
function runInteraction(name) {
  // you land on the pole and stay there. the face you were reading is untouched.
  document.querySelectorAll('#cube .face').forEach(el => el.classList.toggle('lit', el.dataset.facet === name));
  if (name === 'link') { ask('how do wealth, income and life expectancy sit together?'); return; }
  showNotice(`Extend reads ${curFacet} through time and across geography. Open <em>when</em> or <em>place</em> in the strip.`);
}
function chooseFacet(name) {
  if (INTERACTIONS[name]) { runInteraction(name); return; }
  if (!FACETS[name]) return;
  if (FACETS[name].soon) {   // a closed face turns to, and says so, but sets nothing
    paintFacet(name); faceToFront(name); settle(); updateChips();
    showNotice(FACETS[name].note);
    return;
  }
  paintFacet(name);
  faceToFront(name);
  settle();
  hideNotice();
  const f = FACETS[name];
  const fm = facetMeasure(name);
  if (fm) ctx.metric = fm; else if (f.metric) ctx.metric = f.metric;
  if (f.note) showNotice(f.note);
  updateChips();
  const hp = document.getElementById('help');
  if (hp && !hp.hidden) setHelp(true, (document.getElementById('q') || {}).value);   // the open catalogue follows the face
  nextPrompt(true);   // the example prompt follows the facet
  rerunCurrent();     // re-read the same cell under the new facet, cube and chart follow
}
// motion: a slow tumble before anything is chosen, then a crisp snap to the
// chosen face and a small wobble around it, a reminder the other faces are there
let cDragging = false, clx = 0, cly = 0, cMoved = 0, motRAF = null, mClk = 0, wob0 = 0, motion = 'tumble', settleT = null;
function motionStep() {
  mClk += 1;
  if (motion === 'tumble') {
    const s = mClk * 0.0042;
    cRotY = Math.sin(s) * 40 + Math.sin(s * 0.63 + 1.1) * 14;
    cRotX = Math.sin(s * 0.86 + 2.0) * 34 + Math.sin(s * 0.42) * 12;
    cubeApply();
  } else if (motion === 'wobble') {
    const s = (mClk - wob0) * 0.0048;   // starts at 0 so the wobble eases out of the snap
    if (Math.abs(baseX) > 45) {   // interplay / scope sit at the poles: wobble inward, never across
      const dir = baseX < 0 ? 1 : -1;
      cRotX = baseX + dir * Math.abs(Math.sin(s * 0.83)) * 15;
      cRotY = baseY + Math.sin(s) * 9;
    } else {
      cRotY = baseY + Math.sin(s) * 14 + Math.sin(s * 0.57 + 1.2) * 6;
      cRotX = baseX + Math.sin(s * 0.83 + 2.1) * 12 + Math.sin(s * 0.44) * 5;
    }
    cubeApply();
  }
  motRAF = (motion === 'tumble' || motion === 'wobble') ? requestAnimationFrame(motionStep) : null;
}
function runMotion() { if (!reduceMotion && !motRAF && (motion === 'tumble' || motion === 'wobble')) motRAF = requestAnimationFrame(motionStep); }
// let the CSS transition land the face, then ease the wobble back in
function settle() {
  clearTimeout(settleT);
  motion = 'still';
  if (motRAF) { cancelAnimationFrame(motRAF); motRAF = null; }
  cubeApply();
  if (reduceMotion) return;
  settleT = setTimeout(() => { wob0 = mClk; motion = 'wobble'; runMotion(); }, 660);
}
function startIdle() { motion = 'tumble'; runMotion(); }
function stopIdle() { if (motion !== 'tumble') return; faceToFront(curFacet); settle(); }
function cubeSnap() {
  // whichever face ended up nearest the viewer wins, from any tumbled orientation
  chooseFacet(facetFromAngles());
}
// the deck no longer condenses: it scrolls away and the minibar stands in for it
let stage = 'compose', stageFocus = true;   // compose -> chain -> result
function setStage(next) {
  const from = stage;
  stage = next;
  const v = document.getElementById('view-ask');
  if (v) { v.classList.remove('stage-compose', 'stage-chain', 'stage-result'); v.classList.add('stage-' + next); }
  const q = document.getElementById('q');
  if (next === 'compose') { if (q && stageFocus) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  else setHelp(false);
  // The folds close once there is an answer. They stay open while you are composing,
  // because picking three countries in a row is one gesture, but an answer you have to
  // scroll past a fold to read is not an answer.
  closeDrawer();
  render();
  if (next === 'chain' && from === 'compose') {
    requestAnimationFrame(morphRibbon);
    // the fold it cannot proceed without opens itself, rather than being found after a refusal
    if (cellNeedsPlace()) requestAnimationFrame(() => toggleRib('place'));
  }
  requestAnimationFrame(syncDeck);
}
// kinds the cell has no coordinates for: keep the words, run them verbatim on send
// `reads` is what the pill says the reading is looking at, since these do not use the
// face's own measure and saying they do was a lie the reader could see.
const VIEW_FACE = { have: 'wealth', weather: 'wealth', underwater: 'wealth', made: 'wealth', owns: 'wealth',
  wmultiple: 'wealth', houses: 'wealth', multiple: 'income', basket: 'income', three: 'income', reach: 'income' };
const VIEW_DEF = {
  reach:  { label: 'growth against the middle', uses: ['place'], ignores: ['facet', 'against', 'when'], needsPlace: 1, oneOnly: 1, reads: 'output and pay' },
  houses: { label: 'houses against pay', uses: ['place'], ignores: ['facet', 'against', 'when'], needsPlace: 1, oneOnly: 1, reads: 'houses and pay' },
  ratio:  { label: 'richest tenth, poorest half', uses: ['place', 'among'], ignores: ['facet', 'against', 'when'], reads: 'wealth shares' },
  // These five bring their own measures, so the facet and the "against" fold have nothing
  // to do. The years do: a reading of the whole record and a reading since 2000 are
  // different answers, and the reader should be able to ask for either.
  have:    { label: 'what a family actually has', uses: ['place', 'when'], ignores: ['facet', 'against', 'among'], needsPlace: 1, oneOnly: 1, moment: 1, reads: 'net worth in dollars' },
  weather: { label: 'could you take a hit', uses: ['place', 'when'], ignores: ['facet', 'against', 'among'], oneOnly: 1, moment: 1, reads: 'households with nothing spare' },
  underwater: { label: 'who owes more than they own', uses: ['place', 'when'], ignores: ['facet', 'against', 'among'], oneOnly: 1, moment: 1, reads: 'households below zero' },
  made:   { label: 'what the wealth is made of', uses: ['place', 'when'], ignores: ['facet', 'against', 'among'], needsPlace: 1, oneOnly: 1, moment: 1, reads: 'assets and debts by group' },
  owns:   { label: 'what the bottom half owns', uses: ['place', 'when'], ignores: ['facet', 'against'], needsPlace: 1, oneOnly: 1, window: 1, spanOf: 'wealth_bottom50', reads: 'wealth shares' },
  wmultiple: { label: 'owning against earning', uses: ['place', 'among'], ignores: ['facet', 'against', 'when'], needsPlace: 1, oneOnly: 1, reads: 'wealth and income' },
  multiple: { label: 'one person against one', uses: ['place', 'when'], ignores: ['facet', 'against'], needsPlace: 1, oneOnly: 1, window: 1, spanOf: 'income_top1', reads: 'income shares' },
  basket: { label: 'what the middle lives on', uses: ['place', 'when'], ignores: ['facet', 'against'], needsPlace: 1, oneOnly: 1, window: 1, spanOf: 'median_income', reads: 'median income' },
  three:  { label: 'the country in three parts', uses: ['place', 'when'], ignores: ['facet', 'against'], needsPlace: 1, oneOnly: 1, window: 1, spanOf: 'income_middle40', reads: 'three income shares' },
  triple: { label: 'all three faces at once', uses: ['place'], ignores: ['facet', 'against', 'among', 'when'], reads: 'all three faces' },
  tables: { label: 'the two league tables', uses: ['place'], ignores: ['facet', 'against', 'when'], reads: 'two rankings' },
  turn:   { label: 'the sharpest years here', uses: ['place'], ignores: ['against', 'among', 'when'], needsPlace: 1, oneOnly: 1 },
  peers:  { label: 'against similar countries', uses: ['place', 'when'], ignores: ['against', 'among'], needsPlace: 1, oneOnly: 1 },
};
// ── what this cell can and cannot take ──────────────────────────────
// One place for every rule about which options fit which cell. The drawer greys out
// what does not fit and says why when you press it, and sendCell asks the same
// function before computing, so the fold and the answer can never disagree. Showing a
// greyed option beats hiding it: hiding teaches nothing, greying shows the shape of
// what is possible and names the one thing standing in the way.
function whyNot(dim, val) {
  if (onUs()) return null;   // that layer runs its own rules
  const held = cell.against && META[cell.against];
  const n = cell.places.length;
  if (dim === 'form') {
    const v = VIEW_DEF[val];
    if (v) {
      // No longer a refusal. A reading drawn for one country now has one chosen for it
      // on send, and the pill says which, so greying the option here would have the
      // drawer saying no to something the app then goes ahead and does.
      if (v.needsPlace && !cell.place && !pickPlaceFor(val))
        return `${cap(v.label)} is drawn for one country, and the atlas holds none that ` +
          `carry it.`;
      if (val === 'houses') {
        const have = Object.keys(SERIES.house_price || {}).filter(i => BY_ISO[i]);
        if (!have.length) return 'No house price series is loaded.';
        if (cell.place && !have.includes(cell.place))
          return `House prices are held for ${have.length} countries from the OECD, ` +
            `not for ${BY_ISO[cell.place] ? BY_ISO[cell.place].name : cell.place}.`;
      }
      if (val === 'have' && cell.place && cell.place !== 'USA')
        return `A family's net worth in money comes from the Survey of Consumer Finances, ` +
          `which is the United States, not ${theName(cell.place)}.`;
      if (val === 'weather' && cell.place && !resilienceFor(cell.place))
        return `Whether a household could absorb a shock comes from a household survey. ` +
          (HFCS_RES && HFCS_RES.by[cell.place]
            ? `It covers ${theName(cell.place)} but publishes no saving figure for it.`
            : `The one the atlas holds covers the euro area and a few neighbours, not ` +
              `${theName(cell.place)}.`);
      if (val === 'underwater' && cell.place && !(HFCS_NEG && HFCS_NEG.by[cell.place]))
        return `Counting households below zero takes a household survey, and the one the atlas ` +
          `holds covers the euro area and a few neighbours, not ${theName(cell.place)}.`;
      if (val === 'made' && cell.place && cell.place !== 'USA')
        return `What wealth is made of is published by wealth group in the United States and ` +
          `nowhere else the atlas can reach, not for ${esc(theName(cell.place))}.`;
      if (val === 'reach' && cell.place && seriesOf('median_income', cell.place).length < 2)
        return `No median income series for ${BY_ISO[cell.place].name}, so there is nothing to hold the growth against.`;
      // the three income readings each name the series they cannot do without, rather
      // than failing at send with a notice that says nothing about which one is short
      if (cell.place) {
        const need = val === 'multiple' ? [['income_top1', 'the top 1% income share'], ['income_bottom50', 'the bottom 50% income share']]
          : val === 'basket' ? [['median_income', 'a median income']]
          : val === 'three' ? [['income_top10', 'the top 10% share'], ['income_middle40', 'the middle 40% share'], ['income_bottom50', 'the bottom 50% share']]
          : val === 'owns' ? [['wealth_top1', 'the top 1% wealth share'], ['wealth_bottom50', 'the bottom 50% wealth share']]
          : val === 'wmultiple' ? [['wealth_top1', 'the top 1% wealth share'], ['wealth_bottom50', 'the bottom 50% wealth share'],
                                   ['income_top1', 'the top 1% income share'], ['income_bottom50', 'the bottom 50% income share']]
          : null;
        if (need) {
          const short = need.filter(([k]) => seriesOf(k, cell.place).length < 2);
          if (short.length)
            return `${cap(theName(cell.place))} has no ${short.map(s => s[1]).join(' and no ')} in the atlas.`;
        }
      }
      if (n > 1 && v.oneOnly)
        return `${cap(v.label)} is drawn for one country, and ${n} are chosen.`;
      return null;
    }
    if (['rank', 'least', 'spread', 'lorenz'].includes(val) && held)
      return `${cap(FORM_DEF[val])} reads one measure on its own. Drop what it is held against first.`;
    if (['tiers', 'break'].includes(val) && !held)
      return `${cap(FORM_DEF[val])} needs a second measure to split by. Add one under "against".`;
    if (val === 'lorenz') {
      if (!cell.place) return 'A Lorenz curve is drawn for one country. Name a place first.';
      if (curFacet !== 'wealth') return 'A Lorenz curve splits wealth across a population, so it needs the wealth face.';
      if (n > 5) return `A Lorenz curve draws five countries at most, and ${n} are chosen.`;
    }
    return null;
  }
  if (dim === 'against') {
    if (cell.view && (VIEW_DEF[cell.view].ignores || []).includes('against'))
      return `${cap(VIEW_DEF[cell.view].label)} brings its own measures, so it has nothing to be held against.`;
    return null;
  }
  if (dim === 'time') {
    if (cell.view && (VIEW_DEF[cell.view].ignores || []).includes('when'))
      return `${cap(VIEW_DEF[cell.view].label)} sets its own years.`;
    // these read a run and clip it; a single year would leave them nothing to compare
    if (cell.view && VIEW_DEF[cell.view].window && val === 'moment')
      return `${cap(VIEW_DEF[cell.view].label)} reads a change, so it needs a run of years rather than one.`;
    if (cell.view && VIEW_DEF[cell.view].moment && val === 'run')
      return `${cap(VIEW_DEF[cell.view].label)} is a state at one moment, so it takes a year rather than a run.`;
    if (cell.form === 'lorenz') return 'A Lorenz curve is drawn at one moment, the latest one there is.';
    return null;
  }
  if (dim === 'scope') {
    if (cell.view && (VIEW_DEF[cell.view].ignores || []).includes('among'))
      return `${cap(VIEW_DEF[cell.view].label)} reads one country, so the set it sits in makes no difference.`;
    // a reading that puts one country against a pack takes both: the place picks the
    // country and the set picks the pack it is being measured against
    const usesSet = cell.view && (VIEW_DEF[cell.view].uses || []).includes('among');
    // a plain reading of one country states its rank, and the rank is within the set
    const plain = !cell.form && !cell.span && !cell.against && !cell.view;
    if (cell.place && val && !usesSet && !plain)
      return 'A country is already named and this reading does not rank it, so the set changes nothing. Clear the place first.';
    return null;
  }
  if (dim === 'place') {
    if (cell.view === 'have' && val) {
      const iso = val[0] === '+' ? val.slice(1) : val;
      if (iso && iso !== 'USA') return `Only the United States publishes a household balance ` +
        `sheet on a run of years, so this one reading is fixed there.`;
    }
    if (cell.view === 'weather' && val) {
      const iso = val[0] === '+' ? val.slice(1) : val;
      if (iso && !resilienceFor(iso))
        return `The household survey behind this one covers the euro area and a few ` +
          `neighbours, not ${BY_ISO[iso] ? BY_ISO[iso].name : iso}. Clear the place for the ` +
          `euro area as a whole.`;
    }
    if (cell.view === 'underwater' && val) {
      const iso = val[0] === '+' ? val.slice(1) : val;
      if (iso && !(HFCS_NEG && HFCS_NEG.by[iso]))
        return `The household survey behind this one covers the euro area and a few ` +
          `neighbours, not ${BY_ISO[iso] ? BY_ISO[iso].name : iso}. Clear the place for the ` +
          `euro area as a whole.`;
    }
    if (cell.view === 'made' && val) {
      const iso = val[0] === '+' ? val.slice(1) : val;
      if (iso && iso !== 'USA') return `Only the United States publishes what wealth is made of ` +
        `by wealth group, so this one reading is fixed there.`;
    }
    if (cell.view === 'houses' && val) {
      const iso = val[0] === '+' ? val.slice(1) : val;
      if (iso && !seriesOf('house_price', iso).length)
        return `No house price series for ${BY_ISO[iso] ? BY_ISO[iso].name : iso}. The OECD series covers ${Object.keys(SERIES.house_price || {}).filter(i => BY_ISO[i]).length} countries and it is not one of them.`;
    }
    return null;
  }
  return null;
}
const FORM_DEF = {
  rank: 'a ranking, highest first', least: 'a ranking, lowest first', spread: 'the spread', lorenz: 'a Lorenz curve',
  tiers: 'by tier', break: 'who breaks the pattern',
};
// what the strip says the opportunity layer is showing, one line per reading
const OPP_SHOWN = {
  faces: 'the four faces against each other', pair: 'two faces, by county',
  conn: 'who you grow up around', mix: 'around them, or mixing with them',
  mobility: 'where children climb', life: 'how long rich and poor live',
  gap: "by their parents' income", scatter: 'against one covariate', place: 'one place, against the rest',
};
const OPP_READS = {
  faces: 'five measures, US counties', pair: 'two measures, US counties',
  conn: 'connectedness and climbing', mix: 'exposure and friending bias',
  mobility: 'climbing, 741 zones', life: 'life expectancy at 40, 595 zones',
  gap: 'credit, mortgages, arrears', scatter: '741 US commuting zones', place: 'climbing, friends, lifespan',
};
const RAW_KINDS = ['divergence', 'world', 'compare', 'threshold', 'context', 'among', 'owngap'];
// a typed question that names a measure turns the cube to that measure's face, so the
// answer is computed on what was asked and not on whichever face happened to be up
function adoptMetric(m) {
  if (!m || !META[m]) return;
  for (const f in FACET_MEASURES) {
    const i = FACET_MEASURES[f].findIndex(x => x[0] === m);
    if (i < 0) continue;
    facetMeasureIdx[f] = i;
    if (f !== curFacet && FACETS[f] && !FACETS[f].soon) { paintFacet(f); faceToFront(f); settle(); }
    ctx.metric = m;
    return;
  }
  ctx.metric = m;
}
// the catalogue questions nearest to what was typed, by shared words, so a question
// the parser cannot read is answered with three it can rather than a shrug
const STOP = new Set('a an the is are was were do does did of in on to for my it this that what how why can i be and or with about there here'.split(' '));
function nearestQuestions(q, n) {
  const words = new Set(norm(q).split(/\W+/).filter(w => w.length > 2 && !STOP.has(w)));
  const all = QUESTIONS.filter(g => !g.facet || g.facet === curFacet).flatMap(g => g.qs);
  const scored = all.map(c => ({ c, s: norm(c).split(/\W+/).filter(w => words.has(w)).length }))
    .sort((a, b) => b.s - a.s);
  // nothing in common with anything: the three questions most people come here to ask,
  // rather than three that merely sort first
  if (!scored.length || scored[0].s === 0)
    return ['how unequal is the UK?', 'which country is most unequal?', 'what does the bottom half own in the US?'].slice(0, n);
  return scored.filter(x => x.s > 0).slice(0, n).map(x => x.c);
}
function offerNearest(q, lead) {
  const near = nearestQuestions(q, 3);
  showNotice(esc(lead) + ' The nearest things it can answer: ' +
    near.map(c => `<button type="button" class="opt-near" data-q="${esc(c)}">${esc(c)}</button>`).join(', ') + '.');
  wireNear();
}
function wireNear() {
  document.querySelectorAll('#notice .opt-view').forEach(b =>
    b.addEventListener('click', () => { setView(b.dataset.view); const t = document.getElementById('tabs'); if (t) t.hidden = false;
      window.scrollTo({ top: 0, behavior: 'auto' }); }));
  document.querySelectorAll('#notice .opt-near').forEach(b =>
    b.addEventListener('click', () => { const el = document.getElementById('q'); if (el) el.value = b.dataset.q;
      if (runPrompt(b.dataset.q)) sendCell(); }));
}
// what the words mean, for someone who has heard them on a podcast and wants to know
// what they are looking at before they look at it
const GLOSSARY = [
  // the bare word on its own is a question about the word, not about what wealth is made of
  [/^(what is|what s|whats|define|explain|meaning of) (the )?(wealth|net worth)$/, 'Wealth is what a household owns at one moment, less what it owes: the house, savings, shares, a pension pot and a business, minus the mortgage, loans and cards. It can be below zero. Income is different: what comes in over a year.',
    ['what does the top 1% own?', 'what is the wealth of the richest made of?']],
  [/^(what is|what s|whats|define|explain|meaning of) (an |the )?income$/, 'Income is what comes in over a year: pay, pensions, benefits, rent, interest and dividends. The atlas mostly measures it for a whole country, split into shares of the total, and as the median, the person in the exact middle.',
    ['what does the average person earn?', 'how unequal is income in the UK?']],
  [/\bgini\b/, 'The Gini coefficient is one number for how evenly something is shared. At 0 everyone has the same; at 1 one person has all of it. Income Ginis in rich countries mostly sit between 0.25 and 0.40; wealth Ginis run much higher, often above 0.70, because wealth piles up in a way pay does not.',
    ['which country is most unequal?', 'how unequal is the UK?']],
  [/\btop 1\s*%|\btop one per ?cent\b|\btop 1 share\b/, 'The top 1% share is the part of everything, either all the wealth or all the income, that goes to the richest one person in a hundred. If they held only their headcount it would be 1%; in most countries here they hold between 15% and 35% of the wealth.',
    ['what does the top 1% own?', 'which country is most unequal?']],
  [/\bmedian\b/, 'The median is the person in the exact middle: half have more, half have less. It is used instead of the average because a few very rich people drag the average up without anyone in the middle being better off.',
    ['what does the average person earn?', 'did the growth reach the typical person?']],
  [/\bwealth\b.*\bincome\b|\bincome\b.*\bwealth\b/, 'Income is what comes in over a year: pay, pensions, rent, dividends. Wealth is what you own at a moment, minus what you owe: a house, savings, shares, a pension pot, less the mortgage and the card. Wealth is far more unevenly held than income, and it is what gets passed down.',
    ['do wealth and income diverge?', 'owning against earning']],
  [/\blorenz\b/, 'A Lorenz curve lines everyone up from poorest to richest and draws how much of the total the first 10%, 20%, 30% hold. Perfect equality is the straight diagonal; the further the curve sags below it, the less even the share.',
    ['Lorenz curve for the UK', 'how is wealth divided up in the US?']],
];
// things people ask about that the atlas does not hold, said plainly, with the nearest
// thing that it does
const NOT_HELD = [
  // every house price series is an index against the country's own 2015, so nothing in
  // the atlas can say where a house costs most; what it can say is where they have moved
  [/\b(most|least) (expensive|affordable|unaffordable)\b.*\b(hous\w*|homes?|property|rent\w*)\b|\b(dearest|cheapest)\b.*\b(hous\w*|homes?|property)\b|\bwhere (are|is)\b.*\b(hous\w*|homes?)\b.*\b(expensive|cheap|dear)\w*\b/,
    'The atlas holds house prices as an index, each country measured against its own 2015, so it cannot say where a house costs most. What it can say is where houses have risen furthest against income since then, and how far they have pulled away from pay in any one country.',
    ['price to income ratio', 'have houses pulled away from pay in the UK?']],
  [/\bbillionaires?\b|\bmillionaires?\b|\bforbes\b|\brich list\b|\belon\b|\bmusk\b|\bbezos\b/,
    'The atlas has no count of billionaires or rich lists. The closest thing it holds is how much of all the wealth the top 1% own, country by country.',
    ['what does the top 1% own?', 'which country is most unequal?']],
  [/\bwealth tax\b|\btax(es)? (the rich|rates?|polic\w*|on wealth)\b|\btaxing\b|\btaxation\b|\bpolicy\b|\bpolicies\b|\bredistribut\w*\b/,
    'The atlas describes how things are shared; it does not model taxes or what a policy would do. What it can show is how concentrated wealth is, and where it has moved.',
    ['what does the top 1% own?', 'has inequality gone up since 2008?']],
  [/\brigged\b|\bunfair system\b|\bconspiracy\b/,
    'Whether anything is rigged is a judgement the atlas cannot make. What it can show is where the money has gone and how fast.',
    ['has inequality gone up since 2008?', 'what does the top 1% own?']],
  [/\bgary stevenson\b|\bgarys? economics\b|\bpodcast\b|\byoutube\b/,
    'The atlas does not follow people or shows. It does cover what those conversations keep coming back to: how much the richest own, what is left for everyone else, and houses against pay.',
    ['what does the top 1% own in the UK?', 'what does the bottom half own in the UK?', 'have houses pulled away from pay?']],
  [/\bminimum wage\b|\bbasic income\b|\bubi\b|\bunions?\b|\bwhat (reduces|causes|would reduce|fixes|drives)\b|\bhow (do we|to|can we|could we) (fix|reduce|solve|end|lower|tackle)\b|\bnordic model\b|\bsolutions?\b|\bcauses? of\b/,
    'The atlas shows how things are shared and how that has moved. It does not test what causes it or what would change it, so it cannot say whether a policy works. What it can show is where inequality is lower and where it has fallen.',
    ['which countries are most equal?', 'is inequality falling anywhere?']],
  [/\binflation\b|\bcost of living\b|\bprices? (of|for) (food|energy|petrol|gas)\b/,
    'The atlas has no price or inflation series. Median pay is held in dollars that buy the same things everywhere, which is the nearest it comes.',
    ['what does the average person earn?', 'what the middle lives on']],
  [/\bmy (county|town|city|state|area|neighbou?rhood|zip)\b/,
    'Name it and the atlas will read it: a US state, a county with its state, or a city. Outside the United States it goes down to countries, not towns.',
    ['Detroit', 'Wayne County, Michigan', 'social mobility in Ohio']],
  [/\bengland\b|\bscotland\b|\bwales\b|\bnorthern ireland\b/,
    'The figures here are for the United Kingdom as a whole. None of the sources split England, Scotland, Wales and Northern Ireland.',
    ['how unequal is the UK?', 'what does the bottom half own in the UK?']],
];
// questions whose only answer in the atlas is the United States layer: said before it is shown
const TO_OPP = [
  [/\bwhere should (i|we) (move|live|raise)\b|\bbest places? to (grow up|raise|live)\b|\bsocial mobility\b|\bupward mobility\b|\bmobility\b|\bpoor kids\b|\bpoor children\b|\bgrow(ing)? up poor\b|\bborn poor\b|\bget out of poverty\b|\bclimb the ladder\b|\bcan (the )?poor\b.*\b(get rich|make it|climb)\b/,
    'if you grow up poor here, what do you earn later?'],
  [/\blife expectancy gap\b|\bgap in life expectancy\b|\blongevity gap\b|\bhow much longer\b.*\blive\b|\b(rich|poor|richer|poorer|richest|poorest|wealthy) (people|folk|families)?\s*(live|die)\b|\brich (vs|versus|and) poor\b.*\b(life|live|die|death)\w*\b|\b(life expectancy|live|die)\w*\b.*\brich (vs|versus|and) poor\b|\bpoor (people )?die younger\b|\bdo (the )?(poor|rich)\b.*\b(die|live)\b/,
    'how much longer do the rich live here?', 'health'],
  // health on its own, or health against rich and poor, is the gap the health face shows
  [/^health$|^health (inequality|inequalities|gap|gaps)$|\bhealth (inequality|gap)\b|\bhealth\b.*\b(rich|poor)\b|\b(rich|poor)\b.*\bhealth\b/,
    'how much longer do the rich live here?', 'health'],
];
// what the skeptic and the data person type. 16 of 33 of the skeptic's questions went
// unread in the usability runs, and most of the data person's
const METHOD = [
  [/\bpre[- ]?tax\b|\bpost[- ]?tax\b|\bbefore tax\b|\bafter tax\b|\btaxes? (counted|included)\b/,
    'It depends on the measure, and each chart says which. The top 1%, top 10%, middle 40% and bottom half income shares are WID pretax national income: before tax and before benefits. The income Gini, median income and poverty come from World Bank household surveys, after tax and benefits (or spending, where that is what a country surveys). Wealth is net worth, what is owned less what is owed, which has no before or after tax.',
    [['open the data page', 'db']]],
  [/\bsources?\b|\bwhere (does|do|is) (the |this |your )?data\b|\bdata come from\b|\bmethod\w*\b|\bwho (made|makes|built)\b|\bwid\b|\bworld inequality database\b|\bcitation\b|\bcite\b/,
    'Wealth and income shares come from WID, the World Inequality Database, per adult with a couple\'s holdings split equally. The income Gini, median income and poverty come from World Bank household surveys. Households below zero and households with nothing spare come from the ECB\'s household survey; the US layer from Opportunity Insights and the Federal Reserve. Every chart names its source under it.',
    [['open the data page', 'db'], ['why the atlas exists', 'why']]],
  [/\breliab\w*\b|\baccura\w*\b|\btrust\w*\b|\bhow (good|solid|sure)\b|\bmodell?ed\b|\bestimated?\b|\bwithout (a )?surveys?\b/,
    'Some of it is measured and some estimated. In most richer countries the wealth figures rest on tax records and surveys; for many poorer countries WID fills the gaps from regional patterns. That is why rankings here default to the richer third of countries, close to the set with tax records behind the figure, and every answer says which set it ranked.',
    [['open the data page', 'db']]],
  [/\bdownload\w*\b|\bcsv\b|\bparquet\b|\bspreadsheet\b|\bexcel\b|\bexport\b|\bapi\b|\braw data\b|\bthe data\b|\bdatabase\b|\bdataset\b/,
    'The full table, and the release files as CSV and Parquet, are on the data page.',
    [['open the data page', 'db']]],
];
// the vague questions left over in the second usability run, each turned into the
// nearest question the atlas answers. the answer says what it was read as
const REWRITES = [
  [/^(which|what) (country|place) is (the )?(fairest|most fair)\b|^(the )?fairest countr(y|ies)\b/, 'which country is most equal'],
  [/^(which|what) (country|place) is (the )?(least fair|unfairest|most unfair)\b/, 'which country is most unequal'],
  [/^how bad (is|are) (it|things|inequality|the gap)\b/, 'which country is most unequal'],
  [/^debts?$|^(who|how many) (is|are|people) in debt$/, 'how many people own less than nothing'],
  [/^(money|cash|pay|salary|salaries)$/, 'what does the average person earn'],
];
const ABOUT = /^(what is this|what s this|whats this|what is (this|the) (site|page|thing|atlas)|what does (this|it) do|how does (this|it) work|help|about|what can (this|it) do)$/;
let noteNext = null;   // one line said with the next answer, about how the question was read
function previewQuestion(typed) {
  hideNotice();   // the last question's complaint is not about this one
  const faceBefore = curFacet;
  // the words are read after the slips are taken out; the box keeps what was typed
  const fix = spellFix(typed);
  let q = fix.text;
  noteNext = readAsNote(fix.changes) || null;
  if (ABOUT.test(norm(q))) {
    showNotice('The atlas answers questions about how wealth, income and opportunity are shared: country by country, over time, ' +
      'and county by county in the United States. Ask in your own words, roll the die for a question, or start with one of these: ' +
      ['how unequal is the UK?', 'what does the bottom half own in the US?', 'which country is most unequal?']
        .map(c => `<button type="button" class="opt-near" data-q="${esc(c)}">${esc(c)}</button>`).join(', ') + '.');
    wireNear();
    return false;
  }
  for (const [re, to] of REWRITES) if (re.test(norm(q))) {
    q = to;
    noteNext = (noteNext ? noteNext + ' ' : '') + `<em class="readas">Read as: ${esc(to)}.</em>`;
    break;
  }
  const nq = norm(q);
  const defining = /^(what is|what s|whats|what are|what does .* mean|define|explain|meaning of)\b/.test(nq);
  if (defining) for (const [re, text, next] of GLOSSARY) if (re.test(nq)) {
    showNotice(esc(text) + ' Try: ' + next.map(c => `<button type="button" class="opt-near" data-q="${esc(c)}">${esc(c)}</button>`).join(', ') + '.');
    wireNear();
    return false;
  }
  const quoted = `<strong class="asked">\u201c${esc(typed.trim().slice(0, 80))}\u201d</strong><br>`;
  for (const [re, text, go] of METHOD) if (re.test(nq)) {
    showNotice(quoted + esc(text) + ' ' + go.map(([lab, view]) => `<button type="button" class="opt-view" data-view="${view}">${esc(lab)} \u203a</button>`).join(' '));
    wireNear();
    return false;
  }
  // a US state, county or city
  const usp = US_CZ ? usPlaceFind(q) : null;
  if (usp) {
    // a place asked about in terms of living and dying opens on health
    if (/\b(life|lives|live|living|lifespan|longevity|die|dies|dying|death|health\w*)\b/.test(nq)) { if (curFacet !== 'health') chooseFacet('health'); }
    else if (!onUs()) chooseFacet('opportunity');
    resetCell(); cell.raw = q; cell.asked = typed; updateCell();
    return true;
  }
  for (const [re, text, next] of NOT_HELD) if (re.test(nq)) {
    showNotice(quoted + esc(text) + ' Try: ' + next.map(c => `<button type="button" class="opt-near" data-q="${esc(c)}">${esc(c)}</button>`).join(', ') + '.');
    wireNear();
    return false;
  }
  // a question in the US layer's own words that its reader can answer as asked goes
  // there as typed. TO_OPP below swaps the words for one canonical question, which is
  // right for "social mobility" and wrong for "mobility and house value", where the
  // second half is the question and was being thrown away for a ranking
  if (US_CZ && /\b(count(y|ies)|commuting zones?|parents?|credit|delinquen\w*|who you know|better[- ]off|friends?|social capital|mobility|climb\w*|grow(ing)? up|poor kids|life gap|house values?)\b/.test(nq) &&
      !(findCountries(q).isos || []).some(i => i !== 'USA')) {
    let here = null;
    try { here = oppAnswer(q, true); } catch (err) { here = null; }
    const kind = here && here.opp && here.opp.kind;
    if (['gap', 'pair', 'faces', 'conn', 'mix', 'life'].includes(kind)) {
      const face = kind === 'life' ? 'health' : 'opportunity';
      const moved = !onUs();
      if (curFacet !== face && !(kind === 'life' && onUs())) chooseFacet(face);
      resetCell(); cell.raw = q; cell.asked = typed; updateCell();
      if (moved) noteNext = (noteNext || '') + '<em class="readas">Only the US publishes this, so this is the US.</em>';
      return true;
    }
  }
  // an opportunity question typed from another face: "does knowing better-off people
  // help you climb" went to a ranking of wealth risers, because "climb" reads as rising.
  // the words are held against the layer's own questions first
  if (US_CZ && !onUs()) {
    const content = s => norm(s).split(' ').filter(w => w.length > 3 && !STOP.has(w));
    const typedW = new Set(content(q));
    for (const g of QUESTIONS) if (US_FACES.includes(g.facet)) for (const oq of g.qs) {
      const want = content(oq);
      const got = want.filter(w => typedW.has(w)).length;
      if (want.length >= 2 && got / want.length >= 0.7) {
        chooseFacet(g.facet);
        resetCell(); cell.raw = oq; cell.asked = typed; updateCell();
        noteNext = (noteNext || '') + '<em class="readas">Only the US publishes this, so this is the US.</em>';
        return true;
      }
    }
  }
  if (US_CZ) for (const [re, asks, toFace] of TO_OPP) if (re.test(nq)) {
    const face = toFace || 'opportunity';
    if (curFacet !== face) chooseFacet(face);
    resetCell(); cell.raw = asks; cell.asked = typed; updateCell();
    noteNext = (noteNext || '') + '<em class="readas">Only the US publishes this, so this is the US, read as: ' + esc(asks) + '.</em>';
    return true;
  }
  if (onUs()) {
    // the US layer reads its own questions. one it cannot read, that the country faces
    // can, goes back to them rather than being answered with a US county chart
    let here = null, there = { kind: 'unknown' };
    try { here = US_CZ ? oppAnswer(q, true) : null; } catch (err) { here = null; }
    try { there = parse(q); } catch (err) {}
    // a question about countries, or the world, is not about US counties whatever it shares with one
    const namesAbroad = (there.isos || []).some(i => i !== 'USA') || (there.iso && there.iso !== 'USA') ||
      (/\bcountr(y|ies)\b|\bworld\b|\bnations?\b|\bglobal\b/.test(nq) && there.kind !== 'unknown');
    // "housing affordability" asked on the opportunity face was answered with mortgage debt
    // by parents' income, because the US reader knows the word mortgage. the layer keeps a
    // question the country faces can also read only when it uses the layer's own words
    const layerWords = /\b(parents?|children|child|kids?|credit|climb\w*|mobility|county|counties|zones?|neighbou?rhood|friends?|delinquen\w*|arrears|grow(ing)? up|poor kids)\b/.test(nq);
    if ((here && !namesAbroad && (layerWords || there.kind === 'unknown')) || there.kind === 'unknown' || there.kind === 'pending') {
      resetCell(); cell.raw = q; cell.asked = typed; updateCell(); return true;
    }
    const mk = there.metric || there.x || (there.metrics && there.metrics[0]);
    const face = (mk && META[mk] && META[mk].topic === 'income') ? 'income' : 'wealth';
    const curFacetWas = curFacet;
    chooseFacet(face);
    noteNext = (noteNext || '') + `<em class="readas">The ${curFacetWas} face is US only, so this is on the ${face} face.</em>`;
  }
  let p;
  try { p = parse(q); } catch (e) { p = { kind: 'unknown' }; }
  // "is it getting worse", "what about here": the country from the last answer, if the
  // question points back at it and names no other
  // only a question that would otherwise need a country: in "where is it worst" the it
  // points at nothing, and the question is about everywhere
  const wantsPlace = p.needsPlace || (VIEW_DEF[p.kind] && VIEW_DEF[p.kind].needsPlace) || p.kind === 'time' || p.kind === 'divergence' ||
    (p.kind === 'delta_rank' && !/\bwhere\b|\bwhich\b|\bcountries\b|\bcountry\b|\bwho\b/.test(nq));
  // and only when the last answer was about one country: after a ranking, "this
  // country" is not whichever came top of it
  let qRead = q;   // the words the answer is built from, with any country pointed back to
  const lastWasOnePlace = chain.length > 0 && SINGLE_PLACE.includes(chain[chain.length - 1].kind);
  if (wantsPlace && lastWasOnePlace && ctx.lastIso && BY_ISO[ctx.lastIso] &&
      /\b(here|there|it|its|same|this country|that country)\b/.test(nq) &&
      !findCountries(q).isos.length) {   // the words name none (the parser may have borrowed one)
    try { const q2 = q + ' ' + BY_ISO[ctx.lastIso].name; const p2 = parse(q2); if (p2.kind !== 'unknown') { p = p2; qRead = q2; } } catch (e) {}
  }
  if (p.kind === 'divergence' && !findCountries(q).isos.length && !(lastWasOnePlace && /\b(here|there|it|its|same|this country|that country)\b/.test(nq)))
    noteNext = (noteNext ? noteNext + ' ' : '') + '<em class="readas">No country named, so this is the US, which has the longest record.</em>';
  if (p.kind === 'among') {
    // the answer on screen, over the new set. it used to re-run the last question from
    // its internal label ("the ranking"), which does not parse, and said it could not read it
    setScope(p.pool ? 'pool:' + poolKey(p.pool) : null);
    if (!chain.length || onUs()) { resetCell(); cell.form = 'rank'; cell.scope = p.pool ? 'pool:' + poolKey(p.pool) : null; }
    cell.asked = typed; cell.raw = null; updateCell();
    return true;
  }
  if (p.kind === 'unknown' || p.kind === 'pending') {
    offerNearest(q, `Could not read "${typed.trim().slice(0, 80)}".`);
    return false;
  }
  resetCell();
  // a typed question is a new question. the region, the richer-countries filter and the
  // country from the last one used to stay on, so "south africa" left every later answer
  // stuck in Africa. they carry over only when the question points back ("here", "it")
  const pointsBack = /\b(here|there|it|its|same|this country|that country|them|they)\b/.test(norm(q));
  const carried = pointsBack && lastWasOnePlace ? (ctx.lastIso || null) : null;
  setScope(null);
  ctx.lastIso = null;
  const mk = p.metric || p.x || (p.metrics && p.metrics[0]);
  if (mk && !RAW_KINDS.includes(p.kind)) adoptMetric(mk);
  const iso = p.iso || (p.isos && p.isos.length === 1 ? p.isos[0] : null);
  if (iso) cell.place = iso;
  else if (p.isos && p.isos.length > 1) cell.places = p.isos.slice(0, MAX_PLACES);
  if (!cell.places.length && carried) { cell.place = carried; ctx.lastIso = carried; }
  // several readings come back from the parser without the region the words named
  // ("wealth inequality in europe" ranked the richer third); the words are checked here
  const regionNamed = p.region || regionIn(q);
  if (regionNamed) setScope('r:' + regionNamed);
  if (p.pool) setScope('pool:' + poolKey(p.pool));
  if (p.kind === 'time') { cell.span = 'run'; cell.since = p.year || null; cell.until = p.until || null; }
  else if (p.kind === 'point') { cell.span = 'moment'; cell.year = p.year || null; }
  else if (p.kind === 'correlate') cell.against = p.y || null;
  else if (p.kind === 'tiers') { cell.form = 'tiers'; cell.against = p.aspect || null; }
  else if (p.kind === 'break') { cell.form = 'break';
    cell.against = (p.metrics || []).find(m => META[m] && !isIneq(m)) || null; }
  // which end a ranking starts from is part of the question: "most equal" was answered
  // with the most unequal, because the cell kept the ranking and dropped its direction
  else if (p.kind === 'rank') cell.form = p.dir === 'low' ? 'least' : 'rank';
  // a question about risers is a ranking of change, so it carries its years across:
  // dropping them turned "is inequality rising" into "who is highest", which is a
  // different question with a confident answer
  else if (p.kind === 'delta_rank') { cell.form = p.dir === 'down' ? 'least' : 'rank'; cell.span = 'run'; cell.since = p.year || null; }
  else if (p.kind === 'reach') cell.view = 'reach';
  else if (p.kind === 'houses') cell.view = 'houses';
  else if (p.kind === 'ratio') cell.view = 'ratio';
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
    cell.view = 'made'; cell.place = 'USA';          // the only country it can be drawn for
    if (p.year) { cell.span = 'moment'; cell.year = p.year; }
  }
  else if (['owns', 'wmultiple', 'multiple', 'basket', 'three'].includes(p.kind)) {
    cell.view = p.kind;
    // a window named in the question shows in the fold, so it can be widened by hand
    if (VIEW_DEF[p.kind].window && (p.since || p.until)) {
      cell.span = 'run'; cell.since = p.since || null; cell.until = p.until || null;
    }
  }
  else if (p.kind === 'triple') cell.view = 'triple';
  else if (p.kind === 'tables') cell.view = 'tables';
  else if (p.kind === 'turn') { cell.view = 'turn'; if (p.iso) cell.place = p.iso; }
  else if (p.kind === 'peers') { cell.view = 'peers'; if (p.iso) cell.place = p.iso;
    if (p.year) { cell.span = 'run'; cell.since = p.year; cell.until = p.until || null; } }
  else if (p.kind === 'spread') cell.form = 'spread';
  else if (p.kind === 'lorenz') { cell.form = 'lorenz'; if (p.isos && p.isos[0]) cell.place = p.isos[0]; }
  // a reading that belongs to one face turns the cube to it: what the bottom half owns
  // was being shown with the income face up, which says the wrong thing about the figure
  const wantFace = (cell.view && VIEW_FACE[cell.view]) || (cell.form === 'lorenz' ? 'wealth' : null);
  if (wantFace && wantFace !== curFacet) {
    const vf = wantFace;
    paintFacet(vf); faceToFront(vf); settle(); updateChips();
  }
  if (cell.against === facetIneqDefault()) cell.against = null;   // nothing is held against itself
  // a ranking by a measure the face does not carry (the poorest country, the happiest)
  // is read from the words: the cell would put the face's own measure in its place
  const faceHas = m => Object.values(FACET_MEASURES).some(l => l.some(x => x[0] === m));
  // the same for a country asked about a measure no face carries: "life expectancy in japan"
  // answered with Japan's top 1% wealth share, because the cell put the face's measure in
  const namedPlace = p.iso || (p.isos && p.isos.length);
  if (RAW_KINDS.includes(p.kind) || (p.kind === 'rank' && p.metric && !faceHas(p.metric)) ||
      (p.metric && META[p.metric] && !faceHas(p.metric) && namedPlace && ['metric', 'profile', 'point', 'time'].includes(p.kind))) cell.raw = qRead;
  cell.asked = typed;
  updateCell();
  // a question turned the cube a quarter of the time in the usability runs, and nothing
  // said so; the cube is the biggest thing on the page
  if (curFacet !== faceBefore && faceBefore !== 'opportunity' && !rolling && FACETS[curFacet])
    noteNext = (noteNext ? noteNext + ' ' : '') + `<em class="readas">Moved to the ${curFacet} face.</em>`;
  return true;
}
// only now is anything computed
function cellNeedsPlace() {
  if (onUs() || cell.place) return false;
  // a reading that ranks or spreads across countries wants no place at all
  const acrossCountries = ['rank', 'least', 'spread', 'tiers', 'break'].includes(cell.form);
  if (cell.view && !VIEW_DEF[cell.view].needsPlace) return false;
  if ((cell.view && VIEW_DEF[cell.view].needsPlace) || cell.form === 'lorenz') return true;
  if (acrossCountries) return false;
  if (cell.span === 'run' && !ctx.region && !ctx.pool) return true;
  // a question was typed, it named a measure, and nothing else: it is about somewhere
  if (cell.asked && !cell.raw && !cell.form && !cell.view && !cell.against && !cell.span) return true;
  return false;
}
// a country chosen for a question that named none is said in the answer. without it
// "what does the top 1% own" came back as Austria and nothing on screen said why
function notePicked(iso) {
  if (!cell.asked || rolling) return;
  const nm = BY_ISO[iso] ? theName(iso) : iso;
  noteNext = (noteNext ? noteNext + ' ' : '') + `<em class="readas">No country named, so this is ${esc(nm)}.</em>`;
}
// A typed question that names no country is about all of them. The usability runs
// answered 18% of typed questions with one country picked at random, which is honest
// when the page says so and still not an answer to "who owns everything". These are
// read across countries instead: the reading's own measure, ranked. The die keeps its
// random countries; that is what the die is for.
const VIEW_ACROSS = { owns: 'wealth_bottom50', multiple: 'income_top1', basket: 'median_income', three: 'income_middle40' };
function typedNoPlace() {
  return !!cell.asked && !cell.place && !cell.raw && !rolling;
}
function acrossNote(region) {
  noteNext = (noteNext ? noteNext + ' ' : '') + `<em class="readas">No country named, so this ranks ${region ? 'the countries in ' + esc(region) : 'them all'}.</em>`;
}
function sendCell() {
  if (!DATA_READY) { showNotice('The figures are still loading. Ask again in a moment.'); return; }
  if (typedNoPlace() && cell.view && VIEW_ACROSS[cell.view]) {
    adoptMetric(VIEW_ACROSS[cell.view]);
    cell.view = null; cell.form = 'rank';
    if (cell.span === 'run' && !cell.since && !cell.until) cell.span = null;
    updateCell();
    acrossNote(ctx.region ? REGION_LABEL[ctx.region] : null);
  }
  // A reading drawn for one country, asked without one, gets one chosen before anything
  // else looks at the cell. It used to fall through to the refusal below, which meant
  // typing a question and pressing enter produced a line of grey text and no answer.
  if (!cell.place && cell.view && VIEW_DEF[cell.view] && VIEW_DEF[cell.view].needsPlace) {
    const picked = pickPlaceFor(cell.view);
    if (picked) { cell.place = picked; notePlace(picked); updateCell(); notePicked(picked); }
  }
  // the drawer greys these out already, so reaching one here means it was set by a typed
  // question rather than by a click. same rules either way.
  const stop = whyNot('form', cell.view || cell.form || '') ||
    (cell.against ? whyNot('against', cell.against) : null);
  if (stop) {
    showNotice(stop);
    revealAnswer('#notice');
    if (/name a place|which country/i.test(stop)) {
      const rib = document.getElementById('rib-place');
      if (rib && !rib.classList.contains('expanded')) toggleRib('place');
    }
    return;
  }
  // a ranking over a run of years is the biggest movers across countries, which is a
  // reading that wants no place at all: only a plain line needs somewhere to follow
  if (cell.span === 'run' && !cell.place && !ctx.region && !ctx.pool && !cell.view
      && !['rank', 'least', 'spread', 'tiers', 'break'].includes(cell.form) && typedNoPlace()) {
    cell.form = 'rank'; updateCell(); acrossNote(null);
  }
  if (cell.span === 'run' && !cell.place && !ctx.region && !ctx.pool && !cell.view
      && !['rank', 'least', 'spread', 'tiers', 'break'].includes(cell.form)) {
    showNotice('Over the years needs somewhere to follow. Add a place, or a region.');
    const rib = document.getElementById('rib-place');
    if (rib && !rib.classList.contains('expanded')) toggleRib('place');
    return;
  }
  if (cell.raw) { const q = cell.raw; ask(q); return; }
  // a measure on its own, typed, with no country: every country ranked on it, or the
  // countries of the region the question named
  if (cellNeedsPlace() && typedNoPlace() && !cell.view && cell.form !== 'lorenz') {
    cell.form = 'rank'; updateCell();
    acrossNote(ctx.region ? REGION_LABEL[ctx.region] : null);
  }
  if (cellNeedsPlace()) {
    // the old behaviour here was a silent world ranking. this says what it read and asks
    // choose one rather than stopping. the pill says which, and the fold is open.
    const picked = pickPlaceFor(cell.view || cell.form || '');
    if (picked) {
      cell.place = picked;
      notePlace(picked);
      updateCell();
      notePicked(picked);
    } else {
      const m = META[facetIneqDefault()];
      showNotice(`Read that as a question about ${m ? esc(m.label) : 'this measure'}. Which country? ` +
        `Pick one from the place fold, or ask for "the most concentrated" to read it across all of them.`);
      const rib = document.getElementById('rib-place');
      if (rib && !rib.classList.contains('expanded')) toggleRib('place');
      return;
    }
  }
  hideNotice();
  runCell();
  // a reading that refused has already said why; do not paper over it with a shrug
  if (chain.length) { setStage('result'); revealAnswer(); }
  else if (document.getElementById('notice').hidden) showNotice('Nothing to show for that yet.');
  else revealAnswer('#notice');
}
function syncDeck() {
  const deck = document.getElementById('deck'), view = document.getElementById('view-ask');
  const bar = document.getElementById('minibar');
  if (!deck || !view || !bar) return;
  // the minibar shows once the ask box has gone off the top, which is when there is no
  // longer a way to ask without scrolling back. it sits outside the view because the
  // cube's 3D perspective makes any fixed child inside it scroll with it
  const form = document.getElementById('ask-form');
  const on = view.classList.contains('engaged') && !view.hidden && !!form && form.getBoundingClientRect().bottom < 0;
  if (on) {
    const vals = [...document.querySelectorAll('#ribs .rib.filled:not(.facet) .val')]
      .map(v => v.textContent.trim()).filter(Boolean);
    document.getElementById('mb-text').textContent = [curFacet].concat(vals).join(' \u00b7 ');
  }
  if (bar.classList.contains('on') !== on) {
    bar.classList.toggle('on', on);
    bar.inert = !on; bar.setAttribute('aria-hidden', String(!on));
  }
  document.documentElement.style.setProperty('--deckh', on ? bar.offsetHeight + 'px' : '0px');
}
// back up to the deck: the summary to the folds, the button to the box itself
function initMinibar() {
  const up = focus => {
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (focus) setTimeout(() => { const q = document.getElementById('q'); if (q) { q.focus({ preventScroll: true }); q.select(); } }, 350);
  };
  const s = document.getElementById('mb-sum'), a = document.getElementById('mb-ask');
  if (s) s.addEventListener('click', () => up(false));
  if (a) a.addEventListener('click', () => up(true));
}
function initCube() {
  const scene = document.getElementById('scene');
  if (!scene) return;
  scene.addEventListener('pointerdown', e => {
    e.preventDefault();   // don't start a text selection on the copy behind the cube
    motion = 'drag'; if (motRAF) { cancelAnimationFrame(motRAF); motRAF = null; } clearTimeout(settleT);
    cDragging = true; cMoved = 0; clx = e.clientX; cly = e.clientY;
    cubeEl().classList.add('drag'); scene.setPointerCapture(e.pointerId);
  });
  scene.addEventListener('pointermove', e => {
    if (!cDragging) return;
    const dx = e.clientX - clx, dy = e.clientY - cly; clx = e.clientX; cly = e.clientY;
    cMoved += Math.abs(dx) + Math.abs(dy);
    cRotY += dx * 0.6; cRotX -= dy * 0.6;   // free tumble, no axis is clamped
    cubeApply();
  });
  const end = () => { if (!cDragging) return; cDragging = false; cubeEl().classList.remove('drag'); cubeSnap(); };
  scene.addEventListener('pointerup', end);
  scene.addEventListener('pointercancel', end);
  document.querySelectorAll('.fchip').forEach(el =>
    el.addEventListener('click', () => {
      const name = el.dataset.facet;
      // over a reading that brings its own measures, tapping a face changed only the cube
      // and read as broken. it drops the reading for that face's own, for the same place
      if (chain.length && cell.view && VIEW_DEF[cell.view] && (VIEW_DEF[cell.view].ignores || []).includes('facet') &&
          name !== curFacet && FACETS[name] && !FACETS[name].soon && name !== 'opportunity') {
        cell.view = null; cell.form = null; cell.span = null;
        if (stage === 'result') { paintFacet(name); faceToFront(name); settle(); updateChips(); runCell(); return; }
      }
      chooseFacet(name);
    }));
  scene.setAttribute('tabindex', '0');
  scene.setAttribute('role', 'group');
  scene.setAttribute('aria-label', 'The inequality cube. Arrow keys turn it to another face.');
  scene.addEventListener('keydown', e => {
    const step = { ArrowLeft: [0, -90], ArrowRight: [0, 90], ArrowUp: [90, 0], ArrowDown: [-90, 0] }[e.key];
    if (!step) return;
    e.preventDefault();
    motion = 'still';
    if (motRAF) { cancelAnimationFrame(motRAF); motRAF = null; }
    clearTimeout(settleT);
    cRotX += step[0]; cRotY += step[1];
    cubeApply(); cubeSnap();
  });
  paintFacet('wealth'); cubeApply(); startIdle();
  window.addEventListener('scroll', syncDeck, { passive: true });
  initMinibar();
  window.addEventListener('resize', syncDeck);
  // idle on the home page: the cube wanders the four faces so they all get seen
  setInterval(() => {
    const qb = document.getElementById('q');
    if (stage !== 'compose' || cDragging || (qb && qb.value)) return;
    const others = Object.keys(FACETS).filter(f => f !== curFacet && !FACETS[f].soon);
    chooseFacet(randomOf(others));
  }, 7000);
}
