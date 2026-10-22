// End-to-end check of the companion figures (src/render/companions.js) in a battle at 844×390:
//   Ruri, Hana and Yoriko (hero) are placed; their three companions exist as 3D figures (Kon, Kaze, the doll);
//   Kon runs from Ruri to his post at her relay origin and acts there (FX-1: within 0.6 tiles of it); Kaze leaves Hana's shoulder on one of her attacks and
//   comes back (and is drawn 1.3x in battle, Kon 2.4x); the doll dashes on Yoriko's needles (an enemy parked by her on the
//   road; Dream Detour is only a fallback after that check); the lowest graphics setting drops the figures (Kon falls back
//   to the procedural holo fox); the student page shows the companion beside the girl; no console errors.
// Frame strips of each behaviour (the battle paused, the renderer stepped by hand) and overview shots go to
// --shots <dir> (jpg). Compose the strips with tools of your choice; the frames are named <behaviour>-<n>.jpg.
//
//   node e2e/companions.mjs [--shots /tmp/shots]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a check fails.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const shotsDir = opt('shots', null);
const onlyStudents = args.includes('--students'); // only the student pages (quick look)
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
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
const profile = save.createProfile();
for (const id of ['ruri', 'hana', 'yoriko']) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
profile.formation = { ...(profile.formation || {}), towers: ['ruri', 'hana'], hero: 'yoriko' };
profile.progress.stages['1-1'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
profile.settings = { ...profile.settings, autoStart: false, quality: 'high', camera: 'free' };
const saveText = JSON.stringify(profile);

const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await context.addInitScript(([key, text]) => {
  if (!sessionStorage.getItem('comp-e2e-seeded')) {
    localStorage.setItem(key, text);
    sessionStorage.setItem('comp-e2e-seeded', '1');
  }
}, [save.SAVE_KEY, saveText]);
const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'warning' && /\[companions\] disabled/.test(t)) errors.push(`[console] ${t}`);
  if (m.type() !== 'error') return;
  if (!IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const settle = (ms = 250) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);
const go = (hash) => page.evaluate((h) => { location.hash = h; }, hash);
const probe = () => page.evaluate(() => window.__battle.renderer.companionsProbe());
const actor = async (cid) => (await probe()).actors.find((a) => a.cid === cid) || null;
const pause = (on) => page.evaluate((p) => { window.__battle.ui.paused = p; }, on);
/** Advances only the renderer (companions, mixers, FX) by dt while the battle is paused. */
const step = (dt) => page.evaluate((d) => { window.__battle.renderer.update(d); }, dt);

async function shot(name, clip = null) {
  if (!shotsDir) return;
  await page.screenshot({ path: `${shotsDir}/${name}.jpg`, type: 'jpeg', quality: 82, ...(clip ? { clip } : {}), timeout: 90000 })
    .catch((e) => log(`    (screenshot: ${String(e.message).split('\n')[0]})`));
}

/** Screen box (CSS px) around world points [x, z, h], padded, clamped to the viewport. */
async function boxAround(points, pad = 40, minW = 200, minH = 150) {
  const s = await page.evaluate((pts) => pts.map(([x, z, h]) => window.__battle.renderer.worldToScreen(x, z, h)), points);
  let x0 = Math.min(...s.map((p) => p.clientX)) - pad;
  let x1 = Math.max(...s.map((p) => p.clientX)) + pad;
  let y0 = Math.min(...s.map((p) => p.clientY)) - pad;
  let y1 = Math.max(...s.map((p) => p.clientY)) + pad;
  if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
  if (y1 - y0 < minH) { const c = (y0 + y1) / 2; y0 = c - minH / 2; y1 = c + minH / 2; }
  const vw = 844;
  const vh = 390;
  x0 = Math.max(0, Math.min(vw - 20, x0));
  y0 = Math.max(0, Math.min(vh - 20, y0));
  return { x: Math.round(x0), y: Math.round(y0), width: Math.round(Math.min(vw, x1) - x0), height: Math.round(Math.min(vh, y1) - y0) };
}

