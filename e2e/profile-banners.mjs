// End-to-end check of the 'pb:' Sensei Profile banners (docs/specs/PROFILE_BANNERS.md):
//   1. Edit Profile → Banner lists all 34 banners; a save with some claims sees the pb: ones it earned unlocked and
//      the rest locked with a lock chip that stays inside its tile; the count line reads "n / 34 unlocked"; tapping a
//      locked tile shows its whole rule in a toast and does not pick it
//   2. pick Nightglass Sky, Save: the profile banner draws it; the published card carries it, and the card a viewer
//      cleans (cleanViewedCard) keeps it; the Preview (what other Senseis see) draws it too
//   3. a painted pb: banner (Pumpkin Lantern Night) on the profile
//   4. with public/art/lobby/banners/ blocked, the six illustration banners fall back to their patterns (profile, picker)
//   + no page/console errors, no horizontal overflow
//
//   node e2e/profile-banners.mjs                                    # 390x844, 844x390, 1280x720
//   node e2e/profile-banners.mjs --viewport 844x390 --shots e2e/out/profile-banners
//
// Starts its own Vite dev server. Exit code 1 on a failure.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['390x844', '844x390', '1280x720'];
const shotsDir = opt('shots', 'e2e/out/profile-banners');
mkdirSync(shotsDir, { recursive: true });

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
const base = `http://127.0.0.1:${port}/`;
const { browser, label } = await launchChromium();
log(`browser: ${label}`);

/** A mid-to-late save: every girl, every stage cleared, most achievements claimed (three pb: unlocks held back). */
async function seed(page) {
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const [{ UNITS }, { STAGES }, { ACHIEVEMENTS }] = await Promise.all([import('/src/data/units.js'), import('/src/data/stages.js'), import('/src/data/missions.js')]);
    const p = store.profile;
    for (const u of UNITS) p.units[u.id] ||= { level: 40, exp: 0, breakthrough: 3, awaken: 2, gear: { charm: null, ribbon: null, shoes: null }, obtainedAt: 1, favorite: false, dupes: 0 };
    for (const s of STAGES) p.progress.stages[s.id] = { clears: 1, easy: true, normal: true, hard: false, nightmare: false };
    const held = new Set(['a_fp_200', 'a_close_call', 'a_leg_plus10']);
    for (const a of ACHIEVEMENTS) if (!held.has(a.id)) p.missions.achievements[a.id] = true;
    p.missions.counters['lr:tenka'] = 1;
    p.secretary = 'tenka';
    Object.assign(p.settings, { quality: 'low', autoStart: false, reduceMotion: false });
    store.commit('e2e');
    store.saveNow?.();
  });
}

