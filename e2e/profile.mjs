// End-to-end checks for the Sensei Profile, own part (docs/specs/PROFILE.md §11.2, M1 steps):
//   1. the lobby badge opens #/profile: the favorite stand, an auto showcase of 8, the medal tally
//   2. Edit Showcase: pick 8 girls, drag one, save
//   3. hold card 1 → her Unit Sheet on the Build tab with 3 gear cards
//   4. set banner, favorite, title, frame and 2 pins
//   5. Preview: the visitor layout; holding a girl there shows the snapshot build (owner chip)
//   6. the achievements' deep links (Equip a title, Pin a ribbon) and the ≤ 4 live special ribbons on the shelf
// plus: a bio renders as text, the old build drops the block and the picks come back, a reset gives
// the auto showcase again, Reduce Motion stops every infinite animation, no horizontal overflow.
//
//   node e2e/profile.mjs                                  # 1280×720 (mouse) + 844×390 (touch)
//   node e2e/profile.mjs --viewport 844x390 --shots e2e/out/profile
//
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 on a failure.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['1280x720', '844x390'];
const shotsDir = opt('shots', 'e2e/out/profile');
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

/** A late-game save: every girl, legendary +10 gear on all, medals everywhere, freeplay marks, claims. */
async function seed(page) {
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const [{ UNITS }, { STAGES }, { ACHIEVEMENTS }, gear, { createRng }] = await Promise.all([
      import('/src/data/units.js'), import('/src/data/stages.js'), import('/src/data/missions.js'), import('/src/systems/gear.js'), import('/src/core/rng.js'),
    ]);
    const p = store.profile;
    const rng = createRng('profile-e2e');
    UNITS.forEach((u, i) => {
      const lv = Math.max(20, 60 - (i % 5) * 5);
      p.units[u.id] = { level: lv, exp: 0, breakthrough: Math.ceil(lv / 10) - 1, awaken: u.id === 'luna' || u.id === 'hikari' ? 5 : (i % 5) + 1, gear: { charm: null, ribbon: null, shoes: null }, obtainedAt: 1, favorite: false, dupes: i % 6 };
      for (const slot of ['charm', 'ribbon', 'shoes']) {
        const g = gear.rollGear(rng, { slot, rarity: i % 3 ? 'legendary' : 'mythic', level: 10 - (i % 2) });
        const uid = gear.addGear(p, g);
        p.gear[uid].equippedBy = u.id;
        p.units[u.id].gear[slot] = uid;
      }
    });
    STAGES.forEach((s, i) => { p.progress.stages[s.id] = { clears: 3, easy: true, normal: true, hard: i % 3 !== 0, nightmare: i % 4 === 0 }; });
    p.progress.stages['5-4'].freeplayBest = { blossom: 212 };
    p.progress.stages['8-1'].coopBestWave = { tempest: 168 };
    p.progress.stages['7-3'].coopBestWave = { crimson: 121 };
    Object.assign(p.missions.counters, { 'fpm:blossom:matriarch': 1, 'fpm:crimson:matriarch': 1, 'fpm:crimson:wyrm': 1 });
    for (const a of ACHIEVEMENTS) if (!a.id.startsWith('a_pulls_300')) p.missions.achievements[a.id] = true;
    p.stats.kills = 25310;
    const { discoverableEnemies } = await import('/src/systems/missions.js');
    const found = discoverableEnemies();
    found.slice(0, Math.round(found.length * 0.72)).forEach((id) => { p.bestiary[id] = { seen: true, discovered: true, kills: 40 }; });
    p.secretary = 'luna';
    p.formation = { hero: 'hikari', towers: ['aoi', 'rei'] };
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
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250))))).catch(() => {});
  const shot = async (name) => {
    await settle();
    await page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); })))).catch(() => {});
    await page.screenshot({ path: `${shotsDir}/${vp}-${name}.png` });
  };
  const cdp = touch ? await context.newCDPSession(page) : null;
  const touchEvent = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const center = async (sel, nth = 0) => {
    const el = page.locator(sel).nth(nth);
    await el.scrollIntoViewIfNeeded().catch(() => {});
    const b = await el.boundingBox();
    return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
  };
  const holdAt = async ({ x, y }, ms = 700) => {
    if (touch) {
      await touchEvent('touchStart', x, y);
      await page.waitForTimeout(ms);
      await touchEvent('touchEnd');
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(ms);
      await page.mouse.up();
    }
  };
  const tap = async (sel, nth = 0) => {
    const c = await center(sel, nth);
    if (!c) return false;
    if (touch) await page.touchscreen.tap(c.x, c.y);
    else await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(250);
    return true;
  };
  const sheetOpen = () => page.waitForSelector('[data-testid="unit-sheet"]', { timeout: 8000 }).then(() => true).catch(() => false);
  const closeSheet = async () => {
    await page.click('[data-testid="unit-sheet-close"]', { timeout: 4000 }).catch(() => {});
    await page.waitForSelector('[data-testid="unit-sheet"]', { state: 'detached', timeout: 4000 }).catch(() => {});
  };
  const sensei = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__sakura.store.profile.sensei)));
  const noOverflow = (what) => page.evaluate(() => {
    const els = [document.scrollingElement, ...document.querySelectorAll('.pf-main, .pf-sheet, .us-sheet')].filter(Boolean);
    return els.every((e) => e.scrollWidth <= e.clientWidth + 1);
  }).then((ok) => check(ok, `${what}: no horizontal overflow`));

  // ---- boot into the lobby with a late save
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura && document.querySelector('#app')?.children.length > 0, null, { timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura && document.documentElement.dataset.holdInfo === 'on', null, { timeout: 30000 });
  await seed(page);
  await page.evaluate(() => { location.hash = '#/missions'; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { location.hash = '#/lobby'; });
  await page.waitForSelector('[data-testid="account-level"]', { timeout: 15000 });
  // the lobby's own notices (beta gift, intro) may open a moment later: clear them first
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));

  // ---- 1. lobby badge → profile
  log('-- 1. lobby badge opens the profile');
  await page.click('[data-testid="account-level"]', { timeout: 8000 }).catch(async () => {
    await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
    await page.click('[data-testid="account-level"]');
  });
  const opened = await page.waitForSelector('[data-testid="profile"]', { timeout: 15000 }).then(() => true).catch(() => false);
  check(opened && (await page.evaluate(() => location.hash)) === '#/profile', 'the lobby badge opens #/profile');
  const first = await page.evaluate(() => ({
    fav: document.querySelector('[data-testid="profile-fav"]')?.dataset.unit,
    favImg: !!document.querySelector('[data-testid="profile-fav"] img.pt-cut'),
    slots: document.querySelectorAll('[data-testid="profile-slot"]').length,
    auto: document.querySelector('[data-testid="profile-showcase"]')?.dataset.auto,
    medals: [...document.querySelectorAll('.pf-tc b')].map((b) => b.textContent),
    pins: document.querySelectorAll('[data-testid="profile-plaque"]').length,
    fp: [...document.querySelectorAll('.pf-fp-wave b')].map((b) => b.textContent),
    hold: document.querySelector('[data-testid="profile"]')?.dataset.holdInfo,
  }));
  check(first.fav === 'luna' && first.favImg, `the favorite stand shows the secretary (${first.fav})`);
  check(first.slots === 8 && first.auto === '1', `an auto showcase of 8 (${first.slots}, auto=${first.auto})`);
  check(first.medals.length === 4 && first.medals[0] === '59/59', `the medal tally over 59 stages (${first.medals.join(' ')})`);
  check(first.pins === 4, `the best 4 medals are pinned automatically (${first.pins})`);
  check(first.fp.join(',') === '212,168,121', `Freeplay Records per tier (${first.fp.join(',')})`);
  check(first.hold === 'off', 'the profile root opts out of the global hold');
  check(await page.evaluate(() => !!document.querySelector('[data-testid="profile-pick-name"]') && document.querySelector('[data-testid="profile-name"]')?.textContent === 'Sensei'),
    'no online name yet: "Sensei" and the "Pick an online name" link');
  await page.evaluate(async () => {
    const { writeIdentity } = await import('/src/online/identity.js');
    writeIdentity({ name: 'Mika' }, false);
    writeIdentity({ name: 'Mika' }, true);
    window.__sakura.store.commit('identity');
  });
  await settle();
  check(await page.evaluate(() => document.querySelector('[data-testid="profile-name"]')?.textContent === 'Mika' && !document.querySelector('[data-testid="profile-pick-name"]')), 'with an online name the profile shows it');
  await noOverflow('profile');
  await shot('own');
  if (!touch) {
    await page.evaluate(() => { document.querySelector('.pf-main').scrollTop = 9999; });
    await shot('own-scrolled');
    await page.evaluate(() => { document.querySelector('.pf-main').scrollTop = 0; });
  } else {
    await page.evaluate(() => { document.querySelector('.pf-main').scrollTop = 9999; });
    await shot('own-scrolled');
    await page.evaluate(() => { document.querySelector('.pf-main').scrollTop = 0; });
  }
  noErrors('profile opens');

  // ---- 2. Edit Showcase: 8 girls, drag one, save
  log('-- 2. Edit Showcase');
  await tap('[data-testid="profile-showcase-edit"]');
  check(await page.waitForSelector('[data-testid="showcase-editor"]', { timeout: 8000 }).then(() => true).catch(() => false), 'Edit Showcase opens');
  for (let i = 0; i < 8; i++) await page.click('[data-testid="showcase-remove"] >> nth=0').catch(() => {});
  check(await page.evaluate(() => document.querySelectorAll('[data-testid="showcase-slot"].empty').length) === 8, '× empties every slot');
  const wanted = ['luna', 'hikari', 'kaede', 'chika', 'nami', 'sango', 'miko', 'raika'];
  for (const id of wanted) await tap(`[data-testid="showcase-pick"][data-unit="${id}"]`);
  const placed = await page.evaluate(() => [...document.querySelectorAll('[data-testid="showcase-slot"]')].map((s) => s.dataset.unit || null));
  check(placed.join(',') === wanted.join(','), `tapping 8 girls fills the slots in order (${placed.join(',')})`);
  await shot('edit');
  // drag slot 8 (Raika) onto slot 3
  const from = await center('[data-testid="showcase-slot"]', 7);
  const to = await center('[data-testid="showcase-slot"]', 2);
  if (touch) {
    await touchEvent('touchStart', from.x, from.y);
    for (let k = 1; k <= 8; k++) await touchEvent('touchMove', from.x + ((to.x - from.x) * k) / 8, from.y + ((to.y - from.y) * k) / 8);
    await touchEvent('touchEnd');
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
  }
  await page.waitForTimeout(250);
  const dragged = await page.evaluate(() => [...document.querySelectorAll('[data-testid="showcase-slot"]')].map((s) => s.dataset.unit || null));
  check(dragged[2] === 'raika' && dragged[3] === 'kaede', `dragging slot 8 onto slot 3 moves her there (${dragged.join(',')})`);
  await tap('[data-testid="showcase-save"]');
  await page.waitForSelector('[data-testid="showcase-editor"]', { state: 'detached', timeout: 4000 }).catch(() => {});
  await settle();
  const s2 = await sensei();
  check(s2.showcase.join(',') === dragged.join(','), `Save writes sensei.showcase (${s2.showcase.join(',')})`);
  const shown2 = await page.evaluate(() => [...document.querySelectorAll('[data-testid="profile-slot"]')].map((s) => s.dataset.unit));
  check(shown2.join(',') === dragged.join(',') && (await page.evaluate(() => document.querySelector('[data-testid="profile-showcase"]').dataset.auto)) === '0', 'the showcase shows the saved order');
  noErrors('edit showcase');

  // ---- 3. hold card 1 → Build tab
  log('-- 3. hold a showcase girl → her build');
  await holdAt(await center('[data-testid="profile-slot"]', 0));
  check(await sheetOpen(), 'holding card 1 opens her Unit Sheet');
  const sheet = await page.evaluate(() => ({
    unit: document.querySelector('[data-testid="unit-sheet"]')?.dataset.unitSheet,
    tab: document.querySelector('.us-tab.on')?.dataset.testid,
    gear: document.querySelectorAll('[data-testid="build-gear"]').length,
    tabs: [...document.querySelectorAll('.us-tab')].map((t) => t.textContent.trim()),
    hash: location.hash,
  }));
  check(sheet.unit === 'luna' && sheet.tab === 'unit-sheet-tab-build', `the sheet opens on the Build tab (${sheet.unit}, ${sheet.tab})`);
  check(sheet.gear === 3, `the Build tab shows 3 gear cards (${sheet.gear})`);
  check(sheet.tabs.join('|') === 'Build|Info|Upgrades' && sheet.hash === '#/profile', `tabs Build | Info | Upgrades, still on the profile (${sheet.tabs.join('|')})`);
  await noOverflow('build sheet');
  await shot('build');
  await closeSheet();
  noErrors('build sheet');

  // ---- 4. banner, favorite, title, frame, 2 pins
  log('-- 4. Edit Profile + pins');
  await tap('[data-testid="profile-edit"]');
  check(await page.waitForSelector('[data-testid="edit-profile"]', { timeout: 8000 }).then(() => true).catch(() => false), 'Edit Profile opens');
  await tap('[data-testid="edit-tab-banner"]');
  await tap('[data-testid="edit-banners"] [data-banner="theme:festival"]');
  await tap('[data-testid="edit-tab-favorite"]');
  await tap('[data-testid="edit-favorite-grid"] [data-unit="nami"]');
  await tap('[data-testid="edit-tab-title"]');
  await tap('[data-testid="edit-titles"] [data-title="fp_crimson"]');
  await tap('[data-testid="edit-tab-picture"]');
  await tap('[data-testid="edit-picture-grid"] [data-unit="hikari"]');
  await tap('[data-testid="edit-frames"] [data-frame="eclipse"]');
  await shot('editp');
  await tap('[data-testid="edit-tab-bio"]');
  check(await page.evaluate(() => !!document.querySelector('[data-testid="edit-bio-readonly"]')), 'Bio is read-only until the server update');
  await tap('[data-testid="edit-profile-save"]');
  await page.waitForSelector('[data-testid="edit-profile"]', { state: 'detached', timeout: 4000 }).catch(() => {});
  await settle();
  const s4 = await sensei();
  check(s4.banner === 'theme:festival' && s4.favorite === 'nami' && s4.title === 'fp_crimson' && s4.frame === 'eclipse' && s4.avatar === 'hikari',
    `the picks save (${s4.banner}, ${s4.favorite}, ${s4.title}, ${s4.frame}, ${s4.avatar})`);
  const view4 = await page.evaluate(() => ({
    fav: document.querySelector('[data-testid="profile-fav"]')?.dataset.unit,
    banner: document.querySelector('.pf-banner [data-banner]')?.dataset.banner,
    title: document.querySelector('[data-testid="profile-title"]')?.textContent,
    frame: document.querySelector('[data-testid="profile-avatar"]')?.dataset.frame,
  }));
  check(view4.fav === 'nami' && view4.banner === 'theme:festival' && /Crimson Slayer/.test(view4.title || '') && view4.frame === 'eclipse', `the profile shows them (${JSON.stringify(view4)})`);
  await tap('[data-testid="profile-pin"]');
  check(await page.waitForSelector('[data-testid="pin-picker"]', { timeout: 8000 }).then(() => true).catch(() => false), 'the pin picker opens');
  await tap('[data-testid="pin-option"]', 0);
  await tap('[data-testid="pin-tab-achievements"]');
  await tap('[data-testid="pin-option"]', 0);
  await shot('pins');
  await tap('[data-testid="pin-save"]');
  await page.waitForSelector('[data-testid="pin-picker"]', { state: 'detached', timeout: 4000 }).catch(() => {});
  const s4b = await sensei();
  check(s4b.pins.length === 2 && s4b.pins[1].startsWith('ach:'), `2 pins saved, a medal and an achievement (${s4b.pins.join(', ')})`);
  check(await page.evaluate(() => document.querySelectorAll('[data-testid="profile-plaque"]').length) === 2, 'the shelf shows the 2 pins');
  await shot('own-picked');
  noErrors('edit profile + pins');

  // ---- 5. Preview (the visitor layout from the local card)
  log('-- 5. Preview');
  await tap('[data-testid="profile-preview"]');
  check(await page.waitForSelector('[data-testid="profile-preview-view"]', { timeout: 8000 }).then(() => true).catch(() => false), 'Preview opens the visitor layout');
  const pv = await page.evaluate(() => {
    const v = document.querySelector('[data-testid="profile-preview-view"]');
    return { title: v.querySelector('.topbar-title')?.textContent, slots: v.querySelectorAll('[data-testid="profile-slot"]').length, edit: !!v.querySelector('[data-testid="profile-showcase-edit"], [data-testid="profile-pin"]'), fav: v.querySelector('[data-testid="profile-fav"]')?.dataset.unit };
  });
  check(/'s Profile$/.test(pv.title || '') && pv.slots === 8 && !pv.edit && pv.fav === 'nami', `the visitor layout: "${pv.title}", 8 tiles, no edit buttons`);
  await shot('preview');
  await holdAt(await center('[data-testid="profile-preview-view"] [data-testid="profile-slot"]', 0));
  check(await sheetOpen(), 'holding a girl in Preview opens her snapshot build');
  const snap = await page.evaluate(() => ({
    owner: document.querySelector('[data-testid="unit-sheet-owner"]')?.textContent || '',
    full: !!document.querySelector('[data-testid="unit-sheet-open-page"]'),
    locked: !!document.querySelector('.us-locked'),
    gear: document.querySelectorAll('[data-testid="build-gear"]').length,
    names: /Eternal Sakura|Crimson Moon/.test(document.querySelector('[data-testid="unit-build"]')?.textContent || ''),
    foot: /Shared from/.test(document.querySelector('[data-testid="unit-build"]')?.textContent || ''),
  }));
  check(/'s build$/.test(snap.owner) && !snap.full && !snap.locked, `snapshot: owner chip "${snap.owner}", no full page, no Recruit`);
  check(snap.gear === 3 && !snap.names && snap.foot, 'snapshot: 3 gear cards, no gear names, the "Shared from" note');
  await shot('vbuild');
  await closeSheet();
  await tap('[data-testid="profile-preview-close"]');
  check(await page.waitForSelector('[data-testid="profile-preview-overlay"]', { state: 'detached', timeout: 4000 }).then(() => true).catch(() => false), 'Preview closes');
  noErrors('preview');

  // ---- deep links from the achievements screens + the live-ribbon budget (ACHIEVEMENTS.md §2.4)
  log('-- 6. achievements deep links + ribbon budget');
  const specials = await page.evaluate(async () => {
    const { HONOR_RIBBONS } = await import('/src/data/honors.js');
    const { ACHIEVEMENT_MAP, achievementLive } = await import('/src/data/achievements.js');
    const own = window.__sakura.store.profile.missions.achievements;
    return HONOR_RIBBONS.filter((r) => r.class === 'special' && own[r.id] && achievementLive(ACHIEVEMENT_MAP[r.id])).map((r) => r.id);
  });
  await page.evaluate(() => { location.hash = '#/profile?edit=title&title=a_gold_40'; });
  const eqOpen = await page.waitForSelector('[data-testid="edit-profile"]', { timeout: 8000 }).then(() => true).catch(() => false);
  const eq = await page.evaluate(() => ({ hash: location.hash, on: document.querySelector('[data-testid="edit-titles"] .ep-title.on')?.dataset.title, tab: document.querySelector('.ep-nav button.on')?.dataset.testid }));
  check(eqOpen && eq.tab === 'edit-tab-title' && eq.on === 'a_gold_40' && eq.hash === '#/profile', `Equip link: Edit Profile → Title with that title selected (${JSON.stringify(eq)})`);
  await tap('[data-testid="edit-profile-save"]');
  await page.waitForSelector('[data-testid="edit-profile"]', { state: 'detached', timeout: 4000 }).catch(() => {});
  check((await sensei()).title === 'a_gold_40', 'Equip link: saving equips the title');
  await page.evaluate((pin) => { location.hash = `#/profile?pin=${pin}`; }, `ach:${specials[0]}`);
  const pinOpen = await page.waitForSelector('[data-testid="pin-picker"]', { timeout: 8000 }).then(() => true).catch(() => false);
  const pp = await page.evaluate(() => ({ slots: [...document.querySelectorAll('[data-testid="pin-slots"] [data-pin]')].map((e) => e.dataset.pin), tab: document.querySelector('.pp-tabs button.on')?.dataset.testid }));
  check(pinOpen && pp.slots.includes(`ach:${specials[0]}`) && pp.tab === 'pin-tab-achievements', `Pin link: the picker opens with the ribbon preselected (${pp.slots.join(', ')})`);
  await page.click('[data-testid="pin-picker-close"]').catch(() => {});
  await page.evaluate(async (ids) => {
    const { setSensei } = await import('/src/systems/senseiSave.js');
    const { store } = window.__sakura;
    setSensei(store.profile, { pins: ids.slice(0, 4).map((id) => `ach:${id}`) });
    store.commit('e2e');
  }, specials);
  await settle();
  await page.evaluate(() => { document.querySelector('.pf-shelf')?.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(600);
  const liveCount = await page.evaluate(() => document.querySelectorAll('.pf .rb.live').length);
  check(specials.length >= 4 && liveCount >= 1 && liveCount <= 4, `4 special pins: ${liveCount} live (≤ 4)`);
  await shot('pins-special');

  // ---- extras
  log('-- extras');
  // the bio is text, never HTML
  await page.evaluate(() => { const { store } = window.__sakura; store.profile.sensei.bio = '<b>x</b>'; store.commit('e2e'); });
  await settle();
  const bio = await page.evaluate(() => { const b = document.querySelector('[data-testid="profile-bio"]'); return { text: b?.textContent, html: !!b?.querySelector('b') }; });
  check(bio.text === '<b>x</b>' && !bio.html, 'a bio with <b>x</b> renders literally');
  // an older cached build drops the block: the picks come back on load
  const before = await sensei();
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const { migrateProfile } = await import('/src/systems/save.js');
    const raw = JSON.parse(JSON.stringify(store.profile));
    delete raw.sensei;
    store.replace(migrateProfile(raw));
  });
  await page.waitForTimeout(200);
  const after = await sensei();
  check(JSON.stringify({ ...after, bio: '' }) === JSON.stringify({ ...before, bio: '' }), 'an older build that drops sensei never wipes the picks');
  // RESET → the auto showcase again
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const { migrateProfile } = await import('/src/systems/save.js');
    const raw = JSON.parse(JSON.stringify(store.profile));
    raw.sensei = { showcase: [], pins: [] };
    for (const k of Object.keys(raw.missions.counters)) if (k.startsWith('pfs:')) delete raw.missions.counters[k];
    store.replace(migrateProfile(raw));
  });
  await settle();
  check(await page.evaluate(() => document.querySelector('[data-testid="profile-showcase"]')?.dataset.auto === '1'), 'with no picks the showcase is automatic again');
  // Reduce Motion
  const running = () => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming?.().iterations === Infinity && a.effect?.target?.closest?.('.pf')).length);
  const live = await running();
  await page.evaluate(() => { const { store } = window.__sakura; store.profile.settings.reduceMotion = true; store.commit('e2e'); document.documentElement.setAttribute('data-reduce-motion', ''); });
  await page.waitForTimeout(300);
  const still = await running();
  check(still === 0, `Reduce Motion: no infinite animation on the profile (${live} → ${still})`);
  check(await page.evaluate(() => document.querySelectorAll('.pf .rb.live').length) === 0, 'Reduce Motion: no live Honor Ribbon');
  await page.evaluate(() => { const { store } = window.__sakura; store.profile.settings.reduceMotion = false; store.commit('e2e'); document.documentElement.removeAttribute('data-reduce-motion'); });
  // back goes to the lobby
  await tap('[data-testid="back"]');
  await page.waitForTimeout(600);
  check((await page.evaluate(() => location.hash)) === '#/lobby', 'Back returns to the lobby');
  noErrors('extras');
  await context.close();
}

try {
  for (const vp of viewports) await runViewport(vp);
} catch (e) {
  failures.push(`crashed: ${e.stack || e.message}`);
  console.error(e);
} finally {
  await browser.close();
  await server.close();
}
log(failures.length ? `\n${failures.length} check(s) FAILED:\n - ${failures.join('\n - ')}` : '\nall profile checks passed');
process.exit(failures.length ? 1 : 0);
