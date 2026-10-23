// End-to-end test of the Multiplayer button and hub (UI M5d; owner decisions #79 and #108) with the LOCAL adapter
// (?online=local): one browser, two pages = two players (they share localStorage + BroadcastChannel; each tab is its
// own player with its own save).
//   1. offline: A has never gone online. The lobby shows the Multiplayer button (no number); the hub still renders
//      (Momo, the Co-op card, Create room, the four tiles), says invites come once online, Quick join is off with its
//      reason, and no online account exists afterwards (no id, no sign-in, nothing in the local server)
//   2. PvP opens the Rival Run sheet only (its chips; nothing in it acts; the route stays); Titan Co-op shows "Soon"
//      and starts nothing
//   3. Friends opens Messages › Friends (A picks a name there); B goes online and asks A to be friends: the Friends
//      tile shows a red 1; A accepts
//   4. B opens a room and invites A by DM (Invite a friend): A's lobby button shows a red 1; the hub lists the invite and
//      its Join opens B's room (the same code, paired)
//   5. Quick join: B opens a second room and invites A again: Quick join takes A into it; once B has left (the invite
//      expired), Quick join is off with its reason and no invite row is left
//   6. Clan Boss: with no clan it opens the clan search; in a clan, the clan's boss tab
//   7. the probe (e2e/probe.mjs) on the hub, offline and with an invite, and on the lobby with its number, at 844x390
//      and 1280x720: the floor, ≤ 12 numbers, one yellow, Momo within 35%, no sideways overflow
//
//   node e2e/multiplayer.mjs                                # 844x390 (touch), probes at both sizes
//   node e2e/multiplayer.mjs --viewport 1280x720 --shots <dir>
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a check fails.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium, ownSave } from './browser.mjs';
import { probe, judge, summary } from './probe.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const [W, H] = opt('viewport', '844x390').split('x').map(Number);
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const touch = Math.min(W, H) < 600;
const SIZES = [[844, 390], [1280, 720]];

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

const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch, reducedMotion: 'reduce' });
const errors = [];
async function openPage(name) {
  const page = await context.newPage();
  await ownSave(page, name);
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!IGNORE.some((re) => re.test(t))) errors.push(`[${name} console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[${name} pageerror] ${e.message}`));
  return page;
}

// Several pages share one headless browser: only the page in front gets animation frames, so every wait and tap
// brings its page to the front first.
let front = null;
const toFront = async (page) => {
  if (front === page) return;
  front = page;
  await page.bringToFront().catch(() => {});
};
const go = async (page, hash) => {
  await toFront(page);
  await page.evaluate((h) => { location.hash = h; }, hash);
};
const wait = async (page, sel, { timeout = 15000, state = 'visible' } = {}) => {
  await toFront(page);
  return page.waitForFunction(([s, st]) => {
    const el = document.querySelector(s);
    if (st === 'detached') return !el;
    if (!el) return false;
    if (st === 'attached') return true;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }, [sel, state], { timeout, polling: 200 }).then(() => true).catch(() => false);
};
const until = async (page, fn, arg, ms = 15000) => {
  await toFront(page);
  return page.waitForFunction(fn, arg, { timeout: ms, polling: 200 }).then(() => true).catch(() => false);
};
const tap = async (page, sel) => {
  await toFront(page);
  const el = page.locator(sel).first();
  const act = (o) => (touch ? el.tap(o) : el.click(o));
  try {
    await act({ timeout: 15000 });
  } catch (e) {
    if (!/Timeout/.test(e.message)) throw e;
    log(`    (no frames for 15 s: tapping ${sel} without the stability wait)`);
    await act({ timeout: 15000, force: true });
  }
};
const text = (page, sel) => page.locator(sel).first().innerText({ timeout: 5000 }).catch(() => '');
const where = (page) => page.evaluate(() => ({ hash: location.hash, screen: document.querySelector('#app')?.dataset.screen || null })).catch(() => ({ hash: '?', screen: null }));
const onScreen = (page, name, prefix = `#/${name}`, timeout = 30000) => until(page, ([n, p]) => document.querySelector('#app')?.dataset.screen === n && location.hash.startsWith(p) && !document.documentElement.dataset.tx, [name, prefix], timeout);
const shot = async (page, name) => {
  const leaked = await page.evaluate(() => (document.body.innerText.match(/\b(null|undefined|NaN)\b/g) || []).join(', ')).catch(() => '');
  check(!leaked, `${name}: no "null" / "undefined" / "NaN" on screen${leaked ? ` (${leaked})` : ''}`);
  if (!shotsDir) return;
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250))))).catch(() => {});
  await page.screenshot({ path: `${shotsDir}/${name}-${W}x${H}.png` }).catch((e) => log(`    (screenshot ${name} skipped: ${String(e.message).split('\n')[0]})`));
};
const closeToasts = (page) => page.evaluate(() => {
  for (const b of document.querySelectorAll('[data-testid="invite-toast-later"], [data-testid="beta-gift-later"]')) b.click();
}).catch(() => {});

