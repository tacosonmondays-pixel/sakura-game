// VFX baseline capture (docs/VFX.md): stages the same busy Sandbox battle every time — eight girls
// at tier 3–5 plus a levelled hero, ~40 tough enemies (40× HP) spread along the road, an elite and a boss — and
// saves screenshots at 844×390 (landscape phone, touch) and 1280×720 (PC) on high, medium and low,
// plus a frame-time measurement (median and p95 over ~10 s of real-time play).
//
//   node tools/vfx/capture.mjs                                   # everything → e2e/out/vfx/<label>/
//   node tools/vfx/capture.mjs --out <dir> --label baseline      # where, and what to call the run
//   node tools/vfx/capture.mjs --viewports 844x390 --qualities high --seconds 5
//   node tools/vfx/capture.mjs --reduce-motion                   # Settings → Reduce motion on
//   node tools/vfx/capture.mjs --repeat                          # also stage the first config twice
//                                                                #   and check the pictures match
//   node tools/vfx/capture.mjs --events ult@150,bosskill@210     # big moments, shot as they land
//   options: --map <id> (default sakura_court) --frames 120,180 (moments shot, in 60 fps frames)
//            --events <kind>@<frame>,… (ult: the hero's ultimate fires; bosskill: the boss falls) —
//            each one is shot on the frame it lands and --event-shots frames after (default 0,2,6,16)
//            --dpr-phone 3 --dpr-desktop 1 --skip-perf --prod (test dist/; run `npm run build` first)
//            --repeat-config 1280x720:high (which config --repeat stages again; default the first)
//            --resume (keep the configs an earlier run into the same --out finished; redo the rest)
//
// How the screenshots stay comparable: the page's animation frames are held (requestAnimationFrame
// and performance.now are replaced by a stepped clock) from before the battle mounts, the sim's
// random stream is reset to a fixed seed before anything happens, and every frame then advances
// exactly 1/60 s. The renderer's own randomness is seeded from the map (src/render/vfx/random.js)
// and all its animation runs on its one visual clock (src/render/vfx/clock.js), so the same build
// gives the same picture; a change in the picture is a change in the look. Toasts (real-time UI)
// are hidden in the shots.
//
// The frame-time numbers come from headless Chromium drawing WebGL on the CPU (SwiftShader): they
// compare builds on this machine and say nothing absolute about a phone. "frame" is the time
// between two animation frames; "cpu" is the time spent inside the frame callbacks.
//
// Playwright: PLAYWRIGHT_MODULE, NODE_PATH or the global install; the browser: CHROME_PATH, else
// /opt/pw-browsers/chromium when present, else Playwright's own (see e2e/browser.mjs).
import { createServer, preview } from 'vite';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadavg, cpus } from 'node:os';
import { GL_ARGS, loadPlaywright } from '../../e2e/browser.mjs';
import { simId } from '../simId.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] != null && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

const LABEL = opt('label', 'capture');
const OUT = resolve(opt('out', join('e2e', 'out', 'vfx', LABEL)));
const VIEWPORTS = opt('viewports', '844x390,1280x720').split(',').filter(Boolean);
const QUALITIES = opt('qualities', 'high,medium,low').split(',').filter(Boolean);
const MAP_ID = opt('map', 'sakura_court');
const MOMENTS = opt('frames', '120,180').split(',').map(Number).filter((n) => n > 0).sort((a, b) => a - b);
// big moments: [kind, frame it lands on] — ult (the hero's ultimate) or bosskill (the boss falls)
const EVENTS = opt('events', '').split(',').filter(Boolean).map((e) => {
  const [kind, at] = e.split('@');
  return { kind, at: Number(at) };
}).filter((e) => (e.kind === 'ult' || e.kind === 'bosskill') && e.at > 1).sort((a, b) => a.at - b.at);
const EVENT_SHOTS = opt('event-shots', '0,2,6,16').split(',').map(Number).filter((n) => n >= 0);
/** Every frame shot: [frame, label] (label = the event it shows, or ''). */
const SHOTS = [...MOMENTS.map((f) => [f, '']), ...EVENTS.flatMap((e) => EVENT_SHOTS.map((o) => [e.at + o, e.kind]))]
  .sort((a, b) => a[0] - b[0]).filter((x, i, a) => i === 0 || x[0] !== a[i - 1][0] || x[1] !== a[i - 1][1]);
