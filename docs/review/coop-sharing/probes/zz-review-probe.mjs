// Review r1 two-page probe (not part of the suite): copy into e2e/ and run with node from the repo root.
// End-to-end test of co-op sharing (docs/specs/COOP_SHARING.md) with the LOCAL adapter (one browser, two pages = two
// players, BroadcastChannel; nothing touches Supabase), through the battle screen's own buttons:
//   1. A room on 1-1 Easy; both place girls (the battle's command path) and the first wave runs.
//   2. Coins: the guest opens "Send coins" on the host's chip, picks 25% and sends: the coins leave the guest's wallet
//      and land in the host's on both screens, both feeds say so; the hashes agree.
//   3. A girl: the host opens one of their girls and taps "Lend to Bea" twice: on both screens she is the guest's to
//      command (the guest's drawer: "Lent by Aiko · Give back"; the host's: "Lent to Bea · Take back", disabled during
//      the wave); the guest buys her a tier, from the guest's wallet. Between waves the host takes her back. Hashes agree.
//   4. The host lends her again; the guest leaves the battle: the host's co-op line counts the grace down, nothing
//      moves until it is over, then the guest's girls are the host's (the lent one home, theirs handed
//      over), the guest's coins are the host's, the feed says so, and the host upgrades a handed-over girl.
//   Screenshots (--shots <dir>): JPEG, each ≤ 300 KB: the gift sheet, both drawers with the lend rows, the countdown,
//   the hand-out — at 844x390 and 1280x720.
//
//   node e2e/coop-sharing.mjs [--shots <dir>]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a check fails.
import { createServer } from 'vite';
import { mkdirSync, statSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const STAGE = '1-1';

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
const base = `http://127.0.0.1:${port}/?online=local&onboarding=0`;
const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
const errors = [];
async function openPage(name) {
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!IGNORE.some((re) => re.test(t))) errors.push(`[${name} console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[${name} pageerror] ${e.message}`));
  return page;
}
/** A JPEG screenshot at both sizes, each checked ≤ 300 KB. */
async function shots(page, name) {
  if (!shotsDir) return;
  for (const [w, hgt] of [[844, 390], [1280, 720]]) {
    await page.setViewportSize({ width: w, height: hgt });
    await page.waitForTimeout(500);
    const path = `${shotsDir}/${name}-${w}x${hgt}.jpg`;
    await page.screenshot({ path, type: 'jpeg', quality: 72, timeout: 90000 }).catch((e) => log(`    (screenshot ${name}: ${String(e.message).split('\n')[0]})`));
    try {
      const kb = Math.round(statSync(path).size / 1024);
      check(kb <= 300, `screenshot ${name}-${w}x${hgt}.jpg is ${kb} KB (≤ 300)`);
    } catch { /* not written */ }
  }
  await page.setViewportSize({ width: 844, height: 390 });
}
const go = (page, hash) => page.evaluate((h) => { location.hash = h; }, hash);
const tap = async (page, sel) => {
  const el = page.locator(sel).first();
  try {
    await el.click({ timeout: 20000 });
  } catch (e) {
    if (!/Timeout/.test(e.message)) throw e;
    await el.click({ timeout: 20000, force: true });
  }
};
async function setName(page, name) {
  await page.waitForSelector('[data-testid="name-input"]', { timeout: 30000 });
  await page.fill('[data-testid="name-input"]', name);
  await tap(page, '[data-testid="name-save"]');
  await page.waitForSelector('[data-testid="name-input"]', { state: 'detached', timeout: 15000 });
}
const waitFor = (page, fn, arg, ms = 120000, polling = 100) => page.waitForFunction(fn, arg, { timeout: ms, polling }).then(() => true).catch(() => false);
/** Every hash both pages computed after tick t agrees (and there are some). */
async function agreeAfter(A, B, t, what) {
  const pairs = await Promise.all([A, B].map((p) => p.evaluate((t0) => window.__battle.coop.hashes.filter((q) => q.t > t0), t)));
  const all = pairs.flat();
  const bad = all.filter((q) => q.mine !== q.theirs);
  return check(all.length > 0 && !bad.length, `${what}: the state hashes of both pages agree (${all.length} compared after tick ${t}${bad.length ? `, ${bad.length} differ` : ''})`);
}
const tickOf = (p) => p.evaluate(() => window.__battle.coop.lockstep.tick);
/** Waits until both pages ran past tick t and compared a hash there (hashes every 120 ticks). */
async function settleAndAgree(A, B, what) {
  const t = Math.max(await tickOf(A), await tickOf(B));
  await Promise.all([A, B].map((p) => waitFor(p, (t0) => window.__battle.coop.hashes.some((q) => q.t > t0 + 130), t, 60000)));
  return agreeAfter(A, B, t, what);
}
/** Every feed line a page showed since recordFeed (lines fade: a MutationObserver keeps them). */
const recordFeed = (p) => p.evaluate(() => {
  window.__feedLog = [];
  const feed = document.querySelector('[data-testid="battle-feed"]');
  const keep = () => {
    for (const n of feed.children) if (!window.__feedLog.includes(n.textContent)) window.__feedLog.push(n.textContent);
  };
  new MutationObserver(keep).observe(feed, { childList: true, subtree: true, characterData: true });
  keep();
});
const feedText = (p) => p.evaluate(() => (window.__feedLog || []).join(' | '));
/** Places this page's girls on spots of its own (the battle's command path); the uids placed. */
const placeGirls = (page, units) => page.evaluate(async (want) => {
  const { createCoopSim } = await import('/src/online/coop/commands.js');
  const { sim, ui, coop } = window.__battle;
  const ls = coop.lockstep;
  const plan = createCoopSim(ls.start).sim;
  const cands = [];
  for (let y = 0.55; y < plan.map.height; y += 0.35) {
    for (let x = 0.55; x < plan.map.width; x += 0.35) if (!plan.placementReason('aoi', x, y)) cands.push([x, y, plan.placement.pathDistance(x, y)]);
  }
  cands.sort((p, q) => p[2] - q[2] || p[1] - q[1] || p[0] - q[0]);
  const spots = [];
  for (const [x, y] of cands) {
    if (spots.length >= 24) break;
    if (!spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 1.4)) spots.push([x, y]);
  }
  const mine = spots.filter((_, i) => i % 2 === ls.mySlot);
  let k = 0;
  for (const id of want) {
    while (k < mine.length && !sim.canPlace(id, mine[k][0], mine[k][1]).ok) k++;
    if (k < mine.length) ui.act.place(id, mine[k][0], mine[k][1]);
    k++;
  }
  return true;
}, units);

