// Tryout Day in a two-tab co-op room (local adapter; docs/specs/TRYOUT_DAY.md §11, M1):
//   the host turns Tryout Day on, both tabs pick 3 of their six and a hero, the host starts; both battles show the run
//   UI and built the same run, each tab's bar its own squad. §20.7: the host's run panel has Half · Full · Extended Day
//   (the host's ladder: a Full Day cleared here) and the Random Class switch with its help line; the guest sees both
//   read-only. The host sets both, the run starts as an Extended Day in Random Class (each three drawn), and the
//   first pick's reveal shows on both screens and lands by itself, the same on both.
//   v0.1.61: no Home Time pill before wave 48; the Home Time vote past 48 (staged: see the step) on both tabs, who has
//   voted, and both votes ending the run as Home Time with each player's best wave on their photo.
// node e2e/tryout-coop.mjs [--viewport 1280x720] [--shots dir]
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
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const failures = [];
const log = (...a) => console.log(...a);
const check = (c, m) => {
  log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`);
  if (!c) failures.push(m);
  return c;
};
const T = { timeout: 30000 };
/** A screenshot (not a check): its tab comes to the front first; a frame that will not settle under load is logged. */
const snap = async (page, name, o = {}) => {
  if (!shotsDir) return;
  await page.bringToFront().catch(() => {});
  await page.screenshot({ path: `${shotsDir}/${name}-${W}x${H}.png`, timeout: 60000, ...o }).catch((e) => log(`  (shot ${name} skipped: ${e.message.split('\n')[0]})`));
};

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/?online=local&onboarding=0`;
// two tabs in one window: neither may be throttled as a background tab (the host would mark the guest gone)
const { browser, label } = await launchChromium({ args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
log(`browser: ${label}`);
const errors = [];
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'reduce' });

async function maybeName(page, name) {
  // (the name prompt can come late on a slow phone-size tab: wait for it or for the room, whichever shows first)
  await page.waitForFunction(() => document.querySelector('[data-testid="name-input"]') || window.__coop, null, { timeout: 30000 }).catch(() => {});
  const input = await page.$('[data-testid="name-input"]');
  if (!input) return;
  await page.fill('[data-testid="name-input"]', name);
  await page.click('[data-testid="name-save"]', T);
}
async function clearModal(page) {
  for (let i = 0; i < 3; i++) {
    if (!(await page.$('.modal-overlay'))) return;
    if (await page.$('[data-testid="beta-gift-later"]')) await page.click('[data-testid="beta-gift-later"]', { force: true });
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}
const watch = (p, n) => {
  p.on('pageerror', (e) => errors.push(`${n} pageerror ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebGL|GPU stall|favicon|Failed to load resource|GL_CLOSE/i.test(m.text())) errors.push(`${n} ${m.text()}`); });
};

const A = await ctx.newPage();
watch(A, 'host');
await A.goto(`${url}#/lobby`, { waitUntil: 'load' });
await A.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 60000 });
await A.evaluate(() => {
  const { store } = window.__sakura;
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '2-1', '2-2', '2-3', '2-4', '2-5']) store.profile.progress.stages[id] = { clears: 1, easy: true, normal: true, hard: false, nightmare: false };
  // (§20.7: the host has cleared a Full Day, so the host's ladder opens Extended Day; test-only counters)
  store.profile.missions = store.profile.missions || {};
  store.profile.missions.counters = { ...(store.profile.missions.counters || {}), 'ty:half': 1, 'ty:full': 1 };
  store.commit('replace');
  store.saveNow?.();
});
const code = 'TRY01';
await A.evaluate((c) => { location.hash = `#/coop/${c}?host=1&stage=1-1&difficulty=normal`; }, code);
await maybeName(A, 'Aiko');
await A.waitForSelector('[data-testid="coop-room-code"]', T);
const B = await ctx.newPage();
watch(B, 'guest');
await B.goto(`${url}#/coop/${code}`, { waitUntil: 'load' });
await maybeName(B, 'Bea');
const paired = await B.waitForFunction(() => window.__coop?.paired, null, { timeout: 90000 }).then(() => true).catch(() => false);
if (!paired) {
  const dump = async (p) => p.evaluate(() => ({ hash: location.hash, screen: document.querySelector('#app')?.dataset.screen, modal: document.querySelector('.modal-overlay')?.innerText?.slice(0, 120), coop: window.__coop ? { phase: window.__coop.phase, paired: window.__coop.paired, peer: !!window.__coop.peer } : null }));
  log('    host:', JSON.stringify(await dump(A)));
  log('    guest:', JSON.stringify(await dump(B)));
}
check(paired, 'the guest pairs with the host');
await clearModal(A);
await A.click('[data-testid="coop-tryout"] [data-tryout="on"]', T);
check(await B.waitForFunction(() => !!window.__coop?.tryout, null, T).then(() => true).catch(() => false), 'the guest sees the host\'s run');
for (const p of [A, B]) {
  await clearModal(p);
  await p.waitForSelector('[data-testid="coop-run-six"]', T);
  for (let i = 0; i < 3; i++) {
    await p.locator('[data-testid="coop-run-girl"]').nth(i).click(T);
    await p.waitForFunction((n) => document.querySelectorAll('[data-testid="coop-run-girl"][aria-pressed="true"]').length >= n, i + 1, T).catch(() => {});
  }
}
// M3: the run panel in the kit: girl tiles, the Grade segRow (a locked Grade says why), map and length options
const panel = await A.evaluate(() => {
  const run = document.querySelector('[data-testid="coop-run"]');
  return {
    tiles: run.querySelectorAll('[data-testid="coop-run-girl"].ui-girltile').length,
    picked: run.querySelectorAll('[data-testid="coop-run-girl"].ui-girltile.sel').length,
    grades: run.querySelectorAll('[data-testid="coop-run-grade"] > .ui-opt').length,
    locked: run.querySelectorAll('[data-testid="coop-run-grade"] > .ui-opt.locked').length,
    maps: run.querySelectorAll('[data-testid="coop-run-map"] .ty-map').length,
    lengths: run.querySelectorAll('[data-testid="coop-run-length"] > .ui-opt').length,
    heroes: run.querySelectorAll('[data-testid="coop-run-hero"] .ui-opt').length,
    scroll: document.documentElement.scrollWidth <= innerWidth + 1,
  };
});
check(panel.tiles === 6 && panel.picked === 3, `the host's six are girl tiles, three selected (${JSON.stringify(panel)})`);
check(panel.grades === 12 && panel.locked >= 1 && panel.maps === 2 && panel.lengths === 3 && panel.heroes >= 1, `Grades as a segRow, map and length as options (${JSON.stringify(panel)})`);
await A.click('[data-testid="coop-run-grade-12"]');
check(await A.waitForFunction(() => /Grade 12/.test([...document.querySelectorAll('.toast-host .toast')].map((t) => t.textContent).join(' ')), null, { timeout: 5000 }).then(() => true).catch(() => false)
  && await A.evaluate(() => window.__coop.tryout.grade === 1), 'a locked Grade tap says why and changes nothing');
check(panel.scroll, 'no horizontal scroll in the room');
const guestPanel = await B.evaluate(() => ({ tiles: document.querySelectorAll('[data-testid="coop-run-girl"].ui-girltile').length, grades: document.querySelectorAll('[data-testid="coop-run-grade"]').length, map: document.querySelectorAll('[data-testid="coop-run-map"] .ty-map').length }));
check(guestPanel.tiles === 6 && guestPanel.grades === 0 && guestPanel.map === 1, `the guest's panel: their six, the host's map, no Grade row (${JSON.stringify(guestPanel)})`);
// §20.7: the options in the host's panel (the host's ladder), read-only for the guest
const hostOpts = await A.evaluate(() => ({
  lengths: [...document.querySelectorAll('[data-testid="coop-run-length"] > .ui-opt')].map((e) => `${e.dataset.id}${e.classList.contains('locked') ? ':locked' : ''}`).join(),
  random: !!document.querySelector('[data-testid="coop-run-random"]'),
  help: document.querySelector('[data-testid="coop-run-random-help"]')?.textContent || '',
  ro: !!document.querySelector('[data-testid="coop-run-options"]'),
}));
check(hostOpts.lengths === 'half,full,after' && hostOpts.random && /striker/.test(hostOpts.help) && /Control or Support/.test(hostOpts.help) && !hostOpts.ro,
  `the host's panel: Half · Full · Extended Day open on the host's ladder, the Random Class switch and its help line (${JSON.stringify(hostOpts)})`);
const guestOpts = async () => B.evaluate(() => ({
  length: document.querySelector('[data-testid="coop-run-length-ro"]')?.dataset.length || null,
  random: document.querySelector('[data-testid="coop-run-random-ro"]')?.dataset.on || null,
  controls: document.querySelectorAll('[data-testid="coop-run-random"], [data-testid="coop-run-length"]').length,
}));
const g0 = await guestOpts();
check(g0.length === 'half' && g0.random === 'false' && g0.controls === 0, `the guest sees the run's length and Random Class read-only, no controls (${JSON.stringify(g0)})`);
// the round trip: the host sets Extended Day and Random Class; the guest sees both, read-only; the run starts with them
await A.click('[data-testid="coop-run-length-after"]', T);
await A.click('[data-testid="coop-run-random"]', T);
const kept = await A.waitForFunction(() => window.__coop.tryout?.length === 'after' && window.__coop.tryout?.random === true, null, T).then(() => true).catch(() => false);
check(kept && await A.evaluate(() => document.querySelector('[data-testid="coop-run-random"]')?.getAttribute('aria-pressed') === 'true'
  && document.querySelector('[data-testid="coop-run-length-after"]')?.getAttribute('aria-checked') === 'true'), 'the room keeps the host\'s Extended Day and Random Class');
const got = await B.waitForFunction(() => document.querySelector('[data-testid="coop-run-length-ro"]')?.dataset.length === 'after'
  && document.querySelector('[data-testid="coop-run-random-ro"]')?.dataset.on === 'true', null, T).then(() => true).catch(() => false);
check(got, 'the guest sees Extended Day and Random Class from the host, read-only');
check(await B.evaluate(() => document.querySelectorAll('.ty-coop-six.random [data-testid="coop-run-girl"][aria-disabled="true"]').length === 6
  && !document.querySelector('[data-testid="coop-run-redraw"]')), 'Random Class: the guest\'s six show, not pickable, no Redraw');
check(await A.evaluate(() => document.querySelectorAll('.ty-coop-six.random [data-testid="coop-run-girl"][aria-disabled="true"]').length === 6), 'Random Class: the host\'s six show, not pickable');
await snap(A, 'tycoop-room-host-random', { fullPage: true });
await snap(B, 'tycoop-room-guest-random', { fullPage: true });
await clearModal(B);
await B.click('[data-testid="coop-ready"]', T);
check(await A.waitForFunction(() => window.__coop?.canStart, null, T).then(() => true).catch(() => false), 'the host can start once the guest is ready (Random Class: no drafts needed)');
await A.click('[data-testid="coop-start"]', T);
const ready = (p) => p.waitForFunction(() => window.__battle?.ui?.tryoutUi && !document.documentElement.dataset.tx, null, { timeout: 240000, polling: 250 }).then(() => true).catch(() => false);
const [ra, rb] = await Promise.all([ready(A), ready(B)]);
check(ra && rb, 'both battles mount with the run UI');

// both clients built the same run: an Extended Day in Random Class, each player's three drawn by the Sim
const runs = await Promise.all([A, B].map((p) => p.evaluate(() => {
  const ty = window.__battle.sim.tryout;
  return { seed: ty.seed, map: ty.mapId, length: ty.length, random: ty.random === true, squads: ty.players.map((x) => x.squad.join(',')), seats: JSON.stringify(ty.seats.blocks[0]) };
})));
check(JSON.stringify(runs[0]) === JSON.stringify(runs[1]), `both clients built the same run (${runs[0].map} · ${JSON.stringify(runs[0].squads)})`);
check(runs[0].length === 'after' && runs[0].random, `the run is an Extended Day in Random Class (${runs[0].length}, random ${runs[0].random})`);
check(runs[0].squads.every((q) => q.split(',').length === 3), 'each player starts with their 3 drawn girls');
const ui = await Promise.all([A, B].map((p) => p.evaluate(() => !!document.querySelector('[data-testid="ty-tracker"]') && !!document.querySelector('[data-testid="ty-chip-a_hearts"]'))));
check(ui.every(Boolean), 'both trackers show Full Hearts');
const mine = await Promise.all([A, B].map((p) => p.evaluate(() => [...window.__battle.sim.loadout.keys()].join(','))));
check(mine[0] === runs[0].squads[0] && mine[1] === runs[0].squads[1], 'each tab\'s bar holds its own squad');

// to the first pick: each player places her hero and girls (ui.act, the tower bar's commands), the host sets 3× and
// Auto, and the lockstep is pumped (as e2e/coop-freeplay.mjs does) until the pick opens; then the game runs at its
// own pace so the reveal shows on both screens and lands by itself, on the same card on both
for (const p of [A, B]) {
  await p.evaluate(() => {
    window.__sawReveal = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="ty-reveal"]') && !document.querySelector('[data-testid="ty-pick"]')?.hidden) window.__sawReveal = true;
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  });
}
const placeAll = (p) => p.evaluate(() => {
  const { sim, ui, coop } = window.__battle;
  const slot = coop.lockstep.mySlot;
  const ids = [sim.heroConfigs?.[slot]?.unitId, ...sim.tryout.players[slot].squad].filter(Boolean);
  const spots = [];
  for (let y = 0.55; y < sim.map.height; y += 0.35) for (let x = 0.55; x < sim.map.width; x += 0.35) if (!sim.placementReason('kage', x, y)) spots.push([x, y, sim.placement.pathDistance(x, y)]);
  spots.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  const mineSpots = spots.filter((_, i) => i % 2 === slot);
  let k = 0;
  for (const id of ids) {
    for (; k < mineSpots.length; k++) {
      const [x, y] = mineSpots[k];
      if (sim.canPlace(id, x, y).ok) { ui.act.place(id, x, y); k += 3; break; }
    }
  }
  return ids.length;
});
await Promise.all([placeAll(A), placeAll(B)]);
const pump = (page, on, host = false) => page.evaluate(([run, isHost]) => {
  clearInterval(window.__tyPump);
  window.__tyPump = 0;
  if (!run) return;
  window.__tyPump = setInterval(() => {
    const ls = window.__battle?.coop?.lockstep;
    if (!ls || ls.finished) return;
    // (the host sets 1× again once wave 4 runs: the reveal after it is a 2 s show at the game's own pace)
    if (isHost && !window.__slowed && window.__battle.sim.wave >= 4) {
      window.__slowed = true;
      ls.queue('speed', [1]);
    }
    // (stop pumping once a pick is open: the reveal then runs at the game's own pace)
    if (window.__battle.sim.tryoutWindowOpen()) return;
    for (let i = 0; i < 3; i++) ls.advance(0.05);
  }, 4);
}, [on, host]);
await A.evaluate(() => {
  const { ui, coop } = window.__battle;
  coop.lockstep.queue('speed', [3]);
  ui.setAutoStart?.(true);
  ui.startWave();
});
await Promise.all([pump(A, true, true), pump(B, true)]);
const pickOpen = (p) => p.waitForFunction(() => window.__battle?.sim?.tryout?.players.some((x) => x.win === 'pick'), null, { timeout: 600000, polling: 200 }).then(() => true).catch(() => false);
const [oa, ob] = await Promise.all([pickOpen(A), pickOpen(B)]);
check(oa && ob, `the first pick opens on both (wave ${await A.evaluate(() => window.__battle.sim.wave)})`);
const landed = (p) => p.waitForFunction(() => window.__battle.sim.tryout.players.every((x) => x.picks.length >= 1 && x.win !== 'pick'), null, { timeout: 120000, polling: 200 }).then(() => true).catch(() => false);
const [la, lb] = await Promise.all([landed(A), landed(B)]);
await Promise.all([pump(A, false), pump(B, false)]);
const seen = await Promise.all([A, B].map((p) => p.evaluate(() => window.__sawReveal)));
check(seen.every(Boolean), `the Random Class reveal shows on both screens (${seen})`);
check(la && lb, 'both picks land by themselves (no tap)');
const picks = await Promise.all([A, B].map((p) => p.evaluate(() => JSON.stringify(window.__battle.sim.tryout.players.map((x) => x.picks.map((k) => k.girl || k.card || k.varsity))))));
check(picks[0] === picks[1], `both clients drew the same picks (${picks[0]})`);
await snap(B, 'tycoop-battle-guest');

