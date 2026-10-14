// UR display (owner, Oct 14): "when you awaken ssr's all the way, give it a rainbow border, and
// change the ssr to UR with rainbow font make it EPIC!". Seeds Hotaru (SSR) at ★5, Kaede (SSR)
// at ★4, Akane (SR) and Aoi (R) at ★5 and Hikari (SSR hero) at ★5, then checks the rainbow
// frame + rainbow "UR" badge on the students list, a girl's page (header + Awakening tab),
// formation, stage prep and the battle bar + panel — and that Kaede, Akane and Aoi keep SSR / SR
// / R. Then Kaede's 5th star lands: the one-time "Ascended to UR!" moment, and she is UR after.
// Also: the small stage-prep cards keep their labels apart, the deployed hero card reads
// "Deployed", the moment's rays reach the modal edge. Last: reduced motion (system and the in-game
// setting) keeps the rainbow but stops the motion.
// Phone (844x390) and PC (1280x720).
// Usage: node e2e/ur-awaken.mjs [--shots dir]
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const args = process.argv.slice(2);
const SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const require = createRequire('/opt/node22/lib/node_modules/playwright/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
const T = 60000;

const SEED = { hotaru: 5, kaede: 4, akane: 5, aoi: 5, hikari: 5 };

async function openGame(page) {
  await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 30000 }).catch(() => null);
  if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 15000 }).catch(() => {}); }
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: T });
  await page.evaluate(async (seed) => {
    const { store } = window.__sakura;
    const unlocks = await import('/src/systems/unlocks.js');
    const p = store.profile;
    for (const [id, aw] of Object.entries(seed)) {
      if (!p.units[id]) unlocks.grantUnit(p, id);
      p.units[id].awaken = aw;
      p.units[id].level = 30;
      p.units[id].breakthrough = 2; // level cap 30
    }
    p.formation = { hero: 'hikari', towers: ['hotaru', 'kaede', 'akane', 'aoi'] };
    store.commit('test'); store.saveNow?.();
  }, SEED);
}

async function go(page, hash, selector) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForSelector(selector, { timeout: T });
  await page.waitForTimeout(500); // fade-ins settle
}

/** What a card / frame shows: UR frame, ring, badge text, ring + text animations. */
async function frameInfo(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const ring = el.querySelector(':scope > .ur-ring');
    const text = el.querySelector('.ur-text');
    const ringBefore = ring ? getComputedStyle(ring, '::before') : null;
    const r = el.getBoundingClientRect();
    return {
      ur: el.classList.contains('is-ur'),
      ring: !!ring,
      ringAnim: ringBefore?.animationName || null,
      ringPaint: ringBefore?.backgroundImage || '',
      badge: text ? text.textContent.trim() : null,
      textAnim: text ? getComputedStyle(text).animationName : null,
      textClip: text ? (getComputedStyle(text).webkitBackgroundClip || getComputedStyle(text).backgroundClip) : null,
      label: (el.querySelector('.unit-card-rarity')?.textContent || '').trim(),
      dataRarity: el.dataset.rarity || null,
      visible: r.width > 0 && r.height > 0,
    };
  }, selector);
}

/** Overlap (px²) of the TEXT of two elements (a hidden one counts as none). */
async function textOverlap(page, a, b) {
  return page.evaluate(({ a, b }) => {
    const rect = (sel) => {
      const e = document.querySelector(sel);
      if (!e || getComputedStyle(e).display === 'none') return null;
      const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect();
    };
    const ra = rect(a), rb = rect(b);
    if (!ra || !rb) return 0;
    return Math.round(Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)) * Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)));
  }, { a, b });
}

const isUrFrame = (f) => !!f && f.ur && f.ring && f.badge === 'UR' && /conic-gradient/.test(f.ringPaint);
const showsPlain = (f, label) => !!f && !f.ur && !f.ring && f.badge == null && (label == null || f.label === label);

// screenshots are evidence, not checks: a slow (shared, software-GL) machine gets a long wait and
// one retry, and a miss is reported without failing the run
async function shot(page, name) {
  if (!SHOTS) return;
  for (let i = 0; i < 2; i++) {
    try {
      await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 150000 });
      return;
    } catch (e) {
      if (i) console.log(`  warn screenshot ${name} skipped: ${String(e.message).split('\n')[0]}`);
    }
  }
}

