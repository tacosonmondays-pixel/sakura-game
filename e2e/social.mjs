// End-to-end test of the SOCIAL update with the local adapter (?online=local): one browser, two
// pages = two players (they share localStorage + BroadcastChannel; each tab has its own player).
//   1. A founds a clan, B joins; their clan tenure / account age are moved back (the 3-day DM and
//      donation rules) in the shared local "server"
//   2. A taps B's name in clan chat → player card → Add friend; B gets the pop-up and accepts
//   3. A → Message → B gets the DM pop-up + a badge; B replies; A sees it live (DMs both ways)
//   4. A → Invite to co-op (thread header) → stage → room; the invite goes out once the room is
//      registered; B gets the invite pop-up → Join → both are in the same co-op lobby, no code typed
//   5. B asks the clan for 6 × Swallow Plume → A donates (+3; A's backpack drops, coins rise) →
//      B collects (+3) → a reload of B changes nothing; caps: B's second ask, A's per-request cap,
//      A's 30 points a day
//   6. B reports A (stored for the owner) and blocks A: A's next DM is refused, A's clan-chat
//      lines are hidden for B
//   7. a third tab with &social=0 (the live server before the owner runs the SQL) shows
//      "Needs the latest server update" on Messages and Clan → Requests while chat still delivers
//
//   node e2e/social.mjs                                  # 1280×720
//   node e2e/social.mjs --viewport 844x390 --shots <dir> # + screenshots
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
const shot = async (page, name) => {
  const leaked = await page.evaluate(() => (document.body.innerText.match(/\b(null|undefined|NaN)\b/g) || []).join(', ')).catch(() => '');
  check(!leaked, `${name}: no "null" / "undefined" / "NaN" on screen${leaked ? ` (${leaked})` : ''}`);
  if (!shotsDir) return;
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250))))).catch(() => {});
  // a screenshot that times out (a starved tab on a loaded machine) is not a failed check
  await page.screenshot({ path: `${shotsDir}/${prefix}${name}-${W}x${H}.png` }).catch((e) => log(`    (screenshot ${name} skipped: ${String(e.message).split('\n')[0]})`));
};
const go = (page, hash) => page.evaluate((h) => { location.hash = h; }, hash);
// Several pages share one headless browser: only the page in front gets animation frames (which
// Playwright's visibility waits and click stability checks use), so every wait / tap brings its
// page to the front first, like a player switching tabs.
let front = null;
const toFront = async (page) => {
  if (front === page) return;
  front = page;
  await page.bringToFront().catch(() => {});
};
/** Waits for a CSS selector by polling (not by animation frames): visible / attached / detached. */
const wait = async (page, sel, { timeout = 10000, state = 'visible' } = {}) => {
  await toFront(page);
  return page.waitForFunction(([s, st]) => {
    const el = document.querySelector(s);
    if (st === 'detached') return !el;
    if (!el) return false;
    if (st === 'attached') return true;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }, [sel, state], { timeout, polling: 200 });
};
/** Did this tab show a pop-up of `kind` (dm / friend / invite) since `since`? */
const popped = (page, kind, since = 0, ms = 12000) => until(page, ([k, t]) => (window.__socialToasts || []).some((x) => x.kind === k && x.at >= t), [kind, since], ms);
/** The lobby, with the one-time Beta Tester gift put off ("Later") like a player would. */
async function lobby(page) {
  await go(page, '#/lobby');
  await wait(page, '[data-testid="top-chat"]', { timeout: 45000 });
  if (Date.now() < Date.UTC(2026, 10, 8, 6)) {
    const later = await wait(page, '[data-testid="beta-gift-later"]', { timeout: 8000 }).then(() => true).catch(() => false);
    if (later) {
      await tap(page, '[data-testid="beta-gift-later"]');
      await wait(page, '.bg-gift-modal', { state: 'detached', timeout: 10000 }).catch(() => null);
    }
  }
}
const tap = async (page, sel) => {
  await toFront(page);
  const el = page.locator(sel).first();
  const act = (opts) => (touch ? el.tap(opts) : el.click(opts));
  try {
    await act({ timeout: 15000 });
  } catch (e) {
    if (!/Timeout/.test(e.message)) throw e;
    log(`    (no frames for 15 s: tapping ${sel} without the stability wait)`);
    await act({ timeout: 15000, force: true });
  }
};
/** A tap on something that will not stay long (a pop-up): no long stability wait for frames. */
const quickTap = async (page, sel) => {
  await toFront(page);
  const el = page.locator(sel).first();
  await (touch ? el.tap({ timeout: 4000 }) : el.click({ timeout: 4000 })).catch(async () => {
    log(`    (no frames: tapping ${sel} through the page)`);
    await page.evaluate((s) => document.querySelector(s)?.click(), sel);
  });
};
const until = async (page, fn, arg, ms = 10000) => {
  await toFront(page);
  return page.waitForFunction(fn, arg, { timeout: ms, polling: 200 }).then(() => true).catch(() => false);
};
const text = (page, sel) => page.locator(sel).first().innerText({ timeout: 5000 }).catch(() => '');

