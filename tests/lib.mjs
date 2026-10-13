// what the suites share: asking the way a person asks, and reading what is on screen

// type a question into the box and press enter, as a person would
export async function ask(page, q, wait = 700) {
  await page.evaluate(() => scrollTo(0, 0));
  await page.fill('#q', q);
  await page.press('#q', 'Enter');
  await page.waitForTimeout(wait);
}

// what a reader can see: the answer if one is showing, the notice if one is
export function seen(page) {
  return page.evaluate(() => {
    const vis = el => el && !el.hidden && el.getBoundingClientRect().height > 0;
    const s = document.getElementById('session'), a = document.getElementById('answer'), n = document.getElementById('notice');
    return {
      stage, face: curFacet, places: cell.places.join(','), view: cell.view || cell.form || '',
      answer: vis(s) ? a.textContent.replace(/\s+/g, ' ').trim() : '',
      notice: vis(n) ? n.textContent.replace(/\s+/g, ' ').trim() : '',
      traces: (document.getElementById('chart').data || []).length,
      hash: location.hash,
    };
  });
}

// true when the element's top sits on screen, below the minibar when it shows
export function onScreen(page, sel) {
  return page.evaluate(sel => {
    const el = document.querySelector(sel); if (!el || el.hidden) return false;
    const r = el.getBoundingClientRect();
    // the deck scrolls away; what can cover the top of the screen is the minibar
    const bar = document.getElementById('minibar');
    const floor = bar && bar.classList.contains('on') ? bar.getBoundingClientRect().bottom - 4 : -4;
    return r.top >= floor && r.top < innerHeight - 40;
  }, sel);
}