async function scrollTo(page, selector) {
  await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center', inline: 'center' }), selector);
  await page.waitForTimeout(250);
}

try {
  for (const [W, H] of [[844, 390], [1280, 720]]) {
    const tag = `${W}x${H}`;
    const touch = W < 1000;
    const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch });
    page.setDefaultTimeout(T);
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await openGame(page);
    const before = await page.evaluate(async () => {
      const t = await import('/src/data/types.js');
      const g = await import('/src/systems/gacha.js');
      const p = window.__sakura.store.profile;
      return { rarities: Object.keys(t.UNIT_RARITIES), pools: Object.keys(g.POOL), fragments: p.items?.star_fragment || 0, pity: p.gacha?.pity };
    });
    check(before.rarities.join() === 'R,SR,SSR' && before.pools.join() === 'R,SR,SSR', `${tag} game rarities stay R/SR/SSR (${before.rarities.join('/')}; pools ${before.pools.join('/')})`);

    // ---- students list
    await go(page, '#/students', '.unit-card[data-unit="hotaru"]');
    const sHot = await frameInfo(page, '.unit-card[data-unit="hotaru"]');
    check(isUrFrame(sHot) && sHot.dataRarity === 'UR', `${tag} students: Hotaru ★5 has the rainbow frame + "UR" badge (${JSON.stringify({ ur: sHot?.ur, ring: sHot?.ring, badge: sHot?.badge })})`);
    check(sHot?.ringAnim === 'ur-spin' && sHot?.textAnim === 'ur-shimmer' && sHot?.textClip === 'text', `${tag} students: the rainbow turns and the letters shimmer (ring ${sHot?.ringAnim}, text ${sHot?.textAnim}, clip ${sHot?.textClip})`);
    const edge = await page.evaluate(() => {
      const c = document.querySelector('.unit-card[data-unit="hotaru"]');
      const nameGap = (id) => { const e = document.querySelector(`.unit-card[data-unit="${id}"] .unit-card-name`); const r = document.createRange(); r.selectNodeContents(e); return Math.round(e.closest('.unit-card').getBoundingClientRect().bottom - r.getBoundingClientRect().bottom); };
      const glints = [...c.querySelectorAll(':scope > .ur-sparkles i')];
      return { border: getComputedStyle(c).borderBottomWidth, gapUr: nameGap('hotaru'), gapSsr: nameGap('kaede'), glints: glints.length, glintAnim: glints[0] ? getComputedStyle(glints[0]).animationName : null, shown: getComputedStyle(c.querySelector(':scope > .ur-sparkles')).display };
    });
    check(edge.border === '0px' && edge.gapUr === edge.gapSsr, `${tag} students: the rainbow runs to the card's bottom edge (no rarity strip under it: border ${edge.border}), her name sits where Kaede's does (${edge.gapUr} / ${edge.gapSsr} px)`);
    check(edge.glints === 3 && edge.shown === 'block' && edge.glintAnim === 'ur-glint', `${tag} students: three glints twinkle on her frame (${edge.glints}, ${edge.glintAnim})`);
    for (const [id, label] of [['kaede', 'SSR'], ['akane', 'SR'], ['aoi', 'R']]) {
      const f = await frameInfo(page, `.unit-card[data-unit="${id}"]`);
      check(showsPlain(f, label), `${tag} students: ${id} (★${SEED[id]}) still shows ${label} — "${f?.label}", no rainbow`);
    }
    // sort by rarity: the UR leads the SSRs
    await page.selectOption('.mb-sort select', 'rarity');
    await page.waitForTimeout(400);
    const order = await page.evaluate(() => [...document.querySelectorAll('.mb-student-grid .unit-card')].map((c) => c.dataset.unit));
    check(['hikari', 'hotaru'].every((id) => order.slice(0, 2).includes(id)) && order.indexOf('kaede') > 1, `${tag} students: rarity sort puts the URs (Hikari, Hotaru) before the SSRs (${order.slice(0, 4).join(', ')})`);
    await page.selectOption('.mb-sort select', 'power');
    await page.waitForTimeout(300);
    await scrollTo(page, '.unit-card[data-unit="hotaru"]');
    await shot(page, `students-${tag}`);

    // ---- a girl's page: header tag, showcase frame, Awakening tab panel
    await go(page, '#/student/hotaru?tab=awaken', '[data-testid="rarity-tag"]');
    const head = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="rarity-tag"]');
      const stage = document.querySelector('.mb-show-stage');
      return { ur: t.classList.contains('is-ur'), text: t.textContent.trim(), ring: !!t.querySelector('.ur-ring'), stageUr: stage?.classList.contains('is-ur'), stageRing: !!stage?.querySelector(':scope > .ur-ring'), panel: !!document.querySelector('[data-testid="ur-panel"]'), awBadge: !!document.querySelector('.mb-aw-head .ur-badge') };
    });
    check(head.ur && head.text === 'UR' && head.ring, `${tag} Hotaru's page: header tag reads UR in rainbow with a rainbow edge`);
    check(head.stageUr && head.stageRing, `${tag} Hotaru's page: her card art has the rainbow frame`);
    check(head.panel && head.awBadge, `${tag} Hotaru's page: Awakening tab shows "Ascended to UR"`);
    await shot(page, `student-hotaru-${tag}`);
    await page.locator('[data-testid="view-3d"]').click({ force: true });
    await page.waitForTimeout(400);
    const s3d = await page.evaluate(() => { const s = document.querySelector('.mb-show-stage'); const ring = s?.querySelector(':scope > .ur-ring'); return { is3d: s?.classList.contains('is-3d'), ur: s?.classList.contains('is-ur'), ring: !!ring && getComputedStyle(ring).display !== 'none' }; });
    check(s3d.is3d && s3d.ur && s3d.ring, `${tag} Hotaru's page: the 3D Chibi view keeps the rainbow frame`);
    await page.locator('[data-testid="view-card"]').click({ force: true });
    await page.waitForTimeout(300);
    await go(page, '#/student/kaede?tab=awaken', '[data-testid="rarity-tag"]');
    const kHead = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="rarity-tag"]');
      return { ur: t.classList.contains('is-ur'), text: t.textContent.trim(), stageUr: document.querySelector('.mb-show-stage')?.classList.contains('is-ur'), panel: !!document.querySelector('[data-testid="ur-panel"]') };
    });
    check(!kHead.ur && kHead.text === 'SSR' && !kHead.stageUr && !kHead.panel, `${tag} Kaede's page (★4): plain SSR tag, no rainbow`);

    // ---- formation
    await go(page, '#/formation', '.mb-fslot.filled[data-unit="hotaru"]');
    const fHot = await frameInfo(page, '.mb-fslot.filled[data-unit="hotaru"]');
    const fKae = await frameInfo(page, '.mb-fslot.filled[data-unit="kaede"]');
    const fHero = await frameInfo(page, '.mb-fslot.filled[data-unit="hikari"]');
    const fPick = await frameInfo(page, '.mb-pick .unit-card[data-unit="hotaru"]');
    check(isUrFrame(fHot), `${tag} formation: Hotaru's squad slot has the rainbow frame + UR badge`);
    check(isUrFrame(fHero), `${tag} formation: Hikari (SSR hero ★5) in the hero slot is UR`);
    check(isUrFrame(fPick), `${tag} formation: Hotaru's picker card is UR`);
    check(fKae && !fKae.ur && !fKae.ring, `${tag} formation: Kaede's slot (★4) has no rainbow`);
    await shot(page, `formation-${tag}`);

    // ---- stage prep
    await go(page, '#/stage/1-1', '.ma-fslot .unit-card[data-unit="hotaru"]');
    const pHot = await frameInfo(page, '.ma-fslot .unit-card[data-unit="hotaru"]');
    const pKae = await frameInfo(page, '.ma-fslot .unit-card[data-unit="kaede"]');
    check(isUrFrame(pHot), `${tag} stage prep: Hotaru's formation card is UR`);
    check(showsPlain(pKae, 'SSR'), `${tag} stage prep: Kaede's card still SSR ("${pKae?.label}")`);
    const prepOv = [];
    for (const id of ['hikari', 'hotaru', 'kaede']) {
      const card = `.ma-fslot .unit-card[data-unit="${id}"]`;
      prepOv.push(await textOverlap(page, `${card} .unit-card-rarity`, `${card} .unit-card-level`), await textOverlap(page, `${card} .unit-card-level`, `${card} .unit-card-name`));
    }
    check(prepOv.every((a) => a === 0), `${tag} stage prep: on the small cards the rarity label, "Lv.30" and the name never overlap (${prepOv.join(', ')} px²; phones leave the label to the colour strip / rainbow ring)`);
    await scrollTo(page, '.ma-fslot .unit-card[data-unit="hotaru"]');
    await shot(page, `stage-prep-${tag}`);

    // ---- battle: bar cards + selected-girl panel
    await page.evaluate(() => { location.hash = '#/battle?stage=1-1&difficulty=normal'; });
    await page.waitForFunction(() => window.__battle?.sim && window.__battle.ui?.select && document.querySelector('[data-testid="card-hotaru"]'), null, { timeout: 90000 });
    await page.waitForTimeout(800);
    const bHot = await frameInfo(page, '[data-testid="card-hotaru"]');
    const bKae = await frameInfo(page, '[data-testid="card-kaede"]');
    const bHero = await frameInfo(page, '[data-testid="card-hikari"]');
    const bAka = await frameInfo(page, '[data-testid="card-akane"]');
    check(isUrFrame(bHot) && bHot.visible, `${tag} battle bar: Hotaru's card has the rainbow frame + UR badge`);
    check(isUrFrame(bHero), `${tag} battle bar: Hikari's hero card is UR`);
    check(bKae && !bKae.ur && !bKae.ring && bAka && !bAka.ur, `${tag} battle bar: Kaede (★4) and Akane (SR) have no rainbow`);
    const placed = await page.evaluate(() => {
      const { sim, ui } = window.__battle;
      sim.cash = 1e6;
      const out = {};
      for (const id of ['hotaru', 'kaede', 'hikari']) {
        for (let y = 0.5; y < sim.map.height && out[id] == null; y += 0.5) {
          for (let x = 0.5; x < sim.map.width && out[id] == null; x += 0.5) {
            if (!sim.canPlace(id, x, y).ok) continue;
            const r = sim.placeTower(id, x, y);
            out[id] = r?.uid ?? (typeof r === 'number' ? r : null);
          }
        }
      }
      ui.select(out.hotaru);
      return out;
    });
    await page.waitForFunction(() => { const el = document.querySelector('[data-testid="tower-panel"]'); return el && !el.hidden; }, null, { timeout: T });
    await page.waitForTimeout(400);
    const panel = await page.evaluate(() => {
      const p = document.querySelector('[data-testid="tower-panel"]');
      const portrait = p.querySelector('.bt-panel-portrait');
      return { ur: portrait?.classList.contains('is-ur'), ring: !!portrait?.querySelector('.ur-ring'), badge: p.querySelector('.bt-panel-name .ur-badge')?.textContent.trim() || null, name: p.querySelector('.bt-panel-name')?.textContent || '' };
    });
    check(placed.hotaru != null && panel.ur && panel.ring && panel.badge === 'UR', `${tag} battle panel: Hotaru's portrait has the rainbow ring and "UR" by her name (${panel.name.replace(/\s+/g, ' ')})`);
    await shot(page, `battle-${tag}`);
    await page.evaluate((uid) => { window.__battle.ui.select(null); window.__battle.ui.select(uid); }, placed.kaede);
    await page.waitForTimeout(400);
    const panelK = await page.evaluate(() => {
      const p = document.querySelector('[data-testid="tower-panel"]');
      return { ur: p.querySelector('.bt-panel-portrait')?.classList.contains('is-ur'), badge: !!p.querySelector('.bt-panel-name .ur-badge') };
    });
    check(placed.kaede != null && !panelK.ur && !panelK.badge, `${tag} battle panel: Kaede (★4) shows no UR`);
    await page.evaluate(() => window.__battle.ui.select(null));
    await page.waitForFunction(() => !document.querySelector('[data-testid="hero-widget"]')?.hidden, null, { timeout: 15000 }).catch(() => {});
    const heroW = await frameInfo(page, '[data-testid="hero-widget"] .bt-herow-portrait');
    check(placed.hikari != null && heroW?.ur && heroW.ring, `${tag} battle: the deployed hero's portrait (Hikari ★5) wears the rainbow ring`);
    const dep = await page.evaluate(() => { const c = document.querySelector('[data-testid="card-hikari"]'); const d = c.querySelector('.bt-card-deployed'); return { deployed: c.classList.contains('bt-deployed'), ring: !!c.querySelector(':scope > .ur-ring'), fits: d.scrollWidth <= d.clientWidth }; });
    const depOv = await textOverlap(page, '[data-testid="card-hikari"] .bt-card-ur', '[data-testid="card-hikari"] .bt-card-deployed');
    check(dep.deployed && dep.ring && dep.fits && depOv === 0, `${tag} battle bar: the deployed hero card reads "Deployed" in full, the UR badge stays off it (overlap ${depOv} px²), the ring stays`);
    const align = await page.evaluate(() => { const top = (id) => { const e = document.querySelector(`[data-testid="card-${id}"] .bt-card-cost-val`); const r = document.createRange(); r.selectNodeContents(e); return Math.round(r.getBoundingClientRect().top); }; return [top('hotaru'), top('kaede')]; });
    check(align[0] === align[1], `${tag} battle bar: Hotaru's cost sits level with Kaede's (${align.join(' / ')})`);

    // ---- other places her card appears: mall spark offer, lobby background picker, select ticket
    await go(page, '#/mall?tab=recruit', '.ma-offer[data-offer="spark_hotaru"]');
    const mHot = await frameInfo(page, '.ma-offer[data-offer="spark_hotaru"] .ma-offer-portrait');
    const mKae = await frameInfo(page, '.ma-offer[data-offer="spark_kaede"] .ma-offer-portrait');
    check(mHot?.ur && mHot.ring && mKae && !mKae.ur, `${tag} mall: Hotaru's spark portrait has the rainbow ring, Kaede's not`);
    const ribbons = await page.evaluate(() => ['hotaru', 'kaede'].map((id) => document.querySelector(`.ma-offer[data-offer="spark_${id}"] .ma-offer-ribbon`)?.textContent.trim()));
    check(ribbons[0] === 'UR' && ribbons[1] === 'SSR', `${tag} mall: the offer ribbon reads UR for Hotaru, SSR for Kaede (${ribbons.join(' / ')})`);
    await page.evaluate(async () => {
      const { openBackgroundPicker } = await import('/src/ui/lobby/bgPicker.js');
      openBackgroundPicker({ girl: 'hotaru' });
    });
    await page.waitForSelector('[data-testid="bgp-girl-hotaru"]', { timeout: T });
    const gHot = await frameInfo(page, '[data-testid="bgp-girl-hotaru"] .bgp-girl-art');
    const gKae = await frameInfo(page, '[data-testid="bgp-girl-kaede"] .bgp-girl-art');
    check(gHot?.ur && gHot.ring && gKae && !gKae.ur, `${tag} background picker: Hotaru's thumb has the rainbow ring, Kaede's not`);
    await page.locator('[data-testid="bgp-done"]').click({ force: true });
    await page.waitForTimeout(300);
    await page.evaluate(async () => {
      const { store } = window.__sakura;
      const inv = await import('/src/systems/inventory.js');
      inv.addItems(store.profile, [{ id: 'ticket_ssr_select', count: 1 }]);
      store.commit('test');
      const { openSelectTicket } = await import('/src/ui/selectTicket.js');
      openSelectTicket();
    });
    await page.waitForSelector('[data-testid="sst-hotaru"]', { timeout: T });
    const tHot = await frameInfo(page, '[data-testid="sst-hotaru"]');
    const tKae = await page.evaluate(() => { const c = document.querySelector('[data-testid="sst-kaede"]'); return { ur: c.classList.contains('is-ur'), label: c.querySelector('.sst-rarity')?.textContent.trim() }; });
    check(isUrFrame(tHot) && !tKae.ur && tKae.label === 'SSR', `${tag} SSR Select Ticket: Hotaru (owned, ★5) shows UR, Kaede shows SSR`);
    await page.locator('.sst-modal .modal-actions button', { hasText: 'Cancel' }).click({ force: true });
    await page.waitForSelector('.sst-modal', { state: 'detached', timeout: 10000 }).catch(() => {});

    // ---- the 5th star lands: "Ascended to UR!" (once), then Kaede is UR everywhere
    await page.evaluate(() => { location.hash = '#/lobby'; });
    await page.waitForTimeout(800);
    await page.evaluate(async () => {
      const { store } = window.__sakura;
      const inv = await import('/src/systems/inventory.js');
      const prog = await import('/src/systems/progression.js');
      inv.addItems(store.profile, prog.awakenCost('kaede', 5));
      store.commit('test');
    });
    const fragBefore = await page.evaluate(() => window.__sakura.store.profile.items?.star_fragment || 0);
    await go(page, '#/student/kaede?tab=awaken', '[data-testid="awaken"]');
    await page.locator('[data-testid="awaken"]').click({ force: true });
    const moment = await page.waitForSelector('[data-testid="ur-ascend"]', { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(1900); // SSR → UR swap finishes
    const m = moment ? await page.evaluate(() => {
      const el = document.querySelector('[data-testid="ur-ascend"]');
      const body = el.closest('.modal-body');
      return {
        title: el.querySelector('.ur-ascend-title')?.textContent.trim(), badge: el.querySelector('.ur-ascend-new .ur-text')?.textContent.trim(), ring: !!el.querySelector('.ur-ascend-card .ur-ring'),
        fits: (() => { const r = el.closest('.modal').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; })(),
        // the rays reach the modal's rounded edge: the body neither clips them nor scrolls
        bodyOverflow: getComputedStyle(body).overflowY, titleDelay: parseFloat(getComputedStyle(el.querySelector('.ur-ascend-title')).animationDelay) || 0,
      };
    }) : null;
    check(!!m && m.title === 'Ascended to UR!' && m.badge === 'UR' && m.ring, `${tag} 5th star: the "Ascended to UR!" moment shows her card in the rainbow frame`);
    check(!!m?.fits, `${tag} 5th star: the moment fits the screen`);
    check(m?.bodyOverflow === 'visible', `${tag} 5th star: the light rays are not cut off by (or scrollable in) the modal body (overflow ${m?.bodyOverflow})`);
    check((m?.titleDelay || 0) >= 1, `${tag} 5th star: "Ascended to UR!" waits for SSR to turn into UR (delay ${m?.titleDelay}s)`);
    await shot(page, `ascend-${tag}`);
    if (moment) await page.locator('[data-testid="ur-ascend-ok"]').click({ force: true });
    await page.waitForSelector('[data-testid="ur-ascend"]', { state: 'detached', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="rarity-tag"]');
      const p = window.__sakura.store.profile;
      return { ur: t?.classList.contains('is-ur'), text: t?.textContent.trim(), panel: !!document.querySelector('[data-testid="ur-panel"]'), awaken: p.units.kaede.awaken, frags: p.items?.star_fragment || 0, again: !!document.querySelector('[data-testid="ur-ascend"]') };
    });
    check(after.awaken === 5 && after.ur && after.text === 'UR' && after.panel, `${tag} after the moment: Kaede ★${after.awaken} is UR on her page`);
    check(after.frags === fragBefore - 80, `${tag} the 5th star cost its usual 80 Star Fragments (${fragBefore} → ${after.frags})`);
    // the moment is one-time: re-opening her page shows the panel, not the moment
    await go(page, '#/student/kaede?tab=info', '[data-testid="rarity-tag"]');
    await go(page, '#/student/kaede?tab=awaken', '[data-testid="ur-panel"]');
    check(!(await page.$('[data-testid="ur-ascend"]')), `${tag} the moment does not come back on a later visit`);
    const pity = await page.evaluate(() => window.__sakura.store.profile.gacha?.pity);
    check(pity === before.pity, `${tag} gacha pity untouched (${before.pity} → ${pity})`);
    check(errs.length === 0, `${tag} no page errors${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
    await page.close();
  }

  // ---- reduced motion: the rainbow stays, nothing moves (system setting, then the game's own)
  for (const mode of ['system', 'setting']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: mode === 'system' ? 'reduce' : 'no-preference' });
    page.setDefaultTimeout(T);
    await openGame(page);
    if (mode === 'setting') {
      await page.evaluate(async () => {
        const { store } = window.__sakura;
        store.profile.settings.reduceMotion = true;
        store.commit('test');
        const c = await import('/src/ui/components.js');
        c.applyMotionPreference?.();
      });
    }
    await go(page, '#/students', '.unit-card[data-unit="hotaru"]');
    const f = await frameInfo(page, '.unit-card[data-unit="hotaru"]');
    const glint = await page.evaluate(() => { const g = document.querySelector('.unit-card[data-unit="hotaru"] > .ur-sparkles i'); const cs = getComputedStyle(g); return { anim: cs.animationName, opacity: Number(cs.opacity) }; });
    check(glint.anim === 'none' && glint.opacity > 0.5, `reduced motion (${mode}): the glints hold still and stay visible (${glint.anim}, opacity ${glint.opacity})`);
    const attr = await page.evaluate(() => document.documentElement.hasAttribute('data-reduce-motion'));
    check(isUrFrame(f) && f.ringAnim === 'none' && f.textAnim === 'none', `reduced motion (${mode}${mode === 'setting' ? `, data-reduce-motion=${attr}` : ''}): still rainbow, no turning, no shimmer (ring ${f?.ringAnim}, text ${f?.textAnim})`);
    if (SHOTS && mode === 'system') await shot(page, 'students-reduced-motion-1280x720');
    await page.close();
  }

  // ---- cost: every SSR at ★5 on one screen; the ring turns on the compositor (no paint per frame)
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.setDefaultTimeout(T);
    await openGame(page);
    await page.evaluate(async () => {
      const { store } = window.__sakura;
      const unlocks = await import('/src/systems/unlocks.js');
      for (const id of ['hikari', 'luna', 'hotaru', 'kaede', 'chika']) {
        if (!store.profile.units[id]) unlocks.grantUnit(store.profile, id);
        store.profile.units[id].awaken = 5;
      }
      store.commit('test');
    });
    await go(page, '#/students', '.unit-card[data-unit="chika"]');
    const n = await page.evaluate(() => document.querySelectorAll('.unit-card.is-ur').length);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Animation.enable');
    const kinds = await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === 'ur-spin').map((a) => Object.keys(a.effect.getKeyframes()[0]).filter((k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k))).flat());
    check(n === 5, `cost: ${n} UR cards on the students screen`);
    check(kinds.length >= 5 && kinds.every((k) => k === 'transform'), `cost: the rainbow rings animate transform only (${[...new Set(kinds)].join(', ') || 'none'}) — compositor work, no layout/paint per frame`);
    const glintKinds = await page.evaluate(() => [...new Set(document.getAnimations().filter((a) => ['ur-glint', 'ur-sheen'].includes(a.animationName)).flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k))).filter((k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)))]);
    check(glintKinds.length > 0 && glintKinds.every((k) => k === 'transform' || k === 'opacity'), `cost: glints and light sweep animate ${glintKinds.join(' + ')} only`);
    const frames = await page.evaluate(() => new Promise((res) => {
      const t = []; let last = performance.now();
      const step = (now) => { t.push(now - last); last = now; if (t.length < 90) requestAnimationFrame(step); else res(t.slice(5)); };
      requestAnimationFrame(step);
    }));
    frames.sort((a, b) => a - b);
    console.log(`  info students screen with ${n} UR cards: median frame ${frames[Math.floor(frames.length / 2)].toFixed(1)} ms, p95 ${frames[Math.floor(frames.length * 0.95)].toFixed(1)} ms (shared software-GL machine)`);
    await page.close();
  }
} catch (e) {
  fails.push(`crashed: ${e.stack || e}`);
  console.log(e);
} finally {
  await browser.close().catch(() => {});
  await server.close();
}
console.log(fails.length ? `\n${fails.length} CHECK(S) FAILED` : '\nALL UR AWAKEN CHECKS PASSED');
process.exit(fails.length ? 1 : 0);