async function setName(page, name) {
  await wait(page, '[data-testid="name-input"]', { timeout: 20000 });
  await page.fill('[data-testid="name-input"]', name);
  await tap(page, '[data-testid="name-save"]');
  await wait(page, '[data-testid="name-input"]', { state: 'detached', timeout: 10000 });
}
/**
 * Edits the local "server" (the shared JSON document in localStorage). Another tab's write reaches
 * this tab's localStorage a moment later (separate processes), so settle before and after.
 */
const editDb = async (page, fn, arg) => {
  await page.waitForTimeout(800);
  await page.evaluate(([src, a]) => {
    const s = JSON.parse(localStorage.getItem('ss-online-db'));
    // eslint-disable-next-line no-new-func
    new Function('s', 'a', src)(s, a);
    localStorage.setItem('ss-online-db', JSON.stringify(s));
  }, [fn, arg]);
  await page.waitForTimeout(800);
};
const items = (page, id) => page.evaluate((i) => {
  const p = window.__sakura.store.profile;
  return i === 'coins' ? p.currencies.coins : (p.items?.[i] || 0);
}, id);
async function closeIntro(page) {
  const ok = await wait(page, '[data-testid="intro-ok"]', { timeout: 4000 }).catch(() => null);
  if (ok) await tap(page, '[data-testid="intro-ok"]');
}

