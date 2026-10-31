// Cosmetics 2 e2e: the Honor Ribbon Case with the baked 3D-flat ribbons (earned cells draw the baked picture, locked
// and secret cells keep the grey SVG, the four new secret ribbons are in it), a ribbon's detail at 256 px, the Edit
// Profile frame picker (the new frames, a secret frame as "???" until earned) and the profile wearing a new frame.
// Screenshots: e2e/out/cosmetics/<viewport>-<name>.png.
//
//   node e2e/cosmetics.mjs                          # 390x844, 844x390 and 1280x720
//   node e2e/cosmetics.mjs --viewport 844x390
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';
import { veteran } from '../tests/fixtures/veterans.js';
import { SAVE_KEY } from '../src/systems/save.js';
import { CAMPAIGN_IDS } from '../src/data/stages.js';
import { HONOR_RIBBONS } from '../src/data/honors.js';
import { HONOR_TOTAL } from '../src/systems/profileHonors.js';
import { frameChoices, earnedFrames } from '../src/systems/profileTrophies.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';
import { FRAMES } from '../src/data/profileArt.js';
import { createProfile } from '../src/systems/save.js';
import { skipOnboarding } from '../src/systems/story.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const viewports = opt('viewport', null) ? [opt('viewport')] : ['390x844', '844x390', '1280x720'];
const OUT = 'e2e/out/cosmetics';
mkdirSync(OUT, { recursive: true });
const IGNORE = [/GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
  /Failed to load resource: net::ERR_(CERT_AUTHORITY_INVALID|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED|CONNECTION_REFUSED)/i];
const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

const LOCKED = ['a_login_365', 'a_mr_800', 'a_fp_bosses_4', 'a_try_g12', 'a_not_fooled']; // left unearned: grey cells
/** A late veteran who claimed every ribbon but LOCKED, met Room with a View (Window Seat) but not Where It All Began. */
function save({ frame = null } = {}) {
  const p = veteran('late');
  for (const id of CAMPAIGN_IDS) (p.progress.stages[id] ||= { easy: true, normal: true, hard: true, clears: 1 }).nightmare = true;
  for (const h of HONOR_RIBBONS) if (!LOCKED.includes(h.id) && h.id !== 'a_first_petals') p.missions.achievements[h.id] = true;
  p.missions.achievements.a_room_view = true;
  p.progress.stages['1-1'].nightmare = false; // Where It All Began not met: its frame stays a secret
  p.missions.counters.coopWin = 60;
  if (frame) p.sensei = { ...(p.sensei || {}), frame };
  return p;
}

// ---- the secrets sweep (review r2 N1): every secret reward's name and its how/desc ----
const SECRETS = ACHIEVEMENTS.filter((a) => a.hidden && a.cat === 'secret');
const SECRET_NAMES = [...new Set(SECRETS.flatMap((a) => [a.honor?.name, a.title?.text,
  ...Object.values(FRAMES).filter((f) => f.ach === a.id).map((f) => f.name)]).filter(Boolean))];
