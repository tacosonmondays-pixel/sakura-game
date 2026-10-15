// Solo freeplay late-wave cost in Chromium (software WebGL here, so compare the numbers with each
// other, not with a phone): a fully built late board (the strong test save's eight girls and
// Hikari, ~40 placed and upgraded) on 8-5 Blossom jumped to waves 150, 200 (the Ashwing Matriarch)
// and 250 (the Eclipse Wyrm). For each wave: real frame time (rAF deltas, median / p95 / worst),
// the Sim's own step time per frame (sim.update wrapped), enemies alive, and a guard that no enemy
// ever has NaN / Infinity HP. There is no enemy cap (owner's choice): this measures, it does not cap.
//
//   node e2e/solo-freeplay-perf.mjs [--seconds 12] [--speed 3] [--waves 150,200,250]
import { createServer } from 'vite';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const SECONDS = Number(opt('seconds', 12));
const SPEED = Number(opt('speed', 3));
const WAVES = opt('waves', '10,150,200,250').split(',').map(Number);
const WARMUP = Number(opt('warmup', 25));
/** game seconds run before measuring (the frame loop of a software-GL page is too slow to fill the field) */
const PREFILL = Number(opt('prefill', 30));
const failures = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) failures.push(m); return c; };

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const save = await server.ssrLoadModule('/src/systems/save.js');
const { CAMPAIGN_IDS } = await server.ssrLoadModule('/src/data/stages.js');
const GIRLS = ['kage', 'shiro', 'aoi', 'akane', 'miko', 'momo', 'sango', 'yuki'];
const profile = save.createProfile();
for (const id of [...GIRLS, 'hikari']) profile.units[id] = { ...save.newUnitState(), level: 60, breakthrough: 5, awaken: 5 };
profile.formation = { ...(profile.formation || {}), towers: GIRLS, hero: 'hikari' };
for (const id of CAMPAIGN_IDS) profile.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
profile.settings = { ...profile.settings, autoStart: false, defaultSpeed: SPEED, quality: 'medium' };

const { browser, label } = await launchChromium();
console.log(`browser: ${label}`);
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await context.addInitScript(([key, text]) => localStorage.setItem(key, text), [save.SAVE_KEY, JSON.stringify(profile)]);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const rows = [];
try {
  for (const wave of WAVES) {
    await page.goto(`http://127.0.0.1:${port}/#/battle?stage=8-5&difficulty=normal&freeplay=blossom&w=${wave}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__battle?.ui?.act, null, { timeout: 120000 });
    const setup = await page.evaluate(([wave, speed]) => {
      const { sim, ui } = window.__battle;
      sim.cash = 1e15;
      const ids = [...sim.loadout.keys()];
      let n = 0;
      for (let y = 0.6; y < sim.map.height && n < 40; y += 0.7) {
        for (let x = 0.6; x < sim.map.width && n < 40; x += 0.7) {
          const near = sim.paths.some((p) => p.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 < 6));
          const id = n === 0 && sim.heroConfig && !sim.hero ? sim.heroConfig.unitId : ids[n % ids.length];
          if (near && sim.canPlace(id, x, y).ok && ui.act.place(id, x, y)) n++;
        }
      }
      for (const t of sim.towers) for (const p of [0, 0, 0, 0, 0, 2, 2]) ui.act.upgrade(t.uid, p);
      sim.lives = 1e12; // the whole wave walks, leaks and all
      sim.wave = wave - 1;
      sim.wavesCleared = wave - 1;
      sim.state = 'between';
      ui.speed = speed;
      // the Sim's own cost per frame
      const orig = sim.update.bind(sim);
      window.__simMs = [];
      sim.update = (dt) => {
        const t0 = performance.now();
        orig(dt);
        window.__simMs.push(performance.now() - t0);
      };
      return { towers: sim.towers.length, wave: sim.wave };
    }, [wave, SPEED]);
    // warm-up: software GL compiles every new girl's and enemy's shaders first (seconds each);
    // wait until frames flow, then start the wave and measure its spawn window
    await page.evaluate((secs) => new Promise((resolve) => {
      const end = performance.now() + secs * 1000;
      let last = performance.now();
      let calm = 0;
      const tick = (now) => {
        calm = now - last < 200 ? calm + 1 : 0;
        last = now;
        if (calm >= 20 || now > end) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), WARMUP);
    const pre = await page.evaluate((secs) => {
      const { sim, ui } = window.__battle;
      ui.startWave();
      const t0 = performance.now();
      let steps = 0;
      for (let t = 0; t < secs && sim.state === 'wave'; t += 1 / 60) {
        sim.update(1 / 60);
        steps++;
      }
      const ms = (performance.now() - t0) / Math.max(1, steps);
      window.__simMs = [];
      return { alive: sim.enemies.length, msPerStep: ms, steps };
    }, PREFILL);
    console.log(`  wave ${wave}: ${PREFILL} game seconds pre-run in the page: ${pre.steps} steps at ${pre.msPerStep.toFixed(2)} ms a 1/60 s step, ${pre.alive} enemies alive`);
    const r = await page.evaluate((seconds) => new Promise((resolve) => {
      const { sim } = window.__battle;
      const frames = [];
      let last = performance.now();
      let maxAlive = 0;
      let bad = null;
      const end = last + seconds * 1000;
      const tick = (now) => {
        frames.push(now - last);
        last = now;
        maxAlive = Math.max(maxAlive, sim.enemies.length);
        for (const e of sim.enemies) if (!Number.isFinite(e.hp) || !Number.isFinite(e.maxHp) || e.hp > e.maxHp * 1.0001) bad ||= { id: e.id, hp: e.hp, maxHp: e.maxHp };
        if (now < end) requestAnimationFrame(tick);
        else {
          const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] || 0; };
          resolve({
            frames: frames.length, medFrame: q(frames, 0.5), p95Frame: q(frames, 0.95), maxFrame: Math.max(...frames),
            medSim: q(window.__simMs, 0.5), p95Sim: q(window.__simMs, 0.95), maxSim: Math.max(0, ...window.__simMs),
            maxAlive, bad, state: sim.state, wave: sim.wave, simTime: sim.time,
          });
        }
      };
      requestAnimationFrame(tick);
    }), SECONDS);
    const row = { wave, towers: setup.towers, ...r };
    rows.push(row);
    console.log(`wave ${wave}: ${setup.towers} girls, ${r.maxAlive} enemies alive at most, frame median ${r.medFrame.toFixed(1)} ms / p95 ${r.p95Frame.toFixed(1)} / worst ${r.maxFrame.toFixed(0)}; sim per frame median ${r.medSim.toFixed(2)} ms / p95 ${r.p95Sim.toFixed(2)} / worst ${r.maxSim.toFixed(1)} (${r.frames} frames, ${SPEED}×)`);
    check(!r.bad, `wave ${wave}: no NaN / Infinity HP${r.bad ? ` (${JSON.stringify(r.bad)})` : ''}`);
    check(r.frames >= 5 && r.maxFrame < 5000, `wave ${wave}: the page keeps rendering (no hang: worst frame ${r.maxFrame.toFixed(0)} ms)`);
  }
} catch (e) {
  check(false, `crashed: ${e.stack || e.message}`);
} finally {
  check(!errors.length, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
}
console.log(JSON.stringify(rows));
process.exit(failures.length ? 1 : 0);
