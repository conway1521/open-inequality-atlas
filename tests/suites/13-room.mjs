// After a question the answer gets the screen. The deck used to stay pinned at 382
// pixels, more than half of a 720 pixel laptop; now it scrolls away and a 44 pixel bar
// says what is on screen and leads back to the box.
import { ask } from '../lib.mjs';

export default async function (t) {
  for (const [w, h] of [[1280, 720], [1440, 900]]) {
    const page = await t.page({ width: w, height: h });
    await ask(page, 'have houses pulled away from pay in the netherlands?', 2600);
    const m = await page.evaluate(() => ({ lead: document.querySelector('#answer .lead').getBoundingClientRect().top,
      chart: document.getElementById('chart').getBoundingClientRect().bottom, vh: innerHeight }));
    t.check(`at ${w}x${h} the answer and its whole chart are on screen`, m.lead >= 40 && m.chart <= m.vh, JSON.stringify(m));
    await page.mouse.wheel(0, 900); await page.waitForTimeout(600);
    const bar = await page.evaluate(() => { const b = document.getElementById('minibar'); const r = b.getBoundingClientRect();
      return { on: b.classList.contains('on'), top: r.top, h: r.height, text: document.getElementById('mb-text').textContent }; });
    t.check(`at ${w}x${h}, scrolled down, the bar is at the top and 44 pixels tall`, bar.on && bar.top === 0 && bar.h <= 48, JSON.stringify(bar));
    t.check('and it says what is on screen', /Netherlands/.test(bar.text) && /houses against pay/.test(bar.text), bar.text);
    await page.click('#mb-ask'); await page.waitForTimeout(900);
    const back = await page.evaluate(() => ({ y: scrollY, focused: document.activeElement && document.activeElement.id }));
    t.check('"ask or change" goes back up to the box, ready to type', back.y < 5 && back.focused === 'q', JSON.stringify(back));
    const off = await page.evaluate(() => document.getElementById('minibar').classList.contains('on'));
    t.check('and the bar goes once the box is in view', !off);
  }
}