const PERF_SECONDS = Number(opt('seconds', '10'));
const DPR_PHONE = Number(opt('dpr-phone', '3'));
const DPR_DESKTOP = Number(opt('dpr-desktop', '1'));
const REDUCE_MOTION = flag('reduce-motion');
const REPEAT = flag('repeat');
// the config the repeat stages again (default: the first one), e.g. --repeat-config 1280x720:high
const REPEAT_CONFIG = opt('repeat-config', null);
// keep the finished configs of an earlier run of the same --out (a stopped or crashed run)
const RESUME = flag('resume');
const SKIP_PERF = flag('skip-perf');
const PROD = flag('prod');
const T = 240000;
const SHOT_T = 180000;
const VERBOSE = flag('verbose');
const say = (...a) => {
  if (VERBOSE) console.log('   ·', ...a);
};

/** The staged battle: same map, squad, builds, enemies and seeds every run. */
const SCENE = {
  map: MAP_ID,
  difficulty: 'normal',
  simSeed: 20261020,
  hero: 'hikari',
  heroLevel: 20,
  // [unit, [path A, path B, path C] tiers, where along the road (0..1)]
  squad: [
    ['akane', [5, 2, 0], 0.1],
    ['raika', [2, 0, 5], 0.16],
    ['kaede', [0, 5, 2], 0.22],
    ['chika', [5, 0, 2], 0.28],
    ['hotaru', [3, 2, 0], 0.34],
    ['yuki', [0, 4, 2], 0.4],
    ['rei', [4, 0, 2], 0.46],
    ['aoi', [2, 3, 0], 0.52],
  ],
  // [enemy, count, hp ×, spread along the road from .. to (0..1)]
  enemies: [
    ['goblin_runner', 10, 40, 0.0, 0.62],
    ['slime_green', 8, 40, 0.04, 0.58],
    ['orc_grunt', 8, 40, 0.08, 0.66],
    ['oni_brute', 4, 40, 0.12, 0.5],
    ['ghost_wisp', 4, 40, 0.06, 0.46],
    ['goblin_glider', 4, 40, 0.1, 0.55],
    ['orc_warlord', 1, 20, 0.36, 0.36],
    ['dragon_ashwing', 1, 3, 0.28, 0.28],
  ],
};

const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i,
  /favicon\.ico/i, /Failed to load resource: net::ERR_/i, /\[models\] .* unavailable, using procedural fallback/i,
];

// ---- the page's stepped clock (installed before any page script runs) ----------------------------
function timeControl() {
  const realRAF = window.requestAnimationFrame.bind(window);
  const realCancel = window.cancelAnimationFrame.bind(window);
  const realNow = performance.now.bind(performance);
  const V0 = 1e6; // the held clock always starts here: the same frame times every run
  // pass: while a screenshot is taken, new requests (Playwright's own) go to the real frames; the
  // battle's next frame, requested earlier, stays held
  const cap = { held: false, pass: false, vnow: V0, queue: new Map(), nextId: 1 << 30, frames: 0, measuring: false, samples: [] };
  performance.now = () => (cap.held ? cap.vnow : realNow());
  window.requestAnimationFrame = (cb) => {
    if (cap.held && !cap.pass) {
      const id = cap.nextId++;
      cap.queue.set(id, cb);
      return id;
    }
    return realRAF((ts) => {
      if (!cap.measuring) return cb(ts);
      const t0 = realNow();
      try {
        cb(ts);
      } finally {
        cap.samples.push([ts, realNow() - t0]);
      }
    });
  };
  window.cancelAnimationFrame = (id) => {
    if (cap.queue.has(id)) cap.queue.delete(id);
    else realCancel(id);
  };
  cap.hold = () => {
    cap.vnow = V0;
    cap.held = true;
  };
  /**
   * Runs n held frames, dtMs apart, each one finished on the GPU (gl.finish) before the next, so
   * no backlog builds up. @returns {number[]} real ms each frame took (CPU + GPU)
   */
  cap.step = (n = 1, dtMs = 1000 / 60) => {
    const out = [];
    const canvas = window.__battle?.renderer?.canvas;
    const gl = canvas ? canvas.getContext('webgl2') || canvas.getContext('webgl') : null;
    for (let i = 0; i < n; i++) {
      const t0 = realNow();
      cap.vnow += dtMs;
      const q = [...cap.queue.values()];
      cap.queue.clear();
      for (const cb of q) {
        try {
          cb(cap.vnow);
        } catch (e) {
          console.error('[capture] frame error', e);
        }
      }
      gl?.finish();
      cap.frames++;
      out.push(realNow() - t0);
    }
    return out;
  };
  /** Back to real time: queued callbacks go to the real requestAnimationFrame. */
  cap.release = () => {
    cap.held = false;
    const q = [...cap.queue.values()];
    cap.queue.clear();
    for (const cb of q) window.requestAnimationFrame(cb);
  };
  window.__vfxCap = cap;
}

