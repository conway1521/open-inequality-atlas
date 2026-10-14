'use strict';
// every chart the atlas draws.
// one of eight files loaded in order by index.html; they share one scope, so a
// function here can be used by any of them once the page has loaded

/* ── chart ─────────────────────────────────────────────────────────── */
// Lines run straight between measured points. They were smoothed, and a smoothed curve
// overshoots: it drew peaks between two years that no source ever reported, and on the
// France chart the top 1% line ran off the top of the axis chasing one.
const BASE_LAYOUT = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { family: 'Inter, system-ui, sans-serif', color: cssVar('--ink-2', '#555555'), size: 12 },
  margin: { t: 8, r: 8, b: 40, l: 46 },
  // axis type and range are sticky across Plotly.react, so every draw restates them:
  // a bar chart's category axis must never leak into the next scatter
  // automargin: a long label or axis title widens the margin rather than being cut off
  xaxis: { gridcolor: '#f0f0f0', zeroline: false, linecolor: '#eaeaea', type: 'linear', autorange: true, automargin: true },
  yaxis: { gridcolor: '#f0f0f0', zeroline: false, linecolor: '#eaeaea', type: 'linear', autorange: true, automargin: true },
  showlegend: false,
};
// the tick format a measure's own axis wears: a share as a per cent, money with its sign
function axisFmt(m) {
  if (!m) return {};
  if (m.fmt === pc) return { tickformat: '.0%' };
  if (m.fmt === usd0 || m.fmt === usdDay || m.money) return { tickprefix: '$' };
  return {};
}
const CFG = { responsive: true, displayModeBar: false };
// shaded years: only global, dated episodes, so a turn in a line can be read against them
// What was going on, for looking up beside a turn the data picked. These are never
// used to explain a move: see FOUNDATION.md section 4. `band` marks the four drawn
// as background shading on every time chart; the rest are lookup only.
const EVENTS = [
  { a: 1993, b: 1993, k: 'Maastricht, the EU formed', where: 'europe' },
  { a: 1995, b: 1995, k: 'the WTO founded', where: null },
  { a: 1997, b: 1998, k: 'the Asian financial crisis',
    where: ['IDN', 'KOR', 'MYS', 'THA', 'PHL', 'HKG', 'SGP', 'JPN'] },
  { a: 1999, b: 2002, k: 'the euro, then euro cash', where: 'eurozone' },
  { a: 2001, b: 2001, k: 'China joins the WTO', where: null },
  { a: 2003, b: 2005, k: 'the Hartz reforms', where: ['DEU'] },
  { a: 2004, b: 2004, k: 'EU enlargement',
    where: ['POL', 'CZE', 'HUN', 'SVK', 'SVN', 'EST', 'LVA', 'LTU', 'MLT', 'CYP'] },
  { a: 2007, b: 2009, k: 'the global financial crisis', where: null, band: 1 },
  { a: 2010, b: 2012, k: 'the euro debt crisis and the bailouts', where: 'eurozone', band: 1 },
  { a: 2011, b: 2012, k: 'the Arab Spring',
    where: ['TUN', 'EGY', 'LBY', 'SYR', 'YEM', 'BHR', 'MAR', 'JOR', 'DZA'] },
  { a: 2013, b: 2016, k: 'TTIP negotiated, then abandoned', where: 'ttip' },
  { a: 2016, b: 2020, k: 'the Brexit vote, then leaving', where: ['GBR'] },
  { a: 2017, b: 2017, k: 'the US tax act', where: ['USA'] },
  { a: 2018, b: 2019, k: 'the US and China tariffs', where: null },
  { a: 2020, b: 2021, k: 'covid', where: null, band: 1 },
  { a: 2022, b: 2022, k: 'Russia invades Ukraine', where: null },
];
const EUROZONE = 'AUT BEL CYP DEU ESP EST FIN FRA GRC HRV IRL ITA LTU LUX LVA MLT NLD PRT SVK SVN'.split(' ');
// how many years an event may have ended before a turn and still be worth naming
// beside it. a policy does not land on a distribution the year it passes.
const EVENT_LAG = 5;
function eventsNear(iso, a, b) {
  return EVENTS.filter(e => {
    if (e.where === 'europe') { if (regionOf(iso) !== 'europe') return false; }
    else if (e.where === 'eurozone') { if (!EUROZONE.includes(iso)) return false; }
    else if (e.where === 'ttip') { if (iso !== 'USA' && !EUROZONE.includes(iso) && iso !== 'GBR') return false; }
    else if (Array.isArray(e.where)) { if (!e.where.includes(iso)) return false; }
    // overlapping the stretch, or ending in the years just before it
    return (e.b >= a - EVENT_LAG) && (e.a <= b);
  });
}
const ERAS = [
  { a: 2000, b: 2002, k: 'dot-com bust' },
  { a: 2007, b: 2009, k: 'financial crisis' },
  { a: 2010, b: 2012, k: 'euro debt crisis' },
  { a: 2020, b: 2021, k: 'pandemic' },
];
// bands behind the lines, labelled once at the top, clipped to the years on screen
// A log axis counting multiples. Plotly's own log ticks land on bare powers of ten and
// leave most of this range unlabelled, so the ticks are named here in the unit the reader
// is reading: 10x, 50x, 1,000x.
function logMult(lo, hi, label) {
  const stops = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]
    .filter(v => v >= lo && v <= hi);
  return {
    type: 'log', range: [Math.log10(lo), Math.log10(hi)], autorange: false,
    tickmode: 'array', tickvals: stops,
    ticktext: stops.map(v => v.toLocaleString('en-US') + 'x'),
    title: { text: label, font: { size: 11 } },
  };
}
function eraShapes(lo, hi) {
  // plain rgba: Plotly writes this straight into an SVG fill, where color-mix does not land
  return ERAS.filter(e => e.b >= lo && e.a <= hi).map(e => ({
    type: 'rect', xref: 'x', yref: 'paper', layer: 'below',
    x0: Math.max(e.a, lo), x1: Math.min(e.b, hi), y0: 0, y1: 1,
    fillcolor: 'rgba(128,132,140,0.13)', line: { width: 0 },
  }));
}
function eraLabels(lo, hi) {
  return ERAS.filter(e => e.b >= lo && e.a <= hi).map((e, i) => ({
    // inside the plot, along the floor: a sticky chart title would sit on top of them
    x: (Math.max(e.a, lo) + Math.min(e.b, hi)) / 2, y: 0, xref: 'x', yref: 'paper',
    yanchor: 'bottom', yshift: i % 2 ? 18 : 5, text: e.k, showarrow: false,
    font: { size: 9.5, color: cssVar('--ink-3', '#999999') },
  }));
}
// pull the grid/axis/text colours from the live theme so charts go dark too
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
// which way a second line of the same facet should be shaded: toward white on a light
// page, toward black on a dark one, so the pair stays separable either way
// a y range at least `span` tall, centred on the data, or nothing if the data is taller
function minSpan(traces, span) {
  if (!span) return {};
  const ys = traces.flatMap(t => (t.y || []).filter(v => typeof v === 'number' && isFinite(v)));
  if (!ys.length) return {};
  const lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo >= span * 0.8) return {};
  // centred on the data, and never below zero for data that is never below zero
  let a = (lo + hi) / 2 - span / 2;
  if (lo >= 0 && a < 0) a = 0;
  return { range: [a, a + span], autorange: false };
}
// dots are drawn see-through so a dense cloud shows where it is dense. at 45% a blue dot
// on a near-black page all but disappeared, so on a dark page they are drawn more solid
function dotOp(o) { return isDark() ? Math.min(0.85, o + 0.3) : o; }
function isDark() {
  const a = document.documentElement.getAttribute('data-theme');
  return a === 'dark' || (!a && matchMedia('(prefers-color-scheme: dark)').matches);
}
function syncChartTheme() {
  const grid = cssVar('--grid', '#f0f0f0'), axis = cssVar('--axis', '#eaeaea'), font = cssVar('--ink-2', '#555555');
  BASE_LAYOUT.font.color = font;
  BASE_LAYOUT.xaxis.gridcolor = grid; BASE_LAYOUT.xaxis.linecolor = axis;
  BASE_LAYOUT.yaxis.gridcolor = grid; BASE_LAYOUT.yaxis.linecolor = axis;
}

