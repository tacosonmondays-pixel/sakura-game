// Before/after screenshots for the UI condense milestones (docs/specs/UI_DIRECTION.md §7) at 844x390 and 1280x720.
// Without --screens it takes the first six shots, as it always did: the lobby, the girl page (Info), the backpack
// Equipment tab, stage prep, achievements and a battle with the girl drawer open. --screens picks from every shot
// below (or `m5` for the whole M5 list). The save is seeded the same way every run (fixed gear rolls, no
// auto-start), the clock is fixed (--now) and the time zone is Central, so two runs on two builds differ only
// where the build differs.
//
//   node e2e/ui-shots.mjs --out /tmp/ui-before                      # the six shots, PNGs named <screen>-<W>x<H>.png
//   node e2e/ui-shots.mjs --out /tmp/ui-after --viewport 844x390
//   node e2e/ui-shots.mjs --out /tmp/m5 --screens lobby,missions,mail --probe   # + probe-<W>x<H>.json (e2e/probe.mjs)
//   node e2e/ui-shots.mjs --screens m5 --now live                    # the real clock
//
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a shot fails.
// A shot whose screen does not exist in this build yet is skipped with a note (the M5 list names later screens).
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';
import { probe, summary } from './probe.mjs';
import { seedUiSave, SHOT_NOW } from './uiSeed.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);
const out = opt('out', 'ui-shots');
const viewports = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];
const NOW = opt('now', SHOT_NOW); // a Tuesday noon in Central: no weekly reset on the day
const withProbe = flag('probe');
mkdirSync(out, { recursive: true });

const isScreen = (id) => `() => document.querySelector('#app')?.dataset.screen === '${id}'`;

/**
 * Every shot: how to reach it, when it is ready, and the probe options (kind, list). `seed: 'm5'` shots need a
 * player through chapter 3 (the event, Titan Trials, Bounty, Challenge and Sandbox open).
 * hash: a route; page: a page of the dev server instead of the game; open(): a step after the route (a modal).
 */
