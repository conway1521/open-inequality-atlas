// Every question offered on a reference page answers from that page, and every page
// has a way back to asking.
import { seen } from '../lib.mjs';

export default async function (t) {
  const page = await t.page();
  const views = ['why', 'wealth', 'income', 'wellbeing', 'opportunity', 'db'];
  for (const v of views) {
    await page.evaluate(v => setView(v), v); await page.waitForTimeout(300);
    const chips = await page.$$eval(`#view-${v} .try .chip`, cs => cs.map(c => c.textContent));
    for (const q of chips) {
      await page.evaluate(v => setView(v), v); await page.waitForTimeout(200);
      await page.evaluate(([v, q]) => { const c = [...document.querySelectorAll(`#view-${v} .try .chip`)].find(x => x.textContent === q); c.click(); }, [v, q]);
      await page.waitForTimeout(700);
      const s = await seen(page);
      t.check(`"${q}" on the ${v} page answers`, s.stage === 'result' && !!s.answer, s.notice);
    }
  }
  await page.evaluate(() => setView('why'));
  await page.click('#deeper'); await page.waitForTimeout(200);
  await page.click('#tabs .tab[data-view="ask"]'); await page.waitForTimeout(300);
  t.check('the Ask tab goes back to asking', await page.isVisible('#q'));
}
