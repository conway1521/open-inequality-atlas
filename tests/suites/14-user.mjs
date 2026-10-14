// What a second pass as a user turned up: answers that never came into view, questions
// read as some other question, and charts that only worked on a laptop in light mode.
import { ask, seen } from '../lib.mjs';

export default async function (t) {
  const page = await t.page({ width: 1366, height: 768 });
  const read = async (q, wait = 1100) => { await page.evaluate(() => resetAll()); await ask(page, q, wait); return seen(page); };

  // answers by every route land in view, chart and all
  for (const q of ['where should i raise kids', 'is the uk more unequal than france', 'detroit']) {
    await read(q, 2600);
    const m = await page.evaluate(() => ({ lead: Math.round(document.querySelector('#answer .lead').getBoundingClientRect().top),
      chart: Math.round(document.getElementById('chart').getBoundingClientRect().bottom), vh: innerHeight }));
    t.check(`"${q}" is brought into view with its chart`, m.lead > 0 && m.lead < 200 && m.chart <= m.vh, JSON.stringify(m));
  }

  // questions that were read as other questions
  const CASES = [
    ['what is the gini of japan', /Japan: wealth Gini/],
    ['how much do the poor own in south africa', /South Africa: bottom 50% wealth share/],
    ['how much does the top 10% own in germany', /In Germany the richest tenth hold/],
    ['how much does the average american earn', /United States: median income/],
    ['happiest country', /life satisfaction/],
    ['inequality in scandinavia', /Nordic countries/],
    ['house prices in london', /United Kingdom/],
    ['is it harder to buy a house now', /house prices against income/],
    ['which countries got more equal', /Biggest falls/],
    ['did covid make inequality worse', /2019 to the latest year/],
    ['did wages keep up with productivity', /output per hour worked grew/],
    ['how many people live in poverty in the world', /extreme poverty among all countries/],
    ['show me poverty', /relative poverty/],
    ['is the american dream dead', /US commuting zones/],
  ];
  for (const [q, want] of CASES) {
    const s = await read(q);
    t.check(`"${q}" answers what was asked`, want.test(s.answer), (s.notice || s.answer).slice(0, 140));
  }
  // and what the atlas does not hold says so
  for (const [q, want] of [['how much do nurses earn', /no pay by job/], ['gender pay gap', /no pay split by gender/],
    ['wealth gap between black and white americans', /by race/], ['how much wealth does the top 0.1% have', /top 1% for every country/],
    ['what is the poverty line', /two poverty lines/]]) {
    const s = await read(q);
    t.check(`"${q}" says what the atlas does not hold`, want.test(s.notice), s.notice || s.answer.slice(0, 120));
  }
  // a city, a period and "my country" are each read and said
  let s = await read('house prices in london');
  t.check('a city is said to be read as its country', /Read London as the United Kingdom/.test(s.answer));
  s = await read('has the uk become more unequal since thatcher');
  t.check('a named period is said to be read as a year', /Read Thatcher as from 1979/.test(s.answer));
  s = await read('how unequal is my country');
  t.check('"my country" comes from the browser setting, and says so', /from your browser's language setting/.test(s.answer), s.answer.slice(0, 160));

  // a ranking of a survey measure leaves out readings far older than the rest, by name
  s = await read('which country has the most extreme poverty in the world');
  t.check('a 2003 survey does not top a ranking of the latest year', !/Uzbekistan 82/.test(s.answer) && /Uzbekistan \(2003\)/.test(s.answer), s.answer.slice(0, 200));

  // a roll stays on a face the reader chose
  await page.evaluate(() => resetAll());
  await page.click('.fchip[data-facet="income"]'); await page.waitForTimeout(300);
  let onIncome = 0;
  for (let i = 0; i < 4; i++) { await page.click('#shake'); await page.waitForTimeout(1800); if ((await seen(page)).face === 'income') onIncome++; }
  t.check('four rolls after choosing income stay on income', onIncome === 4, `${onIncome} of 4`);

  // the US faces, chosen over an answer about a country, answer for themselves
  await read('how unequal is sweden');
  await page.evaluate(() => scrollTo(0, 0));
  await page.click('.fchip[data-facet="health"]'); await page.waitForTimeout(1200);
  s = await seen(page);
  t.check('choosing health over a country answer gives the health answer', s.face === 'health' && /years less/.test(s.answer), s.answer.slice(0, 120));

  // the place fold on a US face offers US places
  await page.evaluate(() => scrollTo(0, 0));
  await page.click('#rib-place .rib-head'); await page.waitForTimeout(300);
  const opts = await page.$$eval('#rib-drawer .opt', bs => bs.map(b => b.textContent.trim()));
  t.check('the place fold on a US face offers US places', opts.includes('Detroit') && opts.includes('Ohio'), opts.join(', '));

  // a US-only reading keeps its place
  await read('what is that wealth actually made of?');
  await page.evaluate(() => scrollTo(0, 0));
  await page.click('#rib-place .rib-head'); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('#rib-drawer .opt').click()); await page.waitForTimeout(600);
  t.check('tapping the United States on a US-only reading keeps it', await page.evaluate(() => cell.place === 'USA'));

  // on a phone, line charts use the width and the heatmap's figures stay apart
  const phone = await t.page({ phone: true });
  await phone.evaluate(() => resetAll()); await ask(phone, 'is the uk more unequal than france', 1500);
  const xr = await phone.evaluate(() => document.getElementById('chart').layout.xaxis.range);
  t.check('a line chart on a phone ends at its last year, not 2040', xr && xr[1] < 2030, JSON.stringify(xr));
  await phone.evaluate(() => resetAll()); await ask(phone, 'do the four faces agree inside one country?', 1500);
  const hm = await phone.evaluate(() => (document.getElementById('chart').layout.annotations || []).map(a => a.text).filter(Boolean));
  t.check('the heatmap on a phone uses one decimal', hm.length && hm.every(x => /^-?\d\.\d$/.test(x)), hm.slice(0, 5).join(' '));

  // rent is answered as rent, a period before the record says so on screen, and the
  // three-measure chart is drawn flat on a phone
  s = await read('rent in new york');
  t.check('"rent in new york" leads with the rent', /two-bedroom home rents for \$[\d,]+ a month/.test(s.answer), s.answer.slice(0, 140));
  s = await read('house prices in ohio');
  t.check('a state asked about house prices gives the median home value', /median home is worth \$/.test(s.answer), s.answer.slice(0, 120));
  s = await read('which countries got more unequal since 1980');
  const notes = await page.evaluate(() => (document.querySelector('#answer .notes') || {}).textContent || '');
  t.check('a period before the record says where it really starts, on the notes line', /record starts in 1990/.test(notes) && !/1980 to the latest year/.test(s.answer), notes);
  s = await read('wealth, income and life expectancy in france');
  t.check('the three named together draw the three-measure chart', /three numbers at once/.test(s.answer) && /France/.test(s.answer), s.answer.slice(0, 160));
  await phone.evaluate(() => resetAll()); await ask(phone, 'how do wealth, income and life expectancy sit together?', 1500);
  const ty = await phone.evaluate(() => (document.getElementById('chart').data || []).map(tr => tr.type));
  t.check('on a phone the three-measure chart is flat', ty.length && !ty.includes('scatter3d'), ty.join(','));

  // the third pass: folds, follow-ups, years, regions and the US layer
  await read('how unequal is the uk');
  await page.evaluate(() => { cell.span = 'moment'; cell.year = 2024; cell.against = 'income_gini'; runCell(); setStage('result'); render(); });
  await page.waitForTimeout(400);
  s = await seen(page);
  t.check('one country held against another measure draws the scatter', /income Gini/.test(s.answer) && /Across \d+ countries/.test(s.answer), s.answer.slice(0, 120));
  await page.evaluate(() => { cell.form = 'tiers'; runCell(); setStage('result'); render(); }); await page.waitForTimeout(400);
  s = await seen(page);
  t.check('"by tier" at a year the second measure lacks reads each at its latest, and says so', /Grouping countries/.test(s.answer) && /reads each at its latest year/.test(s.answer) && !s.notice, (s.notice || s.answer).slice(0, 140));
  for (const [q, want] of [
    ['how unequal is the uk in 1850', /Nothing in the atlas goes back to 1850/],
    ['how unequal is the uk in 2030', /2030 has not happened yet/],
    ['compare every country', /Highest top 1% wealth share among all countries/],
    ['uk 1995 to 2005', /United Kingdom \+?-?[\d.]+ points from 1995 to 2005/],
    ['uk vs germany house prices', /United Kingdom \d+ vs Germany \d+/],
    ['how much does the middle class earn in germany', /Germany: median income/],
    ['how happy are finns', /Finland: life satisfaction/],
    ['which countries have negative wealth for the bottom half', /Lowest bottom 50% wealth share/],
    ['best county to grow up in ohio', /counties in Ohio, the best place for a poor child/],
    ['how does wealth inequality in africa compare to europe', /middle country of Africa/],
  ]) { s = await read(q); t.check(`"${q}" answers what was asked`, want.test(s.answer), (s.notice || s.answer).slice(0, 140)); }
  s = await read('how much more do the richest hold than the poorest in sweden');
  t.check('a question with no multiple says why in its first sentence', /owns less than nothing, so there is no multiple/.test(s.answer), s.answer.slice(0, 140));
  for (const [q, want] of [['do the rich pay their fair share', /does not model taxes/], ['what is economic connectedness', /better-off friends/]]) {
    s = await read(q); t.check(`"${q}" is answered in a notice`, want.test(s.notice), s.notice || s.answer.slice(0, 100));
  }
  // start over resets the measure with the face
  await page.evaluate(() => resetAll()); await page.click('.fchip[data-facet="income"]'); await page.waitForTimeout(200);
  await page.evaluate(() => resetAll()); await ask(page, 'how has spain changed since 2000', 1100);
  t.check('start over from the income face reads the next question on wealth', /Top 1% wealth share over time: Spain/.test((await seen(page)).answer));
  // gibberish on the health face is not answered with the health chart
  await page.evaluate(() => resetAll()); await page.click('.fchip[data-facet="health"]'); await page.waitForTimeout(300);
  await ask(page, 'asdfgh', 900);
  t.check('gibberish on the health face says it could not read it', /Could not read/.test((await seen(page)).notice));
  await ask(page, 'what about women', 1100);
  t.check('but "what about women" there still answers', /For women it is/.test((await seen(page)).answer));
  // "tell me more" opens the fold
  await read('how unequal is sweden');
  await read('have houses pulled away from pay in the netherlands?');
  await page.evaluate(() => scrollTo(0, 0)); await page.fill('#q', 'tell me more'); await page.press('#q', 'Enter'); await page.waitForTimeout(600);
  t.check('"tell me more" opens what is folded under the answer', await page.evaluate(() => !!document.querySelector('#answer details.more[open]')));

  // in dark mode nothing is drawn darker than the page can show
  const dark = await t.page({ dark: true });
  await ask(dark, 'wealth inequality sweden vs denmark since 2000', 1500);
  const cols = await dark.evaluate(() => (document.getElementById('chart').data || []).map(tr => tr.line && tr.line.color).filter(Boolean));
  const lum = h => { const n = parseInt(h.slice(1), 16); return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
  t.check('in dark mode every line is bright enough to see', cols.length >= 2 && cols.filter(c => /^#/.test(c)).every(c => lum(c) > 70), cols.join(' '));
}
