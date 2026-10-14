'use strict';
// chips, notices, the US county tier, the read line, the database table, and loading the data.
// one of eight files loaded in order by index.html; they share one scope, so a
// function here can be used by any of them once the page has loaded

/* ── chips: follow-ups track the conversation ──────────────────────── */
// the guided argument: the divergence, then everyday measures against the two inequalities
const ASPECT_CHIP = { life_exp: 'life expectancy and inequality', life_satisfaction: 'life satisfaction and inequality',
  poverty_rate: 'poverty and inequality', median_income: 'median income and inequality' };
const START_CHIPS = ['wealth vs income in the US', 'life expectancy and inequality', 'life satisfaction and inequality', 'poverty and inequality'];
// starters per facet, so turning the cube changes what the terminal suggests
const FACET_CHIPS = {
  wealth: ['wealth vs income in the US', 'France', 'most concentrated', 'life expectancy and inequality'],
  income: ['most unequal', 'France', 'median income and inequality', 'poverty and inequality'],
  opportunity: ['upward mobility', "credit by parents' income", "mortgages by parents' income", 'mobility and income'],
  health: ['how much longer do the rich live here?', 'life expectancy gap in Detroit', 'does life expectancy track inequality?'],
};

function updateChips() {
  const el = document.getElementById('chips');
  if (!el) return;   // the suggestion row is gone; the cycling prompt guides instead
  let list;
  const avail = Object.keys(ASPECT_CHIP).filter(k => SERIES[k]);
  const otherAspects = cur => avail.filter(k => k !== cur).map(k => ASPECT_CHIP[k]);
  if (typeof curFacet !== 'undefined' && onUs()) list = FACET_CHIPS[curFacet];
  else if (!chain.length) list = (typeof curFacet !== 'undefined' && FACET_CHIPS[curFacet]) || START_CHIPS;
  else {
    const last = chain[chain.length - 1];
    if (last.kind === 'divergence' || last.mode === 'divergence')
      list = ['life expectancy and inequality', 'life satisfaction and inequality', 'poverty and inequality'];
    else if (last.kind === 'time')
      list = [...otherAspects(ctx.lastAspect).slice(0, 2), 'wealth vs income in the US', 'most concentrated'];
    else
      list = ['wealth vs income in the US', ...otherAspects(ctx.lastAspect).slice(0, 2), 'most concentrated'];
  }
  // don't re-offer a question the chain has already asked: the cube should keep moving
  const asked = new Set(chain.map(f => norm(f.query)));
  list = list.filter(e => !asked.has(norm(e)));
  if (!list.length) list = START_CHIPS.filter(e => !asked.has(norm(e)));
  el.innerHTML = list.map(e => `<button type="button" class="chip">${e}</button>`).join('');
  el.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => ask(b.textContent)));
}

/* ── notices, views, wiring ────────────────────────────────────────── */
function showNotice(html) {
  const n = document.getElementById('notice');
  n.innerHTML = html; n.hidden = false;
  // the same words twice looked like nothing had happened: it flashes each time it is set
  n.classList.remove('fresh'); void n.offsetWidth; n.classList.add('fresh');
}
function hideNotice() { document.getElementById('notice').hidden = true; }

const VIEWS = ['ask', 'why', 'wealth', 'income', 'opportunity', 'wellbeing', 'db'];

/* ── US county tier: the same ask cube, at county resolution ───────── */
let US_COUNTY = null, US_NAMES = null;   // the county layer the opportunity face reads
let US_STATE = null;                      // the same measures, one row per state

// The standalone United States page was removed. Its reader, its chart and its own
// question grammar went with it; the commuting-zone and county data it used is read
// by the opportunity face instead, through oppAnswer and drawOpp above.

const WHY_ISO = 'USA';
// syncChartTheme lives in drawChart, which the Why page never goes through: without
// this call these two draw with the light grid baked in, blazing white over a dark page
function drawWhy() { syncChartTheme(); fillWhyNumbers(); drawWhyOwn(); drawWhyGaps(); drawWhyPay(); drawWhyHouse(); drawWhyFaces(); }

// Every count on the Why page is worked out here and written into the prose, because a
// number typed into the page once is a number that goes quietly wrong the next time the
// data is rebuilt. This page used to say the bottom half's share fell in 18 of 25 rich
// countries. It falls in 34 of 54, which is a majority and not a pattern, and the page
// now says which.
function whyNumbers() {
  const wb = SERIES.wealth_bottom50 || {}, w1 = SERIES.wealth_top1 || {};
  const at = (s, y) => { const q = (s || []).filter(d => d.year <= y); return q.length ? q[q.length - 1].v : null; };
  const all = Object.keys(wb).filter(i => BY_ISO[i] && wb[i].length && w1[i] && w1[i].length);
  const last = k => s => s[s.length - 1].v;
  const thin = all.filter(i => wb[i][wb[i].length - 1].v < 0.10);
  const under = all.filter(i => wb[i][wb[i].length - 1].v < w1[i][w1[i].length - 1].v);
  const owing = all.filter(i => wb[i][wb[i].length - 1].v <= 0);
  const rt = richThird();
  const rich = all.filter(i => rt.has(i) && at(wb[i], 1995) != null);
  const fell = y => rich.filter(i => wb[i][wb[i].length - 1].v < at(wb[i], y));
  const sweep = multipleSweepAll();
  return {
    all: all.length, thin: thin.length, under: under.length, owing: owing.length,
    fat: all.filter(i => wb[i][wb[i].length - 1].v >= 0.10).map(i => BY_ISO[i].name).sort(),
    rich: rich.length, fell95: fell(1995).length, fell90: fell(1990).length, fell00: fell(2000).length,
    gapBoth: sweep.both.length, gapWider: sweep.wider, gapMed: sweep.medRatio, gapOwing: sweep.owing.length,
  };
}
// the same two divisions as the wealth face, over every country rather than a chosen set
function multipleSweepAll() {
  if (multipleSweepAll.cache) return multipleSweepAll.cache;
  const both = [], owing = [];
  for (const iso in BY_ISO) {
    const p = multiplePair(iso);
    if (!p || p.im == null) continue;
    if (p.wm == null) { if (p.wb != null) owing.push(p); continue; }
    both.push(p);
  }
  const ratios = both.map(p => p.wm / p.im).sort((a, b) => a - b);
  return (multipleSweepAll.cache = { both, owing, wider: both.filter(p => p.wm > p.im).length,
    medRatio: ratios.length ? ratios[Math.floor(ratios.length / 2)] : 0 });
}
function fillWhyNumbers() {
  if (!DATA_READY) return;
  const n = whyNumbers();
  const put = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  put('wn-all', n.all);
  put('wn-thin', n.thin);
  put('wn-under', n.under);
  put('wn-owing', n.owing);
  put('wn-fat', n.fat.join(' and '));
  put('wn-gap-both', n.gapBoth);
  put('wn-gap-wider', n.gapWider === n.gapBoth ? 'every one of them' : `${n.gapWider} of them`);
  put('wn-gap-med', n.gapMed.toFixed(0));
  put('wn-gap-owing', n.gapOwing);
  put('wn-rich', n.rich);
  put('wn-fell', n.fell95);
  put('wn-fell-span', `${Math.min(n.fell90, n.fell95, n.fell00)} and ${Math.max(n.fell90, n.fell95, n.fell00)}`);
  put('wn-rose', n.rich - n.fell95);
}

