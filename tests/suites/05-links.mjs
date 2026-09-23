// A copied link reopens the same answer, and Back steps to the answer before.
import { ask, seen } from '../lib.mjs';

export default async function (t) {
  const page = await t.page();
  const cases = [
    ['a typed question', async p => ask(p, 'what does the poorest half own in sweden', 900)],
    ['a roll', async p => { await p.click('#shake'); await p.waitForTimeout(1600); }],
    ['a US place', async p => ask(p, 'detroit', 900)],
    ['the whole world', async p => ask(p, 'most equal country in the world', 900)],
  ];
  for (const [label, act] of cases) {
    const p = await t.page();
    await act(p);
    const before = (await seen(p)).answer.slice(0, 120);
    // the address bar carries the answer; copy link copies the same thing
    const url = await p.evaluate(() => location.href);
    t.check(`the address for ${label} names the answer`, url.includes('#'), url);
    const q = await t.page({ hash: url.slice(url.indexOf('#')) });
    await q.waitForTimeout(800);
    const after = (await seen(q)).answer.slice(0, 120);
    t.check(`a link to ${label} reopens the same answer`, before && after === before, `${before}\n      got: ${after}`);
  }
  // back
  await ask(page, 'uk'); await ask(page, 'france');
  await page.goBack(); await page.waitForTimeout(900);
  const back = await seen(page);
  t.check('Back returns to the answer before', /United Kingdom/.test(back.answer), back.answer.slice(0, 100));
}
