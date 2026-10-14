// End-to-end test of co-op FREEPLAY with the LOCAL adapter (one browser, two pages = two players,
// BroadcastChannel; nothing touches Supabase). The owner's request: "once you get past what you
// need like 15/15 … itll have a cool text effect going past like 16/15".
//   1. The host picks stage 1-1 (goal 12), Easy, Freeplay Blossom in the room's picker; the guest
//      sees the FREEPLAY · BLOSSOM chip. Ready is consent: the host switching the tier takes the
//      guest's Ready back (Start locks), switching back + Ready again unlocks it.
//   2. The battle: each player's girls are placed and upgraded through the battle's own command
//      path (window.__battle.ui.act → lockstep commands, exactly what the tower bar sends), Auto
//      and 3× through lockstep commands. The game clock is pumped faster on BOTH pages
//      (Lockstep.advance — the same call the frame loop makes; the lockstep still runs a tick only
//      when both clients promised it), so the goal is reached in minutes. Nothing writes to a
//      client's Sim.
//   3. 12/12 cleared: the clear card (STAGE CLEAR ✓ / GO BEYOND ▶ Wave 13/12 / Finish here) on BOTH
//      screens, the clear banked once on each (the payout ledger) and saved.
//   4. The guest taps GO BEYOND: both HUDs read 13/12 in the overflow pill (tier colours), the
//      16/15-style glitch banner shows, the state hashes of both clients match.
//   5. Wave 20: the first freeplay boss wave (a miniboss on Blossom) → the boss ribbon on both.
//   6. Both vote Finish (host from the menu, guest from the ally's prompt) → FREEPLAY COMPLETE
//      "20/12" on both, same final hash; the freeplay bonus (8 waves × 40 coins) and the best wave
//      (Blossom 20) are saved; Back to the room shows the last run and the best.
// Screenshots of every state at 1280×720, 844×390 and 390×844 (and the pill with reduced motion)
// go to --shots <dir>.
//
//   node e2e/coop-freeplay.mjs --shots /tmp/shots
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1
// when a check fails.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const SIZES = [[1280, 720], [844, 390], [390, 844]];
const STAGE = '1-1';
const GOAL = 12;
const BOSS_WAVE = 20; // first freeplay boss wave on 1-1: ceil((12 + 8) / 10) × 10
const TIER = 'blossom';

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

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/?online=local`;
const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const errors = [];
async function openPage(name, size) {
  const page = await context.newPage();
  if (size) await page.setViewportSize({ width: size[0], height: size[1] });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!IGNORE.some((re) => re.test(t))) errors.push(`[${name} console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[${name} pageerror] ${e.message}`));
  return page;
}
const settle = (page, ms = 250) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);
async function snap(page, name, size) {
  const leaked = await page.evaluate(() => (document.body.innerText.match(/\b(null|undefined|NaN)\b/g) || []).join(', ')).catch(() => '');
  check(!leaked, `${name}: no "null" / "undefined" / "NaN" on screen${leaked ? ` (${leaked})` : ''}`);
  if (!shotsDir) return;
  const vp = page.viewportSize();
  const tag = size ? `${size[0]}x${size[1]}` : `${vp.width}x${vp.height}`;
  for (let i = 0; i < 2; i++) {
    try {
      await page.screenshot({ path: `${shotsDir}/${name}-${tag}.png`, timeout: 90000 });
      return;
    } catch (e) {
      log(`    (screenshot ${name}: ${String(e.message).split('\n')[0]}${i ? '' : ' — trying again'})`);
    }
  }
}
/** The same view at every size (the page is resized, then put back). `again` re-shows a transient UI piece. */
async function snapAll(page, name, again = null) {
  if (!shotsDir) return snap(page, name);
  const vp = page.viewportSize();
  for (const size of SIZES) {
    await page.setViewportSize({ width: size[0], height: size[1] });
    await settle(page, 450);
    if (again) await again(page);
    await settle(page, 350);
    await snap(page, name, size);
  }
  await page.setViewportSize(vp);
  await settle(page, 300);
}
const go = (page, hash) => page.evaluate((h) => { location.hash = h; }, hash);
const tap = async (page, sel) => {
  const el = page.locator(sel).first();
  try {
    await el.click({ timeout: 20000 });
  } catch (e) {
    if (!/Timeout/.test(e.message)) throw e;
    log(`    (no frames for 20 s: clicking ${sel} without the stability wait)`);
    await el.click({ timeout: 20000, force: true });
  }
};
async function setName(page, name) {
  await page.waitForSelector('[data-testid="name-input"]', { timeout: 30000 });
  await page.fill('[data-testid="name-input"]', name);
  await tap(page, '[data-testid="name-save"]');
  await page.waitForSelector('[data-testid="name-input"]', { state: 'detached', timeout: 15000 });
}

// ---- in-page helpers (battle) ---------------------------------------------------------------
/** Pump the lockstep clock faster on this page (the frame loop's own call, more often). */
const pump = (page, on) => page.evaluate((run) => {
  clearInterval(window.__fpPump);
  window.__fpPump = 0;
  if (!run) return;
  window.__fpPump = setInterval(() => {
    const ls = window.__battle?.coop?.lockstep;
    if (!ls || ls.finished) return;
    for (let i = 0; i < 3; i++) ls.advance(0.05);
  }, 4);
}, on);

/**
 * A player on this page: places her own girls on spots near the road as her own coins allow, then
 * upgrades them — through ui.act, the commands the tower bar sends. Spots come from a separate
 * planning copy of the battle (same start message), split host / guest so they never collide.
 */
const startBot = (page) => page.evaluate(async () => {
  const { createCoopSim } = await import('/src/online/coop/commands.js');
  const b = window.__battle;
  const ls = b.coop.lockstep;
  const me = ls.start.players.find((p) => p.slot === ls.mySlot);
  const units = [...(me.hero ? [me.hero.unitId] : []), ...me.loadout.map((e) => e.unitId)];
  const plan = createCoopSim(ls.start).sim;
  const cands = [];
  for (let y = 0.55; y < plan.map.height; y += 0.35) {
    for (let x = 0.55; x < plan.map.width; x += 0.35) {
      if (!plan.placementReason('kage', x, y)) cands.push([x, y, plan.placement.pathDistance(x, y)]);
    }
  }
  cands.sort((p, q) => p[2] - q[2] || p[1] - q[1] || p[0] - q[0]);
  const spots = [];
  for (const [x, y] of cands) {
    if (spots.length >= 40) break;
    if (spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 1.4)) continue;
    spots.push([x, y]);
  }
  const mine = spots.filter((_, i) => i % 2 === ls.mySlot);
  let next = 0;
  let u = 0;
  clearInterval(window.__fpBot);
  window.__fpBot = setInterval(() => {
    const { sim, ui } = window.__battle || {};
    if (!sim || !ui?.act || sim.state === 'won' || sim.state === 'lost') return;
    // a new girl when my coins allow, else an upgrade
    if (next < mine.length && sim.towers.filter((t) => ls.coop.ownerOf(t.uid) === ls.mySlot).length < 14) {
      const id = units[u % units.length];
      const [x, y] = mine[next];
      if (sim.data.unit(id)?.kind === 'hero' && sim.towers.some((t) => t.isHero)) {
        u++;
      } else if (sim.canPlace(id, x, y).ok) {
        ui.act.place(id, x, y);
        next++;
        u++;
        return;
      } else if (sim.placementReason(id, x, y)) {
        next++; // taken or blocked: the next spot
        return;
      }
    }
    for (const t of sim.towers) {
      if (ls.coop.ownerOf(t.uid) !== ls.mySlot) continue;
      for (const [path, upto] of [[0, 4], [1, 2]]) {
        if (t.tiers[path] >= upto) continue;
        if (!sim.upgradeStatus(t.uid, path).locked) {
          ui.act.upgrade(t.uid, path);
          return;
        }
      }
    }
  }, 250);
});
const stopBot = (page) => page.evaluate(() => clearInterval(window.__fpBot)).catch(() => null);
const state = (page) => page.evaluate(() => {
  const b = window.__battle;
  if (!b?.sim) return null;
  const ls = b.coop?.lockstep;
  return {
    wave: b.sim.wave, cleared: b.sim.wavesCleared, state: b.sim.state, lives: b.sim.lives, towers: b.sim.towers.length, tick: ls?.tick,
    auto: !!b.sim.options.autoStart, speed: ls?.coop.speed, finished: !!b.sim.finished, desynced: !!ls?.desynced,
  };
}).catch(() => null);
const hashes = (page) => page.evaluate(() => window.__battle?.coop?.hashes || []).catch(() => []);
/** Both pages' last common checkpoints agree. */
async function hashesAgree(A, B, label) {
  const [ha, hb] = await Promise.all([hashes(A), hashes(B)]);
  const all = [...ha, ...hb];
  const bad = all.filter((p) => p.mine !== p.theirs);
  return check(all.length > 0 && !bad.length, `${label}: the lockstep state hashes of both clients match (${all.length} checkpoints compared${bad.length ? `, ${bad.length} differ` : ''})`);
}
const waitFor = (page, fn, arg, ms = 600000, polling = 250) => page.waitForFunction(fn, arg, { timeout: ms, polling }).then(() => true).catch(() => false);
/**
 * Plays on (clock pumped) until wave `target` has started, Auto switched off two waves before so
 * the run stops after it: the host starts each remaining wave like a player taps NEXT WAVE.
 */
async function driveTo(A, B, target, ms = 1200000) {
  const until = Date.now() + ms;
  await Promise.all([pump(A, true), pump(B, true)]);
  let autoOff = false;
  for (;;) {
    const s = await state(A);
    if (!s || s.state === 'lost' || s.state === 'won' || Date.now() > until) return s;
    if (!autoOff && s.wave >= target - 2) {
      autoOff = true;
      await A.evaluate(() => window.__battle.ui.setAutoStart(false));
    }
    if (s.wave >= target && s.state === 'wave') return s;
    if (autoOff && (s.state === 'between' || s.state === 'prep') && s.wave < target) await A.evaluate(() => window.__battle.ui.startWave());
    await A.waitForTimeout(150);
  }
}
/** Pumps until both clients cleared wave `n` (or lost). */
async function clearOf(A, B, n, ms = 900000) {
  await Promise.all([pump(A, true), pump(B, true)]);
  const ok = await Promise.all([A, B].map((p) => waitFor(p, (w) => {
    const s = window.__battle?.sim;
    return !!s && ((s.wavesCleared >= w && s.state === 'between') || s.state === 'lost');
  }, n, ms)));
  await Promise.all([pump(A, false), pump(B, false)]);
  return ok.every(Boolean);
}

let A;
let B;
const t0 = Date.now();
try {
  // ---- a fresh shared save with strong girls (both "tabs" share it), two names ---------------
  A = await openPage('A', [1280, 720]);
  await A.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await A.evaluate(() => localStorage.clear());
  await A.goto(`${base}#/chat`, { waitUntil: 'load' });
  await A.waitForFunction(() => !!window.__sakura?.store?.profile, null, { timeout: 60000 });
  await A.evaluate(() => {
    const { store } = window.__sakura;
    const p = store.profile;
    const team = ['kage', 'shiro', 'akane', 'aoi', 'yuki', 'rei'];
    for (const id of ['hikari', ...team]) {
      p.units[id] = { ...(p.units[id] || {}), level: 60, exp: 0, breakthrough: 5, awaken: 5, gear: p.units[id]?.gear || { charm: null, ribbon: null, shoes: null }, obtainedAt: Date.now(), favorite: false };
    }
    p.formation = { hero: 'hikari', towers: team };
    Object.assign(p.settings, { quality: 'low', shadows: false, bloom: false, autoStart: false });
    store.commit('settings');
    store.saveNow?.();
  });
  await setName(A, 'Aiko');
  B = await openPage('B', [844, 390]);
  await B.goto(`${base}#/chat`, { waitUntil: 'load' });
  await setName(B, 'Bea');

  // ---- 1. the room: Freeplay Blossom, Ready as consent ----------------------------------------
  await go(A, '#/coop');
  await A.waitForSelector('[data-testid="coop-change-stage"]', { timeout: 30000 });
  await tap(A, '[data-testid="coop-change-stage"]');
  await A.waitForSelector('.ol-pick', { timeout: 15000 });
  await tap(A, `.ol-pick [data-stage="${STAGE}"]`);
  await tap(A, '.ol-pick .ol-seg-btn:text-is("Easy")');
  await tap(A, `[data-testid="coop-freeplay"] [data-tier="${TIER}"]`);
  check(await A.locator(`[data-testid="coop-freeplay"] [data-tier="${TIER}"].on`).count() === 1, 'room: the stage picker has a Freeplay row (Off · Blossom · Tempest · Crimson Moon) and Blossom is picked');
  await snapAll(A, '01-room-picker');
  await tap(A, '[data-testid="coop-stage-ok"]');
  await A.waitForSelector('.ol-pick', { state: 'detached', timeout: 15000 }).catch(() => null);
  check(/Freeplay · Blossom/i.test(await A.locator('.ol-coop-create').innerText().catch(() => '')), 'hub: the Host a room pane shows the Freeplay · Blossom chip');
  await tap(A, '[data-testid="coop-create"]');
  await A.waitForSelector('[data-testid="coop-room-code"]', { timeout: 20000 });
  const code = (await A.locator('[data-testid="coop-room-code"]').innerText()).trim();
  check(await A.evaluate(() => window.__coop?.freeplay) === TIER, `room ${code}: the host's room is a Freeplay Blossom room`);
  await go(B, '#/coop');
  await B.waitForSelector('[data-testid="coop-code"]', { timeout: 30000 });
  await B.fill('[data-testid="coop-code"]', code);
  await tap(B, '[data-testid="coop-join"]');
  const paired = await waitFor(B, () => window.__coop?.paired && window.__coop?.freeplay === 'blossom', null, 60000);
  const chip = await B.locator('[data-testid="coop-freeplay-chip"]').innerText().catch(() => '');
  check(paired && /Freeplay · Blossom/i.test(chip), `room: the guest pairs and sees the chip "${chip}" (not editable: no picker for the guest)`);
  check(await B.locator('[data-testid="coop-room-stage"]').count() === 0, 'room: the guest has no Change button');
  const fieldText = await A.locator('[data-testid="coop-field-freeplay"]').innerText().catch(() => '');
  check(/12 waves, then freeplay \(Blossom\)/.test(fieldText) && /Matriarch at 200/.test(fieldText), `room: the Battlefield panel says what freeplay brings ("${fieldText.split('\n')[0].slice(0, 110)}…")`);
  // Ready is consent: a changed tier takes the guest's Ready back
  await tap(B, '[data-testid="coop-ready"]');
  check(await waitFor(A, () => !document.querySelector('[data-testid="coop-start"]')?.disabled, null, 30000), 'room: Start unlocks when the guest is ready');
  await tap(A, '[data-testid="coop-room-stage"]');
  await A.waitForSelector('.ol-pick', { timeout: 15000 });
  await tap(A, '[data-testid="coop-freeplay"] [data-tier="tempest"]');
  await tap(A, '[data-testid="coop-stage-ok"]');
  const unreadied = await waitFor(B, () => window.__coop?.freeplay === 'tempest' && !window.__coop.me.ready, null, 30000);
  const locked = await waitFor(A, () => document.querySelector('[data-testid="coop-start"]')?.disabled, null, 30000);
  check(unreadied && locked, 'room: the host switches to Tempest → the guest\'s Ready is taken back and Start locks');
  await settle(B, 300);
  await snapAll(B, '02-room-guest-ready-cleared');
  await tap(A, '[data-testid="coop-room-stage"]');
  await A.waitForSelector('.ol-pick', { timeout: 15000 });
  await tap(A, `[data-testid="coop-freeplay"] [data-tier="${TIER}"]`);
  await tap(A, '[data-testid="coop-stage-ok"]');
  await waitFor(B, () => window.__coop?.freeplay === 'blossom', null, 30000);
  await tap(B, '[data-testid="coop-ready"]');
  check(await waitFor(A, () => !document.querySelector('[data-testid="coop-start"]')?.disabled, null, 30000), 'room: back on Blossom, the guest\'s new Ready unlocks Start');
  await snapAll(A, '03-room-host');
  await snapAll(B, '04-room-guest');

  // ---- 2. the battle -------------------------------------------------------------------------
  await tap(A, '[data-testid="coop-start"]');
  const inBattle = (p) => waitFor(p, () => {
    const ls = window.__battle?.coop?.lockstep;
    return !!(ls && window.__battle.ui?.act && ls.running && ls.tick > 0 && ls.livePeers().length === 1);
  }, null, 240000);
  const [inA, inB] = await Promise.all([inBattle(A), inBattle(B)]);
  check(inA && inB, 'battle: the freeplay battle runs on both');
  const fpOn = await Promise.all([A, B].map((p) => p.evaluate(() => ({ fp: window.__battle.sim.freeplay, tier: window.__battle.sim.stage.freeplay?.id, goal: window.__battle.sim.totalWaves }))));
  check(fpOn.every((x) => x.fp && x.tier === TIER && x.goal === GOAL), `battle: both Sims run freeplay Blossom with goal ${GOAL} (${JSON.stringify(fpOn)})`);
  const coins0 = await Promise.all([A, B].map((p) => p.evaluate(() => window.__sakura.store.profile.currencies.coins)));
  await Promise.all([startBot(A), startBot(B)]);
  await A.evaluate(() => {
    const { ui, coop } = window.__battle;
    coop.lockstep.queue('speed', [3]);
    ui.setAutoStart(true);
    ui.startWave();
  });
  // a normal wave, for the "before" look of the pill
  await Promise.all([pump(A, true), pump(B, true)]);
  await waitFor(A, () => window.__battle?.sim?.wave >= 4, null, 600000);
  await Promise.all([pump(A, false), pump(B, false)]);
  await settle(A, 800);
  await snap(A, '05-battle-normal-pill');
  // on to the goal wave with Auto off before it: the clear card then waits for a tap
  await driveTo(A, B, GOAL);
  const reachedGoal = await clearOf(A, B, GOAL);
  const atGoal = await Promise.all([state(A), state(B)]);
  log(`    at the goal: ${JSON.stringify(atGoal)} (${Math.round((Date.now() - t0) / 1000)} s)`);
  check(reachedGoal && atGoal.every((s) => s?.state === 'between' && s.cleared === GOAL), `the goal: both cleared ${GOAL}/${GOAL} and wait between waves`);

  // ---- 3. the clear card + the bank ------------------------------------------------------------
  await settle(A, 900);
  const card = await Promise.all([A, B].map((p) => p.evaluate(() => {
    const head = document.querySelector('[data-testid="clear-card"]');
    const start = document.querySelector('[data-testid="start-wave"]');
    const fin = document.querySelector('[data-testid="finish-here"]');
    return { head: head && !head.hidden ? head.innerText : '', start: start && !start.hidden ? start.innerText : '', beyond: !!start?.classList.contains('bt-beyond'), finish: fin && !fin.hidden ? fin.innerText : '' };
  })));
  check(card.every((c) => /STAGE CLEAR/.test(c.head) && /GO BEYOND/.test(c.start) && /Wave 13\/12/.test(c.start) && c.beyond && /Finish here/.test(c.finish)),
    `clear card on BOTH screens: STAGE CLEAR ✓ / GO BEYOND ▶ Wave 13/12 / Finish here (${JSON.stringify(card.map((c) => c.start.replace(/\s+/g, ' ')))})`);
  const bank = await Promise.all([A, B].map((p) => p.evaluate(() => {
    const s = window.__coop;
    const L = s?.freeplayRuns?.[s.start?.seed];
    const coins = window.__sakura.store.profile.currencies.coins;
    return { banked: !!L?.bank, clear: !!L?.bank?.clear, goal: L?.bank?.banked?.goal, coins, saved: JSON.parse(localStorage.getItem('sakura-sentinels-save-v1') || '{}')?.currencies?.coins };
  })));
  check(bank.every((b, i) => b.banked && b.clear && b.goal === GOAL && b.coins - coins0[i] >= 300 + 40 * GOAL),
    `the clear is banked once on each client at the goal and paid (coins +${bank.map((b, i) => b.coins - coins0[i]).join(' / +')}, ≥ ${300 + 40 * GOAL})`);
  await snapAll(A, '06-clear-card');
  await snap(B, '06-clear-card-guest');

  // ---- 4. GO BEYOND (the guest taps it): 13/12 on both ----------------------------------------
  await tap(B, '[data-testid="start-wave"]');
  const beyond = await Promise.all([A, B].map((p) => waitFor(p, (g) => window.__battle?.sim?.wave === g + 1, GOAL, 120000, 100)));
  const glitch = await Promise.all([A, B].map((p) => waitFor(p, () => !!document.querySelector('.bt-banner-glitch'), null, 20000, 100)));
  await settle(A, 200);
  await snap(A, '07-crossing-banner');
  const pills = await Promise.all([A, B].map((p) => p.evaluate(() => {
    const box = document.querySelector('[data-testid="hud-wave-box"]');
    return { text: document.querySelector('[data-testid="hud-wave"]')?.innerText.replace(/\s+/g, ''), over: !!box?.classList.contains('bt-wave-over'), tier: box?.dataset.tier || null, label: box?.querySelector('.bt-wave-label')?.innerText.trim() };
  })));
  check(beyond.every(Boolean) && pills.every((x) => x.text === `${GOAL + 1}/${GOAL}` && x.over && x.tier === TIER),
    `GO BEYOND: both HUDs read ${GOAL + 1}/${GOAL} in the overflow pill (${JSON.stringify(pills)})`);
  check(glitch.every(Boolean), 'the crossing: the glitch banner shows on both screens');
  await hashesAgree(A, B, 'past the goal');
  // the pill and the crossing banner at every size (the banner shown again, same call), then reduced motion
  await snapAll(A, '08-overflow-pill-banner', (p) => p.evaluate((g) => window.__battle.ui.feed.announce(`${g + 1}/${g}`, 'BEYOND THE LAST WAVE · Blossom', 'free', 30000, { glitch: true }), GOAL));
  await A.evaluate(() => document.documentElement.setAttribute('data-reduce-motion', ''));
  await snapAll(A, '09-overflow-pill-reduced-motion');
  await A.evaluate(() => document.documentElement.removeAttribute('data-reduce-motion'));
  await snap(B, '08-overflow-pill-guest');

  // ---- 5. on to the first freeplay boss wave ---------------------------------------------------
  await A.evaluate(() => window.__battle.ui.setAutoStart(true));
  await Promise.all([pump(A, true), pump(B, true)]);
  await waitFor(A, (w) => window.__battle?.sim?.wave >= w - 4, BOSS_WAVE, 900000);
  // the scout's pressure chip for the coming freeplay wave
  await Promise.all([pump(A, false), pump(B, false)]);
  await settle(A, 600);
  const pressure = await A.locator('[data-testid="scout-pressure"]').innerText().catch(() => '');
  check(/×/.test(pressure), `scout: the pressure chip sums up the next freeplay wave ("${pressure.replace(/\s+/g, ' ')}")`);
  await snapAll(A, '10-scout-pressure-chip');
  await tap(A, '[data-testid="scout"]');
  const popText = await A.locator('[data-testid="scout-pressure-text"]').innerText().catch(() => '');
  check(/Freeplay pressure \(Blossom\)/.test(popText) && /Resolve/.test(popText), `scout: tapping it explains the pressure ("${popText.slice(0, 90)}…")`);
  await snapAll(A, '11-scout-pressure-popover');
  await tap(A, '[data-testid="scout-pop"] .bt-x').catch(() => null);
  // up to the wave before the boss wave (pumped), then the boss wave at the normal 3× pace: a pumped
  // clock outruns a starved page's frames and its event queue trims old events (banners are events)
  await driveTo(A, B, BOSS_WAVE - 1);
  check(await clearOf(A, B, BOSS_WAVE - 1), `wave ${BOSS_WAVE - 1} cleared on both`);
  await A.evaluate(() => window.__battle.ui.startWave());
  const bossBanner = await Promise.all([A, B].map((p) => waitFor(p, () => [...document.querySelectorAll('.bt-banner-boss')].some((b) => /BOSS|MINIBOSS/.test(b.innerText)), null, 240000, 50)));
  const bossText = await A.evaluate(() => document.querySelector('.bt-banner-boss')?.innerText.replace(/\s+/g, ' ') || '');
  check(bossBanner.every(Boolean), `wave ${BOSS_WAVE}: the boss ribbon shows on both screens ("${bossText}")`);
  await settle(A, 200);
  await snap(A, '12-boss-banner');
  await waitFor(A, () => !document.querySelector('[data-testid="boss-bar"]')?.hidden, null, 60000, 100);
  const bossName = await A.evaluate(() => document.querySelector('.bt-boss-name')?.innerText || '');
  await snapAll(A, '13-boss-bar', (p) => p.evaluate((n) => window.__battle.ui.feed.announce('MINIBOSS', n, 'boss', 30000), bossName));
  // the boss wave ends (the girls hold it), the run waits for the vote
  const afterBoss = await clearOf(A, B, BOSS_WAVE);
  const st20 = await Promise.all([state(A), state(B)]);
  log(`    after wave ${BOSS_WAVE}: ${JSON.stringify(st20)} (${Math.round((Date.now() - t0) / 1000)} s)`);
  check(afterBoss && st20.every((s) => s?.cleared === BOSS_WAVE && s.state === 'between'), `wave ${BOSS_WAVE} cleared on both; the run waits`);
  await hashesAgree(A, B, `after wave ${BOSS_WAVE}`);
  await Promise.all([stopBot(A), stopBot(B)]);

  // ---- 6. the Finish vote --------------------------------------------------------------------
  await tap(A, '[data-testid="pause"]');
  await A.waitForSelector('[data-testid="pause-freeplay"]', { timeout: 20000 });
  check(/Finish run/.test(await A.locator('[data-testid="pause-freeplay"]').innerText()), 'menu: after the goal the co-op MENU offers Finish run and Back to the room');
  await snapAll(A, '14-pause-finish');
  await A.evaluate(() => window.__battle.ui.closePause());
  // both connected (a page starved by the screenshots can drop out for a moment and be re-admitted;
  // with the ally gone, the host's vote alone would end the run — correct, but not this check)
  const bothLive = () => Promise.all([A, B].map((p) => waitFor(p, () => {
    const ls = window.__battle?.coop?.lockstep;
    return !!ls && ls.livePeers().length === 1 && !ls.stalled;
  }, null, 240000, 200)));
  check((await bothLive()).every(Boolean), 'both clients connected before the vote');
  await tap(A, '[data-testid="pause"]');
  await A.waitForSelector('[data-testid="pause-finish"]', { timeout: 20000 });
  await tap(A, '[data-testid="pause-finish"]');
  await A.evaluate(() => window.__battle.ui.closePause());
  const prompt = await waitFor(B, () => {
    const el = document.querySelector('[data-testid="finish-prompt"]');
    return !!el && !el.hidden;
  }, null, 60000, 100);
  const promptText = await B.locator('[data-testid="finish-prompt"]').innerText().catch(() => '');
  check(prompt && /Aiko wants to finish here/.test(promptText), `the ally's vote: the guest sees "${promptText.replace(/\s+/g, ' ')}"`);
  const flag = await waitFor(B, () => !document.querySelector('[data-testid="coop-vote-0"]')?.hidden, null, 30000);
  check(flag, 'the co-op HUD shows a flag on the host who voted');
  await snap(B, '15-vote-prompt-guest');
  await snapAll(B, '15-vote-prompt-guest-all', (p) => p.evaluate(() => {
    const el = document.querySelector('[data-testid="finish-prompt"]');
    if (el) el.hidden = false;
  }));
  await tap(B, '[data-testid="finish-agree"]');
  const done = await Promise.all([A, B].map((p) => waitFor(p, () => window.__battle?.sim?.state === 'won' && window.__battle.sim.finished, null, 60000, 100)));
  check(done.every(Boolean), 'both votes: the run ends (won, finished) on both');
  const finals = await Promise.all([A, B].map((p) => p.evaluate(() => ({ tick: window.__coop.lockstep.tick, hash: window.__coop.lockstep.coop.hash() }))));
  check(finals[0].hash === finals[1].hash && finals[0].tick === finals[1].tick, `the Finish lands on the same tick with the same state on both (${JSON.stringify(finals)})`);
  const results = await Promise.all([A, B].map((p) => waitFor(p, () => !!document.querySelector('[data-testid="freeplay-result"]'), null, 60000)));
  const sheet = await Promise.all([A, B].map((p) => p.evaluate(() => ({
    text: document.querySelector('[data-testid="freeplay-result"]')?.innerText || '',
    reached: document.querySelector('[data-testid="freeplay-reached"]')?.innerText.replace(/\s+/g, '') || '',
    best: document.querySelector('[data-testid="freeplay-best"]')?.innerText || '',
  }))));
  check(results.every(Boolean) && sheet.every((s) => /FREEPLAY COMPLETE/.test(s.text) && s.reached === `${BOSS_WAVE}/${GOAL}` && new RegExp(`Reached wave ${BOSS_WAVE} / ${GOAL}`).test(s.text) && /Finished (together )?after wave 20/.test(s.text)),
    `results: FREEPLAY COMPLETE, the big pill "${sheet[0].reached}", "Reached wave ${BOSS_WAVE} / ${GOAL}", "Finished together" on both`);
  check(sheet.every((s) => /New best on 1-1 \(Blossom\)/.test(s.best)), `results: "${sheet[0].best}" on both`);
  check(sheet.every((s) => /Stage clear · saved at 12\/12/.test(s.text) && /Freeplay bonus/.test(s.text) && /8 freeplay waves/.test(s.text)), 'results: the Stage clear (banked) and Freeplay bonus sections');
  // rewards: the freeplay part paid once, the best wave saved
  const paid = await Promise.all([A, B].map((p) => p.evaluate(() => {
    const s = window.__coop;
    const L = s?.freeplayRuns?.[s.start?.seed];
    const prof = window.__sakura.store.profile;
    return { coins: L?.end?.freeplay?.coins, waves: L?.end?.freeplay?.waves, newBest: L?.end?.freeplay?.newBest, best: prof.progress.stages['1-1']?.coopBestWave?.blossom, total: prof.currencies.coins };
  })));
  check(paid.every((x) => x.coins === 40 * (BOSS_WAVE - GOAL) && x.waves === BOSS_WAVE - GOAL && x.best === BOSS_WAVE && x.newBest),
    `rewards: the freeplay bonus ${40 * (BOSS_WAVE - GOAL)} coins for ${BOSS_WAVE - GOAL} waves and the Blossom best ${BOSS_WAVE}/${GOAL} saved on both (${JSON.stringify(paid)})`);
  check(paid.every((x, i) => x.total - coins0[i] >= 300 + 40 * GOAL + 40 * (BOSS_WAVE - GOAL)), `rewards: coins +${paid.map((x, i) => x.total - coins0[i]).join(' / +')} in all (clear + freeplay)`);
  await snapAll(A, '16-results-freeplay-complete');
  await snap(B, '16-results-guest');
  await A.evaluate(() => document.querySelector('[data-testid="freeplay-result"] .bt-result-actions')?.scrollIntoView());
  await snap(A, '17-results-actions');

  // ---- 7. back to the room ---------------------------------------------------------------------
  await tap(A, '[data-testid="coop-back"]');
  await tap(B, '[data-testid="coop-back"]');
  const roomBack = await Promise.all([A, B].map((p) => waitFor(p, () => !!document.querySelector('[data-testid="coop-room"]') && window.__coop?.phase === 'lobby', null, 60000)));
  const lastRun = await A.locator('[data-testid="coop-last-run"]').innerText().catch(() => '');
  const field = await A.locator('[data-testid="coop-field-freeplay"]').innerText().catch(() => '');
  check(roomBack.every(Boolean) && /Last run: 20\/12 · Blossom · finished/.test(lastRun) && /Your best: 20\/12 \(Blossom\)/.test(field),
    `room after the run: "${lastRun}", best on the Battlefield panel; Freeplay Blossom still set (${await A.evaluate(() => window.__coop?.freeplay)})`);
  await A.evaluate(() => document.querySelector('[data-testid="coop-field"]')?.scrollIntoView());
  await snapAll(A, '18-room-after-run');
} catch (e) {
  failures.push(`crashed: ${e.stack || e.message}`);
  log(`  FAIL crashed: ${e.stack || e.message}`);
  for (const [n, p] of [['A', A], ['B', B]]) if (p && shotsDir) await p.screenshot({ path: `${shotsDir}/crash-${n}.png` }).catch(() => null);
}

check(!errors.length, `no page errors${errors.length ? `:\n    ${errors.slice(0, 12).join('\n    ')}` : ''}`);
log(`\n${failures.length ? `${failures.length} check(s) FAILED` : 'all checks ok'} (${Math.round((Date.now() - t0) / 1000)} s)`);
await browser.close().catch(() => null);
await server.close().catch(() => null);
process.exit(failures.length ? 1 : 0);
