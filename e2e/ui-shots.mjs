// Before/after screenshots for the UI condense milestones (docs/specs/UI_DIRECTION.md §7): the lobby, the girl page
// (Info), the backpack Equipment tab, stage prep, a battle with the girl drawer open, and achievements, at 844x390
// and 1280x720. The save is seeded the same way every run (fixed gear rolls, no auto-start), so two runs on two
// builds differ only where the build differs.
//
//   node e2e/ui-shots.mjs --out /tmp/ui-before            # PNGs named <screen>-<W>x<H>.png
//   node e2e/ui-shots.mjs --out /tmp/ui-after --viewport 844x390
//   node e2e/ui-shots.mjs --out <dir> --scenes m1-bar-idle,m1-cast-fx   # only these scenes (the battle milestones'
//                                                                        # staged scenes: e2e/lib/abilityScenes.mjs,
//                                                                        # e2e/lib/m2Scenes.mjs for m2-…,
//                                                                        # e2e/lib/m3Scenes.mjs for m3-…,
//                                                                        # e2e/lib/m4Scenes.mjs for m4-…)
//
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a shot fails.
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';
import { runM1Scenes, M1_SCENES } from './lib/abilityScenes.mjs';
import { runM2Scenes, M2_SCENES } from './lib/m2Scenes.mjs';
import { runM3Scenes, M3_SCENES } from './lib/m3Scenes.mjs';
import { runM4Scenes, M4_SCENES } from './lib/m4Scenes.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const out = opt('out', 'ui-shots');
const viewports = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];
mkdirSync(out, { recursive: true });
/** --scenes a,b: only these (the screens below by name, or the m1-… battle scenes); none = the screens below. */
const SCENES = opt('scenes', null) ? opt('scenes').split(',').map((s) => s.trim()).filter(Boolean) : null;
const wantScreen = (name) => !SCENES || SCENES.includes(name);
const m1Wanted = SCENES ? SCENES.filter((s) => M1_SCENES.includes(s)) : [];
const m2Wanted = SCENES ? SCENES.filter((s) => M2_SCENES.includes(s)) : [];
const m3Wanted = SCENES ? SCENES.filter((s) => M3_SCENES.includes(s)) : [];
const m4Wanted = SCENES ? SCENES.filter((s) => M4_SCENES.includes(s)) : [];
const probeLog = {};

