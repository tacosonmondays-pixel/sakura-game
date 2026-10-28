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
//   6. B holds one of A's messages and reports that one, then reports A again from the menu (the
//      evidence keeps the first) and blocks A: A's next DM is refused, A's clan-chat lines and the
//      clan notices naming A are hidden for B
//   7. a third tab with &social=0 (the live server before the owner runs the SQL) shows
//      "Needs the latest server update" on Messages and Clan → Requests while chat still delivers
//   + player tags: B is made a developer in the local "server" (the owner's SQL editor); both are
//     alpha testers (stamped at sign-up). Clan chat shows one chip per line (B: DEV, A's own line:
//     ALPHA), B's card shows DEV + ALPHA, the roster / Messages rows / chat drawer show chips, B's
//     own profile header shows DEV + ALPHA and B's title picker lists Developer + Alpha Tester while
//     A's lists only Alpha Tester; a tab against a server without the table (&tags=0) shows no chip;
//     friend / request / roster rows keep short names whole next to the chip; B wears Developer and the
//     Preview (what others see) shows it only while the server backs it (taken away, given back)
//   + clan invites: a clanmate's conversation menu offers no "Invite to [TAG]"; invite rows keep the clan
//     name whole; a clanmate's recruiting card says "Your clan" with no Join
//   + the verifier fixes: Join on a pop-up closes the open Menu first; the ally's card in the room
//     says "In your co-op room"; the host's Leave expires its invites (card "Expired", Co-op →
//     Invites empty); a brand-new conversation shows the other player's first message at once
//
//   node e2e/social.mjs                                  # 1280×720
//   node e2e/social.mjs --viewport 844x390 --shots <dir> # + screenshots
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1
// when a check fails.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium, ownSave } from './browser.mjs';

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
// ?onboarding=0: the players are fresh saves that go to the lobby, so Hikari's opening and the
// coached first battle are marked skipped (as in the other feature checks; story/tutorial test them)
const base = `http://127.0.0.1:${port}/?online=local&onboarding=0`;
const { browser, label } = await launchChromium();
log(`browser: ${label} · viewport ${W}x${H}`);

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
  // ---- player tags: both signed up during the alpha; B is made a developer (the owner's SQL editor) ----
  const tagRows = await A.evaluate(([a, b]) => (JSON.parse(localStorage.getItem('ss-online-db')).tags || {}), [uidA, uidB]);
  check(tagRows[uidA]?.tester === 'alpha' && tagRows[uidB]?.tester === 'alpha' && !tagRows[uidA]?.staff, 'tags: a new player during the alpha is an alpha tester');
  await editDb(A, 's.tags[a] = { ...s.tags[a], staff: \'dev\' };', uidB);
  // fresh tabs: the tag cache keeps an answer for 10 minutes, and each tab learns its own tags once
  for (const p of [A, B]) {
    await toFront(p);
    await p.reload({ waitUntil: 'load' });
    await wait(p, '[data-testid="clan-home"]', { timeout: 45000 });
  }
  const chipTags = (page, sel) => page.evaluate((x) => [...document.querySelectorAll(`${x} [data-testid="tag-chip"]`)].map((c) => c.dataset.tag).join(','), sel);
  /** Rows matching `sel`: the name is shown whole (a short name never squeezed by the chips) and every part of the top line stays inside the row. */
  const namesWhole = (page, sel) => page.evaluate((x) => {
    const rows = [...document.querySelectorAll(x)];
    return rows.length > 0 && rows.every((row) => {
      const b = row.querySelector('.sc-row-top b, .ol-member-name b');
      const r = row.getBoundingClientRect();
      const inside = [...row.querySelectorAll('[data-testid="tag-chips"], .ol-lv, button')].every((c) => { const q = c.getBoundingClientRect(); return q.width === 0 || (q.right <= r.right + 1 && q.left >= r.left - 1); });
      return b && b.scrollWidth <= b.clientWidth && inside;
    });
  }, sel);

  // ---- player card from clan chat → friends ---------------------------------------------
  await go(B, '#/clan?tab=chat');
  await wait(B, '[data-testid="chat-panel"][data-ready="1"]', { timeout: 10000 });
  await toFront(B);
  await B.fill('[data-testid="chat-input"]', 'Hi clan, Bea here!');
  await B.press('[data-testid="chat-input"]', 'Enter');
  await go(A, '#/clan?tab=chat');
  await wait(A, '[data-testid="chat-panel"][data-ready="1"]', { timeout: 10000 });
  check(await until(A, () => [...document.querySelectorAll('[data-testid="chat-msg"]')].some((m) => /Bea here/.test(m.innerText))), 'clan chat: A sees B\'s line');
  // tags in chat: one chip per line, DEV beats ALPHA; A's own line shows A's ALPHA chip
  check(await until(A, (b) => document.querySelector(`[data-testid="chat-msg"][data-user="${b}"] [data-testid="tag-chips"]`)?.dataset.tags === 'dev', uidB),
    'tags: B\'s chat line shows one chip, DEV (a developer who is also an alpha tester)');
  await toFront(A);
  await A.fill('[data-testid="chat-input"]', 'Hi Bea, Aiko here 🌸');
  await A.press('[data-testid="chat-input"]', 'Enter');
  check(await until(A, (a) => [...document.querySelectorAll(`[data-testid="chat-msg"][data-user="${a}"]`)].some((m) => /Aiko here/.test(m.innerText) && m.querySelector('[data-testid="tag-chips"]')?.dataset.tags === 'alpha'), uidA),
    'tags: A\'s own chat line shows A\'s ALPHA chip');
  check(await until(B, (a) => [...document.querySelectorAll(`[data-testid="chat-msg"][data-user="${a}"]`)].some((m) => /Aiko here/.test(m.innerText) && m.querySelector('[data-testid="tag-chip"]')?.getAttribute('aria-label') === 'Alpha Tester'), uidA, 12000),
    'tags: B sees A\'s line with the ALPHA chip (aria-label "Alpha Tester")');
  check(await A.evaluate(() => [...document.querySelectorAll('[data-testid="chat-msg"]')].every((m) => {
    const head = m.querySelector('.ol-msg-head');
    const r = head.getBoundingClientRect();
    return [...head.children].every((c) => { const q = c.getBoundingClientRect(); return q.right <= r.right + 1 && q.left >= r.left - 1; });
  })), 'tags: the chips never push the level chip or the time off the line');
  await shot(A, 'tags-chat');
  await tap(A, '[data-testid="chat-msg"]:has-text("Bea here") [data-testid="chat-name"]');
  await wait(A, '[data-testid="player-card"] [data-testid="card-message"]', { timeout: 10000 });
  check(/Bea/.test(await text(A, '[data-testid="card-name"]')), 'player card: tapping B\'s name opens B\'s card');
  check(await until(A, () => document.querySelector('[data-testid="player-card"] [data-testid="tag-chips"]')?.dataset.tags === 'dev alpha'), 'tags: B\'s card shows every chip: DEV + ALPHA');
  check((await chipTags(A, '[data-testid="player-card"]')) === 'dev,alpha' && await A.evaluate(() => document.querySelector('[data-testid="player-card"] [data-tag="dev"]')?.title === 'Developer'),
    'tags: the card\'s DEV chip says "Developer"');
  await shot(A, 'tags-card');
  // the default "Who can message me" is Friends only (REVERIFY M4): a clanmate of 3+ days is no friend yet
  check(!(await A.locator('[data-testid="card-message"]').isEnabled()), 'player card: Message waits for a friendship (the default is Friends only)');
  check(/Friends only/.test(await text(A, '[data-testid="card-why"]')), 'player card: says why (my own setting, Friends only)');
  await shot(A, 'player-card');
  await tap(A, '[data-testid="card-add-friend"]');
  await wait(A, '[data-testid="card-requested"]', { timeout: 8000 });
  check(true, 'player card: Add friend → Requested');
  check(await popped(B, 'friend'), 'B gets the "wants to be friends" pop-up');
  await go(B, '#/messages?tab=requests');
  await closeIntro(B);
  await wait(B, '[data-testid="request-accept"]', { timeout: 10000 });
  check(await until(B, () => document.querySelector('[data-testid="request-row"] [data-testid="tag-chips"]')?.dataset.tags === 'alpha'), 'tags: the friend request that asked B shows A\'s ALPHA chip');
  check(await namesWhole(B, '[data-testid="request-row"]'), 'tags: the request row keeps A\'s name whole next to the chip and Accept / Decline');
  await shot(B, 'tags-requests');
  await tap(B, '[data-testid="request-accept"]');
  await tap(B, '[data-testid="msg-tab-friends"]');
  check(await until(B, () => /Aiko/.test(document.querySelector('[data-testid="friend-row"]')?.innerText || '')), 'friends: B accepted, A is on B\'s friends list');
  check(await until(B, () => document.querySelector('[data-testid="friend-row"] [data-testid="tag-chips"]')?.dataset.tags === 'alpha'), 'tags: the friends list shows A\'s ALPHA chip');
  check(await namesWhole(B, '[data-testid="friend-row"]'), 'tags: the friend row keeps A\'s name whole next to the chip and Message');
  await shot(B, 'friends');

  // ---- player tags: B's own profile header, B's and A's title pickers ------------------------------
  await tap(A, '[data-testid="card-close"]').catch(() => {});
  await wait(A, '[data-testid="player-card"]', { state: 'detached', timeout: 5000 }).catch(() => null);
  await go(B, '#/profile');
  await wait(B, '[data-testid="profile-identity"]', { timeout: 15000 });
  check(await until(B, () => document.querySelector('[data-testid="profile-identity"] [data-testid="tag-chips"]')?.dataset.tags === 'dev alpha'),
    'tags: B\'s own profile header shows every chip: DEV + ALPHA');
  check(await B.evaluate(() => { const c = window.__sakura.store.profile.missions.counters; return c['tag:dev'] === 1 && c['tag:alpha'] === 1 && !c['tag:beta']; }),
    'tags: B\'s save keeps its own tags as marks (tag:dev, tag:alpha)');
  check(await A.evaluate(() => { const c = window.__sakura.store.profile.missions.counters; return c['tag:alpha'] === 1 && !c['tag:dev']; }), 'tags: A\'s save marks only tag:alpha');
  await shot(B, 'tags-profile');
  await go(B, '#/profile?edit=title');
  await wait(B, '[data-testid="edit-titles"]', { timeout: 10000 });
  const bTitles = await B.evaluate(() => [...document.querySelectorAll('[data-testid="edit-titles"] button[data-title^="tag_"]')].map((b) => `${b.dataset.title}${b.disabled ? ':locked' : ''}`).join(','));
  check(bTitles === 'tag_dev,tag_alpha', `tags: B's title picker lists Developer + Alpha Tester, never Beta Tester (${bTitles})`);
  await shot(B, 'tags-titles');
  // B wears the Developer title. Others see it only while the server backs it: the Preview (what other
  // Senseis see) reads B's tags from the server, never B's own marks
  await tap(B, '[data-testid="edit-titles"] button[data-title="tag_dev"]');
  await tap(B, '[data-testid="edit-profile-save"]');
  await wait(B, '[data-testid="edit-profile-body"]', { state: 'detached', timeout: 10000 });
  const ownPlate = () => until(B, () => /Developer/.test(document.querySelector('[data-testid="profile-identity"] [data-testid="profile-title"]')?.innerText || ''), null, 15000);
  const previewPlate = async () => {
    await wait(B, '[data-testid="profile-preview"]', { timeout: 45000 });
    await tap(B, '[data-testid="profile-preview"]'); // straight away: right after a reload the hub has not learned B's id yet
    await wait(B, '[data-testid="profile-preview-overlay"] [data-testid="profile-identity"]', { timeout: 15000 });
    const plate = await B.evaluate(() => document.querySelector('[data-testid="profile-preview-overlay"] [data-testid="profile-title"]')?.innerText || '');
    await tap(B, '[data-testid="profile-preview-close"]');
    await wait(B, '[data-testid="profile-preview-overlay"]', { state: 'detached', timeout: 5000 }).catch(() => null);
    return plate;
  };
  const reloadB = async () => {
    await go(B, '#/profile');
    await toFront(B);
    await B.reload({ waitUntil: 'load' });
  };
  await go(B, '#/profile');
  check(await ownPlate(), 'tags: B wears the Developer title on their own profile');
  check(/Developer/.test(await previewPlate()), 'tags: B\'s Preview shows the Developer title (the server backs it)');
  // the owner takes B's DEV tag away in the SQL editor
  await editDb(A, 's.tags[a] = { ...s.tags[a], staff: null };', uidB);
  await reloadB();
  check(await previewPlate() === '', 'tags: DEV taken away on the server: B\'s Preview shows no title plate');
  check(await ownPlate(), 'tags: ... while B\'s own profile still wears Developer (their save keeps it)');
  await shot(B, 'tags-profile-undev');
  // ... and gives it back
  await editDb(A, 's.tags[a] = { ...s.tags[a], staff: \'dev\' };', uidB);
  await reloadB();
  check(/Developer/.test(await previewPlate()), 'tags: DEV given back: B\'s Preview shows the Developer title again');
  await go(A, '#/profile?edit=title');
  await wait(A, '[data-testid="edit-titles"]', { timeout: 15000 });
  const aTitles = await A.evaluate(() => [...document.querySelectorAll('[data-testid="edit-titles"] button[data-title^="tag_"]')].map((b) => b.dataset.title).join(','));
  const aCount = await A.evaluate(() => document.querySelector('.ep-lbl small')?.textContent || '');
  // 45 titles in this build (37 at launch + Helping Hands + 7 Codex titles) + the Alpha Tester title A owns
  check(aTitles === 'tag_alpha' && / \/ 46 earned$/.test(aCount), `tags: A's picker lists only Alpha Tester and counts it (${aTitles}; "${aCount}")`);
  await tap(A, '[data-testid="edit-profile-cancel"]');
  await go(A, '#/clan?tab=chat');
  await wait(A, '[data-testid="chat-panel"][data-ready="1"]', { timeout: 10000 });

  // ---- DMs both ways ---------------------------------------------------------------------
  if (await A.locator('[data-testid="card-close"]').count()) await tap(A, '[data-testid="card-close"]').catch(() => {});
  await go(A, '#/clan?tab=members');
  await wait(A, '[data-testid="member-card"]', { timeout: 10000 });
  check(await until(A, ([a, b]) => {
    const tags = (u) => document.querySelector(`[data-testid="member-row"][data-user="${u}"] [data-testid="tag-chips"]`)?.dataset.tags;
    return tags(b) === 'dev' && tags(a) === 'alpha';
  }, [uidA, uidB]) && (await chipTags(A, `[data-testid="member-row"][data-user="${uidB}"]`)) === 'dev',
  'tags: the clan roster shows one chip per member (B: DEV, A: ALPHA)');
  check(await namesWhole(A, '[data-testid="member-row"]'), 'tags: the roster keeps every name whole next to its chip');
  check(await A.evaluate((b) => {
    const btn = document.querySelector(`[data-testid="member-row"][data-user="${b}"] [data-testid="member-card"]`);
    return !btn.hasAttribute('aria-label') && btn.querySelector('[data-testid="tag-chip"]')?.getAttribute('aria-label') === 'Developer';
  }, uidB), 'tags: the roster button is read from its content, so screen readers hear "Developer"');
  await shot(A, 'tags-roster');
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
  check(await until(B, () => document.querySelector('[data-testid="thread-row"] [data-testid="tag-chips"]')?.dataset.tags === 'alpha'), 'tags: the inbox row shows A\'s ALPHA chip');
  await shot(B, 'inbox');
  await tap(B, '[data-testid="thread-row"]');
  check(await until(B, () => [...document.querySelectorAll('[data-testid="dm-msg"]')].some((m) => /Want to play co-op/.test(m.innerText))), 'DM: B reads A\'s message');
  await toFront(B);
  await B.fill('[data-testid="dm-input"]', 'Yes please! 🌸');
  await B.press('[data-testid="dm-input"]', 'Enter');
  check(await until(A, () => [...document.querySelectorAll('[data-testid="dm-msg"]')].some((m) => /Yes please/.test(m.innerText)), null, 12000), 'DM: B\'s reply appears live in A\'s conversation');
  check(await until(A, () => document.querySelector('[data-testid="thread-peer"] [data-testid="tag-chips"]')?.dataset.tags === 'dev'), 'tags: the conversation header shows B\'s DEV chip');
  check(await until(B, () => !document.querySelector('[data-testid="thread-unread"]'), null, 8000), 'inbox: reading the conversation clears the unread number');
  // text rules on the client before the server (invisible characters)
  await toFront(B);
  await B.fill('[data-testid="dm-input"]', 'sneaky​text');
  await B.press('[data-testid="dm-input"]', 'Enter');
  check(/invisible/i.test(await B.locator('[data-testid="dm-status"]').innerText().catch(() => '')), 'DM: invisible characters are refused with a clear line');

  // ---- co-op invite by DM → Join -----------------------------------------------------------
  await lobby(B);
  // B has the Menu open when the invite arrives: Join must not leave it on top of the room (UX #2)
  await tap(B, '[data-testid="top-menu"]');
  await wait(B, '[data-testid="menu-sheet-close"]', { timeout: 8000 }).catch(() => null); // ([ui-ink] V2: the side sheet)
  const t1 = await B.evaluate(() => Date.now());
  await tap(A, '[data-testid="thread-invite"]');
  await wait(A, '[data-testid="coop-stage-ok"]', { timeout: 10000 });
  await tap(A, '[data-testid="coop-stage-ok"]');
  await wait(A, '[data-testid="coop-room"]', { timeout: 15000 });
  const room = await A.locator('[data-testid="coop-room-code"]').innerText({ timeout: 10000 });
  check(/^[A-Z0-9]{5}$/.test(room), `co-op: A hosts room ${room}`);
  check(await until(A, () => /Bea/.test(document.querySelector('[data-testid="coop-invited"]')?.innerText || ''), null, 10000), 'co-op: the lobby lists "Invited: Bea"');
  // B's pop-up right away: it closes by itself after 20 s, and on a loaded machine a screenshot
  // or a tap's stability wait can take longer than that
  check(await popped(B, 'invite', t1), 'co-op: B gets the invite pop-up');
  await wait(B, '[data-testid="invite-toast"]', { timeout: 5000 }).catch(() => null);
  // the pointer rests on the pop-up (a player reading it): it stays open until let go
  await B.locator('[data-testid="invite-toast"]').first().dispatchEvent('pointerenter').catch(() => {});
  await shot(A, 'coop-invited');
  check(/invites you to co-op/.test(await text(B, '[data-testid="invite-toast"]')), 'co-op: the pop-up says who invites');
  check(/1-\d+ · .+ · \w+/.test(await text(B, '[data-testid="invite-toast"]')), 'co-op: the pop-up names the stage like the stage picker ("1-1 · First Petals · Normal")');
  await shot(B, 'invite-toast');
  await quickTap(B, '[data-testid="invite-toast-join"]');
  await wait(B, '[data-testid="coop-room"]', { timeout: 15000 });
  check((await B.locator('[data-testid="coop-room-code"]').innerText()) === room, 'co-op: Join opened the same room (no code typed)');
  check(await until(B, () => !document.querySelector('.modal-overlay'), null, 5000), 'co-op: Join closed the open Menu (nothing left on top of the room)');
  const paired = await until(A, () => !!document.querySelector('[data-testid="coop-player-1"]'), null, 20000)
    && await until(B, () => !!document.querySelector('[data-testid="coop-player-0"]'), null, 20000);
  check(paired, 'co-op: both players are in the lobby together');
  await shot(B, 'coop-joined');
  // the ally's card: no "Invite to co-op" that would silently leave this room (UX #4)
  await tap(A, '[data-testid="coop-ally-card"]');
  check(await wait(A, '[data-testid="card-coop-ally"]', { timeout: 10000 }).then(() => true).catch(() => false), 'co-op: the ally\'s card says "In your co-op room" instead of opening a second room');
  await shot(A, 'coop-ally-card');
  await tap(A, '[data-testid="card-close"]');
  await wait(A, '[data-testid="player-card"]', { state: 'detached', timeout: 5000 }).catch(() => null);
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
  // the conversation keeps the invite as a card. The host's Leave expires it (UX #6: nobody is in
  // the room any more, so Join would only wait for a host who left); "Your last room" still
  // reopens the room for the host, who can invite again
  await go(A, '#/messages');
  await wait(A, '[data-testid="thread-row"]', { timeout: 10000 });
  await tap(A, '[data-testid="thread-row"]');
  check(await until(A, () => /Expired/i.test(document.querySelector('[data-testid="dm-invite"]')?.innerText || ''), null, 10000),
    'co-op: after the host left, the invite card says "Expired"');
  await shot(A, 'thread-invite');
  // B's Co-op → Invites asks the server: the invite this tab remembers is gone (UX #3)
  await lobby(B);
  await go(B, '#/coop');
  check(await until(B, () => { const t = document.querySelector('[data-testid="coop-invites"]')?.innerText || ''; return !/Loading/.test(t); }, null, 15000)
    && !(await B.locator('[data-testid="invite-row-dm"]').count()), 'co-op: Co-op → Invites lists no invite that is no longer open');
  await shot(B, 'coop-hub-invites');

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
  // (80 h in the clan: a day for her request, 3 days for DMs with Aiko)
  await editDb(C, 's.members[a].joinedAt -= 80 * 3600e3;', uidC);
  await go(C, '#/clan?tab=donate');
  await wait(C, '[data-testid="donate-ask"]', { timeout: 15000 });
  await tap(C, '[data-testid="donate-ask"]');
  await tap(C, '[data-testid="pick-fam-feather"]');
  await tap(C, '[data-testid="pick-rar-rare"]');
  await tap(C, '[data-testid="pick-ok"]');
  await tap(C, '[data-testid="confirm-ok"]');
  await wait(C, '[data-testid="my-request-progress"]', { timeout: 10000 });
  // ---- a brand-new conversation: the other player's first message shows at once (UX #1) --------
  // (Aiko and Cleo are friends: with the default setting only friends write to each other)
  await editDb(C, `const f = (s.social.friends ||= {}); (f[a.x] ||= {})[a.y] = Date.now(); (f[a.y] ||= {})[a.x] = Date.now();`, { x: uidA, y: uidC });
  await go(A, '#/clan?tab=members');
  await wait(A, `[data-testid="member-row"][data-user="${uidC}"] [data-testid="member-card"]`, { timeout: 10000 });
  await tap(A, `[data-testid="member-row"][data-user="${uidC}"] [data-testid="member-card"]`);
  await wait(A, '[data-testid="card-message"]:not([disabled])', { timeout: 10000 });
  await tap(A, '[data-testid="card-message"]');
  await A.waitForFunction(() => /#\/messages\/new/.test(location.hash), null, { timeout: 8000 });
  await wait(A, '[data-testid="dm-input"]', { timeout: 10000 });
  await C.evaluate((to) => window.__online.sendDm(to, 'Cleo writes first'), uidA);
  check(await until(A, () => [...document.querySelectorAll('[data-testid="dm-msg"]')].some((m) => /Cleo writes first/.test(m.innerText)), null, 12000),
    'DM: in a brand-new conversation the other player\'s first message shows at once');
  await toFront(A);
  await A.fill('[data-testid="dm-input"]', 'Aiko writes second');
  await A.press('[data-testid="dm-input"]', 'Enter');
  check(await until(A, () => /Cleo writes first[\s\S]*Aiko writes second/.test([...document.querySelectorAll('[data-testid="dm-msg"]')].map((m) => m.innerText).join('|')), null, 12000),
    'DM: both first messages show, in order');
  await shot(A, 'dm-new-thread');
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

  // ---- clan invites (20261018000000_clan_invites.sql): the leader invites Cleo back ---------------
  // from their conversation's menu; the leader's invite also lifts the 7-day kick ban
  await go(A, '#/messages');
  await wait(A, '[data-testid="thread-row"]', { timeout: 10000 });
  // a clanmate's conversation offers no "Invite to [PS]" (their player card shows the clan)
  await tap(A, '[data-testid="thread-row"]:has-text("Bea")');
  await wait(A, '[data-testid="thread-menu"]', { timeout: 10000 });
  await tap(A, '[data-testid="thread-menu"]');
  await wait(A, '[data-testid="thread-card"]', { timeout: 8000 });
  await A.waitForTimeout(2500); // (the item would appear once the clan and the card are known)
  check(!(await A.locator('[data-testid="thread-clan-invite"]').count()), 'clan invite: a clanmate\'s conversation menu has no "Invite to [PS]"');
  await A.keyboard.press('Escape').catch(() => {});
  await A.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
  await tap(A, '[data-testid="thread-row"]:has-text("Cleo")');
  await wait(A, '[data-testid="thread-menu"]', { timeout: 10000 });
  await tap(A, '[data-testid="thread-menu"]');
  check(await wait(A, '[data-testid="thread-clan-invite"]', { timeout: 8000 }).then(() => true).catch(() => false), 'clan invite: the conversation menu offers "Invite to [PS]"');
  check(/Invite to \[PS\]/.test(await text(A, '[data-testid="thread-clan-invite"]')), 'clan invite: the menu names the clan tag');
  await shot(A, 'clan-invite-menu');
  await tap(A, '[data-testid="thread-clan-invite"]');
  check(await until(A, () => /Clan invite sent to Cleo/.test(document.querySelector('.toast-host')?.innerText || ''), null, 8000), 'clan invite: "Clan invite sent to Cleo."');
  // the player card offers it too (a repeat sends nothing new)
  await tap(A, '[data-testid="thread-peer"]');
  check(await wait(A, '[data-testid="card-clan-invite"]', { timeout: 10000 }).then(() => true).catch(() => false), 'clan invite: Cleo\'s player card offers "Invite to [PS]"');
  await shot(A, 'clan-invite-card');
  await A.waitForTimeout(2100); // (clan invites: 1 per 2 s)
  await tap(A, '[data-testid="card-clan-invite"]');
  check(await wait(A, '[data-testid="card-clan-invited"]', { timeout: 8000 }).then(() => true).catch(() => false), 'clan invite: the card says "Clan invite sent ✓"');
  await tap(A, '[data-testid="card-close"]').catch(() => {});
  // Cleo: the invite card on the clan list and in Messages → Requests, with the badge
  await go(C, '#/lobby');
  await go(C, '#/clan');
  check(await wait(C, '[data-testid="clan-invites"] [data-testid="clan-invite-row"][data-clan="PS"]', { timeout: 15000 }).then(() => true).catch(() => false), 'clan invite: Cleo sees it on the clan list');
  check(await namesWhole(C, '[data-testid="clan-invites"] [data-testid="clan-invite-row"]'), 'clan invite: the clan list\'s invite row keeps "Petal Squad" whole next to Join / Decline');
  await go(C, '#/messages?tab=requests');
  await closeIntro(C);
  await wait(C, '[data-testid="clan-invite-row"]', { timeout: 10000 });
  // (Aiko's tag chip sits between their name and "invited you")
  check(/Aiko\s*(?:DEV|ALPHA|BETA)?\s*invited you/.test(await text(C, '[data-testid="clan-invite-row"]')), 'clan invite: the card says who invited them');
  check(await until(C, () => document.querySelector('[data-testid="clan-invite-row"] [data-testid="tag-chips"]')?.dataset.tags === 'alpha', null, 12000), 'tags: the clan invite card shows Aiko\'s ALPHA chip next to their name');
  check(await namesWhole(C, '[data-testid="clan-invite-row"]') && (await text(C, '[data-testid="clan-invite-name"]')) === 'Petal Squad', 'clan invite: the Requests row keeps "Petal Squad" whole next to the tag, the chip and Join / Decline');
  check(await until(C, () => Number(document.querySelector('[data-testid="msg-tab-requests"] .sc-pill')?.textContent || 0) >= 1, null, 12000), 'clan invite: the Requests tab counts it');
  await shot(C, 'clan-invite-requests');
  await tap(C, '[data-testid="clan-invite-join"]');
  check(await wait(C, '[data-testid="clan-home"]', { timeout: 10000 }).then(() => true).catch(() => false), 'clan invite: Join → Cleo is back in Petal Squad (the kick ban lifted by the leader\'s invite)');
  check(/Petal Squad/.test(await text(C, '[data-testid="clan-title"]')), 'clan invite: the clan screen is Petal Squad\'s');
  // the daily recruiting post: the leader posts once; the button then says it is done for today
  await go(A, '#/clan?tab=members');
  await wait(A, '[data-testid="clan-recruit"]', { timeout: 10000 });
  check(/Once a day/.test(await text(A, '[data-testid="clan-recruit-note"]')), 'recruit: the leader sees "Post to global chat" (once a day)');
  await tap(A, '[data-testid="clan-recruit"]');
  check(await until(A, () => /in global chat/.test(document.querySelector('.toast-host')?.innerText || ''), null, 8000), 'recruit: "Your clan is in global chat!"');
  check(await until(A, () => document.querySelector('[data-testid="clan-recruit"]')?.disabled === true, null, 8000), 'recruit: then "Posted today ✓" until the 7 PM Central reset');
  check(!(await C.locator('[data-testid="clan-recruit"]').count()), 'recruit: a plain member gets no button');
  await shot(A, 'recruit-posted');
  // a clanmate in global chat: their own clan's card says "Your clan", with no Join / Ask to join
  await go(C, '#/chat');
  check(await wait(C, '[data-testid="recruit-card"][data-clan="PS"] [data-testid="recruit-yours"]', { timeout: 15000 }).then(() => true).catch(() => false), 'recruit: a clanmate sees "Your clan" on their clan\'s card');
  check(!(await C.locator('[data-testid="recruit-card"][data-clan="PS"] [data-testid="recruit-join"], [data-testid="recruit-card"][data-clan="PS"] [data-testid="recruit-request"]').count()), 'recruit: a clanmate\'s card has no Join / Ask to join');
  await shot(C, 'recruit-card-clanmate');
  await C.close();

  // ---- report + block ----------------------------------------------------------------------
  await go(B, '#/messages');
  await wait(B, '[data-testid="thread-row"]', { timeout: 10000 });
  await tap(B, '[data-testid="thread-row"]');
  await wait(B, '[data-testid="thread-menu"]', { timeout: 10000 });
  // (REVERIFY H1) press and hold one of A's messages: report exactly that one (no block yet)
  await until(B, () => [...document.querySelectorAll('[data-testid="dm-msg"]')].some((m) => /Want to play co-op/.test(m.innerText)), null, 10000);
  await B.locator('[data-testid="dm-msg"]:has-text("Want to play co-op")').first().dispatchEvent('contextmenu');
  check(await wait(B, '[data-testid="msg-report"]', { timeout: 8000 }).then(() => true).catch(() => false), 'report: holding one of their messages opens its menu');
  check(/Want to play co-op/.test(await text(B, '[data-testid="msg-quote"]')), 'report: the menu quotes that message');
  await shot(B, 'message-menu');
  await tap(B, '[data-testid="msg-report"]');
  await tap(B, '[data-testid="report-inappropriate"]');
  await B.locator('[data-testid="report-block"]').uncheck();
  await tap(B, '[data-testid="report-send"]');
  check(await until(B, () => /look at it/.test(document.querySelector('.toast-host')?.innerText || ''), null, 8000), 'report: one message reported');
  const one = await B.evaluate(() => (JSON.parse(localStorage.getItem('ss-online-db')).social.reports || []).map((r) => ({ body: r.evidence?.message?.body, total: r.evidence?.dmsTotal })));
  check(one.length === 1 && /Want to play co-op/.test(one[0].body) && one[0].total >= 2, `report: the held message is the reported one, with the conversation's size (${JSON.stringify(one)})`);
  await B.waitForTimeout(10500); // (reports: 1 per 10 s)
  await tap(B, '[data-testid="thread-menu"]');
  await tap(B, '[data-testid="thread-report"]');
  await tap(B, '[data-testid="report-bullying"]');
  await toFront(B);
  await B.fill('[data-testid="report-note"]', 'Testing the report button');
  await shot(B, 'report');
  await tap(B, '[data-testid="report-send"]');
  const reported = await until(B, () => /look at it/.test(document.querySelector('.toast-host')?.innerText || ''), null, 8000);
  check(reported, 'report: "Thanks — the game\'s team will look at it."');
  const stored = await B.evaluate(() => (JSON.parse(localStorage.getItem('ss-online-db')).social.reports || []).map((r) => ({ reason: r.reason, dms: r.evidence?.dms?.length || 0, earlier: (r.evidence?.earlier || []).map((m) => m.body) })));
  check(stored.length === 1 && stored[0].reason === 'bullying' && stored[0].dms >= 2, `report: stored for the owner with server-made evidence (${JSON.stringify(stored)})`);
  check(stored[0]?.earlier.some((b) => /Want to play co-op/.test(b)), 'report: the repeat report keeps the message reported first (earlier)');
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
  check(!(await B.locator('[data-testid="chat-notice"]:has-text("Aiko")').count()) && await A.locator('[data-testid="chat-notice"]:has-text("Aiko")').count() > 0,
    'block: clan notices that name A ("Aiko joined the clan.") are hidden for B (REVERIFY M3)');
  const refused = await A.evaluate(async (to) => {
    try {
      await window.__online.sendDm(to, 'still there?');
      return 'sent';
    } catch (e) {
      return e.message;
    }
  }, uidB);
  // (the block ended the friendship: with the default, Friends only, A's own setting now says no, the
  // same words as for any clanmate who is no friend — the block itself is never mentioned)
  check(/can't get messages from you|setting doesn't include them/.test(refused) && !/block/i.test(refused), `block: A's next DM is refused with the words of a privacy refusal, never "blocked" ("${refused}")`);

  // ---- Settings → Online and the lobby Menu ---------------------------------------------------
  await go(A, '#/settings');
  check(await wait(A, '[data-testid="settings-privacy-friends"]', { timeout: 15000 }).then(() => true).catch(() => false), 'settings: Who can message me (Friends only by default)');
  check(await A.locator('[data-testid="settings-privacy-friends"]').evaluate((b) => b.classList.contains('on')), 'settings: the default is Friends only');
  await A.locator('[data-testid="settings-social"]').scrollIntoViewIfNeeded().catch(() => {});
  await shot(A, 'settings-online');
  await tap(A, '[data-testid="settings-privacy-friends_clan"]');
  check(await until(A, () => document.querySelector('[data-testid="settings-privacy-friends_clan"]')?.classList.contains('on')), 'settings: Friends & clan is saved');
  check(await A.evaluate(() => window.__online.socialSummary().then((s) => s.privacy)) === 'friends_clan', 'settings: the server has Friends & clan');
  check(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(await text(A, '[data-testid="settings-friend-code"]')), 'settings: my friend code is shown');
  await lobby(A);
  // ([ui-ink] V2, C12: the Menu's Messages tile folded into the chat button: its drawer's Messages button, below)
  // the lobby chat drawer: its Messages button (no unread now) reads "Messages", never "Messagesnull"
  await tap(A, '[data-testid="top-chat"]');
  const dmBtn = await A.waitForFunction(() => {
    const b = document.querySelector('[data-testid="drawer-messages"]');
    return b && !b.hidden ? b.innerText.trim() : null;
  }, null, { timeout: 10000 }).then((hnd) => hnd.jsonValue()).catch(() => '');
  check(dmBtn !== '' && !/null|undefined/i.test(dmBtn), `chat drawer: the Messages button reads "${dmBtn}" (no "null")`);
  await shot(A, 'chat-drawer-messages');
  // the lobby chat drawer's clan tab: the same chips (A blocked nobody; B blocked A, so this is A's view)
  await tap(A, '[data-testid="drawer-clan"]');
  check(await until(A, (b) => document.querySelector(`[data-testid="chat-drawer"] [data-testid="chat-msg"][data-user="${b}"] [data-testid="tag-chips"]`)?.dataset.tags === 'dev', uidB, 12000),
    'tags: the lobby chat drawer shows B\'s DEV chip');
  // B's last line in the middle of the drawer (it is above the fold under the newer notices)
  await A.evaluate((b) => [...document.querySelectorAll(`[data-testid="chat-drawer"] [data-testid="chat-msg"][data-user="${b}"]`)].pop()?.scrollIntoView({ block: 'center' }), uidB);
  await shot(A, 'tags-drawer');
  await tap(A, '[data-testid="drawer-close"]').catch(() => {});
  await go(A, '#/clan?tab=chat');
  await wait(A, '[data-testid="chat-panel"][data-ready="1"]', { timeout: 10000 });

  // ---- the server before the owner runs the SQL (&social=0) ---------------------------------
  const D = await openPage('D');
  await D.goto(`${base}&social=0&tags=0#/messages`, { waitUntil: 'load' });
  await setName(D, 'Dara');
  check(await wait(D, '[data-testid="needs-update"]', { timeout: 15000 }).then(() => true).catch(() => false), 'needs update: Messages shows "Needs the latest server update"');
  check(/Messages need the latest server update/.test(await text(D, '[data-testid="needs-update"]')), 'needs update: the card names the feature');
  await shot(D, 'needs-update-messages');
  // the recruiting card in global chat (drawn from its card; the needs-update server changes nothing for it)
  await go(D, '#/chat');
  check(await wait(D, '[data-testid="recruit-card"][data-clan="PS"]', { timeout: 15000 }).then(() => true).catch(() => false), 'recruit: global chat shows Petal Squad\'s recruiting card');
  check(/Petal Squad[\s\S]*members/.test(await text(D, '[data-testid="recruit-card"]')), 'recruit: the card shows the clan and its members');
  await shot(D, 'recruit-card');
  await tap(D, '[data-testid="recruit-view"]');
  check(await D.waitForFunction(() => /#\/clan\?find=PS/.test(location.hash), null, { timeout: 8000 }).then(() => true).catch(() => false), 'recruit: View clan opens the clan list on that tag');
  check(await D.locator('[data-testid="clan-search"]').inputValue().catch(() => '') === 'PS', 'recruit: the search is filled with the tag');
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
  // no player_tags table on this "server" (&tags=0): no chip anywhere, no error (the page-error check below)
  await D.waitForTimeout(1500);
  check(await D.locator('[data-testid="chat-msg"]').count() > 1 && !(await D.locator('[data-testid="tag-chip"]').count()), 'tags: a server without the tags table shows no chip and no error');
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