/** Zooms the free camera at a world point (wheel steps). */
async function zoomAt(x, z, steps) {
  const s = await page.evaluate(([wx, wz]) => window.__battle.renderer.worldToScreen(wx, wz, 0), [x, z]);
  await page.mouse.move(s.clientX, s.clientY);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, -240);
    await settle(60);
  }
  await settle(400);
  return page.evaluate(() => window.__battle.renderer.cameraState.zoom);
}

/** Places a girl on a visible spot whose distance to the road lies in [dMin, dMax]; returns her uid or null. */
async function placeNear(unitId, dMin, dMax, gap = 1.5, minY = 130, fromBottom = false) {
  return page.evaluate(([id, a, b, g, top, rev]) => {
    const { sim, ui, renderer } = window.__battle;
    sim.cash = 1e7;
    const barTop = ui.bar?.el?.getBoundingClientRect().top ?? innerHeight;
    for (let i = 0; i < sim.map.height * 4; i++) {
      const y = rev ? sim.map.height - 0.6 - i * 0.25 : 0.6 + i * 0.25;
      if (y < 0.6 || y > sim.map.height - 0.6) continue;
      for (let x = 0.6; x < sim.map.width; x += 0.25) {
        if (!sim.canPlace(id, x, y).ok) continue;
        const d = sim.placement.pathDistance(x, y);
        if (d < a || d > b) continue;
        if (sim.towers.some((t) => Math.hypot(t.x - x, t.y - y) < g)) continue;
        const s = renderer.worldToScreen(x, y, 0);
        if (!s.visible || s.clientY > barTop - 30 || s.clientY < top || s.clientX < 60 || s.clientX > innerWidth - 60) continue;
        const t = ui.act.place(id, x, y);
        ui.placement?.cancel?.(); // a hero card / tapped card waiting for a board tap holds the camera still
        if (t) return t.uid;
      }
    }
    return null;
  }, [unitId, dMin, dMax, gap, minY, fromBottom]);
}

async function studentPages() {
  log('\n--- the student page shows the companion beside her ---');
  for (const id of ['ruri', 'hana', 'yoriko']) {
    for (let i = 0; i < 3; i++) {
      await go(`#/student/${id}`);
      await settle(900);
      const name = await page.evaluate(() => document.querySelector('.mb-show-name')?.textContent || '');
      if (name.toLowerCase().includes(id)) break;
      await page.keyboard.press('Escape').catch(() => null);
    }
    // a story toast (a lesson unlocked by the battle) would take a stray click to the journal
    await page.evaluate(() => document.querySelectorAll('.jn-toast').forEach((e) => e.remove()));
    const tab = page.locator('[data-testid="view-3d"]').first();
    if (await tab.count()) await tab.click({ force: true });
    await settle(3500);
    const shown = await page.evaluate(() => ({ hash: location.hash, name: document.querySelector('.mb-show-name')?.textContent || '', d3: !!document.querySelector('.gp-3d canvas, .mb-show-3d canvas') }));
    check(/student/.test(shown.hash) && shown.name.toLowerCase().includes(id) && shown.d3, `${id}: her page shows the 3D figure (${shown.name}, ${shown.hash})`);
    await shot(`student-${id}`);
  }
}

