// A 390 by 844 touch screen: nothing wider than the screen, the answer lands where it
// can be read after a question, a roll or a next step, and charts are not covered.
import { ask, onScreen } from '../lib.mjs';

const width = page => page.evaluate(() => document.documentElement.scrollWidth);

export default async function (t) {
  const page = await t.page({ phone: true });
  t.check('the first screen fits the phone', (await width(page)) <= 391, await width(page));
  const box = await page.evaluate(() => document.getElementById('q').getBoundingClientRect().top);
  t.check('the question box is on the first screen', box < 800, box);

  // typed questions and rolls: after the scroll settles, the answer's first line is in view
  for (const q of ['how rich is norwey', 'usa', 'what does the bottom half own in france', 'detroit']) {
    await ask(page, q, 2600);
    t.check(`"${q}" lands in view`, await onScreen(page, '#answer'), await page.evaluate(() => Math.round(document.getElementById('answer').getBoundingClientRect().top)));
    t.check(`"${q}" fits the phone`, (await width(page)) <= 391, await width(page));
  }
  let inView = 0, steps = 0;
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => scrollTo(0, 0)); await page.tap('#shake'); await page.waitForTimeout(2600);
    t.check(`roll ${i + 1} lands in view`, await onScreen(page, '#answer'));
    const chips = await page.$$('#next .chip'); if (!chips.length) continue;
    await chips[i % chips.length].evaluate(e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
    await chips[i % chips.length].tap(); await page.waitForTimeout(2600); steps++;
    if (await onScreen(page, '#answer') || await onScreen(page, '#notice')) inView++;
  }
  t.check('next steps tapped on a phone land in view', inView === steps, `${inView} of ${steps}`);

  // the chart title sits above the chart, not over it
  const cover = await page.evaluate(() => {
    const ti = document.getElementById('chart-title').getBoundingClientRect(), ch = document.getElementById('chart').getBoundingClientRect();
    return ti.bottom - ch.top;
  });
  t.check('the chart title does not cover the chart', cover <= 2, cover);

  // the reference pages keep their side margins and fit
  for (const v of ['why', 'wealth', 'income', 'wellbeing', 'opportunity', 'db']) {
    await page.evaluate(v => setView(v), v); await page.waitForTimeout(300);
    const left = await page.evaluate(v => { const h = document.querySelector('#view-' + v + ' h1'); return h ? Math.round(h.getBoundingClientRect().left) : 99; }, v);
    t.check(`the ${v} page has a side margin`, left >= 12, left);
    t.check(`the ${v} page fits the phone`, (await width(page)) <= 391, await width(page));
  }
}