// ---- the staged battle (runs in the page, battle mounted, no frame run yet) --------------------
async function stageBattle(scene) {
  const { sim, ui } = window.__battle;
  const out = { warnings: [] };
  ui.tutorial = true; // keeps the "deploy your hero" prompt from arming a placement mid-stage
  sim.rng.setState(scene.simSeed); // the sim's random stream: the same from here on, every run
  const { ensureWave } = await import('/src/ui/battle/sandboxPanel.js');
  const { ENEMY_MAP } = await import('/src/data/enemies.js');

  // the road: points + cumulative length per path
  const roads = (sim.paths || []).map((pts) => {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, len: cum[cum.length - 1] };
  });
  const at = (road, f) => {
    const d = Math.max(0, Math.min(1, f)) * road.len;
    let i = 1;
    while (i < road.cum.length - 1 && road.cum[i] < d) i++;
    const k = (d - road.cum[i - 1]) / Math.max(1e-9, road.cum[i] - road.cum[i - 1]);
    const a = road.pts[i - 1];
    const b = road.pts[i];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };

  /** The free spot nearest a road point (a 0.25-tile lattice, nearest first). */
  const spotNear = (id, p) => {
    let best = null;
    for (let y = 0.25; y < sim.map.height; y += 0.25) {
      for (let x = 0.25; x < sim.map.width; x += 0.25) {
        const d = Math.hypot(x - p[0], y - p[1]);
        if (d < 0.9 || (best && d >= best.d)) continue;
        if (sim.canPlace(id, x + 1e-4, y + 1e-4).ok) best = { x: x + 1e-4, y: y + 1e-4, d };
      }
    }
    return best;
  };

  const placed = [];
  const place = (id, f, roadIdx = 0) => {
    const road = roads[roadIdx % roads.length];
    const spot = spotNear(id, at(road, f));
    if (!spot) {
      out.warnings.push(`no spot for ${id}`);
      return null;
    }
    const t = ui.act.place(id, spot.x, spot.y);
    if (!t) out.warnings.push(`could not place ${id}`);
    else ui.onPlaced?.(t);
    return t;
  };

  // the hero first (before the battle's own "deploy your hero" prompt)
  if (scene.hero && sim.heroConfig?.unitId === scene.hero) {
    const h = place(scene.hero, 0.31, 0);
    if (h) {
      for (let k = 0; k < 40 && (sim.hero?.level ?? 99) < scene.heroLevel; k++) if (!sim.buyHeroLevel?.()?.ok) break;
      placed.push({ id: scene.hero, uid: h.uid, level: sim.hero?.level ?? null });
    }
  }
  scene.squad.forEach(([id, tiers, f], i) => {
    const t = place(id, f, i % 2);
    if (!t) return;
    const order = [0, 1, 2].sort((p, q) => tiers[q] - tiers[p]);
    for (const p of order) for (let k = 0; k < tiers[p]; k++) if (!ui.act.upgrade(t.uid, p)) out.warnings.push(`${id}: path ${p} tier ${k + 1} refused`);
    placed.push({ id, uid: t.uid, tiers: [...(sim.getTower(t.uid)?.tiers || [])] });
  });

  // GLB enemy families on the board must be loaded before the first frame (no late swap-in)
  const fams = [...new Set(scene.enemies.map(([id]) => ENEMY_MAP[id]?.model?.base || ENEMY_MAP[id]?.family).filter(Boolean))];
  await ui.preloadEnemies?.(fams);

  ensureWave(sim);
  let n = 0;
  for (const [id, count, hpMul, f0, f1] of scene.enemies) {
    for (let k = 0; k < count; k++) {
      const roadIdx = (n++) % roads.length;
      const road = roads[roadIdx];
      const f = count > 1 ? f0 + ((f1 - f0) * k) / (count - 1) : f0;
      const e = sim.spawnEnemy(id, { pathIndex: roadIdx, dist: f * road.len, hpMul });
      if (!e) out.warnings.push(`spawn ${id} failed`);
    }
  }
  // the sandbox panel stays folded so the board shows (it opens by default on PC)
  if (ui.sandbox?.open) document.querySelector('[data-testid="sandbox-toggle"]')?.click();
  out.placed = placed;
  out.enemies = sim.enemies.length;
  out.paths = roads.length;
  out.placing = ui.placement?.unitId ?? null;
  return out;
}

