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
//
// [ui-ink] UI v2 "Ink & Paper" (notes/ui-v2/build/PLAN.md, V1 tooling):
//   --seed ink        the mock-ups' sample save (uiSeed.mjs seedInkSave) on its clock (INK_NOW) with a seeded
//                     Math.random, so the data matches the mock-ups and a 10-pull is the same every run
//   --dsf 3           device scale factor (3: the reviewers' zoom crops)
//   --viewport 390x844  portrait phones: touch, the rotate prompt dismissed through its own session key
//   --screens ink     every shot v2 touches; --screens regress: the screens it reaches only through shared parts
//   --probe           also the probe's v2 numbers (e2e/probe.mjs v2: true), judged with --judge v2numbers,pink,...
//   --pixels          the pixel probes a shot names (e2e/pixels.mjs) into pixels-<W>x<H>.json; --judge pixels makes
//                     a failed pixel check fail the run (with --judge heads,clipped,pixels ...)
//
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a shot fails.
// A shot whose screen does not exist in this build yet is skipped with a note (the M5 list names later screens).
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';
import { probe, judge, summary } from './probe.mjs';
import { SHOT_DEFS, MILESTONES } from './shots/index.mjs';
import { tabJunction, ringContinuity, contrastOnPixels } from './pixels.mjs';
import { seedUiSave, seedInkSave, inkRandomInit, seedOnlineInvite, seedOnlineHub, goOffline, SHOT_NOW, INK_NOW, INK_RANDOM_SEED, MORE_FRIENDS } from './uiSeed.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);
const out = opt('out', 'ui-shots');
// (--viewport takes one size or a comma list; the UI M5 final review added the common landscape phones 915x412 and
// 932x430 and the tablets in landscape 1024x768 and 1180x820 to the default two)
const viewports = opt('viewport', null) ? opt('viewport').split(',').map((s) => s.trim()).filter(Boolean)
  : ['844x390', '1280x720', '915x412', '932x430', '1024x768', '1180x820'];
const PORT = Number(opt('port', '0'));
const SEED = opt('seed', 'm5'); // 'm5' (the M5 save) or 'ink' (the UI v2 mock-ups' sample save)
const INK = SEED === 'ink';
const NOW = opt('now', INK ? INK_NOW : SHOT_NOW); // a Tuesday noon in Central (no weekly reset), or the ink clock
const DSF = Math.max(1, Number(opt('dsf', 1)) || 1);
// --judge spill,apart: those probe checks fail the run (e2e/probe.mjs judge); implies --probe
const judged = opt('judge', null)?.split(',').map((s) => s.trim()).filter(Boolean) || null;
const withProbe = flag('probe') || !!judged;
const withPixels = flag('pixels');
// --crops: the reviewers' close-ups (best with --dsf 3): every surface's chamfer corners, the open rail tab, the wallets,
// the first countdown chip, and medium 3's selected tile beside a Mythic one, into <out>/crops/
const withCrops = flag('crops');
mkdirSync(out, { recursive: true });
if (withCrops) mkdirSync(join(out, 'crops'), { recursive: true });

