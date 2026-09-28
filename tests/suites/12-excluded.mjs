// Israel is not in the atlas. Asked for by name, or misspelled, the page says so plainly
// rather than answering nothing or reading the name as some other country.
import { ask, seen } from '../lib.mjs';

export default async function (t) {
  const page = await t.page();
  for (const q of ['israel', 'how unequal is israel', 'isreal wealth', 'israeli income', 'house prices in israel']) {
    await page.fill('#q', ''); await page.click('#q'); await page.keyboard.type(q, { delay: 5 }); await page.waitForTimeout(450);
    const line = await page.evaluate(() => { const l = document.getElementById('readline'); return l.hidden ? '' : l.textContent; });
    t.check(`"${q}" is read, before sending, as a country the atlas does not include`, /does not include/.test(line), line);
    await ask(page, q, 800);
    const s = await seen(page);
    t.check(`"${q}" says the atlas does not include Israel`, /does not include Israel/.test(s.notice), s.notice || s.answer.slice(0, 100));
  }
  const inPool = await page.evaluate(() => Object.keys(BY_ISO).includes('ISR') || Object.values(SERIES).some(s => s && s.ISR));
  t.check('no series the page loaded carries Israel', !inPool);
}
