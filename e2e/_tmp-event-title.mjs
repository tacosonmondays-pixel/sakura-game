import { launchChromium } from './browser.mjs';
// The Pumpkin Patroller title and the Pumpkin Lantern frame, end to end (owner, Oct 20: "pumpkin patroller title
// doesnt work"). On the dev preview clock (localStorage 'sakura-dev-now', dev builds only) and the local online
// adapter (?online=local): buy both in the Candy Exchange UI at their prices → Edit Profile → Title: the row is
// earned and reads "★ Pumpkin Patroller" on the Gold plate, the help line names the event exchanges → pick it and
// the frame → the plate under the name on your profile, in Preview and after a reload → the online card publishes
// both → a second player visiting #/profile/<id> sees the title plate and the frame. In v0.1.38 every one of those
// plates read "✦ —" on the Standard plate (src/ui/profile/parts.js titlePlate).
//
//   node e2e/event-title.mjs                         # 844x390 and 1280x720
//   node e2e/event-title.mjs --viewport 844x390 --shots /tmp/title
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const SHOTS = opt('shots', null);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const VIEWPORTS = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const require = createRequire(import.meta.url);
const { browser } = await launchChromium();
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); return c; };
const T = 60000;
const EV = 'halloween-2026';
const TITLE = 'ev_halloween_2026';
const PLATE = '★ Pumpkin Patroller';
const OPEN_DAY = '2026-10-20T19:00:00Z'; // Tue Oct 20, 2 PM CDT
const errors = [];
let tag = '';

/** Each page keeps its own save (two players in one browser context share localStorage otherwise). */
async function ownSave(page, id) {
  await page.addInitScript((who) => {
    const KEY = 'sakura-sentinels-save-v1';
    const mine = (k) => (k === KEY || k === `${KEY}.backup` ? `${k}#${who}` : k);
    const { getItem, setItem, removeItem } = Storage.prototype;
    Storage.prototype.getItem = function (k) { return getItem.call(this, this === window.localStorage ? mine(k) : k); };
    Storage.prototype.setItem = function (k, v) { return setItem.call(this, this === window.localStorage ? mine(k) : k, v); };
    Storage.prototype.removeItem = function (k) { return removeItem.call(this, this === window.localStorage ? mine(k) : k); };
  }, id);
}