// ---- runner --------------------------------------------------------------------------------
const percentile = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
};
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

async function launch() {
  const pw = await loadPlaywright().catch(() => createRequire('/opt/node22/lib/node_modules/playwright/')('playwright'));
  const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  const browser = await pw.chromium.launch({ args: GL_ARGS, ...(exe ? { executablePath: exe } : {}) });
  return { browser, label: `${exe ? 'Chromium' : 'Playwright Chromium'} ${browser.version()}` };
}

async function captureOne(browser, base, { vp, quality, tag, perf }) {
  const [w, h] = vp.split('x').map(Number);
  const touch = Math.min(w, h) < 600;
  const dpr = touch ? DPR_PHONE : DPR_DESKTOP;
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  await context.addInitScript(timeControl);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !IGNORE.some((re) => re.test(m.text()))) errors.push(`[${m.type()}] ${m.text()}`);
  });
  const result = { viewport: vp, dpr, touch, quality, reduceMotion: REDUCE_MOTION, shots: [], errors };
  try {
    // a fresh save with Sandbox open (7 clears), this quality, the default locked camera
    say(tag, 'lobby');
    await page.goto(`${base}#/lobby`, { waitUntil: 'load', timeout: T });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${base}#/lobby`, { waitUntil: 'load', timeout: T });
    const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 30000 }).catch(() => null);
    if (later) await later.click({ force: true }).catch(() => {});
    await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: T, polling: 100 });
    await page.evaluate(async ({ quality, reduceMotion }) => {
      const { store } = window.__sakura;
      const { CAMPAIGN_IDS } = await import('/src/data/stages.js');
      for (const id of CAMPAIGN_IDS.slice(0, 7)) store.profile.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
      Object.assign(store.profile.settings, { quality, reduceMotion, camera: 'locked' });
      store.commit('replace');
      store.saveNow?.();
      localStorage.setItem('sakura.tip.tree.v1', '1'); // the one-time "hold a girl" tip stays away
      document.querySelectorAll('.modal-overlay').forEach((m) => m.remove());
    }, { quality, reduceMotion: REDUCE_MOTION });

    // hold the frames, then mount the battle: its first frame is a stepped one
    say(tag, 'profile ready; mounting the battle (frames held)');
    await page.evaluate(() => window.__vfxCap.hold());
    await page.evaluate(async (scene) => {
      const { navigate } = await import('/src/ui/router.js');
      const { sandboxBattleParams } = await import('/src/systems/sandbox.js');
      navigate('battle', sandboxBattleParams({ mapId: scene.map, difficulty: scene.difficulty, towers: scene.squad.map((s) => s[0]), hero: scene.hero }));
    }, SCENE);
    await page.waitForFunction(() => window.__battle?.ui?.placement && window.__battle.renderer, null, { timeout: T, polling: 50 });
    const pre = await page.evaluate(() => window.__vfxCap.frames);
    say(tag, 'battle mounted; staging');
    if (pre) result.warnings = [`${pre} frame(s) ran before staging`];
    const staged = await page.evaluate(stageBattle, SCENE);
    result.scene = { map: SCENE.map, stage: await page.evaluate(() => window.__battle.sim.stageId), ...staged };
    // let any model fetch the staging started finish before the first frame (no late swap-ins)
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      window.__battle.ui.tutorial = false;
    });
    // toasts run on real time: keep them out of the pictures
    await page.addStyleTag({ content: '[data-testid="battle-feed"], .bt-feed, .toast { visibility: hidden !important; }' });

    say(tag, 'staged', JSON.stringify({ enemies: staged.enemies, warnings: staged.warnings, placing: staged.placing }));
    let done = 0;
    const stepMs = [];
    const stepLoad0 = loadavg()[0];
    // stops: every shot, and the frame before each event (the event is set off there, so the
    // frame it lands on is the next one stepped)
    const stops = [...new Set([...SHOTS.map((x) => x[0]), ...EVENTS.map((e) => e.at - 1)])].sort((a, b) => a - b);
    result.events = [];
    for (const stop of stops) {
      while (done < stop) {
        const n = Math.min(30, stop - done);
        stepMs.push(...(await page.evaluate((k) => window.__vfxCap.step(k), n)));
        done += n;
      }
      for (const ev of EVENTS.filter((e) => e.at - 1 === stop)) {
        const r = await page.evaluate((kind) => {
          const { sim } = window.__battle;
          if (kind === 'ult') {
            const h = sim.hero;
            if (!h) return { ok: false, why: 'no hero' };
            h.ultUnlocked = true;
            h.ultCooldown = 0;
            return { ok: !!sim.activateUlt(), effect: h.def?.hero?.ult?.name ?? null };
          }
          const boss = sim.enemies.find((e) => !e.dead && e.tier === 'boss');
          if (!boss) return { ok: false, why: 'no boss' };
          sim._killEnemy(boss, null);
          return { ok: true, id: boss.id };
        }, ev.kind);
        result.events.push({ ...ev, ...r });
        say(tag, `event ${ev.kind} @${ev.at}: ${JSON.stringify(r)}`);
      }
      for (const [moment, label] of SHOTS.filter((x) => x[0] === stop)) {
        say(tag, `frame ${done} (stepped ${r1(percentile(stepMs, 50))} ms median)`);
        const name = label ? `${tag}-${label}-f${moment}` : `${tag}-f${moment}`;
        await page.evaluate(() => {
          window.__vfxCap.pass = true;
        });
        const full = await page.screenshot({ path: join(OUT, `${name}.png`), scale: 'css', animations: 'disabled', timeout: SHOT_T });
        const canvas = await page.locator('canvas').first().screenshot({ path: join(OUT, `${name}-canvas.png`), timeout: SHOT_T });
        const shot = { frame: moment, event: label || null, file: `${name}.png`, sha: sha(full), canvasFile: `${name}-canvas.png`, canvasSha: sha(canvas) };
        if (dpr > 1) {
          await page.screenshot({ path: join(OUT, `${name}-dpr${dpr}.png`), scale: 'device', animations: 'disabled', timeout: SHOT_T });
          shot.deviceFile = `${name}-dpr${dpr}.png`;
        }
        await page.evaluate(() => {
          window.__vfxCap.pass = false;
        });
        shot.state = await page.evaluate(() => {
          const { sim, renderer } = window.__battle;
          const fx = renderer.info.attackFx || {};
          return {
            simTime: Math.round(sim.time * 1000) / 1000, enemies: sim.enemies.length, towers: sim.towers.length, projectiles: sim.projectiles.length,
            calls: renderer.info.calls, triangles: renderer.info.triangles, fxQuads: fx.quads, fxQuadBudget: fx.quadBudget, fxShed: fx.shed, fxHalos: fx.halos ?? null, clock: renderer.visualClock,
            vfx: renderer.vfx ?? null,
          };
        });
        result.shots.push(shot);
      }
    }
    // the stepped frames are the same work every run (same scene, same frames): their cost, GPU
    // included, compares builds more steadily than real-time play does
    // (the first frames compile shaders: left out)
    const warm = stepMs.slice(Math.min(10, Math.floor(stepMs.length / 4)));
    result.stepped = { frames: warm.length, skipped: stepMs.length - warm.length, medianMs: r1(percentile(warm, 50)), p95Ms: r1(percentile(warm, 95)), firstMs: r1(stepMs[0]), load: [r1(stepLoad0), r1(loadavg()[0])] };

    if (perf) {
      // real time: a fresh crowd (so the board stays busy), then ~PERF_SECONDS of frames
      await page.evaluate(async (scene) => {
        const { sim } = window.__battle;
        const { ensureWave } = await import('/src/ui/battle/sandboxPanel.js');
        ensureWave(sim);
        const roads = sim.paths.length;
        let n = 0;
        for (const [id, count, hpMul] of scene.enemies) for (let k = 0; k < count; k++) sim.spawnEnemy(id, { pathIndex: (n++) % roads, dist: 0.3 * k, hpMul });
        window.__vfxCap.release();
      }, SCENE);
      await page.waitForTimeout(1500); // settle (the first real frames catch up)
      await page.evaluate(() => {
        window.__vfxCap.samples = [];
        window.__vfxCap.measuring = true;
      });
      const probes = [];
      const load0 = loadavg()[0];
      const t0 = Date.now();
      while (Date.now() - t0 < PERF_SECONDS * 1000) {
        await page.waitForTimeout(1000);
        probes.push(await page.evaluate(() => {
          const { sim, renderer } = window.__battle;
          const fx = renderer.info.attackFx || {};
          return { enemies: sim.enemies.length, calls: renderer.info.calls, triangles: renderer.info.triangles, fxQuads: fx.quads, fxMs: fx.ms };
        }));
      }
      const samples = await page.evaluate(() => {
        window.__vfxCap.measuring = false;
        return window.__vfxCap.samples;
      });
      // callbacks that share a timestamp belong to one frame
      const frames = new Map();
      for (const [ts, ms] of samples) frames.set(ts, (frames.get(ts) || 0) + ms);
      const ts = [...frames.keys()].sort((a, b) => a - b);
      const intervals = ts.slice(1).map((t, i) => t - ts[i]);
      const cpu = [...frames.values()];
      const span = ts.length > 1 ? (ts[ts.length - 1] - ts[0]) / 1000 : 0;
      const avg = (k) => r1(probes.reduce((a, p) => a + (p[k] || 0), 0) / Math.max(1, probes.length));
      result.perf = {
        seconds: r1(span), frames: ts.length, fps: span > 0 ? r1((ts.length - 1) / span) : null,
        frameMedianMs: r1(percentile(intervals, 50)), frameP95Ms: r1(percentile(intervals, 95)),
        cpuMedianMs: r1(percentile(cpu, 50)), cpuP95Ms: r1(percentile(cpu, 95)),
        enemiesAvg: avg('enemies'), callsMax: Math.max(...probes.map((p) => p.calls || 0)), trianglesAvg: Math.round(avg('triangles')),
        fxQuadsMax: Math.max(...probes.map((p) => p.fxQuads || 0)), fxMsAvg: avg('fxMs'),
        // the machine's 1-minute load average before / after (other work on it slows every frame)
        load: [r1(load0), r1(loadavg()[0])], cpus: cpus().length,
      };
    }
  } catch (e) {
    errors.push(`[capture] ${e.message}`);
  } finally {
    await context.close();
  }
  return result;
}