const isScreen = (id) => `() => document.querySelector('#app')?.dataset.screen === '${id}'`;
/** The home secretary's speech bubble stays clear of the rail, the right stack and the chapter (probe `apart`; [ui-ink] V2). */
const LOBBY_APART = [['[data-testid="secretary-bubble"]', '#app .home-rail'], ['[data-testid="secretary-bubble"]', '#app .home-stack'], ['[data-testid="secretary-bubble"]', '#app .home-chap-host']];
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
  // ([ui-ink] V2: drawn fresh from another screen, so the seeded secretary shows: the game opens on the lobby before the
  // seed, and the same hash again does not redraw it)
  lobby: { hash: '#/lobby', ready: isScreen('lobby'), apart: LOBBY_APART, prepareAt: ['#/missions', isScreen('missions')], prepare: async () => {} },
  'girl-info': { hash: '#/student/aoi?tab=info', ready: isScreen('student'), kind: 'detail' },
  'backpack-equipment': { hash: '#/backpack?tab=equipment', ready: isScreen('backpack'), kind: 'list' },
  'stage-prep': { hash: '#/stage/2-3', ready: isScreen('stage'), kind: 'detail' },
  achievements: { hash: '#/commissions?tab=achievements', ready: isScreen('commissions'), kind: 'list' },
  'battle-drawer': { battle: true },
  // [ui-ink] the same with the 3D scene hidden and every animation held: the battle's own UI alone, the pixel gate that
  // the UI v2 scope fence leaves the battle untouched (the scene itself never renders twice the same)
  'battle-drawer-ui': { battle: true, uiOnly: true },
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
  // [ui-ink] the other token shops: their plate heads carry the restock chip, the wallet and the "i" (V1 review 2: at
  // 390x844 Memento's second row was cut and Gem Shop's title ran under its chip, on shots no list held)
  'mall-gems': { hash: '#/mall?tab=gems', ready: isScreen('mall'), kind: 'list', list: '.ma-offers', seed: 'm5' },
  'mall-recruit': { hash: '#/mall?tab=recruit', ready: isScreen('mall'), kind: 'list', list: '.ma-offers', seed: 'm5' },
  'mall-bounty': { hash: '#/mall?tab=bounty', ready: isScreen('mall'), kind: 'list', list: '.ma-offers', seed: 'm5' },
  'mall-memento': { hash: '#/mall?tab=memento', ready: isScreen('mall'), kind: 'list', list: '.ma-offers', seed: 'm5' },
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
  // ---- [ui-ink] UI v2 "Ink & Paper" (notes/ui-v2/build/PLAN.md section 6 V1); made for --seed ink ----
  // the home with its menu open (V2 replaces the Menu Tab with the side sheet; the Menu Tab is its before)
  'home-menu': {
    hash: '#/lobby', ready: isScreen('lobby'), prepareAt: ['#/missions', isScreen('missions')], prepare: async () => {},
    open: async (page) => { await page.click('[data-testid="top-menu"]'); await page.waitForSelector('.menu-tab, [data-testid="menu-sheet"]', { timeout: 10000 }); },
  },
  // Marumi as the secretary (V2's living scene, held at t = 0 and t = 2 s through its dev hook), the same under Reduce
  // motion, and Low graphics (Marumi again: both must show her still portrait)
  'home-marumi': { hash: '#/lobby', ready: isScreen('lobby'), prepareAt: ['#/missions', isScreen('missions')], prepare: setSave({ secretary: 'marumi' }), open: liveAt(0), after: restoreSave, settleMs: 1500 },
  'home-marumi-2s': { hash: '#/lobby', ready: isScreen('lobby'), prepareAt: ['#/missions', isScreen('missions')], prepare: setSave({ secretary: 'marumi' }), open: liveAt(2), after: restoreSave, settleMs: 1500 },
  'home-marumi-reduced': { hash: '#/lobby', ready: isScreen('lobby'), prepareAt: ['#/missions', isScreen('missions')], prepare: setSave({ secretary: 'marumi', settings: { reduceMotion: true } }), after: restoreSave, settleMs: 1500 },
  'home-low': { hash: '#/lobby', ready: isScreen('lobby'), prepareAt: ['#/missions', isScreen('missions')], prepare: setSave({ secretary: 'marumi', settings: { quality: 'low' } }), after: restoreSave, settleMs: 1500 },
  // the girl page as the mock-ups draw it: Ruri, LV 24/40, P4, her three pieces; a girl with nothing on; the picker
  'girl-info-ruri': { hash: '#/student/ruri?tab=info', ready: isScreen('student'), kind: 'detail' },
  'girl-gear': { hash: '#/student/ruri?tab=gear', ready: isScreen('student'), kind: 'detail' },
  'girl-gear-empty': { hash: '#/student/momo?tab=gear', ready: isScreen('student'), kind: 'detail' },
  // medium 3 on the real gear picker: her charm slot's sheet, the worn piece (selected) beside the Mythic spare
  'girl-gear-picker': {
    hash: '#/student/ruri?tab=gear', ready: isScreen('student'), kind: 'detail',
    open: async (page) => {
      await page.click('#app [data-testid="slot-charm"]');
      await page.waitForSelector('[data-testid="gear-sheet"] [data-testid="gear-picker"]', { timeout: 10000 });
      await page.evaluate(() => document.querySelector('[data-testid="gear-sheet"] [data-testid="gear-picker"]')?.scrollIntoView({ block: 'center' }));
    },
  },
  'roster-end': { hash: '#/students', ready: isScreen('students'), kind: 'list', open: (page) => page.evaluate(() => { const b = document.querySelector('#app .screen-body'); if (b) b.scrollTop = b.scrollHeight; }) },
  // the Formation pick (V3 makes the grid the squad): today's picker
  'roster-pick': { hash: '#/formation', ready: isScreen('formation'), open: (page) => page.evaluate(() => document.querySelector('#app .mb-formation-pick')?.scrollIntoView({ block: 'start' })) },
  'commissions-codes': { hash: '#/commissions?tab=codes', ready: isScreen('commissions'), kind: 'list' },
  'mail-history': { hash: '#/mail?tab=history', ready: isScreen('mail'), kind: 'list', list: '.mbx-list' },
  // FREE PULLS (C9): Recruit will show Happening Now's income guide; this is that guide today
  'recruit-free': { hash: '#/rewards?tab=free', ready: isScreen('rewards'), kind: 'list' },
  // a 10-pull on the seeded clock and RNG (it spends the tickets: keep it late in a list), Skip to the result
  'recruit-result': { hash: '#/recruit', ready: isScreen('recruit'), open: tenPull },
  'mall-buy': {
    hash: '#/mall?tab=general', ready: isScreen('mall'), kind: 'list',
    open: async (page) => { await page.click('#app [data-testid^="buy-gen_"]'); await page.waitForSelector('[data-testid="buy-confirm"]', { timeout: 10000 }); },
  },
  // medium 3 on the real salvage selection: a picked piece beside an unpicked Mythic one
  'backpack-salvage': { hash: '#/backpack?tab=equipment', ready: isScreen('backpack'), kind: 'list', open: salvagePick },
  // the kit fixture (every kit component on paper and on ink, folder tabs in five states, the selected tiles)
  // (its pixel probes run in e2e/ink-kit.mjs, on a viewport that never zooms the 876 px page out)
  'ink-kit': { page: 'e2e/fixtures/ink-kit.html', ready: '() => document.body?.dataset.kitReady === "1"', kind: 'list', list: '[data-probe-list]', pixels: async () => ({}) },
};

