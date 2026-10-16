// End-to-end test of the online features with the LOCAL adapter: one browser, two pages (two
// "tabs" = two players: they share localStorage + BroadcastChannel, each has its own
// sessionStorage identity). Checks:
//   1. both players pick a name
//   2. a chat message from A appears live on B, and a burst shows rate-limit feedback
//   3. A founds a clan, B finds and joins it, both member lists show 2; the clan boss tab loads,
//      and one boss attempt through a real battle (Fight → battle → end) lands on the ranking
//   4. a third tab joins the developer clan with the offline backend's LOCAL_DEV_CODE (this runs
//      on the Vite dev server: a production build's local backend has no developer clan code)
//      and the Supply Bot grants items
//   5. co-op: a code with a typo says "No room uses that code"; A hosts a room whose link is
//      mute (nothing A sends gets out), B joins by code: A shows "Connecting to Bea…" with Start
//      locked and heals its one-way link by itself (fresh channel); B leaves and A is offered a
//      New room; with A's link dead both ways B gets the "has not answered yet" + Retry banner
//      after ~15 s and finds A within seconds once A's link works again; a third tab gets
//      "Room full"; a "ready" lost on a mute link arrives with the next keepalive;
//      a dropped guest link shows "Reconnecting…" and comes back paired and still ready;
//   6. rematch (owner: "make it so the room stays"): A picks Nightmare (one life) and starts; the
//      first enemy through ends the battle on both screens (same tick, same state hash); both see
//      the results; A taps "Back to the room" first (its lobby waits for Bea, Bea's results say
//      Aiko is back), then B with the browser's Back (the phone's back gesture): same code,
//      paired again, Start locked until B taps Ready again;
//      A switches back to Normal and starts battle 2, which runs the checks below.
//      In battle 2 both place a girl through
//      the real tower bar (tap card → tap ground), the wave runs and the lockstep state hashes
//      of both clients match; a cut link drops the guest, the host re-admits it when the link
//      is back and the hashes agree again; finally the guest leaves and the host plays on. Both
//      battle cameras start Locked (the default) and neither a board drag nor placing moves them
//   7. "Your last room": the guest (gone Home) finds the room on its co-op menu and taps Rejoin;
//      the host leaves its solo battle through the menu, finds the room there too, taps Rejoin,
//      and they are paired again in the same room
//
//   node e2e/online.mjs                              # 1280×720
//   node e2e/online.mjs --viewport 844x390 --shots /tmp/online   # + screenshots
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1
// when a check fails.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium, ownSave } from './browser.mjs';
import { LOCAL_DEV_CODE } from '../src/online/clanRules.js';

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
const base = `http://127.0.0.1:${port}/?online=local&onboarding=0`;
const { browser, label } = await launchChromium();
log(`browser: ${label} · viewport ${W}x${H}`);