const GIRLS = ['hikari', 'aoi', 'rei', 'luna', 'nami', 'yuki', 'momo', 'akane', 'sango', 'kage', 'umeko', 'shiro', 'midori', 'suzu', 'raika', 'miko', 'hotaru', 'kaede', 'chika'];
const SQUAD = ['aoi', 'rei', 'yuki', 'momo', 'akane', 'sango', 'kage', 'chika'];

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}`);
let failed = 0;

/** Every girl, a squad, fixed currencies and six gear pieces rolled from fixed seeds (two on Aoi). */
async function seed(page) {
  await page.evaluate(async ([girls, squad]) => {
    const { store } = window.__sakura;
    const unlocks = await import('/src/systems/unlocks.js');
    const gear = await import('/src/systems/gear.js');
    const { createRng } = await import('/src/core/rng.js');
    const p = store.profile;
    for (const id of girls) if (!p.units[id]) unlocks.grantUnit(p, id, 1760000000000);
    Object.assign(p.units.aoi, { level: 48, breakthrough: 4, awaken: 3 });
    Object.assign(p.units.hikari, { level: 30, breakthrough: 3, awaken: 2 });
    p.formation = { hero: 'hikari', towers: [...squad] };
    Object.assign(p.currencies, { coins: 284650, gems: 16570 });
    Object.assign(p.settings, { autoStart: false });
    const rolls = [['charm', 'legendary'], ['ribbon', 'mythic'], ['shoes', 'super'], ['charm', 'rare'], ['ribbon', 'common'], ['shoes', 'legendary']];
    const uids = rolls.map(([slot, rarity], i) => gear.addGear(p, gear.rollGear(createRng(100 + i), { slot, rarity, level: 3 * i })));
    gear.equipGear(p, 'aoi', uids[0]);
    gear.equipGear(p, 'aoi', uids[1]);
    store.commit('e2e');
    store.saveNow?.();
  }, [GIRLS, SQUAD]);
}

const settle = (page, ms = 900) => page.waitForTimeout(ms)
  .then(() => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300))))));
const closeModals = (page) => page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));

async function go(page, hash, ready) {
  await page.evaluate((hh) => { location.hash = hh; }, hash);
  await page.waitForFunction(ready, null, { timeout: 30000 });
  await closeModals(page);
  await settle(page);
}

async function shot(page, name, vp) {
  const file = join(out, `${name}-${vp}.png`);
  await page.screenshot({ path: file, timeout: 120000 }); // (a busy machine: SwiftShader frames can take seconds)
  console.log(`  saved ${file}`);
}

for (const vp of viewports) {
  const [W, H] = vp.split('x').map(Number);
  const touch = W < 1000;
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
  console.log(`viewport ${vp}`);
  if (m1Wanted.length) {
    try {
      probeLog[vp] = await runM1Scenes(page, { base, vp, want: m1Wanted, shot: (name) => shot(page, name, vp) });
    } catch (e) {
      failed++;
      console.log(`  FAILED (m1 scenes): ${e.stack || e.message}`);
    }
  }
  if (m2Wanted.length) {
    try {
      probeLog[`${vp}-m2`] = await runM2Scenes(page, { base, vp, want: m2Wanted, shot: (name) => shot(page, name, vp) });
    } catch (e) {
      failed++;
      console.log(`  FAILED (m2 scenes): ${e.stack || e.message}`);
    }
  }
  if (m3Wanted.length) {
    try {
      probeLog[`${vp}-m3`] = await runM3Scenes(page, { base, vp, want: m3Wanted, shot: (name) => shot(page, name, vp) });
    } catch (e) {
      failed++;
      console.log(`  FAILED (m3 scenes): ${e.stack || e.message}`);
    }
  }
  if (m4Wanted.length) {
    try {
      probeLog[`${vp}-m4`] = await runM4Scenes(page, { base, vp, want: m4Wanted, shot: (name) => shot(page, name, vp) });
      // (the M4 scenes check the drawer's layout and type floor themselves: a miss fails the run)
      for (const f of probeLog[`${vp}-m4`].failures || []) {
        failed++;
        console.log(`  FAILED (m4 check): ${f}`);
      }
    } catch (e) {
      failed++;
      console.log(`  FAILED (m4 scenes): ${e.stack || e.message}`);
    }
  }
  const screens = ['lobby', 'girl-info', 'backpack-equipment', 'stage-prep', 'achievements', 'battle-drawer'];
  if (!screens.some(wantScreen)) {
    await page.close();
    continue;
  }
  try {
    await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 30000 });
    const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 8000 }).catch(() => null);
    if (later) await later.click({ force: true });
    await seed(page);
    const screen = (id) => `() => document.querySelector('#app')?.dataset.screen === '${id}'`;

    if (wantScreen('lobby')) {
      await go(page, '#/lobby', screen('lobby'));
      await shot(page, 'lobby', vp);
    }
    if (wantScreen('girl-info')) {
      await go(page, '#/student/aoi?tab=info', screen('student'));
      await shot(page, 'girl-info', vp);
    }
    if (wantScreen('backpack-equipment')) {
      await go(page, '#/backpack?tab=equipment', screen('backpack'));
      await shot(page, 'backpack-equipment', vp);
    }
    if (wantScreen('stage-prep')) {
      await go(page, '#/stage/2-3', screen('stage'));
      await shot(page, 'stage-prep', vp);
    }
    if (wantScreen('achievements')) {
      await go(page, '#/commissions?tab=achievements', screen('commissions'));
      await shot(page, 'achievements', vp);
    }
    if (!wantScreen('battle-drawer')) throw Object.assign(new Error('done'), { done: true });

    await page.evaluate(() => { location.hash = '#/battle?stage=1-1&difficulty=normal'; });
    await page.waitForFunction(() => window.__battle?.sim && window.__battle.ui?.select, null, { timeout: 60000 });
    await page.waitForFunction(() => window.__battle.ui.placement?.unitId, null, { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => window.__battle.ui.placement?.cancel?.());
    const placed = await page.evaluate(() => {
      const { sim, ui } = window.__battle;
      sim.cash = 1850;
      for (let y = 0.5; y < sim.map.height; y += 0.5) {
        for (let x = 0.5; x < sim.map.width; x += 0.5) {
          if (!sim.canPlace('aoi', x, y).ok) continue;
          const r = sim.placeTower('aoi', x, y);
          const uid = r?.uid ?? (typeof r === 'number' ? r : null);
          if (uid != null) { ui.select(uid); return uid; }
        }
      }
      return null;
    });
    if (placed == null) throw new Error('could not place Aoi');
    await page.waitForFunction(() => { const el = document.querySelector('[data-testid="tower-panel"]'); return el && !el.hidden; }, null, { timeout: 15000 });
    await settle(page, 1200);
    await shot(page, 'battle-drawer', vp);
  } catch (e) {
    if (!e.done) {
      failed++;
      console.log(`  FAILED: ${e.message}`);
    }
  }
  await page.close();
}

await browser.close();
await server.close();
if (opt('probes')) writeFileSync(opt('probes'), JSON.stringify(probeLog, null, 2));
process.exit(failed ? 1 : 0);