// (Oct 30) the Pep Talks taken, in co-op: the tracker's button opens the list with Yours / Partner; the partner's tab
// shows their cards; Escape closes it. Display only: nothing goes to the lockstep
const coopPeps = await A.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const { sim, coop } = window.__battle;
  const slot = coop.lockstep.mySlot;
  const rows = (i) => new Set(sim.tryout.players[i].cards.map((c) => `${c.id}|${c.unit || ''}`)).size;
  document.querySelector('[data-testid="ty-peps-open"]')?.click();
  await wait(100);
  const box = () => document.querySelector('[data-testid="ty-peps-sheet"]');
  const out = { open: !!box(), tabs: box()?.querySelectorAll('.ty-peps-tabs > .ui-opt').length || 0, mine: box()?.querySelectorAll('.ty-pep').length ?? -1, wantMine: rows(slot) };
  document.querySelector('[data-testid="ty-peps-tab-partner"]')?.click();
  await wait(100);
  out.partner = box()?.querySelectorAll('.ty-pep').length ?? -1;
  out.wantPartner = rows(1 - slot);
  out.partnerOn = document.querySelector('[data-testid="ty-peps-tab-partner"]')?.getAttribute('aria-checked') === 'true';
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(100);
  out.closed = !box();
  return out;
});
check(coopPeps.open && coopPeps.tabs === 2 && coopPeps.mine === coopPeps.wantMine, `co-op: the Pep Talks list opens with Yours / Partner (${JSON.stringify(coopPeps)})`);
check(coopPeps.partnerOn && coopPeps.partner === coopPeps.wantPartner && coopPeps.closed, 'co-op: the Partner tab lists the partner\'s Pep Talks; Escape closes it');

