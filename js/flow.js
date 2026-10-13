'use strict';
// what an answer shows first, and where to go from it.
// one of eight files loaded in order by index.html; they share one scope, so a
// function here can be used by any of them once the page has loaded

/* ── reading load ──────────────────────────────────────────────────────
   Answers ran to a median of 54 words and one in ten past 90, and a quarter carried a
   term nobody had explained. The facts stay on screen; the working (the grey part the
   readings already mark in <em>) folds away under "more", one tap to open. The terms
   become buttons that say what they mean, and a correlation says in words how strong
   it is instead of leaving "r = 0.72" to do it. */
const TERMS = {
  gini: [/\bGini\b/, 'The Gini runs from 0, where everyone has the same, to 1, where one person has everything. Income Ginis in rich countries mostly sit between 0.25 and 0.40; wealth Ginis run much higher.'],
  percentile: [/\bpercentile\b/, 'A percentile ranks everyone from poorest to richest out of 100. Someone at the 37th percentile has more than 36 people in every hundred and less than the other 63.'],
  zone: [/\bcommuting zones?\b/, 'A commuting zone is a local job market: the group of US counties people travel between for work. The US splits into 741 of them.'],
  wid: [/\bWID\b/, 'WID is the World Inequality Database. It builds income and wealth shares from tax records, household surveys and national accounts, the same way for every country.'],
  ppp: [/\bpurchasing power\b/, 'Purchasing power dollars are adjusted so that one buys the same basket of goods in every country. It is what makes pay in Poland and pay in Norway comparable.'],
  transfers: [/\bafter transfers\b/, 'After transfers means after the taxes people pay and the benefits they receive.'],
  r: [/\br = /, 'r measures how closely two things move together across places, from 0 (no link) to 1 (move in lockstep). A negative r means more of one goes with less of the other. It says nothing about which causes which.'],
};
function linkWords(v) {
  const a = Math.abs(v);
  const s = a < 0.1 ? 'no real link' : a < 0.3 ? 'a weak link' : a < 0.5 ? 'a moderate link' : a < 0.7 ? 'a strong link' : 'a very strong link';
  return v < -0.1 ? s + ', running the opposite way' : s;
}
function decorate(html) {
  // put words to every correlation, then turn the first use of each term into a button
  let out = html.replace(/\br = (-|\u2212)?(\d?\.\d+)/g, (m, sg, n) => `${m}, ${linkWords((sg ? -1 : 1) * parseFloat(n))}`);
  for (const [k, [re]] of Object.entries(TERMS)) {
    let done = false;
    out = out.replace(/(<[^>]*>)|([^<]+)/g, (m, tag, text) => {
      if (tag || done) return m;
      return text.replace(new RegExp(re.source, re.flags), w => { if (done) return w; done = true;
        return `<button type="button" class="term" data-term="${k}">${w.trim()}</button>${w.endsWith(' ') ? ' ' : ''}`; });
    });
  }
  return out;
}
// the facts before the first stretch of working, capped at about sixty words; the rest
// under "more". the notes on how the question was read always stay in view
function splitLead(html) {
  const notes = [];
  let body = html.replace(/\s*<em class="readas">[\s\S]*?<\/em>/g, m => { notes.push(m.trim()); return ''; });
  let cut = -1, depth = 0, words = 0, inTag = false;
  const ends = [];
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '<') {
      inTag = true;
      if (body.startsWith('<em', i) && depth === 0 && i > 0) {
        const close = body.indexOf('</em>', i);
        const len = close > 0 ? body.slice(i, close).replace(/<[^>]*>/g, '').trim().split(/\s+/).length : 99;
        if (len >= 8) { cut = i; break; }
      }
      if (/^<(strong|em|span|button)\b/.test(body.slice(i, i + 8))) depth++;
      if (/^<\/(strong|em|span|button)>/.test(body.slice(i, i + 10))) depth--;
      continue;
    }
    if (c === '>') { inTag = false; continue; }
    if (inTag) continue;
    if (/\s/.test(c) && i && !/\s/.test(body[i - 1])) words++;
    if (depth === 0 && '.?!'.includes(c) && /\s/.test(body[i + 1] || '') && /[A-Z<"0-9]/.test((body.slice(i + 1).trimStart()[0]) || '')) ends.push([i + 1, words]);
  }
  let lead = cut >= 0 ? body.slice(0, cut) : body, rest = cut >= 0 ? body.slice(cut) : '';
  if (words > 60 || (cut < 0 && ends.length && ends[ends.length - 1][1] > 60)) {
    const stop = ends.find(([at, w]) => w >= 30 && (cut < 0 || at <= cut));
    if (stop) { lead = body.slice(0, stop[0]); rest = body.slice(stop[0]); }
  }
  // a tail of a few words is not worth a fold
  if (rest.replace(/<[^>]*>/g, '').trim().split(/\s+/).length < 10) { lead = body; rest = ''; }
  return { lead: lead.trim(), rest: rest.trim(), notes: notes.join(' ') };
}
let moreOpen = false;
try { moreOpen = localStorage.getItem('oia-more') === '1'; } catch (err) {}
function render() {
  const session = document.getElementById('session');
  const list = document.getElementById('facts');
  updateChips();
  // once you're working, the cube shrinks so the ask box and cell stay the controls
  const engaged = stage === 'result' && chain.length > 0;
  document.getElementById('view-ask').classList.toggle('engaged', engaged);
  if (!engaged && deckCondensed) {   // back home: the deck stands up again
    deckCondensed = false;
    const dk = document.getElementById('deck'); if (dk) dk.classList.remove('condensed');
  }
  const wantScale = engaged ? (deckCondensed ? 0.36 : 0.55) : 1.08;   // sending lifts the cube out of the way
  requestAnimationFrame(syncDeck);   // the deck's height drives where the graph's head sits
  if (wantScale !== cubeScale) { cubeScale = wantScale; cubeApply(); }
  if (chain.length === 0) {
    // an empty chain is normal while composing: the cell is a draft, nothing is computed yet
    if (stage === 'result') { stage = 'compose'; const v = document.getElementById('view-ask');
      if (v) { v.classList.remove('stage-chain', 'stage-result'); v.classList.add('stage-compose'); } }
    session.hidden = true;
    updateCell();   // back to just the facet, the other slots empty
    const a0 = document.getElementById('answer'); if (a0) a0.innerHTML = '';
    const n0 = document.getElementById('next'); if (n0) { n0.hidden = true; n0.innerHTML = ''; }
    return;
  }
  if (stage !== 'result') { session.hidden = true; updateCell(); return; }
  session.hidden = false;
  // one cell, one answer: the current reading of it
  const last = chain[chain.length - 1];
  if (noteNext) { last.text += ' ' + noteNext; noteNext = null; }
  const ansEl = document.getElementById('answer');
  const parts = splitLead(decorate(last.text));
  ansEl.innerHTML = `<div class="t"><p class="lead">${parts.lead}` +
    `${last.changed ? ' <span class="upd">updated</span>' : ''}</p>` +
    (parts.notes ? `<p class="notes">${parts.notes}</p>` : '') +
    (parts.rest ? `<details class="more"${moreOpen ? ' open' : ''}><summary>more, and how it is worked out</summary>` +
      `<div class="more-body">${parts.rest}</div></details>` : '') +
    `<p class="termdef" id="termdef" hidden></p></div>`;
  const det = ansEl.querySelector('details.more');
  if (det) det.addEventListener('toggle', () => { moreOpen = det.open; try { localStorage.setItem('oia-more', moreOpen ? '1' : '0'); } catch (err) {} });
  ansEl.querySelectorAll('.term').forEach(b => b.addEventListener('click', () => {
    const d = document.getElementById('termdef'); if (!d) return;
    const same = !d.hidden && d.dataset.term === b.dataset.term;
    d.hidden = same; d.dataset.term = b.dataset.term;
    d.textContent = TERMS[b.dataset.term][1];
    ansEl.querySelectorAll('.term').forEach(x => x.setAttribute('aria-expanded', !same && x === b ? 'true' : 'false'));
  }));
  if (list) list.innerHTML = '';
  drawChart();
  buildNext(last);   // and where this answer can be taken next
  updateCell();   // the cube stays on the facet you chose; only the cell coordinates move
  markFixedFolds();
  syncUrl();
}

