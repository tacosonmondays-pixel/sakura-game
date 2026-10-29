// Kohaku's constant beam in the real game (src/sim/duo.js, src/render/attackFx/styles/kohaku_tsubaki.js): the duo on
// stage 1-1, enemies parked in her reach through the battle's dev hooks (window.__battle), and the attack-FX probe read
// on consecutive animation frames.
//   1. Prism Corridor 2 (one beam), one parked enemy: the beam is drawn, fully on and on that enemy, on every one of
//      30 consecutive frames while it lives; the sim holds the same enemy all along; it is gone soon after it dies.
//   2. Grand Spectrum (Prism Corridor 5, four beams), three parked enemies: three beams on three different enemies on
//      every one of 30 consecutive frames.
//
//   node e2e/duo-beam.mjs                                  # 844x390 and 1280x720
//   node e2e/duo-beam.mjs --viewport 1280x720 --shots /tmp/beam   # one size + screenshots (one beam, three beams:
//                                                                 # the board and three close crops 0.3 s apart)
// Exit code 1 if any check fails. Starts its own Vite dev server on a free port.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? opt('viewport').split(',') : ['844x390', '1280x720'];
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const ID = 'kohaku_tsubaki';

const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}
const IGNORE = [/GPU stall/i, /WebGL/i, /favicon/i, /GroupMarkerNotSet/i, /Failed to load resource: net::ERR_(CERT|NAME|INTERNET|PROXY|TUNNEL|CONNECTION)/i];

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/?onboarding=0`;
const save = await server.ssrLoadModule('/src/systems/save.js');
const profile = save.createProfile();
profile.units[ID] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
profile.formation = { ...(profile.formation || {}), towers: [ID, 'aoi'], hero: 'hikari' };
profile.progress.stages['1-1'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
profile.settings = { ...profile.settings, autoStart: false, quality: 'high' };
const saveText = JSON.stringify(profile);
const { browser } = await launchChromium();

/** Frames of the probe: `n` consecutive animation frames, each the beams drawn and the sim's holds. */
function frames(page, n) {
  return page.evaluate((count) => new Promise((resolve) => {
    const { sim, renderer } = window.__battle;
    const t = sim.towers.find((x) => x.unitId === 'kohaku_tsubaki');
    const out = [];
    const step = () => {
      const p = renderer.attackFxProbe();
      const drawn = p?.styles?.[t.uid]?.beams || [];
      out.push({
        drawn: drawn.map((b) => ({ uid: b.uid, a: b.a })),
        held: (t.prismBeams || []).filter((b) => b.e && !b.e.dead).map((b) => b.e.uid),
        simTime: sim.time,
      });
      if (out.length >= count) resolve(out);
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), n);
}

/** Parks `n` sturdy enemies on the road in her reach, spaced apart; returns their uids. */
function park(page, n) {
  return page.evaluate(async (count) => {
    const { pointAt } = await import('/src/sim/path.js');
    const { sim } = window.__battle;
    const t = sim.towers.find((x) => x.unitId === 'kohaku_tsubaki');
    for (const e of sim.enemies) e.dead = true;
    const spots = [];
    for (const path of sim.pathData) {
      for (let d = 0; d <= path.length; d += 0.1) {
        const p = pointAt(path, d, {});
        const r = Math.hypot(p.x - t.x, p.y - t.y);
        if (r > 1.0 && r < t.beamSpec.range - 0.6) spots.push({ pathIndex: path.index ?? sim.pathData.indexOf(path), d, x: p.x, y: p.y, r });
      }
    }
    // (well inside her reach but not under her feet: the beams read on the board)
    const want = t.beamSpec.range * 0.65;
    spots.sort((a, b) => Math.abs(a.r - want) - Math.abs(b.r - want));
    const pick = [];
    for (const s of spots) {
      if (pick.length >= count) break;
      if (pick.every((q) => Math.hypot(q.x - s.x, q.y - s.y) > 1.3)) pick.push(s);
    }
    return pick.map((s) => {
      const e = sim.spawnEnemy('orc_ironhide', { pathIndex: s.pathIndex, dist: s.d, hpMul: 5000 });
      e.baseSpeed = 0;
      return e.uid;
    });
  }, n);
}

/** Screenshots: the whole board, then three close crops around the duo 0.3 s apart (the beam stays on). */
async function shots(page, uid, name, vp) {
  if (!shotsDir) return;
  await page.screenshot({ path: `${shotsDir}/beam-${name}-${vp}.png`, timeout: 120000 });
  const [w, h] = vp.split('x').map(Number);
  const cw = Math.round(w * 0.36);
  const ch = Math.round(h * 0.42);
  for (let k = 0; k < 3; k++) {
    const s = await page.evaluate((u) => {
      const t = window.__battle.sim.getTower(u);
      return window.__battle.renderer.worldToScreen(t.x, t.y + 0.6, 0.4);
    }, uid);
    const clip = { x: Math.max(0, Math.min(w - cw, Math.round(s.clientX - cw / 2))), y: Math.max(0, Math.min(h - ch, Math.round(s.clientY - ch / 2))), width: cw, height: ch };
    await page.screenshot({ path: `${shotsDir}/beam-${name}-${vp}-close${k}.png`, clip, timeout: 120000 });
    await page.waitForTimeout(300);
  }
}

const settle = (page, ms = 250) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);

for (const vp of viewports) {
  const [w, h] = vp.split('x').map(Number);
  log(`\n== ${vp}`);
  const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1000, isMobile: false });
  await context.addInitScript(([key, text]) => {
    if (!sessionStorage.getItem('beam-seeded')) {
      localStorage.setItem(key, text);
      sessionStorage.setItem('beam-seeded', '1');
    }
  }, [save.SAVE_KEY, saveText]);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  try {
    // (a cold dev server can fail the first dynamic import while it optimises dependencies: one reload)
    for (let attempt = 0; ; attempt++) {
      await page.goto(base, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 90000 });
      await page.evaluate(() => {
        window.__sakura.store.profile.battleSaves = {};
        location.hash = '#/battle?stage=1-1&difficulty=normal';
      });
      const up = await page.waitForFunction(() => window.__battle?.ui?.act, null, { timeout: 60000 }).then(() => true, () => false);
      if (up) break;
      if (attempt >= 1) throw new Error('the battle never opened');
      errors.length = 0;
    }
    await settle(page, 800);
    // the duo beside the road, on screen, away from the bar
    const placed = await page.evaluate((id) => {
      const { sim, ui, renderer } = window.__battle;
      sim.cash = 1e7;
      const barTop = ui.bar?.el?.getBoundingClientRect().top ?? innerHeight;
      for (let y = 0.6; y < sim.map.height; y += 0.3) {
        for (let x = 0.6; x < sim.map.width; x += 0.3) {
          if (!sim.canPlace(id, x, y).ok || sim.placement.pathDistance(x, y) > 1.2) continue;
          const s = renderer.worldToScreen(x, y, 0);
          if (!s.visible || s.clientY > barTop - 90 || s.clientY < innerHeight * 0.3 || s.clientX < innerWidth * 0.25 || s.clientX > innerWidth * 0.75) continue;
          const t = ui.act.place(id, x, y);
          if (t) return { uid: t.uid, x, y };
        }
      }
      return null;
    }, ID);
    if (!check(!!placed, `the duo is placed (${JSON.stringify(placed)})`)) continue;
    // Prism Corridor 2: one beam; a wave running with its own spawns held back
    await page.evaluate((uid) => {
      const { sim } = window.__battle;
      for (let k = 0; k < 2; k++) sim.upgradeTower(uid, 1);
      sim.startNextWave();
      sim._spawnQueue = [{ t: 1e9, enemyId: 'slime_green' }];
      sim._spawnIndex = 0;
    }, placed.uid);
    await settle(page, 2500); // the figures load
    // (the hero's free deploy prompt opens on its own: closed, so the board is clear)
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /cancel/i.test(x.textContent || '') && x.offsetParent);
      b?.click();
    });
    const [one] = await park(page, 1);
    await settle(page, 1200);
    const fa = await frames(page, 30);
    check(fa.every((f) => f.held.length === 1 && f.held[0] === one), 'one beam: the sim holds the parked enemy on all 30 frames');
    check(fa.every((f) => f.drawn.length === 1 && f.drawn[0].uid === one && f.drawn[0].a === 1), `one beam: drawn, fully on and on that enemy on all 30 consecutive frames (${JSON.stringify(fa.map((f) => f.drawn.length).join(''))})`);
    check(fa.at(-1).simTime > fa[0].simTime, 'the battle runs while it is drawn');
    await shots(page, placed.uid, 'one', vp);
    // the enemy dies: the beam ends soon after
    await page.evaluate((uid) => {
      const e = window.__battle.sim.enemies.find((x) => x.uid === uid);
      if (e) e.hp = 0.001;
    }, one);
    await settle(page, 700);
    const fd = await frames(page, 5);
    check(fd.every((f) => f.drawn.length === 0 && f.held.length === 0), 'the beam is gone once its enemy died');
    // Grand Spectrum: four beams, three enemies → three beams on three enemies
    const tiers = await page.evaluate((uid) => {
      const { sim } = window.__battle;
      for (let k = 0; k < 3; k++) sim.upgradeTower(uid, 1);
      for (let k = 0; k < 2; k++) sim.upgradeTower(uid, 2);
      const t = sim.getTower(uid);
      return { tiers: t.tiers.join('-'), beams: t.beamSpec.projectiles };
    }, placed.uid);
    check(tiers.tiers === '0-5-2' && tiers.beams === 4, `Grand Spectrum bought (${JSON.stringify(tiers)})`);
    const three = await park(page, 3);
    check(three.length === 3, `three enemies parked in her reach (${three.length})`);
    await settle(page, 1200);
    const fb = await frames(page, 30);
    const ok3 = fb.every((f) => f.drawn.length === 3 && f.drawn.every((b) => b.a === 1) && new Set(f.drawn.map((b) => b.uid)).size === 3 && f.drawn.every((b) => three.includes(b.uid)));
    check(ok3, `three beams: three different enemies, fully on, on all 30 consecutive frames (${fb.map((f) => f.drawn.length).join('')})`);
    check(fb.every((f) => f.held.length === 3), 'the sim holds the same three enemies');
    await shots(page, placed.uid, 'three', vp);
    check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  } catch (err) {
    check(false, `${vp}: ${err.message}`);
  } finally {
    await context.close();
  }
}

await browser.close();
await server.close();
log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