// reduced motion: no panel / modal entrance animations, so an element is "stable" for a click on
// the first frame even when three pages share an overloaded software-GL GPU process (a page
// that gets few frames otherwise keeps a 0.4 s slide-in "running" for seconds)
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch, reducedMotion: 'reduce' });
const errors = [];
async function openPage(name) {
  const page = await context.newPage();
  await ownSave(page, name); // each page is its own device: its own game save (a shared one would go stale)
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
  // a page starved of frames (two software-GL pages on a busy machine) can take a long time to
  // hand over a picture: wait longer, try twice, and never let a missing picture stop the run
  for (let i = 0; i < 2; i++) {
    try {
      await page.screenshot({ path: `${shotsDir}/${prefix}${name}-${W}x${H}.png`, timeout: 90000 });
      return;
    } catch (e) {
      log(`    (screenshot ${name}: ${String(e.message).split('\n')[0]}${i ? '' : ' — trying again'})`);
    }
  }
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
  // local mode says plainly that messages stay in this browser
  check(/other tabs of this browser/i.test(await A.locator('[data-testid="chat-panel"] [data-testid="local-note"]').innerText().catch(() => '')),
    'chat: the local-mode banner says messages only reach other tabs of this browser');
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
  // a fresh account in the beta window (until 2026-11-07) gets the Beta Tester gift celebration
  // over the lobby, once per session, just after the lobby mounts: put it off with "Later" like a
  // player would, so the chat bubble is not covered
  if (Date.now() < Date.UTC(2026, 10, 8, 6)) {
    const later = await B.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 15000 }).catch(() => null);
    if (later) {
      await tap(B, '[data-testid="beta-gift-later"]');
      await B.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 10000 }).catch(() => null);
    }
  }
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
  // the boss's own 3D model as a portrait (rendered lazily; the token stands in until then)
  check(await A.waitForSelector('[data-testid="boss-art"] .ol-boss-img', { timeout: 45000 }).then(() => true).catch(() => false), 'clan boss: the boss portrait (a still of its 3D model) is drawn');
  await shot(A, 'clan-boss');

  // one clan boss attempt through the real battle: Fight (start_boss_attempt) → battle
  // (clanBoss=<attempt id>) → a girl fights the first wave → the battle ends → its damage is
  // submitted against that attempt and shows on the ranking
  await tap(A, '[data-testid="boss-fight"]');
  const fightAt = Date.now();
  const bossBattle = await A.waitForFunction(() => window.__battle?.ui?.placement && /clanBoss=[\w-]{8,}/.test(location.hash), null, { timeout: 40000 }).then(() => true).catch(() => false);
  check(bossBattle, 'clan boss: Fight opens the boss battle');
  if (bossBattle) {
    await A.waitForTimeout(600);
    const placed = await placeOne(A);
    await A.evaluate(() => window.__battle.ui.startWave());
    // let her fight for a while (any damage counts), then end the run
    await A.waitForFunction(() => Object.values(window.__battle.sim.stats.damageByTower || {}).some((d) => d > 0), null, { timeout: 30000 }).catch(() => null);
    // the server counts nothing from a battle shorter than 10 s (clanRules BOSS_MIN_SECONDS)
    await A.waitForTimeout(Math.max(0, fightAt + 12000 - Date.now()));
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
  // (not 'DevTester': since the social update "dev" as a word of its own is a reserved name, clanRules.reservedName)
  await setName(C, 'Tester');
  await C.waitForSelector('[data-testid="clan-code"]', { timeout: 10000 });
  await C.fill('[data-testid="clan-code"]', LOCAL_DEV_CODE);
  await tap(C, '[data-testid="clan-code-join"]');
  await C.waitForSelector('[data-testid="supply-bot"]', { timeout: 10000 });
  check(/DEVELOPER SANDBOX/.test(await C.locator('[data-testid="supply-bot"]').innerText()), 'dev clan: the local test code opens the Supply Bot, labelled DEVELOPER SANDBOX');
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

  // transfer codes (Settings → Online): a one-time 12-character code; a wrong code is refused
  // (and counted), the right one offers its save for import — cancelled here, because every tab of
  // this browser shares one save
  await go(C, '#/settings');
  await C.waitForSelector('[data-testid="transfer-create"]', { timeout: 20000 });
  await tap(C, '[data-testid="transfer-create"]');
  const tcode = await C.waitForSelector('[data-testid="transfer-created"]', { timeout: 10000 }).then((e) => e.innerText()).catch(() => '');
  check(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(tcode), `transfer: Create gives a 12-character one-time code (${tcode})`);
  await C.fill('[data-testid="transfer-code"]', 'AAAA-BBBB-CCCC');
  await tap(C, '[data-testid="transfer-redeem"]');
  const wrongText = await C.waitForFunction(() => document.querySelector('.ma-code-status.bad')?.innerText, null, { timeout: 8000 }).then((h) => h.jsonValue()).catch(() => '');
  check(/unknown transfer code/i.test(wrongText), `transfer: a wrong code is refused ("${wrongText}")`);
  await C.fill('[data-testid="transfer-code"]', tcode.toLowerCase());
  await tap(C, '[data-testid="transfer-redeem"]');
  const offered = await C.waitForFunction(() => /Replace your current progress/.test(document.body.innerText), null, { timeout: 8000 }).then(() => true).catch(() => false);
  check(offered, 'transfer: the right code (any case) offers its save for import');
  await shot(C, 'transfer-import');
  if (offered) await C.getByRole('button', { name: 'Cancel' }).last().click();
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
  // a code with a typo: the server knows no such room
  const typo = code.slice(0, 4) + (code[4] === 'Z' ? 'Y' : 'Z');
  await B.fill('[data-testid="coop-code"]', typo);
  await tap(B, '[data-testid="coop-join"]');
  const typoText = await B.waitForSelector('[data-testid="coop-room-error"]', { timeout: 10000 }).then((e) => e.innerText()).catch(() => '');
  check(/No room uses that code/.test(typoText), `co-op: a code with a typo says "No room uses that code" (${typoText.replace(/\s+/g, ' ').slice(0, 80)})`);
  await shot(B, 'coop-typo');
  await B.locator('[data-testid="coop-room-error"] button').first().click(); // Back
  await B.waitForSelector('[data-testid="coop-code"]', { timeout: 10000 });
  await B.waitForTimeout(1100); // (one room call per second)

  // Connection faults, faked by the local transport (window.__coop.room._cut / _heal).
  // 1. One-way link: the host's room goes MUTE (it looks joined, but nothing it sends gets out:
  //    what a hung presence track did on some Supabase nodes). The guest joins: the host hears
  //    it, the guest does not hear the host. The host shows "Connecting to Bea…" with Start
  //    locked, notices after ~7 s that its ally never hears it, and gets itself a fresh channel
  //    (the local transport's reconnect ends the fault, like a fresh Realtime channel on a good
  //    node): both pair without anyone tapping anything.
  await A.evaluate(() => window.__coop.room._cut({ send: true, recv: false, status: false }));
  await B.fill('[data-testid="coop-code"]', code.toLowerCase());
  const joinAt = Date.now();
  await tap(B, '[data-testid="coop-join"]');
  await B.waitForSelector('[data-testid="coop-room"]', { timeout: 10000 });
  const hostHeardGuest = await A.waitForSelector('[data-testid="coop-connecting"]', { timeout: 10000 }).then((e) => e.innerText()).catch(() => '');
  check(/Connecting to Bea/.test(hostHeardGuest) && !(await B.locator('[data-testid="coop-player-0"]').count()),
    `co-op: a mute host hears the guest and shows "Connecting to Bea…", the guest does not see the host yet (${hostHeardGuest.replace(/\s+/g, ' ').slice(0, 60)})`);
  check(await A.locator('[data-testid="coop-start"]').isDisabled(), 'co-op: while the guest cannot hear the host, Start stays locked');
  check(/Looking for the host/.test(await B.locator('[data-testid="coop-wait"]').innerText().catch(() => '')), 'co-op: the guest\'s lobby says "Looking for the host…"');
  await shot(A, 'coop-connecting-host');
  const healedAt = await A.waitForSelector('[data-testid="coop-player-1"]', { timeout: 30000 }).then(() => Date.now() - joinAt).catch(() => null);
  const pairedB = await B.waitForSelector('[data-testid="coop-player-0"]', { timeout: 10000 }).then(() => true).catch(() => false);
  const heals = await A.evaluate(() => window.__coop.room.reconnects);
  check(healedAt != null && pairedB && heals >= 1 && healedAt < 25000,
    `co-op: the host notices its one-way link and heals it with a fresh channel by itself; both pair (${healedAt} ms, ${heals} reconnect(s))`);

  // 2. The guest leaves: the host is told and offered a new room (a guest coming back from
  //    another browser or device might find the seat still taken)
  await tap(B, '[data-testid="coop-leave"]');
  const goneText = await A.waitForSelector('[data-testid="coop-ally-gone"]', { timeout: 10000 }).then((e) => e.innerText()).catch(() => '');
  check(/Bea left the room/.test(goneText) && /New room/.test(goneText), `co-op: when the guest leaves, the host sees "Bea left the room" with a New room button (${goneText.replace(/\s+/g, ' ').slice(0, 80)})`);
  await shot(A, 'coop-ally-gone-host');

  // 3. A host that hears nothing and is not heard (a dead link that looks fine): the guest
  //    cannot find the host; after ~15 s the lobby says so and offers Retry. When the host's
  //    link works again, the guest's search (fast again after Retry) finds it within seconds.
  await B.waitForSelector('[data-testid="coop-code"]', { timeout: 10000 });
  await B.waitForTimeout(1100); // (one room call per second)
  await A.evaluate(() => window.__coop.room._cut({ send: true, recv: true, status: false }));
  await B.fill('[data-testid="coop-code"]', code);
  await tap(B, '[data-testid="coop-join"]');
  await B.waitForSelector('[data-testid="coop-room"]', { timeout: 10000 });
  const stuckText = await B.waitForSelector('[data-testid="coop-stuck"]', { timeout: 25000 }).then((e) => e.innerText()).catch(() => '');
  check(/has not answered yet/.test(stuckText) && /Retry/.test(stuckText), `co-op: after ~15 s without the host the guest sees what to check and a Retry button`);
  await shot(B, 'coop-stuck-guest');
  await tap(B, '[data-testid="coop-retry"]');
  check(await B.waitForSelector('[data-testid="coop-stuck"]', { state: 'detached', timeout: 5000 }).then(() => true).catch(() => false), 'co-op: Retry starts the search again');
  const healAt = Date.now();
  await A.evaluate(() => window.__coop.room._heal({ report: false }));
  const healed = await B.waitForSelector('[data-testid="coop-player-0"]', { timeout: 10000 }).then(() => Date.now() - healAt).catch(() => null);
  check(healed != null && healed < 4000, `co-op: once the host's link works again the guest finds it on its own (${healed} ms)`);
  const paired = await A.waitForSelector('[data-testid="coop-player-1"]', { timeout: 10000 }).then(() => true).catch(() => false);
  check(paired, 'co-op: both players appear in the room');
  check(!(await A.locator('[data-testid="coop-ally-gone"]').count()), 'co-op: the "left the room" banner goes once the ally is back');

  // 4. A third player with the code: "Room full", no seats and no Ready button
  const D = await openPage('D');
  await D.goto(`${base}#/chat`, { waitUntil: 'load' });
  await setName(D, 'Chi');
  await go(D, `#/coop/${code}`);
  const fullText = await D.waitForSelector('[data-testid="coop-room-full"]', { timeout: 15000 }).then((e) => e.innerText()).catch(() => '');
  check(/Room full/.test(fullText) && /already has two players/.test(fullText) && !(await D.locator('[data-testid="coop-ready"]').count()) && !(await D.locator('[data-testid="coop-wait"]').count()),
    `co-op: a third player sees "Room full" — no seats, no Ready, no "Connecting…" (${fullText.replace(/\s+/g, ' ').slice(0, 70)})`);
  await shot(D, 'coop-room-full');
  await D.close();
  const stillPaired = await Promise.all([A, B].map((p) => p.evaluate(() => window.__coop?.paired)));
  check(stillPaired.every(Boolean), 'co-op: the pair is untouched by the third player');

  // a lost "ready": the guest's link is mute while it taps Ready; the next keepalive hello
  // (every 8 s) carries the flag once the link works again
  await B.evaluate(() => window.__coop.room._cut({ send: true, recv: false, status: false }));
  await tap(B, '[data-testid="coop-ready"]');
  await A.waitForTimeout(1200);
  check(await A.locator('[data-testid="coop-start"]').isDisabled(), 'co-op: while the guest\'s "ready" is lost, Start stays locked');
  await B.evaluate(() => window.__coop.room._heal({ report: false }));
  const readyAt = Date.now();
  const canStart = await A.waitForFunction(() => !document.querySelector('[data-testid="coop-start"]')?.disabled, null, { timeout: 15000 }).then(() => Date.now() - readyAt).catch(() => null);
  check(canStart != null, `co-op: Start unlocks when the guest is ready (the lost "ready" arrived with a keepalive hello after ${canStart} ms)`);
  // a dropped channel on the guest: "Reconnecting…", then back with the pair and the ready flag
  await B.evaluate(() => window.__coop.room._cut());
  const reconnecting = await B.waitForSelector('[data-testid="coop-link"]', { timeout: 5000 }).then((e) => e.innerText()).catch(() => '');
  check(/Reconnecting/.test(reconnecting), `co-op: a dropped link shows "Reconnecting…" (${reconnecting})`);
  await shot(B, 'coop-reconnecting-guest');
  await B.waitForTimeout(2500);
  await B.evaluate(() => window.__coop.room._heal());
  const backOk = await B.waitForSelector('[data-testid="coop-link"]', { state: 'detached', timeout: 5000 }).then(() => true).catch(() => false);
  await A.waitForTimeout(800);
  const afterReconnect = await Promise.all([A, B].map((p) => p.evaluate(() => ({ paired: window.__coop.paired, link: window.__coop.link, ready: window.__coop.isHost ? window.__coop.peer?.ready : window.__coop.me.ready }))));
  check(backOk && afterReconnect.every((x) => x.paired && x.link === 'connected' && x.ready) && !(await A.locator('[data-testid="coop-start"]').isDisabled()),
    `co-op: after the reconnect both still see each other and the guest is still ready (${JSON.stringify(afterReconnect)})`);
  await shot(A, 'coop-lobby');
  await shot(B, 'coop-lobby-guest');

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
  // the hash checkpoints at or after `from` both clients compared (a frozen page answers nothing)
  const comparedFrom = (p, from) => Promise.race([
    p.evaluate((t0) => (window.__battle?.coop?.hashes || []).map((q) => q.t).filter((t) => t >= t0), from).catch(() => []),
    new Promise((r) => setTimeout(() => r([]), 30000).unref()),
  ]);
  /** The host's stage picker in the room: pick a difficulty (same stage). */
  async function pickDifficulty(name) {
    await tap(A, '[data-testid="coop-room-stage"]');
    await A.waitForSelector('.ol-pick', { timeout: 10000 });
    await tap(A, `.ol-pick .ol-seg-btn:text-is("${name}")`);
    await tap(A, '[data-testid="coop-stage-ok"]');
    await A.waitForSelector('.ol-pick', { state: 'detached', timeout: 10000 }).catch(() => null);
  }

  // ---- rematch: a battle that really ends, then both go back to the room ------------------
  // (owner, Oct 14: "When you lose and go back to coop make it so the room stays and you can
  // rejoin the room"). The host picks Nightmare (one life) in the room's own stage picker, nobody
  // places a girl, and the host starts the wave: lockstep orders that both clients run, so the
  // first enemy through ends the battle on both screens at the same tick.
  await pickDifficulty('Nightmare');
  check(await B.waitForFunction(() => window.__coop?.difficulty === 'nightmare', null, { timeout: 15000 }).then(() => true).catch(() => false),
    'rematch: the host picks Nightmare in the room and the guest sees it');
  await tap(A, '[data-testid="coop-start"]');
  const [in1A, in1B] = await Promise.all([inBattle(A), inBattle(B)]);
  if (!check(in1A && in1B, 'rematch: battle 1 runs on both')) {
    log(`    host: ${JSON.stringify(await battleInfo(A))}`);
    log(`    guest: ${JSON.stringify(await battleInfo(B))}`);
  }
  const seed1 = await A.evaluate(() => window.__coop.start.seed);
  // one common hash checkpoint first (the battles agree), then the wave, at 2× then 3×
  let t1 = 0;
  for (const until = Date.now() + 300000; !t1 && Date.now() < until;) {
    const [ta, tb] = await Promise.all([A, B].map((p) => comparedFrom(p, 120)));
    t1 = Math.max(0, ...tb.filter((t) => ta.includes(t)));
    if (!t1) await A.waitForTimeout(500);
  }
  check(!!t1, `rematch: battle 1's hash checkpoints are compared on both (tick ${t1})`);
  await A.evaluate(() => window.__battle.ui.startWave());
  for (const speed of [2, 3]) {
    await tap(A, '[data-testid="speed"]');
    await A.waitForFunction((v) => window.__battle?.ui?.speed === v || window.__battle?.sim?.state === 'lost', speed, { timeout: 30000, polling: 100 }).catch(() => null);
  }
  const resultsUp = (p) => p.waitForFunction(() => window.__battle?.sim?.state === 'lost' && !!document.querySelector('[data-testid="result"]:not([hidden]) [data-testid="coop-back"]'), null, { timeout: 300000, polling: 250 }).then(() => true).catch(() => false);
  const [r1A, r1B] = await Promise.all([resultsUp(A), resultsUp(B)]);
  if (!check(r1A && r1B, 'rematch: the battle ends on both screens (the first enemy through) and both see the results')) await Promise.all([A, B].map(async (p) => log(`    ${JSON.stringify(await battleInfo(p))}`)));
  const end1 = await Promise.all([A, B].map((p) => p.evaluate(() => ({ tick: window.__coop.lockstep.tick, hash: window.__coop.lockstep.coop.hash(), pairs: window.__battle.coop.hashes }))));
  check(end1[0].tick === end1[1].tick && end1[0].hash === end1[1].hash && end1.every((e) => e.pairs.every((q) => q.mine === q.theirs)),
    `rematch: both battles end at the same tick with the same state (${end1.map((e) => `${e.tick}:${e.hash}`).join(' / ')})`);
  const buttons = await Promise.all([A, B].map((p) => p.evaluate(() => [...document.querySelectorAll('[data-testid="result"] .bt-result-actions button')].map((b) => b.dataset.testid))));
  check(buttons.every((b) => ['coop-back', 'coop-leave-room', 'home'].every((id) => b.includes(id))), `rematch: the results offer "Back to the room", "Leave room" and "Home" (${JSON.stringify(buttons)})`);
  await shot(A, 'coop-results-host');
  await shot(B, 'coop-results-guest');

  // the host goes back first: its lobby (same code) waits for Bea, still on her results
  await tap(A, '[data-testid="coop-back"]');
  const backCode = await A.waitForSelector('[data-testid="coop-room-code"]', { timeout: 30000 }).then((e) => e.innerText()).catch(() => '');
  const waitA = await A.waitForSelector('[data-testid="coop-wait"]', { timeout: 10000 }).then((e) => e.innerText()).catch(() => '');
  check(backCode.trim() === code && /Waiting for Bea/.test(waitA) && /still on the battle screen/.test(waitA),
    `rematch: "Back to the room" lands the host in room ${backCode.trim()} again, waiting for Bea on her results (${waitA.replace(/\s+/g, ' ').slice(0, 90)})`);
  check(await A.locator('[data-testid="coop-start"]').isDisabled(), 'rematch: Start is locked while the guest is away');
  const allyBack = await B.waitForSelector('[data-testid="coop-ally-status"]:not([hidden])', { timeout: 15000 }).then((e) => e.innerText()).catch(() => '');
  check(/Aiko is back in the room/.test(allyBack), `rematch: the guest's results say the host is back in the room (${allyBack})`);
  await shot(A, 'coop-lobby-ally-on-results');
  await shot(B, 'coop-results-ally-back');
  await B.waitForTimeout(1500); // a moment on the results screen
  // the guest uses the browser's Back (the phone's back gesture) instead of the button: once the
  // battle is over that also goes back to the room (it used to leave it)
  await B.goBack();
  const backCodeB = await B.waitForSelector('[data-testid="coop-room-code"]', { timeout: 30000 }).then((e) => e.innerText()).catch(() => '');
  const repaired = await Promise.all([A.waitForSelector('[data-testid="coop-player-1"]', { timeout: 20000 }), B.waitForSelector('[data-testid="coop-player-0"]', { timeout: 20000 })]).then(() => true).catch(() => false);
  const pair2 = await Promise.all([A, B].map((p) => p.evaluate(() => ({ code: window.__coop.code, paired: window.__coop.paired, phase: window.__coop.phase, reconnects: window.__coop.room.reconnects }))));
  check(backCodeB.trim() === code && repaired && pair2.every((x) => x.code === code && x.paired && x.phase === 'lobby'),
    `rematch: both back in room ${code} (the guest through the browser's Back) and paired again, no code typed (${JSON.stringify(pair2)})`);
  await A.waitForTimeout(1500);
  check(await A.locator('[data-testid="coop-start"]').isDisabled() && /NOT READY/.test(await A.locator('[data-testid="coop-ready-1"]').innerText().catch(() => '')),
    'rematch: the guest has to tap Ready again — Start stays locked until then');
  // battle 2 runs the long checks below: back to Normal
  await pickDifficulty('Normal');
  await B.waitForFunction(() => window.__coop?.difficulty === 'normal', null, { timeout: 15000 }).catch(() => null);
  await tap(B, '[data-testid="coop-ready"]');
  check(await A.waitForFunction(() => !document.querySelector('[data-testid="coop-start"]')?.disabled, null, { timeout: 15000 }).then(() => true).catch(() => false),
    'rematch: Start unlocks once the guest is ready again');
  await tap(A, '[data-testid="coop-start"]');
  const [inA, inB] = await Promise.all([inBattle(A), inBattle(B)]);
  if (!check(inA, 'co-op: host is in the battle') | !check(inB, 'co-op: guest is in the battle')) {
    log(`    host: ${JSON.stringify(await battleInfo(A))}`);
    log(`    guest: ${JSON.stringify(await battleInfo(B))}`);
  } else {
    const ev = (p) => p.evaluate(() => window.__coop.lockstep.trace.map((e) => `${e.ev}@${e.tick}`).join(' ')).catch(() => '?');
    log(`    connection events — host: ${await ev(A)} | guest: ${await ev(B)}`);
  }
  // (on a loaded machine a battle screen can take longer than the 30 s load allowance: the one
  // that was ready first drops the other and the host re-admits it — the designed self-healing.
  // The check below wants both connected, so it waits for that dance to settle, and says so)
  const settleT0 = Date.now();
  const settled = await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__coop?.peerGone === false, null, { timeout: 120000, polling: 250 }).then(() => true).catch(() => false)));
  if (Date.now() - settleT0 > 1000) log(`    (battle 2's start reconnected after ${Math.round((Date.now() - settleT0) / 1000)} s: ${settled.join('/')})`);
  const fresh = await Promise.all([A, B].map((p) => p.evaluate(() => ({ seed: window.__coop.start.seed, diff: window.__battle.sim.difficulty, state: window.__battle.sim.state, ended: !!window.__battle.ui.ended, peerGone: window.__coop.peerGone }))));
  check(fresh.every((f) => f.seed === fresh[0].seed && f.seed !== seed1 && f.diff === 'normal' && f.state !== 'lost' && !f.ended && !f.peerGone),
    `rematch: battle 2 is a fresh battle on both (${JSON.stringify(fresh)})`);
  await Promise.all([A, B].map((p) => p.waitForFunction(() => {
    for (let el = window.__battle.renderer.canvas; el; el = el.parentElement) {
      if (el.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity)) return false;
    }
    return true;
  }, null, { timeout: 15000 }).catch(() => null)));

  // co-op battles use the same renderer and camera policy: both screens start Locked on the
  // fitted view, a drag across the host's board leaves it there, and placing (below) never moves it
  const camOf = (p) => p.evaluate(() => window.__battle.renderer.cameraState).catch(() => null);
  const sameCam = (a, b) => !!a && !!b && ['position', 'target'].every((k) => a[k].every((v, i) => Math.abs(v - b[k][i]) < 1e-3)) && a.zoom === b.zoom;
  const coopCam0 = await Promise.all([A, B].map(camOf));
  check(coopCam0.every((c) => c?.mode === 'locked' && c.locked && c.zoom === 1 && c.isDefault), `co-op: both battles start with the camera Locked on the fitted view (${coopCam0.map((c) => c?.mode).join(' / ')})`);
  await A.evaluate(() => {
    const c = window.__battle.renderer.canvas;
    const r = c.getBoundingClientRect();
    const y = r.top + r.height * 0.45;
    const fire = (type, x) => c.dispatchEvent(new PointerEvent(type, { pointerId: 77, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true }));
    fire('pointerdown', r.left + r.width * 0.3);
    for (let i = 1; i <= 10; i++) fire('pointermove', r.left + r.width * (0.3 + i * 0.04));
    fire('pointerup', r.left + r.width * 0.7);
  }).catch(() => null);
  const coopCam1 = await camOf(A);
  check(sameCam(coopCam0[0], coopCam1), 'co-op: a drag across the host\'s board leaves the locked camera put');

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
  const coopCam2 = await Promise.all([A, B].map(camOf));
  check(coopCam2.every((c, i) => sameCam(coopCam0[i], c)), 'co-op: placing the girls never moved either camera');
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
  const comparedTicks = (p) => comparedFrom(p, 360);
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
  // attack FX (render-only) style both players' girls on both screens
  const fxCoop = await Promise.all([A, B].map((p) => p.evaluate(() => {
    const a = window.__battle.renderer.info.attackFx;
    return a && { styled: a.styled, quads: a.quads };
  }).catch(() => null)));
  check(fxCoop.every((a) => a && a.styled >= 2), `co-op: attack FX style both players' girls on both screens (${JSON.stringify(fxCoop)})`);
  await A.waitForTimeout(600);
  await shot(A, 'coop-battle');
  await shot(B, 'coop-battle-guest');

  // ---- hero rework: each player deploys her own hero (free), the guest buys a level ----------
  // (the guest searches from the opposite corner and after the host's hero stands, so the two
  // orders never race for the same spot)
  async function placeHero(page, fromEnd) {
    return page.evaluate((rev) => {
      const { sim, ui } = window.__battle;
      const id = sim.heroConfig?.unitId;
      if (!id || sim.hero) return id ? 'already' : null;
      const ys = [];
      // a centre right on the map's edge can round out of bounds on the 1/1024 command grid: stay 1 tile in
      for (let y = 1; y < sim.map.height - 1; y += 0.35) ys.push(y);
      const xs = [];
      for (let x = 1; x < sim.map.width - 1; x += 0.35) xs.push(x);
      if (rev) {
        ys.reverse();
        xs.reverse();
      }
      for (const y of ys) {
        for (const x of xs) {
          if (sim.canPlace(id, x, y).ok && sim.towers.every((t) => Math.hypot(t.x - x, t.y - y) > 1.6)) return ui.act.place(id, x, y) ? id : null;
        }
      }
      return null;
    }, fromEnd);
  }
  const heroA = await placeHero(A, false);
  await B.waitForFunction(() => !!window.__battle.sim.heroes[0], null, { timeout: 120000, polling: 250 }).catch(() => null);
  const heroB = await placeHero(B, true);
  check(!!heroA && !!heroB, `co-op heroes: both players deploy their hero for free (${heroA} / ${heroB})`);
  const twoHeroes = (p) => p.waitForFunction(() => window.__battle.sim.heroes.filter(Boolean).length === 2, null, { timeout: 120000, polling: 250 }).then(() => true).catch(() => false);
  if (!check(await twoHeroes(A) && await twoHeroes(B), 'co-op heroes: both heroes stand on both screens')) await dump('lockstep state');
  await A.evaluate(() => window.__battle.ui.feed.clear?.());
  const before = await B.evaluate(() => ({ lv: window.__battle.sim.hero?.level, st: window.__battle.sim.heroLevelStatus(), wallet: window.__battle.sim.cash }));
  const bought = await B.waitForFunction(() => {
    const { sim, ui } = window.__battle;
    const st = sim.heroLevelStatus();
    if (st.reason) return false;
    return ui.levelUpHero(st);
  }, null, { timeout: 120000, polling: 500 }).then(() => true).catch(() => false);
  check(bought, `co-op heroes: the guest buys a level from her own wallet (Lv ${before.lv}, ${before.st.price} coins)`);
  const guestUp = (p) => p.waitForFunction((lv) => (window.__battle.sim.heroes[1]?.level || 0) > lv, before.lv, { timeout: 120000, polling: 250 }).then(() => true).catch(() => false);
  check(await guestUp(A) && await guestUp(B), 'co-op heroes: the guest\'s hero is a level up on both screens');
  const chip = await A.waitForFunction(() => [...document.querySelectorAll('.bt-toast-text')].some((t) => /Bea's \w+ Lv \d+/.test(t.textContent)), null, { timeout: 30000, polling: 250 }).then(() => true).catch(() => false);
  check(chip, 'co-op heroes: the host sees the ally chip ("Bea\'s Hikari Lv n"), not her own toast');
  await shot(A, 'coop-two-heroes');
  await shot(B, 'coop-two-heroes-guest');
  const hh = await Promise.all([A, B].map((p) => p.evaluate(() => window.__battle.coop.hashes)));
  check(hh.every((list) => list.length > 0 && list.every((q) => q.mine === q.theirs)), `co-op heroes: hashes still equal on both (${hh.map((l) => l.length).join(' / ')} checkpoints)`);

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

  // ---- "Your last room": back into the same room from the co-op menu, no code typed --------
  // the guest went Home (above): its co-op menu offers the room again
  await go(B, '#/coop');
  const lastB = await B.waitForSelector('[data-testid="coop-last-room"]', { timeout: 15000 }).then((e) => e.innerText()).catch(() => '');
  check(lastB.includes(code) && /You joined/.test(lastB), `last room: the guest's co-op menu shows "Your last room" ${code} (${lastB.replace(/\s+/g, ' ').slice(0, 70)})`);
  await shot(B, 'coop-hub-last-room');
  await B.waitForTimeout(1100); // (one room call per second)
  await tap(B, '[data-testid="coop-rejoin"]');
  const rejoinB = await B.waitForSelector('[data-testid="coop-room-code"]', { timeout: 15000 }).then((e) => e.innerText()).catch(() => '');
  check(rejoinB.trim() === code, `last room: Rejoin takes the guest back into room ${rejoinB.trim()}`);
  // the host leaves its solo battle through the co-op menu (its room stays registered) and
  // finds the room on its co-op menu too
  await tap(A, '[data-testid="pause"]');
  await tap(A, '[data-testid="quit"]');
  await tap(A, '[data-testid="confirm-ok"]');
  const lastA = await A.waitForSelector('[data-testid="coop-last-room"]', { timeout: 20000 }).then((e) => e.innerText()).catch(() => '');
  check(lastA.includes(code) && /You host/.test(lastA), `last room: the host's co-op menu shows "Your last room" ${code} (${lastA.replace(/\s+/g, ' ').slice(0, 70)})`);
  await shot(A, 'coop-hub-last-room-host');
  await tap(A, '[data-testid="coop-rejoin"]');
  const rejoinA = await A.waitForSelector('[data-testid="coop-room-code"]', { timeout: 15000 }).then((e) => e.innerText()).catch(() => '');
  const rejoined = await Promise.all([A.waitForSelector('[data-testid="coop-player-1"]', { timeout: 20000 }), B.waitForSelector('[data-testid="coop-player-0"]', { timeout: 20000 })]).then(() => true).catch(() => false);
  const pair3 = await Promise.all([A, B].map((p) => p.evaluate(() => ({ code: window.__coop?.code, host: window.__coop?.isHost, paired: window.__coop?.paired }))));
  check(rejoinA.trim() === code && rejoined && pair3.every((x) => x.code === code && x.paired) && pair3[0].host && !pair3[1].host,
    `last room: both Rejoined room ${code} and are paired again (${JSON.stringify(pair3)})`);
  await shot(A, 'coop-rejoined-host');
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
