// End-to-end test of the online features with the LOCAL adapter: one browser, two pages (two
// "tabs" = two players: they share localStorage + BroadcastChannel, each has its own
// sessionStorage identity). Checks:
//   1. both players pick a name
//   2. a chat message from A appears live on B, and a burst shows rate-limit feedback
//   3. A founds a clan, B finds and joins it, both member lists show 2; the clan boss tab loads,
//      and one boss attempt through a real battle (Fight → battle → end) lands on the ranking
//   4. a third tab joins the developer clan with Rosie777 and the Supply Bot grants items
//   5. co-op: A hosts a room, B joins by code and readies, A starts; both place a girl through
//      the real tower bar (tap card → tap ground), the wave runs and the lockstep state hashes
//      of both clients match; a cut link drops the guest, the host re-admits it when the link
//      is back and the hashes agree again; finally the guest leaves and the host plays on
//
//   node e2e/online.mjs                              # 1280×720
//   node e2e/online.mjs --viewport 844x390 --shots /tmp/online   # + screenshots
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
const [W, H] = opt('viewport', '1280x720').split('x').map(Number);
const shotsDir = opt('shots', null);
const prefix = opt('prefix', '');
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const touch = Math.min(W, H) < 600;

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
log(`browser: ${label} · viewport ${W}x${H}`);

// reduced motion: no panel / modal entrance animations, so an element is "stable" for a click on
// the first frame even when three pages share an overloaded software-GL GPU process (a page
// that gets few frames otherwise keeps a 0.4 s slide-in "running" for seconds)
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch, reducedMotion: 'reduce' });
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
// every checkpoint also scans the visible text for leaked "null" / "undefined" / "NaN"
// (e.g. a null passed to replaceChildren() renders as the word "null")
const shot = async (page, name) => {
  const leaked = await page.evaluate(() => (document.body.innerText.match(/\b(null|undefined|NaN)\b/g) || []).join(', ')).catch(() => '');
  check(!leaked, `${name}: no "null" / "undefined" / "NaN" on screen${leaked ? ` (${leaked})` : ''}`);
  if (!shotsDir) return;
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250)))));
  await page.screenshot({ path: `${shotsDir}/${prefix}${name}-${W}x${H}.png` });
};
const go = (page, hash) => page.evaluate((h) => { location.hash = h; }, hash);
// A normal tap/click waits for two animation frames with the element in the same place. On an
// overloaded machine a page can get no frames for many seconds (three pages share one software-GL
// GPU process): then tap the element where it is, without the frame-based stability wait (the
// event still goes to whatever is on top at that point, so a covered button is not "pressed").
const tap = async (page, sel) => {
  const el = page.locator(sel).first();
  const act = (opts) => (touch ? el.tap(opts) : el.click(opts));
  try {
    await act({ timeout: 20000 });
  } catch (e) {
    if (!/Timeout/.test(e.message)) throw e;
    log(`    (no frames for 20 s: tapping ${sel} without the stability wait)`);
    await act({ timeout: 20000, force: true });
  }
};

async function setName(page, name) {
  await page.waitForSelector('[data-testid="name-input"]', { timeout: 20000 });
  await page.fill('[data-testid="name-input"]', name);
  await tap(page, '[data-testid="name-save"]');
  await page.waitForSelector('[data-testid="name-input"]', { state: 'detached', timeout: 10000 });
}