const SHOTS = {
  // ---- the first six (M0-M4) ----
  lobby: { hash: '#/lobby', ready: isScreen('lobby') },
  'girl-info': { hash: '#/student/aoi?tab=info', ready: isScreen('student'), kind: 'detail' },
  'backpack-equipment': { hash: '#/backpack?tab=equipment', ready: isScreen('backpack'), kind: 'list' },
  'stage-prep': { hash: '#/stage/2-3', ready: isScreen('stage'), kind: 'detail' },
  achievements: { hash: '#/commissions?tab=achievements', ready: isScreen('commissions'), kind: 'list' },
  'battle-drawer': { battle: true },
  // ---- the M5 list (docs/specs/UI_DIRECTION.md §5.9, §5.10; notes/ui-m5/PLAN.md §5) ----
  missions: { hash: '#/missions', ready: isScreen('missions'), list: '.ma-hub-grid', seed: 'm5' },
  // the Missions hub the first time after Titan Trials opened: its "Open!" sticker (src/ui/badges.js openModes)
  'missions-open': {
    hash: '#/missions', ready: isScreen('missions'), list: '.ma-hub-grid', seed: 'm5',
    prepare: (page) => page.evaluate(() => localStorage.setItem('ss-open-seen', JSON.stringify({ known: ['challenge', 'sandbox'], pending: [] }))),
  },
  'commissions-daily': { hash: '#/commissions?tab=daily', ready: isScreen('commissions'), kind: 'list', list: '.ma-mission-list', seed: 'm5' },
  'commissions-login': { hash: '#/commissions?tab=login', ready: isScreen('commissions'), list: '.ma-calendar', seed: 'm5' },
  bounty: { hash: '#/bounty', ready: isScreen('bounty'), seed: 'm5' },
  assault: { hash: '#/assault', ready: isScreen('assault'), seed: 'm5' },
  titans: { hash: '#/titans', ready: isScreen('titans'), list: '.tt-cards', seed: 'm5' },
  campaign: { hash: '#/campaign?chapter=1', ready: isScreen('campaign'), seed: 'm5' },
  'mall-general': { hash: '#/mall?tab=general', ready: isScreen('mall'), kind: 'list', list: '.ma-offers', seed: 'm5' },
  'mall-boss': { hash: '#/mall?tab=boss', ready: isScreen('mall'), kind: 'list', list: '.ma-offers', seed: 'm5' },
  mail: {
    hash: '#/lobby', ready: isScreen('lobby'), kind: 'list', list: '.mbx-list', seed: 'm5',
    open: async (page) => {
      await page.click('[data-testid="top-mail"]');
      await page.waitForSelector('.mbx-modal', { timeout: 10000 });
    },
  },
  happening: { hash: '#/rewards', ready: isScreen('rewards'), kind: 'list', seed: 'm5' },
  settings: { hash: '#/settings', ready: isScreen('settings'), kind: 'list', seed: 'm5' },
  recruit: { hash: '#/recruit', ready: isScreen('recruit'), seed: 'm5' },
  'event-halloween': { hash: '#/event/halloween-2026', ready: isScreen('event'), seed: 'm5', resolve: eventHash },
  // the Multiplayer hub comes in M5d: until its route exists, its "before" is the co-op hub it replaces
  multiplayer: { hash: '#/multiplayer', fallback: '#/coop', ready: '() => /multiplayer|coop/.test(document.querySelector("#app")?.dataset.screen || "")', seed: 'm5' },
  'multiplayer-pvp': { hash: '#/multiplayer', ready: isScreen('multiplayer'), seed: 'm5', needsRoute: 'multiplayer', open: async (page) => { await page.click('[data-testid="mp-pvp"]'); await page.waitForSelector('.ui-sheet', { timeout: 10000 }); } },
  coop: { hash: '#/coop', ready: isScreen('coop'), seed: 'm5' },
  profile: { hash: '#/profile', ready: isScreen('profile'), kind: 'detail', seed: 'm5' },
  students: { hash: '#/students', ready: isScreen('students'), kind: 'list', seed: 'm5' },
  formation: { hash: '#/formation', ready: isScreen('formation'), seed: 'm5' },
  'm5-kit': { page: 'e2e/fixtures/m5-kit.html', ready: '() => document.body?.dataset.kitReady === "1"', kind: 'list', list: '[data-probe-list]' },
};
const FIRST_SIX = ['lobby', 'girl-info', 'backpack-equipment', 'stage-prep', 'achievements', 'battle-drawer'];
const M5 = ['lobby', 'missions', 'commissions-daily', 'commissions-login', 'achievements', 'bounty', 'assault', 'titans', 'campaign',
  'mall-general', 'mall-boss', 'mail', 'happening', 'settings', 'recruit', 'event-halloween', 'multiplayer', 'multiplayer-pvp', 'coop',
  'profile', 'students', 'formation', 'm5-kit'];

const pick = opt('screens', null);
const names = !pick ? FIRST_SIX : pick.split(',').flatMap((s) => (s.trim() === 'm5' ? M5 : [s.trim()])).filter(Boolean);
const unknown = names.filter((n) => !SHOTS[n]);
if (unknown.length) {
  console.error(`unknown screen(s): ${unknown.join(', ')}\nknown: ${Object.keys(SHOTS).join(', ')}`);
  process.exit(2);
}
const m5Seed = !!pick && names.some((n) => SHOTS[n].seed === 'm5');

