// Sandbox catch-up, end to end (docs/specs/SANDBOX_CATCHUP.md): on a test save with 7 campaign clears, pick 4-5 with
// freeplay Blossom from wave 200, then an LR girl (Tenka, not owned) with the LR set preset (the squad build's gear, and
// her own build sheet), start, check the battle's build (L85 · P6 · ★5 · LR · five Set LR pieces: the LR Set Form) and
// that wave 200 brings the Ashwing Matriarch, let it run, end it, and compare the save before and after (nothing saved).
// Also visits every mode tab, a Titan Trials Mayhem pick and an event stage on the map step.
// Portrait and landscape phone (touch). Screenshots are JPEG (≤ 300 KB each).
// Usage: node e2e/sandbox-catchup.mjs [--viewport 390x844] [--shots dir]
import { createServer } from 'vite';
import { launchChromium } from './browser.mjs';
import { mkdirSync, statSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, def) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : def);
const SHOTS = opt('shots', null);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const VIEWPORTS = opt('viewport', null) ? [opt('viewport')] : ['390x844', '844x390'];
const SHOT_MAX = 300 * 1024;

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser } = await launchChromium();
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); return c; };
const T = 60000;
const IGNORE = [/GPU stall/i, /WebGL: too many errors/i, /software WebGL/i, /GroupMarkerNotSet/i, /favicon/i, /Failed to load resource: net::ERR_/i];

/** The parts of the save a reward would touch, and the girls' own builds and gear. */
const SAVED = () => {
  const p = window.__sakura.store.profile;
  return JSON.stringify({ c: p.currencies, i: p.items, pr: p.progress, b: p.bestiary, s: p.stats, m: p.missions, u: p.units, g: p.gear, a: p.achievements, f: p.formation });
};
/** What the game stores (every 'sakura' key but the one-time UI hints and the Sandbox's own sessionStorage choice). */
const STORED = () => Object.keys(localStorage).filter((k) => /sakura/i.test(k) && !k.startsWith('sakura.tip.')).sort().map((k) => `${k}=${localStorage.getItem(k)}`).join('|');

