// Attack FX end-to-end checks in Chromium (SwiftShader WebGL) on previews/attacks.html.
//
//   node e2e/attack-fx.mjs [--viewport 844x390|1280x720] [--shots <dir>] [--quick] [--matrix-every]
//
// Checks per viewport (both by default; 844×390 runs as a touch phone); 4 and 5 run on a tiny
// canvas and do not depend on the viewport, so they run once (first viewport) unless
// --matrix-every:
//   1. the co-op sim id is unchanged (renderer-only work never touches the lockstep code)
//   2. Chika truth at 1× and 3× (Chika rework M5): drones 1:1 with turrets, each drawn on its sim
//      drone (± 0.35 tiles of decoration), chasing the sim's quarry, blended bullets land exactly
//      on the sim path, and they really fly (the sim's drones leave her)
//   3. launch + sell: a new drone starts in LAUNCH at her backpack; selling removes them at once
//   4. every girl × every build (gallery) at high and low: no console errors, quads within the
//      budget, no extra draw calls vs FX off, no default pulse rings left for styled pulse girls
//   5. stress: 19 girls at max builds + 6 extra Chikas (39 drones) at 3×: attack-FX CPU time
//   6. screenshots (gallery, Chika focus, Akane / Hotaru on the phone)
// Exit code 1 on any failure.
import { createServer } from 'vite';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { launchChromium } from './browser.mjs';
import { simId } from '../tools/simId.mjs';

// The live game's co-op id: computed from the live branch (SIM_REF, default origin/main: every push to main deploys)
// when git has it, else this pin (v0.1.59's protocol 11). Renderer-only work must leave it unchanged.
const SIM_ID_PIN = '35748b1b58db';
const SIM_REF = process.env.SIM_REF || 'origin/main';
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];
const shots = opt('shots', null);
const quick = args.includes('--quick');
const matrixEvery = args.includes('--matrix-every');
let matrixDone = false;
if (shots) mkdirSync(shots, { recursive: true });

const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
  /Failed to load resource: the server responded with a status of 404/i,
  // lazy GLB loads still in flight when a check closes its page abort with "Failed to fetch"
  /\[models\] .* unavailable, using procedural fallback/i,
];
const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  if (cond) log(`  ok   ${msg}`);
  else {
    log(`  FAIL ${msg}`);
    failures.push(msg);
  }
  return cond;
}