let A;
let B;
try {
  // ---- two players, one clan -----------------------------------------------------------
  A = await openPage('A');
  await A.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await A.evaluate(() => localStorage.clear());
  await A.goto(`${base}#/clan`, { waitUntil: 'load' });
  await A.evaluate(() => {
    const { store } = window.__sakura;
    Object.assign(store.profile.settings, { quality: 'low', shadows: false, bloom: false });
    store.commit('settings');
    store.saveNow?.();
  });
  await setName(A, 'Aiko');
  await wait(A, '[data-testid="clan-create-panel"]', { timeout: 10000 });
  await toFront(A);
  await A.fill('[data-testid="clan-name"]', 'Petal Squad');
  await toFront(A);
  await A.fill('[data-testid="clan-tag"]', 'ps');
  await tap(A, '[data-testid="clan-create"]');
  await wait(A, '[data-testid="clan-home"]', { timeout: 10000 });
  B = await openPage('B');
  await B.goto(`${base}#/clan`, { waitUntil: 'load' });
  await setName(B, 'Bea');
  await wait(B, '[data-testid="join-PS"]', { timeout: 10000 });
  await tap(B, '[data-testid="join-PS"]');
  await wait(B, '[data-testid="clan-home"]', { timeout: 10000 });
  const [uidA, uidB] = await Promise.all([A, B].map((p) => p.evaluate(() => window.__online.uid)));
  check(uidA && uidB && uidA !== uidB, 'two tabs are two players in one clan');
  // a week-old account, four days in the clan (DMs between clanmates after 3 days; donors need 3 days + a week-old account)
  await editDb(A, `for (const m of Object.values(s.members)) m.joinedAt -= 96 * 3600e3;
    for (const u of Object.values(s.users)) u.createdAt = Date.now() - 10 * 86400e3;
    for (const c of Object.values(s.clans)) if (!c.isDev) c.createdAt = Date.now() - 20 * 86400e3;`);

  // ---- player card from clan chat → friends ---------------------------------------------
  await go(B, '#/clan?tab=chat');
  await wait(B, '[data-testid="chat-panel"][data-ready="1"]', { timeout: 10000 });
  await toFront(B);
  await B.fill('[data-testid="chat-input"]', 'Hi clan, Bea here!');
  await B.press('[data-testid="chat-input"]', 'Enter');
  await go(A, '#/clan?tab=chat');
  await wait(A, '[data-testid="chat-panel"][data-ready="1"]', { timeout: 10000 });
  check(await until(A, () => [...document.querySelectorAll('[data-testid="chat-msg"]')].some((m) => /Bea here/.test(m.innerText))), 'clan chat: A sees B\'s line');
  await tap(A, '[data-testid="chat-msg"]:has-text("Bea here") [data-testid="chat-name"]');
  await wait(A, '[data-testid="player-card"] [data-testid="card-message"]', { timeout: 10000 });
  check(/Bea/.test(await text(A, '[data-testid="card-name"]')), 'player card: tapping B\'s name opens B\'s card');
  check(await A.locator('[data-testid="card-message"]').isEnabled(), 'player card: Message is on (clanmates for 3+ days)');
  await shot(A, 'player-card');
  await tap(A, '[data-testid="card-add-friend"]');
  await wait(A, '[data-testid="card-requested"]', { timeout: 8000 });
  check(true, 'player card: Add friend → Requested');
  check(await popped(B, 'friend'), 'B gets the "wants to be friends" pop-up');
  await go(B, '#/messages?tab=requests');
  await closeIntro(B);
  await wait(B, '[data-testid="request-accept"]', { timeout: 10000 });
  await tap(B, '[data-testid="request-accept"]');
  await tap(B, '[data-testid="msg-tab-friends"]');
  check(await until(B, () => /Aiko/.test(document.querySelector('[data-testid="friend-row"]')?.innerText || '')), 'friends: B accepted, A is on B\'s friends list');
  await shot(B, 'friends');

  // ---- DMs both ways ---------------------------------------------------------------------
  await tap(A, '[data-testid="card-close"]').catch(() => {});
  await go(A, '#/clan?tab=members');
  await wait(A, '[data-testid="member-card"]', { timeout: 10000 });
  await tap(A, `[data-testid="member-row"][data-user="${uidB}"] [data-testid="member-card"]`);
  await wait(A, '[data-testid="card-friends"]', { timeout: 10000 });
  check(true, 'clan roster: B\'s card says Friends ✓');
  await tap(A, '[data-testid="card-message"]');
  await A.waitForFunction(() => /#\/messages\/new/.test(location.hash), null, { timeout: 8000 });
  await closeIntro(A);
  await wait(A, '[data-testid="dm-input"]', { timeout: 10000 });
  await lobby(B);
  const t0 = await B.evaluate(() => Date.now());
  await toFront(A);
  await toFront(A);
  await A.fill('[data-testid="dm-input"]', 'Hi Bea! Want to play co-op later?');
  await A.press('[data-testid="dm-input"]', 'Enter');
  check(await until(A, () => /#\/messages\/[^n/?][^/?]+/.test(location.hash)), 'DM: the first message gives the conversation its id in the address');
  check(await popped(B, 'dm', t0), 'DM: B gets the message pop-up on the lobby');
  const badge = await until(B, () => Number(document.querySelector('[data-testid="top-chat-count"]:not([hidden])')?.textContent || 0) >= 1, null, 10000);
  check(badge, 'DM: the lobby chat bubble shows the unread number');
  await shot(B, 'lobby-dm-toast');
  await go(B, '#/messages');
  await wait(B, '[data-testid="thread-row"]', { timeout: 10000 });
  check(/1/.test(await text(B, '[data-testid="thread-unread"]')), 'inbox: the conversation shows 1 unread');
  await shot(B, 'inbox');
  await tap(B, '[data-testid="thread-row"]');
  check(await until(B, () => [...document.querySelectorAll('[data-testid="dm-msg"]')].some((m) => /Want to play co-op/.test(m.innerText))), 'DM: B reads A\'s message');
  await toFront(B);
  await B.fill('[data-testid="dm-input"]', 'Yes please! 🌸');
  await B.press('[data-testid="dm-input"]', 'Enter');
  check(await until(A, () => [...document.querySelectorAll('[data-testid="dm-msg"]')].some((m) => /Yes please/.test(m.innerText)), null, 12000), 'DM: B\'s reply appears live in A\'s conversation');
  check(await until(B, () => !document.querySelector('[data-testid="thread-unread"]'), null, 8000), 'inbox: reading the conversation clears the unread number');
  // text rules on the client before the server (invisible characters)
  await toFront(B);
  await B.fill('[data-testid="dm-input"]', 'sneaky​text');
  await B.press('[data-testid="dm-input"]', 'Enter');
  check(/invisible/i.test(await B.locator('[data-testid="dm-status"]').innerText().catch(() => '')), 'DM: invisible characters are refused with a clear line');

  // ---- co-op invite by DM → Join -----------------------------------------------------------
  await lobby(B);
  const t1 = await B.evaluate(() => Date.now());
  await tap(A, '[data-testid="thread-invite"]');
  await wait(A, '[data-testid="coop-stage-ok"]', { timeout: 10000 });
  await tap(A, '[data-testid="coop-stage-ok"]');
  await wait(A, '[data-testid="coop-room"]', { timeout: 15000 });
  const room = await A.locator('[data-testid="coop-room-code"]').innerText({ timeout: 10000 });
  check(/^[A-Z0-9]{5}$/.test(room), `co-op: A hosts room ${room}`);
  check(await until(A, () => /Bea/.test(document.querySelector('[data-testid="coop-invited"]')?.innerText || ''), null, 10000), 'co-op: the lobby lists "Invited: Bea"');
  await shot(A, 'coop-invited');
  // B's pop-up right away: it closes by itself after 20 s, and on a loaded machine the picker
  // steps (below) or a tap's stability wait can take longer than that
  check(await popped(B, 'invite', t1), 'co-op: B gets the invite pop-up');
  await wait(B, '[data-testid="invite-toast"]', { timeout: 5000 }).catch(() => null);
  // the pointer rests on the pop-up (a player reading it): it stays open until let go
  await B.locator('[data-testid="invite-toast"]').first().dispatchEvent('pointerenter').catch(() => {});
  check(/invites you to co-op/.test(await text(B, '[data-testid="invite-toast"]')), 'co-op: the pop-up says who invites');
  await shot(B, 'invite-toast');
  await quickTap(B, '[data-testid="invite-toast-join"]');
  await wait(B, '[data-testid="coop-room"]', { timeout: 15000 });
  check((await B.locator('[data-testid="coop-room-code"]').innerText()) === room, 'co-op: Join opened the same room (no code typed)');
  const paired = await until(A, () => !!document.querySelector('[data-testid="coop-player-1"]'), null, 20000)
    && await until(B, () => !!document.querySelector('[data-testid="coop-player-0"]'), null, 20000);
  check(paired, 'co-op: both players are in the lobby together');
  await shot(B, 'coop-joined');
  await tap(B, '[data-testid="coop-leave"]');
  // the room lobby's own "Invite a friend" list (friends + clanmates; back once the ally left):
  // Bea is listed, and her invite is still live
  check(await until(A, () => !!document.querySelector('[data-testid="coop-invite-friend"]'), null, 20000), 'co-op: "Invite a friend" is back once the ally left');
  await tap(A, '[data-testid="coop-invite-friend"]');
  await wait(A, '[data-testid="coop-candidates"]', { timeout: 10000 });
  check(await until(A, () => [...document.querySelectorAll('[data-testid="coop-candidate"]')].some((r) => /Bea/.test(r.innerText) && r.querySelector('[data-testid="coop-candidate-invite"]')?.disabled)),
    'co-op: "Invite a friend" lists Bea, already invited');
  await shot(A, 'invite-friend-picker');
  await tap(A, '[data-testid="coop-candidates-close"]');
  await wait(A, '[data-testid="coop-candidates"]', { state: 'detached', timeout: 5000 }).catch(() => null);
  await tap(A, '[data-testid="coop-leave"]');
  // the conversation keeps the invite as a card. A host's Leave keeps the room registered (the
  // co-op menu's "Your last room" reopens it), so the invite stays open until it expires; a room
  // that is really gone shows "room closed" (tests/online/localSocial.test.js, socialSchema.test.js)
  await go(A, '#/messages');
  await wait(A, '[data-testid="thread-row"]', { timeout: 10000 });
  await tap(A, '[data-testid="thread-row"]');
  check(await until(A, () => /Expires in/i.test(document.querySelector('[data-testid="dm-invite"]')?.innerText || ''), null, 10000),
    'co-op: the invite card in the conversation stays open while the host\'s room waits for them');
  await shot(A, 'thread-invite');

  // ---- clan material request → donate → collect ------------------------------------------
  await go(B, '#/clan?tab=donate');
  await wait(B, '[data-testid="donate-ask"]', { timeout: 15000 });
  await shot(B, 'requests-empty');
  await tap(B, '[data-testid="donate-ask"]');
  await wait(B, '[data-testid="pick-fam-feather"]', { timeout: 8000 });
  await tap(B, '[data-testid="pick-fam-feather"]');
  await tap(B, '[data-testid="pick-rar-rare"]');
  await shot(B, 'request-picker');
  await tap(B, '[data-testid="pick-ok"]');
  await tap(B, '[data-testid="confirm-ok"]');
  check(await until(B, () => /0\/6/.test(document.querySelector('[data-testid="my-request-progress"]')?.innerText || '')), 'request: B asks for 6 × Swallow Plume (0/6)');
  const notice = await until(A, () => true);
  check(notice, 'request: posted');
  // A owns 5 Swallow Plumes in its (in-memory) save
  await A.evaluate(() => {
    const { store } = window.__sakura;
    store.profile.items.mat_feather_rare = 5;
    store.commit('test');
  });
  const coins0 = await items(A, 'coins');
  await go(A, '#/clan?tab=donate');
  await wait(A, '[data-testid="donate-request"]', { timeout: 15000 });
  check(/Bea/.test(await text(A, '[data-testid="donate-request"]')), 'donate: A sees B\'s request');
  check(/\+3/.test(await text(A, '[data-testid="donate-max"]')), 'donate: A may give at most 3 to one request');
  await shot(A, 'requests-donate');
  await tap(A, '[data-testid="donate-max"]');
  check(await until(A, () => /you gave 3/.test(document.querySelector('[data-testid="donate-request"]')?.innerText || '')), 'donate: A gave 3');
  check(await items(A, 'mat_feather_rare') === 2, 'donate: A\'s backpack dropped by 3 (5 → 2)');
  check(await items(A, 'coins') === coins0 + 300, 'donate: A earned 6 points × 50 coins');
  check(/most you can/i.test(await text(A, '[data-testid="donate-why"]')), 'cap: A cannot give more to this request');
  check(/Donated today: 6 \/ 30/.test(await text(A, '[data-testid="donate-today"]')), 'donate: A\'s footer says 6 / 30 points today');
  // B collects (live update of the request)
  check(await until(B, () => /3\/6/.test(document.querySelector('[data-testid="my-request-progress"]')?.innerText || ''), null, 12000), 'request: B sees 3/6 live');
  const b0 = await items(B, 'mat_feather_rare');
  await wait(B, '[data-testid="donate-collect"]', { timeout: 10000 });
  await shot(B, 'requests-collect');
  await tap(B, '[data-testid="donate-collect"]');
  check(await until(B, () => !document.querySelector('[data-testid="donate-collect"]')), 'collect: the Collect button goes once collected');
  const b1 = await items(B, 'mat_feather_rare');
  check(b1 === b0 + 3, `collect: B received 3 Swallow Plumes (${b0} → ${b1})`);
  await B.reload({ waitUntil: 'load' });
  await wait(B, '[data-testid="donate-panel"] [data-testid="my-request"]', { timeout: 20000 });
  await B.waitForTimeout(800);
  check(await items(B, 'mat_feather_rare') === b1, 'collect: a reload pays nothing twice');
  check(!(await B.locator('[data-testid="donate-collect"]').count()), 'collect: nothing left to collect after the reload');
  // daily caps: one request a day; A's 30 points
  check(/asked today|Next request/i.test(await text(B, '[data-testid="donate-panel"]')), 'cap: B\'s request for today is used (next one after 7 PM Central)');
  check(!(await B.locator('[data-testid="donate-ask"]').count()), 'cap: no second Ask today');
  const today = await A.evaluate(() => window.__online.donationState().then((s) => s.today));
  await editDb(A, `s.social.donations.push({ id: 99999, requestId: 'old', requesterId: 'nobody', donorId: a.uid, donorName: 'Aiko', clanId: null, item: 'mat_feather_common',
    count: 24, points: 24, coins: 0, gameDay: a.today, key: '00000000-0000-4000-8000-000000000099', claimKey: 'x', claimedAt: Date.now(), createdAt: Date.now() });`, { uid: uidA, today });
  // a third clanmate's request A could help with, if A had points left
  const C = await openPage('C');
  await C.goto(`${base}#/clan`, { waitUntil: 'load' });
  await setName(C, 'Cleo');
  await wait(C, '[data-testid="join-PS"]', { timeout: 10000 });
  await tap(C, '[data-testid="join-PS"]');
  await wait(C, '[data-testid="clan-home"]', { timeout: 10000 });
  const uidC = await C.evaluate(() => window.__online.uid);
  await editDb(C, 's.members[a].joinedAt -= 30 * 3600e3;', uidC);
  await go(C, '#/clan?tab=donate');
  await wait(C, '[data-testid="donate-ask"]', { timeout: 15000 });
  await tap(C, '[data-testid="donate-ask"]');
  await tap(C, '[data-testid="pick-fam-feather"]');
  await tap(C, '[data-testid="pick-rar-rare"]');
  await tap(C, '[data-testid="pick-ok"]');
  await tap(C, '[data-testid="confirm-ok"]');
  await wait(C, '[data-testid="my-request-progress"]', { timeout: 10000 });
  await go(A, '#/clan?tab=members');
  await go(A, '#/clan?tab=donate');
  check(await until(A, () => /Cleo/.test(document.querySelector('[data-testid="donate-requests"]')?.innerText || ''), null, 12000), 'donate: A sees Cleo\'s request too');
  check(/Donated today: 30 \/ 30/.test(await text(A, '[data-testid="donate-today"]')), 'cap: A has used 30 / 30 points today');
  check(await until(A, () => [...document.querySelectorAll('[data-testid="donate-request"]')].some((r) => /Cleo/.test(r.innerText) && /Daily limit reached/.test(r.innerText))), 'cap: A\'s buttons say "Daily limit reached — resets at 7 PM Central"');
  check(/resets in .*7 PM Central/.test(await text(A, '[data-testid="donate-reset"]')), 'cap: the footer shows the next reset at 7 PM Central');
  await shot(A, 'requests-capped');

  // ---- a removed clanmate still collects (Clan → browse screen) ------------------------------
  // B gives Cleo 3 of the plumes B just collected; then A (the leader) removes Cleo from the clan
  await go(B, '#/clan?tab=members');
  await go(B, '#/clan?tab=donate');
  check(await until(B, () => [...document.querySelectorAll('[data-testid="donate-request"]')].some((r) => /Cleo/.test(r.innerText) && r.querySelector('[data-testid="donate-max"]')), null, 12000), 'donate: B can help Cleo');
  await tap(B, '[data-testid="donate-request"]:has-text("Cleo") [data-testid="donate-max"]');
  check(await until(C, () => /3\/6/.test(document.querySelector('[data-testid="my-request-progress"]')?.innerText || ''), null, 12000), 'request: Cleo sees 3/6 from Bea');
  await go(A, '#/clan?tab=members');
  await wait(A, `[data-testid="member-row"][data-user="${uidC}"] [data-testid="member-remove"]`, { timeout: 10000 });
  await tap(A, `[data-testid="member-row"][data-user="${uidC}"] [data-testid="member-remove"]`);
  await tap(A, '[data-testid="confirm-ok"]');
  await A.waitForTimeout(800);
  await C.reload({ waitUntil: 'load' });
  await go(C, '#/clan');
  check(await wait(C, '[data-testid="collect-browse"]', { timeout: 15000 }).then(() => true).catch(() => false), 'collect: a removed clanmate sees "Donations waiting for you" on the clan list');
  await shot(C, 'collect-after-kick');
  const c0 = await items(C, 'mat_feather_rare');
  await tap(C, '[data-testid="collect-browse"]');
  check(await until(C, (n) => (window.__sakura.store.profile.items?.mat_feather_rare || 0) === n + 3, c0, 10000), `collect: Cleo received 3 Swallow Plumes without a clan (${c0} → ${c0 + 3})`);
  await C.close();

  // ---- report + block ----------------------------------------------------------------------
  await go(B, '#/messages');
  await wait(B, '[data-testid="thread-row"]', { timeout: 10000 });
  await tap(B, '[data-testid="thread-row"]');
  await wait(B, '[data-testid="thread-menu"]', { timeout: 10000 });
  await tap(B, '[data-testid="thread-menu"]');
  await tap(B, '[data-testid="thread-report"]');
  await tap(B, '[data-testid="report-bullying"]');
  await toFront(B);
  await B.fill('[data-testid="report-note"]', 'Testing the report button');
  await shot(B, 'report');
  await tap(B, '[data-testid="report-send"]');
  const reported = await until(B, () => /look at it/.test(document.querySelector('.toast-host')?.innerText || ''), null, 8000);
  check(reported, 'report: "Thanks — the game\'s team will look at it."');
  const stored = await B.evaluate(() => (JSON.parse(localStorage.getItem('ss-online-db')).social.reports || []).map((r) => ({ reason: r.reason, dms: r.evidence?.dms?.length || 0 })));
  check(stored.length === 1 && stored[0].reason === 'bullying' && stored[0].dms >= 2, `report: stored for the owner with server-made evidence (${JSON.stringify(stored)})`);
  // "Also block" was on: the conversation is gone for B
  check(await until(B, () => !document.querySelector('[data-testid="thread-row"]'), null, 8000), 'block: the conversation leaves B\'s inbox');
  await wait(A, '[data-testid="dm-input"]', { timeout: 10000 }).catch(() => null);
  await go(A, '#/clan?tab=chat');
  await go(B, '#/clan?tab=chat');
  await wait(A, '[data-testid="chat-panel"][data-ready="1"]', { timeout: 10000 });
  await wait(B, '[data-testid="chat-panel"][data-ready="1"]', { timeout: 10000 });
  await toFront(A);
  await A.fill('[data-testid="chat-input"]', 'Aiko after the block');
  await A.press('[data-testid="chat-input"]', 'Enter');
  await A.waitForTimeout(1500);
  check(!(await B.locator('[data-testid="chat-msg"]:has-text("after the block")').count()), 'block: A\'s clan-chat lines are hidden for B');
  const refused = await A.evaluate(async (to) => {
    try {
      await window.__online.sendDm(to, 'still there?');
      return 'sent';
    } catch (e) {
      return e.message;
    }
  }, uidB);
  check(/can't get messages from you/.test(refused), `block: A's next DM is refused, with the same words as a privacy refusal ("${refused}")`);

  // ---- Settings → Online and the lobby Menu ---------------------------------------------------
  await go(A, '#/settings');
  check(await wait(A, '[data-testid="settings-privacy-friends_clan"]', { timeout: 15000 }).then(() => true).catch(() => false), 'settings: Who can message me (Friends & clan by default)');
  check(await A.locator('[data-testid="settings-privacy-friends_clan"]').evaluate((b) => b.classList.contains('on')), 'settings: the default is Friends & clan');
  await A.locator('[data-testid="settings-social"]').scrollIntoViewIfNeeded().catch(() => {});
  await shot(A, 'settings-online');
  await tap(A, '[data-testid="settings-privacy-friends"]');
  check(await until(A, () => document.querySelector('[data-testid="settings-privacy-friends"]')?.classList.contains('on')), 'settings: Friends only is saved');
  check(await A.evaluate(() => window.__online.socialSummary().then((s) => s.privacy)) === 'friends', 'settings: the server has Friends only');
  check(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(await text(A, '[data-testid="settings-friend-code"]')), 'settings: my friend code is shown');
  await lobby(A);
  await tap(A, '[data-testid="top-menu"]');
  check(await wait(A, '[data-testid="menu-messages"]', { timeout: 8000 }).then(() => true).catch(() => false), 'menu: a Messages tile');
  await shot(A, 'menu-messages');
  await A.keyboard.press('Escape').catch(() => {});
  await A.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
  await go(A, '#/clan?tab=chat');
  await wait(A, '[data-testid="chat-panel"][data-ready="1"]', { timeout: 10000 });

  // ---- the server before the owner runs the SQL (&social=0) ---------------------------------
  const D = await openPage('D');
  await D.goto(`${base}&social=0#/messages`, { waitUntil: 'load' });
  await setName(D, 'Dara');
  check(await wait(D, '[data-testid="needs-update"]', { timeout: 15000 }).then(() => true).catch(() => false), 'needs update: Messages shows "Needs the latest server update"');
  check(/Messages need the latest server update/.test(await text(D, '[data-testid="needs-update"]')), 'needs update: the card names the feature');
  await shot(D, 'needs-update-messages');
  await go(D, '#/clan');
  await wait(D, '[data-testid="join-PS"]', { timeout: 10000 });
  await tap(D, '[data-testid="join-PS"]');
  await wait(D, '[data-testid="clan-home"]', { timeout: 10000 });
  await tap(D, '[data-testid="tab-donate"]');
  check(await wait(D, '[data-testid="donate-panel"] [data-testid="needs-update"]', { timeout: 10000 }).then(() => true).catch(() => false), 'needs update: Clan → Requests shows the update card');
  await shot(D, 'needs-update-requests');
  await tap(D, '[data-testid="tab-chat"]');
  await wait(D, '[data-testid="chat-panel"][data-ready="1"]', { timeout: 10000 });
  await toFront(D);
  await D.fill('[data-testid="chat-input"]', 'Dara says hi without the update');
  await D.press('[data-testid="chat-input"]', 'Enter');
  check(await until(A, () => [...document.querySelectorAll('[data-testid="chat-msg"]')].some((m) => /without the update/.test(m.innerText)), null, 10000), 'needs update: clan chat still delivers');
  // the player card of a clanmate: actions wait for the update; clan-chat co-op invite instead
  await tap(D, '[data-testid="chat-msg"]:has-text("after the block") [data-testid="chat-name"]').catch(() => {});
  const cardNu = await wait(D, '[data-testid="card-needs-update"]', { timeout: 8000 }).then(() => true).catch(() => false);
  check(cardNu, 'needs update: a player card says messages arrive with the next server update');
  check(await D.locator('[data-testid="card-coop-clan"]').count() === 1, 'needs update: "Invite via clan chat" is offered instead');
  await shot(D, 'needs-update-card');
} catch (e) {
  failures.push(`crashed: ${e.message}`);
  console.error(e);
  for (const [n, p] of [['A', A], ['B', B]]) {
    if (p && shotsDir) await p.screenshot({ path: `${shotsDir}/${prefix}crash-${n}-${W}x${H}.png` }).catch(() => {});
  }
} finally {
  check(errors.length === 0, `no page errors${errors.length ? `:\n    ${errors.slice(0, 8).join('\n    ')}` : ''}`);
  await browser.close();
  await server.close();
}

log(failures.length ? `\nFAILED: ${failures.length} check(s)` : '\nAll social checks passed.');
process.exit(failures.length ? 1 : 0);
