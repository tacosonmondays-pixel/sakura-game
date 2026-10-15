// Navigation e2e (owner report: after a clan boss fight, "Back to the clan" and then the top-left
// back arrow went back INTO the battle; the same after regular battles). Checks, with the real UI:
//   1. clan boss: Clan → Clan Boss tab → Fight → the battle ends → "Back to the clan" → the back
//      arrow opens the lobby (the clan's parent), never the battle; a second fight → "Back to the
//      clan" → the phone back gesture (page.goBack) never re-enters the battle either
//   2. campaign: Missions → Mission (campaign map) → 1-1 prep → battle → victory → Next Stage →
//      1-2 prep → back arrow → the campaign map → Missions → the lobby
//   3. leaving a battle: Pause → Quit → 1-1 prep (back arrow → the campaign map); a defeat →
//      Map → the campaign map; a defeat → Home → the lobby
//   4. the phone back gesture mid-battle leaves it for 1-1 prep; forward again does not restart it
//   5. inplace: screens that rewrite their URL in place come back as the player left them — the
//      campaign opened on a later chapter, Chapter 1 picked, 1-3 prep → the arrow (and the back
//      gesture) land on Chapter 1; Bounty from the event strip, another arena picked → its prep →
//      the arrow lands on that arena; the Mall from the gems shortcut, another tab → a girl → the
//      arrow lands on that tab
//   6. shortcuts: Commissions / Tasks / Bounty / Total Assault / Co-op opened straight from the
//      lobby arrow back to the lobby (opened from Missions: to Missions)
//   7. difficulty: stage prep keeps the difficulty picked there after Quit, the back gesture
//      mid-battle, and a defeat → Retry → Quit
//   8. endless: an endless run's Map button and the endless prep's arrow both go to Tactical
//      Challenge (Quit keeps the endless prep)
// After each flow the whole history is walked with back / forward (page.goBack / goForward, the
// phone back gesture): no entry is a battle.
//
//   node e2e/nav-back.mjs                                  # 844×390 (landscape phone, touch)
//   node e2e/nav-back.mjs --viewport 1280x720 --shots /tmp/nav
//   node e2e/nav-back.mjs --prod                           # the production build in dist/
//   node e2e/nav-back.mjs --only clan,campaign             # some flows (clan, campaign, leave,
//                                                          #   inplace, shortcuts, difficulty, endless)
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev (or preview) server;
// the game runs with the local online adapter (?online=local). Exit code 1 when a check fails.
import { createServer, preview } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const [W, H] = opt('viewport', '844x390').split('x').map(Number);
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const touch = Math.min(W, H) < 600;
const only = opt('only', 'clan,campaign,leave,inplace,shortcuts,difficulty,endless').split(',');

const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
  /Failed to load resource: net::ERR_(CERT_AUTHORITY_INVALID|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED|CONNECTION_REFUSED)/i,
];

const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

let server;
if (args.includes('--prod')) {
  server = await preview({ root: process.cwd(), preview: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
} else {
  server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
}
const { port } = server.httpServer.address();
const origin = `http://127.0.0.1:${port}/`;
const base = `${origin}?online=local&onboarding=0`;
const { browser, label } = await launchChromium();
log(`browser: ${label} · viewport ${W}x${H}`);
const errors = [];

/** Each flow gets its own browser context (its own save) and page. */
async function openPage(name) {
  // reduced motion: no screen / modal entrance animations, so buttons are stable on the first frame
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!IGNORE.some((re) => re.test(t))) errors.push(`[${name} console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[${name} pageerror] ${e.message}`));
  return page;
}
const shot = async (page, name) => {
  if (!shotsDir) return;
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 200))))).catch(() => {});
  await page.screenshot({ path: `${shotsDir}/${name}-${W}x${H}.png` }).catch((e) => log(`  (screenshot ${name} skipped: ${e.message.split('\n')[0]})`));
};
const go = (page, hash) => page.evaluate((h) => { location.hash = h; }, hash);
const tap = async (page, sel) => {
  const el = page.locator(sel).first();
  const act = (o) => (touch ? el.tap(o) : el.click(o));
  try {
    await act({ timeout: 20000 });
  } catch (e) {
    if (!/Timeout/.test(e.message)) throw e;
    log(`    (no frames for 20 s: tapping ${sel} without the stability wait)`);
    await act({ timeout: 20000, force: true });
  }
};
/** Where the page is: the hash, the screen the router drew, and whether a battle is mounted. */
const where = (page) => page.evaluate(() => ({ hash: location.hash, screen: document.querySelector('#app')?.dataset.screen || null, battle: !!window.__battle })).catch(() => ({ hash: '?', screen: null, battle: false }));
/** Waits until the router has drawn `name` (and its hash starts with `prefix`, default #/name). */
const onScreen = (page, name, prefix = `#/${name}`, timeout = 30000) => page.waitForFunction(([n, p]) => document.querySelector('#app')?.dataset.screen === n && location.hash.startsWith(p) && (n === 'battle' || !window.__battle), [name, prefix], { timeout, polling: 100 }).then(() => true).catch(() => false);
/** The top-left back arrow of the screen's top bar. */
const arrow = (page) => tap(page, '#app .topbar [data-testid="back"]');

