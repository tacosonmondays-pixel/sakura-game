// Sandbox mode, end to end (owner: "...also the sandbox is gone too?"). A fresh save sees the
// Sandbox tile locked with how to unlock it; a test save with 7 campaign clears opens it. Then:
// pick a map + difficulty, pick a girl the player does NOT own, start, place her, spawn 20
// enemies and a boss (the Ashwing Matriarch) from the Sandbox panel, check the coins never run
// out (plus the "+ coins" button and upgrades), that lives stay unlimited, and that nothing was
// granted or saved; end the run ("Sandbox: no rewards") and go back.
// Phone (844x390, touch) and PC (1280x720, mouse).
// Usage: node e2e/sandbox.mjs [--viewport 844x390] [--shots dir]
import { createServer } from 'vite';
import { launchChromium } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, def) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : def);
const SHOTS = opt('shots', null);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const VIEWPORTS = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
// (Playwright and a Chromium through e2e/browser.mjs: no machine-specific install paths)
const { browser } = await launchChromium();
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); return c; };
const T = 60000;
const IGNORE = [/GPU stall/i, /WebGL: too many errors/i, /software WebGL/i, /GroupMarkerNotSet/i, /favicon/i, /Failed to load resource: net::ERR_/i];

/** The parts of the save a reward would touch. */
const SAVED = () => {
  const p = window.__sakura.store.profile;
  return JSON.stringify({ c: p.currencies, i: p.items, pr: p.progress, b: p.bestiary, s: p.stats, m: p.missions, u: Object.keys(p.units).sort(), g: Object.keys(p.gear || {}).length });
};

/**
 * Size of what the game stores (every 'sakura' key) except the one-time UI hints ('sakura.tip.*',
 * e.g. the battle's "hold a girl to see her upgrade tree" tip): a hint shown once per device is no
 * save and no reward, and it may be set in any battle, a sandbox run too.
 */
const STORED = () => Object.keys(localStorage).filter((k) => /sakura/i.test(k) && !k.startsWith('sakura.tip.')).map((k) => localStorage.getItem(k)).join('|').length;