// The closing figure: the page's own argument, arriving a second time at county scale.
// It reuses the reading the opportunity layer already computes rather than keeping a
// second copy of the rules, so the two can never disagree about what the numbers are.
function drawWhyFaces() {
  const el = document.getElementById('why-faces');
  if (!el || !window.Plotly || !US_COUNTY || !US_COUNTY.us_mobility) return;
  const saved = chain.slice();
  let f = null;
  try { f = oppAnswer('do the four faces agree inside one country?', true); } catch (e) { f = null; }
  chain.length = 0; chain.push(...saved);
  if (!f || !f.opp || f.opp.kind !== 'faces') return;
  const o = f.opp;
  const lab = o.cols.map(c => c.lab);
  Plotly.react(el, [{
    type: 'heatmap', x: lab, y: lab, z: o.grid,
    zmin: -1, zmax: 1, xgap: 3, ygap: 3,
    colorscale: [[0, metricColor('life_exp')], [0.5, cssVar('--surface', '#ffffff')], [1, metricColor('wealth_top1')]],
    colorbar: { thickness: 9, len: 0.6, tickfont: { size: 9 },
      tickvals: [-1, 0, 1], ticktext: ['opposite', 'unrelated', 'together'] },
    hovertemplate: '%{y} and %{x}<br>r = %{z:.2f}<extra></extra>', hoverongaps: false,
  }], Object.assign({}, BASE_LAYOUT, {
    margin: { t: 12, r: 12, b: 96, l: 136 },
    annotations: o.grid.flatMap((row, i) => row.map((v, j) => ({
      x: lab[j], y: lab[i], text: v == null ? '' : v.toFixed(2), showarrow: false,
      font: { size: 11.5, color: v == null ? 'rgba(0,0,0,0)'
        : Math.abs(v) > 0.55 ? '#ffffff' : cssVar('--ink', '#0a0a0a') },
    }))),
    xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { type: 'category', autorange: true,
      tickangle: -35, tickfont: { size: 10.5 }, gridcolor: 'rgba(0,0,0,0)' }),
    yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { type: 'category', autorange: 'reversed',
      tickfont: { size: 10.5 }, gridcolor: 'rgba(0,0,0,0)' }),
  }), CFG);
  const src = document.getElementById('why-faces-src');
  if (src) src.textContent =
    `Every pair held against each other across US counties. Blue means they rise together, rose ` +
    `means one rises as the other falls, pale means they have nothing to do with each other. ` +
    `Between ${Math.min(...o.ns.flat().filter(Boolean)).toLocaleString('en-US')} and ` +
    `${Math.max(...o.ns.flat()).toLocaleString('en-US')} counties carry each pair; the life gap is ` +
    `published for the fewest. Correlations across places, not mechanisms inside any of them: these ` +
    `counties differ in a hundred other ways at once. Sources: Opportunity Insights, the Social ` +
    `Capital Atlas, the Health Inequality Project, and the American Community Survey.`;
}

// Step one: the poorest half's share of everything owned, which fell nearly everywhere.
// One line per country and no median across them, because a median would hide the range
// and the range is part of the point.
const WHY_OWN = ['GBR', 'FRA', 'DEU', 'ITA', 'USA'];
function drawWhyOwn() {
  const el = document.getElementById('why-own');
  if (!el || !window.Plotly || !SERIES.wealth_bottom50) return;
  // 1995, not 1990. the first few years of the wealth series are smooth model output on
  // thin data for most countries, and starting there invents a cliff: the UK appears to
  // halve between 1990 and 1994 because the model was revised, not because anything moved.
  const FROM = 1995;
  const got = WHY_OWN.filter(i => seriesOf('wealth_bottom50', i).filter(d => d.year >= FROM).length > 3);
  if (!got.length) return;
  const ramp = shadesOf(metricColor('wealth_bottom50'), Math.max(2, got.length));
  let lo = Infinity, hi = -Infinity;
  const traces = got.map((iso, k) => {
    const ser = seriesOf('wealth_bottom50', iso).filter(d => d.year >= FROM);
    lo = Math.min(lo, ser[0].year); hi = Math.max(hi, ser[ser.length - 1].year);
    return { type: 'scatter', mode: 'lines', name: BY_ISO[iso].name,
      x: ser.map(d => d.year), y: ser.map(d => d.v),
      line: { color: ramp[k], width: 2.6, shape: 'linear' },
      hovertemplate: BY_ISO[iso].name + ': the bottom half own %{y:.1%}<extra></extra>' };
  });
  Plotly.react(el, traces, Object.assign({}, BASE_LAYOUT, {
    showlegend: true, legend: { orientation: 'h', y: 1.16, font: { size: 11 } },
    margin: { t: 14, r: 16, b: 40, l: 56 },
    shapes: eraShapes(lo, hi), annotations: eraLabels(lo, hi),
    yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { tickformat: '.0%',
      title: { text: 'share of all wealth owned by the poorest half', font: { size: 11 } } }),
  }), CFG);
  const t = document.getElementById('why-own-title');
  if (t) t.textContent = `What the bottom half owns, ${lo} to ${hi}`;
  const src = document.getElementById('why-own-src');
  if (src) src.textContent =
    `Net wealth, so debts are subtracted, which is how a share can fall below zero. ` +
    `Drawn from ${FROM} rather than 1990: the first years of this series are smooth model output ` +
    `on thin data for most countries, and starting there invents falls that are revisions rather ` +
    `than history. ` +
    `Five countries are drawn because a line each is readable and an average across them ` +
    `would hide how differently they moved. ` + (() => {
      const n = whyNumbers();
      return `Across the ${n.rich} countries in the richer third, this share fell in ${n.fell95} of ` +
        `them and rose in ${n.rich - n.fell95}. That count barely moves with the starting year: ` +
        `it lands between ${Math.min(n.fell90, n.fell95, n.fell00)} and ` +
        `${Math.max(n.fell90, n.fell95, n.fell00)} whether you begin in 1990, 1995 or 2000. ` +
        `A majority, then, and a steady one, but not something that happened everywhere. `;
    })() +
    provenance(['wealth_bottom50']);
}