const SECRET_HOWS = SECRETS.map((a) => a.desc);
/** A new save before any secret: onboarding done, stage 1-1 cleared on Easy. */
function freshSave(found = false) {
  const p = createProfile();
  skipOnboarding(p);
  p.progress.stages['1-1'] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
  if (found) for (const a of SECRETS) p.missions.achievements[a.id] = true;
  return p;
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
log(`browser: ${label}`);

async function openWith(context, profile, hash) {
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(`[console] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await page.addInitScript(([key, text]) => {
    if (!sessionStorage.getItem('cos-e2e-seeded')) {
      localStorage.setItem(key, text);
      sessionStorage.setItem('cos-e2e-seeded', '1');
    }
    sessionStorage.setItem('sakura-title-seen', '1');
  }, [SAVE_KEY, JSON.stringify(profile)]);
  await page.goto(`${base}?onboarding=0${hash}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura && document.querySelector('#app')?.children.length > 0, null, { timeout: 30000 });
  return { page, errors };
}
const settle = (page) => page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

/** Opens every view that can show a secret's rewards and returns what each one's whole HTML (attributes too) holds. */
async function sweep(context, profile, shot, tag) {
  const seen = [];
  const scan = async (page, where) => {
    const html = await page.evaluate(() => document.body.outerHTML);
    seen.push({ where, names: SECRET_NAMES.filter((n) => html.includes(n)), hows: SECRET_HOWS.filter((d) => html.includes(d)) });
  };
  const closeTop = async (page) => {
    const btn = page.locator('.modal-overlay').last().locator('.modal-actions button').last();
    if (await btn.count()) await btn.click().catch(() => {});
    else await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  };
  const closeModals = async (page) => {
    for (let i = 0; i < 4 && (await page.$('.modal-overlay')); i++) await closeTop(page);
  };
  let { page, errors } = await openWith(context, profile, '#/commissions?tab=achievements');
  await page.waitForSelector('[data-testid="ach-tab"]', { timeout: 30000 });
  await page.waitForTimeout(600);
  await scan(page, 'list');
  await page.click('[data-testid="ach-category"]');
  await page.waitForSelector('[data-testid="ach-cat-sheet"] [data-testid="ach-cat-secret"]', { timeout: 10000 });
  await page.click('[data-testid="ach-cat-sheet"] [data-testid="ach-cat-secret"]');
  await page.waitForSelector('[data-testid="ach-cat-sheet"]', { state: 'detached', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  for (const sel of ['[data-testid="ach-progress-more"]', '[data-testid="ach-completed"]']) if (await page.$(sel)) { await page.click(sel); await page.waitForTimeout(200); }
  await scan(page, 'secrets category');
  for (const a of SECRETS) {
    const row = await page.$(`[data-testid="ach-row-${a.id}"]`);
    if (!row) { seen.push({ where: `row ${a.id}`, missing: true, names: [], hows: [] }); continue; }
    await row.click();
    await page.waitForSelector('[data-testid="ach-ladder-sheet"]', { timeout: 10000 });
    await page.waitForTimeout(300);
    await scan(page, `sheet ${a.id}`);
    if (a.id === 'a_mirror_mirror') await shot(page, `${tag}-secret-sheet`);
    // its chips: a found secret's open their info sheets; a hidden one's are not buttons at all
    for (const chip of ['.ach-chip-hr', '.ach-chip-title']) {
      const el = await page.$(`[data-testid="ach-ladder-sheet"] button${chip}`);
      if (!el) continue;
      await el.click();
      await page.waitForTimeout(400);
      await scan(page, `chip ${chip} ${a.id}`);
      await closeTop(page);
    }
    await closeTop(page);
    await page.waitForSelector('[data-testid="ach-ladder-sheet"]', { state: 'detached', timeout: 5000 }).catch(() => {});
  }
  await closeModals(page);
  await page.click('[data-testid="ach-case"]');
  await page.waitForSelector('[data-testid="ach-case-view"]', { timeout: 10000 });
  await page.waitForTimeout(500);
  await scan(page, 'case');
  for (const a of SECRETS.filter((x) => x.honor)) {
    await closeModals(page);
    const cell = await page.$(`[data-testid="ach-cell-${a.id}"]`);
    if (!cell) continue;
    await cell.click();
    await page.waitForTimeout(350);
    await scan(page, `case detail ${a.id}`);
    if (await page.$('.modal-overlay')) await closeTop(page);
  }
  await closeModals(page);
  const titlesBtn = await page.$('.ach-casewrap button:has-text("Titles")');
  if (titlesBtn) {
    await titlesBtn.click();
    await page.waitForSelector('[data-testid="ach-titles-sheet"]', { timeout: 10000 });
    await page.waitForTimeout(300);
    await scan(page, 'titles sheet');
    await closeTop(page);
  } else seen.push({ where: 'titles sheet', missing: true, names: [], hows: [] });
  const errs = [...errors];
  await page.close();
  for (const tab of ['title', 'picture']) {
    ({ page, errors } = await openWith(context, profile, `#/profile?edit=${tab}`));
    await page.waitForSelector(`[data-testid="edit-${tab === 'title' ? 'titles' : 'frames'}"]`, { timeout: 30000 });
    await page.waitForTimeout(400);
    await scan(page, `edit profile ${tab}`);
    errs.push(...errors);
    await page.close();
  }
  return { seen, errs };
}

async function runViewport(vp) {
  const [w, hh] = vp.split('x').map(Number);
  const touch = Math.min(w, hh) < 600;
  log(`\n=== viewport ${vp} ===`);
  const shot = (page, name) => page.screenshot({ path: `${OUT}/${vp}-${name}.png` }).catch((e) => log(`  (screenshot ${name} skipped: ${e.message.split('\n')[0]})`));
  const context = await browser.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: 1, hasTouch: touch });

  // ---- 0. the secrets sweep: a fresh save shows no secret reward anywhere; a save that found them shows them ----
  const sw0 = await sweep(context, freshSave(false), shot, "fresh");
  const leaks = sw0.seen.filter((x) => x.names.length || x.hows.length);
  check(!leaks.length, `sweep (fresh save): no secret reward name or how in ${sw0.seen.length} views${leaks.length ? `: ${JSON.stringify(leaks.slice(0, 3))}` : ''}`);
  check(!sw0.seen.some((x) => x.missing), `sweep: every secret row and the Titles sheet were opened (${sw0.seen.filter((x) => x.missing).map((x) => x.where).join(', ') || 'all'})`);
  check(!sw0.errs.length, `sweep (fresh): no console errors (${sw0.errs.slice(0, 3).join(' | ')})`);
  const found = await sweep(context, freshSave(true), shot, 'found');
  const shown = new Set(found.seen.flatMap((x) => x.names));
  check(SECRET_NAMES.every((n) => shown.has(n)),
    `sweep (secrets found): every secret reward's name shows somewhere (${SECRET_NAMES.filter((n) => !shown.has(n)).join(', ') || 'all'})`);
  check(!found.errs.length, `sweep (found): no console errors (${found.errs.slice(0, 3).join(' | ')})`);

  // ---- 1. the Case ----
  let { page, errors } = await openWith(context, save(), '#/commissions?tab=achievements');
  await page.waitForSelector('[data-testid="ach-tab"]', { timeout: 30000 });
  await page.waitForTimeout(700);
  await page.click('[data-testid="ach-case"]');
  await page.waitForSelector('[data-testid="ach-case-view"]', { timeout: 10000 });
  await page.waitForTimeout(600);
  await settle(page);
  const cs = await page.evaluate((locked) => {
    const cells = [...document.querySelectorAll('[data-testid^="ach-cell-"]')];
    const of = (id) => document.querySelector(`[data-testid="ach-cell-${id}"]`);
    const baked = cells.filter((c) => c.querySelector('img.rb-bake'));
    return {
      n: cells.length,
      baked: baked.length,
      // the 128 px cut up to a 64 px cell, the 256 px cut above it
      loaded: baked.every((c) => { const i = c.querySelector('img.rb-bake'); const s = c.querySelector('.rb').getBoundingClientRect().width; return i.complete && i.naturalWidth === (s <= 64.5 ? 128 : 256); }),
      lockedSvg: locked.every((id) => !of(id) || (!of(id).querySelector('img.rb-bake') && !!of(id).querySelector('svg.rb-art'))),
      secrets: ['a_close_call', 'a_gold_rush', 'a_mirror_mirror'].every((id) => !!of(id)?.querySelector('img.rb-bake')),
      keenEye: !!of('a_not_fooled'),
      // the picture sits exactly over the ribbon's box (64 + 2 × 2 units)
      fit: baked.every((c) => { const r = c.querySelector('.rb').getBoundingClientRect(); const i = c.querySelector('img.rb-bake').getBoundingClientRect(); return Math.abs(i.width - r.width * 68 / 64) < 1.5 && Math.abs((i.left + i.width / 2) - (r.left + r.width / 2)) < 1.5; }),
    };
  }, LOCKED);
  check(cs.n === HONOR_TOTAL, `case: a cell for each of the ${HONOR_TOTAL} ribbons (${cs.n})`);
  check(cs.baked === HONOR_TOTAL - LOCKED.length - 1 && cs.loaded, `case: every earned cell draws its baked picture at the right cut (${cs.baked}, loaded ${cs.loaded})`);
  check(cs.lockedSvg, 'case: locked and secret cells keep the grey SVG');
  check(cs.secrets && cs.keenEye, 'case: the new secret ribbons are in the Case (Last Bell, Lucky Coin, Looking-Glass earned; Keen Eye locked)');
  check(cs.fit, 'case: the picture sits centred over the ribbon box with its 2-unit overflow');
  check(!(await overflow(page)), 'case: no horizontal overflow');
  await shot(page, 'case');

  // ---- 2. a ribbon's detail ----
  await page.click('[data-testid="ach-cell-a_mirror_mirror"]');
  await page.waitForTimeout(700);
  await settle(page);
  const det = await page.evaluate(() => {
    const img = document.querySelector('.ach-detail-stage img.rb-bake, .ach-detail img.rb-bake, .ach-detail-modal img.rb-bake');
    return { name: document.querySelector('.ach-detail-name')?.textContent || '', src: img?.getAttribute('src') || '', w: img?.naturalWidth || 0 };
  });
  check(/Looking-Glass/.test(det.name), `detail: the Looking-Glass Ribbon (${det.name})`);
  check(/a_mirror_mirror-(256|128)\.webp\?v=/.test(det.src) && det.w > 0, `detail: its baked picture (${det.src.split('/').pop()})`);
  await shot(page, 'detail');
  check(!errors.length, `case: no console errors (${errors.slice(0, 3).join(' | ')})`);
  await page.close();

  // ---- 3. the frame picker ----
  const p = save();
  ({ page, errors } = await openWith(context, p, '#/profile?edit=picture'));
  await page.waitForSelector('[data-testid="edit-frames"]', { timeout: 30000 });
  await page.waitForTimeout(600);
  const fr = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('[data-testid="edit-frames"] [data-frame]')];
    const t = (id) => tiles.find((x) => x.dataset.frame === id);
    return {
      ids: tiles.map((x) => x.dataset.frame),
      secretHidden: t('first_petal')?.textContent.includes('???') && t('first_petal')?.classList.contains('locked'),
      windowOk: !!t('window_seat') && !t('window_seat').disabled && t('window_seat').textContent.includes('Window Seat'),
      sakuraOk: !!t('sakura') && !t('sakura').disabled,
      knotOk: !!t('knot') && !t('knot').disabled,
    };
  });
  const want = ['default', ...frameChoices(p)];
  check(JSON.stringify(fr.ids) === JSON.stringify(want), `picker: Default + the ${want.length - 1} frames this save can see (${fr.ids.length})`);
  check(fr.secretHidden, 'picker: the unearned secret frame reads "???" and stays locked');
  check(fr.windowOk && fr.sakuraOk && fr.knotOk, `picker: Window Seat, Sakura and Friendship Knot are earned (${earnedFrames(p).join(', ')})`);
  await page.click('[data-testid="edit-frames"] [data-frame="window_seat"]');
  await page.waitForTimeout(400);
  await page.locator('[data-testid="edit-frames"]').scrollIntoViewIfNeeded().catch(() => {});
  check(!(await overflow(page)), 'picker: no horizontal overflow');
  await shot(page, 'frames');
  check(!errors.length, `picker: no console errors (${errors.slice(0, 3).join(' | ')})`);
  await page.close();

  // ---- 3b. the title picker: an unearned secret's title is "???" with its hint (review r1 M1) ----
  const s3 = save();
  delete s3.missions.achievements.a_close_call;
  ({ page, errors } = await openWith(context, s3, '#/profile?edit=title'));
  await page.waitForSelector('[data-testid="edit-titles"]', { timeout: 30000 });
  await page.waitForTimeout(500);
  const tt = await page.evaluate(() => {
    const row = (id) => document.querySelector(`[data-testid="edit-titles"] [data-title="${id}"]`);
    const all = document.querySelector('[data-testid="edit-titles"]')?.textContent || '';
    return {
      closeCall: row('a_close_call')?.textContent || '',
      mirror: row('a_mirror_mirror')?.textContent || '',
    };
  });
  // in this save Mirror, Mirror is claimed (its title shows) and By a Petal is not (its title stays secret)
  check(/\?\?\?/.test(tt.closeCall) && /Hint: Cutting it close/.test(tt.closeCall), `titles: By a Petal's title reads ??? and its hint (${tt.closeCall})`);
  check(/Bravest of Them All/.test(tt.mirror), 'titles: the earned secret title shows its name');
  await page.locator('[data-testid="edit-titles"] [data-title="a_close_call"]').scrollIntoViewIfNeeded().catch(() => {});
  await shot(page, 'titles');
  await page.close();
  // a fresh save: no secret's title or how anywhere in the picker
  const fresh = save();
  delete fresh.missions.achievements.a_mirror_mirror;
  delete fresh.missions.achievements.a_close_call;
  ({ page, errors } = await openWith(context, fresh, '#/profile?edit=title'));
  await page.waitForSelector('[data-testid="edit-titles"]', { timeout: 30000 });
  await page.waitForTimeout(500);
  const leak = await page.evaluate(() => /Bravest of Them All|Mirror Queen 25|Cool Under Pressure|exactly 1 life/.test(document.querySelector('[data-testid="edit-titles"]')?.textContent || ''));
  check(!leak, 'titles: a save without the secrets shows neither secret title nor how it is earned');
  check(!errors.length, `titles: no console errors (${errors.slice(0, 3).join(' | ')})`);
  await page.close();

  // ---- 4. the profile wearing a new frame ----
  ({ page, errors } = await openWith(context, save({ frame: 'window_seat' }), '#/profile'));
  await page.waitForSelector('[data-testid="profile-avatar"]', { timeout: 30000 });
  await page.waitForTimeout(800);
  await settle(page);
  const av = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="profile-avatar"]');
    return { frame: a?.dataset.frame, art: !!a?.querySelector('[data-frame-art="window_seat"]') };
  });
  check(av.frame === 'window_seat' && av.art, `profile: the picture wears Window Seat (${JSON.stringify(av)})`);
  await shot(page, 'profile');
  check(!errors.length, `profile: no console errors (${errors.slice(0, 3).join(' | ')})`);
  await context.close();
}

try {
  for (const vp of viewports) await runViewport(vp);
} finally {
  await browser.close();
  await server.close();
}
log(failures.length ? `\nFAILED ${failures.length}:\n  ${failures.join('\n  ')}` : '\nALL OK');
process.exit(failures.length ? 1 : 0);
