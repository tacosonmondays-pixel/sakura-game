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
  check(await waitFor(A, () => window.__battle.coop.lockstep.coop.wallets.every((w) => w >= 300), null, 300000, 250), 'a few waves in: both players have coins to share');
  await A.evaluate(() => {
    const { ui, coop } = window.__battle;
    ui.setAutoStart(false);
    coop.lockstep.queue('speed', [1]);
  });
  check(await waitFor(A, () => window.__battle.sim.state === 'between', null, 180000), 'the wave on hand ends');
  await A.evaluate(() => window.__battle.ui.startWave());
  check(await waitFor(A, () => window.__battle.sim.state === 'wave', null, 30000), 'the next wave runs (started by hand)');

  // ---- 2. coins: the guest sends 25% through the sheet ------------------------------------------------
  const w0 = await A.evaluate(() => window.__battle.coop.lockstep.coop.wallets);
  await tap(B, '[data-testid="coop-gift"]');
  check(await waitFor(B, () => !document.querySelector('[data-testid="gift-sheet"]').hidden, null, 5000), 'the guest opens "Send coins" from the host\'s chip');
  await tap(B, '[data-testid="gift-25"]');
  const amount = Number((await B.locator('[data-testid="gift-amount"]').innerText()).replace(/[^\d]/g, ''));
  await shots(B, 'share-01-gift-sheet');
  await tap(B, '[data-testid="gift-send"]');
  const landed = await waitFor(A, ([w, n]) => {
    const now = window.__battle.coop.lockstep.coop.wallets;
    return now[0] >= w[0] + n;
  }, [w0, amount], 20000);
  const w1 = await Promise.all([A, B].map((p) => p.evaluate(() => window.__battle.coop.lockstep.coop.wallets)));
  // (each page read at its own tick: the hash check below compares them tick for tick)
  check(amount >= 10 && landed && w1[1][0] >= w0[0] + amount, `the gift of ${amount} landed in the host's wallet on both screens (${JSON.stringify(w0)} → host ${JSON.stringify(w1[0])} / guest ${JSON.stringify(w1[1])})`);
  await A.waitForTimeout(300);
  const feeds = await Promise.all([feedText(A), feedText(B)]);
  check(/Bea sent you .*coins/.test(feeds[0]) && /You sent Aiko .*coins/.test(feeds[1]), `both feeds say it ("${feeds[0].match(/Bea sent you[^|]*/)?.[0]}" / "${feeds[1].match(/You sent Aiko[^|]*/)?.[0]}"; guest feed: ${feeds[1].slice(-300)})`);
  await settleAndAgree(A, B, 'after the gift');

  // ---- 3. a girl: the host lends Aoi, the guest buys her a tier; between waves the host takes her back ----
  const girl = await A.evaluate(() => {
    const { sim, coop } = window.__battle;
    return sim.towers.find((t) => !t.isHero && coop.ownerOf(t.uid) === coop.mySlot && t.unitId === 'aoi')?.uid ?? null;
  });
  check(girl != null, 'the host has an Aoi on the field');
  await A.evaluate((uid) => window.__battle.ui.select(uid), girl);
  check(await waitFor(A, () => !!document.querySelector('[data-testid="share-lend"]'), null, 10000), 'the host\'s drawer offers "Lend to Bea"');
  const lendText = await A.locator('[data-testid="share-lend"]').innerText();
  await tap(A, '[data-testid="share-lend"]'); // arm
  await tap(A, '[data-testid="share-lend"]'); // lend
  const lentBoth = await Promise.all([A, B].map((p) => waitFor(p, (uid) => window.__battle.coop.ctrlOf(uid) === 1, girl, 20000)));
  check(/Lend to Bea/.test(lendText) && lentBoth.every(Boolean), 'after two taps she is the guest\'s to command on both screens');
  const outOk = await waitFor(A, () => {
    const b = document.querySelector('[data-testid="share-back"]');
    return !!b && b.disabled && /Lent to Bea/.test(document.querySelector('[data-testid="share-row"]')?.textContent || '');
  }, null, 10000);
  const outRow = await A.evaluate(() => ({ row: document.querySelector('[data-testid="share-row"]')?.textContent || null, back: document.querySelector('[data-testid="share-back"]')?.disabled ?? null, state: window.__battle.sim.state }));
  check(outOk, `the host's drawer: "Lent to Bea · Take back", disabled during the wave (${JSON.stringify(outRow)})`);
  await B.evaluate((uid) => window.__battle.ui.select(uid), girl);
  check(await waitFor(B, () => /Lent by Aiko/.test(document.querySelector('[data-testid="share-row"]')?.textContent || '') && !!document.querySelector('[data-testid="share-give"]'), null, 10000),
    'the guest\'s drawer: "Lent by Aiko · Give back"');
  await shots(A, 'share-02-lent-out-host');
  await shots(B, 'share-03-lent-in-guest');
  const before = await B.evaluate((uid) => ({ w: window.__battle.coop.lockstep.coop.wallets, tier: window.__battle.sim.getTower(uid).tiers[0], cost: window.__battle.sim.upgradeStatus(uid, 0).cost }), girl);
  const upg = await B.evaluate((uid) => window.__battle.ui.act.upgrade(uid, 0), girl);
  const bought = await waitFor(A, ([uid, t]) => window.__battle.sim.getTower(uid).tiers[0] === t + 1, [girl, before.tier], 20000);
  const after = await B.evaluate(() => window.__battle.coop.lockstep.coop.wallets);
  check(upg === 'queued' && bought && after[1] <= before.w[1] - before.cost + 50 && after[0] >= before.w[0], `the guest bought her a tier from the guest's wallet (${JSON.stringify(before.w)} → ${JSON.stringify(after)}, cost ${before.cost})`);
  check(await waitFor(A, () => window.__battle.sim.state === 'between', null, 180000), 'the wave ends');
  await A.evaluate((uid) => window.__battle.ui.select(uid), girl);
  check(await waitFor(A, () => {
    const b = document.querySelector('[data-testid="share-back"]');
    return !!b && !b.disabled;
  }, null, 10000), 'between waves "Take back" is on');
  await tap(A, '[data-testid="share-back"]');
  const backBoth = await Promise.all([A, B].map((p) => waitFor(p, (uid) => window.__battle.coop.ctrlOf(uid) === 0, girl, 20000)));
  check(backBoth.every(Boolean), 'the host took her back: theirs again on both screens (with the tier the guest bought)');
  await settleAndAgree(A, B, 'after the lend, the upgrade and the take-back');

  // ---- 4. lent again; the guest leaves: the grace, then the hand-out --------------------------------------
  await A.evaluate((uid) => window.__battle.ui.act.lend(uid), girl);
  check((await Promise.all([A, B].map((p) => waitFor(p, (uid) => window.__battle.coop.ctrlOf(uid) === 1, girl, 20000)))).every(Boolean), 'lent to the guest again');
  const guestGirls = await A.evaluate(() => window.__battle.sim.towers.filter((t) => !t.isHero && window.__battle.coop.ownerOf(t.uid) === 1).map((t) => t.uid));
  const walletB = await A.evaluate(() => window.__battle.coop.lockstep.coop.wallets[1]);
  await settleAndAgree(A, B, 'before the guest leaves');
  await B.evaluate(() => window.__coop.close());
  check(await waitFor(A, () => window.__battle.coop.lockstep.peers.get(1)?.gone, null, 30000), 'the guest left: the host plays on');
  check(await waitFor(A, () => /their girls are yours in \d+ s/.test(document.querySelector('[data-testid="coop-state"]')?.textContent || ''), null, 10000), 'the host\'s co-op line counts the grace down ("Ally left — their girls are yours in N s")');
  const graceText = await A.locator('[data-testid="coop-state"]').innerText();
  const still = await A.evaluate(([uids, lent]) => uids.every((u) => window.__battle.coop.ctrlOf(u) === 1) && window.__battle.coop.ctrlOf(lent) === 1, [guestGirls, girl]);
  check(still, `during the grace (${graceText}) nothing moved`);
  await shots(A, 'share-04-grace-countdown');
  const t1 = Date.now();
  const dealt = await waitFor(A, ([uids, lent]) => uids.every((u) => window.__battle.coop.ctrlOf(u) === 0) && window.__battle.coop.ctrlOf(lent) === 0, [guestGirls, girl], 60000);
  const secs = Math.round((Date.now() - t1) / 1000);
  const wNow = await A.evaluate(() => window.__battle.coop.lockstep.coop.wallets);
  check(dealt && wNow[1] === 0, `the grace over (${secs} s after the countdown showed): the guest's girls are the host's, Aoi home, the guest's ${walletB} coins too (${JSON.stringify(wNow)})`);
  check(await waitFor(A, () => /their girls are yours now/.test((window.__feedLog || []).join(' | ')), null, 10000), 'the host\'s feed says their girls are yours now');
  const handed = guestGirls[0];
  await A.evaluate((uid) => window.__battle.ui.select(uid), handed);
  await shots(A, 'share-05-handed-over');
  const tierH = await A.evaluate((uid) => window.__battle.sim.getTower(uid).tiers[1], handed);
  const r = await A.evaluate((uid) => window.__battle.ui.act.upgrade(uid, 1), handed);
  check(r === 'queued' && await waitFor(A, ([uid, t]) => window.__battle.sim.getTower(uid).tiers[1] === t + 1, [handed, tierH], 20000), 'the host upgrades a handed-over girl');
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