// Step two, and the strongest thing the atlas holds: the same division done on owning and
// on earning, one dot per country. Every country sits above the line.
function drawWhyGaps() {
  const el = document.getElementById('why-gaps');
  if (!el || !window.Plotly || !SERIES.wealth_bottom50 || !SERIES.income_bottom50) return;
  const s = multipleSweepAll();
  const pts = s.both;
  if (pts.length < 20) return;
  const lo = Math.min(...pts.map(p => Math.min(p.im, p.wm))) * 0.8;
  // headroom, not padding: the topmost dot carries a label above it and a tight range
  // clips the label rather than the dot, which looks like a bug rather than a scale
  const hi = Math.max(...pts.map(p => Math.max(p.im, p.wm))) * 1.9;
  const mark = ['GBR', 'USA', 'FRA'].map(i => pts.find(p => p.iso === i)).filter(Boolean);
  // named countries sit close together, so their labels are pushed to opposite sides
  const SIDE = { GBR: 'bottom center', USA: 'top center', FRA: 'middle left' };
  Plotly.react(el, [
    { type: 'scatter', mode: 'lines', showlegend: false, x: [lo, hi], y: [lo, hi],
      line: { color: cssVar('--axis', '#cbd5e1'), width: 1, dash: 'dash' }, hoverinfo: 'skip' },
    { type: 'scatter', mode: 'markers', showlegend: false,
      x: pts.map(p => p.im), y: pts.map(p => p.wm), text: pts.map(p => BY_ISO[p.iso].name),
      marker: { color: metricColor('wealth_top1'), size: 7, opacity: 0.4 },
      hovertemplate: '%{text}<br>earning gap %{x:.0f}x<br>owning gap %{y:.0f}x<extra></extra>' },
    { type: 'scatter', mode: 'markers+text', showlegend: false,
      x: mark.map(p => p.im), y: mark.map(p => p.wm), text: mark.map(p => BY_ISO[p.iso].name),
      textposition: mark.map(p => SIDE[p.iso] || 'top center'), textfont: { size: 11 },
      marker: { size: 11, color: hlFill('wealth_top1'), line: { color: hlEdge(), width: 2 } },
      hovertemplate: '%{text}<br>earning gap %{x:.0f}x<br>owning gap %{y:.0f}x<extra></extra>' },
  ], Object.assign({}, BASE_LAYOUT, {
    margin: { t: 16, r: 18, b: 48, l: 76 },
    xaxis: Object.assign({}, BASE_LAYOUT.xaxis, logMult(lo, hi, 'earning gap, times')),
    yaxis: Object.assign({}, BASE_LAYOUT.yaxis, logMult(lo, hi, 'owning gap, times')),
  }), CFG);
  const t = document.getElementById('why-gaps-title');
  if (t) t.textContent = 'The gap in owning against the gap in earning';
  const src = document.getElementById('why-gaps-src');
  if (src) src.textContent =
    `One dot per country. Across, what one person in the top 1% earns against one person in the ` +
    `poorest half. Up, what one of them owns against one of them. Each share is divided by the ` +
    `fraction of adults it covers first, which is what turns a share of a block into an income or ` +
    `a holding for a person. On the dashed line the two gaps would be the same size; ` +
    (s.wider === pts.length ? 'no country is on it or below it' : `${s.wider} of ${pts.length} sit above it`) +
    `. ${s.owing.length} further ${s.owing.length === 1 ? 'country is' : 'countries are'} left out ` +
    `because the poorest half there owes more than it owns, which has no value as a multiple and ` +
    `is the same pattern carried past the point the arithmetic survives. Both scales are ` +
    `logarithmic: the owning gap is an order of magnitude larger, and on a straight scale every ` +
    `country would sit in one corner. Wealth and income shares stop in different years, so each ` +
    `country is drawn at its own latest reading of each. ` +
    provenance(['wealth_top1', 'wealth_bottom50', 'income_top1', 'income_bottom50']);
}

// Step two: earning against owning, for the same people. A dot per country, so the
// claim is not carried by whichever country was picked to illustrate it.
function drawWhyPay() {
  const el = document.getElementById('why-pay');
  if (!el || !window.Plotly || !SERIES.income_bottom50 || !SERIES.wealth_bottom50) return;
  const A = 1995, B = 2017;
  const pts = [];
  for (const iso in BY_ISO) {
    const w = seriesOf('wealth_bottom50', iso), i = seriesOf('income_bottom50', iso);
    const at = (ser, y) => { const m = ser.filter(d => d.year <= y); return m.length && m[m.length - 1].year >= y - 2 ? m[m.length - 1].v : null; };
    const wa = at(w, A), wb = at(w, B), ia = at(i, A), ib = at(i, B);
    if (wa == null || wb == null || ia == null || ib == null) continue;
    if (!inScope(iso, null)) continue;
    pts.push({ iso, name: BY_ISO[iso].name, di: (ib - ia) * 100, dw: (wb - wa) * 100 });
  }
  if (pts.length < 8) return;
  const NAME = ['GBR', 'FRA', 'ITA', 'SWE', 'USA', 'DEU'];
  const lab = new Set(NAME);
  const plain = pts.filter(p => !lab.has(p.iso)), hit = pts.filter(p => lab.has(p.iso));
  const mk = (arr, big) => ({
    type: 'scatter', mode: big ? 'markers+text' : 'markers',
    x: arr.map(p => p.di), y: arr.map(p => p.dw),
    text: arr.map(p => p.name),
    // names alternate above and below so neighbouring labels do not sit on each other
    textposition: big ? arr.map((p, k) => k % 2 ? 'bottom center' : 'top center') : 'top center',
    textfont: { size: 11, color: cssVar('--ink', '#0a0a0a') },
    marker: big
      ? { size: 12, color: hlFill('wealth_bottom50'), line: { color: hlEdge(), width: 2 } }
      : { size: 7, color: metricColor('wealth_bottom50'), opacity: 0.45 },
    hovertemplate: '%{text}<br>share of income %{x:+.1f} points<br>share of wealth %{y:+.1f} points<extra></extra>',
  });
  const xs = pts.map(p => p.di), ys = pts.map(p => p.dw);
  const pad = (v, k) => { const l = Math.min(...v), h = Math.max(...v), g = (h - l) * k; return [l - g, h + g]; };
  const rx = pad(xs, 0.12);
  // one country ran so far from the rest that keeping it on scale flattens everyone
  // else into a stripe. the axis holds the bulk and the stragglers are named at the
  // edge, so nothing is hidden and the shape of the cloud is still readable.
  const sorted = ys.slice().sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)], q3 = sorted[Math.floor(sorted.length * 0.75)];
  const cut = Math.min(...ys) < q1 - 3 * (q3 - q1 || 1) ? q1 - 3 * (q3 - q1 || 1) : Math.min(...ys);
  const ry = [Math.min(cut, -1) * 1.12, Math.max(...ys) * 1.12 || 1];
  const off = pts.filter(p => p.dw < ry[0]);
  const fell = pts.filter(p => p.dw < 0).length;
  const both = pts.filter(p => p.dw < 0 && p.di > 0).length;
  Plotly.react(el, [mk(plain, false), mk(hit, true)], Object.assign({}, BASE_LAYOUT, {
    showlegend: false,
    margin: { t: 16, r: 20, b: 48, l: 60 },
    shapes: [
      { type: 'line', xref: 'x', yref: 'y', x0: 0, x1: 0, y0: ry[0], y1: ry[1],
        line: { color: 'rgba(128,132,140,0.4)', width: 1 } },
      { type: 'line', xref: 'x', yref: 'y', x0: rx[0], x1: rx[1], y0: 0, y1: 0,
        line: { color: 'rgba(128,132,140,0.4)', width: 1 } },
    ],
    annotations: [{ x: rx[1], y: ry[0], xref: 'x', yref: 'y', xanchor: 'right', yanchor: 'bottom',
      text: 'earning more of the pie,<br>owning less of it', showarrow: false, align: 'right',
      font: { size: 10.5, color: cssVar('--ink-3', '#999999') } }].concat(
      // stagger them, or two countries close on the x axis print on top of each other
      off.slice().sort((m, n) => m.di - n.di).map((p, k) => ({
        x: p.di, y: ry[0], xref: 'x', yref: 'y', yanchor: 'bottom', yshift: 4 + (k % 2) * 22,
        text: `${esc(p.name)} ${p.dw.toFixed(0)}pt`, showarrow: true,
        arrowhead: 0, arrowsize: 1, arrowwidth: 1, ax: 0, ay: -(24 + (k % 2) * 22), align: 'center',
        arrowcolor: hlEdge(), font: { size: 10, color: cssVar('--ink-2', '#555555') } }))),
    xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { range: rx, autorange: false, ticksuffix: 'pt',
      title: { text: `change in their share of the income, ${A} to ${B}`, font: { size: 11 } } }),
    yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { range: ry, autorange: false, ticksuffix: 'pt',
      title: { text: 'change in their share of the wealth', font: { size: 11 } } }),
  }), CFG);
  const t = document.getElementById('why-pay-title');
  if (t) t.textContent = `Earning and owning, the poorest half, ${A} to ${B}`;
  const src = document.getElementById('why-pay-src');
  if (src) src.textContent =
    `Each dot is one country, measured in percentage points of the national total. ` +
    `Of ${pts.length} countries, ${fell} ended with a smaller share of the wealth, and ${both} of ` +
    `those ended with a larger share of the income at the same time. ` +
    (off.length
      ? `${off.map(p => esc(p.name) + ' at ' + p.dw.toFixed(1) + ' points').join(', ')} ` +
        `${off.length === 1 ? 'falls' : 'fall'} below the bottom of the axis and ${off.length === 1 ? 'is' : 'are'} ` +
        `named there rather than dropped: keeping ${off.length === 1 ? 'it' : 'them'} on scale flattens ` +
        `every other country into a stripe. `
      : '') +
    provenance(['income_bottom50', 'wealth_bottom50']);
}