// each dimension of the atlas is a slot; the cube fills the facet, asking fills the rest
function setSlot(id, value, hint, color) {
  const rib = document.getElementById('rib-' + id); if (!rib) return;
  const v = document.getElementById('v-' + id); if (!v) return;
  if (value) {
    rib.classList.add('filled'); rib.classList.remove('empty'); v.innerHTML = value;
    if (color) rib.style.setProperty('--rc', color); else rib.style.removeProperty('--rc');
  } else { rib.classList.remove('filled'); rib.classList.add('empty'); v.textContent = hint; rib.style.removeProperty('--rc'); }
}
const SINGLE_PLACE = ['profile', 'point', 'compare', 'metric', 'time', 'path', 'lorenz', 'divergence',
  'reach', 'houses', 'multiple', 'basket', 'three', 'owns', 'wmultiple', 'made', 'underwater', 'weather', 'have'];
// the accordion reads the cell, the single source of truth, so it always matches the edits
function updateCell() {
  if (keepOpen) { reopenAfter = keepOpen; } else closeDrawer();
  const last = chain.length ? chain[chain.length - 1] : null;
  if (last && last.kind === 'opp') {   // opportunity has no cell; read its fact
    setSlot('place', (last.opp && last.opp.placeName) || 'US commuting zones', 'a country, or all of them');
    setSlot('time', null, 'a moment, or a run of years');
    const o = last.opp;
    setSlot('against', o.covLabel || o.label || null, 'another measure to hold it to', FACET_HEX[curFacet] || FACET_HEX.opportunity);
    // every slot, not only the three this layer fills. arriving here from another face
    // used to leave that face's reading sitting in the strip: a matrix of US counties
    // under a pill reading "what the wealth is made of".
    setSlot('scope', null, 'all');
    setSlot('form', OPP_SHOWN[o.kind] || 'one reading of the zones', 'as is');
    const vf = document.getElementById('v-facet');
    const reads = curFacet === 'health' && o.kind === 'place' ? 'lifespan, then climbing' : (OPP_READS[o.kind] || '741 US commuting zones');
    if (vf) vf.innerHTML = `${esc(curFacet)}<span class="fmeasure">${esc(reads)}</span>`;
    return;
  }
  const named = cell.places.filter(i => BY_ISO[i]).map(i => esc(BY_ISO[i].name));
  const place = named.length === 0 ? (last ? 'all countries' : null)
    : named.length === 1 ? named[0]
    : named.length === 2 ? named.join(' and ')
    : `${named.length} countries`;
  setSlot('place', place, 'add');
  setSlot('scope', ctx.pool ? esc(ctx.pool.label) : ctx.region ? REGION_LABEL[ctx.region] : null, 'the richer third');
  setSlot('form', cell.view ? VIEW_DEF[cell.view].label : (FORM_DEF[cell.form] || null), 'as is');
  // A view brings its own measures. Leaving the facet pill on "top 1% share" while the
  // chart draws a median told the reader the wrong thing about what they were looking at,
  // so the pill names what the reading actually uses.
  const vf = document.getElementById('v-facet');
  if (vf) {
    const own = cell.view && VIEW_DEF[cell.view] && VIEW_DEF[cell.view].reads;
    const label = own || facetMeasureLabel(curFacet) || (FACETS[curFacet] || {}).sub || '';
    vf.innerHTML = `${esc(curFacet)}<span class="fmeasure">${esc(label)}</span>`;
  }
  // a view supplies its own measures, so the folds it ignores are shown as not in play
  const ign = cell.view ? VIEW_DEF[cell.view].ignores : [];
  ['facet', 'place', 'scope', 'time', 'against'].forEach(d => {
    const rib = document.getElementById('rib-' + (d === 'scope' ? 'scope' : d === 'time' ? 'time' : d));
    if (rib) rib.classList.toggle('unused', ign.includes(d === 'time' ? 'when' : d === 'scope' ? 'among' : d));
  });
  const rf = document.getElementById('rib-facet');
  if (rf) rf.classList.add('filled');   // the face is always set, so its fold is always open
  const spanLabel = cell.span === 'run'
    ? (cell.since && cell.until ? cell.since + ' to ' + cell.until
      : cell.since ? 'since ' + cell.since
      : cell.until ? 'up to ' + cell.until : 'over the years')
    : cell.span === 'moment' ? (cell.year ? 'in ' + cell.year : 'a single moment') : null;
  setSlot('time', spanLabel, 'add');
  const agKey = cell.against && META[cell.against] ? cell.against : null;
  const agHtml = agKey
    ? `${esc(AGAINST_FAMILY[agKey] || 'other')}<span class="fmeasure">${esc(META[agKey].label)}</span>`
    : null;
  setSlot('against', agHtml, 'add', agKey ? metricColor(agKey) : null);   // it carries its own face's colour
  buildAddRow(last);
  requestAnimationFrame(() => drawRibbon());
  if (reopenAfter) {   // reopen outright: toggling would read as "already open" and shut it
    const d = reopenAfter; reopenAfter = null;
    const rib = document.getElementById('rib-' + d), drawer = document.getElementById('rib-drawer');
    if (rib && drawer) {
      renderDrawer(d, rib, drawer, '');
      drawer.hidden = false;
      rib.classList.add('expanded');
      const h = rib.querySelector('.rib-head'); if (h) h.setAttribute('aria-expanded', 'true');
      // typing a year rebuilds the fold under the cursor; put the caret back where it was
      if (lastYearField) {
        const back = drawer.querySelector('#' + lastYearField);
        lastYearField = null;
        if (back) { back.focus(); back.select(); }
      }
    }
  }
}
// only offer the dimensions that aren't in the cell yet; the accordion grows as you add them
function buildAddRow(last) {
  const el = document.getElementById('add-row');
  if (el) el.innerHTML = '';    // nothing to add: every fold is already in the strip, closed
  return;
}

