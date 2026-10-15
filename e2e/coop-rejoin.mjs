// End-to-end test of the long-run netcode (spec §12, M5 + M6) with the LOCAL adapter (one browser,
// two pages = two players, BroadcastChannel; nothing touches Supabase):
//   1. A Freeplay Blossom room on 1-1 (goal 12), both pages play it past the goal (the clock pumped on
//      both pages; girls placed through the battle's own command path), so the host has a freeplay
//      wave-end checkpoint. Then both run at the game's own pace (3×, the frame loop only).
//   2. The guest's link is cut (its lockstep sends and hears nothing) until the host drops it;
//      both play on alone for a moment; the link comes back: the host re-admits the guest, whose
//      battle rebuilds from the host's newest checkpoint as a background job — the "Rejoining…"
//      card shows, the host's chip says the guest is re-syncing, the guest's page keeps getting
//      frames (the longest main-thread block is measured), and afterwards every state hash both
//      pages compute agrees.
//   3. A resync (the guest flags a hash mismatch, the way the hash check does): the host answers
//      with its checkpoint, the guest rebuilds from it, the hashes agree again.
//   4. For comparison, on the guest's page: what replaying the same run from tick 0 in one go (the
//      old rebuild) blocks the page for.
//
//   node e2e/coop-rejoin.mjs [--shots <dir>]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when
// a check fails.
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
const STAGE = '1-1';
const GOAL = 12;
const PAST = Number(opt('past', 3)); // freeplay waves cleared before the cut
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
const base = `http://127.0.0.1:${port}/?online=local&onboarding=0`;
const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const context = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
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
async function shot(page, name) {
  if (!shotsDir) return;
  await page.screenshot({ path: `${shotsDir}/${name}.png`, timeout: 90000 }).catch((e) => log(`    (screenshot ${name}: ${String(e.message).split('\n')[0]})`));
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
const waitFor = (page, fn, arg, ms = 600000, polling = 250) => page.waitForFunction(fn, arg, { timeout: ms, polling }).then(() => true).catch(() => false);
/**
 * Pump the lockstep clock faster on this page (the frame loop's own call, more often) — only to get
 * past the goal quickly; the cut and the rejoin run at the game's own pace (3×, the frame loop).
 */
const pump = (page, on) => page.evaluate((run) => {
  clearInterval(window.__fpPump);
  window.__fpPump = 0;
  if (!run) return;
  window.__fpPump = setInterval(() => {
    const ls = window.__battle?.coop?.lockstep;
    if (!ls || ls.finished || ls.job) return;
    ls.advance(0.05);
  }, 8);
}, on);
/** A player on this page: her own girls on spots near the road as her coins allow, then upgrades (ui.act). */
const startBot = (page) => page.evaluate(async () => {
  const { createCoopSim } = await import('/src/online/coop/commands.js');
  const ls = window.__battle.coop.lockstep;
  const me = ls.start.players.find((p) => p.slot === ls.mySlot);
  const units = [...(me.hero ? [me.hero.unitId] : []), ...me.loadout.map((e) => e.unitId)];
  const plan = createCoopSim(ls.start).sim;
  const cands = [];
  for (let y = 0.55; y < plan.map.height; y += 0.35) {
    for (let x = 0.55; x < plan.map.width; x += 0.35) if (!plan.placementReason('kage', x, y)) cands.push([x, y, plan.placement.pathDistance(x, y)]);
  }
  cands.sort((p, q) => p[2] - q[2] || p[1] - q[1] || p[0] - q[0]);
  const spots = [];
  for (const [x, y] of cands) {
    if (spots.length >= 40) break;
    if (!spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 1.4)) spots.push([x, y]);
  }
  const mine = spots.filter((_, i) => i % 2 === ls.mySlot);
  let next = 0;
  let u = 0;
  clearInterval(window.__fpBot);
  window.__fpBot = setInterval(() => {
    const { sim, ui, coop } = window.__battle || {};
    const L = coop?.lockstep;
    if (!sim || !ui?.act || !L || L.job || sim.state === 'won' || sim.state === 'lost') return;
    if (next < mine.length && sim.towers.filter((t) => L.coop.ownerOf(t.uid) === L.mySlot).length < 14) {
      const id = units[u % units.length];
      const [x, y] = mine[next];
      if (sim.data.unit(id)?.kind === 'hero' && sim.towers.some((t) => t.isHero)) u++;
      else if (sim.canPlace(id, x, y).ok) {
        ui.act.place(id, x, y);
        next++;
        u++;
        return;
      } else if (sim.placementReason(id, x, y)) {
        next++;
        return;
      }
    }
    for (const t of sim.towers) {
      if (L.coop.ownerOf(t.uid) !== L.mySlot) continue;
      for (const [path, upto] of [[0, 4], [1, 2]]) {
        if (t.tiers[path] < upto && !sim.upgradeStatus(t.uid, path).locked) {
          ui.act.upgrade(t.uid, path);
          return;
        }
      }
    }
  }, 250);
});
const state = (page) => page.evaluate(() => {
  const b = window.__battle;
  const ls = b?.coop?.lockstep;
  if (!b?.sim || !ls) return null;
  return { wave: b.sim.wave, cleared: b.sim.wavesCleared, state: b.sim.state, tick: ls.tick, towers: b.sim.towers.length, ck: ls.ck ? { t: ls.ck.t, wave: ls.ck.wave } : null, job: !!ls.job, peers: [...ls.peers.values()].map((q) => ({ gone: q.gone, why: q.why })), rejoins: ls.rejoins, resyncs: ls.resyncs, desynced: ls.desynced };
}).catch(() => null);
/** Every hash both pages computed after tick t agrees (and there are some). */
async function agreeAfter(A, B, t, what) {
  const pairs = await Promise.all([A, B].map((p) => p.evaluate((t0) => window.__battle.coop.hashes.filter((q) => q.t > t0), t)));
  const all = pairs.flat();
  const bad = all.filter((q) => q.mine !== q.theirs);
  return check(all.length > 0 && !bad.length, `${what}: the state hashes of both pages agree (${all.length} compared after tick ${t}${bad.length ? `, ${bad.length} differ` : ''})`);
}
/** On the page: the longest gap between 16 ms timer callbacks while `cond` holds (main-thread blocking). */
const watchGaps = (page) => page.evaluate(() => {
  clearInterval(window.__gapTimer);
  window.__gaps = { max: 0, n: 0, jobMax: 0, jobN: 0, overlay: false, overlayText: '' };
  let last = performance.now();
  window.__gapTimer = setInterval(() => {
    const t = performance.now();
    const gap = t - last;
    last = t;
    const g = window.__gaps;
    g.max = Math.max(g.max, gap);
    g.n++;
    const ls = window.__battle?.coop?.lockstep;
    if (ls?.job) {
      g.jobMax = Math.max(g.jobMax, gap);
      g.jobN++;
      const card = document.querySelector('[data-testid="coop-sync"]');
      if (card && !card.hidden) {
        g.overlay = true;
        g.overlayText = card.innerText.replace(/\s+/g, ' ').trim();
      }
    }
  }, 16);
});