let A;
let B;
const t0 = Date.now();
try {
  A = await openPage('A');
  await A.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await A.evaluate(() => localStorage.clear());
  await A.goto(`${base}#/chat`, { waitUntil: 'load' });
  await A.waitForFunction(() => !!window.__sakura?.store?.profile, null, { timeout: 60000 });
  await A.evaluate(() => {
    const { store } = window.__sakura;
    const p = store.profile;
    const team = ['aoi', 'rei', 'yuki', 'akane', 'kage'];
    for (const id of ['hikari', ...team]) {
      p.units[id] = { ...(p.units[id] || {}), level: 30, exp: 0, gear: p.units[id]?.gear || { charm: null, ribbon: null, shoes: null }, obtainedAt: Date.now(), favorite: false };
    }
    p.formation = { hero: 'hikari', towers: team };
    Object.assign(p.settings, { quality: 'low', shadows: false, bloom: false, autoStart: false });
    store.commit('settings');
    store.saveNow?.();
  });
  await setName(A, 'Aiko');
  B = await openPage('B');
  await B.goto(`${base}#/chat`, { waitUntil: 'load' });
  await setName(B, 'Bea');

  // ---- 1. the room and the first wave ------------------------------------------------------------------
  await go(A, '#/coop');
  await A.waitForSelector('[data-testid="coop-change-stage"]', { timeout: 30000 });
  await tap(A, '[data-testid="coop-change-stage"]');
  await A.waitForSelector('.ol-pick', { timeout: 15000 });
  await tap(A, `.ol-pick [data-stage="${STAGE}"]`);
  await tap(A, '.ol-pick .ol-seg-btn:text-is("Easy")');
  await tap(A, '[data-testid="coop-stage-ok"]');
  await A.waitForSelector('.ol-pick', { state: 'detached', timeout: 15000 }).catch(() => null);
  await tap(A, '[data-testid="coop-create"]');
  await A.waitForSelector('[data-testid="coop-room-code"]', { timeout: 20000 });
  const code = (await A.locator('[data-testid="coop-room-code"]').innerText()).trim();
  await go(B, '#/coop');
  await B.waitForSelector('[data-testid="coop-code"]', { timeout: 30000 });
  await B.fill('[data-testid="coop-code"]', code);
  await tap(B, '[data-testid="coop-join"]');
  check(await waitFor(B, () => window.__coop?.paired, null, 60000), `room ${code}: the guest joins`);
  await tap(B, '[data-testid="coop-ready"]');
  check(await waitFor(A, () => !document.querySelector('[data-testid="coop-start"]')?.disabled, null, 30000), 'room: Start unlocks');
  await tap(A, '[data-testid="coop-start"]');
  const inBattle = (p) => waitFor(p, () => {
    const ls = window.__battle?.coop?.lockstep;
    return !!(ls && window.__battle.ui?.act && ls.running && ls.tick > 0 && ls.livePeers().length === 1);
  }, null, 240000);
  check((await Promise.all([inBattle(A), inBattle(B)])).every(Boolean), 'battle: it runs on both pages');
  await Promise.all([recordFeed(A), recordFeed(B)]);
  await placeGirls(A, ['aoi']);
  await placeGirls(B, ['yuki']);
  check(await waitFor(A, () => {
    const { sim, coop } = window.__battle;
    const girls = sim.towers.filter((t) => !t.isHero);
    return girls.some((t) => coop.ownerOf(t.uid) === 0) && girls.some((t) => coop.ownerOf(t.uid) === 1);
  }, null, 30000), 'both players placed a girl');
  // a few waves on Auto (3×) until both wallets can pay for a gift and a tier, then waves by hand again
  await A.evaluate(() => {
    const { ui, coop } = window.__battle;
    coop.lockstep.queue('speed', [3]);
    ui.setAutoStart(true);
    ui.startWave();
  });
  check(await waitFor(A, () => window.__battle.coop.lockstep.coop.wallets[0] >= 900 && window.__battle.coop.lockstep.coop.wallets[1] >= 300, null, 400000, 250), 'a few waves in: coins for the probe');
  await A.evaluate(() => {
    const { ui, coop } = window.__battle;
    ui.setAutoStart(false);
    coop.lockstep.queue('speed', [1]);
  });
  check(await waitFor(A, () => window.__battle.sim.state === 'between', null, 180000), 'the wave on hand ends');
  // ================= review probes =================
  const q = (p, k, a) => p.evaluate(([k, a]) => { const c = window.__battle.coop.lockstep.queue(k, a); return c ? c.t : null; }, [k, a]);
  const res = [];
  const watchRes = (p) => p.evaluate(() => {
    window.__res = [];
    const ls = window.__battle.coop.lockstep;
    const prev = ls.hooks.onApplied;
    ls.hooks.onApplied = (c, r) => { if (['gift', 'lend', 'back', 'give', 'sell', 'upg'].includes(c.k)) window.__res.push(`${c.p}:${c.k}:${JSON.stringify(c.a)}=${r.ok ? 'ok' : r.reason}`); prev?.(c, r); };
  });
  await watchRes(A); await watchRes(B);
  const ids = await A.evaluate(() => {
    const { sim, coop } = window.__battle;
    const mine = sim.towers.filter((t) => coop.ownerOf(t.uid) === 0);
    return { hero: mine.find((t) => t.isHero)?.uid ?? null, girls: mine.filter((t) => !t.isHero).map((t) => t.uid), guest: sim.towers.filter((t) => coop.ownerOf(t.uid) === 1).map((t) => t.uid) };
  });
  log('    ids ' + JSON.stringify(ids));
  // place two more girls for the host so there is something to sell
  await placeGirls(A, ['rei']);
  await waitFor(A, () => window.__battle.sim.towers.filter((t) => !t.isHero && window.__battle.coop.ownerOf(t.uid) === 0).length >= 2, null, 20000);
  const ids2 = await A.evaluate(() => window.__battle.sim.towers.filter((t) => !t.isHero && window.__battle.coop.ownerOf(t.uid) === 0).map((t) => t.uid));
  const [g1, g2] = ids2; const g3 = ids2[2] ?? g1;
  // 1. gift spam + over-wallet + CASH_MAX-ish
  await B.evaluate(() => { for (let i = 0; i < 6; i++) window.__battle.coop.lockstep.queue('gift', [0, 10]); window.__battle.coop.lockstep.queue('gift', [0, 999999999]); window.__battle.coop.lockstep.queue('gift', [0, 2 ** 53]); window.__battle.coop.lockstep.queue('gift', [0, -50]); window.__battle.coop.lockstep.queue('gift', [1, 50]); });
  // 2. lend + sell same tick (sell first), lend + upgrade by owner same tick (lend first), double lend, hero lend
  await A.evaluate(([g1, g2, hero, g3]) => {
    const ls = window.__battle.coop.lockstep;
    ls.queue('sell', [g1]); ls.queue('lend', [g1, 1]); ls.queue('lend', [g3, 1]); ls.queue('sell', [g3]);
    ls.queue('lend', [g2, 1]); ls.queue('upg', [g2, 0]); ls.queue('lend', [g2, 1]);
    if (hero != null) ls.queue('lend', [hero, 1]);
  }, [g1, g2, ids.hero, g3]);
  await A.waitForTimeout(2500);
  // 3. guest double-lends the lent girl back, gives it back, host lends again
  await B.evaluate((g2) => { const ls = window.__battle.coop.lockstep; ls.queue('lend', [g2, 0]); ls.queue('give', [g2]); }, g2);
  await A.waitForTimeout(1500);
  await q(A, 'lend', [g2, 1]);
  await A.waitForTimeout(1500);
  // 4. back during a wave
  await A.evaluate(() => window.__battle.ui.startWave());
  check(await waitFor(A, () => window.__battle.sim.state === 'wave', null, 20000), 'probe: a wave runs');
  await q(A, 'back', [g2]);
  await A.waitForTimeout(1500);
  await settleAndAgree(A, B, 'probe: after gift spam, lend/sell/upg races, double lend, hero lend, back in a wave');
  log('    phase1 A ' + JSON.stringify(await A.evaluate(() => window.__res)));
  log('    phase1 B ' + JSON.stringify(await B.evaluate(() => window.__res)));
  // 5. cut the guest: lend to a leaving player, give after owner gone, join during the grace
  await B.evaluate(() => { const ls = window.__coop.lockstep; window.__cut = ls.sendRaw; ls.sendRaw = () => {}; ls.receive = () => {}; });
  check(await waitFor(A, () => window.__battle.coop.lockstep.peers.get(1)?.gone, null, 90000), 'probe: guest cut → dropped on the host');
  await q(A, 'lend', [g3, 1]); // to a gone player
  await q(A, 'back', [g2]); // in a wave, controller gone: allowed
  await A.waitForTimeout(2000);
  const pd = await A.evaluate(() => window.__battle.coop.pendingDeals());
  log('    pending ' + JSON.stringify(pd));
  await B.evaluate(() => { const ls = window.__coop.lockstep; ls.sendRaw = window.__cut; delete ls.receive; });
  const back1 = await Promise.all([A, B].map((p) => waitFor(p, () => { const ls = window.__coop?.lockstep; return ls && ls.rejoins >= 1 && !ls.job && [...ls.peers.values()].every((x) => !x.gone) && window.__battle?.coop?.lockstep === ls && ls.running; }, null, 400000)));
  check(back1.every(Boolean), 'probe: join inside the grace');
  const pdA = await A.evaluate(() => window.__battle.coop.pendingDeals());
  check(pdA.length === 0, `probe: the join cancelled the hand-out (${JSON.stringify(pdA)})`);
  await watchRes(A); await watchRes(B);
  await A.waitForTimeout(6000);
  await settleAndAgree(A, B, 'probe: after a join inside the grace');
  // 6. lend g2 to guest again (between waves), cut the guest, wait past the grace, then join after the hand-out
  check(await waitFor(A, () => window.__battle.sim.state !== 'wave', null, 240000), 'probe: wave over');
  await q(A, 'lend', [g2, 1]);
  await A.waitForTimeout(1500);
  const guestNow = await A.evaluate(() => window.__battle.sim.towers.filter((t) => !t.isHero && window.__battle.coop.ownerOf(t.uid) === 1).map((t) => t.uid));
  await B.evaluate(() => { const ls = window.__coop.lockstep; window.__cut = ls.sendRaw; ls.sendRaw = () => {}; ls.receive = () => {}; });
  check(await waitFor(A, () => window.__battle.coop.lockstep.peers.get(1)?.gone, null, 90000), 'probe: guest cut again');
  const dealt = await waitFor(A, ([u, g2]) => u.every((x) => window.__battle.coop.ctrlOf(x) === 0) && window.__battle.coop.ctrlOf(g2) === 0, [guestNow, g2], 90000);
  check(dealt, 'probe: grace over → guest girls and the lent girl are the host\'s');
  // a stale guest order after the hand-out: queue on B while cut (it reaches A after the heal, too late)
  await B.evaluate((u) => { const ls = window.__coop.lockstep; if (u[0] != null) ls.queue('upg', [u[0], 0]); ls.queue('gift', [0, 10]); }, guestNow);
  await B.evaluate(() => { const ls = window.__coop.lockstep; ls.sendRaw = window.__cut; delete ls.receive; });
  const back2 = await Promise.all([A, B].map((p) => waitFor(p, () => { const ls = window.__coop?.lockstep; return ls && ls.rejoins >= 1 && !ls.job && [...ls.peers.values()].every((x) => !x.gone) && window.__battle?.coop?.lockstep === ls && ls.running; }, null, 400000)));
  check(back2.every(Boolean), 'probe: join after the hand-out');
  const after = await Promise.all([A, B].map((p) => p.evaluate((u) => u.map((x) => window.__battle.coop.ctrlOf(x)), guestNow)));
  check(JSON.stringify(after[0]) === JSON.stringify(after[1]) && after[0].every((c) => c === 1), `probe: the guest's girls are theirs again on both pages (${JSON.stringify(after)})`);
  await A.waitForTimeout(8000);
  await settleAndAgree(A, B, 'probe: after a join after the hand-out');
  const rA = await A.evaluate(() => window.__res); const rB = await B.evaluate(() => window.__res);
  log('    results A ' + JSON.stringify(rA));
  log('    results B ' + JSON.stringify(rB));
} catch (e) {
  failures.push(`crashed: ${e.stack || e.message}`);
  log(`  FAIL crashed: ${e.stack || e.message}`);
  for (const [n, p] of [['A', A], ['B', B]]) if (p && shotsDir) await p.screenshot({ path: `${shotsDir}/share-crash-${n}.jpg`, type: 'jpeg', quality: 60 }).catch(() => null);
}

check(!errors.length, `no page errors${errors.length ? `:\n    ${errors.slice(0, 12).join('\n    ')}` : ''}`);
log(`\n${failures.length ? `${failures.length} check(s) FAILED` : 'all checks ok'} (${Math.round((Date.now() - t0) / 1000)} s)`);
await browser.close().catch(() => null);
await server.close().catch(() => null);
process.exit(failures.length ? 1 : 0);