async function openPage(ctx, name, { clear = false } = {}) {
  const page = await ctx.newPage();
  await ownSave(page, name);
  page.on('pageerror', (e) => errors.push(`${tag} [${name}] pageerror: ${e.message}`));
  await page.goto(`${base}?online=local&onboarding=0#/lobby`, { waitUntil: 'load' });
  if (clear) await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('sakura-dev-now', t); }, OPEN_DAY);
  await page.reload({ waitUntil: 'load' });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 20000 }).catch(() => null);
  if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 15000 }).catch(() => {}); }
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: T });
  return page;
}
const go = async (page, hash, sel) => {
  await page.bringToFront();
  await page.evaluate((x) => { location.hash = x; }, hash);
  if (sel) await page.waitForSelector(sel, { timeout: T });
  await page.waitForTimeout(500);
};
async function shot(page, name) {
  if (!SHOTS) return;
  await page.waitForSelector('.toast', { state: 'detached', timeout: 6000 }).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/${tag}-${name}.png`, timeout: 120000 }).catch(() => {});
}
const plateOf = (page, scope) => page.evaluate((sel) => {
  const el = document.querySelector(`${sel} [data-testid="profile-title"]`);
  return el ? { text: el.textContent.trim(), gold: el.classList.contains('tp-gold'), standard: el.classList.contains('tp-standard'), id: el.dataset.title } : null;
}, scope);
const frameOf = (page, scope) => page.evaluate((sel) => document.querySelector(`${sel} [data-testid="profile-avatar"]`)?.dataset.frame || null, scope);

async function setName(page, name) {
  await go(page, '#/clan');
  const inp = await page.waitForSelector('[data-testid="name-input"]', { timeout: 20000 }).catch(() => null);
  if (inp) {
    await page.fill('[data-testid="name-input"]', name);
    await page.locator('[data-testid="name-save"]').click();
    await page.waitForSelector('[data-testid="name-input"]', { state: 'detached', timeout: 10000 }).catch(() => {});
  }
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 4000 }).catch(() => null);
  if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 15000 }).catch(() => {}); }
  await page.waitForFunction(() => window.__online?.uid, null, { timeout: 20000 }).catch(() => {});
}

try {
  for (const vp of VIEWPORTS) {
    const [W, H] = vp.split('x').map(Number);
    tag = vp;
    console.log(`\n=== ${vp} ===`);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: W < 900, timezoneId: 'America/Chicago', reducedMotion: 'reduce' });
    const A = await openPage(ctx, `A-${vp}`, { clear: true });
    const clock = await A.evaluate(async () => new Date((await import('/src/ui/events/clock.js')).eventNow()).toISOString());
    check(clock.startsWith(OPEN_DAY.slice(0, 10)), `dev clock on (${clock})`);
    await A.evaluate(async () => {
      const { store } = window.__sakura;
      const inv = await import('/src/systems/inventory.js');
      const p = store.profile;
      for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) p.progress.stages[id] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
      inv.addItems(p, [{ id: 'evt_halloween_candy', count: 2600 }]);
      store.commit('test');
      store.saveNow?.();
    });

    // ---- 1. buy both in the Candy Exchange UI -----------------------------------------------------
    await go(A, `#/event/${EV}?tab=exchange`, '[data-testid="event-offer-hw_title"]');
    const prices = await A.evaluate(() => ['hw_title', 'hw_frame'].map((id) => document.querySelector(`[data-testid="event-buy-${id}"]`)?.textContent.replace(/\D/g, '')));
    check(prices.join(',') === '900,1500', `exchange: the title costs 900 and the frame 1,500 (${prices.join(', ')})`);
    for (const id of ['hw_title', 'hw_frame']) {
      await A.locator(`[data-testid="event-buy-${id}"]`).click();
      await A.locator('[data-testid="event-buy-confirm"]').click();
      await A.waitForTimeout(600);
    }
    const after = await A.evaluate(() => {
      const p = window.__sakura.store.profile;
      return { candy: p.items.evt_halloween_candy, owned: p.events.byId['halloween-2026'].owned, title: document.querySelector('[data-testid="event-offer-hw_title"]')?.textContent };
    });
    check(after.candy === 200, `exchange: 2,400 candy paid (${2600 - after.candy})`);
    check(after.owned.includes(`title:${TITLE}`) && after.owned.includes('frame:pumpkin'), 'exchange: title and frame owned');
    check(/Owned/.test(after.title || ''), 'exchange: the title card says Owned');
    await shot(A, '1-exchange');

    // ---- 2. Edit Profile → Title: earned, its name on the Gold plate --------------------------------
    await go(A, '#/profile', '[data-testid="profile"]');
    await A.locator('[data-testid="profile-edit"]').click();
    await A.waitForSelector('[data-testid="edit-profile"]', { timeout: 10000 });
    await A.locator('[data-testid="edit-tab-title"]').click();
    await A.waitForTimeout(300);
    const row = await A.evaluate((id) => {
      const b = document.querySelector(`[data-testid="edit-titles"] button[data-title="${id}"]`);
      const tp = b?.querySelector('.tp');
      return b ? { disabled: b.disabled, text: tp?.textContent.trim(), gold: tp?.classList.contains('tp-gold'), help: document.querySelector('.ep-help')?.textContent || '' } : null;
    }, TITLE);
    check(!!row && !row.disabled, 'picker: the title row is earned');
    check(row?.text === PLATE && row.gold, `picker: "${row?.text}" on the Gold plate`);
    check(/limited-event exchanges/.test(row?.help || '') && !/Nothing you buy gives a title/.test(row?.help || ''), `picker: the help line names the event exchanges ("${row?.help}")`);
    await A.locator(`[data-testid="edit-titles"] button[data-title="${TITLE}"]`).click();
    await A.waitForTimeout(300);
    const prev = await plateOf(A, '[data-testid="edit-profile-preview"]');
    check(prev?.text === PLATE && prev.gold, `editor preview: "${prev?.text}"`);
    await shot(A, '2-picker');
    await A.locator('[data-testid="edit-tab-picture"]').click();
    await A.waitForTimeout(300);
    const fr = await A.evaluate(() => { const b = document.querySelector('[data-testid="edit-frames"] button[data-frame="pumpkin"]'); return b ? { disabled: b.disabled, text: b.textContent } : null; });
    check(!!fr && !fr.disabled, `picker: the Pumpkin Lantern frame is earned (${fr?.text})`);
    await A.locator('[data-testid="edit-frames"] button[data-frame="pumpkin"]').click();
    await A.waitForTimeout(300);
    await A.locator('[data-testid="edit-profile-save"]').click();
    await A.waitForSelector('[data-testid="edit-profile"]', { state: 'detached', timeout: 10000 }).catch(() => {});
    await A.waitForTimeout(800);

    // ---- 3. your profile, Preview, a reload ---------------------------------------------------------
    const own = await plateOf(A, '[data-testid="profile"]');
    check(own?.text === PLATE && own.gold && !own.standard, `own profile: the plate under the name reads "${own?.text}" (Gold)`);
    check((await frameOf(A, '[data-testid="profile"]')) === 'pumpkin', 'own profile: the Pumpkin Lantern frame');
    const sensei = await A.evaluate(() => ({ ...window.__sakura.store.profile.sensei }));
    check(sensei.title === TITLE && sensei.frame === 'pumpkin', 'save: title and frame equipped');
    check(await A.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'own profile: no horizontal overflow');
    await shot(A, '3-profile');
    await A.locator('[data-testid="profile-preview"]').click();
    await A.waitForSelector('[data-testid="profile-preview-view"]', { timeout: 10000 }).catch(() => {});
    await A.waitForTimeout(500);
    const pv = await plateOf(A, '[data-testid="profile-preview-view"]');
    check(pv?.text === PLATE && pv.gold, `Preview (the visitor layout): "${pv?.text}"`);
    check((await frameOf(A, '[data-testid="profile-preview-view"]')) === 'pumpkin', 'Preview: the frame');
    await shot(A, '4-preview');
    await A.locator('[data-testid="profile-preview-close"]').click().catch(() => {});
    await A.evaluate(() => window.__sakura.store.saveNow?.());
    await A.reload({ waitUntil: 'load' });
    await A.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: T });
    await go(A, '#/profile', '[data-testid="profile"]');
    const reload = await plateOf(A, '[data-testid="profile"]');
    check(reload?.text === PLATE, `after a reload: "${reload?.text}"`);

    // ---- 4. the online card and another player's visit ----------------------------------------------
    await setName(A, `Aiko${W}`);
    const uidA = await A.evaluate(() => window.__online?.uid || null);
    check(!!uidA, 'online (local adapter): signed in');
    await go(A, '#/profile', '[data-testid="profile"]');
    await A.waitForTimeout(2500);
    const card = await A.evaluate((u) => JSON.parse(localStorage.getItem('ss-online-db') || '{}').profileCards?.[u]?.card || null, uidA);
    check(card?.ttl === TITLE && card?.frm === 'pumpkin', `card: publishes ttl=${card?.ttl} frm=${card?.frm}`);
    const B = await openPage(ctx, `B-${vp}`);
    await setName(B, `Bea${W}`);
    await go(B, `#/profile/${uidA}`);
    await B.waitForSelector('[data-testid="profile-visit"] [data-testid="profile-title"]', { timeout: 30000 }).catch(() => {});
    await B.waitForTimeout(1200);
    const visit = await plateOf(B, '[data-testid="profile-visit"]');
    check(visit?.text === PLATE && visit.gold, `a visitor sees "${visit?.text}" on the Gold plate`);
    check((await frameOf(B, '[data-testid="profile-visit"]')) === 'pumpkin', 'a visitor sees the Pumpkin Lantern frame');
    await shot(B, '5-visit');
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
}
const real = errors.filter((e) => !/WebGL|GPU|favicon|ERR_|GLTF/i.test(e));
check(!real.length, `no page errors${real.length ? `: ${real.slice(0, 3).join(' | ')}` : ''}`);
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall event-title checks passed');
process.exit(fails.length ? 1 : 0);