// Step three: houses against pay, drawn for the United Kingdom. The OECD series holds
// about forty-five countries and the question box reads any of them.
function drawWhyHouse() {
  const el = document.getElementById('why-house');
  if (!el || !window.Plotly || !SERIES.house_price) return;
  const iso = 'GBR';
  const hp = seriesOf('house_price', iso), inc = seriesOf('median_income', iso);
  if (hp.length < 5 || inc.length < 3) return;
  const lo = Math.max(hp[0].year, inc[0].year);
  const H = hp.filter(d => d.year >= lo), I = inc.filter(d => d.year >= lo);
  if (!H.length || !I.length) return;
  const base = I[0].year;
  const hAt = y => { const m = H.filter(d => d.year <= y); return m.length ? m[m.length - 1].v : H[0].v; };
  const hBase = hAt(base), iBase = I[0].v;
  const hi = Math.min(H[H.length - 1].year, I[I.length - 1].year);
  const Hs = H.filter(d => d.year >= base && d.year <= hi);
  const Is = I.filter(d => d.year <= hi);
  Plotly.react(el, [
    { type: 'scatter', mode: 'lines', name: 'the price of a house',
      x: Hs.map(d => d.year), y: Hs.map(d => d.v / hBase * 100),
      line: { color: metricColor('wealth_top1'), width: 2.8, shape: 'linear' },
      hovertemplate: 'houses %{y:.0f} (' + base + ' = 100)<extra></extra>' },
    { type: 'scatter', mode: Is.length < 14 ? 'lines+markers' : 'lines', name: 'what people earn',
      x: Is.map(d => d.year), y: Is.map(d => d.v / iBase * 100),
      line: { color: metricColor('median_income'), width: 2.8, shape: 'linear' },
      marker: { size: 5 },
      hovertemplate: 'income %{y:.0f} (' + base + ' = 100)<extra></extra>' },
  ], Object.assign({}, BASE_LAYOUT, {
    showlegend: true, legend: { orientation: 'h', y: 1.16, font: { size: 11 } },
    margin: { t: 14, r: 16, b: 40, l: 52 },
    shapes: eraShapes(base, hi), annotations: eraLabels(base, hi),
    yaxis: Object.assign({}, BASE_LAYOUT.yaxis, {
      title: { text: `both after inflation, ${base} = 100`, font: { size: 11 } } }),
  }), CFG);
  const t = document.getElementById('why-house-title');
  if (t) t.textContent = `The United Kingdom, houses and pay, ${base} to ${hi}`;
  const src = document.getElementById('why-house-src');
  if (src) src.textContent =
    `Both lines are after inflation and both start at 100, so what matters is how far apart they ` +
    `get. Houses are the OECD real house price index for the United Kingdom. Pay is median ` +
    `household income from the World Bank, which is not the same as the wage figures used in the ` +
    `usual house-price-to-earnings ratio: it is income after transfers, for a whole household. ` +
    `The direction is the same, the denominator is not, and the gap here is the smaller of the two. ` +
    `The same reading exists for about forty-five countries: ask about houses and name one. ` +
    provenance(['house_price', 'median_income']);
}

function setView(name) {
  for (const v of VIEWS) {
    document.getElementById('view-' + v).hidden = v !== name;
  }
  document.querySelectorAll('.tabs .tab').forEach(t =>
    t.classList.toggle('on', t.dataset.view === name));
  if (name === 'ask' && chain.length) requestAnimationFrame(() =>
    Plotly.Plots.resize(document.getElementById('chart')));
  if (name === 'why') requestAnimationFrame(drawWhy);
}
// turn to another face of the cube: the atlas flips left, the new face comes in from the right
let flipping = false;
function flipTo(name, back) {
  const curName = VIEWS.find(v => !document.getElementById('view-' + v).hidden);
  if (!curName || curName === name || flipping) { setView(name); window.scrollTo(0, 0); return; }
  if (reduceMotion) { setView(name); window.scrollTo(0, 0); return; }
  flipping = true;
  const cur = document.getElementById('view-' + curName), nxt = document.getElementById('view-' + name);
  const out = back ? 90 : -90, inn = back ? -90 : 90;
  // hinge each face on the shared edge so it turns like a corner of the cube, not a spinning card
  const curEdge = back ? 'left center' : 'right center';
  const nxtEdge = back ? 'right center' : 'left center';
  const EASE = 'transform .5s cubic-bezier(.5,0,.28,1), opacity .3s ease';
  cur.classList.add('flipping'); cur.style.transformOrigin = curEdge;
  cur.style.transition = EASE;
  cur.style.transform = `rotateY(${out}deg)`; cur.style.opacity = '0';
  setTimeout(() => {
    cur.hidden = true; cur.classList.remove('flipping');
    cur.style.transform = ''; cur.style.opacity = ''; cur.style.transition = ''; cur.style.transformOrigin = '';
    setView(name); window.scrollTo(0, 0);
    nxt.classList.add('flipping'); nxt.style.transformOrigin = nxtEdge; nxt.style.transition = 'none';
    nxt.style.transform = `rotateY(${inn}deg)`; nxt.style.opacity = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      nxt.style.transition = EASE;
      nxt.style.transform = 'rotateY(0deg)'; nxt.style.opacity = '1';
      setTimeout(() => { nxt.classList.remove('flipping'); nxt.style.transition = ''; nxt.style.transform = ''; nxt.style.opacity = ''; nxt.style.transformOrigin = ''; flipping = false; }, 520);
    }));
  }, 460);
}

// reset takes you all the way back to the home start: empty cell, drifting cube, top of the page
function resetAll() {
  const onUS = false;
  chain.length = 0; facetMeasureIdx.wealth = 0; facetMeasureIdx.income = 0;
  const qb = document.getElementById('q'); if (qb) qb.value = '';
  resetCell(); resetCtx(); render();
  // the measure is reset after the face, not before: reset first, it took the face being
  // left, so "start over" from the income face read the next wealth question on income
  chooseFacet('wealth'); resetCtx(); startIdle(); setStage('compose');
  if (onUS) flipTo('ask', true); else window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  if (!restoring && location.hash) history.pushState(null, '', location.pathname);   // Back brings the answer back
}