/** Both pages' lockstep traces, events and long tasks (a failed check explains itself). */
async function dump(when) {
  for (const [n, p] of [['A', A], ['B', B]]) {
    const d = await p.evaluate(() => {
      const ls = window.__coop?.lockstep;
      return {
        tick: ls?.tick, ep: ls?.epoch, job: ls?.rebuilding, running: ls?.running, rejoins: ls?.rejoins, resyncs: ls?.resyncs, last: ls?.lastRebuild,
        peers: ls ? [...ls.peers.values()].map((q) => ({ gone: q.gone, why: q.why, ready: q.ready, busy: q.busy, offer: q.offer, horizon: q.horizon, silent: Math.round(ls.now() - q.lastHeard) })) : null,
        trace: (ls?.trace || []).map((e) => `${e.ev}@${e.tick}/${e.at}${e.reason ? `:${e.reason}` : ''}${e.kind ? `:${e.kind}` : ''}${e.ck != null ? ` ck${e.ck}` : ''}`).join(' '),
        events: window.__events, long: (window.__long || []).filter((x) => x.ms > 300).slice(-20), now: Math.round(performance.now()), mounted: window.__battle?.coop?.lockstep === ls,
      };
    }).catch((e) => ({ error: e.message }));
    log(`    [${when}] ${n}: ${JSON.stringify(d)}`);
  }
}

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
  B = await openPage('B');
  await B.goto(`${base}#/chat`, { waitUntil: 'load' });
  await setName(B, 'Bea');

  // ---- 1. a Freeplay Blossom room, played past the goal ---------------------------------------
  await go(A, '#/coop');
  await A.waitForSelector('[data-testid="coop-change-stage"]', { timeout: 30000 });
  await tap(A, '[data-testid="coop-change-stage"]');
  await A.waitForSelector('.ol-pick', { timeout: 15000 });
  await tap(A, `.ol-pick [data-stage="${STAGE}"]`);
  await tap(A, '.ol-pick .ol-seg-btn:text-is("Easy")');
  await tap(A, `[data-testid="coop-freeplay"] [data-tier="${TIER}"]`);
  await tap(A, '[data-testid="coop-stage-ok"]');
  await A.waitForSelector('.ol-pick', { state: 'detached', timeout: 15000 }).catch(() => null);
  await tap(A, '[data-testid="coop-create"]');
  await A.waitForSelector('[data-testid="coop-room-code"]', { timeout: 20000 });
  const code = (await A.locator('[data-testid="coop-room-code"]').innerText()).trim();
  await go(B, '#/coop');
  await B.waitForSelector('[data-testid="coop-code"]', { timeout: 30000 });
  await B.fill('[data-testid="coop-code"]', code);
  await tap(B, '[data-testid="coop-join"]');
  check(await waitFor(B, () => window.__coop?.paired && window.__coop?.freeplay === 'blossom', null, 60000), `room ${code}: the guest joins the Freeplay Blossom room`);
  await tap(B, '[data-testid="coop-ready"]');
  check(await waitFor(A, () => !document.querySelector('[data-testid="coop-start"]')?.disabled, null, 30000), 'room: Start unlocks');
  await tap(A, '[data-testid="coop-start"]');
  const inBattle = (p) => waitFor(p, () => {
    const ls = window.__battle?.coop?.lockstep;
    return !!(ls && window.__battle.ui?.act && ls.running && ls.tick > 0 && ls.livePeers().length === 1);
  }, null, 240000);
  check((await Promise.all([inBattle(A), inBattle(B)])).every(Boolean), 'battle: the freeplay battle runs on both pages');
  await Promise.all([startBot(A), startBot(B)]);
  await A.evaluate(() => {
    const { ui, coop } = window.__battle;
    coop.lockstep.queue('speed', [3]);
    ui.setAutoStart(true);
    ui.startWave();
  });
  await Promise.all([pump(A, true), pump(B, true)]);
  const target = GOAL + PAST;
  const reached = await Promise.all([A, B].map((p) => waitFor(p, (n) => {
    const s = window.__battle?.sim;
    const ls = window.__battle?.coop?.lockstep;
    return !!s && ((s.wavesCleared >= n && (!ls.isHost || (ls.ck && ls.ck.wave >= n))) || s.state === 'lost');
  }, target, 1500000, 500)));
  const s1 = await Promise.all([state(A), state(B)]);
  log(`    past the goal: ${JSON.stringify(s1.map((s) => ({ wave: s?.wave, cleared: s?.cleared, tick: s?.tick, towers: s?.towers, ck: s?.ck })))} (${Math.round((Date.now() - t0) / 1000)} s)`);
  check(reached.every(Boolean) && s1.every((s) => s && s.state !== 'lost' && s.cleared >= target), `both pages cleared wave ${target} (${PAST} freeplay waves past ${GOAL}/${GOAL})`);
  // from here the game's own pace (3×, the frame loop only)
  await Promise.all([pump(A, false), pump(B, false)]);
  // together (a page starved for a while may have been dropped and re-admitted on the way)
  const together = await Promise.all([A, B].map((p) => waitFor(p, () => {
    const ls = window.__coop?.lockstep;
    return !!ls && !ls.job && ls.livePeers().length === 1 && ls.running && window.__battle?.coop?.lockstep === ls;
  }, null, 300000)));
  check(together.every(Boolean), 'before the cut both pages play together');
  const preTick = await A.evaluate(() => window.__battle.coop.lockstep.tick);
  await A.waitForTimeout(6000);
  await agreeAfter(A, B, preTick - 600, 'before the cut');
  check(!!s1[0]?.ck && s1[0].ck.wave > GOAL && s1[1]?.ck === null, `the host keeps a freeplay wave-end checkpoint (wave ${s1[0]?.ck?.wave}, tick ${s1[0]?.ck?.t}); the guest keeps none`);
  await shot(A, 'rejoin-01-before-cut-host');

  // ---- 2. the guest's link is cut until the host drops it; the link is back: the rejoin -----------
  await Promise.all([A, B].map((p) => p.evaluate(() => {
    window.__long = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__long.push({ at: Math.round(e.startTime), ms: Math.round(e.duration), job: !!window.__coop?.lockstep?.job });
      }).observe({ type: 'longtask', buffered: false });
    } catch { /* no long-task timing in this browser */ }
    window.__events = [];
    const s = window.__coop;
    for (const ev of ['resync', 'peerGone', 'peerBack']) s.on(ev, (x) => window.__events.push({ ev, x: x ?? null, at: Math.round(performance.now()), tick: s.lockstep?.tick }));
  })));
  await B.evaluate(() => {
    const ls = window.__coop.lockstep;
    window.__cut = ls.sendRaw;
    ls.sendRaw = () => {};
    ls.receive = () => {};
  });
  const dropped = await waitFor(A, () => window.__battle.coop.lockstep.peers.get(1)?.gone, null, 90000);
  check(dropped, 'the guest cut off longer than the timeout is dropped; the host plays on alone');
  // both play on apart for a few seconds of game (the guest learns of the drop on its own timeout)
  await waitFor(B, () => window.__battle.coop.lockstep.peers.get(0)?.gone, null, 90000);
  await A.waitForTimeout(3000);
  await watchGaps(B);
  const busySeen = A.evaluate(() => new Promise((resolve) => {
    const seen = { busy: null, text: '' };
    const id = setInterval(() => {
      const p = window.__battle?.coop?.lockstep?.peers.get(1);
      if (p?.busy) {
        seen.busy = { at: p.busy.at, of: p.busy.of };
        seen.text = document.querySelector('[data-testid="coop-state"]')?.innerText || seen.text;
      }
      if (seen.busy && p && !p.busy) {
        clearInterval(id);
        resolve(seen);
      }
    }, 20);
    setTimeout(() => {
      clearInterval(id);
      resolve(seen);
    }, 240000);
  }));
  const healAt = await A.evaluate(() => window.__battle.coop.lockstep.tick);
  await B.evaluate(() => {
    const ls = window.__coop.lockstep;
    ls.sendRaw = window.__cut;
    delete ls.receive;
  });
  const back = await Promise.all([A, B].map((p) => waitFor(p, () => {
    const ls = window.__coop?.lockstep;
    return ls && ls.rejoins >= 1 && !ls.job && [...ls.peers.values()].every((q) => !q.gone) && window.__battle?.coop?.lockstep === ls && ls.running;
  }, null, 400000)));
  if (!check(back.every(Boolean), 'the link is back: the host re-admits the guest and both play together again')) await dump('after the rejoin');
  const rb = await B.evaluate(() => ({ r: window.__coop.lockstep.lastRebuild, trace: window.__coop.lockstep.trace.filter((e) => /adopt|rebuild|rejoin/.test(e.ev)).map((e) => `${e.ev}@${e.tick}${e.ck != null ? ` ck ${e.ck}` : ''}`).join(' '), gaps: window.__gaps }));
  log(`    guest rebuild: ${JSON.stringify(rb.r)} · ${rb.trace}`);
  log(`    guest main thread while rebuilding: longest gap ${Math.round(rb.gaps.jobMax)} ms over ${rb.gaps.jobN} timer ticks; card "${rb.gaps.overlayText}"`);
  check(rb.r?.kind === 'rejoin' && rb.r.restored && rb.r.from > 0, `the guest rebuilt from the host's checkpoint (tick ${rb.r?.from}), replaying ${rb.r?.ticks} ticks, not the whole run (${rb.r?.T})`);
  check(rb.r && rb.r.ticks < rb.r.T / 2, 'only the ticks since the checkpoint were replayed');
  const host = await busySeen;
  check(!!host.busy, `the host heard the guest rebuilding (busy ${JSON.stringify(host.busy)}; chip "${host.text}")`);
  check(rb.gaps.jobN === 0 || rb.gaps.overlay, `the guest saw the re-sync card while rebuilding ("${rb.gaps.overlayText}")`);
  check(rb.gaps.jobN === 0 || rb.gaps.jobMax < 600, `the guest's page kept getting time while rebuilding (longest main-thread gap ${Math.round(rb.gaps.jobMax)} ms)`);
  await shot(B, 'rejoin-02-after-guest');
  // play on together for a while, then compare
  await A.waitForTimeout(15000);
  const afterTick = await A.evaluate(() => window.__battle.coop.lockstep.tick);
  await A.waitForTimeout(8000);
  await agreeAfter(A, B, Math.max(healAt, afterTick - 1200), 'after the rejoin');

  // ---- 3. a resync: the guest flags a mismatch, the host answers with its checkpoint -------------
  await watchGaps(B);
  await B.evaluate(() => window.__coop.lockstep.flagMismatch());
  const resynced = await waitFor(B, () => {
    const ls = window.__coop?.lockstep;
    return ls && ls.resyncs >= 1 && !ls.job && window.__battle?.coop?.lockstep === ls && ls.running;
  }, null, 240000);
  const rs = await B.evaluate(() => ({ r: window.__coop.lockstep.lastRebuild, gaps: window.__gaps }));
  log(`    guest resync: ${JSON.stringify(rs.r)} · longest gap ${Math.round(rs.gaps.jobMax)} ms`);
  if (!check(resynced && rs.r?.kind === 'resync' && rs.r.restored, `a resync restores the host's checkpoint (tick ${rs.r?.from}) and replays ${rs.r?.ticks} ticks`)) await dump('after the resync');
  await A.waitForTimeout(12000);
  const t2 = await A.evaluate(() => window.__battle.coop.lockstep.tick);
  await A.waitForTimeout(8000);
  await agreeAfter(A, B, t2 - 1200, 'after the resync');
  const desync = await Promise.all([state(A), state(B)]);
  check(desync.every((s) => s && !s.desynced && s.peers.every((q) => !q.gone)), 'nobody gave up on the other (no fatal desync, nobody dropped)');

  // ---- 4. the old way on the same run, for comparison (in the guest's page) ----------------------
  const old = await B.evaluate(async () => {
    const { Lockstep } = await import('/src/online/coop/lockstep.js');
    const ls = window.__coop.lockstep;
    const c = new Lockstep({ start: ls.start, mySlot: 1, send: () => {}, now: () => 0 });
    const t = performance.now();
    c.rebuild(ls.start, ls.log, ls.tick);
    return { ticks: ls.tick, ms: Math.round(performance.now() - t) };
  });
  log(`    the old way (replay from tick 0 in one go) at tick ${old.ticks}: the page blocked for ${old.ms} ms`);

  // ---- 5. how the card looks (a real rebuild is over in a blink here): progress shown as it would be
  // at wave 87 of a 150-wave run, on the guest at three sizes, and the host's chip ---------------------
  if (shotsDir) {
    await B.evaluate(() => {
      const ls = window.__coop.lockstep;
      Object.defineProperty(ls, 'rebuilding', { configurable: true, get: () => ({ kind: 'rejoin', done: 1840, total: 3200, wave: 149, target: 150 }) });
    });
    await A.evaluate(() => {
      const p = window.__coop.lockstep.peers.get(1);
      p.busy = { at: 1840, of: 3200, w: 149, t: window.__coop.lockstep.now() };
      p.keepBusy = setInterval(() => { p.busy = { at: 1840, of: 3200, w: 149, t: window.__coop.lockstep.now() }; }, 50);
    });
    for (const [w, hgt] of [[1280, 720], [844, 390], [390, 844]]) {
      await B.setViewportSize({ width: w, height: hgt });
      await B.waitForTimeout(1200);
      await shot(B, `rejoin-03-sync-card-${w}x${hgt}`);
    }
    await A.waitForTimeout(500);
    await shot(A, 'rejoin-04-host-chip');
    const card = await B.locator('[data-testid="coop-sync"]').innerText().catch(() => '');
    check(/Rejoining Aiko's battle/.test(card) && /Wave 149 of 150 · 57%/.test(card), `the card reads "${card.replace(/\s+/g, ' ')}"`);
    await B.evaluate(() => { delete window.__coop.lockstep.rebuilding; });
    await A.evaluate(() => {
      const p = window.__coop.lockstep.peers.get(1);
      clearInterval(p.keepBusy);
      p.busy = null;
    });
  }
} catch (e) {
  failures.push(`crashed: ${e.stack || e.message}`);
  log(`  FAIL crashed: ${e.stack || e.message}`);
  for (const [n, p] of [['A', A], ['B', B]]) if (p && shotsDir) await p.screenshot({ path: `${shotsDir}/rejoin-crash-${n}.png` }).catch(() => null);
}

check(!errors.length, `no page errors${errors.length ? `:\n    ${errors.slice(0, 12).join('\n    ')}` : ''}`);
log(`\n${failures.length ? `${failures.length} check(s) FAILED` : 'all checks ok'} (${Math.round((Date.now() - t0) / 1000)} s)`);
await browser.close().catch(() => null);
await server.close().catch(() => null);
process.exit(failures.length ? 1 : 0);