async function dismissGift(page) {
  // a fresh account in the beta window gets the gift celebration over the lobby once per session
  if (Date.now() >= Date.UTC(2026, 10, 8, 6)) return;
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 8000 }).catch(() => null);
  if (later) {
    await tap(page, '[data-testid="beta-gift-later"]');
    await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 10000 }).catch(() => null);
  }
}

/**
 * A fresh account on the lobby. `cleared`: { stageId: ['easy', …] } marks stages cleared on those
 * difficulties (a save further along), then reloads so every screen starts from that save.
 */
async function freshLobby(name, { cleared = null } = {}) {
  const page = await openPage(name);
  const lobby = () => page.waitForFunction(() => window.__sakura && document.querySelector('#app')?.dataset.screen === 'lobby', null, { timeout: 45000 });
  await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await lobby();
  await page.evaluate((cleared) => {
    // software WebGL: low quality keeps the battle responsive
    const { store } = window.__sakura;
    Object.assign(store.profile.settings, { quality: 'low', shadows: false, bloom: false });
    for (const [id, diffs] of Object.entries(cleared || {})) {
      const e = (store.profile.progress.stages[id] ||= { clears: 0 });
      e.clears = Math.max(1, e.clears || 0);
      for (const d of diffs) e[d] = true;
    }
    store.commit(cleared ? 'progress' : 'settings');
    store.saveNow();
  }, cleared);
  if (cleared) {
    await page.reload({ waitUntil: 'load' });
    await lobby();
  }
  await dismissGift(page);
  return page;
}

/** { '1-1': diffs, …, 'N-5': diffs }: campaign chapters `from`..`to` cleared on `diffs`. */
function chapters(from, to, diffs = ['easy']) {
  const out = {};
  for (let c = from; c <= to; c++) for (let s = 1; s <= 5; s++) out[`${c}-${s}`] = diffs;
  return out;
}
const checked = (page, testid) => page.locator(`#app [data-testid="${testid}"][aria-checked="true"]`).count().then((n) => n > 0).catch(() => false);

/** Waits for the battle to be playable. */
const battleReady = (page) => page.waitForFunction(() => window.__battle?.ui?.placement && document.querySelector('#app')?.dataset.screen === 'battle', null, { timeout: 90000, polling: 200 }).then(() => true).catch(() => false);

/** Ends the running battle as a defeat: one life left, then fast-forward the Sim until a leak. */
async function loseBattle(page) {
  await page.evaluate(() => {
    const { sim } = window.__battle;
    sim.lives = 1;
    for (let k = 0; k < 4000 && sim.state !== 'won' && sim.state !== 'lost'; k++) {
      if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
      sim.update(0.25);
    }
  });
}

