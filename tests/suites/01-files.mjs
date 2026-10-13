// the files themselves, before any browser: the house style, the data, the script
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

export default async function (t) {
  // no em or en dashes anywhere a reader will see
  const prose = ['index.html', 'README.md', 'FOUNDATION.md', 'data/raw/README.md'];
  for (const f of prose) {
    const text = readFileSync(join(t.root, f), 'utf8');
    const n = [...text].filter(c => c === '—' || c === '–').length;
    t.check(`${f} has no em or en dashes`, n === 0, `${n} found`);
  }
  // every data file parses the way the page parses it (the pipeline writes bare NaN)
  for (const f of readdirSync(join(t.root, 'data')).filter(f => f.endsWith('.json'))) {
    let ok = true, why = '';
    try { JSON.parse(readFileSync(join(t.root, 'data', f), 'utf8').replace(/\bNaN\b/g, 'null')); }
    catch (e) { ok = false; why = e.message; }
    t.check(`data/${f} parses`, ok, why);
  }
  // the engine lives in js/, one file per part, loaded by the page in a fixed order.
  // every file in js/ must be loaded, none twice, and each must compile on its own
  const html = readFileSync(join(t.root, 'index.html'), 'utf8');
  const loaded = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);
  const files = readdirSync(join(t.root, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f);
  t.check('the page loads every file in js/', files.every(f => loaded.includes(f)), files.filter(f => !loaded.includes(f)).join(' '));
  t.check('and loads none of them twice', new Set(loaded).size === loaded.length);
  t.check('it starts with the data and ends with the app', loaded[0] === 'js/data.js' && loaded[loaded.length - 1] === 'js/app.js', loaded.join(' '));
  for (const f of loaded) {
    let ok = true, why = '';
    try { new vm.Script(readFileSync(join(t.root, f), 'utf8'), { filename: f }); } catch (e) { ok = false; why = e.message; }
    t.check(`${f} compiles`, ok, why);
  }
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  inline.forEach((s, i) => {
    let ok = true, why = '';
    try { new vm.Script(s); } catch (e) { ok = false; why = e.message; }
    t.check(`inline script ${i + 1} compiles`, ok, why);
  });
  t.check('the stylesheet is linked', /<link rel="stylesheet" href="css\/atlas.css">/.test(html));
}