/** The Halloween event's route, from the event data (its id is not spelled here). */
async function eventHash(page) {
  return page.evaluate(async () => {
    const { EVENTS } = await import('/src/data/events/index.js');
    const ev = EVENTS.find((e) => e.key === 'halloween') || EVENTS[0];
    return ev ? `#/event/${ev.id}?tab=story` : null;
  });
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}; clock: ${NOW}; screens: ${names.join(', ')}`);
let failed = 0;

/** Every girl, a squad, fixed currencies and six gear pieces rolled from fixed seeds (two on Aoi). m5: chapters 1-3 cleared. */
const seed = (page, m5) => seedUiSave(page, m5);

const settle = (page, ms = 900) => page.waitForTimeout(ms)
  .then(() => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300))))));
const closeModals = (page) => page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));

async function go(page, hash, ready) {
  await page.evaluate((hh) => { location.hash = hh; }, hash);
  await page.waitForFunction(ready, null, { timeout: 60000 });
  // the screen change has finished (no transition, no loading chip): a busy machine never shoots the old screen
  await page.waitForFunction(() => !document.documentElement.dataset.tx && !document.querySelector('.ld-chip.on'), null, { timeout: 60000 }).catch(() => {});
  await closeModals(page);
  await settle(page);
}

async function shot(page, name, vp) {
  const file = join(out, `${name}-${vp}.png`);
  await page.screenshot({ path: file });
  console.log(`  saved ${file}`);
}

const hasRoute = (page, name) => page.evaluate(async (n) => (await import('/src/ui/router.js')).hasRoute(n), name);

async function battleDrawer(page) {
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
}

for (const vp of viewports) {
  const [W, H] = vp.split('x').map(Number);
  const touch = W < 1000;
  const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce', deviceScaleFactor: 1, timezoneId: 'America/Chicago' });
  const page = await context.newPage();
  if (NOW !== 'live' && page.clock?.setFixedTime) await page.clock.setFixedTime(new Date(NOW));
  // toasts come and go on their own timers (a lesson, an achievement): never in a before/after pair
  await page.addInitScript(() => {
    const css = '.toast-host, .jn-toast { display: none !important; }';
    document.addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: css })));
  });
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
  console.log(`viewport ${vp}`);
  const probes = {};
  try {
    await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 90000 });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 30000 });
    const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 8000 }).catch(() => null);
    if (later) await later.click({ force: true });
    await seed(page, m5Seed);
  } catch (e) {
    failed++;
    console.log(`  FAILED to open the game: ${e.message}`);
    await context.close();
    continue;
  }
  let inGame = true;
  for (const name of names) {
    const s = SHOTS[name];
    try {
      if (s.page) {
        await page.goto(`${base}${s.page}`, { waitUntil: 'load', timeout: 90000 });
        inGame = false;
        await page.waitForFunction(s.ready, null, { timeout: 30000 });
        await settle(page, 400);
      } else {
        if (!inGame) {
          await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 90000 });
          await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 30000 });
          await closeModals(page);
          inGame = true;
        }
        if (s.battle) await battleDrawer(page);
        else {
          if (s.needsRoute && !(await hasRoute(page, s.needsRoute))) {
            console.log(`  skipped ${name}: no "${s.needsRoute}" screen in this build yet`);
            continue;
          }
          let hash = s.resolve ? (await s.resolve(page)) || s.hash : s.hash;
          if (s.fallback) {
            const route = hash.replace(/^#\//, '').split(/[/?]/)[0];
            if (!(await hasRoute(page, route))) hash = s.fallback;
          }
          if (s.prepare) {
            await go(page, '#/lobby', isScreen('lobby')); // (a fresh draw of the screen after the state is set)
            await s.prepare(page);
          }
          await go(page, hash, s.ready);
          if (s.open) {
            await s.open(page);
            await settle(page, 600);
          }
        }
      }
      await shot(page, name, vp);
      if (withProbe) {
        const r = await probe(page, { kind: s.kind || 'hub', list: s.list || null });
        probes[name] = r;
        console.log(`    probe: ${summary(r)}`);
      }
      if (s.open) await closeModals(page);
    } catch (e) {
      failed++;
      console.log(`  FAILED ${name}: ${e.message}`);
    }
  }
  if (withProbe) writeFileSync(join(out, `probe-${vp}.json`), `${JSON.stringify(probes, null, 2)}\n`);
  await context.close();
}

await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
