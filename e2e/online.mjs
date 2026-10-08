// End-to-end test of the online features with the LOCAL adapter: one browser, two pages (two
// "tabs" = two players: they share localStorage + BroadcastChannel, each has its own
// sessionStorage identity). Checks:
//   1. both players pick a name
//   2. a chat message from A appears live on B, and a burst shows rate-limit feedback
//   3. A founds a clan, B finds and joins it, both member lists show 2; the clan boss tab loads
//   4. a third tab joins the developer clan with Rosie777 and the Supply Bot grants items
//   5. co-op: A hosts a room, B joins by code and readies, A starts; both place a girl through
//      the real tower bar (tap card → tap ground), the wave runs and the lockstep state hashes
//      of both clients match
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

const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch });
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
const shot = async (page, name) => {
  if (!shotsDir) return;
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250)))));
  await page.screenshot({ path: `${shotsDir}/${prefix}${name}-${W}x${H}.png` });
};
const go = (page, hash) => page.evaluate((h) => { location.hash = h; }, hash);
const tap = async (page, sel) => {
  const el = page.locator(sel).first();
  if (touch) await el.tap({ timeout: 15000 });
  else await el.click({ timeout: 15000 });
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
    store.profile.settings.quality = 'low';
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
  await go(B, '#/coop');
  await B.waitForSelector('[data-testid="coop-code"]', { timeout: 10000 });
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
  const inBattle = async (p) => p.waitForFunction(() => window.__battle?.coop?.lockstep && window.__battle.ui?.placement, null, { timeout: 40000 }).then(() => true).catch(() => false);
  check(await inBattle(A), 'co-op: host is in the battle');
  check(await inBattle(B), 'co-op: guest is in the battle');
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
    await tap(page, `[data-testid="card-${spot.unitId}"]`);
    await page.waitForTimeout(150);
    if (touch) await page.touchscreen.tap(spot.cx, spot.cy);
    else await page.mouse.click(spot.cx, spot.cy);
    return spot;
  }
  // OL_DEBUG=1: print both clients' lockstep state and main-thread freezes (slow machines)
  if (process.env.OL_DEBUG) {
    await Promise.all([A, B].map((p) => p.evaluate(() => {
      window.__gaps = [];
      let last = performance.now();
      setInterval(() => {
        const n = performance.now();
        if (n - last > 400) window.__gaps.push([Math.round(last), Math.round(n - last)]);
        last = n;
      }, 50);
      const ls = window.__battle.coop.lockstep;
      const orig = ls.dropPeer.bind(ls);
      ls.dropPeer = (peer, reason) => {
        window.__drop = { reason, at: Math.round(performance.now()), heard: Math.round(ls.now() - peer.lastHeard), timeout: ls.timeoutFor(peer), jitter: peer.jitter };
        orig(peer, reason);
      };
    })));
    for (let i = 0; i < 8; i++) {
      const st = await Promise.all([A, B].map((p) => p.evaluate(() => {
        const ls = window.__battle.coop.lockstep;
        return { gaps: window.__gaps.slice(-4), drop: window.__drop, tick: ls.tick, slot: ls.mySlot, stalled: ls.stalled, rp: ls.resyncPending, ds: ls.desynced, peers: [...ls.peers.values()].map((q) => ({ h: q.horizon, gone: q.gone })), towers: window.__battle.sim.towers.length, pend: [...ls.pending.keys()], hashes: ls.hashPairs(), state: window.__battle.sim.state, speed: ls.coop.speed, ended: window.__battle.ui.ended };
      })));
      console.log('    dbg', JSON.stringify(st));
      await A.waitForTimeout(500);
    }
  }
  const sa = await placeOne(A);
  const sb = await placeOne(B, sa ? [[sa.x, sa.y]] : []);
  check(!!sa && !!sb, `co-op: both players picked a card and a spot (${sa?.unitId}, ${sb?.unitId})`);
  if (process.env.OL_DEBUG) {
    for (let i = 0; i < 8; i++) {
      const st = await Promise.all([A, B].map((p) => p.evaluate(() => {
        const ls = window.__battle.coop.lockstep;
        return { gaps: window.__gaps.slice(-4), drop: window.__drop, tick: ls.tick, stalled: ls.stalled, rp: ls.resyncPending, ds: ls.desynced, peers: [...ls.peers.values()].map((q) => ({ h: q.horizon, gone: q.gone })), towers: window.__battle.sim.towers.length, pend: [...ls.pending.keys()], log: ls.log.length, hashes: ls.hashPairs() };
      })));
      console.log('    dbg2', JSON.stringify(st));
      await A.waitForTimeout(500);
    }
  }
  const bothPlaced = async (p) => p.waitForFunction(() => window.__battle.sim.towers.length >= 2, null, { timeout: 45000 }).then(() => true).catch(() => false);
  check(await bothPlaced(A) && await bothPlaced(B), 'co-op: both girls stand on both screens');
  const owners = await A.evaluate(() => window.__battle.sim.towers.map((t) => window.__battle.coop.ownerOf(t.uid)).sort());
  check(JSON.stringify(owners) === '[0,1]', `co-op: one girl per player (owners ${JSON.stringify(owners)})`);
  await A.evaluate(() => window.__battle.ui.startWave());
  // run until both clients compared at least 3 hash checkpoints (120 ticks each)
  const synced = await A.waitForFunction(() => window.__battle.coop.hashes.filter((p) => p.t >= 360).length >= 1, null, { timeout: 90000 }).then(() => true).catch(() => false);
  check(synced, 'co-op: hash checkpoints exchanged during the wave');
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

  // the guest leaves: the host keeps playing
  await go(B, '#/lobby');
  const left = await A.waitForFunction(() => window.__battle.coop.lockstep.livePeers().length === 0, null, { timeout: 10000 }).then(() => true).catch(() => false);
  check(left, 'co-op: when the guest leaves, the host continues solo');
  const t0 = await A.evaluate(() => window.__battle.coop.tick);
  const ticking = await A.waitForFunction((t) => window.__battle.coop.tick > t + 30 && !window.__battle.coop.lockstep.stalled, t0, { timeout: 20000 }).then(() => true).catch(() => false);
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