async function setName(page, name) {
  if (!(await wait(page, '[data-testid="name-input"]', { timeout: 20000 }))) return false;
  await page.fill('[data-testid="name-input"]', name);
  await tap(page, '[data-testid="name-save"]');
  return wait(page, '[data-testid="name-input"]', { state: 'detached', timeout: 10000 });
}

async function lobby(page) {
  await go(page, '#/lobby');
  await onScreen(page, 'lobby', '#/lobby', 45000);
  // the one-time Beta Tester gift: put off ("Later") like a player would (through the page: it slides in)
  if (Date.now() < Date.UTC(2026, 10, 8, 6) && (await wait(page, '[data-testid="beta-gift-later"]', { timeout: 6000 }))) {
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('[data-testid="beta-gift-later"]')?.click());
    await wait(page, '.bg-gift-modal', { state: 'detached', timeout: 10000 });
  }
}

/** The probe at both sizes: judged with the shared top bar's taps left out (no milestone owns it). */
async function probeBoth(page, name, { kind = 'hub', list = null } = {}) {
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => new Promise((r) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 500)));
    const r = await probe(page, { kind, list, tapSkip: '.topbar, .lb-top, .lb-car-dots' });
    const fails = judge(r, { skip: ['content'] });
    check(!fails.length, `probe ${name} ${w}x${h}: ${summary(r)}${fails.length ? ` — ${fails.join('; ')}` : ''}`);
    if (shotsDir) await page.screenshot({ path: `${shotsDir}/probe-${name}-${w}x${h}.png` }).catch(() => {});
  }
  await page.setViewportSize({ width: W, height: H });
}

/** A player's own online id (the local test server's). */
const uidOf = (page) => page.evaluate(async () => (await import('/src/online/backend.js')).getBackend().uid);

/** B opens a room as host (#/coop/<CODE>?host=1) and invites A from Invite a friend; returns the code. */
async function hostAndInvite(B) {
  const code = await B.evaluate(async () => (await import('/src/online/coop/session.js')).makeRoomCode());
  await go(B, `#/coop/${code}?host=1&stage=1-1&difficulty=normal`);
  if (!check(await wait(B, '[data-testid="coop-room"]', { timeout: 30000 }), `B's room ${code} opens`)) return code;
  if (!check(await wait(B, '[data-testid="coop-invite-friend"]', { timeout: 20000 }), 'B\'s room offers Invite a friend')) return code;
  await tap(B, '[data-testid="coop-invite-friend"]');
  if (check(await wait(B, '[data-testid="coop-candidate-invite"]', { timeout: 15000 }), 'B\'s candidates list Aiko')) {
    await tap(B, '[data-testid="coop-candidate-invite"]');
  }
  check(await wait(B, '[data-testid="coop-invited"]', { timeout: 15000 }), `B invited A into ${code} (the "Invited:" chip)`);
  return code;
}