// "how rich is norwey" narrowed the list to nothing, because no question contains those
// exact letters. the words are corrected first and a question matches on any real word
// it shares, so what is typed and what is offered meet halfway
let catalogueWords = null, catalogueFor = '';
function catalogueMatch(q, f) {
  if (norm(q).includes(f)) return true;
  if (catalogueFor !== f) {
    catalogueFor = f;
    catalogueWords = new Set(norm(spellFix(f).text).split(' ').filter(w => w.length > 3 && !STOP.has(w)));
  }
  return norm(q).split(' ').some(w => catalogueWords.has(w));
}
/* ── what the box will read ─────────────────────────────────────────────
   As you type, a line under the box says how the question will be read: the country,
   the measure, the shape of the answer, and any word it took to be a slip. A slip can be
   fixed with one tap before anything is sent. Nothing leaves the page: it is the same
   reading the answer uses, run early. */
function describeRead(raw) {
  const t = (raw || '').trim();
  if (t.length < 3) return null;
  const fix = spellFix(t), q0 = fix.text, pe = readPlacesAndEvents(q0), q = pe.text, nq = norm(q);
  const out = { fixes: fix.changes, fixed: fix.changes.length ? q : null, say: '', unsure: false, near: [] };
  const names = isos => isos.map(i => BY_ISO[i] ? theName(i) : i).join(' and ');
  if (ABOUT.test(nq)) { out.say = 'what the atlas is and how to ask it'; return out; }
  for (const [re, to] of REWRITES) if (re.test(nq)) { out.say = 'read as: ' + to; return out; }
  if (METHOD.some(([re]) => re.test(nq))) { out.say = 'sources and method, with a link to the page'; return out; }
  if (NOT_HELD.some(([re]) => re.test(nq))) { out.say = 'something the atlas does not hold; it will say so and offer the nearest'; return out; }
  if (GLOSSARY.some(([re]) => re.test(nq)) && /^(what is|what s|whats|what are|what does|define|explain|meaning of)\b/.test(nq) &&
      !findCountries(q).isos.length) { out.say = 'a short definition'; return out; }
  const usp = US_CZ ? usPlaceFind(q) : null;
  if (usp) {
    out.say = usp.type === 'shared-zone' ? `several US places are called ${usp.name}: add the county or state`
      : usp.type === 'shared-county' ? `there is a ${usp.name} County in several states: add the state`
      : 'the US layer, ' + (usp.type === 'county' ? `${usp.name} County, ${usp.stateName}` : usp.type === 'zone' ? `the ${usp.name} area` : usp.name);
    return out;
  }
  if (TO_OPP.some(([re]) => re.test(nq))) { out.say = 'the US layer, county by county'; return out; }
  let p;
  try { p = parse(q); } catch (err) { p = { kind: 'unknown' }; }
  if (!p || p.kind === 'unknown' || p.kind === 'pending') {
    out.unsure = true; out.say = 'not sure how to read this yet'; out.near = nearestQuestions(q, 2); return out;
  }
  const isos = findCountries(q).isos;
  const k = p.kind;
  const m = p.metric || (p.metrics && p.metrics[0]) || null;
  // with no measure named, rankings and single countries use the face's own
  const mk = m || (['rank', 'delta_rank', 'profile', 'metric', 'time', 'point', 'compare'].includes(k) ? facetIneqDefault() : null);
  const mlab = mk && META[mk] ? META[mk].label : null;
  const set = p.pool && p.pool.all ? 'every country' : p.region ? REGION_LABEL[p.region] : null;
  const shape = VIEW_DEF[k] ? VIEW_DEF[k].label
    : k === 'rank' ? `a ranking, ${p.dir === 'low' ? 'lowest' : 'highest'} first`
    : k === 'delta_rank' ? `who ${p.dir === 'down' ? 'fell' : 'rose'} most${p.year ? ' since ' + p.year : ''}`
    : k === 'time' ? `over time${p.year ? ' from ' + p.year : ''}`
    : k === 'point' ? `in ${p.year}` : k === 'compare' ? 'side by side' : k === 'correlate' ? 'one measure against another, across countries'
    : k === 'divergence' ? 'wealth and income, pulling apart or not' : k === 'owngap' ? 'owning against earning, every country'
    : k === 'lorenz' ? 'a Lorenz curve' : k === 'spread' ? 'the spread across countries' : k === 'tiers' ? 'countries in three groups'
    : k === 'among' ? 'the same answer over a different set of countries' : '';
  out.say = [isos.length ? names(isos) + (set ? ', among ' + set : '') : (set || (['profile', 'metric'].includes(k) ? 'every country, ranked' : '')), mlab, shape]
    .filter(Boolean).join(' \u00b7 ');
  return out;
}
let readT = null, readSent = null;
function showRead() {
  const box = document.getElementById('q'), line = document.getElementById('readline');
  if (!box || !line) return;
  const d = describeRead(box.value);
  if (!d || !box.value.trim() || box.value.trim() === readSent) { line.hidden = true; return; }
  const nice = t => { const hit = NAME_INDEX.find(n => n.norm === t); return hit && BY_ISO[hit.iso] ? BY_ISO[hit.iso].name : t; };
  const fixes = d.fixes.length ? ' <span class="rl-fix">' + d.fixes.map(([a, b]) => `${esc(a)} \u2192 ${esc(nice(b))}`).join(', ') +
    ` <button type="button" class="rl-use" data-text="${esc(d.fixed)}">fix it</button></span>` : '';
  const near = d.near.length ? ' Nearest: ' + d.near.map(c => `<button type="button" class="rl-near" data-q="${esc(c)}">${esc(c)}</button>`).join(' ') : '';
  line.innerHTML = `<span class="rl-k">${d.unsure ? 'hmm' : 'reads as'}</span> ${esc(d.say)}${fixes}${near}`;
  line.classList.toggle('unsure', d.unsure);
  line.hidden = false;
  line.querySelectorAll('.rl-use').forEach(b => b.addEventListener('mousedown', ev => ev.preventDefault()));
  line.querySelectorAll('.rl-use').forEach(b => b.addEventListener('click', () => {
    box.value = b.dataset.text; box.focus(); showRead(); setHelp(true, box.value); }));
  line.querySelectorAll('.rl-near').forEach(b => b.addEventListener('click', () => {
    box.value = b.dataset.q; setHelp(false); if (runPrompt(b.dataset.q)) sendCell(); line.hidden = true; }));
}
function setHelp(open, filter) {
  const el = document.getElementById('help');
  if (open) {   // the whole catalogue, grouped, narrowed by whatever you've typed
    const f = norm(filter || '');
    // the group that belongs to the face you're on leads
    const groups = QUESTIONS.slice().sort((a, b) =>
      (b.facet === curFacet ? 1 : 0) - (a.facet === curFacet ? 1 : 0));
    let html = '', hits = 0;
    const listed = new Set();   // several groups share a question; the list shows it once
    for (const g of groups) {
      const list = (f ? g.qs.filter(q => catalogueMatch(q, f)) : g.qs).filter(q => !listed.has(q));
      if (list.length && g.k) html += `<div class="help-g-k" role="presentation">${esc(g.k)}</div>`;
      for (const q of list) {
        listed.add(q);
        hits++;
        html += `<button type="button" class="q-item" role="option" aria-selected="false"` +
          `${g.facet ? ` data-facet="${esc(g.facet)}"` : ''}>${esc(q)}</button>`;
      }
    }
    el.innerHTML = hits ? html
      : '<p class="opt-note">Nothing written matches. Press enter to ask it as you typed it.</p>';
    el.querySelectorAll('.q-item').forEach(b => {
      b.addEventListener('mousedown', e => e.preventDefault());   // never blur the box out from under the click
      b.addEventListener('click', () => {
        setHelp(false);
        const want = b.dataset.facet;                    // a question belonging to another face turns to it first
        if (want && want !== curFacet) chooseFacet(want);
        else if (!want && onUs()) chooseFacet('wealth');
        // one click answers. it used to fill the strip and wait for "show me", which read
        // as the list not working; the strip is still there to change afterwards
        if (runPrompt(b.textContent)) sendCell();
      });
    });
  }
  el.hidden = !open;
  const q = document.getElementById('q');
  if (q) q.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.getElementById('helpbtn').classList.toggle('on', open);
}