// v0.1.61: the Home Time vote (§20.1, Q-A6). Before wave 48 neither tab shows the pill (nor freeplay's Finish). Playing
// a browser co-op run to wave 48 for real is out of this test's reach, so the vote past 48 is STAGED: Auto off, both
// locksteps held still at a calm point, both Sims given the same "48 waves cleared" state, and the same 'end' commands
// applied to both CoopSims (what the lockstep would deliver). The pills, the HUD flag, the ally's line and the end
// (checkEndVotes → sim.finish(): Home Time on both, each paid once) are the real code.
const noPill = await Promise.all([A, B].map((p) => p.evaluate(() => ({
  home: !!document.querySelector('[data-testid="home-time"]:not([hidden])'),
  finish: !!document.querySelector('[data-testid="finish-here"]:not([hidden])'),
  wave: window.__battle.sim.wavesCleared,
}))));
check(noPill.every((x) => !x.home && !x.finish && x.wave < 48), `no Home Time or Finish pill before wave 48 on either tab (${JSON.stringify(noPill)})`);
await A.evaluate(() => window.__battle.ui.setAutoStart?.(false));
// (both tabs keep stepping meanwhile: a background tab draws no frames, so the lockstep is pumped from a timer)
for (const p of [A, B]) {
  await p.evaluate(() => {
    clearInterval(window.__tyPump);
    window.__tyPump = setInterval(() => {
      const ls = window.__battle?.coop?.lockstep;
      if (ls && !ls.finished) ls.advance(0.05);
    }, 8);
  });
}
const calmBoth = await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__battle.sim.state === 'between' && !window.__battle.sim.tryoutWindowOpen() && window.__battle.sim.options.autoStart === false, null, { timeout: 120000, polling: 100 }).then(() => true).catch(() => false)));
check(calmBoth.every(Boolean), 'both tabs reach a calm point with Auto off');
for (const p of [A, B]) await p.evaluate(() => clearInterval(window.__tyPump));
// (a tab in the background draws no frames: each read brings its tab to the front first; a girl or the hero still
// being placed is cancelled, so the placement hint does not cover the wave control)
const front = async (p) => {
  await p.bringToFront().catch(() => {});
  await p.waitForTimeout(350);
};
for (const p of [A, B]) {
  await front(p);
  if (await p.locator('[data-testid="place-cancel"]').isVisible().catch(() => false)) await p.click('[data-testid="place-cancel"]').catch(() => {});
}
await Promise.all([A, B].map((p) => p.evaluate(() => {
  const { sim, coop } = window.__battle;
  coop.lockstep.advance = () => 0; // (held still: no tick runs on either tab from here)
  sim.wavesCleared = 48;
  sim.wave = 48;
  sim.state = 'between';
  for (const pl of sim.tryout.players) pl.win = null;
})));
const applyBoth = (slot, v) => Promise.all([A, B].map((p) => p.evaluate(([s, val]) => {
  const ls = window.__battle.coop.lockstep;
  return ls.coop.apply({ t: ls.tick, p: s, s: 900 + (val ? 1 : 0), k: 'end', a: [val] }).ok;
}, [slot, v])));
const pillOf = async (p) => {
  await front(p);
  return p.waitForFunction(() => document.querySelector('[data-testid="home-time"]:not([hidden])')?.textContent || '', null, { timeout: 10000, polling: 100 })
    .then((h) => h.jsonValue()).catch(() => '');
};
const p0 = [await pillOf(A), await pillOf(B)];
check(p0.every((t) => /^Home Time\? Vote$/.test(t)), `past wave 48 both tabs show the Home Time vote pill (${JSON.stringify(p0)})`);
check((await applyBoth(0, true)).every(Boolean), 'the host\'s Home Time vote lands on both clients (the Finish command past 48)');
const read1 = async (p, want) => {
  await front(p);
  // (the first frames after a tab comes to the front can be slow under software WebGL: wait for the pill's words)
  await p.waitForFunction((w) => new RegExp(w).test(document.querySelector('[data-testid="home-time"]')?.textContent || ''), want, { timeout: 20000, polling: 100 }).catch(() => {});
  return p.evaluate(() => ({
    pill: document.querySelector('[data-testid="home-time"]')?.textContent || '',
    on: document.querySelector('[data-testid="home-time"]')?.classList.contains('on'),
    flag0: !document.querySelector('[data-testid="coop-vote-0"]')?.hidden,
    flag1: !document.querySelector('[data-testid="coop-vote-1"]')?.hidden,
    state: window.__battle.sim.state,
  }));
};
const p1 = [await read1(A, '^Home Time ✓'), await read1(B, 'votes Home Time')];
// (a narrow screen, 480 px or less, has the shorter words: "Home Time ✓ · waiting", "Aiko votes Home Time")
check(/^Home Time ✓ · waiting( for Bea)?$/.test(p1[0].pill) && p1[0].on && /^Aiko votes Home Time( · tap to agree)?$/.test(p1[1].pill) && !p1[1].on,
  `the pills say who has voted: the host waits for Bea, the guest is asked to agree (${JSON.stringify(p1.map((x) => x.pill))})`);