/* ── where to go from here ──────────────────────────────────────────
   An atlas that only answers is a lookup. What makes it explorable is that every
   answer opens onto the next question, and the next question has to come out of the
   answer in front of you rather than off a list. A bottom half that owes more than it
   owns should offer the other countries in that position, by name. A country at the
   top of a ranking should offer itself. Nothing here is a suggestion in the abstract:
   each one is checked against the data before it is drawn, so no step is a dead end. */

// what each reading needs before it can run for a country
const STEP_NEEDS = {
  'what does the poorest half own?': ['wealth_top1', 'wealth_bottom50'],
  'what is that wealth actually made of?': [],
  'how many people own less than nothing?': [],
  'could you take a hit here?': [],
  'what does a family actually have?': [],
  'how many times more does one person at the top own?': ['wealth_top1', 'wealth_bottom50', 'income_top1', 'income_bottom50'],
  'how many times more does one person at the top earn?': ['income_top1', 'income_bottom50'],
  'what happened to the middle here?': ['income_top10', 'income_middle40', 'income_bottom50'],
  'what does the person in the middle live on a day?': ['median_income'],
  'did the growth reach the typical person?': ['gdp_pc', 'median_income'],
  'have houses pulled away from pay?': ['house_price', 'median_income'],
  'are wealth and income pulling apart here?': ['wealth_top1', 'income_top1'],
  'when did this country change most?': [],
  'did it move differently from comparable countries?': [],
};
function stepRuns(step, here) {
  const iso = step.iso || here;
  const need = STEP_NEEDS[step.q];
  if (!need) return true;                       // a reading that works across countries
  // no country in play yet: the place fold will ask for one, which is the ordinary path
  // and not a dead end, so the step stands
  if (!iso) return true;
  if (!BY_ISO[iso]) return false;
  return need.every(k => seriesOf(k, iso).length >= 2);
}
// Would this step answer if pressed? The usability runs had 17 of 98 offered steps
// refuse: "how many people own less than nothing?" under a US answer, "what is that
// wealth made of?" under a French one, "who breaks the pattern?" with nothing to break.
// Each step is read the way pressing it would read it and put to the same rules the
// folds grey out by, against the country it would run on. Only steps that pass are shown.
function stepAnswers(step, here) {
  if (US_FACES.includes(step.face)) {
    try { return !!(US_CZ && oppAnswer(step.q, true)); } catch (err) { return false; }
  }
  let p;
  try { p = parse(spellFix(step.q).text); } catch (err) { return false; }
  if (!p || p.kind === 'unknown' || p.kind === 'pending') return false;
  const iso = step.iso || here;
  const shape = VIEW_DEF[p.kind] ? p.kind
    : ({ rank: 'rank', delta_rank: 'rank', spread: 'spread', lorenz: 'lorenz', tiers: 'tiers', break: 'break' })[p.kind] || '';
  if (!shape) return true;
  const saved = { places: cell.places.slice(), against: cell.against, face: curFacet };
  try {
    if (onUs()) curFacet = VIEW_FACE[shape] || 'wealth';   // where pressing it will turn
    cell.places = iso ? [iso] : [];
    cell.against = p.kind === 'break' ? ((p.metrics || []).find(m => META[m] && !isIneq(m)) || null)
      : p.kind === 'tiers' ? (p.aspect || null) : null;
    if (whyNot('form', shape)) return false;
    // the sharpest years and the peers read the face's own measure, so that is the one
    // that has to have a record here (Hong Kong has wealth but no income series)
    // the sharpest years and the peers depend on other countries too (peers needs enough
    // comparable ones over the same years), so they are built quietly and must answer
    if ((shape === 'turn' || shape === 'peers') && iso) return seriesOf(facetIneqDefault(), iso).length >= 6 && dryRun({ kind: shape, iso });
    return true;
  } catch (err) { return false; }
  finally { cell.places = saved.places; cell.against = saved.against; curFacet = saved.face; }
}
// build a reading without showing it: nothing on screen, nothing in the context, changes
function dryRun(p) {
  const savedCtx = Object.assign({}, ctx), savedNotice = showNotice, seq = factSeq;
  let ok = false;
  try {
    showNotice = () => {};
    ctx.metric = facetIneqDefault();
    ok = !!buildAnswer(p, 'dry run');
  } catch (err) { ok = false; }
  finally { showNotice = savedNotice; Object.assign(ctx, savedCtx); factSeq = seq; }
  return ok;
}

