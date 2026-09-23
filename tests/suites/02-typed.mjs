// Questions typed the way people type them, in one session so that one answer can leak
// into the next. Each must put the right thing on screen and not the wrong one.
import { ask, seen } from '../lib.mjs';

const QS = [
  // [question, must be on screen, must not be]
  ['is the uk unequal', /United Kingdom/, /0th/],
  ['how unequal is britain', /United Kingdom/],
  ['uk', /United Kingdom/],
  ['is inequality getting worse', /rises|rose|biggest/i, /Australia: the top/],
  ['is it getting worse in the uk', /United Kingdom/],
  ['has inequality gone up since 2008', /2008/],
  ['which country is most unequal', /Highest/],
  ['where is it worst', /Highest/],
  ['most equal country', /Lowest/, /Highest/],
  ['compare uk and france', /United Kingdom.*France/],
  ['uk vs us', /United Kingdom.*United States/],
  ['what does the top 1% own', /top 1%/, /poorest quarter/],
  ['how much do the richest 1% have', /top 1%|richest/i, /poorest quarter/],
  ['top 10%', /10%/, /the top 1% hold/],
  ['how much does the bottom half own in the uk', /United Kingdom/, /United States/],
  ['poorest half', /bottom 50%|half/i],
  ['house prices', /house/i],
  ['wages', /median|pay|earn/i, /Gini/],
  ['are wages going up', /median/i, /Gini/],
  ['what does the average person earn', /\$|median|middle/i, /Gini/],
  ['billionaires', /no count of billionaires/],
  ['wealth tax', /does not model taxes/],
  ['why does sweden have negative wealth', /Sweden/, /top 1% hold 27/],
  ['china', /China/, /0th/],
  ['india inequality', /India/, /0th/],
  ['brazil', /Brazil/, /0th/],
  ['south africa', /South Africa/, /Africa median/],
  ['life expectancy rich vs poor', /United States|US /, /Africa/],
  ['do poor people die younger', /United States|US /, /extreme poverty/],
  ['social mobility', /commuting zone/, /extreme poverty/],
  ['uk', /United Kingdom/, /commuting/],
  ['gary stevenson', /does not follow people/],
  ['what is the gini coefficient', /Gini coefficient is/],
  ['explain this', /Could not read/],
  ['inequlity in brasil', /Brazil/],
  ['hello', /Could not read/],
  ['scotland', /United Kingdom as a whole/],
  ['what happened to the middle in france', /France/],
  // misspellings are read, and the answer says what they were read as
  ['how rich is norwey', /Norway.*Read "norwey" as Norway/],
  ['equality sweeden', /Sweden/],
  ['pobreza en brasil', /Brazil/],
  ['poorst country', /Lowest GDP per person/],
  // no country named: every country, or the region named, never one at random
  ['the rich', /ranks them all/, /picked at random/],
  ['wealth inequality in europe', /in Europe/, /richer third/],
  ['is wealth inequality worse than income inequality', /every one of the \d+ countries/],
  // a measure no face carries, asked of a country, is answered on that measure
  ['life expectancy in japan', /Japan: life expectancy/, /top 1% hold/],
  ['life expectancy japan vs us', /On life expectancy: Japan/],
  ['uk among all countries', /of all \d+ countries/],
  ['top 1% income share us 1980 vs now', /income share over time: United States .* from 1980/],
  ['how much has the uk top 1% share grown since 1980', /the record here starts in 1990/],
  // method and data
  ['sources', /World Inequality Database/],
  ['is this pre-tax or post-tax', /pretax national income/],
  ['csv', /CSV and Parquet/],
  // us places
  ['detroit', /Detroit/],
  ['wayne county michigan', /Wayne County, Michigan/],
  ['columbus', /commuting zones are called Columbus/],
];

export default async function (t) {
  const page = await t.page();
  for (const [q, want, not] of QS) {
    await ask(page, q);
    const s = await seen(page);
    const shown = s.answer + ' | ' + s.notice;
    t.check(`"${q}"`, want.test(shown) && !(not && not.test(shown)) && (s.answer || s.notice), shown.slice(0, 220));
  }
}
