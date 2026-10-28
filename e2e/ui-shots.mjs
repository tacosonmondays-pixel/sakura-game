// Before/after screenshots for the UI condense milestones (docs/specs/UI_DIRECTION.md §7) at 844x390 and 1280x720,
// and (since the UI M5 final review) 915x412, 932x430, 1024x768 and 1180x820.
// Without --screens it takes the first six shots, as it always did: the lobby, the girl page (Info), the backpack
// Equipment tab, stage prep, achievements and a battle with the girl drawer open. --screens picks from every shot
// below (or `m5` for the whole M5 list). The save is seeded the same way every run (fixed gear rolls, no
// auto-start), the clock is fixed (--now) and the time zone is Central, so two runs on two builds differ only
// where the build differs.
//
//   node e2e/ui-shots.mjs --out /tmp/ui-before                      # the six shots, PNGs named <screen>-<W>x<H>.png
//   node e2e/ui-shots.mjs --out /tmp/ui-after --viewport 844x390          # one size, or a list: 844x390,390x844
//   node e2e/ui-shots.mjs --port 5215 ...                              # a fixed port for its dev server
//   node e2e/ui-shots.mjs --out /tmp/m5 --screens lobby,missions,mail --probe   # + probe-<W>x<H>.json (e2e/probe.mjs)
//   node e2e/ui-shots.mjs --screens m5 --now live                    # the real clock
//   node e2e/ui-shots.mjs --screens profile --probe --judge spill    # + fail (exit 1) when a probe check named fails
//   node e2e/ui-shots.mjs --out <dir> --scenes m1-bar-idle,m1-cast-fx   # only the battle milestones' staged scenes
//                                                                        # (e2e/lib/abilityScenes.mjs for m1-…,
//                                                                        # e2e/lib/m2Scenes.mjs for m2-…,
//                                                                        # e2e/lib/m3Scenes.mjs for m3-…,
//                                                                        # e2e/lib/m4Scenes.mjs for m4-…;
//                                                                        # --probes <file> writes their probe log)
//
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a shot fails.
// A shot whose screen does not exist in this build yet is skipped with a note (the M5 list names later screens).
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';
import { probe, judge, summary } from './probe.mjs';
import { seedUiSave, seedOnlineInvite, seedOnlineHub, goOffline, SHOT_NOW, MORE_FRIENDS } from './uiSeed.mjs';
import { runM1Scenes, M1_SCENES } from './lib/abilityScenes.mjs';
import { runM2Scenes, M2_SCENES } from './lib/m2Scenes.mjs';
import { runM3Scenes, M3_SCENES } from './lib/m3Scenes.mjs';
import { runM4Scenes, M4_SCENES } from './lib/m4Scenes.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);
const out = opt('out', 'ui-shots');
// (--viewport takes one size or a comma list; the UI M5 final review added the common landscape phones 915x412 and
// 932x430 and the tablets in landscape 1024x768 and 1180x820 to the default two)
/** --scenes a,b: the battle milestones' staged scenes (m1-… to m4-…); alone, no screen is shot. */
const SCENES = opt('scenes', null) ? opt('scenes').split(',').map((s) => s.trim()).filter(Boolean) : null;
const sceneRuns = [[runM1Scenes, M1_SCENES, ''], [runM2Scenes, M2_SCENES, '-m2'], [runM3Scenes, M3_SCENES, '-m3'], [runM4Scenes, M4_SCENES, '-m4']]
  .map(([run, list, tag]) => ({ run, tag, want: SCENES ? SCENES.filter((s) => list.includes(s)) : [] }));
const unknownScenes = SCENES ? SCENES.filter((s) => !sceneRuns.some((r) => r.want.includes(s))) : [];
if (unknownScenes.length) {
  console.error(`unknown scene(s): ${unknownScenes.join(', ')}`);
  process.exit(2);
}
const probeLog = {};
const viewports = opt('viewport', null) ? opt('viewport').split(',').map((s) => s.trim()).filter(Boolean)
  : SCENES ? ['844x390', '1280x720'] : ['844x390', '1280x720', '915x412', '932x430', '1024x768', '1180x820'];
