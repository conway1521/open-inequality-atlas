// Every question the atlas offers must answer when pressed: the ones in notices, the
// whole catalogue (from the first screen and after an answer), and the next steps under
// forty rolled answers. In the first usability run 17 of 98 next steps refused.
import { ask, seen } from '../lib.mjs';

const answered = page => page.evaluate(() => stage === 'result' && !document.getElementById('session').hidden);

export default async function (t) {
  const page = await t.page();

  // suggestions inside notices
  const triggers = ['my county', 'what is the gini coefficient', 'what is the median', 'what is a lorenz curve', 'billionaires',
    'wealth tax', 'inflation', 'scotland', 'hello', 'gary stevenson', 'what is this'];
  for (const trig of triggers) {
    await ask(page, trig, 400);
    const qs = await page.evaluate(() => document.getElementById('notice').hidden ? []
      : [...document.querySelectorAll('#notice .opt-near')].map(b => b.dataset.q));
    for (const q of qs) {
      await ask(page, trig, 350);
      await page.evaluate(q => { const b = [...document.querySelectorAll('#notice .opt-near')].find(x => x.dataset.q === q); b && b.click(); }, q);
      await page.waitForTimeout(600);
      t.check(`"${q}", offered after "${trig}", answers`, await answered(page), (await seen(page)).notice);
    }
  }

  // the catalogue, every question, alternately from the first screen and after an answer
  const items = await page.evaluate(() => [...new Set(QUESTIONS.flatMap(g => g.qs))]);
  for (const [i, q] of items.entries()) {
    if (i % 2) await ask(page, 'how unequal is the uk', 350);
    else { await page.evaluate(() => resetAll()); await page.waitForTimeout(250); }
    await page.fill('#q', ''); await page.click('#q'); await page.waitForTimeout(200);
    const found = await page.evaluate(q => { const b = [...document.querySelectorAll('#help .q-item')].find(x => x.textContent === q);
      if (!b) return false; b.click(); return true; }, q);
    await page.waitForTimeout(500);
    t.check(`catalogue "${q}" is listed and answers in one click`, found && await answered(page), found ? (await seen(page)).notice : 'not in the list');
  }

  // forty rolls, one next step pressed under each
  let rolls = 0;
  for (let r = 0; r < 40; r++) {
    await page.evaluate(() => scrollTo(0, 0)); await page.click('#shake'); await page.waitForTimeout(1400);
    if (await answered(page)) rolls++;
    const chips = await page.$$('#next .chip'); if (!chips.length) continue;
    const c = chips[r % chips.length]; const label = await c.textContent(); const from = await page.evaluate(() => location.hash);
    await c.evaluate(e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(150);
    await c.click(); await page.waitForTimeout(600);
    t.check(`next step "${label}" answers (from ${from})`, await answered(page), (await seen(page)).notice);
  }
  t.check('forty rolls all answer', rolls === 40, `${rolls} of 40`);
}