let A;
let B;
try {
  // ---- fresh shared save, two players ---------------------------------------------------
  A = await openPage('A');
  await A.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await A.evaluate(() => localStorage.clear());
  await A.goto(`${base}#/chat`, { waitUntil: 'load' });
  // two WebGL battles side by side under SwiftShader: low quality keeps both pages responsive
  await A.evaluate(() => {
    const { store } = window.__sakura;
    Object.assign(store.profile.settings, { quality: 'low', shadows: false, bloom: false });
    store.commit('settings');
    store.saveNow?.();
  });
  await setName(A, 'Aiko');
  B = await openPage('B');
  await B.goto(`${base}#/chat`, { waitUntil: 'load' });
  await setName(B, 'Bea');
  const ids = await Promise.all([A, B].map((p) => p.evaluate(() => window.__online.uid)));
  check(ids[0] && ids[1] && ids[0] !== ids[1], `two tabs are two players (${ids.join(' / ')})`);
  check(await A.locator('[data-testid="online-pill"]').first().innerText().then((t) => /local test mode/i.test(t)), 'status pill says "Local test mode" (?online=local)');

  // ---- chat -----------------------------------------------------------------------------
  await A.waitForSelector('[data-testid="chat-panel"][data-ready="1"]', { timeout: 10000 });
  await B.waitForSelector('[data-testid="chat-panel"][data-ready="1"]', { timeout: 10000 });
  await A.fill('[data-testid="chat-input"]', 'Hello from Aiko!');
  await A.press('[data-testid="chat-input"]', 'Enter');
  const delivered = await B.waitForFunction(() => [...document.querySelectorAll('[data-testid="chat-msg"]')].some((m) => m.innerText.includes('Hello from Aiko!')), null, { timeout: 8000 }).then(() => true).catch(() => false);
  check(delivered, 'chat: A\'s message appears live on B');
  check(await B.locator('[data-testid="chat-msg"]').last().innerText().then((t) => t.includes('Aiko')), 'chat: B sees the sender name');
  await B.fill('[data-testid="chat-input"]', 'Hi Aiko, Bea here');
  await B.press('[data-testid="chat-input"]', 'Enter');
  await A.waitForFunction(() => document.querySelectorAll('[data-testid="chat-msg"]').length >= 2, null, { timeout: 8000 }).catch(() => null);
  await shot(A, 'chat');
  // burst: the client limiter answers before the server would
  for (const text of ['one', 'two', 'three']) {
    await A.fill('[data-testid="chat-input"]', `burst ${text}`);
    await A.press('[data-testid="chat-input"]', 'Enter');
  }
  const status = await A.waitForFunction(() => /slow down/i.test(document.querySelector('[data-testid="chat-status"]')?.innerText || ''), null, { timeout: 3000 }).then(() => A.locator('[data-testid="chat-status"]').innerText()).catch(() => '');
  check(/slow down.*\d/i.test(status), `chat: a burst shows rate-limit feedback ("${status}")`);
  await shot(A, 'chat-ratelimit');
  // the lobby's chat bubble opens the slide-in drawer with the same global chat
  await go(B, '#/lobby');
  await B.waitForSelector('[data-testid="top-chat"]', { timeout: 45000 }).catch(async (e) => {
    log(`    lobby: ${JSON.stringify(await B.evaluate(() => ({ hash: location.hash, text: document.body.innerText.slice(0, 300) })))}`);
    if (shotsDir) await B.screenshot({ path: `${shotsDir}/${prefix}debug-lobby-${W}x${H}.png` });
    throw e;
  });
  await tap(B, '[data-testid="top-chat"]');
  const inDrawer = await B.waitForFunction(() => /Hello from Aiko!/.test(document.querySelector('[data-testid="chat-drawer"]')?.innerText || ''), null, { timeout: 10000 }).then(() => true).catch(() => false);
  check(inDrawer, 'chat: the lobby chat bubble opens the drawer with the global chat');
  await shot(B, 'lobby-chat-drawer');
  await tap(B, '[data-testid="drawer-close"]');

  // ---- clans ----------------------------------------------------------------------------
  await go(A, '#/clan');
  await A.waitForSelector('[data-testid="clan-create-panel"]', { timeout: 10000 });
  await A.fill('[data-testid="clan-name"]', 'Petal Squad');
  await A.fill('[data-testid="clan-tag"]', 'ps');
  await A.fill('[data-testid="clan-desc"]', 'Cozy clan for weekly boss runs');
  await tap(A, '[data-testid="clan-create"]');
  await A.waitForSelector('[data-testid="clan-home"]', { timeout: 10000 });
  check(await A.locator('[data-testid="clan-title"]').innerText() === 'Petal Squad', 'clan: A founded Petal Squad');
  await go(B, '#/clan');
  await B.waitForSelector('[data-testid="clan-search"]', { timeout: 10000 });
  await B.fill('[data-testid="clan-search"]', 'petal');
  await B.waitForSelector('[data-testid="join-PS"]', { timeout: 8000 });
  await shot(B, 'clan-browse');
  await tap(B, '[data-testid="join-PS"]');
  await B.waitForSelector('[data-testid="clan-home"]', { timeout: 10000 });
  const count = (p) => p.waitForFunction(() => document.querySelectorAll('[data-testid="member-row"]').length === 2, null, { timeout: 8000 }).then(() => true).catch(() => false);
  check(await count(B), 'clan: B joined and sees 2 members');
  check(await count(A), 'clan: A\'s member list updated live to 2');
  check(await A.locator('[data-testid="clan-count"]').innerText().then((t) => t.startsWith('2/')), 'clan: header shows 2 members');
  await shot(A, 'clan-members');
  await tap(A, '[data-testid="tab-chat"]');
  await A.waitForSelector('[data-testid="chat-panel"][data-ready="1"]', { timeout: 8000 });
  await shot(A, 'clan-chat');
  await tap(A, '[data-testid="tab-boss"]');
  check(await A.waitForSelector('[data-testid="boss-panel"]', { timeout: 8000 }).then(() => true).catch(() => false), 'clan boss: panel with HP pool loads');
  check(/HP/.test(await A.locator('[data-testid="boss-hp"]').innerText()), 'clan boss: HP bar shown');
  await shot(A, 'clan-boss');

  // one clan boss attempt through the real battle: Fight → battle (clanBoss=1) → a girl fights
  // the first wave → the battle ends → its damage is submitted and shows on the ranking
  await tap(A, '[data-testid="boss-fight"]');
  const bossBattle = await A.waitForFunction(() => window.__battle?.ui?.placement && /clanBoss=1/.test(location.hash), null, { timeout: 40000 }).then(() => true).catch(() => false);
  check(bossBattle, 'clan boss: Fight opens the boss battle');
  if (bossBattle) {
    await A.waitForTimeout(600);
    const placed = await placeOne(A);
    await A.evaluate(() => window.__battle.ui.startWave());
    // let her fight for a while (any damage counts), then end the run
    await A.waitForFunction(() => Object.values(window.__battle.sim.stats.damageByTower || {}).some((d) => d > 0), null, { timeout: 30000 }).catch(() => null);
    // end the run quickly: one life left, then fast-forward the Sim (like e2e/smoke.mjs) until
    // an enemy leaks; the battle screen picks up the 'lost' event on its next frame
    await A.evaluate(() => {
      const { sim } = window.__battle;
      sim.lives = 1;
      for (let k = 0; k < 2400 && sim.state !== 'won' && sim.state !== 'lost'; k++) {
        if (sim.state === 'between') sim.startNextWave();
        sim.update(0.25);
      }
    });
    const submitted = await A.waitForFunction(() => window.__battle.ui.clanBossResult, null, { timeout: 20000 }).then(() => A.evaluate(() => {
      const r = window.__battle.ui.clanBossResult;
      return { dmg: window.__battle.ui.clanBossDamage, hp: r.hp, maxHp: r.maxHp, hits: r.myHitsToday, board: r.board?.length || 0, error: r.error ? String(r.error.message || r.error) : null };
    })).catch(() => null);
    check(!!submitted && !submitted.error && submitted.hits === 1 && submitted.board === 1 && submitted.hp === submitted.maxHp - submitted.dmg,
      `clan boss: the battle's damage counts against the shared pool (${placed ? 'girl placed, ' : ''}${JSON.stringify(submitted)})`);
    await A.waitForSelector('[data-testid="clan-back"]', { timeout: 15000 }).catch(() => null);
    await tap(A, '[data-testid="clan-back"]');
    const ranked = await A.waitForFunction(() => document.querySelectorAll('.ol-board-list li').length === 1 && /Aiko/.test(document.querySelector('.ol-board-list')?.innerText || ''), null, { timeout: 10000 }).then(() => true).catch(() => false);
    check(ranked, 'clan boss: back in the clan, the ranking lists the attempt');
    check(/Fight \(2\/3 left\)/.test(await A.locator('[data-testid="boss-fight"]').innerText().catch(() => '')), 'clan boss: one of three daily attempts used');
    await shot(A, 'clan-boss-ranked');
  }

  // ---- developer clan (third tab) -------------------------------------------------------
  const C = await openPage('C');
  await C.goto(`${base}#/clan`, { waitUntil: 'load' });
  await setName(C, 'DevTester');
  await C.waitForSelector('[data-testid="clan-code"]', { timeout: 10000 });
  await C.fill('[data-testid="clan-code"]', 'Rosie777');
  await tap(C, '[data-testid="clan-code-join"]');
  await C.waitForSelector('[data-testid="supply-bot"]', { timeout: 10000 });
  check(/DEVELOPER SANDBOX/.test(await C.locator('[data-testid="supply-bot"]').innerText()), 'dev clan: Rosie777 opens the Supply Bot, labelled DEVELOPER SANDBOX');
  const gems0 = await C.evaluate(() => window.__sakura.store.profile.currencies.gems);
  await C.evaluate(() => {
    for (const b of document.querySelectorAll('.ol-sb-tabs .ol-seg-btn')) if (/currenc|token/i.test(b.textContent)) b.click();
  });
  const gemTile = C.locator('[data-testid="supply-grid"] [data-item="gems"]');
  if (await gemTile.count()) {
    await gemTile.first().click();
    await C.fill('[data-testid="supply-qty"]', '12345');
    await tap(C, '[data-testid="supply-grant"]');
    await C.waitForTimeout(300);
    const gems1 = await C.evaluate(() => window.__sakura.store.profile.currencies.gems);
    check(gems1 === gems0 + 12345, `dev clan: Supply Bot granted 12,345 gems (${gems0} → ${gems1})`);
  } else check(false, 'dev clan: gems tile in the Supply Bot');
  await shot(C, 'supply-bot');
  await C.close();

  // ---- co-op ----------------------------------------------------------------------------
  await go(A, '#/coop');
  await A.waitForSelector('[data-testid="coop-create"]', { timeout: 10000 });
  await shot(A, 'coop-hub');
  await tap(A, '[data-testid="coop-create"]');
  await A.waitForSelector('[data-testid="coop-room-code"]', { timeout: 10000 });
  const code = (await A.locator('[data-testid="coop-room-code"]').innerText()).trim();
  check(/^[A-Z0-9]{5}$/.test(code), `co-op: A hosts room ${code}`);
  // the host invites the clan: the invite shows up in B's co-op hub (B then joins by code)
  await tap(A, '[data-testid="coop-invite"]');
  await go(B, '#/coop');
  await B.waitForSelector('[data-testid="coop-code"]', { timeout: 10000 });
  check(await B.waitForSelector(`[data-testid="coop-invites"] [data-room="${code}"] [data-testid="invite-row-join"]`, { timeout: 10000 }).then(() => true).catch(() => false),
    'co-op: the host\'s clan invite is listed in the clanmate\'s co-op hub');
  await B.fill('[data-testid="coop-code"]', code.toLowerCase());
  await tap(B, '[data-testid="coop-join"]');
  await B.waitForSelector('[data-testid="coop-player-0"]', { timeout: 10000 });
  const paired = await A.waitForSelector('[data-testid="coop-player-1"]', { timeout: 10000 }).then(() => true).catch(() => false);
  check(paired, 'co-op: both players appear in the room');
  await tap(B, '[data-testid="coop-ready"]');
  const canStart = await A.waitForFunction(() => !document.querySelector('[data-testid="coop-start"]')?.disabled, null, { timeout: 8000 }).then(() => true).catch(() => false);
  check(canStart, 'co-op: Start unlocks when the guest is ready');
  await shot(A, 'coop-lobby');
  await shot(B, 'coop-lobby-guest');
  await tap(A, '[data-testid="coop-start"]');
  // in the battle = the battle screen is built and this client's lockstep runs with its ally
  // connected. On an overloaded machine (two software-WebGL pages) a battle screen can take longer
  // to load than the ally's load allowance: the host then starts alone and re-admits the guest
  // when it shows up (the rejoin path), which this wait covers too. The co-op waits below are
  // long for the same reason: both pages share one software-GL GPU process, and on a busy
  // machine one page can stall for over a minute (the lockstep then drops and re-admits it).
  const inBattle = async (p) => p.waitForFunction(() => {
    const ls = window.__battle?.coop?.lockstep;
    return !!(ls && window.__battle.ui?.placement && ls.running && ls.tick > 0 && ls.livePeers().length === 1 && window.__coop?.lockstep === ls);
  }, null, { timeout: 150000, polling: 250 }).then(() => true).catch(() => false);
  const battleInfo = (p) => p.evaluate(() => ({
    hash: location.hash, phase: window.__coop?.phase, ls: !!window.__coop?.lockstep, battle: !!window.__battle?.coop, error: document.querySelector('.bt-error')?.innerText || null,
    tick: window.__coop?.lockstep?.tick, peers: window.__coop?.lockstep ? [...window.__coop.lockstep.peers.values()].map((q) => ({ gone: q.gone, why: q.why, ready: q.ready })) : null, rejoins: window.__coop?.lockstep?.rejoins,
    trace: window.__coop?.lockstep?.trace,
  })).catch((e) => ({ error: e.message }));
  const [inA, inB] = await Promise.all([inBattle(A), inBattle(B)]);
  if (!check(inA, 'co-op: host is in the battle') | !check(inB, 'co-op: guest is in the battle')) {
    log(`    host: ${JSON.stringify(await battleInfo(A))}`);
    log(`    guest: ${JSON.stringify(await battleInfo(B))}`);
  } else {
    const ev = (p) => p.evaluate(() => window.__coop.lockstep.trace.map((e) => `${e.ev}@${e.tick}`).join(' ')).catch(() => '?');
    log(`    connection events — host: ${await ev(A)} | guest: ${await ev(B)}`);
  }
  await Promise.all([A, B].map((p) => p.waitForFunction(() => {
    for (let el = window.__battle.renderer.canvas; el; el = el.parentElement) {
      if (el.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity)) return false;
    }
    return true;
  }, null, { timeout: 15000 }).catch(() => null)));

  // each player places one of HER girls through the tower bar: tap the card, tap the ground
  async function placeOne(page, avoid = []) {
    const spot = await page.evaluate((taken) => {
      const { sim, renderer, ui } = window.__battle;
      const unitId = [...sim.loadout.keys()].find((id) => sim.data.unit(id)?.placement === 'land' && sim.cash >= sim.placeCost(id));
      if (!unitId) return null;
      const barTop = ui.bar.el.getBoundingClientRect().top;
      const roomy = (x, y) => [[0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]].every(([dx, dy]) => sim.canPlace(unitId, x + dx, y + dy).ok)
        && taken.every(([tx, ty]) => Math.hypot(tx - x, ty - y) > 1.6);
      let best = null;
      const rect = renderer.canvas.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const midY = (rect.top + Math.min(rect.bottom, barTop)) / 2;
      for (let y = 0.3; y < sim.map.height; y += 0.5) {
        for (let x = 0.3; x < sim.map.width; x += 0.5) {
          if (!roomy(x, y)) continue;
          const s = renderer.worldToScreen(x, y, 0);
          if (!s.visible || s.clientX < 10 || s.clientX > innerWidth - 10 || s.clientY < 60 || s.clientY > barTop - 10) continue;
          if (document.elementFromPoint(s.clientX, s.clientY) !== renderer.canvas) continue;
          const p = renderer.pick(s.clientX, s.clientY);
          if (!p.inBounds || Math.hypot(p.x - x, p.y - y) > 0.05) continue;
          const d = Math.hypot(s.clientX - midX, s.clientY - midY);
          if (!best || d < best.d) best = { x, y, cx: s.clientX, cy: s.clientY, d };
        }
      }
      return best && { unitId, ...best };
    }, avoid);
    if (!spot) return null;
    // co-op: how many place orders this client has issued so far (its lockstep log)
    const myPlaces = () => page.evaluate(() => {
      const ls = window.__battle?.coop?.lockstep;
      return ls ? ls.log.filter((c) => c.k === 'place' && c.p === ls.mySlot).length : -1;
    });
    const before = await myPlaces();
    for (let attempt = 1; attempt <= 3; attempt++) {
      await tap(page, `[data-testid="card-${spot.unitId}"]`);
      await page.waitForTimeout(150);
      if (touch) await page.touchscreen.tap(spot.cx, spot.cy);
      else await page.mouse.click(spot.cx, spot.cy);
      if (before < 0) break; // solo battle: the girl stands at once (checked by the caller)
      // a page starved of frames can swallow the card / ground taps: then the order was never
      // issued, so tap again (an order that WAS issued but never ran fails the checks below)
      const issued = await page.waitForFunction((n) => {
        const ls = window.__battle?.coop?.lockstep;
        return !!ls && ls.log.filter((c) => c.k === 'place' && c.p === ls.mySlot).length > n;
      }, before, { timeout: 30000, polling: 250 }).then(() => true).catch(() => false);
      if (issued) break;
      log(`    (attempt ${attempt}: no place order issued yet — tapping ${spot.unitId} again)`);
      await page.evaluate(() => window.__battle?.ui?.placement?.cancel?.()).catch(() => null);
    }
    return spot;
  }
  // Lockstep diagnostics (printed when a co-op check fails, and every 0.5 s with OL_DEBUG=1):
  // both clients' ticks, horizons, stalls, desync / resync state, why a peer was dropped, and
  // main-thread freezes (a shared, overloaded machine can freeze a tab for many seconds)
  await Promise.all([A, B].map((p) => p.evaluate(() => {
    window.__gaps = [];
    let last = performance.now();
    setInterval(() => {
      const n = performance.now();
      if (n - last > 400) window.__gaps.push([Math.round(last), Math.round(n - last)]);
      last = n;
    }, 50);
    const ls = window.__battle.coop.lockstep;
    // every order as it runs on this client: kind, who, when, and why it failed
    window.__applied = [];
    window.__battle.coop.session.on('applied', ({ cmd, res }) => {
      window.__applied.push(`${cmd.k}:${cmd.p}@${cmd.t}${res.ok ? '' : `!${res.reason || 'failed'}`}`);
    });
    const orig = ls.dropPeer.bind(ls);
    ls.dropPeer = (peer, reason) => {
      if (!peer.gone) window.__drop = { reason, at: Math.round(performance.now()), tick: ls.tick, heard: Math.round(ls.now() - peer.lastHeard), timeout: ls.timeoutFor(peer), jitter: Math.round(peer.jitter) };
      orig(peer, reason);
    };
  })));
  const lsState = (p) => p.evaluate(() => {
    const ls = window.__battle?.coop?.lockstep;
    if (!ls) return null;
    return {
      vis: document.visibilityState, slot: ls.mySlot, tick: ls.tick, stalled: ls.stalled, delay: ls.delay, resyncs: ls.resyncs, rp: !!ls.resyncPending, desynced: ls.desynced,
      peers: [...ls.peers.values()].map((q) => ({ h: q.horizon, gone: q.gone })), drop: window.__drop || null, gaps: window.__gaps.slice(-5),
      towers: window.__battle.sim.towers.length, state: window.__battle.sim.state, wave: window.__battle.sim.wave, pend: [...ls.pending.keys()], hashes: ls.hashPairs().length,
      orders: ls.log.map((c) => `${c.k}:${c.p}@${c.t}`), applied: (window.__applied || []).slice(-30), trace: ls.trace.map((e) => `${e.ev}@${e.tick}`).join(' '),
    };
  }).catch((e) => ({ error: e.message }));
  const dump = async (label) => log(`    ${label}: ${JSON.stringify(await Promise.all([A, B].map(lsState)))}`);
  const debugFor = async (label, n = 8) => {
    if (!process.env.OL_DEBUG) return;
    for (let i = 0; i < n; i++) {
      await dump(label);
      await A.waitForTimeout(500);
    }
  };
  await debugFor('dbg');
  const sa = await placeOne(A);
  const sb = await placeOne(B, sa ? [[sa.x, sa.y]] : []);
  check(!!sa && !!sb, `co-op: both players picked a card and a spot (${sa?.unitId}, ${sb?.unitId})`);
  await debugFor('dbg2');
  const bothPlaced = async (p) => p.waitForFunction(() => window.__battle.sim.towers.length >= 2, null, { timeout: 240000, polling: 250 }).then(() => true).catch(() => false);
  if (!check(await bothPlaced(A) && await bothPlaced(B), 'co-op: both girls stand on both screens')) await dump('lockstep state');
  const owners = await A.evaluate(() => window.__battle.sim.towers.map((t) => window.__battle.coop.ownerOf(t.uid)).sort());
  check(JSON.stringify(owners) === '[0,1]', `co-op: one girl per player (owners ${JSON.stringify(owners)})`);
  // the host starts the wave: one 'wave' order in its log, and it runs on both clients
  const waveOrder = await A.evaluate(() => {
    const ls = window.__battle.coop.lockstep;
    const state = window.__battle.sim.state;
    window.__battle.ui.startWave();
    return { state, tick: ls.tick, orders: ls.log.filter((c) => c.k === 'wave').map((c) => `${c.p}@${c.t}`) };
  });
  const waveStarted = await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__battle?.sim?.wave >= 1, null, { timeout: 240000, polling: 250 }).then(() => true).catch(() => false)));
  if (!check(waveStarted.every(Boolean), `co-op: the host's Start-wave order runs on both clients (${JSON.stringify(waveOrder)})`)) await dump('lockstep state');
  // run until both clients compared a hash checkpoint at the same tick (from tick 360 on, i.e.
  // after at least 3 checkpoints of 120 ticks). Poll BOTH pages together: a checkpoint one side
  // compared can belong to a timeline the other side then dropped (on an overloaded machine a
  // page can get no frames for a minute or more; the lockstep drops it and re-admits it, and a
  // rebuilt guest starts its comparisons afresh), so wait for a tick that both really compared.
  // (generous: on a shared, overloaded 4-core box a page has been seen getting no frames for
  // 2.5 minutes, twice in a row; this waits that out)
  const comparedTicks = (p) => Promise.race([
    p.evaluate(() => (window.__battle?.coop?.hashes || []).map((q) => q.t).filter((t) => t >= 360)).catch(() => []),
    new Promise((r) => setTimeout(() => r([]), 30000).unref()), // a frozen page answers nothing
  ]);
  let tB = 0;
  for (const until = Date.now() + 600000; !tB && Date.now() < until;) {
    const [ta, tb] = await Promise.all([A, B].map(comparedTicks));
    tB = Math.max(0, ...tb.filter((t) => ta.includes(t)));
    if (!tB) await A.waitForTimeout(500);
  }
  if (!check(!!tB, `co-op: hash checkpoints exchanged during the wave (both compared tick ${tB})`)) await dump('lockstep state');
  const [ha, hb] = await Promise.all([A, B].map((p) => p.evaluate(() => window.__battle.coop.hashes)));
  check(ha.length > 0 && ha.every((p) => p.mine === p.theirs), `co-op: host's hashes match the guest's (${ha.length} checkpoints)`);
  check(hb.length > 0 && hb.every((p) => p.mine === p.theirs), `co-op: guest's hashes match the host's (${hb.length} checkpoints)`);
  const common = ha.filter((p) => hb.some((q) => q.t === p.t && q.mine === p.mine));
  check(common.length > 0, `co-op: both clients computed identical hashes at the same ticks (${common.map((p) => p.t).join(', ')})`);
  const state = await Promise.all([A, B].map((p) => p.evaluate(() => ({ wave: window.__battle.sim.wave, enemies: window.__battle.sim.enemies.length, stalled: window.__battle.coop.lockstep.stalled, desynced: window.__battle.coop.lockstep.desynced, hud: document.querySelector('[data-testid="coop-hud"]')?.innerText || '' }))));
  check(state.every((s) => s.wave >= 1 && !s.desynced), `co-op: wave running, no desync (${JSON.stringify(state.map((s) => ({ wave: s.wave, enemies: s.enemies })))})`);
  check(/Aiko/.test(state[0].hud) && /Bea/.test(state[0].hud), 'co-op: HUD shows both players');
  await A.waitForTimeout(600);
  await shot(A, 'coop-battle');
  await shot(B, 'coop-battle-guest');

  // a network cut longer than the timeout: both play on alone; when the link is back the host
  // re-admits the guest, whose battle screen rebuilds from the host's log, and the hashes agree
  await B.evaluate(() => {
    const ls = window.__coop.lockstep;
    window.__cut = ls.sendRaw;
    ls.sendRaw = () => {};
    ls.receive = () => {};
  });
  const dropped = await A.waitForFunction(() => window.__battle.coop.lockstep.peers.get(1)?.gone, null, { timeout: 60000, polling: 250 }).then(() => true).catch(() => false);
  check(dropped, 'co-op: a guest cut off for longer than the timeout is dropped (the host plays on)');
  await B.evaluate(() => {
    const ls = window.__coop.lockstep;
    ls.sendRaw = window.__cut;
    delete ls.receive;
  });
  const back = await Promise.all([A, B].map((p) => p.waitForFunction(() => {
    const ls = window.__coop?.lockstep;
    return ls && ls.rejoins >= 1 && [...ls.peers.values()].every((q) => !q.gone) && window.__battle?.coop?.lockstep === ls;
  }, null, { timeout: 240000, polling: 250 }).then(() => true).catch(() => false)));
  if (!check(back.every(Boolean), 'co-op: when the link is back, the host re-admits the guest (rejoin)')) await dump('lockstep state');
  const rejoinTick = await A.evaluate(() => window.__battle.coop.tick);
  // (the guest's battle screen is rebuilt from the host's log first: slow on a loaded machine)
  const resynced = await A.waitForFunction((t0) => window.__battle.coop.hashes.some((p) => p.t > t0), rejoinTick, { timeout: 300000, polling: 250 }).then(() => true).catch(() => false);
  const [ra, rb] = await Promise.all([A, B].map((p) => p.evaluate((t0) => window.__battle.coop.hashes.filter((q) => q.t > t0), rejoinTick)));
  if (!check(resynced && ra.length > 0 && ra.every((q) => q.mine === q.theirs) && rb.every((q) => q.mine === q.theirs),
    `co-op: after the rejoin both clients agree again (${ra.map((q) => q.t).join(', ')})`)) await dump('lockstep state');
  await shot(B, 'coop-rejoined-guest');

  // the guest leaves: the host keeps playing
  await go(B, '#/lobby');
  const left = await A.waitForFunction(() => window.__battle.coop.lockstep.livePeers().length === 0, null, { timeout: 20000, polling: 250 }).then(() => true).catch(() => false);
  check(left, 'co-op: when the guest leaves, the host continues solo');
  const t0 = await A.evaluate(() => window.__battle.coop.tick);
  const ticking = await A.waitForFunction((t) => window.__battle.coop.tick > t + 30 && !window.__battle.coop.lockstep.stalled, t0, { timeout: 40000, polling: 250 }).then(() => true).catch(() => false);
  check(ticking, 'co-op: the host\'s battle keeps ticking after the ally left');
  await shot(A, 'coop-ally-left');
} catch (e) {
  check(false, `unexpected error: ${e.stack || e.message}`);
} finally {
  const errs = errors.splice(0);
  check(!errs.length, `no page/console errors${errs.length ? `\n       ${errs.slice(0, 8).join('\n       ')}` : ''}`);
  await browser.close();
  await server.close();
}

log(failures.length ? `\n${failures.length} check(s) FAILED` : '\nall online checks passed');
process.exit(failures.length ? 1 : 0);