/** Wins the running battle: every girl on her best spot, upgrades as coins allow, fast-forward. */
async function winBattle(page) {
  let state = 'wave';
  for (let i = 0; i < 400 && state !== 'won' && state !== 'lost'; i++) {
    state = await page.evaluate(() => {
      const { sim, ui } = window.__battle;
      const ids = [...sim.loadout.keys(), ...(sim.heroConfig ? [sim.heroConfig.unitId] : [])];
      const placedIds = new Set(sim.towers.map((t) => t.unitId));
      const score = (x, y) => {
        let n = 0;
        for (const k of sim.pathTiles) {
          const [px, py] = k.split(',').map(Number);
          if (Math.hypot(px + 0.5 - x, py + 0.5 - y) <= 3.2) n++;
        }
        return n;
      };
      for (const unitId of ids) {
        if (placedIds.has(unitId)) continue;
        let best = null;
        for (let y = 0.25; y < sim.map.height; y += 0.5) {
          for (let x = 0.25; x < sim.map.width; x += 0.5) {
            if (!sim.canPlace(unitId, x, y).ok) continue;
            const s = score(x, y);
            if (!best || s > best.s) best = { x, y, s };
          }
        }
        if (!best) continue;
        ui.placement.start(unitId);
        if (!ui.placement.tryPlace(best.x, best.y)) ui.placement.cancel();
      }
      for (const t of sim.towers) {
        for (const p of [0, 2, 1]) {
          const st = sim.upgradeStatus(t.uid, p);
          if (!st.locked && st.next && sim.cash >= st.cost) sim.upgradeTower(t.uid, p);
        }
      }
      if (sim.state !== 'wave' && sim.state !== 'won' && sim.state !== 'lost') sim.startNextWave();
      for (let k = 0; k < 20 && sim.state !== 'won' && sim.state !== 'lost'; k++) sim.update(0.25);
      return sim.state;
    });
    await page.waitForTimeout(30);
  }
  return state;
}

/** Waits for the router to draw a screen after a history step (a battle would mount by then). */
async function settled(page) {
  await page.waitForFunction(() => document.querySelector('#app')?.dataset.screen, null, { timeout: 30000 }).catch(() => null);
  await page.waitForTimeout(900);
  return where(page);
}
const inBattle = (w) => w.screen === 'battle' || w.battle || w.hash.startsWith('#/battle');

/**
 * The phone back gesture again and again until it leaves the game, then forward through every
 * entry to the end: no step may land in a battle. (`page` ends on the last entry.)
 */
async function walkHistory(page, flow, max = 16) {
  const trail = [];
  const fail = async (dir) => {
    check(false, `${flow}: the ${dir} gesture entered a battle (${trail.join(' → ')})`);
    await shot(page, `${flow.replace(/\W+/g, '-')}-${dir}-into-battle`);
  };
  for (let i = 0; i < max; i++) {
    await page.goBack({ waitUntil: 'commit', timeout: 15000 }).catch(() => null);
    if (!page.url().startsWith(origin)) {
      trail.push('(left the game)');
      break;
    }
    const w = await settled(page);
    trail.push(`←${w.hash}`);
    if (inBattle(w)) return fail('back');
  }
  for (let i = 0; i < max; i++) {
    const before = page.url();
    await page.goForward({ waitUntil: 'commit', timeout: 15000 }).catch(() => null);
    if (page.url() === before) break; // the end of the history
    const w = await settled(page);
    trail.push(`→${w.hash}`);
    if (inBattle(w)) return fail('forward');
  }
  check(true, `${flow}: back and forward through the whole history never enter a battle (${trail.join(' ')})`);
}

async function setName(page, name) {
  await page.waitForSelector('[data-testid="name-input"]', { timeout: 20000 });
  await page.fill('[data-testid="name-input"]', name);
  await tap(page, '[data-testid="name-save"]');
  await page.waitForSelector('[data-testid="name-input"]', { state: 'detached', timeout: 10000 });
}

/** Clan Boss tab → Fight → battle → defeat → "Back to the clan". */
async function bossFightAndBack(page, n) {
  await page.waitForSelector('[data-testid="boss-fight"]:not([disabled])', { timeout: 20000 });
  await tap(page, '[data-testid="boss-fight"]');
  const inBattle = await battleReady(page);
  check(inBattle && /clanBoss=/.test((await where(page)).hash), `clan boss ${n}: Fight opens the boss battle`);
  if (!inBattle) return false;
  await loseBattle(page);
  const backBtn = await page.waitForSelector('[data-testid="clan-back"]', { timeout: 30000 }).catch(() => null);
  if (!check(!!backBtn, `clan boss ${n}: the result sheet offers "Back to the clan"`)) return false;
  await shot(page, `clan-boss-${n}-result`);
  await tap(page, '[data-testid="clan-back"]');
  const inClan = await onScreen(page, 'clan');
  const w = await where(page);
  check(inClan && w.hash.includes('tab=boss'), `clan boss ${n}: "Back to the clan" opens the clan on the boss tab (${w.hash})`);
  await page.waitForSelector('[data-testid="boss-panel"]', { timeout: 20000 }).catch(() => null);
  return inClan;
}

