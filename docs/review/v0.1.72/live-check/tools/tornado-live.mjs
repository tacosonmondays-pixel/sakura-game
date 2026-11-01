// Item 3: Akane's Starmine Barrage swirls into a fire tornado, on the live build through the relay.
// For each size x quality (and Reduce Motion on, high): 1-1 Normal with Akane (Big Bang tier 3) beside the road, a tight
// crowd of tough enemies spawned on the road near her, then her cast through the live sim's own castAbility. Every sim
// event is recorded (sim.update wrapped); every frame the live renderer's tornado layer is sampled.
// Checks: one fire tornado spawns, at the warning spot, which is where the shells land (mean shell spot within the
// cast radius); it is drawn (rings > 0, mesh visible) while the shells fall with the tier's ring count; once the barrage
// ends it rises and fades out (live 0, mesh hidden) within its tail; with Reduce Motion the rings carry spin 0 and
// twist 0 (iD.z, iC.w), otherwise the preset's spin; no console errors.
//   node tornado-live.mjs [--shots dir] [--sizes 1280x720,390x844] [--runs high,medium,low,high-rm]
import { createServer } from '/home/user/sakura-game/node_modules/vite/dist/node/index.js';
import { mkdirSync } from 'node:fs';
import { launchChromium } from '/home/user/sakura-game/e2e/browser.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const SIZES = String(opt('sizes', '1280x720,390x844')).split(',').map((s) => s.split('x').map(Number));
const RUNS = String(opt('runs', 'high,medium,low,high-rm')).split(',');
const IGNORE = [/GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i];
const failures = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) failures.push(m); return c; };
const server = await createServer({ root: '/home/user/sakura-game', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const save = await server.ssrLoadModule('/src/systems/save.js');
const base = 'http://127.0.0.1:5199/?online=local&onboarding=0';
const { browser, label } = await launchChromium();
console.log('browser', label);
const errors = [];
const settle = (page, ms = 250) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);

async function run([VW, VH], runId) {
  const quality = runId.replace('-rm', '');
  const rm = runId.endsWith('-rm');
  console.log(`\n== Starmine on 1-1 at ${VW}x${VH} (${quality}${rm ? ', Reduce Motion' : ''})`);
  const profile = save.createProfile();
  profile.units.akane = { ...save.newUnitState(), level: 40, breakthrough: 3 };
  profile.formation = { ...(profile.formation || {}), towers: ['akane', ...(profile.formation?.towers || []).filter((x) => x !== 'akane')].slice(0, 6) };
  profile.settings = { ...profile.settings, autoStart: false, quality, camera: 'free', reduceMotion: rm };
  const touch = VW < 600;
  const context = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  await context.addInitScript(([key, text]) => {
    if (!sessionStorage.getItem('tor-seeded')) { localStorage.clear(); localStorage.setItem(key, text); sessionStorage.setItem('tor-seeded', '1'); }
  }, [save.SAVE_KEY, JSON.stringify(profile)]);
  const page = await context.newPage();
  const tag = `${VW}x${VH} ${runId}`;
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'warning' && /tornado|disabled/i.test(t)) errors.push(`[${tag} warn] ${t}`);
    if (m.type() === 'error' && !IGNORE.some((re) => re.test(t))) errors.push(`[${tag}] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[${tag} pageerror] ${e.message}`));
  await page.goto(base, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 90000 });
  await page.evaluate(() => { location.hash = '#/battle?stage=1-1&difficulty=normal'; });
  const ok = await page.waitForFunction(() => window.__battle?.ui?.act && window.__battle.renderer?.tornado, null, { timeout: 90000 }).then(() => true, () => false);
  if (!check(ok, `${tag}: battle 1-1 opens and the live renderer has its tornado layer`)) { await context.close(); return; }
  await settle(page, 800);
  const setup = await page.evaluate(([wantQ, wantRm]) => {
    const { sim, ui, renderer } = window.__battle;
    sim.cash = 1e7;
    // Akane beside the road near the screen's middle
    let best = null;
    for (let y = 0.6; y < sim.map.height - 0.6; y += 0.25) for (let x = 0.6; x < sim.map.width; x += 0.25) {
      if (!sim.canPlace('akane', x, y).ok) continue;
      const d = sim.placement.pathDistance(x, y);
      if (d < 0.7 || d > 1.3) continue;
      const s = renderer.worldToScreen(x, y, 0);
      if (!s.visible) continue;
      const c = Math.hypot(s.clientX - innerWidth / 2, s.clientY - innerHeight * 0.5);
      if (!best || c < best.c) best = { x, y, c };
    }
    if (!best) return { err: 'no spot' };
    const t = ui.act.place('akane', best.x, best.y);
    ui.placement?.cancel?.();
    if (!t) return { err: 'place refused' };
    for (let k = 0; k < 3; k++) ui.act.upgrade(t.uid, 0);
    const tw = sim.towers.find((x) => x.uid === t.uid);
    // a wave (the sandbox's ensureWave: no wave queue) and a tight crowd on the road nearest her
    if (sim.state === 'prep' || sim.state === 'between') { sim.state = 'wave'; sim._spawnQueue = []; sim._spawnIndex = 0; sim._waveTime = 0; sim._autoTimer = -1; }
    const pts = sim.paths[0];
    let cum = 0; let bestD = null;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1]; const [bx, by] = pts[i];
      const L = Math.hypot(bx - ax, by - ay);
      for (let s = 0; s <= 20; s++) {
        const k = s / 20; const px = ax + (bx - ax) * k; const py = ay + (by - ay) * k;
        const d = Math.hypot(px - tw.x, py - tw.y);
        if (!bestD || d < bestD.d) bestD = { d, dist: cum + L * k };
      }
      cum += L;
    }
    let n = 0;
    for (let k = 0; k < 14; k++) if (sim.spawnEnemy(k % 2 ? 'orc_grunt' : 'goblin_runner', { pathIndex: 0, dist: Math.max(0, bestD.dist - 0.6 + k * 0.1), hpMul: 60 })) n++;
    // record every sim event (the live sim's own update)
    window.__tor = { ev: [], frames: [] };
    const upd = sim.update.bind(sim);
    sim.update = (...a) => {
      const r = upd(...a);
      for (const e of sim.events) if (e.type === 'abilityWarn' || e.type === 'abilityShell') window.__tor.ev.push({ type: e.type, id: e.id, x: e.x, y: e.y, radius: e.radius, delay: e.delay, shells: e.shells, t: sim.time });
      return r;
    };
    // every frame: the tornado layer
    const tor = renderer.tornado;
    const sample = () => {
      if (!window.__tor) return;
      const s = tor.stats;
      const L = tor.live.map((r) => ({ id: r.id, x: r.x, z: r.z, t: r.t, seconds: r.seconds, size: r.size }));
      const a = tor.mesh.geometry.attributes;
      const n = s.rings;
      let spinMax = 0; let twistMax = 0; let swayMax = 0;
      for (let i = 0; i < n; i++) { spinMax = Math.max(spinMax, Math.abs(a.iD.array[i * 4 + 2])); twistMax = Math.max(twistMax, Math.abs(a.iC.array[i * 4 + 3])); swayMax = Math.max(swayMax, Math.abs(a.iD.array[i * 4])); }
      window.__tor.frames.push({ now: performance.now(), simT: sim.time, live: s.live, rings: n, visible: s.visible, tierRings: s.tier.rings + s.tier.core, L, spinMax, twistMax, swayMax });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    const settings = window.__sakura.store.profile.settings;
    return { uid: t.uid, x: tw.x, y: tw.y, tiers: [...(tw.tiers || [])], abil: tw.abil ? { id: tw.abil.def?.id ?? tw.abil.id ?? null, cd: tw.abil.cd } : null, spawned: n, q: settings.quality, rm: settings.reduceMotion, wantQ, wantRm };
  }, [quality, rm]);
  if (!check(!setup.err, `${tag}: Akane placed (${JSON.stringify(setup)})`)) { await context.close(); return; }
  check(setup.q === quality && !!setup.rm === rm && setup.tiers[0] >= 3 && setup.spawned >= 10, `${tag}: quality ${setup.q}, Reduce Motion ${setup.rm}, Big Bang tier ${setup.tiers[0]}, ${setup.spawned} enemies on the road`);
  // a moment for the crowd to bunch up, then the cast through the live sim
  await settle(page, 600);
  const cast = await page.evaluate((u) => {
    const { sim } = window.__battle;
    const t = sim.towers.find((x) => x.uid === u);
    if (t.abil) t.abil.cd = 0;
    const r = sim.castAbility(u, {});
    return { ok: !!r?.ok, why: r?.reason ?? null, at: sim.time };
  }, setup.uid);
  check(cast.ok, `${tag}: Akane casts Starmine Barrage (${JSON.stringify(cast)})`);
  // shots: as the shells fall, near the end of the barrage, then after it lifts away
  const shoot = async (name) => { if (shotsDir) await page.screenshot({ path: `${shotsDir}/tornado-${runId}-${name}-${VW}x${VH}.jpg`, type: 'jpeg', quality: 72, timeout: 120000 }); };
  await page.waitForFunction(() => window.__tor.ev.filter((e) => e.type === 'abilityShell' && e.id === 'akane.starmine').length >= 2, null, { timeout: 60000, polling: 50 }).catch(() => null);
  await shoot('shells');
  await page.waitForFunction(() => window.__tor.ev.filter((e) => e.type === 'abilityShell' && e.id === 'akane.starmine').length >= 6, null, { timeout: 60000, polling: 50 }).catch(() => null);
  const lastShellNow = await page.evaluate(() => performance.now());
  await shoot('last-shell');
  // after: wait (real time; the visual clock) until the column is gone
  const gone = await page.waitForFunction(() => { const f = window.__tor.frames; const l = f[f.length - 1]; return l && l.live === 0 && !l.visible; }, null, { timeout: 180000, polling: 100 }).then(() => true, () => false);
  await settle(page, 300);
  await shoot('after');
  const R = await page.evaluate(() => window.__tor);
  const warns = R.ev.filter((e) => e.type === 'abilityWarn' && e.id === 'akane.starmine');
  const shells = R.ev.filter((e) => e.type === 'abilityShell' && e.id === 'akane.starmine');
  check(warns.length === 1 && shells.length === 6, `${tag}: one warning and ${shells.length} shells (radius ${warns[0]?.radius}, delay ${warns[0]?.delay})`);
  const withLive = R.frames.filter((f) => f.live > 0);
  const recs = withLive.flatMap((f) => f.L);
  const ids = [...new Set(recs.map((r) => r.id))];
  check(ids.length === 1 && ids[0] === 'fire' && Math.max(...withLive.map((f) => f.live)) === 1, `${tag}: one fire tornado (presets ${JSON.stringify(ids)}, at most ${Math.max(0, ...withLive.map((f) => f.live))} live)`);
  const w = warns[0];
  const rec = recs[0];
  if (w && rec) {
    const mx = shells.reduce((s, e) => s + e.x, 0) / shells.length;
    const my = shells.reduce((s, e) => s + e.y, 0) / shells.length;
    const dWarn = Math.hypot(rec.x - w.x, rec.z - w.y);
    const dMean = Math.hypot(rec.x - mx, rec.z - my);
    const dMax = Math.max(...shells.map((e) => Math.hypot(rec.x - e.x, rec.z - e.y)));
    check(dWarn < 1e-6 && dMean <= (w.radius || 1.2), `${tag}: the tornado stands where the shells land (board ${rec.x.toFixed(2)},${rec.z.toFixed(2)}; warning spot ${dWarn.toFixed(3)} tiles away; mean shell spot ${dMean.toFixed(2)}, farthest shell ${dMax.toFixed(2)} tiles, shell radius ${w.radius})`);
  }
  const drawn = withLive.filter((f) => f.rings > 0 && f.visible);
  const ringsMax = Math.max(0, ...drawn.map((f) => f.rings));
  const tierRings = withLive[0]?.tierRings;
  check(drawn.length >= 3 && ringsMax === tierRings, `${tag}: drawn while the shells fall (${drawn.length} frames with rings, ${ringsMax} rings = the ${quality} tier's ${tierRings})`);
  // lifts away: after the barrage (the record's fed time ran out) the column stays a while, rising, then it is gone
  const lastFrame = withLive[withLive.length - 1];
  const tailFrames = withLive.filter((f) => f.L[0] && f.L[0].t > f.L[0].seconds);
  const tailSecs = tailFrames.length ? tailFrames[tailFrames.length - 1].L[0].t - tailFrames[0].L[0].seconds : 0; // visual-clock seconds
  const after = R.frames.filter((f) => f.now > lastFrame.now);
  console.log(`  info gone-wait ${gone}`); check(gone && after.length > 0 && after.every((f) => f.live === 0 && f.rings === 0 && !f.visible) && tailFrames.length > 0,
    `${tag}: after the barrage it lifts away and is gone (fed ${lastFrame.L[0]?.seconds?.toFixed(2)} s, tail ${tailSecs.toFixed(2)} s on the visual clock over ${tailFrames.length} frames, then ${after.length} frames with nothing drawn)`);
  const spin = Math.max(0, ...drawn.map((f) => f.spinMax));
  const twist = Math.max(0, ...drawn.map((f) => f.twistMax));
  const sway = Math.max(0, ...drawn.map((f) => f.swayMax));
  if (rm) check(spin === 0 && twist === 0 && sway === 0, `${tag}: Reduce Motion: the rings don't spin (spin ${spin}, twist ${twist}, sway ${sway} on every drawn ring)`);
  else check(spin > 3 && twist > 3, `${tag}: rings spin (spin ${spin.toFixed(2)} rad/s, twist ${twist.toFixed(2)})`);
  console.log(`  info ${tag}: ${R.frames.length} frames sampled, last shell at ${(lastShellNow / 1000).toFixed(1)} s page time`);
  await context.close();
}

for (const size of SIZES) for (const r of RUNS) await run(size, r);
check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
await browser.close();
await server.close();
console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nall ok');
process.exit(failures.length ? 1 : 0);