// the steps that follow from one answer, at most three, each already checked
function nextSteps(f) {
  const here = (f.isos && f.isos.length === 1) ? f.isos[0] : (cell.place || null);
  // A ranking answers about whichever country came top, not about one the reader chose.
  // Its next steps will run for that country, so they have to say so: an unlabelled
  // "what does the poorest half own?" under a league table reads as being about you.
  const implied = (here && here !== cell.place) ? theName(here) : null;
  const onScreen = (cell.asked || f.query || '');
  const out = [];
  const add = (q, face, iso, where) => {
    if (q === onScreen && !iso) return;          // never offer what is already on screen
    if (out.some(s => s.q === q && s.iso === (iso || null))) return;
    const step = { q, face: face || null, iso: iso || null,
      where: where || (STEP_NEEDS[q] && STEP_NEEDS[q].length ? implied : null) };
    if (stepRuns(step, here) && stepAnswers(step, here)) out.push(step);
  };
  const m = f.mode, o = f.opp && f.opp.kind;

  if (o) {
    // the opportunity layer runs its own grammar, so its steps are its own questions
    const OPP = {
      conn:     [['are they not here, or here and not mixing?'], ['do the four faces agree inside one country?']],
      mix:      [['does knowing better-off people help you climb?'], ['if you grow up poor here, what do you earn later?']],
      mobility: [['does knowing better-off people help you climb?'], ['how much longer do the rich live here?']],
      life:     [['if you grow up poor here, what do you earn later?'], ['do the four faces agree inside one country?']],
      faces:    [['does the income gap track climbing?'], ['does knowing better-off people help you climb?']],
      pair:     [['do the four faces agree inside one country?'], ['does knowing better-off people help you climb?']],
      place:    [['if you grow up poor here, what do you earn later?'], ['does knowing better-off people help you climb?'],
                 ['how much longer do the rich live here?']],
      gap:      [["who owns a home, by their parents' income?"], ["who falls behind on payments, by their parents' income?"],
                 ["does credit depend on your parents' income?"]],
    };
    for (const [q] of (OPP[o] || [])) add(q, 'opportunity');
    return out;
  }

  if (m === 'have') {
    add('what is that wealth actually made of?', 'wealth');
    add('could you take a hit here?', 'wealth');
    add('what does the poorest half own?', 'wealth');
  }
  else if (m === 'weather') {
    add('what does a family actually have?', 'wealth');
    add('how many people own less than nothing?', 'wealth');
    add('what is that wealth actually made of?', 'wealth');
    add('what does the poorest half own?', 'wealth');
  }
  else if (m === 'underwater') {
    add('could you take a hit here?', 'wealth');
    add('what does the poorest half own?', 'wealth');
    add('what is that wealth actually made of?', 'wealth');
    add('how much more do the richest hold than the poorest?', 'wealth');
  }
  else if (m === 'made') {
    add('what does a family actually have?', 'wealth');
    add('could you take a hit here?', 'wealth');
    add('how many people own less than nothing?', 'wealth');
    add('what does the poorest half own?', 'wealth');
    add('how many times more does one person at the top own?', 'wealth');
    add('have houses pulled away from pay?', 'wealth');
  }
  else if (m === 'owns') {
    const b = f.owns && f.owns.b, last = b && b[b.length - 1];
    // a half that owes points at the others in the same position, which ratio names
    if (last && last.v < 0) {
      // the share has gone negative; the headcount is the question it raises and
      // cannot answer, so it goes first where the survey reaches that country
      if (HFCS_NEG && here && HFCS_NEG.by[here]) add('how many people own less than nothing?', 'wealth');
      add('how much more do the richest hold than the poorest?', 'wealth');
    } else add('how many times more does one person at the top own?', 'wealth');
    if (here === 'USA') add('what is that wealth actually made of?', 'wealth');
    add('what does the person in the middle live on a day?', 'income');
    add('when did this country change most?', 'wealth');
  }
  else if (m === 'wmultiple') {
    if (here === 'USA') add('what is that wealth actually made of?', 'wealth');
    add('what does the poorest half own?', 'wealth');
    add('what happened to the middle here?', 'income');
    add('have houses pulled away from pay?', 'wealth');
  }
  else if (m === 'multiple') {
    add('how many times more does one person at the top own?', 'wealth');   // the twin, and the argument
    add('what happened to the middle here?', 'income');
    add('what does the person in the middle live on a day?', 'income');
  }
  else if (m === 'basket') {
    add('did the growth reach the typical person?', 'income');
    add('how many times more does one person at the top earn?', 'income');
    add('what does the poorest half own?', 'wealth');
  }
  else if (m === 'three') {
    add('how many times more does one person at the top earn?', 'income');
    add('when did this country change most?', 'income');
    add('what does the poorest half own?', 'wealth');
  }
  else if (m === 'ratio') {
    // The countries this reading could not put a number on are the interesting ones, and
    // there are usually several: offer one that has not just been looked at, so following
    // this repeatedly walks along them rather than bouncing between the first two.
    const owing = (f.ratio && f.ratio.owing || []).filter(x => x.geo_id !== here);
    const owe = owing.find(x => !seenLately(null, x.geo_id)) || owing[0];
    if (owe) add('what does the poorest half own?', 'wealth', owe.geo_id, theName(owe.geo_id));
    add('how many times more does one person at the top own?', 'wealth');
    add('does my country own as unevenly as it earns?', 'wealth');
  }
  else if (m === 'reach') {
    const houses = f.reach && f.reach.houses;
    if (houses) add('what does the poorest half own?', 'wealth');
    else add('have houses pulled away from pay?', 'wealth');
    add('what does the person in the middle live on a day?', 'income');
    add('how many times more does one person at the top earn?', 'income');
  }
  else if (m === 'divergence') {
    add('how many times more does one person at the top own?', 'wealth');
    add('what does the poorest half own?', 'wealth');
    add('when did this country change most?', 'wealth');
  }
  else if (m === 'tables') {
    add('how many times more does one person at the top own?', 'wealth');
    add('what does the poorest half own?', 'wealth');
  }
  else if (m === 'bars') {
    // step into whichever country the ranking just put at the top
    const top = f.bar && f.bar.rows && f.bar.rows.length ? f.bar.rows[0].geo_id : null;
    if (top && top !== here) add('what does the poorest half own?', 'wealth', top, theName(top));
    add('does my country own as unevenly as it earns?', 'wealth');
    add('how many times more does one person at the top own?', 'wealth');
  }
  else if (m === 'turn') {
    add('did it move differently from comparable countries?', null);
    add(curFacet === 'income' ? 'how many times more does one person at the top earn?'
      : 'how many times more does one person at the top own?', curFacet === 'income' ? 'income' : 'wealth');
  }
  else if (m === 'scatter' || m === 'path') {
    add('who breaks the pattern?', null);
    add('do the four faces agree inside one country?', 'opportunity');
  }
  else if (m === 'triple') {
    add('do the four faces agree inside one country?', 'opportunity');
    add('how many times more does one person at the top own?', 'wealth');
  }
  else {
    add('how many times more does one person at the top own?', 'wealth');
    add('what does the poorest half own?', 'wealth');
  }
  // Somewhere new, if there is anywhere new. Following the first step repeatedly used to
  // bounce between two readings forever, which is a loop rather than an exploration.
  const fresh = out.filter(s => !seenLately(s.q, s.iso || here));
  return (fresh.length ? fresh : out).slice(0, 3);
}
// the last few answers, so a step can prefer somewhere the reader has not just been
const TRAIL = [];
const TRAIL_KEEP = 5;
function seenLately(q, iso) {
  return TRAIL.some(t => (q == null || t.q === q) && (iso == null || t.iso === iso));
}
function noteVisit(q, iso) {
  if (!q && !iso) return;
  TRAIL.unshift({ q: q || null, iso: iso || null });
  if (TRAIL.length > TRAIL_KEEP) TRAIL.length = TRAIL_KEEP;
}
let lastNoted = null;
function buildNext(f) {
  const el = document.getElementById('next');
  if (!el) return;
  const steps = (() => { try { return nextSteps(f); } catch (e) { return []; } })();
  // note where we are only once per answer: render runs again on a redraw
  if (f.id !== lastNoted) {
    lastNoted = f.id;
    noteVisit(cell.asked || f.query, (f.isos && f.isos.length === 1) ? f.isos[0] : cell.place);
  }
  if (!steps.length) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = '<span class="k">next</span>' + steps.map((s, i) =>
    `<button type="button" class="chip" data-i="${i}">${esc(s.q)}` +
    (s.where ? ` <span class="where">in ${esc(s.where)}</span>` : '') + '</button>').join('');
  el.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
    const s = steps[+btn.dataset.i];
    const keep = s.iso || ((chain.length && chain[chain.length - 1].isos.length === 1)
      ? chain[chain.length - 1].isos[0] : cell.place);
    hideNotice();
    if (s.face && s.face !== curFacet) { chooseFacet(s.face); faceToFront(s.face); settle(); }
    else if (!s.face && onUs()) { chooseFacet('wealth'); faceToFront('wealth'); settle(); }
    if (US_FACES.includes(s.face)) { ask(s.q); revealAnswer(); return; }
    setStage('compose'); resetCell(); chain.length = 0;
    if (!previewQuestion(s.q)) return;
    if (keep) cell.place = keep;
    updateCell();
    sendCell();
  }));
}
