// Runs every suite in tests/suites against the real page in a real browser, and exits
// non-zero if any check fails. The checks are the ones the usability runs were built
// from: they drive the page through its own controls and look at what is on screen.
//
//   cd tests && npm install && npx playwright install chromium && npm test
//   node run.mjs typed phone      run only the suites whose names are given
//
// PW_EXECUTABLE   a Chromium to use instead of Playwright's own
// PLOTLY_FILE     a local copy of plotly.min.js, for machines that cannot reach the CDN
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.csv': 'text/csv', '.md': 'text/plain' };

// the page is static: one HTML file and data/*.json, so a few lines serve it
function serve() {
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    try {
      if (!statSync(file).isFile()) throw new Error();
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

const only = process.argv.slice(2);
const suites = readdirSync(join(HERE, 'suites')).filter(f => f.endsWith('.mjs')).sort()
  .filter(f => !only.length || only.includes(f.replace(/\.mjs$/, '')));

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {});
const plotly = process.env.PLOTLY_FILE ? readFileSync(process.env.PLOTLY_FILE, 'utf8') : null;

let failed = 0, passed = 0;
const failures = [];
for (const file of suites) {
  const name = file.replace(/\.mjs$/, '');
  const contexts = [];
  const errors = [];
  const t = {
    base, root: ROOT,
    // a fresh page on the atlas, loaded and ready. phone: true gives a 390 by 844 touch screen
    async page({ phone = false, dark = false, hash = '', width, height } = {}) {
      const ctx = await browser.newContext(phone
        ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: dark ? 'dark' : 'light' }
        : { viewport: { width: width || 1280, height: height || 900 }, colorScheme: dark ? 'dark' : 'light' });
      contexts.push(ctx);
      ctx.setDefaultTimeout(8000);
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(e.message));
      if (plotly) await page.route('**/plotly*.js', r => r.fulfill({ contentType: 'application/javascript', body: plotly }));
      await page.route('**fonts.googleapis.com**', r => r.fulfill({ contentType: 'text/css', body: '' }));
      await page.route('**fonts.gstatic.com**', r => r.fulfill({ status: 204, body: '' }));
      await page.goto(base + hash, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof DATA_READY !== 'undefined' && DATA_READY, null, { timeout: 30000 });
      await page.waitForTimeout(300);
      return page;
    },
    check(label, ok, detail) {
      if (ok) { passed++; return true; }
      failed++; failures.push(`${name}: ${label}${detail ? '\n      ' + String(detail).slice(0, 300) : ''}`);
      console.log(`  FAIL ${label}${detail ? '  (' + String(detail).slice(0, 160) + ')' : ''}`);
      return false;
    },
  };
  const t0 = Date.now();
  console.log(`\n== ${name}`);
  try {
    const mod = await import(join(HERE, 'suites', file));
    await mod.default(t);
  } catch (e) {
    t.check('the suite ran to the end', false, e.stack || e.message);
  }
  t.check('no errors in the page', errors.length === 0, errors.slice(0, 3).join(' | '));
  for (const c of contexts) await c.close().catch(() => {});
  console.log(`   ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) { console.log('\nfailures:\n  ' + failures.join('\n  ')); process.exit(1); }
