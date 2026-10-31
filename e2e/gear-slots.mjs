// The five gear slots (GEAR_UPDATE.md M2 review): a girl's Equipment tab with Charm, Ribbon, Shoes, Hair Clip and
// Necklace all worn, at the phone size (844x390) and a PC size: every slot on screen, none overlapping another, no
// sideways scroll, the set line with five pips, a set cap her kit cannot use greyed with its reason, and the Hair Clip
// slot opening its picker. Set Boxes v2 (docs/specs/SET_BOXES_V2.md): five random Party Popper (Legendary) boxes open at
// once from the Backpack's Supplies sheet into 25 Party Popper pieces only, one per slot per box, the mains rolled; a
// preset box's batch takes the chosen mains on every box after its confirm.
// Usage: node e2e/gear-slots.mjs [--shots dir]   (screenshots: JPEG)
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const args = process.argv.slice(2);
const SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const require = createRequire('/opt/node22/lib/node_modules/playwright/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
const SLOTS = ['charm', 'ribbon', 'shoes', 'hair', 'necklace'];
for (const [W, H] of [[844, 390], [1280, 720]]) {
  const touch = W < 1000;
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 15000 }).catch(() => null);
  if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 10000 }).catch(() => {}); }
  // Aoi in five Geometry pieces (her shots use Right Angle and the crit cap), Momo in five Spirit Squad pieces (a
  // coin-maker with no aura: Big Cheer runs, its set cap does not)
  const worn = await page.evaluate(async (slots) => {
    const { store } = window.__sakura;
    const gear = await import('/src/systems/gear.js');
    const { rollSetPiece } = await import('/src/systems/gearSets.js');
    const { createRng } = await import('/src/core/rng.js');
    const { grantUnit } = await import('/src/systems/unlocks.js');
    const rng = createRng(5);
    const p = store.profile;
    const out = {};
    for (const [unitId, setId] of [['aoi', 'geometry'], ['momo', 'spirit']]) {
      if (!p.units[unitId]) grantUnit(p, unitId);
      out[unitId] = 0;
      for (const slot of slots) {
        const uid = gear.addGear(p, rollSetPiece(rng, setId, { slot, rarity: 'legendary', level: 6 }));
        gear.equipGear(p, unitId, uid);
        if (p.units[unitId].gear[slot] === uid) out[unitId]++;
      }
    }
    store.commit('test'); store.saveNow?.();
    return out;
  }, SLOTS);
  check(worn.aoi === 5 && worn.momo === 5, `${W}x${H} five pieces worn by Aoi and Momo (${JSON.stringify(worn)})`);
  await page.evaluate(() => { location.hash = '#/student/aoi?tab=gear'; });
  await page.waitForSelector('[data-testid="slot-necklace"]', { timeout: 15000 });
  await page.waitForTimeout(300);
  const boxes = await page.evaluate((slots) => slots.map((s) => {
    const el = document.querySelector(`[data-testid="slot-${s}"]`);
    if (!el) return null;
    // (all five measured in one pass, unscrolled: the tab's own pane scrolls, so rects stay comparable)
    const r = el.getBoundingClientRect();
    return { s, x: r.left, y: r.top, w: r.width, h: r.height, filled: !el.classList.contains('empty') && !/Empty/i.test(el.textContent) };
  }), SLOTS);
  check(boxes.every(Boolean), `${W}x${H} all five slots drawn (${boxes.map((b) => b?.s || '—').join(', ')})`);
  if (boxes.every(Boolean)) {
    check(boxes.every((b) => b.w >= 40 && b.h >= 32), `${W}x${H} every slot is a usable tap size (${boxes.map((b) => `${b.s} ${Math.round(b.w)}x${Math.round(b.h)}`).join(', ')})`);
    check(boxes.every((b) => b.x >= 0 && b.x + b.w <= W + 0.5), `${W}x${H} every slot inside the screen's width`);
    const overlap = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.x + 1 < b.x + b.w && b.x + 1 < a.x + a.w && a.y + 1 < b.y + b.h && b.y + 1 < a.y + a.h) overlap.push(`${a.s}/${b.s}`);
    }
    check(!overlap.length, `${W}x${H} no slot overlaps another${overlap.length ? ` (${overlap.join(', ')})` : ''}`);
    check(boxes.every((b) => b.filled), `${W}x${H} every slot shows its piece`);
  }
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(sideways <= 1, `${W}x${H} no sideways scroll (${sideways}px)`);
  const line = await page.locator('[data-testid="gear-set-line"]').first().innerText().catch(() => '');
  check(/●●●●●/.test(line) && /^5:|· 5:/.test(line.replace(/\s+/g, ' ').replace(/^.*?·\s*/, '· ')), `${W}x${H} Aoi's set line: five pieces ("${line.replace(/\s+/g, ' ')}")`);
  check(await page.locator('[data-testid="gear-set-idle"]').count() === 0, `${W}x${H} Aoi's set is not greyed (her kit uses all of it)`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/gear-slots-aoi-${W}x${H}.png` });
  // the Hair Clip slot opens its picker
  await page.locator('[data-testid="slot-hair"]').click();
  const picker = await page.waitForSelector('[data-testid="gear-piece"], [data-testid="gear-picker"]', { timeout: 10000 }).catch(() => null);
  check(!!picker, `${W}x${H} the Hair Clip slot opens`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/gear-slots-hair-${W}x${H}.png` });
  await page.keyboard.press('Escape');
  await page.evaluate(() => { location.hash = '#/student/momo?tab=gear'; });
  await page.waitForSelector('[data-testid="slot-necklace"]', { timeout: 15000 });
  await page.waitForTimeout(300);
  const idle = await page.locator('[data-testid="gear-set-line"] [data-testid="gear-set-idle"]').innerText().catch(() => '');
  check(idle.trim().length > 3, `${W}x${H} Momo's Spirit Squad set cap greyed with its reason ("${idle.trim()}")`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/gear-slots-momo-${W}x${H}.png` });
  // the Set Box picker says what her kit cannot use of the set before it opens (review M2 r3 S1): Momo first in the team,
  // Spirit Squad picked (no aura: its set cap does nothing for her), then Geometry (her coins crit: nothing to say)
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    store.profile.items.setbox_pick_legendary = 1;
    store.profile.formation.towers = ['momo', ...store.profile.formation.towers.filter((id) => id !== 'momo')];
    (await import('/src/ui/gearUr.js')).setBoxModal('setbox_pick_legendary');
  });
  await page.waitForSelector('[data-testid="set-box-modal"]', { timeout: 10000 });
  await page.locator('[data-testid="set-box-set-spirit"]').click();
  const boxIdle = await page.locator('[data-testid="set-box-idle"]').innerText().catch(() => '');
  check(/^For Momo: .*aura/.test(boxIdle.trim()), `${W}x${H} Set Box picker: Spirit Squad's idle note for Momo ("${boxIdle.trim()}")`);
  await page.locator('[data-testid="set-box-set-geometry"]').click();
  check(await page.locator('[data-testid="set-box-idle"]').count() === 0, `${W}x${H} Set Box picker: no idle note when her kit uses the set`);
  await page.keyboard.press('Escape');
  if (await page.locator('[data-testid="set-box-modal"]').count()) await page.locator('.modal-actions button', { hasText: 'Not now' }).last().click();
  await page.waitForSelector('[data-testid="set-box-modal"]', { state: 'detached', timeout: 10000 }).catch(() => {});

  // Set Boxes v2: batch-open 5 random Party Popper (Legendary) boxes from the Supplies sheet
  const RID = 'setbox_popper_legendary_random';
  const PID = 'setbox_popper_mythic';
  const before = await page.evaluate(({ RID, PID }) => {
    const { store } = window.__sakura;
    store.profile.items[RID] = 5;
    store.profile.items[PID] = 2;
    store.commit('test');
    return Object.keys(store.profile.gear);
  }, { RID, PID });
  await page.evaluate(() => { location.hash = '#/backpack?tab=equipment'; });
  await page.waitForSelector('[data-testid="supplies-open"]', { timeout: 15000 });
  await page.locator('[data-testid="supplies-open"]').click();
  await page.waitForSelector(`[data-testid="box-${RID}"]`, { timeout: 10000 });
  const rowText = await page.locator(`[data-testid="box-${RID}"]`).innerText();
  check(/Open ×5/i.test(rowText), `${W}x${H} the random box's row offers Open ×5 ("${rowText.replace(/\s+/g, ' ')}")`);
  await page.locator(`[data-testid="set-box-open10-${RID}"]`).click();
  await page.waitForSelector('[data-testid="set-box-results"]', { timeout: 10000 });
  const opened = await page.locator('[data-testid="set-box-results"]').getAttribute('data-opened');
  check(opened === '5', `${W}x${H} one results summary for 5 boxes (opened ${opened})`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/set-boxes-batch-${W}x${H}.jpg`, type: 'jpeg', quality: 70 });
  const got = await page.evaluate(({ before, RID }) => {
    const p = window.__sakura.store.profile;
    const fresh = Object.values(p.gear).filter((g) => !before.includes(g.uid));
    const bySlot = {};
    for (const g of fresh) (bySlot[g.slot] ||= []).push(g.main.stat);
    return { n: fresh.length, sets: [...new Set(fresh.map((g) => g.set))], rar: [...new Set(fresh.map((g) => g.rarity))], bySlot, left: p.items[RID] || 0 };
  }, { before, RID });
  check(got.n === 25, `${W}x${H} 25 new pieces (${got.n})`);
  check(got.sets.length === 1 && got.sets[0] === 'popper', `${W}x${H} only Party Popper pieces (${got.sets.join(', ')})`);
  check(got.rar.length === 1 && got.rar[0] === 'legendary', `${W}x${H} all Legendary (${got.rar.join(', ')})`);
  check(SLOTS.every((s) => got.bySlot[s]?.length === 5), `${W}x${H} one piece per slot per box (${SLOTS.map((s) => `${s} ${got.bySlot[s]?.length || 0}`).join(', ')})`);
  check(SLOTS.some((s) => new Set(got.bySlot[s]).size > 1), `${W}x${H} main stats rolled, not all the same (${SLOTS.map((s) => `${s}: ${[...new Set(got.bySlot[s])].join('/')}`).join('; ')})`);
  check(got.left === 0, `${W}x${H} all 5 boxes used (${got.left} left)`);
  await page.locator('[data-testid="set-box-results-ok"]').click();
  await page.waitForSelector('[data-testid="set-box-results"]', { state: 'detached', timeout: 10000 });
  // a preset box's batch: choose once, confirm, every box takes the chosen mains
  const before2 = await page.evaluate(() => Object.keys(window.__sakura.store.profile.gear));
  await page.waitForSelector(`[data-testid="set-box-open10-${PID}"]`, { timeout: 10000 });
  await page.locator(`[data-testid="set-box-open10-${PID}"]`).click();
  await page.waitForSelector('[data-testid="set-box-modal"][data-kind="preset"]', { timeout: 10000 });
  await page.locator('[data-testid="set-box-main-charm-atkPct"]').click();
  await page.locator('[data-testid="set-box-main-shoes-costCut"]').click();
  const countLine = await page.locator('[data-testid="set-box-count"]').innerText();
  check(/^2 boxes · 10 pieces/.test(countLine), `${W}x${H} the preset batch reads 2 boxes · 10 pieces ("${countLine}")`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/set-boxes-preset-${W}x${H}.jpg`, type: 'jpeg', quality: 70 });
  await page.locator('[data-testid="set-box-open"]').click();
  await page.waitForSelector('[data-testid="confirm-ok"]', { timeout: 10000 });
  await page.locator('[data-testid="confirm-ok"]').click();
  await page.waitForSelector('[data-testid="set-box-results"]', { timeout: 10000 });
  const got2 = await page.evaluate(({ before2, PID }) => {
    const p = window.__sakura.store.profile;
    const fresh = Object.values(p.gear).filter((g) => !before2.includes(g.uid));
    return { n: fresh.length, sets: [...new Set(fresh.map((g) => g.set))], charm: [...new Set(fresh.filter((g) => g.slot === 'charm').map((g) => g.main.stat))], shoes: [...new Set(fresh.filter((g) => g.slot === 'shoes').map((g) => g.main.stat))], left: p.items[PID] || 0 };
  }, { before2, PID });
  check(got2.n === 10 && got2.sets.join() === 'popper', `${W}x${H} the preset batch: 10 Party Popper pieces (${got2.n}, ${got2.sets.join(', ')})`);
  check(got2.charm.join() === 'atkPct' && got2.shoes.join() === 'costCut', `${W}x${H} the preset batch took the chosen mains on every box (charm ${got2.charm.join('/')}, shoes ${got2.shoes.join('/')})`);
  check(got2.left === 0, `${W}x${H} both preset boxes used`);
  await page.locator('[data-testid="set-box-results-ok"]').click();
  check(!errs.length, `${W}x${H} no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  await page.close();
}
await browser.close();
await server.close();
console.log(fails.length ? `\n${fails.length} FAILED:\n - ${fails.join('\n - ')}` : '\nall gear-slot checks passed');
process.exit(fails.length ? 1 : 0);