async function runViewport(vp) {
  const [W, H] = vp.split('x').map(Number);
  const touch = Math.min(W, H) < 600;
  log(`\n=== viewport ${vp} (${touch ? 'touch' : 'mouse'}) ===`);
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  context.setDefaultNavigationTimeout(90000);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  const noErrors = (what) => {
    const errs = errors.splice(0);
    check(!errs.length, `${what}: no page/console errors${errs.length ? `\n       ${errs.slice(0, 5).join('\n       ')}` : ''}`);
  };
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300))))).catch(() => {});
  const shot = async (name) => {
    await settle();
    await page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); })))).catch(() => {});
    await page.screenshot({ path: `${shotsDir}/${vp}-${name}.png` });
  };
  const tap = async (sel) => {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded().catch(() => {});
    if (touch) await el.tap();
    else await el.click();
    await settle();
  };
  const noOverflow = (what) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1).then((ok) => check(ok, `${what}: no horizontal overflow`));

  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura && document.querySelector('#app')?.children.length > 0, null, { timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  errors.splice(0);
  await page.waitForFunction(() => window.__sakura && document.documentElement.dataset.holdInfo === 'on', null, { timeout: 30000 });
  await seed(page);
  // the Halloween operation clear and the season mark (the app start notes the season of the day it runs)
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    store.profile.progress.stages['ev-halloween-1'] = { clears: 1, easy: true };
    const { notePbSeason } = await import('/src/systems/profileBanners.js');
    notePbSeason(store.profile, Date.parse('2026-10-31T12:00:00-05:00'));
    store.commit('e2e');
  });

  // ---- 1. the picker
  log('-- 1. Edit Profile → Banner');
  await page.evaluate(() => { location.hash = '#/profile?edit=banner'; });
  check(await page.waitForSelector('[data-testid="edit-banners"]', { timeout: 15000 }).then(() => true).catch(() => false), 'Edit Profile opens on Banner');
  await settle();
  const pick = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('[data-testid="edit-banners"] .ep-banner')];
    const pb = tiles.filter((t) => t.dataset.banner.startsWith('pb:'));
    const locked = pb.filter((t) => t.classList.contains('locked')).map((t) => t.dataset.banner);
    const chips = tiles.map((t) => {
      const c = t.querySelector('.ep-banner-lock');
      if (!c) return true;
      const a = t.getBoundingClientRect();
      const b = c.getBoundingClientRect();
      return b.left >= a.left - 0.5 && b.right <= a.right + 0.5;
    });
    const label = [...document.querySelectorAll('.ep-pane *, .edit-profile *, [data-testid="edit-profile"] *')].map((e) => e.textContent).find((t) => /\d+ \/ \d+ unlocked/.test(t || '')) || '';
    return { n: tiles.length, pb: pb.length, locked, chipsInside: chips.every(Boolean), label: (label.match(/\d+ \/ \d+ unlocked/) || [''])[0] };
  });
  check(pick.n === 34 && pick.pb === 20, `34 banners, 20 of them new (${pick.n}, ${pick.pb})`);
  const expectLocked = ['pb:workshop', 'pb:summit_nest', 'pb:shrine_bell', 'pb:spring_petals', 'pb:summer_fireworks', 'pb:first_snow'].sort();
  check(JSON.stringify([...pick.locked].sort()) === JSON.stringify(expectLocked), `locked new banners are exactly the unmet ones (${pick.locked.join(', ')})`);
  check(pick.chipsInside, 'every lock chip stays inside its tile');
  check(pick.label === '28 / 34 unlocked', `count line "${pick.label}"`);
  await shot('picker');
  await page.locator('[data-banner="pb:petal_storm"]').first().scrollIntoViewIfNeeded().catch(() => {});
  await shot('picker-new');
  await noOverflow('picker');
  // a locked tile is tappable and shows its whole rule (a phone can't hover the tooltip; review r1 L2)
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  // (force: Playwright's actionability treats aria-disabled as disabled; a real tap or click still fires)
  {
    const tile = page.locator('[data-testid="edit-banners"] [data-banner="pb:summit_nest"]').first();
    await tile.scrollIntoViewIfNeeded().catch(() => {});
    if (touch) await tile.tap({ force: true });
    else await tile.click({ force: true });
    await settle();
  }
  const lockTap = await page.evaluate(() => ({
    toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '),
    on: document.querySelector('[data-testid="edit-banners"] [data-banner="pb:summit_nest"]')?.classList.contains('on'),
    aria: document.querySelector('[data-testid="edit-banners"] [data-banner="pb:summit_nest"]')?.getAttribute('aria-disabled'),
  }));
  check(/Summit Nest: .*Two Hundred Strong.*wave 200/.test(lockTap.toast) && !lockTap.on && lockTap.aria === 'true', `tapping a locked tile shows its rule and doesn't pick it (${JSON.stringify(lockTap)})`);
  await shot('picker-locked-tap');

  // ---- 2. pick Nightglass Sky, save, the card
  log('-- 2. Nightglass Sky on the profile and the card');
  await tap('[data-testid="edit-banners"] [data-banner="pb:nightglass"]');
  await tap('[data-testid="edit-profile-save"]');
  await page.waitForTimeout(400);
  const card = await page.evaluate(async () => {
    const { store } = window.__sakura;
    const { buildCard, cleanViewedCard, validCard } = await import('/src/online/profileCard.js');
    const c = buildCard(store.profile);
    return { saved: store.profile.sensei.banner, ban: c.ban, valid: validCard(c), viewed: cleanViewedCard(JSON.parse(JSON.stringify(c))).ban, shadow: store.profile.missions.counters['pbn:'] > 0 };
  });
  check(card.saved === 'pb:nightglass' && card.ban === 'pb:nightglass' && card.valid && card.viewed === 'pb:nightglass' && card.shadow, `saved, published, valid and kept by a viewer (${JSON.stringify(card)})`);
  await page.evaluate(() => { location.hash = '#/profile'; });
  await page.waitForSelector('[data-testid="profile"]', { timeout: 15000 });
  check(await page.evaluate(() => document.querySelector('.pf-banner .pf-bn-art')?.dataset.banner === 'pb:nightglass' && !!document.querySelector('.pf-banner .pf-bn-art img, .pf-banner .pf-bn-svg svg')), 'the profile banner draws Nightglass Sky');
  await shot('profile-nightglass');
  await noOverflow('profile');
  await tap('[data-testid="profile-preview"]');
  const pv = await page.waitForSelector('[data-testid="profile-preview-view"] .pf-banner .pf-bn-art[data-banner="pb:nightglass"]', { timeout: 15000 }).then(() => true).catch(() => false);
  check(pv, 'Preview (what other Senseis see) draws it too');
  await shot('preview-nightglass');
  await page.locator('[data-testid="profile-preview-close"]').first().click().catch(() => {});
  await settle();

  // ---- 3. a painted one
  log('-- 3. Pumpkin Lantern Night');
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const { setSensei } = await import('/src/systems/senseiSave.js');
    setSensei(store.profile, { banner: 'pb:pumpkin_night' });
    store.commit('e2e');
    location.hash = '#/missions';
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => { location.hash = '#/profile'; });
  await page.waitForSelector('[data-testid="profile"] .pf-bn-art[data-banner="pb:pumpkin_night"]', { timeout: 15000 }).catch(() => {});
  const img = await page.evaluate(() => {
    const i = document.querySelector('.pf-banner .pf-bn-art[data-banner="pb:pumpkin_night"] img');
    return i ? new Promise((r) => (i.complete ? r(i.naturalWidth) : (i.onload = () => r(i.naturalWidth)))) : 0;
  });
  check(img > 0, `the painted banner loads (${img}px wide)`);
  await shot('profile-pumpkin');

  // ---- 4. the pattern is a runtime fallback: block the illustrations, reload (routing turns the HTTP cache off)
  log('-- 4. illustrations blocked → the patterns (review r2 M1)');
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const { setSensei } = await import('/src/systems/senseiSave.js');
    setSensei(store.profile, { banner: 'pb:nightglass' });
    store.commit('e2e');
    store.saveNow?.();
  });
  await page.route('**/art/lobby/banners/**', (r) => r.abort());
  await page.evaluate(() => { location.hash = '#/profile'; });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('[data-testid="profile"]', { timeout: 30000 });
  const cardFb = await page.waitForFunction(() => !!document.querySelector('.pf-banner .pf-bn-art[data-banner="pb:nightglass"] .pf-bn-svg svg'), null, { timeout: 15000 }).then(() => true).catch(() => false);
  check(cardFb && await page.evaluate(() => !document.querySelector('.pf-banner .pf-bn-art[data-banner="pb:nightglass"] img')), 'profile banner: the Nightglass pattern replaces the blocked picture');
  await page.evaluate(() => { location.hash = '#/profile?edit=banner'; });
  await page.waitForSelector('[data-testid="edit-banners"]', { timeout: 15000 });
  // the picker's thumbs load lazily: bring each of the six into view so it requests (and fails) its picture
  for (const id of ['pb:petal_storm', 'pb:nightglass', 'pb:spring_petals', 'pb:summer_fireworks', 'pb:autumn_leaves', 'pb:first_snow']) {
    await page.locator(`[data-testid="edit-banners"] [data-banner="${id}"]`).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(250);
  }
  const pickFb = await page.waitForFunction(() => ['pb:nightglass', 'pb:autumn_leaves', 'pb:petal_storm', 'pb:first_snow', 'pb:spring_petals', 'pb:summer_fireworks'].every((id) => {
    const t = document.querySelector(`[data-testid="edit-banners"] [data-banner="${id}"]`);
    return t && t.querySelector('.pf-bn-svg svg') && !t.querySelector('img');
  }), null, { timeout: 20000 }).then(() => true).catch(() => false);
  check(pickFb, 'picker: all six illustration tiles show their pattern, no broken images');
  const otherImgs = await page.evaluate(() => [...document.querySelectorAll('[data-testid="edit-banners"] img')].filter((i) => i.complete && i.naturalWidth === 0 && !/\/banners\//.test(i.src)).length);
  check(otherImgs === 0, `the other painted tiles still load (${otherImgs} broken)`);
  await shot('fallback-picker');
  await page.unroute('**/art/lobby/banners/**');
  errors.splice(0).filter((e) => !/ERR_FAILED|net::ERR_|Failed to load resource/.test(e)).forEach((e) => errors.push(e));
  noErrors(vp);
  await context.close();
}

try {
  for (const vp of viewports) await runViewport(vp);
} finally {
  await browser.close();
  await server.close();
}
log(failures.length ? `\n${failures.length} FAILED` : '\nall ok');
process.exit(failures.length ? 1 : 0);