/** Pixel difference of two PNGs, counted in the browser (no image library needed). */
async function pixelDiff(browser, a, b) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    return await page.evaluate(async ([da, db]) => {
      const load = (src) => new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = src;
      });
      const [ia, ib] = await Promise.all([load(da), load(db)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { same: false, sizeDiffers: true };
      const c = document.createElement('canvas');
      c.width = ia.width;
      c.height = ia.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(ia, 0, 0);
      const pa = g.getImageData(0, 0, c.width, c.height).data;
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(ib, 0, 0);
      const pb = g.getImageData(0, 0, c.width, c.height).data;
      let diff = 0;
      let maxd = 0;
      for (let i = 0; i < pa.length; i += 4) {
        const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
        if (d > 0) diff++;
        if (d > maxd) maxd = d;
      }
      // "same": identical, or off by rounding only (a few pixels, ±2 of 255: SwiftShader's float
      // blur / multisample resolve is not bit-exact run to run)
      const pixels = pa.length / 4;
      return { same: diff === 0 || (maxd <= 2 && diff / pixels < 1e-3), identical: diff === 0, pixels, differing: diff, maxChannelDelta: maxd };
    }, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`]);
  } finally {
    await ctx.close();
  }
}

mkdirSync(OUT, { recursive: true });
const startedAt = new Date().toISOString();
const id = simId().id;
let server;
let base;
if (PROD) {
  server = await preview({ root: process.cwd(), preview: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
  base = server.resolvedUrls?.local?.[0] || `http://127.0.0.1:${server.httpServer.address().port}/`;
} else {
  server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1', hmr: false }, logLevel: 'error' });
  await server.listen();
  base = `http://127.0.0.1:${server.httpServer.address().port}/`;
}
let { browser, label: browserLabel } = await launch();
/** A config whose page crashed takes the browser down too, at times: start a new one. */
async function liveBrowser() {
  if (browser.isConnected()) return browser;
  console.log('  (browser gone: starting a new one)');
  ({ browser } = await launch());
  return browser;
}
/** One config, run again once when its page or browser crashed (headless SwiftShader under load). */
async function captureSafe(opts) {
  let r = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      r = await captureOne(await liveBrowser(), base, opts);
    } catch (e) {
      r = { viewport: opts.vp, quality: opts.quality, shots: [], errors: [`[capture] ${e.message}`] };
    }
    const crashed = r.errors.some((e) => /crash|has been closed|Target closed/i.test(e));
    if (!crashed) break;
    if (attempt === 0) console.log(`  ${opts.tag}: crashed, running it again`);
    r.retried = true;
  }
  return r;
}
console.log(`vfx capture "${LABEL}" → ${OUT}\n  ${browserLabel}, sim id ${id}, map ${MAP_ID}, frames ${MOMENTS.join('/')}${EVENTS.length ? `, events ${EVENTS.map((e) => `${e.kind}@${e.at}`).join('/')}` : ''}${REDUCE_MOTION ? ', reduce motion' : ''}`);