/**
 * [ui-ink] V2: the home's living scene held at `t` seconds (window.__sakura.live, dev builds): it renders that frame and
 * stops its clock, so the shot is the same every run. A build without the living scene (or a fallback to her still
 * portrait) has no hook: the shot is the still home.
 */
function liveAt(t) {
  return async (page) => {
    await page.waitForFunction(() => !window.__sakura?.live || window.__sakura.live.state !== 'loading', null, { timeout: 15000 }).catch(() => {});
    await page.evaluate((tt) => window.__sakura?.live?.renderAt?.(tt), t);
  };
}

/** [ui-ink] Puts the secretary and settings a shot needs into the save (restoreSave puts them back). */
function setSave(patch) {
  return (page) => page.evaluate((pt) => {
    const { store } = window.__sakura;
    const p = store.profile;
    window.__inkSaved ||= { secretary: p.secretary, settings: { reduceMotion: !!p.settings.reduceMotion, quality: p.settings.quality } };
    if (pt.secretary) p.secretary = pt.secretary;
    Object.assign(p.settings, pt.settings || {});
    document.documentElement.toggleAttribute('data-reduce-motion', !!p.settings.reduceMotion);
    store.commit('e2e');
  }, patch);
}
function restoreSave(page) {
  return page.evaluate(() => {
    const s = window.__inkSaved;
    if (!s) return;
    const { store } = window.__sakura;
    store.profile.secretary = s.secretary;
    Object.assign(store.profile.settings, s.settings);
    document.documentElement.toggleAttribute('data-reduce-motion', !!s.settings.reduceMotion);
    window.__inkSaved = null;
    store.commit('e2e');
  });
}