const PORT = Number(opt('port', '0'));
const NOW = opt('now', SHOT_NOW); // a Tuesday noon in Central: no weekly reset on the day
// --judge spill,apart: those probe checks fail the run (e2e/probe.mjs judge); implies --probe
const judged = opt('judge', null)?.split(',').map((s) => s.trim()).filter(Boolean) || null;
const withProbe = flag('probe') || !!judged;
mkdirSync(out, { recursive: true });

const isScreen = (id) => `() => document.querySelector('#app')?.dataset.screen === '${id}'`;
/** The lobby secretary's speech bubble stays clear of the tray and the sticker row (probe `apart`; UI M5d review). */
const LOBBY_APART = [['[data-testid="secretary-bubble"]', '.lb-hud > .lb-tray'], ['[data-testid="secretary-bubble"]', '.lb-hud > .lb-stickers']];
/**
 * The Multiplayer hub's locked tiles: the "Coming soon" / "Soon" sticker clear of any other lock and of the tile's
 * words (probe `apart`; UI M5d review 2). The first pair is the review's own (a corner lock no longer drawn).
 */
const MP_APART = [
  ['[data-testid="mp-pvp-soon"]', '#app .mp-pvp .ui-ltile-lock'],
  ['#app .mp-tiles > .ui-ltile > .ui-bdg.soon', '#app .mp-tiles > .ui-ltile > :is(.ui-ltile-lock, .ui-ltile-title, .ui-ltile-line)'],
];

/**
 * Every shot: how to reach it, when it is ready, and the probe options (kind, list). `seed: 'm5'` shots need a
 * player through chapter 3 (the event, Titan Trials, Bounty, Challenge and Sandbox open).
 * hash: a route; page: a page of the dev server instead of the game; open(): a step after the route (a modal);
 * legacy: the old surface a new screen replaces, shot while its route does not exist yet; devNow: the events' dev
 * clock for this shot (set, reloaded, cleared after the shot: keep these shots last in a list).
 */