/* ── database table ────────────────────────────────────────────────── */
const tsort = { key: 'wealth_gini', dir: 'desc' };
function renderTable() {
  const q = norm(document.getElementById('tfilter').value || '');
  let rows = LATEST.slice();
  if (q) rows = rows.filter(r => norm(r.geo_name).includes(q));
  rows.sort((a, b) => {
    const x = a[tsort.key], y = b[tsort.key];
    if (x == null) return 1; if (y == null) return -1;
    const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
    return tsort.dir === 'asc' ? c : -c;
  });
  document.querySelector('#dbtable tbody').innerHTML = rows.map(r =>
    `<tr><td>${esc(r.geo_name)}</td><td>${r.year}</td><td>${g3(r.wealth_gini)}</td>` +
    `<td>${pc(r.top1_wealth_share)}</td><td>${pc(r.top10_wealth_share)}</td><td>${pc(r.bottom50_wealth_share)}</td></tr>`).join('');
  document.querySelectorAll('#dbtable thead th').forEach(th => {
    th.querySelector('.dir').textContent =
      th.dataset.k === tsort.key ? (tsort.dir === 'asc' ? '↑' : '↓') : '';
  });
}

function fillCoverage() {
  const cov = (metric, elId) => {
    const s = SERIES[metric] || {};
    const isos = Object.keys(s).filter(i => s[i].length);
    let lo = Infinity, hi = -Infinity;
    for (const i of isos) { lo = Math.min(lo, s[i][0].year); hi = Math.max(hi, s[i][s[i].length - 1].year); }
    const el = document.getElementById(elId);
    if (el && isos.length) el.textContent = `${isos.length} countries, ${lo} to ${hi}.`;
  };
  // each span reports the measure the block beside it actually describes: the wealth
  // block is about the top 1% and bottom 50% shares, and the income block about the WID
  // income shares, not the survey Gini that happens to share the word income
  cov('wealth_top1', 'cov-wealth');
  cov('income_top1', 'cov-income');
  cov('median_income', 'cov-median');
  cov('life_exp', 'cov-life');
  cov('co2_pc', 'cov-co2');
  cov('poverty_rate', 'cov-poverty');
  cov('life_satisfaction', 'cov-sat');
}