const results = [];
let kept = [];
if (RESUME && existsSync(join(OUT, 'capture.json'))) {
  const { readFileSync } = await import('node:fs');
  const prev = JSON.parse(readFileSync(join(OUT, 'capture.json'), 'utf8'));
  if (prev.simId === id && JSON.stringify(prev.scene) === JSON.stringify(SCENE) && JSON.stringify(prev.moments) === JSON.stringify(MOMENTS) && JSON.stringify(prev.events || []) === JSON.stringify(EVENTS)) {
    kept = (prev.results || []).filter((r) => !r.errors?.length && r.shots?.length === SHOTS.length && (SKIP_PERF || r.perf));
    console.log(`  resuming: keeping ${kept.map((r) => `${r.viewport}-${r.quality}`).join(', ') || 'nothing'}`);
  } else {
    console.log('  resume: the earlier run staged something else (sim id, scene or moments); starting over');
  }
}
/** capture.json, rewritten after every config (a stopped run keeps what it measured). */
const writeReport = (extra = {}) => {
  const report = {
    label: LABEL, startedAt, finishedAt: new Date().toISOString(), simId: id, browser: browserLabel, prod: PROD, scene: SCENE, moments: MOMENTS, events: EVENTS, eventShots: EVENT_SHOTS,
    perfSeconds: SKIP_PERF ? 0 : PERF_SECONDS, dpr: { phone: DPR_PHONE, desktop: DPR_DESKTOP }, reduceMotion: REDUCE_MOTION,
    note: 'Headless Chromium with SwiftShader (WebGL on the CPU): numbers compare builds on this machine, not a real phone.',
    results, repeat: null, partial: true, ...extra,
  };
  writeFileSync(join(OUT, 'capture.json'), `${JSON.stringify(report, null, 2)}\n`);
};
for (const vp of VIEWPORTS) {
  for (const quality of QUALITIES) {
    const tag = `${vp}-${quality}${REDUCE_MOTION ? '-rm' : ''}`;
    const old = kept.find((r) => r.viewport === vp && r.quality === quality && !!r.reduceMotion === REDUCE_MOTION);
    if (old) {
      results.push(old);
      console.log(`  ${tag}: kept from the earlier run`);
      continue;
    }
    const t0 = Date.now();
    const r = await captureSafe({ vp, quality, tag, perf: !SKIP_PERF });
    r.wallSeconds = Math.round((Date.now() - t0) / 1000);
    results.push(r);
    const p = r.perf;
    console.log(`  ${tag}: ${r.shots.length} shots${r.stepped ? `, stepped frames ${r.stepped.medianMs} ms median / ${r.stepped.p95Ms} p95` : ''}${p ? `, frame ${p.frameMedianMs} ms median / ${p.frameP95Ms} p95 (${p.fps} fps), cpu ${p.cpuMedianMs} / ${p.cpuP95Ms} ms, ${p.callsMax} calls max, ${p.fxQuadsMax} fx quads max` : ''}${r.errors.length ? `, ${r.errors.length} error(s)` : ''} (${r.wallSeconds} s)`);
    for (const e of r.errors.slice(0, 5)) console.log(`      ${e}`);
    writeReport();
  }
}

