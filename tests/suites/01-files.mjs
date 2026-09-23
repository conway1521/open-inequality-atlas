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
  // every inline script compiles
  const html = readFileSync(join(t.root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  t.check('the page has its inline engine', scripts.some(s => s.length > 100000));
  scripts.forEach((s, i) => {
    let ok = true, why = '';
    try { new vm.Script(s); } catch (e) { ok = false; why = e.message; }
    t.check(`inline script ${i + 1} compiles`, ok, why);
  });
}