const SHOTS = {
  // ---- the first six (M0-M4) ----
  lobby: { hash: '#/lobby', ready: isScreen('lobby'), apart: LOBBY_APART },
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
  // the Mailroom (M5c, #/mail); before it existed, its "before" is the Mail modal over the lobby
  mail: {
    hash: '#/mail', ready: isScreen('mail'), kind: 'list', list: '.mbx-list', seed: 'm5',
    legacy: {
      route: 'mail', hash: '#/lobby', ready: isScreen('lobby'),
      open: async (page) => {
        await page.click('[data-testid="top-mail"]');
        await page.waitForSelector('.mbx-modal', { timeout: 10000 });
      },
    },
  },
  happening: { hash: '#/rewards', ready: isScreen('rewards'), kind: 'list', seed: 'm5' },
  // nothing limited running (E9): the dev clock after the Halloween exchange closed (src/ui/events/clock.js)
  'happening-empty': { hash: '#/rewards', ready: isScreen('rewards'), kind: 'list', seed: 'm5', devNow: '2026-11-20T18:00:00Z' },
  settings: { hash: '#/settings', ready: isScreen('settings'), kind: 'list', seed: 'm5' },
  'settings-display': { hash: '#/settings?section=display', ready: isScreen('settings'), kind: 'list', seed: 'm5', open: settingsSection('display', 'Display') },
  'settings-audio': { hash: '#/settings?section=audio', ready: isScreen('settings'), kind: 'list', seed: 'm5', open: settingsSection('audio', 'Audio') },
  recruit: { hash: '#/recruit', ready: isScreen('recruit'), seed: 'm5' },
  'event-halloween': { hash: '#/event/halloween-2026', ready: isScreen('event'), seed: 'm5', resolve: eventHash },
  // the event page after the event and its exchange closed (E9 on the ended phase), on the dev clock
  'event-halloween-ended': { hash: '#/event/halloween-2026', ready: isScreen('event'), seed: 'm5', resolve: eventHash, devNow: '2026-11-20T18:00:00Z' },
  // the Multiplayer hub comes in M5d: until its route exists, its "before" is the co-op hub it replaces. `multiplayer`
  // is signed in on the local test server with one open invite from a friend (uiSeed.mjs seedOnlineInvite);
  // `multiplayer-empty` is a player who never went online (no account, no invites: goOffline)
  multiplayer: { hash: '#/multiplayer', fallback: '#/coop', ready: '() => /multiplayer|coop/.test(document.querySelector("#app")?.dataset.screen || "")', seed: 'm5', prepare: seedOnlineInvite, settleMs: 1800, apart: MP_APART },
  'multiplayer-empty': { hash: '#/multiplayer', fallback: '#/coop', ready: '() => /multiplayer|coop/.test(document.querySelector("#app")?.dataset.screen || "")', seed: 'm5', prepare: goOffline, settleMs: 1800, apart: MP_APART },
  'multiplayer-pvp': { hash: '#/multiplayer', ready: isScreen('multiplayer'), seed: 'm5', needsRoute: 'multiplayer', open: async (page) => { await page.click('[data-testid="mp-pvp"]'); await page.waitForSelector('.ui-sheet', { timeout: 10000 }); } },
  coop: { hash: '#/coop', ready: isScreen('coop'), seed: 'm5', settleMs: 1800 },
  // the lobby with that open invite: the Multiplayer button's red number (M5d; before it, the lobby had no such button)
  'lobby-invite': { hash: '#/lobby', ready: isScreen('lobby'), seed: 'm5', prepare: seedOnlineInvite, prepareAt: ['#/missions', isScreen('missions')], settleMs: 1800, apart: LOBBY_APART },
  // UI M5d review (by name only, not in the m5 list: each signs a fresh account in): online with no invite and a "Your
  // last room"; four friends' invites and a last room (the card's two rows on phones: one invite, then "3 more invites")
  'multiplayer-online': { hash: '#/multiplayer', ready: isScreen('multiplayer'), seed: 'm5', needsRoute: 'multiplayer', prepare: (page) => seedOnlineHub(page, { last: true }), settleMs: 1800, apart: MP_APART },
  'multiplayer-many': { hash: '#/multiplayer', ready: isScreen('multiplayer'), seed: 'm5', needsRoute: 'multiplayer', prepare: (page) => seedOnlineHub(page, { friends: MORE_FRIENDS, last: true }), settleMs: 1800, apart: MP_APART },
  profile: { hash: '#/profile', ready: isScreen('profile'), kind: 'detail', seed: 'm5' },
  students: { hash: '#/students', ready: isScreen('students'), kind: 'list', seed: 'm5' },
  formation: { hash: '#/formation', ready: isScreen('formation'), seed: 'm5' },
  'm5-kit': { page: 'e2e/fixtures/m5-kit.html', ready: '() => document.body?.dataset.kitReady === "1"', kind: 'list', list: '[data-probe-list]' },
};
const FIRST_SIX = ['lobby', 'girl-info', 'backpack-equipment', 'stage-prep', 'achievements', 'battle-drawer'];
const M5 = ['lobby', 'missions', 'commissions-daily', 'commissions-login', 'achievements', 'bounty', 'assault', 'titans', 'campaign',
  'mall-general', 'mall-boss', 'mail', 'happening', 'settings', 'settings-display', 'settings-audio', 'recruit', 'event-halloween',
  'multiplayer-empty', 'multiplayer', 'multiplayer-pvp', 'coop', 'lobby-invite', 'profile', 'students', 'formation', 'm5-kit', 'happening-empty',
  'event-halloween-ended'];

/**
 * A Settings section: its rail tab (M5c), or before the rail, the old panel with that title scrolled to the top.
 * @param {string} id the rail section ('display', 'audio', …)
 * @param {string} title the old panel's title
 */
function settingsSection(id, title) {
  return async (page) => {
    const tab = await page.$(`#app [data-testid="tab-${id}"]`);
    if (tab) {
      await tab.click();
      return;
    }
    await page.evaluate((t) => {
      const p = [...document.querySelectorAll('#app .panel-title')].find((x) => x.textContent.trim() === t)?.closest('.panel');
      p?.scrollIntoView({ block: 'start' });
    }, title);
  };
}

const pick = opt('screens', null);
const names = !pick ? (SCENES ? [] : FIRST_SIX) : pick.split(',').flatMap((s) => (s.trim() === 'm5' ? M5 : [s.trim()])).filter(Boolean);
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

const server = await createServer({ root: process.cwd(), server: { port: PORT, strictPort: PORT > 0, host: '127.0.0.1' }, logLevel: 'error' });
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