/** [ui-ink] A 10-pull with performance.now held for the draw (the seed is Date.now ^ performance.now), then Skip. */
async function tenPull(page) {
  await page.evaluate(() => { window.__inkPerf = performance.now; performance.now = () => 4242; });
  try {
    await page.click('#app [data-testid="pull-10"]');
    const ok = await page.waitForSelector('[data-testid="confirm-pull"]', { timeout: 5000 }).catch(() => null);
    if (ok) await ok.click();
    await page.waitForSelector('[data-testid="reveal-skip"], [data-testid="reveal-summary"]', { timeout: 15000 });
  } finally {
    await page.evaluate(() => { if (window.__inkPerf) performance.now = window.__inkPerf; });
  }
  for (let i = 0; i < 4; i++) {
    if (await page.$('[data-testid="reveal-summary"]')) break;
    await page.click('[data-testid="reveal-skip"]', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
  await page.waitForSelector('[data-testid="reveal-summary"]', { timeout: 15000 });
}

/** [ui-ink] Multi-salvage on, then pick the piece beside the first Mythic one (which stays unpicked). */
async function salvagePick(page) {
  await page.click('#app [data-testid="salvage-mode"]');
  await page.waitForSelector('#app .mb-gear-grid.picking', { timeout: 10000 });
  const uid = await page.evaluate(() => {
    const gear = window.__sakura.store.profile.gear;
    const cards = [...document.querySelectorAll('#app .mb-gear-grid.picking .mb-gear[data-gear]')];
    const pickable = (c) => !!c && !c.classList.contains('blocked');
    const mythic = (c) => gear[c.dataset.gear]?.rarity === 'mythic';
    const m = cards.find((c) => mythic(c) && pickable(c));
    if (!m) return null;
    const top = (c) => c.getBoundingClientRect().top;
    // the closest pickable piece that is not Mythic: in the Mythic's own row first, then the rows after it
    const rest = cards.filter((c) => pickable(c) && !mythic(c));
    const next = rest.find((c) => Math.abs(top(c) - top(m)) < 4) || rest.find((c) => top(c) > top(m)) || rest[0];
    return next?.dataset.gear || null;
  });
  if (!uid) return;
  await page.click(`#app .mb-gear[data-gear="${uid}"]`);
  // the picked card whole above the salvage bar, the Mythic one beside or above it
  await page.evaluate((u) => {
    const card = document.querySelector(`#app .mb-gear[data-gear="${u}"]`);
    const body = document.querySelector('#app .screen-body');
    const bar = document.querySelector('#app [data-testid="salvage-bar"]');
    if (!card || !body) return;
    const r = card.getBoundingClientRect();
    const limit = (bar ? bar.getBoundingClientRect().top : innerHeight) - 8;
    body.scrollTop += r.bottom - limit;
  }, uid);
}
const FIRST_SIX = ['lobby', 'girl-info', 'backpack-equipment', 'stage-prep', 'achievements', 'battle-drawer'];
const M5 = ['lobby', 'missions', 'commissions-daily', 'commissions-login', 'achievements', 'bounty', 'assault', 'titans', 'campaign',
  'mall-general', 'mall-boss', 'mail', 'happening', 'settings', 'settings-display', 'settings-audio', 'recruit', 'event-halloween',
  'multiplayer-empty', 'multiplayer', 'multiplayer-pvp', 'coop', 'lobby-invite', 'profile', 'students', 'formation', 'm5-kit', 'happening-empty',
  'event-halloween-ended'];
/** [ui-ink] Every shot UI v2 touches (V1 to V6); the 10-pull spends the tickets, so it comes last before the fixture. */
const INK_LIST = ['lobby', 'home-menu', 'home-marumi', 'home-marumi-2s', 'home-marumi-reduced', 'home-low', 'girl-info', 'girl-info-ruri', 'girl-gear', 'girl-gear-empty',
  'girl-gear-picker', 'students', 'roster-end', 'formation', 'roster-pick', 'missions', 'commissions-daily', 'commissions-login', 'commissions-codes',
  'mail', 'mail-history', 'recruit', 'recruit-free', 'mall-general', 'mall-boss', 'mall-gems', 'mall-recruit', 'mall-bounty', 'mall-memento', 'mall-buy',
  'backpack-salvage', 'multiplayer-empty', 'multiplayer',
  'multiplayer-pvp', 'recruit-result', 'ink-kit'];
/** [ui-ink] The screens v2 reaches only through shared components (battle-drawer must stay pixel-identical). */
const REGRESS = ['bounty', 'assault', 'titans', 'campaign', 'happening', 'settings', 'profile', 'event-halloween', 'coop', 'backpack-equipment', 'stage-prep',
  'achievements', 'battle-drawer', 'battle-drawer-ui'];
const LISTS = { m5: M5, ink: INK_LIST, regress: REGRESS };
// [ui-v2-menus] the per-milestone shot lists (e2e/shots/m*.mjs): their shots join these, each list is `--screens <id>`
for (const [name, s] of Object.entries(SHOT_DEFS)) {
  if (SHOTS[name]) throw new Error(`e2e/shots defines "${name}", which ui-shots already has`);
  SHOTS[name] = s;
}
for (const [id, l] of Object.entries(MILESTONES)) LISTS[id] = l;
LISTS.menus = [...new Set(Object.values(MILESTONES).flat())];

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
const names = !pick ? FIRST_SIX : [...new Set(pick.split(',').flatMap((s) => LISTS[s.trim()] || [s.trim()]).filter(Boolean))];
const unknown = names.filter((n) => !SHOTS[n]);
if (unknown.length) {
  console.error(`unknown screen(s): ${unknown.join(', ')}\nknown: ${Object.keys(SHOTS).join(', ')}`);
  process.exit(2);
}
const m5Seed = !!pick && names.some((n) => SHOTS[n].seed === 'm5');
/** [ui-ink] Pixel probes for a shot without its own: rings on the first panels and the folder-tab junctions. */
const DEFAULT_PIXELS = async (page) => ({
  panels: await ringContinuity(page, '#app .ui-panel, #app .panel, #app .mb-card, #app .ls-panel:not(.bare), .ui-sheet:not(.full), .modal', { shape: 'pair', limit: 3 }),
  tabs: await tabJunction(page, '#app .ui-tabbed'),
  titles: await contrastOnPixels(page, '#app .topbar-title, #app .ui-plate-title > span, #app .panel-title', { limit: 6 }),
  // the button labels on top, the overlays' included (V1 review 1: the pull result's Close on the night reveal)
  buttons: await contrastOnPixels(page, '.btn > .btn-label', { limit: 16, onTop: true }),
  // the stickers, badges, chips and countdowns on top, over whatever is behind them (V1 review 2: the night OPEN chip's
  // 8 % wash left cyan words on the lobby's bright painting at 1.6:1)
  stickers: await contrastOnPixels(page, STICKERS, { limit: 24, onTop: true }),
});
/** [ui-ink] The small marks with words of their own: badges and stickers, chips, countdown chips, rarity tags. */
const STICKERS = [':is(.ui-bdg, .ui-sticker, .ui-chip, .ui-cd, .ui-rar)', ':is(.ui-bdg, .ui-sticker, .ui-chip, .ui-cd, .ui-rar) *']
  .flatMap((s) => [`#app ${s}`, `.ui-layer ${s}`]).join(', ');

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
console.log(`browser: ${label}; seed: ${SEED}; clock: ${NOW}; dsf: ${DSF}; screens: ${names.join(', ')}`);
let failed = 0;

/** Every girl, a squad, fixed currencies and six gear pieces rolled from fixed seeds (two on Aoi). m5: chapters 1-3 cleared. */
const seed = (page, m5) => (INK ? seedInkSave(page) : seedUiSave(page, m5));

const settle = (page, ms = 900) => page.waitForTimeout(ms)
  .then(() => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300))))));