/** 1. clan boss: "Back to the clan" → the back arrow → the lobby; the back gesture never re-enters. */
async function clanFlow() {
  log('\n--- clan boss ---');
  const A = await freshLobby('A');
  await go(A, '#/clan');
  await setName(A, 'Aiko');
  await A.waitForSelector('[data-testid="clan-create-panel"]', { timeout: 15000 });
  await A.fill('[data-testid="clan-name"]', 'Petal Squad');
  await A.fill('[data-testid="clan-tag"]', 'ps');
  await tap(A, '[data-testid="clan-create"]');
  await A.waitForSelector('[data-testid="clan-home"]', { timeout: 15000 });
  await tap(A, '[data-testid="tab-boss"]');
  await A.waitForSelector('[data-testid="boss-panel"]', { timeout: 15000 });
  if (await bossFightAndBack(A, 1)) {
    await shot(A, 'clan-after-fight');
    await arrow(A);
    const home = await onScreen(A, 'lobby', '#/lobby', 20000);
    const w = await where(A);
    check(home, `clan boss: the back arrow on the clan goes to the lobby, not the battle (now ${w.hash}, screen ${w.screen}${w.battle ? ', battle mounted' : ''})`);
    await shot(A, 'clan-arrow');
    // second attempt from the lobby: Clan → boss tab → Fight → back to the clan → phone back
    await go(A, '#/clan?tab=boss');
    await A.waitForSelector('[data-testid="boss-panel"]', { timeout: 15000 }).catch(() => null);
    if (await bossFightAndBack(A, 2)) {
      // the phone back gesture on the clan: the screen below it (the lobby), not the battle
      await A.goBack({ waitUntil: 'commit', timeout: 15000 }).catch(() => null);
      const w2 = await settled(A);
      check(!inBattle(w2) && w2.hash === '#/lobby', `clan boss: the back gesture on the clan goes to the lobby, not the battle (now ${w2.hash}${w2.battle ? ', battle mounted' : ''})`);
      await walkHistory(A, 'clan boss');
    }
  }
  await A.context().close();
}

/** 2. campaign: victory → Next Stage → back arrows climb map → Missions → lobby. */
async function campaignFlow() {
  log('\n--- campaign ---');
  const B = await freshLobby('B');
  await tap(B, '[data-testid="tile-mission"]');
  check(await onScreen(B, 'missions'), 'campaign: the lobby\'s Campaign tile opens Missions');
  await tap(B, '[data-testid="hub-mission"]');
  check(await onScreen(B, 'campaign'), 'campaign: Missions → Mission opens the campaign map');
  await tap(B, '[data-testid="stage-1-1"]');
  check(await onScreen(B, 'stage', '#/stage/1-1'), 'campaign: the map opens 1-1 prep');
  await tap(B, '[data-testid="diff-easy"]');
  await tap(B, '[data-testid="stage-start"]');
  if (check(await battleReady(B), 'campaign: Start opens the battle')) {
    const state = await winBattle(B);
    check(state === 'won', `campaign: 1-1 won (state ${state})`);
    await B.waitForSelector('[data-testid="view-rewards"]', { timeout: 30000 }).catch(() => null);
    await tap(B, '[data-testid="view-rewards"]');
    await B.waitForSelector('[data-testid="next-stage"]', { timeout: 15000 }).catch(() => null);
    await tap(B, '[data-testid="next-stage"]');
    check(await onScreen(B, 'stage', '#/stage/1-2'), 'campaign: Next Stage opens 1-2 prep');
    await shot(B, 'stage-1-2');
    await arrow(B);
    check(await onScreen(B, 'campaign'), `campaign: the back arrow on 1-2 prep goes to the campaign map (now ${(await where(B)).hash})`);
    await shot(B, 'campaign-arrow');
    await arrow(B);
    check(await onScreen(B, 'missions'), `campaign: the back arrow on the map goes to Missions (now ${(await where(B)).hash})`);
    await arrow(B);
    check(await onScreen(B, 'lobby'), `campaign: the back arrow on Missions goes to the lobby (now ${(await where(B)).hash})`);
    await walkHistory(B, 'campaign');
  }
  await B.context().close();
}