check(p1.every((x) => x.flag0 && !x.flag1 && x.state === 'between'), `the HUD flags the host's vote on both tabs; the run goes on until both vote (${JSON.stringify(p1)})`);
await snap(A, 'tycoop-home-vote-host');
await snap(B, 'tycoop-home-vote-guest');
// a long ally name (16 characters, the most a name may have) ellipsizes alone: the pill stays one line and in view
await front(B);
const longName = await B.evaluate(async () => {
  const s = window.__battle.coop.session;
  const was = s.player.bind(s);
  s.player = (i) => (i === 0 ? { ...(was(0) || {}), name: 'Aikoaikoaikoaiko' } : was(i));
  await new Promise((r) => setTimeout(r, 600));
  const el = document.querySelector('[data-testid="home-time"]');
  const r = el?.getBoundingClientRect();
  const nm = el?.querySelector('.bt-home-name');
  const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.3;
  // (every part inside the pill: nothing spills past its edge)
  const fits = !!r && [...el.children].every((c) => c.getBoundingClientRect().right <= r.right + 1);
  return { fits, text: el?.textContent, oneLine: !!r && r.height < 2 * lh, inView: !!r && r.left >= 0 && r.right <= innerWidth + 1, cut: !!nm && nm.scrollWidth > nm.clientWidth, ally: el?.classList.contains('ally') };
});
check(longName.oneLine && longName.inView && longName.ally && /votes Home Time/.test(longName.text || '') && longName.fits, `a long ally name keeps the pill on one line, in view, with the ally style (${JSON.stringify(longName)})`);
await snap(B, 'tycoop-home-vote-guest-longname');
// the guest taps the pill (the real button: its vote is queued for the lockstep), then the same command lands on both
await front(B);
await B.click('[data-testid="home-time"]');
const queued = await B.waitForFunction(() => /^Home Time ✓/.test(document.querySelector('[data-testid="home-time"]')?.textContent || '')
  && document.querySelector('[data-testid="home-time"]').textContent, null, { timeout: 20000, polling: 100 }).then((h) => h.jsonValue())
  .catch(() => B.evaluate(() => document.querySelector('[data-testid="home-time"]')?.textContent || ''));
