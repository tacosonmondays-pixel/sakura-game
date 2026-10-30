// The five gear slots (GEAR_UPDATE.md M2 review): a girl's Equipment tab with Charm, Ribbon, Shoes, Hair Clip and
// Necklace all worn, at the phone size (844x390) and a PC size: every slot on screen, none overlapping another, no
// sideways scroll, the set line with five pips, a set cap her kit cannot use greyed with its reason, and the Hair Clip
// slot opening its picker.
// Usage: node e2e/gear-slots.mjs [--shots dir]
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
  check(!errs.length, `${W}x${H} no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  await page.close();
}
await browser.close();
await server.close();
console.log(fails.length ? `\n${fails.length} FAILED:\n - ${fails.join('\n - ')}` : '\nall gear-slot checks passed');
process.exit(fails.length ? 1 : 0);