/** 3./4. leaving a battle: the back gesture mid-battle, Quit, Map, Home. */
async function leaveFlow() {
  log('\n--- leaving a battle ---');
  const C = await freshLobby('C');
  await tap(C, '[data-testid="tile-mission"]');
  await onScreen(C, 'missions');
  await tap(C, '[data-testid="hub-mission"]');
  await onScreen(C, 'campaign');
  await tap(C, '[data-testid="stage-1-1"]');
  await onScreen(C, 'stage', '#/stage/1-1');
  await tap(C, '[data-testid="stage-start"]');
  if (check(await battleReady(C), 'gesture: Start opens the battle')) {
    // the phone back gesture mid-fight leaves it (no confirm today) …
    await C.goBack({ waitUntil: 'commit', timeout: 15000 }).catch(() => null);
    check(await onScreen(C, 'stage', '#/stage/1-1'), `gesture: back mid-battle returns to 1-1 prep (now ${(await where(C)).hash})`);
    // … and forward again does not start that battle again
    await C.goForward({ waitUntil: 'commit', timeout: 15000 }).catch(() => null);
    const w = await settled(C);
    check(!inBattle(w) && w.hash.startsWith('#/stage/1-1'), `gesture: forward onto the left battle stays on 1-1 prep (now ${w.hash}${w.battle ? ', battle mounted' : ''})`);
  }
  await onScreen(C, 'stage', '#/stage/1-1');
  await tap(C, '[data-testid="stage-start"]');
  if (check(await battleReady(C), 'quit: Start opens the battle')) {
    await tap(C, '[data-testid="pause"]');
    await tap(C, '[data-testid="quit"]');
    await tap(C, '[data-testid="confirm-ok"]');
    check(await onScreen(C, 'stage', '#/stage/1-1'), `quit: Pause → Quit returns to 1-1 prep (now ${(await where(C)).hash})`);
    await arrow(C);
    check(await onScreen(C, 'campaign'), `quit: then the back arrow goes to the campaign map (now ${(await where(C)).hash})`);
  }
  await tap(C, '[data-testid="stage-1-1"]');
  await onScreen(C, 'stage', '#/stage/1-1');
  await tap(C, '[data-testid="stage-start"]');
  if (check(await battleReady(C), 'map: Start opens the battle')) {
    await loseBattle(C);
    await C.waitForSelector('[data-testid="back-map"]', { timeout: 60000 }).catch(() => null);
    await tap(C, '[data-testid="back-map"]');
    check(await onScreen(C, 'campaign'), `map: a defeat → Map opens the campaign map (now ${(await where(C)).hash})`);
  }
  await tap(C, '[data-testid="stage-1-1"]');
  await onScreen(C, 'stage', '#/stage/1-1');
  await tap(C, '[data-testid="stage-start"]');
  if (check(await battleReady(C), 'home: Start opens the battle')) {
    await loseBattle(C);
    await C.waitForSelector('[data-testid="result"] [data-testid="home"]', { timeout: 30000 }).catch(() => null);
    await tap(C, '[data-testid="result"] [data-testid="home"]');
    check(await onScreen(C, 'lobby'), `home: a defeat → Home opens the lobby (now ${(await where(C)).hash})`);
    await shot(C, 'home-after-defeat');
    await walkHistory(C, 'leaving a battle');
  }
  await C.context().close();
}