check(/^Home Time ✓/.test(queued), `the guest's tap casts their vote (${queued})`);
await applyBoth(1, true);
const endOf = async (p) => {
  await front(p);
  const ok = await p.waitForSelector('[data-testid="ty-photo-wave"]', { timeout: 30000 }).then(() => true).catch(() => false);
  const read = await p.evaluate(() => ({
    title: document.querySelector('[data-testid="ty-photo-sheet"] .ty-stitle')?.textContent || '',
    best: document.querySelector('[data-testid="ty-photo-wave-best"]')?.textContent || '',
    ms: [...document.querySelectorAll('[data-testid="ty-photo-milestones"] [data-wave]')].map((e) => e.dataset.state).join(),
    finished: window.__battle.sim.finished === true && window.__battle.sim.state === 'lost',
    aw: window.__sakura.store.profile.missions.counters['ty:aw:1'],
  }));
  return { ok, ...read };
};
const photos = [await endOf(A), await endOf(B)];
check(photos.every((x) => x.ok && x.title === 'Home Time' && x.finished),
  `both votes end the run as Home Time on both tabs (${JSON.stringify(photos)})`);
check(photos.every((x) => /^Best wave for this Grade: 48/.test(x.best) && x.ms === 'no,no,no' && x.aw === 48), 'each player\'s photo shows their best wave for the Grade and the milestone row (each paid once)');
await snap(A, 'tycoop-home-photo-host');
await ctx.close();
await browser.close();
await server.close();
if (errors.length) for (const e of errors.slice(0, 15)) log(`  error: ${e}`);
check(errors.length === 0, 'no console errors');
log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