// the chrome needs no data: the cube, the theme, the tabs. wiring it behind the
// fetch left the cube dead for as long as 2.3MB of json took to arrive, which on a
// slow line is half a minute of a thing that looks draggable and is not.
let DATA_READY = false;
function bootShell() {
  initCube();
  const sh = document.getElementById('shake');
  if (sh) sh.addEventListener('click', shakeCube);
  // theme toggle: follow the OS, or override it and remember
  const themeBtn = document.getElementById('theme');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const dark = !(document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches));
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try { localStorage.setItem('oia-theme', dark ? 'dark' : 'light'); } catch (e) {}
    if (chain.length) drawChart();
    if (!document.getElementById('view-why').hidden) drawWhy();
  });
  // back to the top (and the cube) once you've scrolled into the visuals
  const toTop = document.getElementById('totop');
  if (toTop) {
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
    window.addEventListener('scroll', () => toTop.classList.toggle('show', window.scrollY > 320));
  }
  const tabsEl = document.getElementById('tabs'), deeperBtn = document.getElementById('deeper');
  if (deeperBtn) deeperBtn.addEventListener('click', () => {
    const open = tabsEl.hidden;
    tabsEl.hidden = !open;
    deeperBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  const homeBtn = document.getElementById('home');
  if (homeBtn) homeBtn.addEventListener('click', () => {
    setView('ask');
    tabsEl.hidden = true; deeperBtn.setAttribute('aria-expanded', 'false');
  });
  document.querySelectorAll('.tabs .tab').forEach(t =>
    t.addEventListener('click', () => setView(t.dataset.view)));
  // the prompt reel turns while the numbers are still on the wire
  setInterval(() => nextPrompt(false), 3800);
  stageFocus = false; setStage('compose'); stageFocus = true; setHelp(false);
}
function boot() {
  DATA_READY = true;
  updateChips();
  document.querySelectorAll('.try').forEach(v => {
    // a question offered on a reference page has to work from that page, whichever face
    // the cube happens to be showing. the opportunity ones read a different layer, so
    // the chip turns the cube to it first instead of dead-ending on "could not read that".
    // which face a question belongs to is a property of the question, not of the page
    // it is offered on: the health page offers the US life expectancy reading, which
    // lives in the opportunity layer, and from any other face it would answer something
    // else without saying so.
    // the face is a property of the question, not of whichever face happens to be up:
    // a chip clicked from a reference page turns the cube before it asks
    const qFace = new Map();
    for (const g of QUESTIONS) if (g.facet) for (const q of g.qs) qFace.set(q, g.facet);
    const faceFor = q => qFace.get(q) || null;
    v.innerHTML = v.dataset.qs.split(';')
      .map(q => `<button type="button" class="chip">${q}</button>`).join('');
    v.querySelectorAll('.chip').forEach(b =>
      b.addEventListener('click', () => {
        setHelp(false); setView('ask');
        const wants = faceFor(b.textContent);
        if (wants && curFacet !== wants) chooseFacet(wants);
        else if (!wants && onUs()) chooseFacet('wealth');
        // the same road a typed question takes: a reading that needs a country used to
        // stop at the strip and wait for "show me" when asked from a reference page
        if (onUs()) { ask(b.textContent); revealAnswer(); }
        else if (runPrompt(b.textContent)) sendCell();
        else revealAnswer('#notice');
      }));
  });
  document.getElementById('helpbtn').addEventListener('click', () =>
    setHelp(document.getElementById('help').hidden));
  // Enter always moves. The old rule was "at the chain stage, send" regardless of what
  // was in the box, so editing the question there silently sent the previous one; and
  // at the result stage the box was hidden altogether, which is why typing a second
  // question appeared to do nothing at all.
  document.getElementById('ask-form').addEventListener('submit', e => {
    e.preventDefault();
    const el = document.getElementById('q');
    const v = (el.value || '').trim();
    setHelp(false);
    const asked = (cell.asked || '').trim();
    if (stage === 'chain' && (!v || v === asked)) { sendCell(); return; }   // the same one, send it
    // "tell me more" over an answer opens what is folded under it, rather than being read
    // as a question and refused
    if (stage === 'result' && chain.length && /^(tell me more|more|go on|say more|explain( that| this| it)?|why|and|details?|how)\??$/.test(norm(v))) {
      el.value = '';
      const det = document.querySelector('#answer details.more');
      if (det) { det.open = true; det.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' }); }
      else showNotice('That is all there is to this answer. The source and how to read the chart are under it.');
      return;
    }
    // asking to be shown anything is asking for the die
    if (/^(show me )?(something|anything)( interesting| random| good)?$|^surprise me$|^random$|^roll( the die| the dice| me one| me)?$|^(show me |tell me )?(something|anything) (surprising|interesting|cool|new|random)$|^pick (one|something)( for me)?$|^i don t know$|^idk$/.test(norm(v))) {
      el.value = ''; shakeCube(); return;
    }
    // a question that could not be read must not fall through to the answer already on
    // screen: that answer is to a different question, and showing it again under this
    // one is worse than showing nothing. the notice says what it could not read
    if (runPrompt(v || el.placeholder.replace(/^\w+:\s*/, ''))) sendCell();
    else {
      if (stage !== 'compose') { stageFocus = false; setStage('compose'); stageFocus = true; }
      // from the first screen too: on a phone the notice sat below the fold and the
      // question looked unanswered
      revealAnswer('#notice');
    }
  });
  // pull the cycling example into the box to complete it: Tab, or click the empty prompt
  const qEl = document.getElementById('q');
  function fillPrompt() {
    if (qEl.value) return;
    qEl.value = qEl.placeholder.replace(/^\w+:\s*/, '');
    qEl.focus(); qEl.setSelectionRange(qEl.value.length, qEl.value.length);
  }
  // the example stays a grey placeholder. Tab used to drop it in, which took Tab away from
  // everyone moving through the page by keyboard: tabbing past the box filled it with a
  // question they never wrote. Tab moves on now. The right arrow, or the "edit this"
  // button, drops the example in; Enter on the empty box asks it as it stands.
  const fh = document.getElementById('fillhint');
  if (fh) fh.addEventListener('click', fillPrompt);
  qEl.addEventListener('keydown', e => {
    const hp = document.getElementById('help');
    const items = (hp && !hp.hidden) ? [...hp.querySelectorAll('.q-item')] : [];
    if (e.key === 'ArrowRight' && !qEl.value) { e.preventDefault(); fillPrompt(); return; }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (items.length) {           // a list is open: the arrows walk it
        e.preventDefault();
        const cur = items.findIndex(b => b.getAttribute('aria-selected') === 'true');
        const next = (cur + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(b => b.setAttribute('aria-selected', 'false'));
        items[next].setAttribute('aria-selected', 'true');
        items[next].scrollIntoView({ block: 'nearest' });
      } else if (!qEl.value) {      // nothing open: the arrows turn the reel
        e.preventDefault(); cyclePrompt(e.key === 'ArrowDown' ? 1 : -1);
      }
      return;
    }
    if (e.key === 'Enter') {
      const sel = items.find(b => b.getAttribute('aria-selected') === 'true');
      if (sel) { e.preventDefault(); setHelp(false);
        const want = sel.dataset.facet;
        if (want && want !== curFacet) chooseFacet(want);
        else if (!want && onUs()) chooseFacet('wealth');
        if (runPrompt(sel.textContent)) sendCell(); }
    }
  });
  // the on-screen steppers do the same as the arrow keys
  // the questions are a list you pick from, not just a reel you watch go by
  let blurT = null;
  qEl.addEventListener('focus', () => { clearTimeout(blurT); setHelp(true, qEl.value); });
  // a click into a box that already has the cursor (after "start over", say) fires no focus,
  // and the list stayed shut however often it was clicked
  qEl.addEventListener('click', () => { if (document.getElementById('help').hidden) setHelp(true, qEl.value); });
  qEl.addEventListener('input', () => { setHelp(true, qEl.value); clearTimeout(readT); readT = setTimeout(showRead, 300); });   // after a pause, so a screen reader is not talked over
  // the line is about what is being typed, not what was answered
  // sent is sent: the typing timer must not bring the line back under the answer
  document.getElementById('ask-form').addEventListener('submit', () => {
    clearTimeout(readT); readSent = qEl.value.trim();
    const l = document.getElementById('readline'); if (l) l.hidden = true; });
  qEl.addEventListener('blur', () => { blurT = setTimeout(() => setHelp(false), 160); });
  qEl.addEventListener('keydown', e => { if (e.key === 'Escape') { setHelp(false); qEl.blur(); } });
  const qup = document.getElementById('q-up'), qdn = document.getElementById('q-dn');
  if (qup) qup.addEventListener('click', () => cyclePrompt(-1));
  if (qdn) qdn.addEventListener('click', () => cyclePrompt(1));
  const homebtn = document.getElementById('homebtn');
  if (homebtn) homebtn.addEventListener('click', resetAll);
  const askPleat = document.querySelector('#rib-ask .rib-head');
  const askNew = document.getElementById('ask-new');
  if (askNew) askNew.addEventListener('click', () => {
    const q = document.getElementById('q');
    if (q) q.value = '';        // a fresh question, not the last one back again
    hideNotice();
    resetCell(); chain.length = 0; resetCtx();
    setStage('compose');
    if (q) q.focus();
  });
  document.querySelectorAll('.sendbtn').forEach(el => el.addEventListener('click', sendCell));
  const cw = document.getElementById('claim-why');
  if (cw) cw.addEventListener('click', () => { setView('why'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  // the why page ends by handing the reader to the layer it has just been describing
  const wto = document.getElementById('why-to-opp');
  if (wto) wto.addEventListener('click', () => {
    setView('ask');
    if (!onUs()) chooseFacet('opportunity');
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });
  document.getElementById('clear').addEventListener('click', resetAll);
  // click the measure inside the facet row to swap it
  const vfacet = document.getElementById('v-facet');
  if (vfacet) vfacet.addEventListener('click', e => { if (e.target.closest('.submeasure')) cycleMeasure(); });
  wireCell();
  watchLayout();
  updateCell();
  const usEnter = document.getElementById('us-enter');
  if (usEnter) usEnter.addEventListener('click', () => flipTo('us'));
  document.getElementById('share').addEventListener('click', () => {
    const h = urlState();
    const url = location.origin + location.pathname + (h ? '#' + h : '');
    const b = document.getElementById('share');
    const said = t => { b.textContent = t; setTimeout(() => { b.textContent = 'copy link'; }, 1600); };
    // without a clipboard (an http page, an old browser) the link is shown to copy by hand
    const byHand = () => { said('copy it below');
      showNotice(`Your browser would not let the page copy it. The link to this answer: <input class="linkout" readonly value="${esc(url)}" aria-label="link to this answer">`);
      const i = document.querySelector('#notice .linkout'); if (i) { i.focus(); i.select(); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => said('copied'), byHand);
    else byHand();
  });
  document.querySelectorAll('.goto-db').forEach(a =>
    a.addEventListener('click', e => { e.preventDefault(); setView('db'); }));
  document.getElementById('tfilter').addEventListener('input', renderTable);
  document.querySelectorAll('#dbtable thead th').forEach(th =>
    th.addEventListener('click', () => {
      if (tsort.key === th.dataset.k) tsort.dir = tsort.dir === 'asc' ? 'desc' : 'asc';
      else { tsort.key = th.dataset.k; tsort.dir = th.dataset.k === 'geo_name' ? 'asc' : 'desc'; }
      renderTable();
    }));
  // Escape folds an open pleat back and returns focus to the head that opened it
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('.rib.expanded');
    if (!open) return;
    closeDrawer();
    const h = open.querySelector('.rib-head'); if (h) h.focus();
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== document.getElementById('q')
        && document.activeElement !== document.getElementById('tfilter')) {
      e.preventDefault(); setView('ask'); document.getElementById('q').focus();
    }
  });
  renderTable();
  fillCoverage();
  // a link to an answer is read once the figures it needs have arrived
  if (location.hash.length > 1) restoreFromUrl();
  // otherwise the terminal opens clean: the cube drifts, the prompt waits
}

/* the wealth pipeline writes bare NaN into some numeric fields; JSON.parse rejects it */
const loadJson = url => fetch(url).then(r => r.text())
  .then(t => JSON.parse(t.replace(/\bNaN\b/g, 'null')));

function toSeries(dict) {
  const out = {};
  for (const iso in dict) out[iso] = dict[iso].map(([year, v]) => ({ year, v }));
  return out;
}
// Values a measure cannot take, dropped on the way in rather than drawn. Two of the
// 3036 county Ginis are above 1, which no Gini can be, and one county carries a median
// house value of zero where the census reported nothing. Both would otherwise land at
// the end of a ranking and be read as the answer. This runs at load so that re-exporting
// the source files cannot quietly put them back.
const US_BOUNDS = {
  us_income_gini:  [0.10, 1.00],
  us_house_value:  [1000, Infinity],
  us_mobility:     [0, 1],
  us_econ_conn:    [0, 2],
  us_exposure:     [0, 2],
  us_cohesion:     [0, 1],
  us_volunteering: [0, 1],
  us_life_exp:     [50, 110],
};
const US_DROPPED = {};
function scrubUs(store) {
  if (!store) return store;
  for (const key in US_BOUNDS) {
    const block = store[key];
    if (!block) continue;
    const [lo, hi] = US_BOUNDS[key];
    let n = 0;
    for (const id in block) {
      const v = block[id];
      if (typeof v !== 'number' || !isFinite(v) || v < lo || v > hi) { delete block[id]; n++; }
    }
    if (n) US_DROPPED[key] = (US_DROPPED[key] || 0) + n;
  }
  return store;
}
// what was dropped, said out loud on any chart that reads that measure
function droppedNote(key) {
  const n = US_DROPPED[key];
  if (!n) return '';
  const [lo, hi] = US_BOUNDS[key];
  const what = hi === Infinity ? `below ${lo}` : lo === 0.10 ? 'outside the range a Gini can take'
    : `outside ${lo} to ${hi}`;
  return ` ${n} ${n === 1 ? 'place carries a value' : 'places carry values'} ${what}, ` +
    `which cannot be right, so ${n === 1 ? 'it is' : 'they are'} left out of this.`;
}

// the cube, the theme and the tabs come alive on the first frame; the numbers follow
bootShell();

const opt = url => loadJson(url).catch(() => ({}));   // modules that may not exist yet load empty
Promise.all([
  loadJson('data/wealth_latest.json'),
  loadJson('data/wealth_timeseries.json'),
  opt('data/geo_names.json'),
  opt('data/income_gini.json'),
  opt('data/life_expectancy.json'),
  opt('data/co2_per_capita.json'),
  opt('data/poverty_rate.json'),
  opt('data/median_income.json'),
  opt('data/gdp_pc.json'),
  opt('data/life_satisfaction.json'),
  opt('data/wealth_top1.json'),
  opt('data/wealth_bottom50.json'),
  opt('data/income_top1.json'),
  opt('data/income_top10.json'),
  opt('data/income_middle40.json'),
  opt('data/income_bottom50.json'),
  opt('data/house_prices.json'),
  opt('data/us_county.json'),
  opt('data/us_state.json'),
  opt('data/us_names.json'),
  opt('data/us_manifest.json'),
  opt('data/us_cz.json'),
  opt('data/us_composition.json'),
  opt('data/hfcs_negative.json'),
  opt('data/hfcs_resilience.json'),
  opt('data/us_networth.json'),
  opt('data/house_income.json'),
  opt('data/gdp_hour.json'),
  opt('data/poverty_relative.json'),
]).then(([latest, ts, geoNames, income, life, co2, pov, medinc, gdp, sat, wtop1, wbot50,
  itop1, itop10, imid40, ibot50, hprice, usCounty, usState, usNames, usManifest, usCz, usComp, hfcsNeg, hfcsRes, scfNw, hinc, ghour, povrel]) => {
  LATEST = latest;
  // spine is the union of every country any module knows, named from geo_names
  const names = geoNames && Object.keys(geoNames).length ? geoNames : {};
  for (const iso in names) BY_ISO[iso] = { name: names[iso], latest: null };
  for (const r of latest) {
    if (!BY_ISO[r.geo_id]) BY_ISO[r.geo_id] = { name: r.geo_name, latest: null };
    BY_ISO[r.geo_id].latest = r;
  }
  const wg = {};
  for (const r of ts) if (BY_ISO[r.geo_id] && r.wealth_gini != null)
    (wg[r.geo_id] = wg[r.geo_id] || []).push({ year: r.year, v: r.wealth_gini });
  for (const iso in wg) wg[iso].sort((a, b) => a.year - b.year);
  SERIES.wealth_gini = wg;
  SERIES.income_gini = toSeries(income);
  SERIES.life_exp = toSeries(life);
  SERIES.co2_pc = toSeries(co2);
  SERIES.poverty_rate = toSeries(pov);
  SERIES.median_income = toSeries(medinc);
  SERIES.gdp_pc = toSeries(gdp);
  if (sat && Object.keys(sat).length) SERIES.life_satisfaction = toSeries(sat);
  if (wtop1 && Object.keys(wtop1).length) SERIES.wealth_top1 = toSeries(wtop1);
  if (wbot50 && Object.keys(wbot50).length) SERIES.wealth_bottom50 = toSeries(wbot50);
  if (itop1 && Object.keys(itop1).length) SERIES.income_top1 = toSeries(itop1);
  if (itop10 && Object.keys(itop10).length) SERIES.income_top10 = toSeries(itop10);
  if (imid40 && Object.keys(imid40).length) SERIES.income_middle40 = toSeries(imid40);
  if (ibot50 && Object.keys(ibot50).length) SERIES.income_bottom50 = toSeries(ibot50);
  if (hprice && Object.keys(hprice).length) SERIES.house_price = toSeries(hprice);
  if (hinc && Object.keys(hinc).length) SERIES.house_income = toSeries(hinc);
  if (ghour && Object.keys(ghour).length) SERIES.gdp_hour = toSeries(ghour);
  if (povrel && Object.keys(povrel).length) SERIES.poverty_relative = toSeries(povrel);
  if (usCounty && Object.keys(usCounty).length) { US_COUNTY = scrubUs(usCounty); US_NAMES = usNames; }
  if (usCz && Object.keys(usCz).length) US_CZ = usCz;
  if (usState && Object.keys(usState).length) US_STATE = scrubUs(usState);
  if (usComp && usComp.groups) US_COMP = usComp;
  if (hfcsNeg && hfcsNeg.by) HFCS_NEG = hfcsNeg;
  if (hfcsRes && hfcsRes.by) HFCS_RES = hfcsRes;
  if (scfNw && scfNw.groups) SCF_NW = scfNw;

  buildIndex();
  return true;
}).catch(err => {
  // only a real load failure says so. a fault in boot must not masquerade as one.
  console.error('data load failed', err);
  showNotice('Could not load the data files. If this page was opened from disk, serve it over HTTP, ' +
    'or get the release files from <a href="https://github.com/conway1521/wealth_ineq">GitHub</a>.');
  return false;
}).then(loaded => { if (loaded) boot(); });