/** 5. screens that rewrite their URL in place: the arrow brings them back as they were left. */
async function inPlaceFlow() {
  log('\n--- screens that rewrite their URL in place ---');
  const P = await freshLobby('D', { cleared: chapters(1, 5) });
  // campaign: the Mission tile opens the next chapter (6); pick Chapter 1, open 1-3 prep, arrow
  await tap(P, '[data-testid="tile-mission"]');
  await onScreen(P, 'missions');
  await tap(P, '[data-testid="hub-mission"]');
  check(await onScreen(P, 'campaign', '#/campaign?chapter=6'), `inplace: Missions → Mission opens the next chapter (now ${(await where(P)).hash})`);
  await tap(P, '#app [data-testid="chapter-1"]');
  await P.waitForFunction(() => location.hash === '#/campaign?chapter=1', null, { timeout: 10000 }).catch(() => null);
  await tap(P, '[data-testid="stage-1-3"]');
  check(await onScreen(P, 'stage', '#/stage/1-3'), 'inplace: Chapter 1 → 1-3 opens its prep');
  await arrow(P);
  let w = await settled(P);
  check(w.hash === '#/campaign?chapter=1' && (await P.locator('#app [data-testid="chapter-1"][aria-selected="true"]').count()) > 0,
    `inplace: the arrow on 1-3 prep lands on Chapter 1, the chapter left (now ${w.hash})`);
  await shot(P, 'inplace-campaign');
  await tap(P, '[data-testid="stage-1-3"]');
  await onScreen(P, 'stage', '#/stage/1-3');
  await P.goBack({ waitUntil: 'commit', timeout: 15000 }).catch(() => null);
  w = await settled(P);
  check(w.hash === '#/campaign?chapter=1', `inplace: the back gesture on 1-3 prep agrees (now ${w.hash})`);
  await arrow(P);
  await onScreen(P, 'missions');
  await arrow(P);
  check(await onScreen(P, 'lobby'), `inplace: arrows climb Missions → the lobby (now ${(await where(P)).hash})`);

  // bounty: the event strip opens this week's arena; pick another, Prepare, arrow
  await tap(P, '[data-testid="event-strip"]');
  check(await onScreen(P, 'bounty', '#/bounty?arena='), `inplace: the event strip opens Bounty on this week's arena (now ${(await where(P)).hash})`);
  const eventArena = new URLSearchParams((await where(P)).hash.split('?')[1]).get('arena');
  const other = await P.evaluate((ev) => [...document.querySelectorAll('#app [data-testid^="arena-"]')].map((b) => b.dataset.testid).find((t) => t !== `arena-${ev}`), eventArena);
  if (check(!!other, `inplace: another arena to pick than ${eventArena}`)) {
    await tap(P, `#app [data-testid="${other}"]`);
    const arenaId = other.replace(/^arena-/, '');
    await P.waitForFunction((a) => location.hash.includes(`arena=${a}`), arenaId, { timeout: 10000 }).catch(() => null);
    const picked = (await where(P)).hash;
    await tap(P, '[data-testid="bounty-prepare"]');
    check(await onScreen(P, 'stage', `#/stage/${arenaId}`), `inplace: Prepare opens that arena's prep (now ${(await where(P)).hash})`);
    await arrow(P);
    w = await settled(P);
    check(w.hash === picked && (await P.locator(`#app [data-testid="${other}"][aria-expanded="true"]`).count()) > 0,
      `inplace: the arrow on its prep lands on the arena picked, ${picked} (now ${w.hash})`);
    await shot(P, 'inplace-bounty');
  }
  // … and Bounty, opened from the lobby, arrows back to the lobby
  await arrow(P);
  check(await onScreen(P, 'lobby'), `inplace: the arrow on Bounty (opened from the event strip) goes to the lobby (now ${(await where(P)).hash})`);

  // mall: the gems shortcut opens the Gem Shop; pick the Recruit Exchange, open a girl, arrow
  await tap(P, '[data-testid="shortcut-gems"]');
  check(await onScreen(P, 'mall', '#/mall?tab=gems'), `inplace: the gems shortcut opens the Gem Shop (now ${(await where(P)).hash})`);
  await tap(P, '#app [data-testid="tab-recruit"]');
  await P.waitForFunction(() => location.hash === '#/mall?tab=recruit', null, { timeout: 10000 }).catch(() => null);
  await tap(P, '#app .ma-offer-portrait');
  check(await onScreen(P, 'student', '#/student/'), `inplace: a girl in the Recruit Exchange opens her page (now ${(await where(P)).hash})`);
  await arrow(P);
  w = await settled(P);
  check(w.hash === '#/mall?tab=recruit', `inplace: the arrow on her page lands on the Mall tab left (now ${w.hash})`);
  await shot(P, 'inplace-mall');
  await arrow(P);
  check(await onScreen(P, 'lobby'), `inplace: then the arrow goes to the lobby (now ${(await where(P)).hash})`);
  await walkHistory(P, 'inplace');
  await P.context().close();
}

