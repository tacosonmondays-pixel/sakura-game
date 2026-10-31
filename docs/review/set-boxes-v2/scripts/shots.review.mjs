import { createServer } from 'vite';
import { createRequire } from 'node:module';
const OUT = 'docs/review/set-boxes-v2/shots';
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const require = createRequire('/opt/node22/lib/node_modules/playwright/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const notes = [];
const note = (m) => { console.log(m); notes.push(m); };
for (const [W, H] of [[390, 844], [844, 390]]) {
  const tag = `${W}x${H}`;
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const shot = async (n) => { await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/${n}-${tag}.jpg`, type: 'jpeg', quality: 62 }); };
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 15000 }).catch(() => null);
  if (later) { await later.click({ force: true }); await page.waitForTimeout(500); }
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(400); const ov = page.locator('.modal-overlay'); if (!(await ov.count())) break; const b = ov.last().locator('.modal-actions button').last(); if (await b.count()) await b.click({ force: true }).catch(() => {}); else await page.keyboard.press('Escape'); }
  await page.evaluate(() => {
    const { store } = window.__sakura; const p = store.profile;
    Object.assign(p.items, { setbox_popper_legendary_random: 25, setbox_pick_mythic_random: 3, setbox_popper_legendary: 4, setbox_geometry_ur_random: 2, setbox_pick_ur: 2 });
    store.commit('test');
  });
  const closeModals = async () => { for (let i = 0; i < 4; i++) { const b = page.locator('.modal-actions button').last(); if (await b.count()) await b.click().catch(() => {}); await page.waitForTimeout(250); } };
  const supplies = async () => {
    await page.evaluate(() => { location.hash = '#/lobby'; }); await page.waitForTimeout(300);
    await page.evaluate(() => { location.hash = '#/backpack?tab=equipment'; });
    await page.waitForSelector('[data-testid="supplies-open"]', { timeout: 15000 });
    for (let i = 0; i < 5; i++) { const ov = page.locator('.modal-overlay'); if (!(await ov.count())) break; note(`overlay: ${(await ov.last().innerText()).slice(0, 60).replace(/\s+/g, ' ')}`); const b = ov.last().locator('.modal-actions button').last(); if (await b.count()) await b.click({ force: true }).catch(() => {}); else await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    await page.locator('[data-testid="supplies-open"]').click();
    await page.waitForSelector('[data-testid="box-setbox_popper_legendary_random"]', { timeout: 10000 });
  };
  await supplies();
  note(`${tag} random row: ${(await page.locator('[data-testid="box-setbox_popper_legendary_random"]').innerText()).replace(/\s+/g, ' ')}`);
  note(`${tag} preset row: ${(await page.locator('[data-testid="box-setbox_popper_legendary"]').innerText()).replace(/\s+/g, ' ')}`);
  note(`${tag} UR row: ${(await page.locator('[data-testid="box-setbox_geometry_ur_random"]').innerText()).replace(/\s+/g, ' ')}`);
  await shot('01-supplies');
  await page.locator('[data-testid="box-setbox_geometry_ur_random"]').scrollIntoViewIfNeeded();
  await shot('01b-supplies-scrolled');
  // Open all (20 of 25)
  await page.locator('[data-testid="set-box-open-all-setbox_popper_legendary_random"]').click();
  await page.waitForSelector('[data-testid="set-box-results"]', { timeout: 10000 });
  note(`${tag} open-all opened=${await page.locator('[data-testid="set-box-results"]').getAttribute('data-opened')} left=${await page.evaluate(() => window.__sakura.store.profile.items.setbox_popper_legendary_random)}`);
  await shot('02-results-openall');
  await page.locator('[data-testid="set-box-results-ok"]').click(); await page.waitForTimeout(300);
  // Open ×1 (one box: card grid)
  await page.locator('[data-testid="set-box-open-setbox_popper_legendary_random"]').click();
  await page.waitForSelector('[data-testid="set-box-results"]', { timeout: 10000 });
  await shot('03-results-one');
  await page.locator('[data-testid="set-box-results-ok"]').click(); await page.waitForTimeout(300);
  // UR ×2
  await page.locator('[data-testid="set-box-open10-setbox_geometry_ur_random"]').click();
  await page.waitForSelector('[data-testid="set-box-results"]', { timeout: 10000 });
  await shot('04-results-ur');
  await page.locator('[data-testid="set-box-results-ok"]').click(); await page.waitForTimeout(300);
  // random pick box: modal
  await supplies();
  await page.locator('[data-testid="set-box-open-setbox_pick_mythic_random"]').click();
  await page.waitForSelector('[data-testid="set-box-modal"][data-kind="random"]', { timeout: 10000 });
  await page.locator('[data-testid="set-box-set-spirit"]').click();
  note(`${tag} random-pick count line: ${await page.locator('[data-testid="set-box-count"]').innerText()}; main rows: ${await page.locator('[data-testid^="set-box-main-"]').count()}`);
  await shot('05-modal-random-pick');
  await page.locator('[data-testid="set-box-count-3"]').click().catch(() => note(`${tag} no count-3 button`));
  await page.locator('[data-testid="set-box-open"]').click();
  await page.waitForSelector('[data-testid="set-box-results"]', { timeout: 10000 });
  note(`${tag} random-pick opened=${await page.locator('[data-testid="set-box-results"]').getAttribute('data-opened')} set=${await page.locator('[data-testid="set-box-results"]').getAttribute('data-set')}`);
  await page.locator('[data-testid="set-box-results-ok"]').click(); await page.waitForTimeout(300);
  // preset: modal + confirm
  await supplies();
  await page.locator('[data-testid="set-box-open10-setbox_popper_legendary"]').click();
  await page.waitForSelector('[data-testid="set-box-modal"][data-kind="preset"]', { timeout: 10000 });
  await shot('06-modal-preset');
  await page.locator('.modal [data-testid="set-box-modal"]').evaluate((el) => { const s = el.closest('.modal-body') || el.parentElement; s.scrollTop = 9999; });
  await shot('06b-modal-preset-bottom');
  await page.locator('[data-testid="set-box-open"]').click();
  await page.waitForSelector('[data-testid="confirm-ok"]', { timeout: 10000 });
  note(`${tag} preset confirm: ${(await page.locator('.modal').last().innerText()).replace(/\s+/g, ' ')}`);
  await shot('07-preset-confirm');
  await page.locator('[data-testid="confirm-ok"]').click();
  await page.waitForSelector('[data-testid="set-box-results"]', { timeout: 10000 });
  await shot('08-results-preset');
  await page.locator('[data-testid="set-box-results-ok"]').click(); await page.waitForTimeout(300);
  await closeModals();
  // Supply Bot, mounted directly (its dev-clan gate is out of scope)
  await page.evaluate(async () => {
    document.querySelectorAll('.modal, .sheet').forEach((e) => e.remove());
    const { createSupplyBot } = await import('/src/ui/online/supplyBot.js');
    const host = document.createElement('div'); host.id = 'zzsb';
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:auto;background:#fff;padding:8px';
    host.appendChild(createSupplyBot().el); document.body.appendChild(host);
  });
  await page.locator('#zzsb .ol-seg-btn', { hasText: 'Equipment' }).click();
  for (const id of ['setbox_popper_legendary', 'setbox_geometry_ur_random', 'setbox_pick_ur', 'tie_pin']) {
    await page.locator(`#zzsb [data-item="${id}"]`).first().click();
    note(`${tag} supply bot ${id}: ${(await page.locator('#zzsb .ol-sb-picked').innerText()).replace(/\s+/g, ' ')}`);
    if (id === 'setbox_popper_legendary') { await page.locator('#zzsb .ol-sb-picked').scrollIntoViewIfNeeded(); await shot('09-supplybot-preset'); }
    if (id === 'setbox_geometry_ur_random') { await shot('10-supplybot-ur-random'); }
  }
  note(`${tag} page errors: ${errs.length} ${errs[0] || ''}`);
  await page.close();
}
await browser.close(); await server.close();