function drawChart() {
  drawChartBody();
  syncSwatch();
}
// the colour a chart is mostly drawn in, snapped to the palette: the first saturated
// colour among its traces. a rose chart of life expectancy on the wealth face used to sit
// under a blue square, because the square followed the face rather than the chart
function syncSwatch() {
  const el = document.getElementById('chart'), t = document.getElementById('chart-title');
  if (!el || !t) return;
  const rgb = c => {
    if (typeof c !== 'string') return null;
    let m = c.match(/^#([0-9a-f]{6})$/i);
    if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
    m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
    if (m && (m[4] == null || +m[4] > 0.3)) return [+m[1], +m[2], +m[3]];
    return null;
  };
  const sat = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
  const PAL = Object.values(FACET_HEX).concat([metricColor('co2_pc')]);
  // a chart mixing faces (a US place's bars) takes the face it was asked on, when that
  // face's colour is in it; otherwise the first colour that is a colour and not a grey
  const all = (el.data || []).flatMap(tr => [tr.line && tr.line.color, tr.marker && tr.marker.color])
    .flatMap(x => Array.isArray(x) ? x : [x]).filter(c => typeof c === 'string').map(c => c.toLowerCase());
  const own = FACET_HEX[curFacet];
  let pick = own && all.includes(own) ? rgb(own) : null;
  if (!pick) for (const c of all) { const v = rgb(c); if (v && sat(v) > 0.12) { pick = v; break; } }
  if (!pick) { t.style.removeProperty('--swatch'); return; }
  const dist = h => { const v = rgb(h); return v.reduce((a, x, i) => a + (x - pick[i]) ** 2, 0); };
  t.style.setProperty('--swatch', PAL.reduce((a, h) => dist(h) < dist(a) ? h : a));
}
function drawChartBody() {
  syncChartTheme();
  const drawable = chain.slice().reverse().find(f => !f.noChart) || chain[chain.length - 1];
  const mode = drawable.mode;
  const el = document.getElementById('chart');
  const title = document.getElementById('chart-title');
  const src = document.getElementById('chart-src');

  el.style.height = '';   // only the owning-against-earning chart grows with its rows
  if (mode === 'opp') { drawOpp(drawable); return; }
  if (mode === 'owngap') {
    const og = drawable.owngap, rows = og.rows.slice().reverse();
    const hex = metricColor('wealth_top1');
    Plotly.react(el, [{ type: 'bar', orientation: 'h', y: rows.map(r => theName(r.iso)), x: rows.map(r => r.ratio),
      marker: { color: shadesOf(hex, rows.length) }, text: rows.map(r => `${roughly(r.ratio)}x`), textposition: 'outside',
      textfont: { size: 10, color: cssVar('--ink-2', '#555555') }, cliponaxis: false,
      hovertemplate: '%{y}: owning %{x:.0f} times as unequal as earning<extra></extra>' }],
      Object.assign({}, BASE_LAYOUT, { height: Math.max(318, 14 * rows.length + 60), margin: { t: 8, r: 56, b: 40, l: 140 },
        xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { type: 'log', title: { text: 'how many times wider the owning gap is (log scale)', font: { size: 11 } } }),
        yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { type: 'category', tickfont: { size: 10 } }),
        shapes: [{ type: 'line', x0: 1, x1: 1, y0: -0.5, y1: rows.length - 0.5, line: { color: cssVar('--ink-3', '#999'), width: 1, dash: 'dot' } }] }), CFG);
    el.style.height = Math.max(318, 14 * rows.length + 60) + 'px';
    title.textContent = `Owning against earning, ${og.set}`;
    src.textContent = 'Each bar is how many times wider the gap between the top 1% and the poorest half is in wealth than in income. ' +
      'The dotted line at 1 is where they would be equal; every bar is to the right of it. Source: WID, per adult, equal split.';
    return;
  }

  if (mode === 'bars') {
    const bar = chain.slice().reverse().find(f => f.mode === 'bars').bar;
    const rows = bar.rows.slice().reverse();
    const isDelta = bar.key === 'delta';
    const m = META[isDelta ? bar.metric : bar.key];
    const isPct = m.fmt === pc;
    // on a phone the bars get a third of the width, so the end labels drop their unit
    // (the axis title carries it) and the bars leave more room for them
    const narrow = el.clientWidth < 520;
    const vals = rows.map(r => isPct ? r.val * 100 : r.val);
    // room past the longest bar for its label, on whichever side the bars run
    const vLo = Math.min(0, ...vals), vHi = Math.max(0, ...vals), vPad = (vHi - vLo) * (narrow ? 0.42 : 0.2) || 1;
    const padded = [vLo < 0 ? vLo - vPad : 0, vHi > 0 ? vHi + vPad : 0];
    const labels = rows.map(r => isDelta
      ? (r.val >= 0 ? '+' : '-') + (narrow && isPct ? (Math.abs(r.val) * 100).toFixed(1) : m.fmtD(Math.abs(r.val)))
      : m.fmt(r.val));
    Plotly.react(el, [{
      type: 'bar', orientation: 'h',
      y: rows.map(r => r.geo_name),
      x: vals,
      marker: (() => {
        const mk = isDelta ? bar.metric : bar.key;
        const ramp = shadesOf(metricColor(mk), rows.length);
        const on = r => r.geo_id === bar.highlight;
        return {
          color: rows.map((r, i) => on(r) ? hlFill(mk) : ramp[i]),
          line: { color: rows.map(r => on(r) ? hlEdge() : 'rgba(0,0,0,0)'),
                  width: rows.map(r => on(r) ? 2 : 0) },
        };
      })(),
      text: labels,
      textposition: 'outside', textfont: { size: 11, color: cssVar('--ink-2', '#555555') },
      hovertemplate: '%{y}: %{text}<extra></extra>',
    }], Object.assign({}, BASE_LAYOUT, {
      margin: { t: 8, r: 70, b: 36, l: 150 },
      // a Gini sits on a fixed 0 to 1 axis; a share is already scaled to 0 to 100, so it
      // keeps its own range, wears the per-cent sign, and leaves room for the end labels
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis,
        isDelta ? Object.assign({ range: padded, autorange: false, zeroline: true, zerolinecolor: '#cfcfcf' },
            isPct ? { ticksuffix: narrow ? '' : ' pts', title: { text: 'change, percentage points', font: { size: 11 } } } : {})
          : isPct ? { ticksuffix: '%', range: padded, autorange: false }
          : m.giniFam ? { range: [0, 1.05], autorange: false }
          : Object.assign({ range: padded, autorange: false }, axisFmt(m))),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { type: 'category' }),
      bargap: 0.35,
    }), CFG);
    const hl = bar.highlight && BY_ISO[bar.highlight];
    if (isDelta) {
      title.textContent = `${bar.dir === 'up' ? 'Biggest rises' : 'Biggest falls'}${bar.note || ''}`;
      src.textContent = (META[bar.metric].poolSrc || '') + ' Change from the first year at or after the start year to the latest.';
    } else {
      const at = bar.atYear ? `, ${bar.atYear}` : ', latest year';
      title.textContent = `${cap(m.label)}${bar.note || ''}${at}` + (hl ? `, around ${hl.name}` : '');
      src.textContent = (bar.atYear
        ? `Source: WID. Each country at its nearest reading within ${POOL_YEAR_TOL} years of ${bar.atYear}; ` +
          `a country with nothing that close is not ranked.`
        : (m.poolSrc || 'Source: WID, latest available year per country.')) +
        ' ' + provenance([bar.key === 'delta' ? bar.metric : bar.key]);
    }
  }


  else if (mode === 'scatter') {
    const sc = chain.slice().reverse().find(f => f.mode === 'scatter').scatter;
    const mx = META[sc.x], my = META[sc.y];
    const scale = (m, v) => m.fmt === pc ? v * 100 : v;
    const labelSet = new Set([...(sc.labelIsos || []), ...sc.focus]);
    const focusSet = new Set(sc.focus);
    const bg = sc.pts.filter(p => !labelSet.has(p.iso));
    const named = sc.pts.filter(p => labelSet.has(p.iso));
    const mk = pts => ({ x: pts.map(p => scale(mx, p.x)), y: pts.map(p => scale(my, p.y)),
      text: pts.map(p => p.name), customdata: pts.map(p => [mx.fmt(p.x), my.fmt(p.y)]) });
    const traces = [{
      type: 'scatter', mode: 'markers', ...mk(bg),
      marker: { color: ACC(), size: 7, opacity: dotOp(0.42) },   // the face you're on owns the chart
      hovertemplate: '%{text}<br>' + mx.label + ': %{customdata[0]}<br>' + my.label + ': %{customdata[1]}<extra></extra>',
    }];
    if (sc.fit) {   // the robust line, drawn across the x-range
      const xs = sc.pts.map(p => p.x), lo = Math.min(...xs), hi = Math.max(...xs);
      traces.push({
        type: 'scatter', mode: 'lines', showlegend: false, hoverinfo: 'skip',
        x: [scale(mx, lo), scale(mx, hi)],
        y: [scale(my, sc.fit.slope * lo + sc.fit.intercept), scale(my, sc.fit.slope * hi + sc.fit.intercept)],
        line: { color: '#98a4b8', width: 1.5, dash: 'dash' },
      });
    }
    if (named.length) traces.push({
      type: 'scatter', mode: 'markers+text', ...mk(named),
      marker: { color: named.map(p => focusSet.has(p.iso) ? hlFill() : ACC()), size: 11,
        line: { color: named.map(p => focusSet.has(p.iso) ? hlEdge() : '#fff'),
                width: named.map(p => focusSet.has(p.iso) ? 2 : 1.5) } },
      textposition: 'top center', textfont: { size: 11, color: cssVar('--ink', '#1a2744') },
      hovertemplate: '%{text}<br>' + mx.label + ': %{customdata[0]}<br>' + my.label + ': %{customdata[1]}<extra></extra>',
    });
    Plotly.react(el, traces, Object.assign({}, BASE_LAYOUT, {
      margin: { t: 8, r: 12, b: 44, l: 56 },
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { title: { text: mx.label, font: { size: 12 } },
        ticksuffix: mx.fmt === pc ? '%' : '' }),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { title: { text: my.label, font: { size: 12 } },
        ticksuffix: my.fmt === pc ? '%' : '' }),
    }), CFG);
    title.textContent = (sc.fit ? `Who breaks the pattern: ${my.label} against ${mx.label}` :
      `${cap(my.label)} against ${mx.label}`) + (sc.region ? ` in ${REGION_LABEL[sc.region]}` : '');
    const yrs = sc.pts.filter(p => p.xYear && p.yYear);
    let pairNote = '';
    if (yrs.length) {
      const gaps = yrs.map(p => p.gap);
      const worst = Math.max(...gaps);
      const same = gaps.filter(g => g === 0).length;
      const xs2 = yrs.map(p => p.xYear), ys2 = yrs.map(p => p.yYear);
      pairNote = `Each dot pairs a country's latest ${mx.label} (${Math.min(...xs2)} to ${Math.max(...xs2)}) ` +
        `with its latest ${my.label} (${Math.min(...ys2)} to ${Math.max(...ys2)}). ` +
        (worst === 0 ? 'Every pair is from the same year. '
          : `${same} of ${yrs.length} pairs are from the same year; the widest gap is ${worst} years. `);
    }
    src.textContent = (sc.fit ? 'Dashed line is a robust (Theil-Sen) fit; labelled countries sit furthest from it. ' : '') +
      pairNote + provenance([sc.x, sc.y]) + ' ' +
      `${(mx.poolSrc || '').replace(/^Source: /, 'Inequality: ')} ${(my.poolSrc || '').replace(/^Source: /, 'Aspect: ')}`;
  }

  else if (mode === 'contrast') {
    const c = chain.slice().reverse().find(f => f.mode === 'contrast').contrast;
    const my = META[c.y], scy = v => my.fmt === pc ? v * 100 : v;
    const wPctAxis = c.wealthLens === 'wealth_top1';   // (legacy) top 1% share plots as a percent
    const foc = new Set(c.focus);
    const panel = (pts, xaxis, color, sx) => {
      const bg = pts.filter(p => !foc.has(p.iso)), fg = pts.filter(p => foc.has(p.iso));
      const mk = (a, hl) => ({ type: 'scatter', mode: hl ? 'markers+text' : 'markers', xaxis, yaxis: 'y',
        x: a.map(p => sx(p.x)), y: a.map(p => scy(p.y)), text: a.map(p => hl ? p.name : ''),
        customdata: a.map(p => p.name), textposition: 'top center', textfont: { size: 10, color: cssVar('--ink', '#1a2744') },
        marker: { color: hl ? hlFill() : color, size: hl ? 10 : 6, opacity: hl ? 1 : 0.55,
          line: hl ? { color: hlEdge(), width: 2 } : {} },
        hovertemplate: '%{customdata}<br>%{x:.2f} · ' + my.label + ' %{y}<extra></extra>', showlegend: false });
      return fg.length ? [mk(bg, false), mk(fg, true)] : [mk(bg, false)];
    };
    const isGdp = c.wealthLens === 'gdp_pc';
    const traces = [...panel(c.wPts, 'x', ACC(), wPctAxis ? (v => v * 100) : (v => v)), ...panel(c.iPts, 'x2', '#98a4b8', v => v)];
    const rTxt = (r, dom) => ({ x: dom, y: 1.06, xref: 'paper', yref: 'paper', xanchor: 'center',
      text: r == null ? '' : `r = ${r.toFixed(2)}`, showarrow: false, font: { size: 12, color: cssVar('--ink', '#1a2744') } });
    const wLabel = isGdp ? 'GDP per person' : wPctAxis ? 'top 1% wealth share' : 'wealth Gini';
    Plotly.react(el, traces, Object.assign({}, BASE_LAYOUT, {
      margin: { t: 24, r: 10, b: 42, l: 52 },
      annotations: [rTxt(c.rW, 0.23), rTxt(c.rI, 0.80)],
      xaxis: { domain: [0, 0.46], type: c.wLog ? 'log' : 'linear', autorange: true, gridcolor: '#f0f0f0', zeroline: false, linecolor: '#eaeaea', ticksuffix: wPctAxis ? '%' : '', tickprefix: isGdp ? '$' : '', title: { text: wLabel, font: { size: 12 } } },
      xaxis2: { domain: [0.54, 1], type: 'linear', autorange: true, gridcolor: '#f0f0f0', zeroline: false, linecolor: '#eaeaea', title: { text: 'income Gini', font: { size: 12 } } },
      yaxis: { type: 'linear', autorange: true, gridcolor: '#f0f0f0', zeroline: false, linecolor: '#eaeaea', title: { text: my.label, font: { size: 12 } }, ticksuffix: my.fmt === pc ? '%' : '' },
    }), CFG);
    title.textContent = `${cap(my.label)}, against ${isGdp ? 'prosperity' : wPctAxis ? 'the top 1% wealth share' : 'wealth inequality'} and income` + (c.region ? ` (${REGION_LABEL[c.region]})` : '');
    src.textContent = isGdp
      ? `One country per dot. Left: against GDP per person (log scale), a level of prosperity, the national twin of local home values. Right: against income Gini. GDP: OWID. Income: World Bank PIP.`
      : `One country per dot: the same measure against the top 1% wealth share on the left, income on the right. Income Gini: World Bank PIP.`;
  }

  else if (mode === 'divergence') {
    const dv = chain.slice().reverse().find(f => f.mode === 'divergence').diverge;
    const hi = Math.max(dv.w[dv.w.length - 1].year, dv.i[dv.i.length - 1].year);
    const top = Math.max(...dv.w.map(d => d.v), ...dv.i.map(d => d.v));
    Plotly.react(el, [
      { type: 'scatter', mode: 'lines', name: 'of all wealth',
        x: dv.w.map(d => d.year), y: dv.w.map(d => d.v),
        line: { color: metricColor('wealth_top1'), width: 2.8, shape: 'linear' },
        hovertemplate: 'the top 1% own %{y:.1%} of all wealth<extra></extra>' },
      { type: 'scatter', mode: 'lines', name: 'of all income',
        x: dv.i.map(d => d.year), y: dv.i.map(d => d.v),
        line: { color: metricColor('income_top1'), width: 2.8, shape: 'linear' },
        hovertemplate: 'the top 1% take %{y:.1%} of all income<extra></extra>' },
    ], Object.assign({}, BASE_LAYOUT, {
      showlegend: true, legend: { orientation: 'h', y: 1.18, font: { size: 11 } },
      margin: { t: 14, r: 16, b: 40, l: 54 },
      shapes: eraShapes(dv.lo, hi), annotations: eraLabels(dv.lo, hi),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { range: [0, top * 1.14], autorange: false,
        tickformat: '.0%', title: { text: 'share taken by the top 1%', font: { size: 11 } } }),
    }), CFG);
    title.textContent = `${BY_ISO[dv.iso].name}: the same top 1%, ${dv.lo} to ${hi}`;
    src.textContent =
      `Levels, not an index: two shares of the same kind of total on one axis, so they can be read ` +
      `against each other directly. Indexing them would mislead, because a share already high has ` +
      `little room left to move. Both lines are WID, pretax national income and household net ` +
      `wealth, per adult with each split equally within the couple. They stop in different years: ` +
      `wealth runs to ${dv.w[dv.w.length - 1].year}, income to ${dv.i[dv.i.length - 1].year}. ` +
      provenance(['wealth_top1', 'income_top1']);
  }

  else if (mode === 'reach') {
    const rc = chain.slice().reverse().find(f => f.mode === 'reach').reach;
    const idx = (arr, k) => arr.map(d => d.v / arr[0].v * 100);
    const lastY = Math.max(rc.gs[rc.gs.length - 1].year, rc.ms[rc.ms.length - 1].year);
    // put the median on the same years as output so the space between them can be filled
    const mi = idx(rc.ms), mY = rc.ms.map(d => d.year);
    const at = y => {
      if (y <= mY[0]) return mi[0];
      if (y >= mY[mY.length - 1]) return mi[mi.length - 1];
      for (let i = 1; i < mY.length; i++) if (mY[i] >= y) {
        const t = (y - mY[i - 1]) / (mY[i] - mY[i - 1]);
        return mi[i - 1] + (mi[i] - mi[i - 1]) * t;
      }
      return mi[mi.length - 1];
    };
    const gYears = rc.gs.map(d => d.year).filter(y => y <= mY[mY.length - 1]);
    Plotly.react(el, [
      { type: 'scatter', mode: 'lines', name: 'the income in the middle', showlegend: false,
        x: gYears, y: gYears.map(at), line: { width: 0 }, hoverinfo: 'skip' },
      { type: 'scatter', mode: 'lines', name: 'the gap', showlegend: false,
        x: gYears, y: gYears.map(y => idx(rc.gs)[rc.gs.findIndex(d => d.year === y)]),
        line: { width: 0 }, fill: 'tonexty',
        // plain rgba: Plotly writes this into an SVG fill, where color-mix does not
        // land and it silently falls back to its own default palette instead
        fillcolor: rc.houses ? 'rgba(42,120,214,0.13)' : 'rgba(47,158,143,0.15)', hoverinfo: 'skip' },
      { type: 'scatter', mode: 'lines', name: (rc.labels && rc.labels.top) || 'output per person',
        x: rc.gs.map(d => d.year), y: idx(rc.gs),
        line: { color: metricColor(rc.houses ? 'house_price' : 'gdp_pc'), width: 2.6, shape: 'linear' } },
      { type: 'scatter', mode: rc.ms.length < 12 ? 'lines+markers' : 'lines', name: (rc.labels && rc.labels.mid) || 'the income in the middle',
        x: rc.ms.map(d => d.year), y: mi,
        // both sides are income, so both wear the income colour, a step apart
        line: { color: shade(metricColor('median_income'), 0.42), width: 2.6, shape: 'linear' },
        marker: { size: 6 } },
    ], Object.assign({}, BASE_LAYOUT, {
      showlegend: true, legend: { orientation: 'h', y: 1.18, font: { size: 11 } },
      margin: { t: 14, r: 16, b: 40, l: 52 },
      shapes: eraShapes(rc.base, lastY), annotations: eraLabels(rc.base, lastY),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { title: { text: `indexed to ${rc.base} = 100`, font: { size: 11 } } }),
    }), CFG);
    title.textContent = rc.houses
      ? `${cap(theName(rc.iso))}: houses and pay, since ${rc.base}`
      : `${cap(theName(rc.iso))}: the economy and the middle, since ${rc.base}`;
    src.textContent = rc.houses
      ? `Both after inflation and both starting at 100, so what matters is how far apart they get. ` +
        `Houses are the OECD real house price index. Pay is median household income from the World Bank, after ` +
        `transfers, which is not the individual earnings figure the usual house-price-to-earnings ratio ` +
        `uses: same direction, smaller gap. Markers show where a survey landed; the line between them is ` +
        `drawn, not measured. ` + provenance(['house_price', 'median_income'])
      : `Both indexed to ${rc.base} = 100, so the gap between them is the answer. ` +
      (rc.hour
        ? `Output per hour worked is the OECD's, in 2020 dollars, from national accounts; the median is ` +
          `a household survey in 2017 purchasing power dollars. Per hour is the like for like side of the ` +
          `productivity and pay argument, but the two still come from different collectors, so the shape ` +
          `of the gap is the reading and the exact percentages are not. `
        : `These are not like for like. Output per person is the Maddison Project series in international ` +
          `dollars at 2011 prices, built from national accounts; the median is a household survey in 2017 ` +
          `purchasing power dollars. Different base years, different definitions, different collectors. ` +
          `Indexing is what lets them share an axis at all, and it is why the shape of the gap is the ` +
          `reading and the exact percentages are not. `) +
      `Markers show where a survey actually landed; the line between them is drawn, not measured. ` +
      provenance([rc.hour ? 'gdp_hour' : 'gdp_pc', 'median_income']);
  }

  else if (mode === 'have') {
    const hv = chain.slice().reverse().find(f => f.mode === 'have').have;
    // A linear axis, deliberately. On a log scale the poorest quarter would climb the
    // picture and the two years it held nothing would vanish, because nought has no
    // logarithm. Drawn straight, its line lies on the axis, which is the reading.
    const ramp = shadesOf(metricColor('wealth_top1'), Math.max(2, hv.rows.length));
    const lows = hv.rows[0];
    Plotly.react(el, hv.rows.map((r, k) => ({
      type: 'scatter', mode: 'lines+markers', name: r.lab,
      x: hv.years, y: r.series,
      line: { color: ramp[k], width: 2.4 }, marker: { size: 6 },
      hovertemplate: r.lab + ': $%{y:,.0f}k in %{x}<extra></extra>',
    })).concat(hv.zeros.length ? [{
      type: 'scatter', mode: 'markers', showlegend: false,
      x: hv.zeros, y: hv.zeros.map(() => 0),
      marker: { size: 10, color: hlFill('wealth_top1'), line: { color: hlEdge(), width: 2 } },
      hovertemplate: 'nothing at all, %{x}<extra></extra>',
    }] : []), Object.assign({}, BASE_LAYOUT, {
      showlegend: true, legend: { orientation: 'h', y: 1.2, font: { size: 10.5 } },
      margin: { t: 48, r: 22, b: 42, l: 72 },
      annotations: hv.zeros.length ? [{
        x: hv.zeros[hv.zeros.length - 1], y: 0, ax: 18, ay: -34, showarrow: true,
        arrowhead: 0, arrowwidth: 1, arrowcolor: cssVar('--ink-3', '#9aa3ad'),
        text: 'nothing at all', xanchor: 'left',
        font: { size: 10.5, color: cssVar('--ink-2', '#555555') },
      }] : [],
      shapes: eraShapes(hv.years[0], hv.years[hv.years.length - 1]),
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { tickmode: 'array', tickvals: hv.years,
        tickangle: -40, tickfont: { size: 10 },
        title: { text: 'survey year', font: { size: 11 } } }),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { rangemode: 'tozero',
        tickprefix: '$', ticksuffix: 'k',
        title: { text: 'net worth of the family in the middle', font: { size: 11 } } }),
    }), CFG);
    title.textContent = `What an American family actually has, ${hv.years[0]} to ${hv.years[hv.years.length - 1]}`;
    src.textContent =
      `Each line is the family in the middle of its quarter of the country, not what the quarter ` +
      `holds between them, so every point is one household and the lines can be read against each ` +
      `other. Net worth is everything owned less everything owed. ` +
      `The axis is straight rather than logarithmic on purpose: the poorest quarter's line lies ` +
      `along the bottom at ${lows.net >= 1 ? '$' + Math.round(lows.net * 1000).toLocaleString('en-US') : 'almost nothing'} ` +
      `in ${hv.year}, and against the richest tenth that is what it looks like. ` +
      (hv.zeros.length ? `The marked years are measurements of nought, not missing readings: the ` +
        `middle of the poorest quarter owed exactly what it owned in ` +
        `${hv.zeros.join(' and ')}. ` : '') +
      `Thousands of dollars in the money of the latest survey, so the run reads straight down. ` +
      `Triennial. One country: no other publishes a household balance sheet on this run of years. ` +
      `Source: Federal Reserve Survey of Consumer Finances, bulletin chart tables.`;
  }

  else if (mode === 'weather') {
    const we = chain.slice().reverse().find(f => f.mode === 'weather').weather;
    const LAB = { w_bottom20: 'the poorest fifth', w_20_40: 'the second fifth',
      w_40_60: 'the middle fifth', w_60_80: 'the fourth fifth',
      w_80_90: 'the next tenth', w_90_100: 'the richest tenth' };
    // one ramp, poorest darkest, because the bands are ordered and the order is the point
    const ramp = shadesOf(metricColor('wealth_top1'), Math.max(2, we.lines.length)).slice().reverse();
    Plotly.react(el, we.lines.map((d, k) => ({
      type: 'scatter', mode: 'lines+markers', name: LAB[d.k] || d.k,
      x: we.waves, y: d.vals, connectgaps: true,
      line: { color: ramp[k], width: 2.4 }, marker: { size: 7 },
      hovertemplate: (LAB[d.k] || d.k) + ': %{y:.0f}% with nothing left over, %{x} wave<extra></extra>',
    })), Object.assign({}, BASE_LAYOUT, {
      showlegend: true, legend: { orientation: 'h', y: 1.2, font: { size: 10.5 } },
      margin: { t: 48, r: 22, b: 42, l: 56 },
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { tickmode: 'array', tickvals: we.waves,
        ticktext: we.waves.map(String), title: { text: 'survey wave', font: { size: 11 } } }),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { ticksuffix: '%', rangemode: 'tozero',
        title: { text: 'households with nothing left over', font: { size: 11 } } }),
    }), CFG);
    title.textContent = (we.iso ? cap(theName(we.iso)) : 'The euro area') +
      ': households with nothing left over, by wealth';
    src.textContent =
      `The survey asks whether regular expenses over the last twelve months came to less than ` +
      `income. This draws the households it did not: expenses level with income or above it. ` +
      `Fifths are by net wealth, not by income, which is the cut this atlas thinks in and not ` +
      `the one a pay statistic would use. ` +
      (we.help != null ? `Raising money in an emergency is a separate question the survey asks ` +
        `about friends and relatives, and credit refused counts only the households that went ` +
        `looking for it, so neither is drawn here. ` : '') +
      `Lines join four waves and nothing between them was measured. ` +
      (HFCS_RES && HFCS_RES.note ? HFCS_RES.note + ' ' : '') +
      `Source: ECB Household Finance and Consumption Survey, statistical tables G2, G3 and H1.`;
  }

  else if (mode === 'underwater') {
    const uw = chain.slice().reverse().find(f => f.mode === 'underwater').underwater;
    const LAB = {
      own_outright: 'owns it outright', own_mortgage: 'owns it, with a mortgage',
      renting: 'renting, or neither', age_16_34: 'under 35', age_35_44: '35 to 44',
      age_45_54: '45 to 54', age_55_64: '55 to 64', age_65_74: '65 to 74', age_75_plus: '75 and over',
    };
    // two cuts of the same households, kept apart by colour because they are not one
    // scale: a renter of 30 is counted in both bars
    const HOUSE = shade(metricColor('house_price'), 0.20);
    const AGE = shade(metricColor('life_exp'), -0.10);
    const rows = uw.cuts.slice().reverse();       // housing at the top, oldest at the foot
    Plotly.react(el, [{
      type: 'bar', orientation: 'h',
      y: rows.map(d => LAB[d.k] || d.k), x: rows.map(d => d.v),
      marker: { color: rows.map(d => d.k.slice(0, 3) === 'age' ? AGE : HOUSE) },
      // a bar that rounds to nought is not a measurement of nought
      text: rows.map(d => d.v < 0.05 ? '<0.1%' : d.v.toFixed(1) + '%'),
      textposition: 'outside', textfont: { size: 11, color: cssVar('--ink-2', '#555555') },
      hovertemplate: '%{y}: %{x:.1f}% own less than nothing<extra></extra>',
    }], Object.assign({}, BASE_LAYOUT, {
      margin: { t: 28, r: 70, b: 40, l: 158 },
      shapes: [{ type: 'line', x0: uw.all, x1: uw.all, yref: 'paper', y0: 0, y1: 1,
        line: { color: cssVar('--ink-3', '#9aa3ad'), width: 1, dash: 'dot' } }],
      annotations: [{ x: uw.all, yref: 'paper', y: 1.045, showarrow: false, xanchor: 'left',
        text: `  every household, ${uw.all.toFixed(1)}%`,
        font: { size: 10.5, color: cssVar('--ink-3', '#9aa3ad') } }],
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { ticksuffix: '%', autorange: false,
        range: [0, Math.max(...rows.map(d => d.v)) * 1.16],   // room for the end labels
        title: { text: 'share of that kind of household owning less than nothing', font: { size: 12 } } }),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { type: 'category' }),
      bargap: 0.3,
    }), CFG);
    title.textContent = (uw.iso ? cap(theName(uw.iso)) : 'The euro area') +
      `: who owes more than they own, ${uw.wave} wave`;
    src.textContent =
      `A household is counted here when its debts come to more than everything it holds, the ` +
      `house included. The two blocks are two cuts of the same households, not a sequence: a ` +
      `renter of thirty is in both. The dotted line is every household taken together, ` +
      `${uw.all.toFixed(1)}%. ` +
      `This is a survey of households and the shares elsewhere on this face divide a national ` +
      `total per adult, so the two are not versions of one number` +
      (uw.rho != null ? ` and do not behave like it: across the ${uw.paired} countries with both, ` +
        `their rank correlation is ${uw.rho.toFixed(2)}` : '') + `. ` +
      `Waves are named ${uw.waves[0]} to ${uw.waves[uw.waves.length - 1]} and the fieldwork behind ` +
      `each ran in different years in different countries, so a wave is a label rather than a ` +
      `date. The countries covered change between waves, which moves the euro-area figure as ` +
      `well as the country ones. The source marks country-specific comparability issues for ` +
      `most members and reports some cells as too few observations to give, which are left out ` +
      `here rather than drawn as zero. ` +
      `Source: ECB Household Finance and Consumption Survey, statistical table F3.`;
  }

  else if (mode === 'made') {
    const md = chain.slice().reverse().find(f => f.mode === 'made').made;
    const rows = md.rows.slice().reverse();     // poorest at the top of the picture
    // Six bands need six colours a reader can tell apart, and the facet palette has four
    // hues of which house_price and wealth_top1 are the same blue, so taking one per
    // measure put three indistinguishable blues in one bar. Two hues, grouped by what the
    // thing is: blue for what you can live in or drive, teal for a claim on someone's
    // earnings, grey for the deposits and bonds that are neither.
    const BLUE = metricColor('wealth_top1'), TEAL = metricColor('income_top1');
    const PART = [
      ['real_estate', 'the house',                shade(BLUE, 0.34)],
      ['durables',    'the car and the furniture', shade(BLUE, -0.30)],
      ['pensions',    'a pension',                shade(TEAL, -0.36)],
      ['equities',    'shares',                   shade(TEAL, 0.32)],
      ['business',    'a business',               shade(TEAL, -0.02)],
      ['other',       'deposits and bonds',       '#9aa3ad'],
    ];
    Plotly.react(el, PART.map(([k, name, colour]) => ({
      type: 'bar', orientation: 'h', name,
      y: rows.map(r => r.lab), x: rows.map(r => r.part[k] * 100),
      marker: { color: colour },
      hovertemplate: '%{y} &middot; ' + name + ': %{x:.0f}% of what they own<extra></extra>',
    })), Object.assign({}, BASE_LAYOUT, {
      barmode: 'stack', showlegend: true,
      // six entries wrap to two rows, so the legend needs the room above the first bar
      legend: { orientation: 'h', y: 1.16, font: { size: 10.5 }, traceorder: 'normal' },
      margin: { t: 54, r: 20, b: 38, l: 152 },
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { ticksuffix: '%', range: [0, 100], autorange: false,
        title: { text: 'share of what that group owns', font: { size: 12 } } }),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { type: 'category' }),
      bargap: 0.34,
    }), CFG);
    title.textContent = `What American wealth is made of, ${md.year}`;
    src.textContent =
      `Each bar is one wealth group and the bands are what that group's assets are, not how ` +
      `much they come to. Every bar is the same length` +
      (md.gap ? `, and ${md.hiLab} holds about ${roughly(md.gap)} times as much per household as ` +
        `${md.loLab} does` : '') +
      `. Debt is left out of the bars and ` +
      `given in the sentence, because it is owed against the assets rather than being one of ` +
      `them: ${md.rows.map(r => `${r.lab} ${(r.debt * 100).toFixed(0)}c`).join(', ')} per dollar ` +
      `of assets. Shares held inside a pension are counted under the pension, not under shares, ` +
      `which is why the middle's pension band is large and its share band is not. Groups overlap: ` +
      `the richest tenth contains the richest 1% contains the richest thousandth. ` +
      `Source: Federal Reserve Distributional Financial Accounts, ${md.years[0]} to ` +
      `${md.years[md.years.length - 1]}, current dollars. One country: no other publishes assets ` +
      `and debts split by wealth group on a run of years.`;
  }

  else if (mode === 'owns') {
    const ow = chain.slice().reverse().find(f => f.mode === 'owns').owns;
    const zero = ow.b.some(d => d.v < 0);
    Plotly.react(el, [
      { type: 'scatter', mode: 'lines', name: 'the richest 1%',
        x: ow.t.map(d => d.year), y: ow.t.map(d => d.v),
        line: { color: shade(metricColor('wealth_top1'), 0.30), width: 2.8, shape: 'linear' },
        hovertemplate: 'the richest 1% hold %{y:.1%}, %{x}<extra></extra>' },
      { type: 'scatter', mode: 'lines', name: 'the poorest half',
        x: ow.b.map(d => d.year), y: ow.b.map(d => d.v),
        line: { color: shade(metricColor('wealth_top1'), -0.34), width: 2.8, shape: 'linear' },
        hovertemplate: 'the poorest half hold %{y:.1%}, %{x}<extra></extra>' },
    ], Object.assign({}, BASE_LAYOUT, {
      showlegend: true, legend: { orientation: 'h', y: 1.18, font: { size: 11 } },
      margin: { t: 14, r: 16, b: 40, l: 56 },
      shapes: eraShapes(ow.lo, ow.hi), annotations: eraLabels(ow.lo, ow.hi),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { tickformat: '.0%',
        zeroline: zero, zerolinecolor: cssVar('--ink-2', '#555555'), zerolinewidth: 1,
        title: { text: 'share of all household wealth', font: { size: 11 } } }),
    }), CFG);
    title.textContent = `${cap(theName(ow.iso))}: what one per cent owns and what half of it owns, ${ow.lo} to ${ow.hi}`;
    src.textContent =
      `Two shares of one total, drawn as levels rather than indexed, so the distance between the ` +
      `lines is the reading. The upper line covers one per cent of adults and the lower line covers ` +
      `fifty per cent of them, which is why the distance understates what it looks like: to compare ` +
      `people rather than groups, ask for one person against one person. ` +
      (zero ? 'The lower line crosses zero because debts count against assets: below that mark the ' +
        'poorest half owes more than it owns. ' : '') +
      provenance(['wealth_top1', 'wealth_bottom50']);
  }

  else if (mode === 'wmultiple') {
    const wm = chain.slice().reverse().find(f => f.mode === 'wmultiple').wmultiple;
    const pts = wm.all.both;
    const lo = Math.min(...pts.map(p => Math.min(p.im, p.wm))) * 0.8;
    const hi = Math.max(...pts.map(p => Math.max(p.im, p.wm))) * 1.9;   // room for the label above the top dot
    const here = pts.find(p => p.iso === wm.iso);
    Plotly.react(el, [
      { type: 'scatter', mode: 'lines', name: 'the two gaps equal', showlegend: false,
        x: [lo, hi], y: [lo, hi], line: { color: cssVar('--axis', '#cbd5e1'), width: 1, dash: 'dash' },
        hoverinfo: 'skip' },
      { type: 'scatter', mode: 'markers', showlegend: false,
        x: pts.map(p => p.im), y: pts.map(p => p.wm), text: pts.map(p => BY_ISO[p.iso].name),
        marker: { color: metricColor('wealth_top1'), size: 7, opacity: dotOp(0.45) },
        hovertemplate: '%{text}<br>earning gap %{x:.0f}x<br>owning gap %{y:.0f}x<extra></extra>' },
    ].concat(here ? [{ type: 'scatter', mode: 'markers+text', showlegend: false,
        x: [here.im], y: [here.wm], text: [BY_ISO[here.iso].name], textposition: 'top center',
        textfont: { size: 11 },
        marker: { size: 12, color: hlFill('wealth_top1'), line: { color: hlEdge(), width: 2 } },
        hovertemplate: '%{text}<br>earning gap %{x:.0f}x<br>owning gap %{y:.0f}x<extra></extra>' }] : []),
      Object.assign({}, BASE_LAYOUT, {
      margin: { t: 16, r: 18, b: 48, l: 76 },
      // a country whose poorest half owes cannot be plotted here at all, and a reader
      // looking for it should be told that on the picture rather than only underneath it
      annotations: here ? [] : [{
        xref: 'paper', yref: 'paper', x: 0.5, y: 0.06, showarrow: false,
        text: `${esc(theName(wm.iso))} is not on this chart: the poorest half there owes more than it owns, ` +
          `so the gap in owning has no value to plot`,
        font: { size: 11, color: cssVar('--ink-2', '#555555') },
        bgcolor: cssVar('--card', '#ffffff'), borderpad: 4,
      }],
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, logMult(lo, hi, 'earning gap, times')),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, logMult(lo, hi, 'owning gap, times')),
    }), CFG);
    title.textContent = 'The gap in owning against the gap in earning, one dot per country';
    src.textContent =
      `Each dot is one country. Across, what one person in the top 1% earns against one person in the ` +
      `poorest half. Up, what one of them owns against one of them. On the dashed line the two gaps ` +
      `would be the same size; ` +
      (wm.all.wider === wm.all.both.length ? 'every country sits above it'
        : `${wm.all.wider} of the ${wm.all.both.length} sit above it`) +
      `. Both axes count in multiples and both run ` +
      `on a logarithmic scale, because the owning gap is an order of magnitude larger and a straight ` +
      `scale would flatten every country into the corner. ` +
      (wm.all.owing.length
        ? `${wm.all.owing.length} more ${wm.all.owing.length === 1 ? 'country is' : 'countries are'} ` +
          `missing from this picture entirely: ` +
          wm.all.owing.map(p => BY_ISO[p.iso].name).join(', ') +
          `, where the poorest half owes more than it owns and the owning gap has no value. `
        : '') +
      `Wealth and income shares stop in different years, so each country is drawn at its own latest ` +
      `reading of each. ` +
      provenance(['wealth_top1', 'wealth_bottom50', 'income_top1', 'income_bottom50']);
  }

  else if (mode === 'multiple') {
    const mu = chain.slice().reverse().find(f => f.mode === 'multiple').multiple;
    const lo = mu.pts[0].year, hi = mu.pts[mu.pts.length - 1].year;
    Plotly.react(el, [
      { type: 'scatter', mode: 'lines', showlegend: false,
        x: mu.pts.map(d => d.year), y: mu.pts.map(d => d.v),
        line: { color: metricColor('income_top1'), width: 2.8, shape: 'linear' },
        hovertemplate: '%{y:.0f} times, %{x}<extra></extra>' },
      { type: 'scatter', mode: 'markers', showlegend: false,
        x: [mu.then.year, mu.last.year], y: [mu.then.v, mu.last.v],
        marker: { size: 10, color: hlFill('income_top1'), line: { color: hlEdge(), width: 2 } },
        hovertemplate: '%{y:.0f} times, %{x}<extra></extra>' },
    ], Object.assign({}, BASE_LAYOUT, {
      margin: { t: 14, r: 16, b: 40, l: 56 },
      shapes: eraShapes(lo, hi), annotations: eraLabels(lo, hi),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { rangemode: 'tozero',
        ticksuffix: 'x', title: { text: 'times as much, per person', font: { size: 11 } } }),
    }), CFG);
    title.textContent = `${cap(theName(mu.iso))}: one person at the top against one at the bottom, ${lo} to ${hi}`;
    src.textContent =
      `The top 1% take a share of all income and so does the bottom 50%, but one group is fifty ` +
      `times the size of the other, so the two shares cannot be compared as they stand. Each is ` +
      `divided here by the fraction of adults it covers, which turns both into an income per person ` +
      `and makes the division mean something. Pretax national income, before tax and before any ` +
      `benefit, per adult with income split equally inside a couple. The two marked years are the ` +
      `last reading up to 1980 and the last reading there is. ` +
      provenance(['income_top1', 'income_bottom50']);
  }

  else if (mode === 'basket') {
    const bk = chain.slice().reverse().find(f => f.mode === 'basket').basket;
    const lo = bk.pts[0].year, hi = bk.pts[bk.pts.length - 1].year;
    Plotly.react(el, [
      { type: 'scatter', mode: bk.pts.length < 30 ? 'lines+markers' : 'lines', showlegend: false,
        x: bk.pts.map(d => d.year), y: bk.pts.map(d => d.v),
        line: { color: metricColor('median_income'), width: 2.8, shape: 'linear' },
        marker: { size: 6 },
        hovertemplate: '$%{y:.2f} a day, %{x}<extra></extra>' },
    ], Object.assign({}, BASE_LAYOUT, {
      margin: { t: 14, r: 16, b: 40, l: 60 },
      shapes: eraShapes(lo, hi), annotations: eraLabels(lo, hi),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { rangemode: 'tozero', tickprefix: '$',
        title: { text: 'a day, 2017 purchasing power dollars', font: { size: 11 } } }),
    }), CFG);
    title.textContent = `${cap(theName(bk.iso))}: what the person in the middle lives on, ${lo} to ${hi}`;
    src.textContent =
      `Household income after tax and after benefits, divided across the people in the household, ` +
      `with the middle person taken. It is priced in 2017 purchasing power dollars, which means the ` +
      `same basket of goods costs the same number of dollars in every country on this measure, so a ` +
      `day in Warsaw and a day in Chicago are being counted the same way. Each marker is one survey; ` +
      `the line between two markers is drawn, not measured, and surveys are years apart in most ` +
      `countries. The ranking holds ${bk.at} against the ${bk.of} countries with a survey within ` +
      `three years of it, rather than against whatever year each country last reported, which would ` +
      `set one country's ${bk.at} beside another's 2011. ` +
      provenance(['median_income']);
  }

  else if (mode === 'three') {
    const th = chain.slice().reverse().find(f => f.mode === 'three').three;
    const band = [
      ['the top 10%', th.t, 'income_top10', 0.30],
      ['the middle 40%', th.m, 'income_middle40', 0.0],
      ['the bottom 50%', th.b, 'income_bottom50', -0.34],
    ];
    Plotly.react(el, band.map(([name, ser, key, tone]) => ({
      type: 'scatter', mode: 'lines', name,
      x: ser.map(d => d.year), y: ser.map(d => d.v),
      line: { color: shade(metricColor(key), tone), width: 2.6, shape: 'linear' },
      hovertemplate: name + ' take %{y:.1%} of all income, %{x}<extra></extra>',
    })).concat([
      // the two years the sentence quotes, marked on the middle, so the words and the
      // picture are visibly the same reading
      { type: 'scatter', mode: 'markers', showlegend: false,
        x: [th.from, th.hi],
        y: [th.from, th.hi].map(y => { const q = th.m.filter(d => d.year <= y); return (q.length ? q[q.length - 1] : th.m[0]).v; }),
        marker: { size: 10, color: hlFill('income_middle40'), line: { color: hlEdge(), width: 2 } },
        hovertemplate: 'the middle 40% take %{y:.1%}, %{x}<extra></extra>' },
    ]), Object.assign({}, BASE_LAYOUT, {
      showlegend: true, legend: { orientation: 'h', y: 1.18, font: { size: 11 } },
      margin: { t: 14, r: 16, b: 40, l: 54 },
      shapes: eraShapes(th.lo, th.hi), annotations: eraLabels(th.lo, th.hi),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { rangemode: 'tozero', tickformat: '.0%',
        title: { text: 'share of all income', font: { size: 11 } } }),
    }), CFG);
    title.textContent = `${cap(theName(th.iso))} in three parts, ${th.lo} to ${th.hi}`;
    src.textContent =
      `The country cut into the richest tenth, the forty per cent underneath them, and the poorer ` +
      `half. The three add to a hundred at every point, so whenever one line rises another has to ` +
      `fall, and the question of who gained is the same question as who lost. Pretax national ` +
      `income, before tax and before any benefit, per adult with income split equally inside a ` +
      `couple. The three start in different years in some countries; the run drawn here is the ` +
      `stretch all three cover. ` +
      provenance(['income_top10', 'income_middle40', 'income_bottom50']);
  }

  else if (mode === 'ratio') {
    const rt = chain.slice().reverse().find(f => f.mode === 'ratio').ratio;
    // The countries where the poorest half owes more than it owns are always drawn, not
    // only when one of them is the country asked about. They are the far end of this
    // scale, and a picture that stops where the scale turns negative hides the end of it.
    const owing = (rt.owing || []).slice();
    let top = rt.rows.slice(0, Math.max(6, 12 - owing.length));
    if (rt.highlight && !top.some(r => r.geo_id === rt.highlight)) {
      const h = rt.rows.find(r => r.geo_id === rt.highlight);
      if (h) top = top.slice(0, -1).concat([h]);
    }
    // most concentrated at the top of the picture, the countries in debt below them
    const rows = top.concat(owing).slice().reverse();
    const byIso = {}; for (const L of LATEST) byIso[L.geo_id] = L;
    // no clamp: a bottom half that owes draws to the left of zero, which is what it means
    const band = (pick, name, colour) => ({
      type: 'bar', orientation: 'h', name,
      y: rows.map(r => r.geo_name),
      x: rows.map(r => { const L = byIso[r.geo_id]; return L ? pick(L) * 100 : 0; }),
      marker: { color: colour,
        // the country asked about is outlined, so it is findable without a second colour
        line: { color: rows.map(r => r.geo_id === rt.highlight ? hlEdge() : 'rgba(0,0,0,0)'),
                width: rows.map(r => r.geo_id === rt.highlight ? 1.5 : 0) } },
      hovertemplate: '%{y} &middot; ' + name + ': %{x:.1f}%<extra></extra>',
    });
    const lowest = Math.min(0, ...rows.map(r => {
      const L = byIso[r.geo_id]; return L ? L.bottom50_wealth_share * 100 : 0; }));
    Plotly.react(el, [
      band(L => L.bottom50_wealth_share, 'the poorest half', shade(metricColor('wealth_top1'), -0.55)),
      band(L => 1 - L.top10_wealth_share - L.bottom50_wealth_share, 'the middle 40%', shade(metricColor('wealth_top1'), -0.15)),
      band(L => L.top10_wealth_share, 'the richest tenth', shade(metricColor('wealth_top1'), 0.35)),
    ], Object.assign({}, BASE_LAYOUT, {
      barmode: 'relative', showlegend: true,
      legend: { orientation: 'h', y: 1.16, font: { size: 11 } },
      margin: { t: 24, r: 20, b: 38, l: 150 },
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { title: { text: 'share of all household wealth', font: { size: 12 } },
        ticksuffix: '%', range: [Math.min(-2, lowest - 2), 100], autorange: false, zeroline: true,
        zerolinecolor: cssVar('--axis', '#eaeaea'), zerolinewidth: 1 }),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { type: 'category' }),
      bargap: 0.34,
    }), CFG);
    title.textContent = 'How the wealth of a country is split';
    src.textContent = 'Each bar is one country\'s household wealth, split into the poorest half, the middle 40% and the richest tenth. ' +
      'The multiple in the sentence is the last band divided by the first. ' +
      (owing.length
        ? `The last ${owing.length === 1 ? 'bar crosses' : owing.length + ' bars cross'} to the left of zero: ` +
          `in ${owing.length === 1 ? 'that country' : 'those countries'} the poorest half owes more than it owns, ` +
          `so its share of the total is negative and the tenth above it holds more than all the wealth there is. ` +
          `A multiple cannot be quoted for ${owing.length === 1 ? 'it' : 'them'}. `
        : '') +
      provenance(['wealth_top1']);
  }

  else if (mode === 'path') {
    // one country walking through two measures at once. the line is the order the years
    // came in, so a loop means it went somewhere and came back.
    const pa = chain.slice().reverse().find(f => f.mode === 'path').path;
    const mx = META[pa.x], my = META[pa.y];
    const sc = (m, v) => m.fmt === pc ? v * 100 : v;
    const xs = pa.pts.map(d => sc(mx, d.x)), ys = pa.pts.map(d => sc(my, d.y));
    const yrs = pa.pts.map(d => d.year);
    const ends = [0, pa.pts.length - 1];
    Plotly.react(el, [
      { type: 'scatter', mode: 'lines+markers', showlegend: false,
        x: xs, y: ys, text: yrs.map(String),
        line: { color: metricColor(pa.x), width: 2, shape: 'linear' },
        marker: { size: 5, color: metricColor(pa.x), opacity: dotOp(0.55) },
        hovertemplate: '%{text}<br>' + mx.label + ' %{x}<br>' + my.label + ' %{y}<extra></extra>' },
      { type: 'scatter', mode: 'markers+text', showlegend: false,
        x: ends.map(i => xs[i]), y: ends.map(i => ys[i]), text: ends.map(i => String(yrs[i])),
        textposition: 'top center', textfont: { size: 11, color: cssVar('--ink', '#0a0a0a') },
        marker: { size: 11, color: hlFill(pa.x), line: { color: hlEdge(), width: 2 } },
        hovertemplate: '%{text}<extra></extra>' },
    ], Object.assign({}, BASE_LAYOUT, {
      margin: { t: 16, r: 18, b: 46, l: 58 },
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { title: { text: cap(mx.label), font: { size: 11 } },
        ticksuffix: mx.fmt === pc ? '%' : '', type: 'linear', autorange: true }),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { title: { text: cap(my.label), font: { size: 11 } },
        ticksuffix: my.fmt === pc ? '%' : '', type: 'linear', autorange: true }),
    }), CFG);
    title.textContent = `${BY_ISO[pa.iso].name}: ${mx.label} against ${my.label}, ${yrs[0]} to ${yrs[yrs.length - 1]}`;
    src.textContent =
      `One country, not a cloud of them. Each point is a year, joined in the order they happened, ` +
      `so the direction of travel is the reading and a loop means it went somewhere and came back. ` +
      `Only the ${pa.pts.length} years where both were measured are drawn. ` +
      provenance([pa.x, pa.y]);
  }

  // The parked stacked-bar version of the ratio chart stood here. The live one above
  // draws the three-way split, which carries the same reading and also shows the
  // countries whose poorest half owes.

  else if (mode === 'turn') {
    const tn = chain.slice().reverse().find(f => f.mode === 'turn').turn;
    const m = META[tn.key];
    const lo = tn.ser[0].year, hi = tn.ser[tn.ser.length - 1].year;
    const inWin = tn.ser.filter(d => d.year >= tn.a && d.year <= tn.b);
    Plotly.react(el, [
      { type: 'scatter', mode: 'lines', name: BY_ISO[tn.iso].name, showlegend: false,
        x: tn.ser.map(d => d.year), y: tn.ser.map(d => d.v),
        line: { color: metricColor(tn.key), width: 2.4, shape: 'linear' },
        hovertemplate: BY_ISO[tn.iso].name + ': ' + m.hover + '<extra></extra>' },
      { type: 'scatter', mode: 'lines', name: 'the sharpest stretch', showlegend: false,
        x: inWin.map(d => d.year), y: inWin.map(d => d.v),
        line: { color: hlFill(tn.key), width: 4, shape: 'linear' },
        hovertemplate: m.hover + '<extra></extra>' },
    ], Object.assign({}, BASE_LAYOUT, {
      // two staggered rows of event labels sit above the plot and need the room
      margin: { t: 48, r: 16, b: 40, l: 54 },
      shapes: [{ type: 'rect', xref: 'x', yref: 'paper', layer: 'below',
        x0: tn.a, x1: tn.b, y0: 0, y1: 1,
        fillcolor: 'rgba(128,132,140,0.13)', line: { width: 0 } }],
      // the events sit above the plot as marks, not as bands behind the line: they are
      // a lookup beside the turn, and drawing them behind it would read as cause
      annotations: tn.events.map((e, i) => ({
        x: Math.max(lo, (e.a + e.b) / 2), y: 1, xref: 'x', yref: 'paper',
        yanchor: 'bottom', yshift: 2 + (i % 2) * 13, text: e.k, showarrow: false,
        font: { size: 9.5, color: cssVar('--ink-3', '#999999') },
      })),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, axisFmt(m)),
    }), CFG);
    title.textContent = `${BY_ISO[tn.iso].name}: the sharpest ${tn.span} years, ${tn.a} to ${tn.b}`;
    src.textContent =
      `The window is the ${tn.span}-year stretch with the largest move in this series, found by ` +
      `searching every stretch. The labels above are what the atlas records happening in those ` +
      `years or in the ${EVENT_LAG} before, which is a lookup and not an explanation: a policy does ` +
      `not land on a distribution the year it passes, and nothing here tests whether it landed at all. ` +
      (m.lineSrc || '') + ' ' + provenance([tn.key]);
  }

  else if (mode === 'peers') {
    const pr = chain.slice().reverse().find(f => f.mode === 'peers').peers;
    const m = META[pr.key];
    const isPct = m.fmt === pc;
    const sc = v => isPct ? v * 100 : v;
    // fifty-odd countries cannot be a bar each: the question is where this one sits
    // among them, so it is drawn as the distribution it actually is
    const swarm = arr => {
      const xs = arr.map(r => sc(r.dv));
      const lo = Math.min(...xs), hi = Math.max(...xs), span = (hi - lo) || 1;
      const bins = new Map();
      return xs.map(x => {
        const k = Math.round((x - lo) / span * 46);
        const n = bins.get(k) || 0; bins.set(k, n + 1);
        return (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 0.09;
      });
    };
    const bg = pr.moves.filter(r => r.iso !== pr.iso);
    const fg = pr.moves.filter(r => r.iso === pr.iso);
    const fmtD = v => (v >= 0 ? '+' : '-') + m.fmtD(Math.abs(v));
    Plotly.react(el, [{
      type: 'scatter', mode: 'markers',
      x: bg.map(r => sc(r.dv)), y: swarm(bg),
      text: bg.map(r => r.name), customdata: bg.map(r => fmtD(r.dv)),
      marker: { color: metricColor(pr.key), size: 7, opacity: dotOp(0.5) },
      hovertemplate: '%{text}: %{customdata}<extra></extra>',
    }, {
      type: 'scatter', mode: 'markers+text',
      x: fg.map(r => sc(r.dv)), y: fg.map(() => 0),
      text: fg.map(r => r.name), customdata: fg.map(r => fmtD(r.dv)),
      textposition: 'top center', textfont: { size: 12, color: cssVar('--ink', '#0a0a0a') },
      marker: { color: hlFill(pr.key), size: 13, line: { color: hlEdge(), width: 2 } },
      hovertemplate: '%{text}: %{customdata}<extra></extra>',
    }], Object.assign({}, BASE_LAYOUT, {
      showlegend: false,
      margin: { t: 26, r: 18, b: 44, l: 18 },
      shapes: [{ type: 'line', xref: 'x', yref: 'paper', layer: 'below',
        x0: sc(pr.med), x1: sc(pr.med), y0: 0, y1: 1,
        line: { color: cssVar('--ink-3', '#999999'), width: 1.5, dash: 'dash' } },
        { type: 'line', xref: 'x', yref: 'paper', layer: 'below',
          x0: 0, x1: 0, y0: 0, y1: 1,
          line: { color: 'rgba(128,132,140,0.35)', width: 1 } }],
      annotations: [{ x: sc(pr.med), y: 1, xref: 'x', yref: 'paper', yanchor: 'bottom',
        yshift: 3, text: 'the middle peer', showarrow: false,
        font: { size: 10, color: cssVar('--ink-3', '#999999') } }],
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, {
        title: { text: `move in ${m.label}, ${pr.a} to ${pr.b}`, font: { size: 11 } },
        ticksuffix: isPct ? '%' : '', zeroline: false }),
      yaxis: { visible: false, type: 'linear', range: [-1, 1], autorange: false },
    }), CFG);
    title.textContent = `${BY_ISO[pr.iso].name} among its peers, ${pr.a} to ${pr.b}`;
    src.textContent =
      `One dot per country, each the move in ${m.label} over the same years. Peers are the ` +
      `countries in the same third of GDP per person, so the set is chosen by a rule rather than ` +
      `by hand. The dashed line is the middle peer; the thin line is no change. Reading a country ` +
      `against them takes out what moved everybody at once, which before-and-after on its own ` +
      `cannot do. It still does not show cause. ` + provenance([pr.key]);
  }

  else if (mode === 'tables') {
    const tb = chain.slice().reverse().find(f => f.mode === 'tables').tables;
    const foc = new Set(tb.focus), lab = new Set(tb.far.concat(tb.focus));
    const n = tb.pts.length;
    const plain = tb.pts.filter(q => !foc.has(q.iso));
    const hit = tb.pts.filter(q => foc.has(q.iso));
    const traces = [{
      // the line of agreement. every country would sit on it if the two tables matched
      type: 'scatter', mode: 'lines', x: [1, n], y: [1, n], showlegend: false,
      line: { color: 'rgba(128,132,140,0.45)', width: 1, dash: 'dot' }, hoverinfo: 'skip',
    }, {
      type: 'scatter', mode: 'markers+text', showlegend: false,
      x: plain.map(q => q.ri), y: plain.map(q => q.rw),
      text: plain.map(q => lab.has(q.iso) ? q.name : ''),
      textposition: 'top center', textfont: { size: 10, color: cssVar('--ink-2', '#555555') },
      marker: { size: 7, color: metricColor('wealth_top1'), opacity: dotOp(0.55) },
      customdata: plain.map(q => [q.name, q.year]),
      hovertemplate: '%{customdata[0]} (%{customdata[1]})<br>income rank %{x}<br>wealth rank %{y}<extra></extra>',
    }];
    if (hit.length) traces.push({
      type: 'scatter', mode: 'markers+text', showlegend: false,
      x: hit.map(q => q.ri), y: hit.map(q => q.rw), text: hit.map(q => q.name),
      textposition: 'top center', textfont: { size: 12, color: cssVar('--ink', '#0a0a0a') },
      marker: { size: 13, color: hlFill('wealth_top1'), line: { color: hlEdge(), width: 2 } },
      customdata: hit.map(q => [q.name, q.year]),
      hovertemplate: '%{customdata[0]} (%{customdata[1]})<br>income rank %{x}<br>wealth rank %{y}<extra></extra>',
    });
    Plotly.react(el, traces, Object.assign({}, BASE_LAYOUT, {
      margin: { t: 14, r: 18, b: 46, l: 56 },
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { range: [0, n + 1], autorange: false,
        title: { text: 'rank by what the top 1% earns  (1 = most concentrated)', font: { size: 11 } } }),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { range: [0, n + 1], autorange: false,
        title: { text: 'rank by what the top 1% owns  (1 = most concentrated)', font: { size: 11 } } }),
      // which side of the line means what, or the chart is a cloud with a diagonal in it
      annotations: [
        { x: n * 0.80, y: n * 0.30, xref: 'x', yref: 'y', showarrow: false,
          text: 'ranked more unequal<br>on wealth than on income', align: 'center',
          font: { size: 10.5, color: cssVar('--ink-3', '#999999') } },
        { x: n * 0.24, y: n * 0.86, xref: 'x', yref: 'y', showarrow: false,
          text: 'ranked more unequal<br>on income than on wealth', align: 'center',
          font: { size: 10.5, color: cssVar('--ink-3', '#999999') } },
      ],
    }), CFG);
    title.textContent = `Two tables, ${n} countries`;
    src.textContent =
      `Each country is ranked twice, once by its top 1% share of income and once by its top 1% ` +
      `share of wealth, at the latest year both were measured. The dotted line is where a country ` +
      `would sit if the two rankings agreed; distance from it is disagreement. Spearman ` +
      `${tb.rho.toFixed(2)}. Both sides are WID on the same equal-split adult basis, so the ` +
      `comparison is like for like. Many of these countries are modelled rather than measured: ` +
      `narrow the set with "among" to read it on countries with tax records. ` +
      provenance([tb.x, tb.y]);
  }

  else if (mode === 'triple') {
    const tp = chain.slice().reverse().find(f => f.mode === 'triple').triple;
    const mx = META[tp.x], my = META[tp.y], mz = META[tp.z];
    const foc = new Set(chain[chain.length - 1].isos || []);
    const sc = (m, v) => m.fmt === pc ? v * 100 : v;
    const X = tp.pts.map(q => sc(mx, q.x)), Y = tp.pts.map(q => sc(my, q.y)), Z = tp.pts.map(q => sc(mz, q.z));
    const pad = (a, k) => { const lo = Math.min(...a), hi = Math.max(...a), g = (hi - lo) * k;
      return [lo - g, hi + g]; };
    const rx = pad(X, 0.06), ry = pad(Y, 0.06), rz = pad(Z, 0.06);
    const main = tp.pts.filter(q => !foc.has(q.iso)), hit = tp.pts.filter(q => foc.has(q.iso));
    const traces = [{
      // the cloud is one quiet colour: colouring it by an axis only repeats that axis
      type: 'scatter3d', mode: 'markers', name: 'every country', showlegend: false,
      x: main.map(q => sc(mx, q.x)), y: main.map(q => sc(my, q.y)), z: main.map(q => sc(mz, q.z)),
      text: main.map(q => q.name + ', ' + q.year),
      marker: { size: 3.8, opacity: dotOp(0.58), color: cssVar('--ink-3', '#999999') },
      hovertemplate: '%{text}<br>' + mx.label + ': %{x}<br>' + my.label + ': %{y}<br>' +
        mz.label + ': %{z}<extra></extra>',
    }];
    // a marked country gets three dropped lines, one to each wall, so its position on
    // every axis can actually be read off. depth alone is not readable and never was.
    for (const h of hit) {
      const hx = sc(mx, h.x), hy = sc(my, h.y), hz = sc(mz, h.z);
      traces.push({
        type: 'scatter3d', mode: 'lines', showlegend: false, hoverinfo: 'skip',
        // three separate segments, broken by nulls: one to each wall, not one polyline
        x: [hx, rx[0], null, hx, hx, null, hx, hx],
        y: [hy, hy, null, hy, ry[1], null, hy, hy],
        z: [hz, hz, null, hz, hz, null, hz, rz[0]],
        line: { color: hlFill(tp.x), width: 2, dash: 'dot' },
        connectgaps: false,
      });
      traces.push({
        type: 'scatter3d', mode: 'markers+text', showlegend: false,
        x: [hx], y: [hy], z: [hz], text: [h.name],
        marker: { size: 8, color: hlFill(tp.x), line: { color: hlEdge(), width: 1.5 } },
        textposition: 'top center',
        textfont: { size: 12, color: cssVar('--ink', '#1a2744') },
        hovertemplate: h.name + ' (' + h.year + ')<br>' + mx.label + ': %{x}<br>' +
          my.label + ': %{y}<br>' + mz.label + ': %{z}<extra></extra>',
      });
    }
    // short titles: a 3D axis label runs along the edge and a long one falls off the card
    const SHORT = { wealth_top1: 'wealth %', income_top1: 'income %',
      income_gini: 'income Gini', life_exp: 'life expectancy' };
    const shortOf = k => SHORT[k] || META[k].label;
    const ax = (t, r) => ({ title: { text: t, font: { size: 10.5 } }, range: r,
      gridcolor: cssVar('--grid', '#f0f0f0'), zeroline: false, showbackground: false,
      color: cssVar('--ink-3', '#999999'), tickfont: { size: 9.5 } });
    Plotly.react(el, traces, Object.assign({}, BASE_LAYOUT, {
      margin: { t: 10, r: 10, b: 10, l: 10 },
      scene: { xaxis: ax(shortOf(tp.x), rx), yaxis: ax(shortOf(tp.y), ry), zaxis: ax(shortOf(tp.z), rz),
        // stretching the box pushes the axis titles past the edge of the card and they
        // get cut; a cube, sat back far enough to fit whole, keeps every label readable
        camera: { eye: { x: 1.85, y: 1.7, z: 0.8 } }, aspectmode: 'cube' },
    }), CFG);
    title.textContent = `${cap(mx.label)}, ${my.label} and ${mz.label}, at once`;
    src.textContent =
      `One point per country, placed by all three at the latest year all three were measured. ` +
      (hit.length
        ? `The marked country's dotted lines run to each wall: that is where it sits on each axis. `
        : `Name a country and it is marked, with a dotted line dropped to each wall so its reading on ` +
          `every axis can be read off. `) +
      `Drag to turn it. A cloud in three dimensions shows which countries sit together and which sit ` +
      `alone; it is not the place to read an exact number, and the flat charts are. ` +
      provenance([tp.x, tp.y, tp.z]);
  }

  else if (mode === 'tiers') {
    const t = chain.slice().reverse().find(f => f.mode === 'tiers').tiers;
    const my = META[t.aspect], ml = META[t.lens];
    const rows = t.rows.slice().reverse();
    const isPct = my.fmt === pc;
    const vals = rows.map(r => isPct ? r.val * 100 : r.val);
    Plotly.react(el, [{
      type: 'bar', orientation: 'h',
      y: rows.map(r => r.label), x: vals,
      // three ordered groups, so three steps of the face's own colour
      marker: { color: shadesOf(metricColor(t.lens), 3) },
      text: rows.map(r => my.fmt(r.val) + '  ·  ' + r.n),
      textposition: 'outside', textfont: { size: 11, color: cssVar('--ink-2', '#555555') },
      hovertemplate: '%{y}: %{text} countries<extra></extra>',
    }], Object.assign({}, BASE_LAYOUT, {
      margin: { t: 8, r: 112, b: 36, l: 150 },
      // the value and the count are written outside the bar, so the axis has to leave
      // room for them or the label is cut off at the edge of the card
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis,
        { range: [0, Math.max(...vals) * 1.2], autorange: false },
        isPct ? { ticksuffix: '%' } : {}),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { type: 'category' }),
      bargap: 0.4,
    }), CFG);
    title.textContent = `${cap(my.label)} by ${ml.label} tier`;
    src.textContent = `Countries split into thirds by ${ml.label}, latest year. Bars show the mean of each third; the count follows each bar. ` + provenance([t.aspect, t.lens]);
  }

  else if (mode === 'strip') {
    const st = chain.slice().reverse().find(f => f.mode === 'strip').strip;
    const m = META[st.key];
    const focusSet = new Set(st.focus);
    const scale = v => m.fmt === pc ? v * 100 : v;
    const jitter = st.pool.map(() => (((Math.sin(st.pool.length) + 1) % 1)));
    const bg = st.pool.filter(r => !focusSet.has(r.geo_id));
    const fg = st.pool.filter(r => focusSet.has(r.geo_id));
    // stack points that share a slice of the axis, so density reads as height
    const swarm = arr => {
      const xs = arr.map(r => scale(r.val));
      const lo = Math.min(...xs), hi = Math.max(...xs), span = (hi - lo) || 1;
      const bins = new Map();
      return xs.map(x => {
        const k = Math.round((x - lo) / span * 46);
        const n = bins.get(k) || 0; bins.set(k, n + 1);
        return (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 0.09;
      });
    };
    const yj = arr => swarm(arr);
    const traces = [{
      type: 'scatter', mode: 'markers',
      x: bg.map(r => scale(r.val)), y: yj(bg),
      text: bg.map(r => r.geo_name), customdata: bg.map(r => m.fmt(r.val)),
      marker: { color: metricColor(st.key), size: 6, opacity: dotOp(0.5) },
      hovertemplate: '%{text}: %{customdata}<extra></extra>',
    }];
    if (fg.length) traces.push({
      type: 'scatter', mode: 'markers+text',
      x: fg.map(r => scale(r.val)), y: yj(fg),
      text: fg.map(r => r.geo_name), customdata: fg.map(r => m.fmt(r.val)),
      textposition: 'top center', textfont: { size: 11, color: cssVar('--ink', '#1a2744') },
      marker: { color: hlFill(), size: 11, line: { color: hlEdge(), width: 2 } },
      hovertemplate: '%{text}: %{customdata}<extra></extra>',
    });
    Plotly.react(el, traces, Object.assign({}, BASE_LAYOUT, {
      margin: { t: 8, r: 12, b: 40, l: 12 },
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { title: { text: cap(m.label), font: { size: 12 } },
        ticksuffix: m.fmt === pc ? '%' : '' }),
      yaxis: { visible: false, type: 'linear', range: [-1, 1], autorange: false },
    }), CFG);
    title.textContent = `${cap(m.label)}, every country` + (st.region ? ` in ${REGION_LABEL[st.region]}` : '');
    src.textContent = (m.poolSrc || '') + ' ' + provenance([st.metric]);
  }

  else if (mode === 'lorenz') {
    const lz = chain.slice().reverse().find(f => f.mode === 'lorenz').lorenz;
    // several curves of the same measure, so several steps of that measure's colour
    const lzRamp = shadesOf(metricColor('wealth_gini'), Math.max(2, lz.isos.length));
    const traces = lz.isos.map((iso, li) => {
      const c = BY_ISO[iso].latest;
      const b50 = c.bottom50_wealth_share, t10 = c.top10_wealth_share, t1 = c.top1_wealth_share;
      const px = [0, 50, 90, 99, 100];
      const py = [0, b50 * 100, (1 - t10) * 100, (1 - t1) * 100, 100];
      return {
        type: 'scatter', mode: 'lines', name: BY_ISO[iso].name,
        x: px, y: py, line: { color: lzRamp[li], width: 2.2, shape: 'linear' },
        hovertemplate: BY_ISO[iso].name + ': bottom %{x:.0f}% hold %{y:.1f}%<extra></extra>',
      };
    });
    traces.push({
      type: 'scatter', mode: 'lines', name: 'Perfect equality',
      x: [0, 100], y: [0, 100], line: { color: '#c3c2b7', width: 1.5, dash: 'dot' },
      hoverinfo: 'skip', showlegend: false,
    });
    Plotly.react(el, traces, Object.assign({}, BASE_LAYOUT, {
      showlegend: traces.filter(t => t.showlegend !== false).length >= 2,
      legend: { orientation: 'h', y: 1.1, font: { size: 11 } },
      margin: { t: 8, r: 12, b: 44, l: 48 },
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { title: { text: 'Share of population', font: { size: 12 } }, ticksuffix: '%', range: [0, 100], autorange: false }),
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, { title: { text: 'Share of wealth', font: { size: 12 } }, ticksuffix: '%', range: [0, 100], autorange: false }),
    }), CFG);
    title.textContent = 'Wealth Lorenz curve' + (lz.isos.length === 1 ? `, ${BY_ISO[lz.isos[0]].name}` : '');
    src.textContent = 'Source: WID. Anchored at the bottom 50%, top 10%, and top 1% shares. The further the curve bows from the diagonal, the more concentrated.';
  }

  else {
    const lineFacts = chain.filter(f => f.mode === 'lines');
    const metric = lineFacts.slice().reverse().map(f => f.metricUsed).find(Boolean) || 'wealth_gini';
    const m = META[metric];
    const isoSet = [];
    lineFacts.forEach(f => f.isos.forEach(i => { if (!isoSet.includes(i)) isoSet.push(i); }));
    const wantWorld = chain.some(f => f.world);
    const fromYear = chain.slice().reverse().map(f => f.fromYear).find(Boolean) || null;
    const toYear = chain.slice().reverse().map(f => f.toYear).find(Boolean) || null;
    let eLo = Infinity, eHi = -Infinity;
    const traces = [];
    for (const iso of isoSet) {
      const s = seriesOf(metric, iso);
      if (!s.length) continue;
      eLo = Math.min(eLo, s[0].year); eHi = Math.max(eHi, s[s.length - 1].year);
      traces.push({
        type: 'scatter', mode: s.length < 12 ? 'lines+markers' : 'lines', name: BY_ISO[iso].name,
        x: s.map(d => d.year), y: s.map(d => d.v),
        line: { color: isoSet.length === 1 ? metricColor(metric)
          : shadesOf(metricColor(metric), isoSet.length)[isoSet.indexOf(iso)], width: 2.2,
          shape: 'linear' },
        marker: { size: 5 },
        hovertemplate: BY_ISO[iso].name + ': ' + m.hover + '<extra></extra>',
      });
    }
    if (wantWorld) {
      const w = medianSeriesOf(metric, null);
      if (w.length) traces.push({
        type: 'scatter', mode: 'lines', name: 'World median',
        x: w.map(d => d.year), y: w.map(d => d.v),
        line: { color: '#999999', width: 2, dash: 'dash' },
        hovertemplate: 'World median: ' + m.hover + '<extra></extra>',
      });
    }
    const regs = [];
    chain.forEach(f => { if (f.regionKey && !regs.includes(f.regionKey)) regs.push(f.regionKey); });
    for (const reg of regs) {
      const s = medianSeriesOf(metric, reg);
      if (!s.length) continue;
      const name = `${REGION_LABEL[reg]} median`;
      traces.push({
        type: 'scatter', mode: 'lines', name,
        x: s.map(d => d.year), y: s.map(d => d.v),
        line: { color: assignColor('reg:' + reg), width: 2, dash: 'dash' },
        hovertemplate: name + ': ' + m.hover + '<extra></extra>',
      });
    }
    for (const mk of chain.filter(f => f.marker).map(f => f.marker)) {
      const s = seriesOf(metric, mk.iso);
      const at = s.find(d => d.year === mk.year);
      if (at) traces.push({
        type: 'scatter', mode: 'markers', showlegend: false,
        x: [at.year], y: [at.v],
        marker: { color: assignColor(mk.iso), size: 9, line: { color: '#ffffff', width: 2 , shape: 'linear' } },
        hovertemplate: `${BY_ISO[mk.iso].name}, ${at.year}: ` + m.hover + '<extra></extra>',
      });
    }
    // names at the ends of the lines, where there is room for them. on a phone they took a
    // third of the width and Plotly stretched the years to fit them, so the lines ran to
    // 2040 and filled the left half; there the legend names them instead
    const narrowLines = el.clientWidth < 520;
    const labelable = narrowLines ? [] : traces.filter(t => t.showlegend !== false && !t.line.dash);
    const annotations = labelable.length && labelable.length <= 4 ? labelable.map(t => ({
      x: t.x[t.x.length - 1], y: t.y[t.y.length - 1], xanchor: 'left', xshift: 6,
      text: t.name, showarrow: false,
      font: { size: 11, color: cssVar('--ink-2', '#555555') },
    })) : [];
    Plotly.react(el, traces, Object.assign({}, BASE_LAYOUT, {
      showlegend: traces.filter(t => t.showlegend !== false).length >= 2,
      legend: { orientation: 'h', y: 1.16, font: { size: 11 } },
      hovermode: 'x unified',
      annotations: annotations.concat(eraLabels(eLo, eHi)),
      shapes: eraShapes(eLo, eHi),
      // the years the lines cover, set rather than worked out: left to itself the axis
      // grew to make room for the names at the ends of the lines
      xaxis: Object.assign({}, BASE_LAYOUT.xaxis, { autorange: false,
        range: (fromYear || toYear) ? [fromYear || eLo, toYear || Math.max(eHi, 2025)] : [eLo, eHi + 0.5] }),
      // a share reads as a share on the axis too, matching the sentence above it. a Gini
      // that moved 0.012 filled the whole height and looked like an upheaval, so a Gini
      // axis spans at least a tenth and a share at least five points
      yaxis: Object.assign({}, BASE_LAYOUT.yaxis, axisFmt(m), minSpan(traces, m.giniFam && m.fmt !== pc ? 0.1 : m.fmt === pc ? 0.05 : 0)),
      margin: { t: 12, r: labelable.length && labelable.length <= 4 ? 110 : 16, b: 40, l: 46 },
    }), CFG);
    title.textContent = `${cap(m.label)} over time`;
    src.textContent = (m.lineSrc || '') + ' ' + provenance([metric]);
  }
}