/** 6. menu screens opened straight from the lobby: the arrow goes back to the lobby. */
async function shortcutsFlow() {
  log('\n--- lobby shortcuts ---');
  const S = await freshLobby('E', { cleared: chapters(1, 5) }); // Total Assault unlocked
  const fromLobby = async (label, open, name) => {
    await open();
    if (!check(await onScreen(S, name), `shortcuts: ${label} opens ${name} (now ${(await where(S)).hash})`)) return;
    await arrow(S);
    check(await onScreen(S, 'lobby', '#/lobby', 20000), `shortcuts: the arrow on ${name} opened from ${label} goes to the lobby (now ${(await where(S)).hash})`);
    const st = await S.evaluate(() => history.state?.navIdx);
    check(st === 0, `shortcuts: … stepping back onto the lobby entry, like the back gesture (entry ${st})`);
  };
  await fromLobby('the Commissions dock button', () => tap(S, '[data-testid="dock-commissions"]'), 'commissions');
  await fromLobby('the Tasks shortcut', () => tap(S, '[data-testid="shortcut-tasks"]'), 'commissions');
  await fromLobby('the event strip', () => tap(S, '[data-testid="event-strip"]'), 'bounty');
  await fromLobby('the Total Assault shortcut', () => tap(S, '[data-testid="shortcut-assault"]'), 'assault');
  await fromLobby('Menu → Co-op', async () => {
    await tap(S, '[data-testid="top-menu"]');
    await tap(S, '[data-testid="menu-coop"]');
    // online screens ask a fresh account for a name first
    if (await S.waitForSelector('[data-testid="name-input"]', { timeout: 10000 }).catch(() => null)) await setName(S, 'Aiko');
  }, 'coop');
  // opened from Missions: back to Missions
  await tap(S, '[data-testid="tile-mission"]');
  await onScreen(S, 'missions');
  await tap(S, '[data-testid="hub-bounty"]');
  await onScreen(S, 'bounty');
  await arrow(S);
  check(await onScreen(S, 'missions'), `shortcuts: Bounty opened from Missions arrows back to Missions (now ${(await where(S)).hash})`);
  await arrow(S);
  check(await onScreen(S, 'lobby'), `shortcuts: then Missions → the lobby (now ${(await where(S)).hash})`);
  await walkHistory(S, 'shortcuts');
  await S.context().close();
}

/** 7. stage prep keeps the difficulty picked there after a battle. */
async function difficultyFlow() {
  log('\n--- stage prep difficulty ---');
  // 1-2 cleared on Easy and Normal: its prep opens on Hard
  const D = await freshLobby('F', { cleared: { '1-1': ['easy'], '1-2': ['easy', 'normal'] } });
  await tap(D, '[data-testid="tile-mission"]');
  await onScreen(D, 'missions');
  await tap(D, '[data-testid="hub-mission"]');
  await onScreen(D, 'campaign');
  await tap(D, '[data-testid="stage-1-2"]');
  await onScreen(D, 'stage', '#/stage/1-2');
  check(await checked(D, 'diff-hard'), 'difficulty: 1-2 prep opens on Hard (Easy and Normal cleared)');
  await tap(D, '[data-testid="diff-easy"]');
  await D.waitForFunction(() => location.hash.includes('difficulty=easy'), null, { timeout: 10000 }).catch(() => null);
  check((await where(D)).hash.includes('difficulty=easy'), `difficulty: picking Easy keeps it in the URL (now ${(await where(D)).hash})`);
  const prepOnEasy = async (how) => {
    const ok = await onScreen(D, 'stage', '#/stage/1-2');
    check(ok && (await checked(D, 'diff-easy')), `difficulty: ${how} → 1-2 prep still on Easy (now ${(await where(D)).hash})`);
  };
  await tap(D, '[data-testid="stage-start"]');
  if (check(await battleReady(D), 'difficulty: Start opens the battle')) {
    check(/difficulty=easy/.test((await where(D)).hash), 'difficulty: … on Easy');
    await tap(D, '[data-testid="pause"]');
    await tap(D, '[data-testid="quit"]');
    await tap(D, '[data-testid="confirm-ok"]');
    await prepOnEasy('Pause → Quit');
  }
  await tap(D, '[data-testid="stage-start"]');
  if (await battleReady(D)) {
    await D.goBack({ waitUntil: 'commit', timeout: 15000 }).catch(() => null);
    await prepOnEasy('the back gesture mid-battle');
  }
  await tap(D, '[data-testid="stage-start"]');
  if (await battleReady(D)) {
    await loseBattle(D);
    await D.waitForSelector('[data-testid="retry"]', { timeout: 60000 }).catch(() => null);
    await tap(D, '[data-testid="retry"]');
    if (check(await battleReady(D), 'difficulty: a defeat → Retry starts the battle again')) {
      await tap(D, '[data-testid="pause"]');
      await tap(D, '[data-testid="quit"]');
      await tap(D, '[data-testid="confirm-ok"]');
      await prepOnEasy('a defeat → Retry → Quit');
    }
  }
  await shot(D, 'difficulty-prep');
  await walkHistory(D, 'difficulty');
  await D.context().close();
}