async function run(vp) {
  const [w, hgt] = vp.split('x').map(Number);
  const touch = Math.min(w, hgt) < 600;
  console.log(`\n=== sandbox ${vp} (${touch ? 'touch' : 'mouse'}) ===`);
  const context = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, hasTouch: touch });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(`[console] ${m.text()}`); });
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp}-${name}.png` }).catch(() => {}); };
  const tap = async (sel) => {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded().catch(() => {});
    if (touch) await el.tap({ force: true, timeout: 10000 });
    else await el.click({ force: true, timeout: 10000 });
  };
  const go = async (hash, selector) => {
    await page.evaluate((x) => { location.hash = x; }, hash);
    await page.waitForSelector(selector, { timeout: T });
    await page.waitForTimeout(500);
  };

  // ---- fresh save: the tile is locked and says how to unlock it ----
  await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 30000 }).catch(() => null);
  if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 15000 }).catch(() => {}); }
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: T });
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  await go('#/missions', '[data-testid="hub-sandbox"]');
  const lockedTile = await page.evaluate(() => { const t = document.querySelector('[data-testid="hub-sandbox"]'); return { locked: t.classList.contains('locked'), text: t.innerText, hint: t.title }; });
  check(lockedTile.locked && /clear 7 stages/i.test(lockedTile.text) && /clear 7 stages to unlock \(7 to go\)/i.test(lockedTile.hint), `fresh save: Sandbox tile locked, says how to unlock ("${lockedTile.text.replace(/\s+/g, ' ')}" · "${lockedTile.hint}")`);
  await tap('[data-testid="hub-sandbox"]');
  check(await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => /clear 7 stages to unlock/i.test(t.textContent)), null, { timeout: 5000 }).then(() => true).catch(() => false), 'fresh save: tapping the locked tile explains the unlock');
  await page.waitForTimeout(1200);
  await shot('tile-locked');
  await go('#/sandbox', '[data-testid="sandbox-locked"]');
  check(true, 'fresh save: #/sandbox shows the locked state');

  // ---- test save: 7 campaign clears ----
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const { CAMPAIGN_IDS } = await import('/src/data/stages.js');
    for (const id of CAMPAIGN_IDS.slice(0, 7)) store.profile.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
    store.commit('replace');
    store.saveNow?.();
  });
  await go('#/missions', '[data-testid="hub-sandbox"]:not(.locked)');
  check(true, '7 clears: the Sandbox tile is unlocked');
  await page.waitForTimeout(1200); // the hub tiles slide in one after another
  await shot('tile');
  const tileBox = await page.locator('[data-testid="hub-sandbox"]').boundingBox();
  check(tileBox && tileBox.width > 60 && tileBox.height > 50 && tileBox.x + tileBox.width <= w + 1 && tileBox.y + tileBox.height <= hgt + 1, `hub: the tile fits on screen (${JSON.stringify(tileBox)})`);

  // ---- map + difficulty ----
  await tap('[data-testid="hub-sandbox"]');
  await page.waitForSelector('[data-testid="sandbox-maps"]', { timeout: T });
  const mapCount = await page.locator('[data-testid^="sandbox-stage-"]').count();
  check(mapCount >= 40, `stage picker lists every Act I stage (${mapCount})`);
  await tap('[data-testid="sandbox-stage-8-4"]');
  await tap('[data-testid="sandbox-diff-hard"]');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => document.querySelector('[data-testid="sandbox-stage-8-4"]')?.classList.contains('on') && document.querySelector('[data-testid="sandbox-diff-hard"]')?.classList.contains('on')), 'stage picker: 8-4 (Dragonback Ridge) + Hard selected');
  await shot('maps');
  const overflowMaps = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  check(!overflowMaps, 'map picker: no horizontal overflow');
  await tap('[data-testid="sandbox-next"]');

  // ---- squad: an unowned girl ----
  await page.waitForSelector('[data-testid="sandbox-roster"]', { timeout: T });
  const unowned = await page.evaluate(() => {
    const p = window.__sakura.store.profile;
    return [...document.querySelectorAll('[data-testid^="sandbox-unit-"]')].map((e) => e.dataset.unit).find((id) => !p.units[id]) || null;
  });
  check(!!unowned, `squad: the roster offers a girl the player does not own (${unowned})`);
  // a clean squad: just her, at the old Lv 60 build with no gear (the true maximum clears a runner group before any
  // leaks, and the unlimited-lives check below needs leaks; e2e/sandbox-catchup.mjs covers the maximum)
  await page.evaluate(() => { sessionStorage.setItem('sakura.sandbox.v1', JSON.stringify({ stageId: '8-4', difficulty: 'hard', towers: [], hero: null, build: { level: 60, p: 1, stars: 5, lr: false, gear: 'none' } })); });
  await page.evaluate(() => { location.hash = '#/sandbox'; });
  await page.waitForSelector('[data-testid="sandbox-maps"]', { timeout: T });
  await tap('[data-testid="sandbox-next"]');
  await page.waitForSelector('[data-testid="sandbox-roster"]', { timeout: T });
  await tap(`[data-testid="sandbox-unit-${unowned}"]`);
  await page.waitForTimeout(300);
  check(await page.evaluate((id) => !!document.querySelector(`.sbx-squad [data-unit="${id}"]`) && document.querySelectorAll('.sbx-squad .mb-fslot.filled').length === 1, unowned), `squad: just ${unowned} (Trial), the cleared squad stayed cleared`);
  await shot('formation');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'squad: no horizontal overflow');
  const before = await page.evaluate(SAVED);
  const savedBefore = await page.evaluate(STORED);

  await tap('[data-testid="sandbox-start"]');
  await page.waitForFunction(() => window.__battle?.ui?.placement && window.__battle.ui.sandbox, null, { timeout: 90000 });
  await page.waitForTimeout(1000);
  const start = await page.evaluate(() => {
    const { sim, ui } = window.__battle;
    return { cash: sim.cash, stage: sim.stageId, diff: sim.difficulty, sandbox: !!ui.req.sandbox, loadout: [...sim.loadout.keys()], hash: location.hash, endless: sim.endless };
  });
  check(start.sandbox && start.stage === '8-4' && start.diff === 'hard' && start.endless, `battle: sandbox run on 8-4 Hard, endless (${JSON.stringify(start)})`);
  check(start.cash === 999999, `battle: 999,999 coins (${start.cash})`);
  check(start.loadout.includes(unowned), `battle: the unowned ${unowned} is in the loadout`);
  check(await page.evaluate(() => /∞/.test(document.querySelector('[data-testid="hud-lives"]')?.textContent || '')), 'HUD: lives read ∞');
  check(await page.evaluate(() => /sandbox/i.test(document.querySelector('.bt-stage-label')?.textContent || '')), 'HUD: Sandbox tag');

  // panel: collapsed on the phone, open on PC; then open it
  const panel0 = await page.evaluate(() => window.__battle.ui.sandbox.open);
  check(touch ? panel0 === false : panel0 === true, `panel starts ${touch ? 'collapsed (phone)' : 'open (PC)'}`);
  if (!panel0) {
    await shot('panel-collapsed');
    await tap('[data-testid="sandbox-toggle"]');
    await page.waitForTimeout(300);
  }
  check(await page.evaluate(() => window.__battle.ui.sandbox.open && !document.querySelector('.bt-sbx-body').hidden), 'panel: open');

  // place her beside the first stretch of road (enemies spawn at the start of path 1), so she
  // sees action even when the software-rendered battle runs slowly
  const placed = await page.evaluate((id) => {
    const { sim, ui } = window.__battle;
    const start = sim.paths[0].slice(0, 12);
    let best = null;
    for (let y = 0.3; y < sim.map.height; y += 0.5) {
      for (let x = 0.3; x < sim.map.width; x += 0.5) {
        if (!sim.canPlace(id, x, y).ok) continue;
        const d = Math.min(...start.map(([px, py]) => Math.hypot(px - x, py - y)));
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    const t = best && ui.act.place(id, best.x, best.y);
    if (!t) return null;
    ui.onPlaced?.(t);
    return { uid: t.uid, owned: !!window.__sakura.store.profile.units[id], d: +best.d.toFixed(2) };
  }, unowned);
  check(!!placed && placed.owned === false, `placed ${unowned} (still not owned: ${placed && !placed.owned})`);
  // every upgrade path can be bought (two paths, crosspath rules apply)
  const upg = await page.evaluate((uid) => {
    const { sim, ui } = window.__battle;
    let n = 0;
    for (let i = 0; i < 5; i++) if (ui.act.upgrade(uid, 0)) n++;
    for (let i = 0; i < 2; i++) if (ui.act.upgrade(uid, 1)) n++;
    return { n, tiers: sim.getTower(uid)?.tiers, cash: sim.cash };
  }, placed?.uid);
  check(upg.n === 7, `upgrades: 5/2 bought (${JSON.stringify(upg)})`);

  // spawn 20 + a boss through the panel
  await page.selectOption('[data-testid="sandbox-enemy"]', 'goblin_runner').catch(async () => {
    const first = await page.evaluate(() => document.querySelector('[data-testid="sandbox-enemy"] option')?.value);
    await page.selectOption('[data-testid="sandbox-enemy"]', first);
  });
  await tap('[data-testid="sandbox-count-20"]');
  // a trait switch flips on and off (left off: a girl without veil sight could not see them)
  await tap('[data-testid="sandbox-trait-veiled"]');
  const veilOn = await page.evaluate(() => document.querySelector('[data-testid="sandbox-trait-veiled"]').classList.contains('on'));
  await tap('[data-testid="sandbox-trait-veiled"]');
  const veilOff = await page.evaluate(() => !document.querySelector('[data-testid="sandbox-trait-veiled"]').classList.contains('on'));
  check(veilOn && veilOff, 'spawn: the Veiled switch turns on and off');
  await tap('[data-testid="sandbox-spawn"]');
  await page.selectOption('[data-testid="sandbox-enemy"]', 'dragon_ashwing');
  await tap('[data-testid="sandbox-count-1"]');
  await tap('[data-testid="sandbox-spawn"]');
  await page.waitForTimeout(400);
  await shot('panel');
  await tap('[data-testid="sandbox-speed-5"]');
  let minCash = Infinity;
  let maxSeen = 0;
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(500);
    const s = await page.evaluate(() => { const { sim, ui } = window.__battle; return { cash: sim.cash, n: sim.enemies.length, q: ui.modules.find((m) => m.state === ui.sandbox)?.queued ?? 0, boss: sim.enemies.some((e) => e.id === 'dragon_ashwing'), lives: sim.lives, max: sim.maxLives, state: sim.state }; });
    minCash = Math.min(minCash, s.cash);
    maxSeen = Math.max(maxSeen, s.n);
    if (i === 3) await shot('battle-spawned');
  }
  // the panel spaces a group 0.35 s of game time apart: let the queue drain (slow on a loaded machine)
  const drained = await page.waitForFunction(() => { const { ui } = window.__battle; return (ui.modules.find((m) => m.state === ui.sandbox)?.queued ?? 0) === 0; }, null, { timeout: 60000 }).then(() => true).catch(() => false);
  check(drained, 'spawn queue drained');
  const spawned = await page.evaluate(() => { const { sim } = window.__battle; return { encountered: [...sim.encountered], alive: sim.enemies.length, kills: sim.kills, leaked: sim.stats.enemiesLeaked, lives: sim.lives, max: sim.maxLives, state: sim.state, ended: window.__battle.ui.ended }; });
  const total = spawned.alive + Object.values(spawned.kills).reduce((a, b) => a + b, 0) + spawned.leaked;
  check(spawned.encountered.includes('dragon_ashwing') && total >= 21, `spawned 20 + the Ashwing Matriarch (${total} seen, max ${maxSeen} on the board, ${JSON.stringify(spawned.kills)})`);
  check(minCash > 900000, `coins never ran low (lowest ${minCash})`);
  // unlimited lives, proven with real leaks: runners on the other path, where nobody stands
  const otherPath = await page.evaluate(() => (window.__battle.sim.pathData.length > 1 ? 1 : 0));
  await page.selectOption('[data-testid="sandbox-enemy"]', 'goblin_runner');
  await tap('[data-testid="sandbox-count-5"]');
  if (otherPath) await tap('[data-testid="sandbox-path-1"]');
  await tap('[data-testid="sandbox-spawn"]');
  const leaked = await page.waitForFunction(() => window.__battle.sim.stats.enemiesLeaked >= 1, null, { timeout: 120000 }).then(() => true).catch(() => false);
  const lives = await page.evaluate(() => { const { sim, ui } = window.__battle; return { lives: sim.lives, max: sim.maxLives, leaked: sim.stats.enemiesLeaked, state: sim.state, ended: ui.ended, hud: document.querySelector('[data-testid="hud-lives"]')?.textContent }; });
  check(leaked && lives.lives === lives.max && !lives.ended && lives.state !== 'lost' && lives.hud === '∞', `unlimited lives: ${lives.leaked} leaks, still ${lives.lives}/${lives.max} (HUD ${lives.hud})`);
  if (otherPath) await tap('[data-testid="sandbox-path-0"]');
  const c0 = await page.evaluate(() => window.__battle.sim.cash);
  await tap('[data-testid="sandbox-coins"]');
  const c1 = await page.evaluate(() => window.__battle.sim.cash);
  check(c1 >= c0 + 100000 - 1, `+ coins adds 100k (${c0} → ${c1})`);
  // the readout fills in as she deals damage (spawn a few more slimes in front of her if needed)
  await tap('[data-testid="sandbox-count-5"]');
  await page.selectOption('[data-testid="sandbox-enemy"]', 'slime_green');
  await tap('[data-testid="sandbox-spawn"]');
  const dmgRow = await page.waitForFunction(() => document.querySelectorAll('[data-testid="sandbox-damage"] .bt-sbx-dmg-row').length >= 1, null, { timeout: 45000 }).then(() => true).catch(() => false);
  const dmg = await page.evaluate(() => ({ text: document.querySelector('[data-testid="sandbox-damage"]')?.innerText.replace(/\s+/g, ' '), byTower: window.__battle.sim.stats.damageByTower }));
  check(dmgRow, `damage per girl readout lists her (${JSON.stringify(dmg)})`);

  // send next wave + clear
  await tap('[data-testid="sandbox-send-wave"]');
  await page.waitForTimeout(400);
  const w1 = await page.evaluate(() => window.__battle.sim.wave);
  check(w1 >= 1, `send next wave: wave ${w1}`);
  await tap('[data-testid="sandbox-clear"]');
  await page.waitForTimeout(200);
  check(await page.evaluate(() => window.__battle.sim.enemies.length === 0), 'clear enemies empties the board');

  // layout: the panel stays inside the board area, clear of the HUD and the tower bar
  const lay = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    const p = r('[data-testid="sandbox-panel"]'); const hud = r('.bt-hud'); const bar = r('.bt-bar');
    return { p: p && [p.left, p.top, p.right, p.bottom].map(Math.round), hudBottom: Math.round(hud.bottom), barTop: Math.round(bar.top), w: innerWidth };
  });
  check(lay.p && lay.p[1] >= lay.hudBottom - 1 && lay.p[3] <= lay.barTop + 1 && lay.p[0] >= 0 && lay.p[2] <= lay.w / 2, `panel layout: below the HUD, above the bar, left half (${JSON.stringify(lay)})`);
  if (touch) {
    await tap('[data-testid="sandbox-toggle"]');
    await page.waitForTimeout(200);
    check(await page.evaluate(() => !window.__battle.ui.sandbox.open), 'phone: the panel collapses again');
    await tap('[data-testid="sandbox-toggle"]');
  }

  // end: "Sandbox: no rewards" + Back
  await tap('[data-testid="sandbox-end"]');
  await page.waitForSelector('[data-testid="sandbox-result"]', { timeout: 15000 });
  await page.waitForTimeout(400);
  const res = await page.evaluate(() => document.querySelector('[data-testid="sandbox-result"]').innerText);
  check(/sandbox: no rewards/i.test(res) && !/rewards\s*$/i.test(res.split('\n')[0] || '') , `results: "Sandbox: no rewards" (${res.replace(/\s+/g, ' ').slice(0, 120)})`);
  check(await page.evaluate(() => !document.querySelector('[data-testid="view-rewards"], [data-testid="rewards"], [data-testid="next-stage"]')), 'results: no rewards / next stage buttons');
  await shot('result');
  const after = await page.evaluate(SAVED);
  check(after === before, 'nothing granted or saved: currencies, items, progress, bestiary, stats, missions, units and gear unchanged');
  const savedAfter = await page.evaluate(STORED);
  check(savedAfter === savedBefore, `the stored save did not change size (${savedBefore} → ${savedAfter})`);
  check(await page.evaluate((id) => !window.__sakura.store.profile.units[id], unowned), `${unowned} is still not owned`);
  await tap('[data-testid="sandbox-back"]');
  // (the router cleans the battle up once the squad screen has taken its place: wait for both, not the hash alone)
  await page.waitForFunction(() => location.hash === '#/sandbox/team' && !window.__battle, null, { timeout: 15000 }).catch(() => null);
  check(await page.evaluate(() => location.hash === '#/sandbox/team' && !window.__battle), `Back leads to the Sandbox squad (${await page.evaluate(() => location.hash)})`);
  // the squad step's back arrow lands on the map step (its own screen), then Missions
  await page.waitForSelector('[data-testid="sandbox-roster"]', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(800); // (a back arrow tapped mid-transition belongs to the screen on its way out)
  await tap('.topbar-back');
  await page.waitForFunction(() => location.hash === '#/sandbox', null, { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="sandbox-maps"]', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(800);
  check(await page.evaluate(() => location.hash === '#/sandbox'), `back arrow: squad → maps (${await page.evaluate(() => location.hash)})`);
  await tap('.topbar-back');
  await page.waitForFunction(() => location.hash.startsWith('#/missions'), null, { timeout: 15000 }).catch(() => null);
  check(await page.evaluate(() => location.hash.startsWith('#/missions')), `back arrow: maps → Missions (${await page.evaluate(() => location.hash)})`);

  check(!errors.length, `no page errors${errors.length ? `\n       ${errors.slice(0, 6).join('\n       ')}` : ''}`);
  await context.close();
}

try {
  for (const vp of VIEWPORTS) await run(vp);
} catch (e) {
  check(false, `crashed: ${e.stack || e.message}`);
} finally {
  await browser.close();
  await server.close();
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall sandbox checks passed');
process.exit(fails.length ? 1 : 0);
