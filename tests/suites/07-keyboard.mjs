// Keyboard only, and what a screen reader is told.
import { ask } from '../lib.mjs';

export default async function (t) {
  const page = await t.page();
  await page.focus('#q'); await page.keyboard.press('Tab');
  t.check('Tab moves on and leaves the box empty', (await page.inputValue('#q')) === '');
  await page.focus('#q'); await page.keyboard.press('ArrowRight');
  t.check('the right arrow drops the example in', (await page.inputValue('#q')).length > 10);
  await page.fill('#q', ''); await page.click('#fillhint');
  t.check('"edit this" drops the example in', (await page.inputValue('#q')).length > 10);

  await page.fill('#q', ''); await page.keyboard.press('/');
  await page.keyboard.type('how unequal is the uk'); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  t.check('a question typed and sent by keyboard answers', /United Kingdom/.test(await page.textContent('#answer')));
  t.check('the answer is announced', (await page.getAttribute('#answer', 'aria-live')) === 'polite');
  t.check('notices are announced', (await page.getAttribute('#notice', 'aria-live')) === 'polite');

  await page.focus('#rib-place .rib-head'); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  t.check('Enter opens a fold', await page.evaluate(() => !document.getElementById('rib-drawer').hidden));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  t.check('Escape closes it', await page.evaluate(() => document.getElementById('rib-drawer').hidden));

  // the line under the box says how a question will be read before it is sent
  await page.fill('#q', ''); await page.click('#q'); await page.keyboard.type('how rich is norwey', { delay: 5 }); await page.waitForTimeout(500);
  const line = await page.evaluate(() => { const l = document.getElementById('readline'); return l.hidden ? '' : l.textContent; });
  t.check('the read line names the country and the slip', /Norway/.test(line) && /norwey/.test(line), line);
  await page.click('#readline .rl-use'); await page.waitForTimeout(150);
  t.check('"fix it" corrects the box', (await page.inputValue('#q')) === 'how rich is norway');
  await page.press('#q', 'Enter'); await page.waitForTimeout(900);
  t.check('the read line goes once the question is sent', await page.evaluate(() => document.getElementById('readline').hidden));
}