let repeat = null;
if (REPEAT && VIEWPORTS.length && QUALITIES.length) {
  // the same config staged again from scratch: every shot must match the first run's
  const [vp, quality] = REPEAT_CONFIG ? REPEAT_CONFIG.split(':') : [VIEWPORTS[0], QUALITIES[0]];
  const first = results.find((r) => r.viewport === vp && r.quality === quality);
  const again = await captureSafe({ vp, quality, tag: `${vp}-${quality}${REDUCE_MOTION ? '-rm' : ''}-repeat`, perf: false });
  const { readFileSync } = await import('node:fs');
  repeat = { viewport: vp, quality, shots: [], errors: again.errors };
  for (const s of again.shots) {
    const f = first?.shots.find((x) => x.frame === s.frame && x.event === s.event);
    if (!f) continue;
    const canvas = await pixelDiff(await liveBrowser(), readFileSync(join(OUT, f.canvasFile)), readFileSync(join(OUT, s.canvasFile)));
    repeat.shots.push({ frame: s.frame, canvasSameBytes: f.canvasSha === s.canvasSha, fullSameBytes: f.sha === s.sha, canvas });
  }
  repeat.same = repeat.shots.length > 0 && repeat.shots.every((s) => s.canvas.same);
  repeat.identical = repeat.shots.length > 0 && repeat.shots.every((s) => s.canvas.identical);
  console.log(`  repeat ${vp} ${quality}: ${repeat.identical ? 'identical' : repeat.same ? 'the same (rounding only)' : 'DIFFERENT'} ${JSON.stringify(repeat.shots.map((s) => ({ f: s.frame, ...s.canvas })))}`);
}

await browser.close().catch(() => {});
await server.close?.();
if (server.httpServer && !PROD) server.httpServer.close?.();

writeReport({ repeat, partial: false });
console.log(`  wrote ${join(OUT, 'capture.json')}`);
const bad = results.filter((r) => r.errors.length || r.shots.length !== SHOTS.length);
if (bad.length || (repeat && !repeat.same)) process.exitCode = 1;
