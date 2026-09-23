// US places, and the health face that reads them
import { ask, seen } from '../lib.mjs';

export default async function (t) {
  const page = await t.page();
  const find = q => page.evaluate(q => { const p = usPlaceFind(q); return p ? p.type + ':' + (p.name || '') + (p.stateName ? ',' + p.stateName : '') : null; }, q);
  const PLACES = [
    ['detroit', 'zone:Detroit'], ['social mobility in ohio', 'state:Ohio'], ['wayne county michigan', 'county:Wayne,Michigan'],
    ['wayne county', 'shared-county:Wayne'], ['columbus', 'shared-zone:Columbus'], ['atlanta georgia', 'zone:Atlanta'],
    ['inequality in new york city', 'zone:New York'], ['orleans parish', 'county:Orleans,Louisiana'],
    // names shared with somewhere abroad, or with an ordinary word, are not US places
    ['london', null], ['paris', null], ['gary stevenson', null], ['how many americans have negative wealth', null],
    ['georgia', null], ['uk vs us', null],
  ];
  for (const [q, want] of PLACES) t.check(`"${q}" is ${want || 'not a US place'}`, (await find(q)) === want, await find(q));

  // the health face: US only, and about the gap, never a national average
  await page.click('.fchip[data-facet="health"]'); await page.waitForTimeout(400);
  t.check('the health chip opens the face and says what it is', /United States only/.test((await seen(page)).notice));
  await ask(page, 'health', 900);
  let s = await seen(page);
  t.check('"health" answers with the rich-poor life gap', s.face === 'health' && /lives 8\.7 years less/.test(s.answer), s.answer.slice(0, 120));
  await ask(page, 'life expectancy gap in Detroit', 900);
  s = await seen(page);
  t.check('a US place on the health face leads with its life gap', /^In the Detroit commuting zone, a man of forty/.test(s.answer), s.answer.slice(0, 120));
  await ask(page, 'life expectancy in japan', 900);
  s = await seen(page);
  t.check('a country\'s life expectancy is answered as life expectancy', /Japan: life expectancy/.test(s.answer), s.answer.slice(0, 120));
  await ask(page, 'social mobility', 900);
  t.check('mobility goes to the opportunity face', (await seen(page)).face === 'opportunity');
}