async function go(page, hash, ready, settleMs = 900) {
  await page.evaluate((hh) => { location.hash = hh; }, hash);
  await page.waitForFunction(ready, null, { timeout: 60000 });
  // the screen change has finished (no transition, no loading chip): a busy machine never shoots the old screen
  await page.waitForFunction(() => !document.documentElement.dataset.tx && !document.querySelector('.ld-chip.on'), null, { timeout: 60000 }).catch(() => {});
  await closeModals(page);
  await settle(page, settleMs);
}

async function shot(page, name, vp) {
  const file = join(out, `${name}-${vp}.png`);
  await page.screenshot({ path: file });
  console.log(`  saved ${file}`);
}

const hasRoute = (page, name) => page.evaluate(async (n) => (await import('/src/ui/router.js')).hasRoute(n), name);

/**
 * Sets (iso) or clears (null) the events' dev preview clock (localStorage 'sakura-dev-now', dev builds only) and
 * reloads: the clock reads the key at start-up. The game clock stays the fixed --now.
 */
async function devClock(page, iso) {
  await page.evaluate((t) => {
    window.__sakura?.store?.saveNow?.();
    if (t) localStorage.setItem('sakura-dev-now', t);
    else localStorage.removeItem('sakura-dev-now');
  }, iso);
  await page.reload({ waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 30000 });
  await closeModals(page);
}

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
  if (sceneRuns.some((r) => r.want.length)) {
    const sp = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    // (a busy shared machine can take longer than Playwright's 30 s to load even about:blank; the M4 review, round r3)
    sp.setDefaultNavigationTimeout(120000);
    sp.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
    console.log(`viewport ${vp} (scenes)`);
    for (const r of sceneRuns) {
      if (!r.want.length) continue;
      try {
        const log = await r.run(sp, { base, vp, want: r.want, shot: (name) => shot(sp, name, vp) });
        probeLog[`${vp}${r.tag}`] = log;
        // (the M4 scenes check the drawer's layout and type floor themselves: a miss fails the run)
        for (const f of log?.failures || []) {
          failed++;
          console.log(`  FAILED (${r.tag.slice(1) || 'm1'} check): ${f}`);
        }
      } catch (e) {
        failed++;
        console.log(`  FAILED (${r.tag.slice(1) || 'm1'} scenes): ${e.stack || e.message}`);
      }
    }
    await sp.close();
  }
  if (!names.length) continue;
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
          // a screen this build does not have yet shows the old surface it replaces (the Mail modal)
          const legacy = s.legacy && !(await hasRoute(page, s.legacy.route)) ? s.legacy : null;
          let hash = legacy ? legacy.hash : s.resolve ? (await s.resolve(page)) || s.hash : s.hash;
          if (s.fallback) {
            const route = hash.replace(/^#\//, '').split(/[/?]/)[0];
            if (!(await hasRoute(page, route))) hash = s.fallback;
          }
          if (s.devNow) await devClock(page, s.devNow);
          if (s.prepare) {
            // (a fresh draw of the screen after the state is set: prepared on another screen, the lobby by default)
            const [at, atReady] = s.prepareAt || ['#/lobby', isScreen('lobby')];
            await go(page, at, atReady);
            await s.prepare(page);
          }
          await go(page, hash, legacy ? legacy.ready : s.ready, s.settleMs);
          const open = legacy ? legacy.open : s.open;
          if (open) {
            await open(page);
            await settle(page, 600);
          }
        }
      }
      await shot(page, name, vp);
      if (withProbe) {
        const r = await probe(page, { kind: s.kind || 'hub', list: s.list || null, apart: s.apart || [] });
        probes[name] = r;
        console.log(`    probe: ${summary(r)}`);
        const fails = judged ? judge(r, { only: judged }) : [];
        if (fails.length) {
          failed++;
          console.log(`  FAILED ${name} probe: ${fails.join(' | ')}`);
        }
      }
      if (s.open || s.legacy) await closeModals(page);
      if (s.devNow) await devClock(page, null);
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
if (opt('probes')) writeFileSync(opt('probes'), JSON.stringify(probeLog, null, 2));
process.exit(failed ? 1 : 0);