async function run(vp) {
  const [w, hgt] = vp.split('x').map(Number);
  console.log(`\n=== sandbox catch-up ${vp} (touch) ===`);
  const context = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(`[console] ${m.text()}`); });
  const shot = async (name) => {
    if (!SHOTS) return;
    for (const quality of [72, 55, 40]) {
      const path = `${SHOTS}/${vp}-${name}.jpg`;
      await page.screenshot({ path, type: 'jpeg', quality }).catch(() => {});
      if (statSync(path, { throwIfNoEntry: false })?.size <= SHOT_MAX) return;
    }
    check(false, `screenshot ${name} over 300 KB`);
  };
  const tap = async (sel) => {
    const el = page.locator(sel).first();
    // (centred: the sticky header would cover a target scrolled just under it)
    await el.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' }), null, { timeout: 10000 }).catch(() => {});
    await el.tap({ force: true, timeout: 10000 });
    await page.waitForTimeout(250);
  };
  const go = async (hash, selector) => {
    await page.evaluate((x) => { location.hash = x; }, hash);
    await page.waitForSelector(selector, { timeout: T });
    await page.waitForTimeout(500);
  };
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

  // ---- a test save with 7 campaign clears ----
  await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 30000 }).catch(() => null);
  if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 15000 }).catch(() => {}); }
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: T });
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const { CAMPAIGN_IDS } = await import('/src/data/stages.js');
    for (const id of CAMPAIGN_IDS.slice(0, 7)) store.profile.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
    store.commit('replace');
    store.saveNow?.();
  });
  check(await page.evaluate(() => !window.__sakura.store.profile.units.tenka), 'the save does not own Tenka');

  // ---- map step: every mode tab, a titan, an event stage ----
  await go('#/sandbox', '[data-testid="sandbox-maps"]');
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="sandbox-group-"]')].map((b) => b.dataset.testid.replace('sandbox-group-', '')));
  check(['act1', 'act2', 'side', 'event', 'resource', 'boss', 'challenge', 'titan'].every((t) => tabs.includes(t)), `mode tabs: ${tabs.join(', ')}`);
  const counts = {};
  for (const t of tabs) {
    await tap(`[data-testid="sandbox-group-${t}"]`);
    counts[t] = await page.locator('[data-testid="sandbox-maps"] .sbx-map').count();
  }
  check(counts.act1 === 40 && counts.act2 === 30 && counts.resource === 15 && counts.event >= 5 && counts.titan === 4 && counts.boss === 3, `every stage by mode (${JSON.stringify(counts)})`);
  await tap('[data-testid="sandbox-group-titan"]');
  await tap('[data-testid="sandbox-titan-wyrm"]');
  await tap('[data-testid="sandbox-ttier-mayhem"]');
  check(await page.locator('[data-testid="sandbox-trank"]').count() === 1, 'Titan Trials: Mayhem shows the rank picker');
  await shot('titans');
  await tap('[data-testid="sandbox-group-event"]');
  await tap('[data-testid="sandbox-stage-ev-halloween-boss"]');
  check(await page.evaluate(() => /Halloween|Hallow|Lantern|Pumpkin|Event/i.test(document.querySelector('[data-testid="sandbox-stage-ev-halloween-boss"]')?.innerText || '')), 'event stage card');
  check(await noOverflow(), 'map step: no horizontal overflow');

  // ---- 4-5, freeplay Blossom, from wave 200 ----
  await tap('[data-testid="sandbox-group-act1"]');
  await tap('[data-testid="sandbox-stage-4-5"]');
  await tap('[data-testid="sandbox-fp-blossom"]');
  await tap('[data-testid="sandbox-wave-200"]');
  const runLine = await page.evaluate(() => document.querySelector('[data-testid="sandbox-run"]')?.textContent || '');
  check(/Freeplay Blossom/.test(runLine) && /from wave 200/.test(runLine), `run line: "${runLine}"`);
  check(await page.evaluate(() => document.querySelector('[data-testid="sandbox-heromax"]')?.checked === true && document.querySelector('[data-testid="sandbox-resonance"]')?.value === 'auto'), 'late start: hero to Lv 25 + Mastery is on; UR Resonance Auto');
  check(await noOverflow(), 'map step with options: no horizontal overflow');
  await shot('map-freeplay-200');
  await tap('[data-testid="sandbox-next"]');

  // ---- squad: Tenka (LR) with the LR set preset ----
  await page.waitForSelector('[data-testid="sandbox-roster"]', { timeout: T });
  await tap('.sbx-squad .btn:has-text("Clear")').catch(() => {});
  await page.evaluate(() => {
    const c = JSON.parse(sessionStorage.getItem('sakura.sandbox.v1') || '{}');
    sessionStorage.setItem('sakura.sandbox.v1', JSON.stringify({ ...c, towers: [], hero: null, builds: {} }));
  });
  await go('#/sandbox', '[data-testid="sandbox-maps"]');
  await tap('[data-testid="sandbox-next"]');
  await page.waitForSelector('[data-testid="sandbox-roster"]', { timeout: T });
  await tap('[data-testid="sandbox-unit-tenka"]');
  await tap('[data-testid="sandbox-unit-kohaku_tsubaki"]');
  check(await page.evaluate(() => document.querySelectorAll('.sbx-squad .mb-fslot.filled').length === 2), 'squad: Tenka and Kohaku & Tsubaki');
  await page.locator('[data-testid="sandbox-build-gear"]').selectOption('lr-geometry');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => document.querySelector('[data-testid="sandbox-build-gear"]').value === 'lr-geometry' && /LR set · Geometry Set/.test(document.querySelector('.sbx-build-note')?.textContent || '')), 'squad build: LR set · Geometry Set');
  check(await page.evaluate(() => document.querySelector('[data-testid="sandbox-build-roll"]')?.value === 'max'), 'gear rolls: Max roll by default');
  check(await page.evaluate(() => document.querySelector('[data-testid="sandbox-build-level"]').value === '85' && document.querySelector('[data-testid="sandbox-build-p"]').value === '6' && document.querySelector('[data-testid="sandbox-build-stars"]').value === '5'), 'squad build defaults: Lv 85 · P6 · ★5');
  check(await page.locator('.sbx-squad .sbx-lr').count() === 2, 'both LR girls carry the LR tag');
  // her own build: the duo at Lv 60 with Blank LR, then back to the squad's
  await tap('[data-testid="sandbox-build-kohaku_tsubaki"]');
  await page.waitForSelector('.sbx-girl-modal', { timeout: 10000 });
  await page.locator('.sbx-girl-modal [data-testid="sandbox-girl-level"]').selectOption('60');
  await page.locator('.sbx-girl-modal [data-testid="sandbox-girl-gear"]').selectOption('blank');
  await shot('girl-build');
  await tap('[data-testid="sandbox-girl-done"]');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => document.querySelector('[data-testid="sandbox-build-kohaku_tsubaki"]')?.classList.contains('own')), 'the duo has her own build');
  check(await noOverflow(), 'squad step: no horizontal overflow');
  await shot('squad');
  const before = await page.evaluate(SAVED);
  const storedBefore = await page.evaluate(STORED);

  // ---- battle ----
  await tap('[data-testid="sandbox-start"]');
  await page.waitForFunction(() => window.__battle?.ui?.placement && window.__battle.ui.sandbox, null, { timeout: 90000 });
  await page.waitForTimeout(800);
  const start = await page.evaluate(() => {
    const { sim, ui } = window.__battle;
    const t = sim.loadout.get('tenka');
    const k = sim.loadout.get('kohaku_tsubaki');
    return { heroMax: ui.req.sandboxRun?.heroMax, stage: sim.stageId, fp: sim.freeplay, wave: sim.wave, sandbox: !!ui.req.sandbox, freeplayReq: ui.req.freeplay, cash: sim.cash, t: { level: t.level, p: t.potential, aw: t.awaken, gates: t.breakthrough, lr: t.lr, set: t.set, setN: t.setN, setLr: t.setLr }, k: { level: k.level, lr: k.lr, set: k.set, critCeil: k.critCeil } };
  });
  check(start.heroMax === true, 'the run carries the late-start hero level-up');
  check(start.sandbox && start.stage === '4-5' && start.fp === true && start.wave === 199 && start.freeplayReq === null, `battle: sandbox freeplay on 4-5 at wave 199 cleared (${JSON.stringify({ stage: start.stage, fp: start.fp, wave: start.wave })})`);
  check(start.t.level === 85 && start.t.p === 6 && start.t.aw === 5 && start.t.gates === 10 && start.t.lr === true && start.t.set === 'geometry' && start.t.setN === 5 && start.t.setLr === true, `Tenka: L85 · P6 · ★5 · 10 gates · LR · Geometry ×5 Set LR (${JSON.stringify(start.t)})`);
  check(start.k.level === 60 && start.k.lr === true && !start.k.set && start.k.critCeil === 2, `the duo: her own build, Lv 60 · LR · Blank LR ×5 (${JSON.stringify(start.k)})`);
  const placed = await page.evaluate(() => {
    const { sim, ui } = window.__battle;
    const out = [];
    for (const id of ['tenka', 'kohaku_tsubaki']) {
      const start = sim.paths[0].slice(0, 40);
      let best = null;
      for (let y = 0.3; y < sim.map.height; y += 0.5) {
        for (let x = 0.3; x < sim.map.width; x += 0.5) {
          if (!sim.canPlace(id, x, y).ok) continue;
          const d = Math.min(...start.map(([px, py]) => Math.hypot(px - x, py - y)));
          if (!best || d < best.d) best = { x, y, d };
        }
      }
      const t = best && ui.act.place(id, best.x, best.y);
      if (t) {
        ui.onPlaced?.(t);
        for (let i = 0; i < 5; i++) ui.act.upgrade(t.uid, 0);
        for (let i = 0; i < 2; i++) ui.act.upgrade(t.uid, 1);
        out.push({ id, tiers: sim.getTower(t.uid)?.tiers });
      }
    }
    return out;
  });
  check(placed.length === 2, `placed and upgraded both (${JSON.stringify(placed)})`);
  if (!(await page.evaluate(() => window.__battle.ui.sandbox.open))) await tap('[data-testid="sandbox-toggle"]');
  await tap('[data-testid="sandbox-send-wave"]');
  const wave = await page.waitForFunction(() => window.__battle.sim.wave === 200 && window.__battle.sim.state === 'wave', null, { timeout: 20000 }).then(() => true).catch(() => false);
  check(wave, 'Send next wave: wave 200 runs');
  check(await page.evaluate(() => window.__battle.sim._spawnQueue.some((s) => s.enemyId === 'dragon_ashwing')), 'wave 200 brings the Ashwing Matriarch (in its spawn list)');
  // (she comes late in the wave: a slow software-rendered page may take a while to get there)
  const seen = () => { const { sim } = window.__battle; return sim.enemies.some((e) => e.id === 'dragon_ashwing') || !!sim.kills?.dragon_ashwing || [...(sim.encountered || [])].includes('dragon_ashwing'); };
  const boss = await page.waitForFunction(seen, null, { timeout: 150000 }).then(() => true).catch(() => false);
  check(boss, 'the Matriarch reaches the board');
  await page.waitForTimeout(6000);
  const mid = await page.evaluate(() => {
    const { sim } = window.__battle;
    const dmg = Object.values(sim.stats.damageByTower || {}).reduce((a, b) => a + b, 0);
    return { wave: sim.wave, state: sim.state, dmg, lives: sim.lives, warnings: sim.warnings };
  });
  check(mid.dmg > 0 && mid.warnings.length === 0, `the battle runs: ${Math.round(mid.dmg)} damage dealt, no sim warnings (${JSON.stringify(mid)})`);
  await shot('battle-wave-200');
  check(await page.evaluate(() => /200/.test(document.querySelector('[data-testid="hud-wave"], .bt-wave')?.textContent || document.body.innerText)), 'the HUD shows wave 200');

  // ---- end: nothing saved ----
  await page.evaluate(() => window.__battle.ui.endSandbox?.());
  await page.waitForSelector('[data-testid="sandbox-result"]', { timeout: 15000 });
  await shot('result');
  const after = await page.evaluate(SAVED);
  check(after === before, 'nothing saved: currencies, items, progress, bestiary, stats, missions, achievements, units, gear and formation unchanged');
  const storedAfter = await page.evaluate(STORED);
  check(storedAfter === storedBefore, `the stored save is byte-identical (${storedBefore.length} → ${storedAfter.length} chars)`);
  check(await page.evaluate(() => !window.__sakura.store.profile.units.tenka && !Object.keys(window.__sakura.store.profile.gear || {}).some((k) => k.startsWith('sbx:'))), 'Tenka still not owned; no sandbox gear in the bag');
  await tap('[data-testid="sandbox-back"]');
  await page.waitForFunction(() => location.hash === '#/sandbox/team', null, { timeout: 15000 }).catch(() => null);
  check(await page.evaluate(() => location.hash === '#/sandbox/team'), 'Back leads to the Sandbox squad');

  // ---- a Titan Trials run: the Eclipse Wyrm at Mayhem +30 ----
  await page.evaluate(() => { location.hash = '#/battle?sandbox=1&team=tenka&ttn=wyrm&ttier=mayhem&trank=30'; });
  await page.waitForFunction(() => window.__battle?.ui?.sandbox && window.__battle.sim?.stageId?.startsWith('titan:'), null, { timeout: 90000 }).catch(() => {});
  const titan = await page.evaluate(() => { const { sim } = window.__battle; return { stage: sim.stageId, started: sim.startNextWave(), hud: document.querySelector('.bt-diff')?.textContent || '' }; });
  check(titan.stage === 'titan:wyrm:mayhem:30' && titan.started, `Titan Trials: Mayhem +30 runs (${JSON.stringify(titan)})`);
  await page.waitForTimeout(3000);
  await shot('titan-battle');
  await page.evaluate(() => window.__battle.ui.endSandbox?.());
  await page.waitForSelector('[data-testid="sandbox-result"]', { timeout: 15000 });
  check(await page.evaluate(STORED) === storedBefore, 'the titan run saved nothing either');

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
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall sandbox catch-up checks passed');
process.exit(fails.length ? 1 : 0);
