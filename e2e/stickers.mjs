// End-to-end test of stickers (docs/specs/STICKERS.md) with the LOCAL adapter: one browser, two pages = two players
// (BroadcastChannel; nothing touches Supabase).
//   1. A and B are in one clan (aged, clanmates may message); A owns Tenka and Kage and has won a co-op battle.
//   2. Co-op battle: A's sticker button opens the picker (owned stickers tappable, the rest locked with how to get
//      them); a sticker A sends pops under A's name on BOTH screens for ~3 s; the rate limit greys the button; B
//      tapping a locked sticker only reads how to get it; B mutes A (nothing shows), then turns "Show stickers from
//      other players" off (nothing shows); an id from a newer build is ignored without an error; the battle never
//      desyncs and the sim id is the same on both.
//   3. Clan chat: A sends a sticker, B sees the picture; a sticker line with an unknown id reads as plain text.
//   4. Messages: A sends B a sticker in a private conversation; B's inbox line says "Sticker: Thanks!".
// Screenshots at 390x844, 844x390 and 1280x720 go to --shots <dir>.
//
//   node e2e/stickers.mjs --shots docs/review/stickers/e2e
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a check fails.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium, ownSave } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const SIZES = [[390, 844], [844, 390], [1280, 720]];
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
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
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
const settle = (page, ms = 250) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);
const go = (page, hash) => page.evaluate((x) => { location.hash = x; }, hash);
const wait = (page, sel, o = {}) => page.waitForSelector(sel, { timeout: 15000, ...o });
const until = (page, fn, arg, ms = 10000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
const tap = async (page, sel) => {
  await page.bringToFront();
  const el = page.locator(sel).first();
  try {
    await el.click({ timeout: 15000 });
  } catch (e) {
    if (!/Timeout/.test(e.message)) throw e;
    await el.click({ timeout: 15000, force: true });
  }
};
async function shot(page, name, size = null) {
  if (!shotsDir) return;
  const vp = page.viewportSize();
  await page.screenshot({ path: `${shotsDir}/${name}-${size ? size.join('x') : `${vp.width}x${vp.height}`}.jpg`, type: 'jpeg', quality: 82, timeout: 90000 }).catch((e) => log(`    (screenshot ${name}: ${e.message.split('\n')[0]})`));
}
/** The same view at every size; `again` re-shows a short-lived piece first. */
async function shots(page, name, again = null) {
  const vp = page.viewportSize();
  for (const size of SIZES) {
    await page.setViewportSize({ width: size[0], height: size[1] });
    await settle(page, 450);
    if (again) await again(size);
    await settle(page, 250);
    await shot(page, name, size);
  }
  await page.setViewportSize(vp);
  await settle(page, 300);
}
async function setName(page, name) {
  await wait(page, '[data-testid="name-input"]', { timeout: 60000 });
  await page.fill('[data-testid="name-input"]', name);
  await tap(page, '[data-testid="name-save"]');
  await wait(page, '[data-testid="name-input"]', { state: 'detached', timeout: 10000 });
}
async function giftLater(page) {
  const later = await wait(page, '[data-testid="beta-gift-later"]', { timeout: 4000 }).then(() => true).catch(() => false);
  if (later) await page.click('[data-testid="beta-gift-later"]', { force: true }).catch(() => {});
}
const editDb = async (page, src) => {
  await page.waitForTimeout(800);
  await page.evaluate((code) => {
    const s = JSON.parse(localStorage.getItem('ss-online-db'));
    // eslint-disable-next-line no-new-func
    new Function('s', code)(s);
    localStorage.setItem('ss-online-db', JSON.stringify(s));
  }, src);
  await page.waitForTimeout(800);
};
const seed = (page, extra) => page.evaluate((x) => {
  const { store } = window.__sakura;
  const p = store.profile;
  Object.assign(p.settings, { quality: 'low', shadows: false, bloom: false });
  p.progress.stages['1-1'] = { clears: 1, easy: true, normal: true, hard: false, nightmare: false };
  if (x.tenka) for (const id of ['tenka', 'kage']) p.units[id] = { ...p.units.aoi };
  if (x.coopWin) p.missions.counters.coopWin = 1;
  store.commit('replace');
  store.saveNow?.();
}, extra);
/** The laid-out size (px) and file of the first image matching `sel`, once it has loaded. */
const imgOf = (page, sel) => page.waitForFunction((x) => {
  const i = document.querySelector(x);
  return i && i.complete && i.naturalWidth ? { w: i.offsetWidth, h: i.offsetHeight, file: (i.currentSrc || i.src).split('/').pop() } : null; // (layout size: the pop-in scale does not count)
}, sel, { timeout: 8000 }).then((x) => x.jsonValue()).catch(() => null);
const bubble = (page, slot) => page.evaluate((s) => document.querySelector(`[data-testid="coop-sticker-${s}"]`)?.dataset.sticker || null, slot);

let A;
let B;
try {
  // ---- 1. two players, one clan -----------------------------------------------------------------------------------
  A = await openPage('A');
  await A.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await A.evaluate(() => localStorage.clear());
  await A.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await A.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 60000 });
  await seed(A, { tenka: true, coopWin: true });
  await go(A, '#/clan');
  await setName(A, 'Aiko');
  await giftLater(A);
  await wait(A, '[data-testid="clan-create-panel"]');
  await A.fill('[data-testid="clan-name"]', 'Sticker Club');
  await A.fill('[data-testid="clan-tag"]', 'stk');
  await tap(A, '[data-testid="clan-create"]');
  await wait(A, '[data-testid="clan-home"]');
  B = await openPage('B');
  await B.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await B.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 60000 });
  await seed(B, {});
  await go(B, '#/clan');
  await setName(B, 'Bea');
  await giftLater(B);
  await wait(B, '[data-testid="join-STK"]');
  await tap(B, '[data-testid="join-STK"]');
  await wait(B, '[data-testid="clan-home"]');
  const [uidA, uidB] = await Promise.all([A, B].map((p) => p.evaluate(() => window.__online.uid)));
  check(uidA && uidB && uidA !== uidB, 'two tabs are two players in one clan');
  await editDb(A, `for (const m of Object.values(s.members)) m.joinedAt -= 96 * 3600e3;
    for (const u of Object.values(s.users)) u.createdAt = Date.now() - 10 * 86400e3;
    for (const c of Object.values(s.clans)) if (!c.isDev) c.createdAt = Date.now() - 20 * 86400e3;
    s.social ||= {};
    s.social.settings ||= {};
    for (const u of Object.keys(s.users)) s.social.settings[u] = 'friends_clan';`);

  // ---- 2. co-op battle --------------------------------------------------------------------------------------------
  log('\n(2) co-op battle');
  const code = 'STK01';
  await go(A, `#/coop/${code}?host=1&stage=1-1&difficulty=easy`);
  await wait(A, '[data-testid="coop-room-code"]', { timeout: 30000 });
  await go(B, `#/coop/${code}`);
  await wait(B, '[data-testid="coop-ready"]', { timeout: 30000 });
  await B.waitForFunction(() => window.__coop?.paired, null, { timeout: 30000 });
  await tap(B, '[data-testid="coop-ready"]');
  await A.waitForFunction(() => window.__coop?.canStart, null, { timeout: 15000 });
  await tap(A, '[data-testid="coop-start"]');
  const btns = await Promise.all([A, B].map((p) => wait(p, '[data-testid="coop-sticker-btn"]', { timeout: 90000 }).then(() => true).catch(() => false)));
  check(btns[0] && btns[1], 'both co-op HUDs have the sticker button');
  const slotA = await A.evaluate(() => window.__battle.coop.mySlot);
  const slotB = 1 - slotA;

  await tap(A, '[data-testid="coop-sticker-btn"]');
  await wait(A, '[data-testid="stk-picker"]');
  const pick = await A.evaluate(() => ({
    tiles: document.querySelectorAll('[data-testid="stk-picker"] .stk-tile').length,
    locked: document.querySelectorAll('[data-testid="stk-picker"] .stk-tile.locked').length,
    line: document.querySelector('[data-testid="stk-pick-line"]')?.textContent,
  }));
  check(pick.tiles === 16 && pick.locked === 7 && /^9 of 16/.test(pick.line), `A's picker: 16 stickers, 9 owned, 7 locked (${JSON.stringify(pick)})`);
  const tile = await imgOf(A, '[data-testid="stk-picker"] .stk-tile .stk-img');
  check(tile && tile.w >= 72 && tile.w <= 88, `picker tiles: up to 88 px (${JSON.stringify(tile)})`);
  await shots(A, 'coop-picker', async () => {
    if (!(await A.$('[data-testid="stk-picker"]'))) await tap(A, '[data-testid="coop-sticker-btn"]');
  });
  await tap(A, '[data-testid="stk-tenka_charge"]');
  check(await until(B, (s) => document.querySelector(`[data-testid="coop-sticker-${s}"]`)?.dataset.sticker === 'tenka_charge', slotA), 'B sees A\'s sticker under A\'s name');
  check((await bubble(A, slotA)) === 'tenka_charge', 'A sees its own sticker under its own name');
  check(await B.evaluate(() => document.querySelector('.stk-bubble img')?.alt) === 'Tenka sticker: Charge!', 'the sticker has its words for screen readers');
  const big = await imgOf(B, '.stk-bubble img');
  check(big && big.w === 104 && big.h === 104 && /-128\.webp$/.test(big.file), `the battle sticker is 104 px, from the 128 px file (${JSON.stringify(big)})`);
  // the rate limit: the button waits out 2 s (greyed), a second sticker at once does not go
  check(await A.evaluate(() => document.querySelector('[data-testid="coop-sticker-btn"]').classList.contains('cooling')), 'the button greys out for the 2 s gap');
  const second = await A.evaluate(() => window.__coop.sendSticker('aoi_nice'));
  check(!second.ok && second.waitMs > 0, `a second sticker inside 2 s is held back (${JSON.stringify(second)})`);
  const gone = await until(B, (s) => !document.querySelector(`[data-testid="coop-sticker-${s}"]`), slotA, 6000);
  check(gone, 'the sticker goes away after ~3 s');
  // portrait: the placement hint's Cancel is never under the sticker button or a sticker (the hint sits below where a
  // 104 px sticker hangs from the co-op chip); short landscape: the sticker is 80 px
  await B.setViewportSize({ width: 390, height: 844 });
  await settle(B, 500);
  await A.waitForTimeout(2100);
  await A.evaluate(() => window.__coop.sendSticker('aoi_nice'));
  await imgOf(B, '.stk-bubble img');
  const clear = await B.evaluate(() => {
    const hint = document.querySelector('.bt-place-hint');
    if (!hint || !hint.offsetParent) return 'no hint';
    const r = hint.getBoundingClientRect();
    const apart = (q) => !q || r.top >= q.bottom || r.bottom <= q.top || r.left >= q.right || r.right <= q.left;
    const btn = document.querySelector('[data-testid="coop-sticker-btn"]')?.getBoundingClientRect();
    const stk = document.querySelector('.stk-bubble')?.getBoundingClientRect();
    if (!stk) return 'no sticker';
    return apart(btn) && apart(stk) ? 'clear' : 'overlap';
  });
  check(clear === 'clear', `portrait: the sticker button and a sticker stay clear of the placement hint (${clear})`);
  await B.setViewportSize({ width: 844, height: 390 });
  await settle(B, 400);
  await A.waitForTimeout(2100);
  await A.evaluate(() => window.__coop.sendSticker('slime_hi'));
  const short = await imgOf(B, '.stk-bubble img');
  check(short && short.w === 80, `short landscape: the battle sticker is 80 px (${JSON.stringify(short)})`);
  await B.setViewportSize({ width: 1280, height: 720 });
  await settle(B, 300);
  await shots(B, 'coop-sticker-guest', async () => {
    await A.waitForTimeout(2100);
    await A.evaluate(() => window.__coop.sendSticker('aoi_nice'));
    await until(B, (s) => !!document.querySelector(`[data-testid="coop-sticker-${s}"] img`)?.complete, slotA, 4000);
    await B.waitForTimeout(400);
  });

  // B taps a sticker it does not own: only how to get it
  await tap(B, '[data-testid="coop-sticker-btn"]');
  await wait(B, '[data-testid="stk-picker"]');
  const sentBefore = await B.evaluate(() => window.__coop.stickerWait());
  await tap(B, '[data-testid="stk-tenka_charge"]');
  const lockLine = await B.locator('[data-testid="stk-pick-line"]').innerText();
  check(/Recruit Tenka/.test(lockLine) && sentBefore === 0 && (await B.evaluate(() => window.__coop.stickerWait())) === 0, `a locked sticker says how to get it and sends nothing ("${lockLine}")`);
  await shot(B, 'coop-picker-locked');
  // mute A
  await tap(B, '[data-testid="stk-mute"]');
  check(/Show Aiko/.test(await B.locator('[data-testid="stk-mute"]').innerText()), 'the mute row turns into "Show Aiko\'s stickers"');
  await tap(B, '[data-testid="stk-close"]');
  await A.waitForTimeout(2100);
  await A.evaluate(() => window.__coop.sendSticker('slime_hi'));
  await B.waitForTimeout(900);
  check(!(await bubble(B, slotA)), 'a muted player\'s sticker does not show');
  await tap(B, '[data-testid="coop-sticker-btn"]');
  await tap(B, '[data-testid="stk-mute"]');
  await tap(B, '[data-testid="stk-close"]');
  // the setting: stickers from other players off
  await B.evaluate(() => { window.__sakura.store.profile.settings.showStickers = false; });
  await A.waitForTimeout(2100);
  await A.evaluate(() => window.__coop.sendSticker('slime_gg'));
  await B.waitForTimeout(900);
  check(!(await bubble(B, slotA)), 'with "Show stickers from other players" off nothing shows');
  await B.evaluate(() => { window.__sakura.store.profile.settings.showStickers = true; });
  // an id from a newer build, and junk: ignored without an error
  const errCount = errors.length;
  await A.evaluate(() => {
    const s = window.__coop;
    s.room.send({ type: 'stk', uid: s.me.uid, id: 'future_sticker', n: 99 }, { drop: true });
    s.room.send({ type: 'stk', uid: s.me.uid, id: { evil: 1 }, n: 100 }, { drop: true });
  });
  await B.waitForTimeout(900);
  check(!(await bubble(B, slotA)) && errors.length === errCount, 'an unknown sticker id is ignored, no error');
  // B sends one back: A sees it under B's name
  await tap(B, '[data-testid="coop-sticker-btn"]');
  await tap(B, '[data-testid="stk-slime_thanks"]');
  check(await until(A, (s) => document.querySelector(`[data-testid="coop-sticker-${s}"]`)?.dataset.sticker === 'slime_thanks', slotB), 'A sees B\'s sticker under B\'s name');
  // the battle never noticed
  const st = await Promise.all([A, B].map((p) => p.evaluate(() => ({ desynced: !!window.__battle.coop.lockstep.desynced, tick: window.__battle.coop.tick, sim: window.__coop.me && window.__sakura?.build?.sim }))));
  check(!st[0].desynced && !st[1].desynced && st[0].tick > 0 && st[1].tick > 0, `both battles run on in sync (${JSON.stringify(st)})`);
  const simIds = await Promise.all([A, B].map((p) => p.evaluate(() => fetch('version.json').then((r) => r.json()).then((v) => v.sim).catch(() => null))));
  log(`    (sim ids served: ${simIds.join(', ')})`);

  // ---- 3. clan chat -----------------------------------------------------------------------------------------------
  log('\n(3) clan chat');
  for (const p of [A, B]) {
    await p.evaluate(() => window.__coop?.close?.());
    await go(p, '#/chat?tab=clan');
  }
  await Promise.all([A, B].map((p) => wait(p, '[data-testid="chat-panel"][data-ready="1"]', { timeout: 30000 })));
  await tap(A, '[data-testid="chat-sticker"]');
  await wait(A, '[data-testid="stk-picker"]');
  await shots(A, 'chat-picker', async () => {
    if (!(await A.$('[data-testid="stk-picker"]'))) await tap(A, '[data-testid="chat-sticker"]');
  });
  await tap(A, '[data-testid="stk-kage_onit"]');
  check(await until(B, () => !!document.querySelector('[data-testid="chat-sticker-msg"][data-sticker="kage_onit"]'), null, 12000), 'B sees A\'s sticker in clan chat');
  check(await until(A, () => !!document.querySelector('[data-testid="chat-sticker-msg"][data-sticker="kage_onit"]')), 'A sees its own sticker in clan chat');
  check(await A.evaluate(() => document.querySelector('[data-testid="chat-input"]').value === ''), 'the typed line is untouched');
  const chatImg = await imgOf(B, '[data-testid="chat-sticker-msg"] img');
  check(chatImg && chatImg.w === 150 && chatImg.h === 150 && /-256\.webp$/.test(chatImg.file), `chat: the sticker is 150 px, from the 256 px file (${JSON.stringify(chatImg)})`);
  const reserved = await B.evaluate(() => getComputedStyle(document.querySelector('[data-testid="chat-sticker-msg"] img')).aspectRatio);
  check(/^1( \/ 1)?$/.test(reserved), `chat: the sticker's square box is reserved before it loads (aspect-ratio ${reserved})`);
  await B.fill('[data-testid="chat-input"]', '[sticker:future_one] Hi!');
  await B.press('[data-testid="chat-input"]', 'Enter');
  check(await until(A, () => [...document.querySelectorAll('[data-testid="chat-msg"] .ol-bubble')].some((b) => b.textContent === '[sticker:future_one] Hi!')), 'a sticker line with an id this build does not know reads as text');
  await B.waitForTimeout(2100);
  await tap(B, '[data-testid="chat-sticker"]');
  await tap(B, '[data-testid="stk-slime_hi"]');
  await until(A, () => !!document.querySelector('[data-testid="chat-sticker-msg"][data-sticker="slime_hi"]'));
  await shots(A, 'chat-clan');
  await A.setViewportSize({ width: 390, height: 844 });
  await settle(A, 400);
  const fits = await A.evaluate(() => {
    const list = document.querySelector('[data-testid="chat-list"]').getBoundingClientRect();
    return [...document.querySelectorAll('[data-testid="chat-sticker-msg"] img')].every((i) => { const r = i.getBoundingClientRect(); return r.right <= list.right + 0.5 && r.left >= list.left - 0.5 && r.width <= 0.4 * innerWidth + 0.5; });
  });
  check(fits, 'chat at 390 px: every sticker fits the message column (at most 40% of the width)');
  await A.setViewportSize({ width: 1280, height: 720 });
  await settle(A, 300);

  // ---- 4. messages -----------------------------------------------------------------------------------------------
  log('\n(4) messages');
  await A.evaluate((b) => sessionStorage.setItem('ss-social-new-peer', JSON.stringify({ userId: b, name: 'Bea', level: 1, avatar: 'aoi' })), uidB);
  await go(A, '#/messages/new');
  const intro = await wait(A, '[data-testid="intro-ok"]', { timeout: 4000 }).then(() => true).catch(() => false);
  if (intro) await tap(A, '[data-testid="intro-ok"]');
  await wait(A, '[data-testid="dm-sticker"]', { timeout: 15000 });
  await tap(A, '[data-testid="dm-sticker"]');
  await tap(A, '[data-testid="stk-slime_thanks"]');
  check(await until(A, () => !!document.querySelector('[data-testid="dm-sticker-msg"][data-sticker="slime_thanks"]'), null, 12000), 'A\'s sticker shows in the conversation');
  const dmImg = await imgOf(A, '[data-testid="dm-sticker-msg"] img');
  check(dmImg && dmImg.w === 150 && /-256\.webp$/.test(dmImg.file), `messages: the sticker is 150 px, from the 256 px file (${JSON.stringify(dmImg)})`);
  await shots(A, 'dm-thread');
  await go(B, '#/messages');
  const introB = await wait(B, '[data-testid="intro-ok"]', { timeout: 4000 }).then(() => true).catch(() => false);
  if (introB) await tap(B, '[data-testid="intro-ok"]');
  check(await until(B, () => /Sticker: Thanks!/.test(document.body.innerText), null, 15000), 'B\'s inbox line reads "Sticker: Thanks!"');
} catch (e) {
  failures.push(`crashed: ${e.stack || e.message}`);
  log(e);
  if (A) await shot(A, 'crash-A');
  if (B) await shot(B, 'crash-B');
} finally {
  check(errors.length === 0, `no page errors${errors.length ? `:\n    ${errors.slice(0, 8).join('\n    ')}` : ''}`);
  await browser.close();
  await server.close();
}
log(failures.length ? `\n${failures.length} FAILED` : '\nall ok');
process.exit(failures.length ? 1 : 0);