let A;
let B;
try {
  // ---- 1. offline: never online --------------------------------------------------------------------------------
  log('\n--- offline ---');
  A = await openPage('A');
  await A.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await A.evaluate(() => localStorage.clear());
  await A.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await lobby(A);
  check(await wait(A, '#app [data-testid="lobby-multiplayer"]'), 'lobby: the Multiplayer button is there');
  check(await A.locator('#app [data-testid="lobby-multiplayer-count"]').count() === 0, 'lobby: no number on it while offline');
  check(await wait(A, '#app [data-testid="lobby-tray"] [data-testid="shortcut-notice"]') && await A.locator('#app [data-testid="shortcut-gems"]').count() === 0,
    'lobby: Notice, Tasks and Login gift fold into the tray; no Buy gems');
  await tap(A, '#app [data-testid="lobby-multiplayer"]');
  check(await onScreen(A, 'multiplayer'), `the Multiplayer button opens #/multiplayer (now ${(await where(A)).hash})`);
  check(await wait(A, '#app [data-testid="mp-coop"]') && await wait(A, '#app [data-testid="mp-create"][data-primary]'), 'hub: the Co-op card with Create room (the primary)');
  check(await A.locator('#app [data-testid="mp-tiles"] > *').count() === 4, 'hub: four tiles (PvP, Friends, Titan Co-op, Clan Boss)');
  check((await A.locator('#app .ui-host').getAttribute('data-host')) === 'momo', 'hub: Momo hosts');
  check(await A.evaluate(() => !document.querySelector('#app [data-testid="mp-invite"]') && !!document.querySelector('#app [data-testid="mp-invites"]')?.hidden),
    'hub offline: no invite rows (and no empty box)');
  const quickOff = await A.evaluate(() => {
    const b = document.querySelector('#app [data-testid="mp-quick"]');
    return { disabled: !!b?.disabled, why: b?.closest('.ui-sec-wrap')?.querySelector('.ui-sec-why')?.textContent || '' };
  });
  check(quickOff.disabled && /online/i.test(quickOff.why), `hub offline: Quick join is off with its reason ("${quickOff.why}")`);
  await A.waitForTimeout(1500);
  const acct = await A.evaluate(async () => {
    const b = (await import('/src/online/backend.js')).getBackend();
    const db = JSON.parse(localStorage.getItem('ss-online-db') || 'null');
    return { uid: b.uid, connected: b.status.connected, tab: sessionStorage.getItem('ss-online-tab'), users: db?.users ? Object.keys(db.users).length : 0, name: sessionStorage.getItem('ss-online-v1') };
  });
  check(!acct.uid && !acct.connected && !acct.tab && !acct.users && !acct.name, `hub offline: no online account was made (${JSON.stringify(acct)})`);
  await shot(A, 'mp-offline');
  await probeBoth(A, 'hub-offline');

  // ---- 2. PvP and Titan Co-op ---------------------------------------------------------------------------------
  log('\n--- PvP and Titan Co-op ---');
  await tap(A, '#app [data-testid="mp-pvp"]');
  if (check(await wait(A, '[data-testid="mp-rival-sheet"]'), 'PvP opens the Rival Run sheet')) {
    const sheet = await A.evaluate(() => {
      const s = document.querySelector('[data-testid="mp-rival-sheet"]');
      return {
        chips: [...s.querySelectorAll('.mp-rival-chip')].map((c) => c.textContent),
        buttons: [...s.querySelectorAll('button')].map((b) => b.dataset.testid || b.textContent),
        soon: !!s.querySelector('.ui-bdg.soon'),
        text: s.innerText,
      };
    });
    check(JSON.stringify(sheet.chips) === JSON.stringify(['Lv 50', 'No gear', 'P0', '3 scored runs a day']), `Rival Run: the four rule chips (${sheet.chips.join(' · ')})`);
    check(sheet.buttons.length === 1 && sheet.buttons[0] === 'mp-rival-sheet-close', `Rival Run: nothing in the sheet acts but its close (${sheet.buttons.join(', ')})`);
    check(sheet.soon && /Rival Tokens/.test(sheet.text), 'Rival Run: "Coming soon" and the rewards line');
    check((await where(A)).hash === '#/multiplayer', 'PvP: the route stays');
    await shot(A, 'mp-pvp-sheet');
    await tap(A, '[data-testid="mp-rival-sheet-close"]');
    await wait(A, '[data-testid="mp-rival-sheet"]', { state: 'detached' });
  }
  const titan = await A.evaluate(() => { const t = document.querySelector('#app [data-testid="mp-titan"]'); return { locked: t?.dataset.locked, soon: t?.querySelector('.ui-bdg.soon')?.textContent || '' }; });
  check(titan.locked === 'soon' && /Soon/.test(titan.soon), `Titan Co-op wears "Soon" (${titan.soon})`);
  await tap(A, '#app [data-testid="mp-titan"]');
  await A.waitForTimeout(600);
  check((await where(A)).hash === '#/multiplayer' && !(await A.locator('.ui-layer').count()), 'Titan Co-op starts nothing (the route stays, no sheet)');

  // ---- 3. Friends; B asks A to be friends -------------------------------------------------------------------------
  log('\n--- Friends ---');
  await tap(A, '#app [data-testid="mp-friends"]');
  await setName(A, 'Aiko'); // (the Messages screen's own sign-in: the hub never asked)
  check(await onScreen(A, 'messages', '#/messages') && (await where(A)).hash.includes('tab=friends'), `Friends opens Messages › Friends (now ${(await where(A)).hash})`);
  // (the Messages screen's one-time "Be kind" note)
  if (await wait(A, '[data-testid="intro-ok"]', { timeout: 6000 })) await A.evaluate(() => document.querySelector('[data-testid="intro-ok"]')?.click());
  const aUid = await uidOf(A);
  B = await openPage('B');
  await B.goto(`${base}#/chat`, { waitUntil: 'load' });
  await setName(B, 'Bea');
  await onScreen(B, 'chat');
  const bUid = await uidOf(B);
  check(!!aUid && !!bUid && aUid !== bUid, 'A and B are two players');
  await B.evaluate(async (to) => (await import('/src/online/backend.js')).getBackend().addFriend(to), aUid);
  await go(A, '#/multiplayer');
  await onScreen(A, 'multiplayer');
  await closeToasts(A);
  check(await until(A, () => document.querySelector('#app [data-testid="mp-friends-count"]')?.textContent === '1', null, 20000), 'Friends: a red 1 for B\'s friend request');
  await A.evaluate(async () => {
    const b = (await import('/src/online/backend.js')).getBackend();
    const r = await b.friendRequests();
    for (const q of r.incoming || []) await b.answerFriend(q.id, true);
  });

  // ---- 4. B invites A: the lobby's red 1, Join from the hub ------------------------------------------------------
  log('\n--- an invite ---');
  const code1 = await hostAndInvite(B);
  await lobby(A);
  await closeToasts(A);
  check(await until(A, () => document.querySelector('#app [data-testid="lobby-multiplayer-count"]')?.textContent === '1', null, 20000),
    `lobby: the Multiplayer button shows a red 1 (now "${await text(A, '#app [data-testid="lobby-multiplayer-count"]')}")`);
  check(/1 open invite/.test((await A.locator('#app [data-testid="lobby-multiplayer"]').getAttribute('aria-label')) || ''), 'lobby: its name says "1 open invite"');
  await shot(A, 'lobby-invite');
  await probeBoth(A, 'lobby-invite', { kind: 'hub' });
  await closeToasts(A);
  await tap(A, '#app [data-testid="lobby-multiplayer"]');
  await onScreen(A, 'multiplayer');
  check(await until(A, (c) => !!document.querySelector(`#app [data-testid="mp-invite"][data-room="${c}"]`), code1, 20000), `hub: B's invite into ${code1} is listed`);
  check((await text(A, '#app .ui-host-bubble')).includes('invited'), `hub: Momo says a friend invited you ("${await text(A, '#app .ui-host-bubble')}")`);
  await shot(A, 'mp-invite');
  await probeBoth(A, 'hub-invite');
  await tap(A, `#app [data-testid="mp-invite"][data-room="${code1}"] [data-testid="mp-invite-join"]`);
  check(await onScreen(A, 'coop', `#/coop/${code1}`), `Join opens B's room (now ${(await where(A)).hash})`);
  check(await until(A, (c) => document.querySelector('[data-testid="coop-room-code"]')?.textContent === c, code1, 20000), `A is in room ${code1}`);
  check(await until(B, () => !!document.querySelector('[data-testid="coop-player-1"]'), null, 30000), 'B sees A seated in the room');
  await tap(A, '[data-testid="coop-leave"]');
  await onScreen(A, 'coop', '#/coop');
  await tap(B, '[data-testid="coop-leave"]');
  await onScreen(B, 'coop', '#/coop');

  // ---- 5. Quick join -------------------------------------------------------------------------------------------
  log('\n--- Quick join ---');
  const code2 = await hostAndInvite(B);
  await go(A, '#/multiplayer');
  await onScreen(A, 'multiplayer');
  await closeToasts(A);
  check(await until(A, (c) => !!document.querySelector(`#app [data-testid="mp-invite"][data-room="${c}"]`) && !document.querySelector('#app [data-testid="mp-quick"]')?.disabled, code2, 20000),
    'Quick join is on with a friend\'s open invite');
  await tap(A, '#app [data-testid="mp-quick"]');
  check(await onScreen(A, 'coop', `#/coop/${code2}`), `Quick join opens the newest friend's room ${code2} (now ${(await where(A)).hash})`);
  await tap(A, '[data-testid="coop-leave"]');
  await onScreen(A, 'coop', '#/coop');
  await tap(B, '[data-testid="coop-leave"]'); // (the host's Leave expires its invites)
  await onScreen(B, 'coop', '#/coop');
  await go(A, '#/multiplayer');
  await onScreen(A, 'multiplayer');
  check(await until(A, () => !!document.querySelector('#app [data-testid="mp-invites-none"]'), null, 20000), 'no invite left: one calm line');
  const quickNone = await A.evaluate(() => {
    const b = document.querySelector('#app [data-testid="mp-quick"]');
    return { disabled: !!b?.disabled, why: b?.closest('.ui-sec-wrap')?.querySelector('.ui-sec-why')?.textContent || '' };
  });
  check(quickNone.disabled && /friend or clanmate/.test(quickNone.why), `Quick join is off with its reason ("${quickNone.why}")`);

  // ---- 6. Clan Boss ---------------------------------------------------------------------------------------------
  log('\n--- Clan Boss ---');
  check(await until(A, () => /Find a clan/.test(document.querySelector('#app [data-testid="mp-clanboss"]')?.innerText || ''), null, 15000), 'Clan Boss with no clan: "Find a clan first"');
  await tap(A, '#app [data-testid="mp-clanboss"]');
  check(await onScreen(A, 'clan', '#/clan') && !(await where(A)).hash.includes('tab=boss'), `Clan Boss with no clan opens the clan search (now ${(await where(A)).hash})`);
  check(await wait(A, '[data-testid="clan-search"]', { timeout: 20000 }), 'the clan search is there');
  await A.evaluate(async () => (await import('/src/online/backend.js')).getBackend().createClan({ name: 'Petal Club', tag: 'PTL' }));
  await go(A, '#/multiplayer');
  await onScreen(A, 'multiplayer');
  check(await until(A, () => !!document.querySelector('#app [data-testid="mp-clanboss-time"]'), null, 20000), 'Clan Boss in a clan: the week\'s countdown chip');
  await tap(A, '#app [data-testid="mp-clanboss"]');
  check(await onScreen(A, 'clan', '#/clan') && (await where(A)).hash.includes('tab=boss'), `Clan Boss in a clan opens the boss tab (now ${(await where(A)).hash})`);
  check(await wait(A, '[data-testid="boss-reset"]', { timeout: 25000 }), 'the clan boss tab shows its week');
} catch (e) {
  failures.push(`crashed: ${e.stack || e.message}`);
  log(`  FAIL crashed: ${e.stack || e.message}`);
}

check(!errors.length, `no console errors${errors.length ? `\n       ${errors.slice(0, 8).join('\n       ')}` : ''}`);
await browser.close();
await server.close();
log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