/** 8. an endless run belongs to Tactical Challenge: Map, Quit and the prep arrow. */
async function endlessFlow() {
  log('\n--- endless run ---');
  const E = await freshLobby('G', { cleared: chapters(1, 2) }); // Tactical Challenge unlocked
  await tap(E, '[data-testid="tile-mission"]');
  await onScreen(E, 'missions');
  await tap(E, '[data-testid="hub-challenge"]');
  check(await onScreen(E, 'challenge'), 'endless: Missions → Tactical Challenge');
  await tap(E, '[data-testid="endless-1-1"]');
  check(await onScreen(E, 'stage', '#/stage/1-1') && (await where(E)).hash.includes('endless=1'), `endless: the 1-1 card opens the endless prep (now ${(await where(E)).hash})`);
  await tap(E, '[data-testid="stage-start"]');
  if (check(await battleReady(E), 'endless: Start endless opens the run')) {
    await loseBattle(E);
    await E.waitForSelector('[data-testid="back-map"]', { timeout: 60000 }).catch(() => null);
    await tap(E, '[data-testid="back-map"]');
    check(await onScreen(E, 'challenge'), `endless: a lost run → Map opens Tactical Challenge (now ${(await where(E)).hash})`);
  }
  await tap(E, '[data-testid="endless-1-1"]');
  await onScreen(E, 'stage', '#/stage/1-1');
  await tap(E, '[data-testid="stage-start"]');
  if (await battleReady(E)) {
    await tap(E, '[data-testid="pause"]');
    await tap(E, '[data-testid="quit"]');
    await tap(E, '[data-testid="confirm-ok"]');
    const ok = await onScreen(E, 'stage', '#/stage/1-1');
    check(ok && (await where(E)).hash.includes('endless=1'), `endless: Pause → Quit returns to the endless prep (now ${(await where(E)).hash})`);
  }
  await arrow(E);
  check(await onScreen(E, 'challenge'), `endless: the arrow on the endless prep goes to Tactical Challenge (now ${(await where(E)).hash})`);
  await walkHistory(E, 'endless');
  await E.context().close();
}

const FLOWS = { clan: clanFlow, campaign: campaignFlow, leave: leaveFlow, inplace: inPlaceFlow, shortcuts: shortcutsFlow, difficulty: difficultyFlow, endless: endlessFlow };
try {
  for (const [name, flow] of Object.entries(FLOWS)) {
    if (!only.includes(name)) continue;
    try {
      await flow();
    } catch (e) {
      // one flow stuck (a check above says where) does not skip the others
      check(false, `${name}: unexpected error: ${e.stack || e.message}`);
    }
  }
} finally {
  const errs = errors.splice(0);
  check(!errs.length, `no page/console errors${errs.length ? `\n       ${errs.slice(0, 8).join('\n       ')}` : ''}`);
  await browser.close();
  await (server.close ? server.close() : new Promise((r) => server.httpServer.close(r)));
}

log(failures.length ? `\n${failures.length} check(s) FAILED` : '\nall navigation checks passed');
process.exit(failures.length ? 1 : 0);
