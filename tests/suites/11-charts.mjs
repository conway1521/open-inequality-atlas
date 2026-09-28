// Every chart wears the colour of the face its measure belongs to (wealth blue, income
// teal, health rose, opportunity amber, CO2 slate), the square beside its title matches,
// and axes carry the units their labels use.
import { ask } from '../lib.mjs';

const HEX = { wealth: '#2a78d6', income: '#2f9e8f', health: '#c0607a', opportunity: '#c98a2b', slate: '#6b7280' };

export default async function (t) {
  const page = await t.page();
  const chart = () => page.evaluate(() => {
    const el = document.getElementById('chart'), cols = new Set();
    const add = c => { if (Array.isArray(c)) c.forEach(add); else if (typeof c === 'string') cols.add(c.toLowerCase()); };
    for (const tr of el.data || []) { add(tr.line && tr.line.color); add(tr.marker && tr.marker.color); }
    return { cols: [...cols], title: document.getElementById('chart-title').textContent,
      swatch: document.getElementById('chart-title').style.getPropertyValue('--swatch').trim().toLowerCase(),
      layout: el.layout || {}, traces: (el.data || []).length };
  });

  const CASES = [
    ['how much longer do the rich live here?', 'health', 'the life gap by commuting zone, men and women'],
    ['life expectancy gap in Detroit', 'health', 'a US place on the health face'],
    ['life expectancy in japan', 'health', 'a country\'s life expectancy'],
    ['income gap and life gap by county', 'health', 'a county pair whose second measure is the life gap'],
    ['does credit depend on your parents\' income?', 'opportunity', 'credit by parents\' income'],
    ['co2 per person in china', 'slate', 'CO2, which belongs to no face'],
    ['median income in india', 'income', 'median income'],
    ['what does the top 1% own in france', 'wealth', 'the top 1% wealth share'],
  ];
  for (const [q, face, what] of CASES) {
    await ask(page, q, 1000);
    const c = await chart();
    t.check(`${what} is drawn in ${face}`, c.cols.includes(HEX[face]), `${c.title}: ${c.cols.join(' ')}`);
    t.check(`and the square by its title is ${face} too`, c.swatch === HEX[face], `${c.title}: ${c.swatch}`);
  }
  await ask(page, 'how much longer do the rich live here?', 1000);
  t.check('the life gap chart has no amber in it', !(await chart()).cols.includes(HEX.opportunity));

  // US pairings typed in plain words draw the pair, not the fallback ranking
  for (const [q, want] of [['mobility and house value', /Children climbing and house value/],
    ['life gap and mobility', /Children climbing and rich-poor life gap/],
    ['credit scores by parents income', /Credit score by parents' income/],
    ['who you know and where you end up', /Who you grow up around/]]) {
    await ask(page, q, 1000);
    const c = await chart();
    t.check(`"${q}" draws its own chart`, want.test(c.title), c.title);
  }
  await ask(page, 'mobility and house value', 1000);
  t.check('house value is on a log axis', (await chart()).layout.yaxis.type === 'log');

  // rises and falls: the axis is in the same points the labels are
  await ask(page, 'how has inequality changed over time?', 1000);
  const r = await chart();
  t.check('the biggest-rises axis is in points', /percentage points/.test((r.layout.xaxis.title || {}).text || ''), JSON.stringify(r.layout.xaxis.title));
  t.check('its bars sit on a points scale, not fractions', Math.max(...(await page.evaluate(() => document.getElementById('chart').data[0].x))) > 1);
  await ask(page, 'what does the person in the middle live on a day?', 1000);
  t.check('a money axis wears the dollar sign', ((await chart()).layout.xaxis.tickprefix || '') === '$');

  await ask(page, 'how does wealth inequality compare with income inequality in germany', 1000);
  t.check('wealth against income in one country draws both', /Germany: the same top 1%/.test((await chart()).title), (await chart()).title);

  const roll = await page.textContent('#shake');
  t.check('the roll button says "roll me"', /roll me$/.test(roll.trim()), roll);
}
