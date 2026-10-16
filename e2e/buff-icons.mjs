// End-to-end check of buff visibility (spec §4, §5.3): Miko 3-0-0 (aura), Midori 1-0-0 (a brew),
// Chika 0-4-0 (a tune-up link), Kage and Aoi next to each other →
//   - icons over Kage (a damage icon in Midori's or Miko's tint, a rate icon), drawn by the buff layer
//     (renderer.buffIconStats);
//   - select Kage → "Buffed by" rows (Midori brew / Miko aura / Chika link) and links to her sources;
//   - select Midori → "Buffing" + Pick a girl → tap Aoi on the board → Midori's pick is Aoi and the
//     brew moves to her (sim state);
//   - settings.buffIcons 'off' → no icons; 'selected' → only the selected girl's cluster.
// Screenshots at 1280×720 and 844×390 go to --shots <dir>.
//
//   node e2e/buff-icons.mjs [--shots /tmp/shots]
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const SIZES = [[1280, 720], [844, 390]];
const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
  /Failed to load resource: net::ERR_/i,
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

const save = await server.ssrLoadModule('/src/systems/save.js');
const GIRLS = ['kage', 'miko', 'midori', 'chika', 'aoi'];
const profile = save.createProfile();
for (const id of [...GIRLS, 'hikari']) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
profile.formation = { ...(profile.formation || {}), towers: GIRLS, hero: 'hikari' };
profile.progress.stages['1-1'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
profile.settings = { ...profile.settings, autoStart: false, buffIcons: 'all' };
const saveText = JSON.stringify(profile);

const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await context.addInitScript(([key, text]) => {
  if (!sessionStorage.getItem('bi-e2e-seeded')) {
    localStorage.setItem(key, text);
    sessionStorage.setItem('bi-e2e-seeded', '1');
  }
}, [save.SAVE_KEY, saveText]);
const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (!IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const settle = (ms = 250) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);
const go = (hash) => page.evaluate((h) => { location.hash = h; }, hash);
const stats = () => page.evaluate(() => window.__battle.renderer.buffIconStats);
/** Runs the battle clock `sec` seconds (the brews tick every 6 s). */
const pump = (sec) => page.evaluate((s) => {
  const { sim } = window.__battle;
  for (let t = 0; t < s; t += 0.25) sim.update(0.25);
}, sec);
async function snapAll(name, before = null) {
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await settle(600);
    if (before) {
      await before();
      await settle(300);
    }
    const leaked = await page.evaluate(() => (document.body.innerText.match(/\b(null|undefined|NaN|Infinity)\b/g) || []).join(', ')).catch(() => '');
    check(!leaked, `${name} ${w}x${h}: no "null" / "undefined" / "NaN" on screen${leaked ? ` (${leaked})` : ''}`);
    if (shotsDir) await page.screenshot({ path: `${shotsDir}/buff-${name}-${w}x${h}.png`, timeout: 90000 }).catch((e) => log(`    (screenshot: ${String(e.message).split('\n')[0]})`));
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await settle(300);
}

try {
  await page.goto(base, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 90000 });
  await go('#/battle?stage=1-1&difficulty=normal');
  await page.waitForFunction(() => window.__battle?.ui?.act && window.__battle.ui.select, null, { timeout: 90000 });
  await settle(600);

  log('\n--- a buff cluster: Kage with Miko, Midori, Chika and Aoi around her ---');
  const u = await page.evaluate(() => {
    const { sim, ui } = window.__battle;
    sim.cash = 1e7;
    let kage = null;
    for (let y = 0.6; y < sim.map.height && !kage; y += 0.3) {
      for (let x = 0.6; x < sim.map.width && !kage; x += 0.3) {
        // left of the middle: the selected girl's panel (right side) never covers the cluster
        if (sim.placement.pathDistance(x, y) > 1.2 || x < 3 || y < 3 || x > sim.map.width * 0.55 || y > sim.map.height - 3) continue;
        if (!sim.canPlace('kage', x, y).ok) continue;
        // room for four more girls within 1.1–2.0 tiles
        let room = 0;
        for (let a = 0; a < 16; a++) {
          const r = 1.5;
          if (sim.canPlace('miko', x + Math.cos(a / 16 * Math.PI * 2) * r, y + Math.sin(a / 16 * Math.PI * 2) * r).ok) room++;
        }
        if (room >= 8) kage = ui.act.place('kage', x, y);
      }
    }
    const near = (id, rMin, rMax) => {
      for (let r = rMin; r <= rMax; r += 0.15) {
        for (let a = 0; a < 24; a++) {
          const x = kage.x + Math.cos(a / 24 * Math.PI * 2) * r;
          const y = kage.y + Math.sin(a / 24 * Math.PI * 2) * r;
          if (sim.canPlace(id, x, y).ok) return ui.act.place(id, x, y);
        }
      }
      return null;
    };
    const miko = near('miko', 1.1, 2.2);
    const midori = near('midori', 1.1, 2.2);
    const chika = near('chika', 1.1, 2.2);
    const aoi = near('aoi', 1.1, 2.4);
    for (let i = 0; i < 2; i++) ui.act.upgrade(kage.uid, 0);
    for (let i = 0; i < 3; i++) ui.act.upgrade(miko.uid, 0);
    ui.act.upgrade(midori.uid, 0);
    for (let i = 0; i < 4; i++) ui.act.upgrade(chika.uid, 1);
    return { kage: kage.uid, miko: miko?.uid, midori: midori?.uid, chika: chika?.uid, aoi: aoi?.uid, chikaTiers: chika?.tiers.join('-') };
  });
  check(u.miko != null && u.midori != null && u.chika != null && u.aoi != null, `five girls placed (Chika ${u.chikaTiers})`);
  await pump(7);
  await settle(500);
  const kageSrc = await page.evaluate((k) => window.__battle.sim.buffSources(k).map((r) => `${r.kind}:${r.key}`), u.kage);
  log(`    Kage's buffs: ${kageSrc.join(', ')}`);
  check(kageSrc.includes('aura:dmg'), 'Kage has Miko\'s damage aura');
  const brewed = await page.evaluate(() => window.__battle.sim.towers.filter((t) => t.limIn?.brew >= 0).map((t) => t.unitId));
  check(brewed.length === 1, `Midori brews one girl (${brewed.join(', ')})`);
  if (!kageSrc.includes('brew:dmg')) {
    // the auto pick chose another girl: pin Kage for the pictures (the auto pick is the sim's)
    await page.evaluate((x) => window.__battle.ui.sendPick(x.midori, x.kage), u);
    await pump(7);
  }
  check(await page.evaluate((k) => window.__battle.sim.buffSources(k).some((r) => r.kind === 'brew' && r.key === 'dmg'), u.kage), 'Kage holds Midori\'s brew (a flask damage icon)');
  const st0 = await stats();
  check(st0.rows >= 2 && st0.icons >= 3, `icons drawn over the buffed girls (rows ${st0.rows}, icons ${st0.icons})`);
  await snapAll('icons-all');

  log('\n--- Kage selected: Buffed by + links ---');
  await page.evaluate((k) => window.__battle.ui.select(k), u.kage);
  await settle(500);
  const by = await page.evaluate(() => [...document.querySelectorAll('[data-testid="buffed-by"] .bt-buff-row')].map((r) => r.textContent));
  log(`    rows: ${by.join(' | ')}`);
  check(by.length >= 2, '"Buffed by" lists her sources');
  check(/Midori/.test(by[0] || '') || /Chika/.test(by[0] || ''), 'a limited source comes first');
  check(by.some((r) => /Miko.*damage.*aura/i.test(r)), 'Miko\'s aura row names the damage');
  check(!(await page.evaluate(() => !!document.querySelector('.bt-cap-buff'))), 'the old "Buffed" chip is gone');
  const st1 = await stats();
  log(`    buff layer: ${JSON.stringify(st1)}`);
  check(st1.links >= 2, `links to her sources (${st1.links})`);
  await snapAll('kage-selected', () => page.evaluate(() => document.querySelector('[data-testid="buffed-by"]')?.scrollIntoView({ block: 'nearest' })));

  log('\n--- Midori: Buffing + Pick a girl → tap Aoi ---');
  await page.evaluate((m) => window.__battle.ui.select(m), u.midori);
  await settle(500);
  check(await page.evaluate(() => !!document.querySelector('[data-testid="buffing"]')), 'Midori shows "Buffing"');
  await page.evaluate(() => document.querySelector('[data-testid="buff-pick"]')?.scrollIntoView({ block: 'nearest' }));
  await page.locator('[data-testid="buff-pick"]').click({ timeout: 20000 });
  await settle(400);
  check(await page.evaluate(() => window.__battle.ui.picking != null), 'pick mode is on');
  const sp = await stats();
  check(sp.pick >= 1, `pick rings on the girls she reaches (${sp.pick})`);
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/buff-pick-mode-1280x720.png` }).catch(() => null);
  const at = await page.evaluate((a) => {
    const t = window.__battle.sim.getTower(a);
    return window.__battle.renderer.worldToScreen(t.x, t.y, 0.45);
  }, u.aoi);
  await page.mouse.click(at.clientX, at.clientY);
  await settle(400);
  check(await page.evaluate((x) => window.__battle.sim.getTower(x.midori).buffPick === x.aoi, u), 'Midori\'s pick is Aoi (tap on the board)');
  await pump(7);
  check(await page.evaluate((x) => window.__battle.sim.getTower(x.aoi).limIn?.brew === x.midori, u), 'the brew moved to Aoi');
  await page.evaluate((m) => window.__battle.ui.select(m), u.midori);
  await settle(400);
  await snapAll('midori-buffing', () => page.evaluate(() => document.querySelector('[data-testid="buffing"]')?.scrollIntoView({ block: 'nearest' })));

  log('\n--- the setting ---');
  await page.evaluate(() => { window.__sakura.store.profile.settings.buffIcons = 'off'; window.__sakura.store.commit('settings'); });
  await page.evaluate(() => window.__battle.ui.select(null));
  await settle(400);
  const off = await stats();
  check(off.mode === 'off' && off.icons === 0 && off.rows === 0, `Off: no icons (${off.icons})`);
  await page.evaluate(() => { window.__sakura.store.profile.settings.buffIcons = 'all'; window.__sakura.store.commit('settings'); });
  await settle(300);
  const all = await stats();
  await page.evaluate(() => { window.__sakura.store.profile.settings.buffIcons = 'selected'; window.__sakura.store.commit('settings'); });
  await page.evaluate((k) => window.__battle.ui.select(k), u.kage);
  await settle(500);
  const sel = await stats();
  const cluster = await page.evaluate((k) => {
    const { sim } = window.__battle;
    const s = new Set([k]);
    for (const r of sim.buffSources(k)) if (r.src >= 0) s.add(r.src);
    for (const r of sim.buffTargets(k)) s.add(r.uid);
    return [...s].filter((uid) => sim.buffSources(uid).length).length;
  }, u.kage);
  check(sel.mode === 'selected' && sel.rows <= cluster && sel.rows >= 1, `Selected: only Kage's cluster (${sel.rows} rows of ${cluster}; ${all.rows} with All)`);
  await page.evaluate(() => { window.__sakura.store.profile.settings.buffIcons = 'all'; window.__sakura.store.commit('settings'); });
} catch (e) {
  failures.push(`crashed: ${e.message}`);
  log(e);
} finally {
  if (errors.length) {
    log(`\nconsole / page errors:\n${errors.slice(0, 20).join('\n')}`);
    failures.push(`${errors.length} console / page error(s)`);
  }
  await browser.close();
  await server.close();
}
log(failures.length ? `\nFAILED (${failures.length}):\n- ${failures.join('\n- ')}` : '\nall buff icon checks passed');
process.exit(failures.length ? 1 : 0);
