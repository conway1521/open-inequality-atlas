// the spelling correction: slips are taken out, real names are never touched
export default async function (t) {
  const page = await t.page();
  const fix = q => page.evaluate(q => spellFix(q).text, q);
  const MUST = [
    ['how rich is norwey', 'how rich is norway'], ['equality sweeden', 'equality sweden'],
    ['inequlaity germny', 'inequality germany'], ['income gap in itlay', 'income gap in italy'],
    ['what is weath', 'what is wealth'], ['poorst country', 'poorest country'], ['pobreza', 'poverty'],
    ['south afrika', 'south africa'], ['new zeland', 'new zealand'], ['wages in canda', 'wages in canada'],
  ];
  for (const [q, want] of MUST) t.check(`"${q}" reads as "${want}"`, (await fix(q)) === want, await fix(q));
  // names that are one letter from another name, and words that are not slips
  for (const q of ['iran', 'austria', 'chile', 'niger', 'gary stevenson', 'is the economy rigged', 'detroit', 'hello'])
    t.check(`"${q}" is left alone`, (await fix(q)) === q, await fix(q));
}