/** The sim id of a git ref (its src/ extracted to a temp folder), or null when git lacks it. */
function refSimId(ref) {
  if (spawnSync('git', ['rev-parse', '--verify', '--quiet', ref]).status !== 0) return null;
  const dir = mkdtempSync(join(tmpdir(), 'simref-'));
  try {
    const tar = spawnSync('sh', ['-c', `git archive ${ref} src | tar -x -C "${dir}"`]);
    return tar.status === 0 ? simId(dir).id : null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// 1. sim id gate: same id as the live game
{
  const r = spawnSync(process.execPath, ['-e', "import('./tools/simId.mjs').then(m=>console.log(m.simId().id))"], { encoding: 'utf8' });
  const id = String(r.stdout).trim();
  const want = refSimId(SIM_REF) || SIM_ID_PIN;
  check(id === want, `co-op sim id unchanged (${id}, live ${want})`);
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1', hmr: false }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const { browser, label } = await launchChromium();
log(`browser: ${label}`);

async function open(ctxB, query, errors) {
  const page = await ctxB.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const t = m.text();
    if (!IGNORE.some((re) => re.test(t))) errors.push(`[${m.type()}] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/previews/attacks.html?${query}&manual=1`, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => document.body.dataset.ready === '1' || /Error/.test(document.getElementById('title').textContent), null, { timeout: 240000 });
  const title = await page.evaluate(() => document.getElementById('title').textContent);
  if (/Error/.test(title)) errors.push(`[preview] ${title}`);
  return page;
}

/** Runs n frames in the page, checking the drone truth rules on every frame. */
async function chikaTruth(page, n, speed) {
  return page.evaluate(([n, speed]) => {
    window.__setSpeed(speed);
    const out = { frames: 0, mismatch: 0, maxDecor: 0, wrongTarget: 0, engagedT: 0, maxOut: 0, overflow: 0, maxRes: 0, shots0: null, shots: 0, states: {} };
    const sim = window.__sim;
    for (let k = 0; k < n; k++) {
      window.__advance(1);
      const p = window.__fxProbe();
      out.frames++;
      if (p.drones.length !== p.turrets) out.mismatch++;
      for (const d of p.drones) {
        out.states[d.state] = (out.states[d.state] || 0) + 1;
        if (d.state !== 'LAUNCH') out.maxDecor = Math.max(out.maxDecor, d.decor);
        if (d.targetUid !== d.simTarget) out.wrongTarget++;
        if (d.state === 'HUNT') out.engagedT += (1 / 60) * speed;
        const t = sim.getTower(d.towerUid);
        if (t && d.simX != null) out.maxOut = Math.max(out.maxOut, Math.hypot(d.simX - t.x, d.simY - t.y));
      }
      if (out.shots0 == null) out.shots0 = p.stats.droneShots;
      out.shots = p.stats.droneShots - out.shots0;
      out.overflow = p.stats.dronesOverflow;
      out.maxRes = Math.max(out.maxRes, p.stats.maxBlendResidual);
    }
    out.turrets = sim.towers.reduce((s, t) => s + t.turrets.length, 0);
    return out;
  }, [n, speed]);
}

async function runViewport(vp) {
  const [w, h] = vp.split('x').map(Number);
  const touch = Math.min(w, h) < 600;
  log(`\n=== viewport ${vp}${touch ? ' (touch phone)' : ''} ===`);
  const ctxB = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  const errors = [];

  // 2 + 3. Chika truth, launch and sell
  {
    const page = await open(ctxB, 'mode=focus&unit=chika&build=5-2-0&quality=high&seed=3&speed=1&tiny=1', errors);
    for (const speed of [1, 3]) {
      const r = await chikaTruth(page, quick ? 150 : 360, speed);
      log(`  chika ${speed}×: ${r.turrets} drones, states ${JSON.stringify(r.states)}, ${r.shots} drone shots, hunting ${r.engagedT.toFixed(1)} drone-s, sim drones up to ${r.maxOut.toFixed(2)} tiles out`);
      check(r.turrets >= 9 && r.mismatch === 0, `chika ${speed}×: drones 1:1 with sim turrets every frame (${r.turrets})`);
      check(r.maxDecor <= 0.35 + 1e-6, `chika ${speed}×: drawn drones stay on their sim drones (max ${r.maxDecor.toFixed(3)} tiles of decoration)`);
      check(r.wrongTarget === 0, `chika ${speed}×: every drawn drone chases its sim drone's quarry`);
      check(r.maxRes < 1e-6, `chika ${speed}×: blended bullets sit exactly on the sim path from f′ 0.6 (residual ${r.maxRes})`);
      check(r.shots > 0 && r.engagedT > 0, `chika ${speed}×: the wing hunts and fires (${r.shots} shots)`);
      check(r.maxOut > 1.2, `chika ${speed}×: the sim's drones roam away from her and are drawn there (${r.maxOut.toFixed(2)} tiles)`);
      check(r.overflow === 0, `chika ${speed}×: no drone overflow`);
    }
    const launch = await page.evaluate(() => {
      window.__setSpeed(1);
      window.__setup('chika', 'base', 0);
      const sim = window.__sim;
      const t = sim.towers[0];
      for (let k = 0; k < 900; k++) {
        window.__advance(1);
        const p = window.__fxProbe();
        if (p.drones.length) {
          const d = p.drones[0];
          return { state: d.state, dist: Math.hypot(d.x - t.x, d.y - t.y), frames: k };
        }
      }
      return null;
    });
    check(!!launch && launch.state === 'LAUNCH' && launch.dist <= 0.6, `a new drone launches from her backpack (${JSON.stringify(launch)})`);
    const sold = await page.evaluate(() => {
      const sim = window.__sim;
      for (let k = 0; k < 300; k++) window.__advance(1);
      const before = window.__fxProbe().drones.length;
      for (const t of [...sim.towers]) sim.sellTower(t.uid);
      window.__advance(1);
      return { before, after: window.__fxProbe().drones.length };
    });
    check(sold.before > 0 && sold.after === 0, `selling removes her drones the next frame (${sold.before} → ${sold.after})`);
    await page.close();
  }

  // 4. every girl × every build, high and low (viewport independent: once unless --matrix-every)
  const matrix = matrixEvery || !matrixDone;
  matrixDone = true;
  for (const quality of !matrix ? [] : quick ? ['high'] : ['high', 'low']) {
    for (const build of quick ? ['max'] : ['base', 'p0', 'p1', 'p2']) {
      const page = await open(ctxB, `mode=gallery&build=${build}&quality=${quality}&seed=3&speed=2&preroll=15&tiny=1`, errors);
      // draw calls: the median over the last 60 frames (the same sim frames with FX on and off),
      // so a one-frame spike (a model finishing loading, an enemy entering) cannot decide it
      const r = await page.evaluate((n) => {
        let maxQuads = 0;
        let budget = 0;
        const calls = [];
        for (let k = 0; k < n; k++) {
          window.__advance(1);
          const a = window.__r.info.attackFx;
          maxQuads = Math.max(maxQuads, a.quads);
          budget = a.quadBudget;
          if (k >= n - 60) calls.push(window.__r.info.calls);
        }
        calls.sort((x, y) => x - y);
        const s = window.__r.info.attackFx;
        return { maxQuads, budget, calls: calls[calls.length >> 1], styled: s.styled, defaultPulses: s.defaultPulses, impacts: s.impacts, girls: window.__placed.length };
      }, quick ? 90 : 180);
      check(r.girls === 19 && r.styled >= 19, `${quality} ${build}: all 19 girls styled (${r.styled})`);
      // core truth cues (drones, shadows, reticles, tracers) are never shed; decor sheds at 60–95 %
      check(r.maxQuads <= r.budget + 150, `${quality} ${build}: attack-FX quads ${r.maxQuads} within budget ${r.budget} (+150 core)`);
      check(r.defaultPulses === 0, `${quality} ${build}: styled pulse girls replace the default pulse ring`);
      // (its numbers are read: close it before the FX-off twin opens — two WebGL galleries at once in a phone-sized
      // touch context never got the second one ready, on main too)
      await page.close();
      if (build === (quick ? 'max' : 'p0')) {
        const off = await open(ctxB, `mode=gallery&build=${build}&quality=${quality}&seed=3&speed=2&preroll=15&fx=off&tiny=1`, errors);
        const callsOff = await off.evaluate((n) => {
          const calls = [];
          for (let k = 0; k < n; k++) {
            window.__advance(1);
            if (k >= n - 60) calls.push(window.__r.info.calls);
          }
          calls.sort((x, y) => x - y);
          return calls[calls.length >> 1];
        }, quick ? 90 : 180);
        await off.close();
        check(r.calls <= callsOff + 1, `${quality} ${build}: draw calls with FX ${r.calls} ≤ without ${callsOff} + 1 (median of the last 60 frames)`);
      }
    }
  }

  // 5. stress: 19 maxed girls + 6 extra Chikas (≈ 40 drones) at 3×. One final tier per path per girl
  // type: the roster Chika holds 5-2-0 (9 drones) and every extra stops at 4-2-0 (5 drones), so the
  // scene needs six extras (two rows; previews/attacks.js EXTRA_SPOTS) for 9 + 6 × 5 = 39 drones.
  if (matrix) {
    const EXTRA = 6;
    const page = await open(ctxB, `mode=gallery&build=max&extra=${EXTRA}&quality=high&seed=3&speed=3&preroll=40&tiny=1`, errors);
    const r = await page.evaluate((n) => {
      const ms = [];
      let total = 0;
      let drones = 0;
      const r = window.__r;
      for (let k = 0; k < n; k++) {
        const t0 = performance.now();
        window.__advance(1);
        total += performance.now() - t0;
        const a = r.info.attackFx;
        ms.push(a.msFrame);
        drones = a.drones;
      }
      ms.sort((a, b) => a - b);
      const avg = ms.reduce((s, x) => s + x, 0) / ms.length;
      // what the sim built: live drones, and the most the Chikas' (path-capped) builds allow
      const chikas = window.__placed.filter((p) => p.id === 'chika');
      const turrets = window.__sim.towers.reduce((s, t) => s + (t.turrets?.length || 0), 0);
      const capacity = chikas.reduce((s, p) => s + (p.t.stats.turret?.max || 0), 0);
      return {
        avg, p95: ms[Math.floor(ms.length * 0.95)], frame: total / n, drones, turrets, capacity, projectiles: window.__sim.projectiles.length,
        chikas: chikas.map((p) => p.t.tiers.join('-')).join(' '),
      };
    }, quick ? 120 : 300);
    const share = r.avg / Math.max(1e-6, r.frame);
    log(`  stress: ${r.drones} drones (Chikas ${r.chikas}), ${r.projectiles} projectiles, attack FX ${r.avg.toFixed(3)} ms avg / ${r.p95.toFixed(3)} ms p95 of a ${r.frame.toFixed(2)} ms sim+render frame (${(share * 100).toFixed(1)} %)`);
    check(r.chikas.split(' ').length === 1 + EXTRA, `stress: roster Chika + ${EXTRA} extras placed (${r.chikas})`);
    check(r.drones === r.turrets && r.turrets === r.capacity, `stress: drones drawn ${r.drones} = sim drones ${r.turrets} = the builds' ${r.capacity}`);
    // the load the CPU budget below was set on: 36 drones (9 + 3 extras × 9 before the path cap)
    check(r.drones >= 36, `stress: ${r.drones} drones in flight (≥ 36)`);
    // absolute budget on an idle machine; on a shared / throttled one the share of the frame is what counts
    check(r.avg <= 1.5 || share <= 0.2, `stress: attack-FX CPU ${r.avg.toFixed(3)} ms avg ≤ 1.5 ms (headless) or ≤ 20 % of the frame (${(share * 100).toFixed(1)} %)`);
    await page.close();
  }

  // 6. screenshots (full-size canvas): gallery, Chika like the owner's screenshot, a few focus girls
  if (shots) {
    const g = await open(ctxB, 'mode=gallery&build=max&quality=high&seed=3&speed=1&preroll=30', errors);
    await g.evaluate(() => window.__advance(12, 0.05));
    await g.screenshot({ path: join(shots, `gallery-max-${vp}.png`), timeout: 300000 });
    await g.close();
    const page = await open(ctxB, 'mode=focus&unit=chika&build=5-2-0&quality=high&seed=3&speed=1', errors);
    const list = touch ? [['chika', '5-2-0'], ['chika', '0-0-0'], ['akane', '5-2-0'], ['hotaru', '5-2-0']] : [['chika', '5-2-0'], ['chika', '0-0-0'], ['hikari', '2-0-5'], ['raika', '2-0-5']];
    for (const [u, b] of list) {
      await page.evaluate(([u, b]) => window.__setup(u, b, 30), [u, b]);
      await page.evaluate(() => window.__advance(12, 0.05));
      await page.screenshot({ path: join(shots, `focus-${u}-${b}-${vp}.png`), timeout: 300000 });
    }
    await page.close();
  }

  check(errors.length === 0, `no console errors or warnings${errors.length ? `:\n    ${errors.slice(0, 8).join('\n    ')}` : ''}`);
  await ctxB.close();
}

try {
  for (const vp of viewports) await runViewport(vp);
} finally {
  await browser.close();
  await server.close();
}
log(failures.length ? `\n${failures.length} check(s) FAILED` : '\nall attack-FX checks passed');
process.exit(failures.length ? 1 : 0);
