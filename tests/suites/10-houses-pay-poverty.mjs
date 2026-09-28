// The OECD house prices and productivity, and the relative poverty line: each answers
// where it is held, says so by name where it is not, and never claims more than an
// index against a country's own past can carry.
import { ask, seen } from '../lib.mjs';

export default async function (t) {
  const page = await t.page();
  const read = async (q, wait = 900) => { await ask(page, q, wait); return seen(page); };

  let s = await read('have houses pulled away from pay in the netherlands?');
  t.check('houses against pay reads a country beyond the UK and US', /the Netherlands from \d{4}/.test(s.answer), s.answer.slice(0, 140));
  t.check('and gives the OECD price to income ratio beside it', /On the OECD's own measure, a house against disposable income per person/.test(s.answer), s.answer.slice(0, 300));

  s = await read('house prices in nigeria');
  t.check('a country outside the OECD series is named, with how many are held', /\d+ countries from the OECD/.test(s.notice) && /Nigeria/.test(s.notice), s.notice);

  s = await read('which country has the most expensive houses?');
  t.check('"most expensive houses" says an index cannot rank price levels', /cannot say where a house costs most/.test(s.notice), s.notice || s.answer.slice(0, 140));

  s = await read('price to income ratio');
  t.check('a ranking of the ratio says it is against 2015', /\(2015 = 100\)/.test(s.answer), s.answer.slice(0, 140));

  s = await read('did the growth reach the typical person in the us?');
  t.check('growth against the middle uses output per hour where the OECD has it', /output per hour worked grew/.test(s.answer), s.answer.slice(0, 140));
  s = await read('did the growth reach the typical person in brazil?');
  t.check('and says it fell back to output per person where it does not', /output per person grew/.test(s.answer) && /does not measure output per hour here/.test(s.answer), s.answer.slice(0, 140));

  s = await read('productivity in germany');
  t.check('productivity answers as output per hour worked', /Germany: output per hour worked \$\d+/.test(s.answer), s.answer.slice(0, 140));

  s = await read('gdp per person in france');
  t.check('"gdp per person" is GDP, not the top 1% multiple', /France: GDP per person/.test(s.answer), s.answer.slice(0, 140));

  s = await read('relative poverty in the uk');
  t.check('relative poverty answers on the half-the-median line', /United Kingdom: relative poverty \d+\.\d%/.test(s.answer), s.answer.slice(0, 140));

  s = await read('poverty in sweden');
  t.check('the $2.15 line at its floor gives the relative figure too', /half of what the person in the middle has, counts \d+\.\d% of Sweden/.test(s.answer), s.answer.slice(-260));

  s = await read('house prices in czechia');
  t.check('Czechia is not "the Czechia"', !/the Czechia/.test(s.answer), s.answer.slice(0, 100));

  // nothing on the reference pages still says house prices are two countries
  const pages = await page.evaluate(() => document.body.textContent);
  t.check('no page still says houses are two countries', !/two countries (only|hold|carry|here)|Houses are two countries/i.test(pages));
}