try {
  await page.goto(base, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 90000 });
  if (onlyStudents) {
    await studentPages();
    throw new Error('students only');
  }
  await page.evaluate(() => {
    const { store } = window.__sakura;
    store.profile.battleSaves = {};
    store.commit('formation');
  });
  await go('#/battle?stage=1-1&difficulty=normal');
  const ok = await page.waitForFunction(() => window.__battle?.ui?.act && window.__battle.sim.heroConfig?.unitId === 'yoriko', null, { timeout: 90000 }).then(() => true, () => false);
  check(ok, 'battle 1-1 opens with Yoriko as the hero');
  await settle(800);

  log('\n--- placing Hana, Yoriko, then Ruri (her relay origin away from her) ---');
  const hana = await placeNear('hana', 0.6, 1.5);
  const yoriko = await placeNear('yoriko', 0.6, 1.5, 1.5, 130, true); // down the road from Hana: she gets the first shots
  check(hana != null && yoriko != null, `Hana (${hana}) and Yoriko (${yoriko}) placed`);
  await page.waitForFunction(() => window.__battle.renderer.companionsProbe().actors.length >= 2, null, { timeout: 60000 }).catch(() => null);
  await pause(true);
  const ruri = await placeNear('ruri', 2.0, 3.2);
  check(ruri != null, `Ruri placed (${ruri})`);
  const t0 = await page.evaluate((u) => { const t = window.__battle.sim.getTower(u); return { x: t.x, y: t.y, ox: t.ox, oy: t.oy }; }, ruri);
  check(Math.hypot(t0.ox - t0.x, t0.oy - t0.y) > 0.5, `her relay origin is away from her (${Math.hypot(t0.ox - t0.x, t0.oy - t0.y).toFixed(2)} tiles)`);
  // paused: the renderer still draws (dt 0) and makes Kon once his file is here
  await page.waitForFunction(() => window.__battle.renderer.companionsProbe().actors.some((a) => a.cid === 'kon'), null, { timeout: 60000 }).catch(() => null);
  const p0 = await probe();
  const cids = p0.actors.map((a) => a.cid).sort().join(',');
  check(p0.enabled && cids === 'doll,kaze,kon', `three companion figures exist (${cids})`);
  const kon0 = await actor('kon');
  check(kon0 && kon0.mode === 'home', `Kon starts by Ruri (${kon0?.mode})`);

  log('\n--- Kon runs to the relay origin ---');
  log(`    zoom ${await zoomAt((t0.x + t0.ox) / 2, (t0.y + t0.oy) / 2, 6)}`);
  const konBox = await boxAround([[t0.x, t0.y, 0], [t0.ox, t0.oy, 0], [t0.x, t0.y, 1.2]], 50, 260, 170);
  const konModes = [];
  for (let i = 0; i < 10; i++) {
    await step(0.14);
    await settle(30);
    konModes.push((await actor('kon'))?.mode);
    await shot(`kon-${i}`, konBox);
  }
  check(konModes.includes('travel'), `Kon runs (${konModes.join(' ')})`);
  for (let i = 0; i < 20 && (await actor('kon'))?.mode !== 'spot'; i++) await step(0.2);
  const kon1 = await actor('kon');
  // FX-1: his post is the relay origin (slid sideways when it sits straight behind her from the camera); there
  // he acts (guard, hops, patrol, play) but never strays more than 0.6 tiles from the bolt origin in a wave
  // (between waves he may trot to Ruri for a pat or a nap)
  const leashOk = kon1 && (Math.hypot(kon1.x - t0.ox, kon1.z - t0.oy) <= 0.6 + 1e-3 || ['play', 'rest', 'trot'].includes(kon1.act));
  check(kon1?.mode === 'spot' && leashOk, `Kon is at his post by her relay origin (${kon1?.x}, ${kon1?.z} vs ${t0.ox.toFixed(3)}, ${t0.oy.toFixed(3)}; ${kon1?.act})`);
  await page.evaluate(() => window.__battle.renderer.resetCamera());
  await step(0.05);
  await settle(500);
  await shot('battle-844x390');
  const mid = await page.evaluate(() => { const ts = window.__battle.sim.towers; return [ts.reduce((a, t) => a + t.x, 0) / ts.length, ts.reduce((a, t) => a + t.y, 0) / ts.length]; });
  await zoomAt(mid[0], mid[1], 2);
  await step(0.05);
  await shot('battle-zoom-844x390');
  await page.evaluate(() => window.__battle.renderer.resetCamera());
  await step(0.05);

  log('\n--- Kaze swoops on Hana\'s attack and comes back ---');
  await pause(false);
  await page.evaluate(() => { window.__battle.ui.speed = 3; window.__battle.ui.startWave(); });
  const swoop = await page.waitForFunction(() => window.__battle.renderer.companionsProbe().actors.find((a) => a.cid === 'kaze')?.mode === 'sortie', null, { timeout: 150000, polling: 'raf' }).then(() => true, () => false);
  await pause(true);
  check(swoop, 'Hana attacks: Kaze sets off on a swoop');
  if (!swoop) {
    log('    state:', await page.evaluate(() => { const { sim, ui } = window.__battle; return JSON.stringify({ wave: sim.wave, paused: ui.paused, ended: ui.ended, enemies: sim.enemies.length, towers: sim.towers.map((t) => [t.unitId, +t.x.toFixed(2), +t.y.toFixed(2), sim.placement.pathDistance(t.x, t.y).toFixed(2)]), hash: location.hash }); }));
    await shot('debug-noswoop');
  }
  const k0 = await actor('kaze');
  if (k0?.target) {
    const hb = await page.evaluate((u) => { const t = window.__battle.sim.getTower(u); return [t.x, t.y]; }, hana);
    await zoomAt((hb[0] + k0.target[0]) / 2, (hb[1] + k0.target[2]) / 2, 5);
    const k1 = await actor('kaze');
    const box = await boxAround([[k1.homeX, k1.homeZ, k1.homeY], [k1.target[0], k1.target[2], 0], [k1.target[0], k1.target[2], 1], [hb[0], hb[1], 0]], 45, 240, 170);
    let away = 0;
    for (let i = 0; i < 9; i++) {
      await step(0.11);
      await settle(30);
      const k = await actor('kaze');
      away = Math.max(away, Math.hypot(k.x - k.homeX, k.z - k.homeZ, k.y - k.homeY));
      await shot(`kaze-${i}`, box);
    }
    check(away > 0.3, `Kaze leaves her shoulder (${away.toFixed(2)} tiles out)`);
    for (let i = 0; i < 10 && (await actor('kaze'))?.mode !== 'home'; i++) await step(0.1);
    await step(0.05);
    const k2 = await actor('kaze');
    check(k2?.mode === 'home' && Math.hypot(k2.x - k2.homeX, k2.y - k2.homeY, k2.z - k2.homeZ) < 0.02, `Kaze is back on her shoulder (${k2?.mode})`);
    // battle only: Kaze is drawn 1.3x over Hana's scale (Kon rides Ruri's tower scale, the same as Hana's)
    const kon2 = await actor('kon');
    const ratio = k2?.scale && kon2?.scale ? k2.scale / kon2.scale : 0;
    // Kon is drawn 2.4x (owner: he was too tiny), Kaze 1.3x, both over the same tower scale: Kaze / Kon = 0.542
    check(k2?.battleScale === 1.3 && kon2?.battleScale === 2.4 && Math.abs(ratio - 1.3 / 2.4) < 0.02, `Kaze 1.3x and Kon 2.4x in battle (battleScale ${k2?.battleScale} / ${kon2?.battleScale}, ratio ${ratio.toFixed(3)})`);
    await page.evaluate(() => window.__battle.renderer.resetCamera());
    await step(0.05);
  }

  log('\n--- the doll dashes on Yoriko\'s needles ---');
  // park a sturdy slime on the road just upstream of her (as tests/sim/hero.test.js parks enemies), so her
  // needles fire at it; the sortie names the enemy it chases (targetUid), Dream Detour has none
  await pause(true);
  const parked = await page.evaluate((u) => {
    const { sim } = window.__battle;
    const t = sim.getTower(u);
    let best = null;
    sim.pathData.forEach((p, pi) => p.points.forEach((pt, i) => {
      const d = Math.hypot(pt[0] - t.x, pt[1] - t.y);
      if (!best || d < best.d) best = { d, pi, dist: p.cum[i] };
    }));
    if (!best) return null;
    const out = [];
    for (const back of [0.8, 0.3]) {
      const e = sim.spawnEnemy('slime_green', { pathIndex: best.pi, dist: Math.max(0, best.dist - back), hpMul: 60 });
      if (e) out.push(e.uid);
    }
    return { uids: out, road: +best.d.toFixed(2), range: +(t.eff?.range ?? t.range ?? 0).toFixed(2) };
  }, yoriko);
  check(parked?.uids?.length > 0, `enemies parked on the road by Yoriko (${JSON.stringify(parked)})`);
  await pause(false);
  const sortieRow = () => page.waitForFunction(() => {
    const a = window.__battle.renderer.companionsProbe().actors.find((x) => x.cid === 'doll');
    return a?.mode === 'sortie' ? a : null;
  }, null, { timeout: 30000, polling: 'raf' }).then((h) => h.jsonValue(), () => null);
  let row = await sortieRow();
  let dash = !!row;
  let how = row ? (row.targetUid != null ? 'needles' : 'Dream Detour') : 'none';
  check(dash && how === 'needles', `Yoriko attacks: the doll dashes on her needles (${how}${row?.targetUid != null ? `, enemy ${row.targetUid}` : ''})`);
  if (!dash) {
    // only after the needles check: Dream Detour, so the dash frames below still run
    await page.evaluate(() => {
      const { sim } = window.__battle;
      const h = sim.hero;
      sim.cash = 1e7;
      while (h.level < 3) if (!sim.buyHeroLevel({ level: h.level + 1, maxPrice: 1e9 })?.ok) break;
      h.ultUnlocked = true;
      h.ultCooldown = 0;
      return !!sim.activateUlt();
    });
    row = await sortieRow();
    dash = !!row;
    how = row ? 'Dream Detour' : 'none';
    log(`    fallback: ${how}`);
  }
  await pause(true);
  const d0 = await actor('doll');
  if (d0?.target) {
    const yb = await page.evaluate((u) => { const t = window.__battle.sim.getTower(u); return [t.x, t.y]; }, yoriko);
    await zoomAt(yb[0], yb[1], 6);
    const d1 = await actor('doll');
    const box = await boxAround([[yb[0], yb[1], 0], [yb[0], yb[1], 1.5], [d1.target[0], d1.target[2], 0.3]], 45, 240, 180);
    let away = 0;
    for (let i = 0; i < 7; i++) {
      await step(0.1);
      await settle(30);
      const d = await actor('doll');
      away = Math.max(away, Math.hypot(d.x - d.homeX, d.z - d.homeZ));
      await shot(`doll-${i}`, box);
    }
    check(away > 0.2, `the doll leaves its home spot (${away.toFixed(2)} tiles) and its threads stay tied to the bar`);
    for (let i = 0; i < 10 && (await actor('doll'))?.mode !== 'home'; i++) await step(0.1);
    check((await actor('doll'))?.mode === 'home', 'the doll swings home');
    await page.evaluate(() => window.__battle.renderer.resetCamera());
    await step(0.05);
  }

  log('\n--- removal and the lowest graphics setting ---');
  await page.evaluate((u) => window.__battle.ui.act.sell(u), hana);
  await step(0.05);
  const afterSell = await probe();
  check(!afterSell.actors.some((a) => a.cid === 'kaze'), `Kaze goes when Hana is sold (${afterSell.actors.map((a) => a.cid).join(',')})`);
  await page.evaluate(() => window.__battle.renderer.setQuality('low'));
  await step(0.05);
  const low = await probe();
  check(!low.enabled && low.actors.length === 0, 'quality low: no companion figures (Kon falls back to the procedural holo fox)');
  await page.evaluate(() => window.__battle.renderer.setQuality('high'));
  await step(0.05);
  await page.waitForFunction(() => window.__battle.renderer.companionsProbe().actors.length >= 2, null, { timeout: 30000 }).catch(() => null);
  await step(0.05);
  check((await probe()).actors.length === 2, 'back on quality high: Kon and the doll are recreated');
  await pause(false);

  await studentPages();

  check(errors.length === 0, `no console errors${errors.length ? `:\n    ${errors.slice(0, 8).join('\n    ')}` : ''}`);
} catch (e) {
  if (!(onlyStudents && e.message === 'students only')) failures.push(`crashed: ${e.stack || e}`);
  log(e);
} finally {
  await browser.close();
  await server.close();
}

log(failures.length ? `\n${failures.length} check(s) failed` : '\nall companion checks passed');
process.exit(failures.length ? 1 : 0);
