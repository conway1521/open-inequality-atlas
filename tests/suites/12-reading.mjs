// What an answer shows before anything is opened: a sentence or two, the chart, and at
// most one short line on how the question was read. The working and the source are a
// tap away, never gone.
import { ask, seen } from '../lib.mjs';

export default async function (t) {
  const page = await t.page();
  const qs = await page.evaluate(() => [...new Set(QUESTIONS.flatMap(g => g.qs))]);
  const long = [], many = [];
  for (const q of qs.concat(['how rich is norwey', 'have houses pulled away from pay in the netherlands?', 'detroit'])) {
    await page.evaluate(() => resetAll());
    await ask(page, q, 700);
    const r = await page.evaluate(() => {
      const a = document.getElementById('answer'), L = a.querySelector('.lead');
      return { words: L ? L.textContent.trim().split(/\s+/).length : 0, notes: a.querySelectorAll('.notes em.readas').length,
        noteWords: [...a.querySelectorAll('.notes')].map(n => n.textContent.trim().split(/\s+/).length)[0] || 0 };
    });
    if (r.words > 45) long.push(`${q} (${r.words})`);
    if (r.notes > 1 || r.noteWords > 30) many.push(`${q} (${r.noteWords} words)`);
  }
  t.check('every answer leads with at most about 45 words', !long.length, long.join('; '));
  t.check('how a question was read fits on one short line', !many.length, many.join('; '));

  // "did it move differently from comparable countries?" picks a country when none is
  // named; it used to refuse whenever the pick's record ran further than its peers'
  const refused = await page.evaluate(async () => {
    const out = [];
    for (const face of ['wealth', 'income']) for (const iso of Object.keys(BY_ISO)) {
      resetAll(); chooseFacet(face); ctx.lastIso = iso;
      if (!runPrompt('did it move differently from comparable countries?')) continue;
      sendCell(); await new Promise(r => setTimeout(r, 30));
      const n = document.getElementById('notice');
      if (!n.hidden && /Too few comparable|No data for that one/.test(n.textContent)) out.push(face + ':' + iso);
    }
    return out;
  });
  t.check('the peer comparison answers for every country on both faces', !refused.length, refused.join(' '));

  await ask(page, 'how unequal is the uk', 900);
  const src = await page.evaluate(() => { const d = document.getElementById('src-fold');
    return d ? { open: d.open, text: document.getElementById('chart-src').textContent } : null; });
  t.check('the source sits under the chart, folded', src && !src.open, JSON.stringify(src));
  t.check('and it is there when opened', src && /Source/.test(src.text), src && src.text.slice(0, 80));
  await ask(page, 'have houses pulled away from pay in the netherlands?', 900);
  const s = await seen(page);
  t.check('the working is still in the answer, under "more"', /more, and how it is worked out/.test(s.answer));
}