const closeModals = (page) => page.evaluate(() => {
  document.querySelectorAll('.modal-overlay').forEach((o) => o.remove());
  // ([ui-ink] V2: the home's menu sheet closes through its own X, so the home's UI comes back)
  document.querySelector('[data-testid="menu-sheet-close"]')?.click();
});

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

/** [ui-ink] The close-ups of one shot (--crops): boxes in viewport px, clamped; each saved as its own PNG. */
async function crops(page, name, vp) {
  const boxes = await page.evaluate(() => {
    const out = [];
    const W = innerWidth;
    const H = innerHeight;
    const add = (tag, x, y, w, h) => {
      const x0 = Math.max(0, Math.floor(x));
      const y0 = Math.max(0, Math.floor(y));
      const x1 = Math.min(W, Math.ceil(x + w));
      const y1 = Math.min(H, Math.ceil(y + h));
      if (x1 - x0 > 8 && y1 - y0 > 8) out.push({ tag, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
    };
    const shown = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < H && r.left < W; };
    const first = (sel) => [...document.querySelectorAll(sel)].find(shown);
    // chamfered surfaces: the top-right and bottom-left corners
    for (const [tag, sel] of [['panel', '#app .ls > .ls-panel:not(.bare)'], ['panel', '#app .panel'], ['panel', '#app .ui-panel'], ['sheet', '.ui-sheet'], ['dialog', '.modal']]) {
      const e = first(sel);
      if (!e) continue;
      const r = e.getBoundingClientRect();
      add(`${tag}-tr`, r.right - 56, r.top - 6, 62, 62);
      add(`${tag}-bl`, r.left - 6, r.bottom - 56, 62, 62);
    }
    for (const [tag, sel, pad] of [['rail-on', '#app .ui-stab.on', 8], ['plate-head', '#app .ui-plate-head', 6], ['wallets', '#app .topbar .cur-pills:not([hidden])', 8], ['back', '#app .topbar-back', 8], ['countdown', '#app .ui-cd', 6]]) {
      const e = first(sel);
      if (!e) continue;
      const r = e.getBoundingClientRect();
      add(tag, r.left - pad, r.top - pad, r.width + pad * 2, r.height + pad * 2);
    }
    // medium 3: the selected tile and the Mythic one nearest to it, together
    const gear = window.__sakura?.store?.profile?.gear || {};
    const sel = first('[data-testid="pick-worn"], .mb-gear.selected, .ui-gtile.selected, .item-tile.sel');
    if (sel) {
      const pool = [...document.querySelectorAll('.ui-gtile, .mb-gear')].filter((e) => e !== sel && shown(e)
        && ((e.dataset.gear && gear[e.dataset.gear]?.rarity === 'mythic') || e.classList.contains('mythic')));
      const a = sel.getBoundingClientRect();
      const near = pool.sort((p, q) => Math.hypot(p.getBoundingClientRect().left - a.left, p.getBoundingClientRect().top - a.top) - Math.hypot(q.getBoundingClientRect().left - a.left, q.getBoundingClientRect().top - a.top))[0];
      const b = near ? near.getBoundingClientRect() : a;
      const x = Math.min(a.left, b.left) - 12;
      const y = Math.min(a.top, b.top) - 12;
      add('medium3', x, y, Math.max(a.right, b.right) + 12 - x, Math.max(a.bottom, b.bottom) + 12 - y);
    }
    return out;
  });
  let i = 0;
  for (const b of boxes) {
    const file = join(out, 'crops', `${name}-${vp}-${String(++i).padStart(2, '0')}-${b.tag}.png`);
    await page.screenshot({ path: file, clip: b.clip });
  }
  if (boxes.length) console.log(`    crops: ${boxes.map((b) => b.tag).join(', ')}`);
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
  const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce', deviceScaleFactor: DSF, timezoneId: 'America/Chicago' });
  const page = await context.newPage();
  if (NOW !== 'live' && page.clock?.setFixedTime) await page.clock.setFixedTime(new Date(NOW));
  // toasts come and go on their own timers (a lesson, an achievement): never in a before/after pair
  await page.addInitScript(() => {
    const css = '.toast-host, .jn-toast { display: none !important; }';
    document.addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: css })));
  });
  // [ui-ink] portrait phones: the rotate prompt dismissed through its own session key (src/ui/orientation.js), as a
  // player who chose "Continue in portrait"
  if (H > W) await page.addInitScript(() => { try { sessionStorage.setItem('sakura-ui-rotate-dismissed', '1'); } catch { /* no storage */ } });
  if (INK) await page.addInitScript(inkRandomInit, INK_RANDOM_SEED);
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
  console.log(`viewport ${vp}`);
  const probes = {};
  const pixelRuns = {};
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
        if (s.battle) {
          await battleDrawer(page);
          if (s.uiOnly) {
            await page.addStyleTag({ content: 'canvas { visibility: hidden !important; } *, *::before, *::after { animation-play-state: paused !important; transition: none !important; caret-color: transparent !important; }' });
            await settle(page, 600);
          }
        }
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
        const r = await probe(page, { kind: s.kind || 'hub', list: s.list || null, apart: s.apart || [], v2: true, dense: s.dense?.join(', ') || null });
        probes[name] = r;
        console.log(`    probe: ${summary(r)}`);
        const fails = judged ? judge(r, { only: judged, v2: true }) : [];
        if (fails.length) {
          failed++;
          console.log(`  FAILED ${name} probe: ${fails.join(' | ')}`);
        }
      }
      if (withCrops && !s.page) await crops(page, name, vp);
      if (withPixels) {
        const px = await (s.pixels || DEFAULT_PIXELS)(page);
        pixelRuns[name] = px;
        const parts = Object.entries(px).map(([k, v]) => `${k} ${v.checks.length - v.fails}/${v.checks.length}`);
        console.log(`    pixels: ${parts.join(' · ')}`);
        // [ui-ink] --judge pixels: a failed pixel check fails the run too (V1 review 2: they were only printed)
        const bad = Object.entries(px).flatMap(([k, v]) => v.checks.filter((c) => !c.ok).map((c) => `${k}: ${c.msg}`));
        if (judged?.includes('pixels') && bad.length) {
          failed++;
          console.log(`  FAILED ${name} pixels: ${bad.slice(0, 4).join(' | ')}`);
        }
      }
      if (s.open || s.legacy) await closeModals(page);
      if (s.after) await s.after(page);
      if (s.devNow) await devClock(page, null);
    } catch (e) {
      failed++;
      console.log(`  FAILED ${name}: ${e.message}`);
    }
  }
  if (withProbe) writeFileSync(join(out, `probe-${vp}.json`), `${JSON.stringify(probes, null, 2)}\n`);
  if (withPixels) writeFileSync(join(out, `pixels-${vp}.json`), `${JSON.stringify(pixelRuns, null, 2)}\n`);
  await context.close();
}

await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
