// Item 2b-d against the live build through the relay: the changed girls and enemies animate in a real battle,
// Luna is not T-posed, the Green Slime / Goblin Runner faces by day and night, and the Halloween goblin's costume.
//   node models-battle.mjs WxH shotsDir
import { launchChromium } from '/home/user/sakura-game/e2e/browser.mjs';
import { createServer } from '/home/user/sakura-game/node_modules/vite/dist/node/index.js';
import { existsSync } from 'node:fs';
const server = await createServer({ root: '/home/user/sakura-game', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
const save = await server.ssrLoadModule('/src/systems/save.js');
const HAS_LOD = (id) => existsSync(`/home/user/sakura-game/public/models/enemies/tripo/${id}.lod.glb`);
const [W, H] = process.argv[2].split('x').map(Number);
const SHOTS = process.argv[3];
const base = 'http://127.0.0.1:5199/';
const FOES = ['slime_green', 'goblin_runner', 'orc_grunt', 'oni_brute', 'fp_hyakki_daimyo', 'ghoul_bonewalker', 'lizard_skink', 'iron_colossus', 'fp_foundry_titan'];
const TOWERS = [];
const RUNS = [
  { stage: '1-1', q: 'high', hero: 'luna', tag: 'day' },
  { stage: '1-1', q: 'low', hero: 'luna', tag: 'day' },
  { stage: '2-1', q: 'high', hero: 'nami', tag: 'night' },
  { stage: '2-1', q: 'low', hero: 'kanna', tag: 'night' },
  { stage: '1-1', q: 'medium', hero: 'yoriko', tag: 'day' },
  { stage: '2-1', q: 'low', hero: 'kogane', tag: 'night' },
  { stage: 'ev-halloween-1', q: 'high', hero: 'norika', tag: 'halloween' },
];
const IGNORE = [/favicon/i, /GPU stall|ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GroupMarkerNotSet/i];
const { browser } = await launchChromium();
const fails = []; const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); return c; };
const errs = []; const bad = [];
const settle = (page, ms = 150) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);

// in-page helpers (installed once per page)
const HELPERS = () => {
  const find = (pred) => { let m = null; window.__battle.renderer.sceneProbe().traverse((o) => { if (!m && pred(o)) m = o; }); return m; };
  const bodyOf = (m) => { let b = null; m.traverse((o) => { if (o.isSkinnedMesh && o.visible && (!b || o.geometry.attributes.position.count > b.geometry.attributes.position.count)) b = o; }); return b; };
  const pose = (m) => { const b = bodyOf(m); return b ? b.skeleton.bones.map((x) => x.quaternion.toArray()) : null; };
  const delta = (a, b) => { if (!a || !b) return -1; let s = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i][0] * b[i][0] + a[i][1] * b[i][1] + a[i][2] * b[i][2] + a[i][3] * b[i][3]); s += 2 * Math.acos(Math.min(1, d)); } return s; };
  const clips = (m) => { const mx = m.userData.mixer; return mx ? mx._actions.filter((a) => a.isRunning()).map((a) => a.getClip().name) : []; };
  // upper-arm angle from straight down (deg), both arms, world space
  const armAngle = (m) => {
    const b = bodyOf(m); if (!b) return null;
    const by = (n) => b.skeleton.bones.find((x) => x.name === n);
    const out = [];
    for (const s of ['L', 'R']) {
      const u = by(`upper_arm_${s}`); const f = by(`forearm_${s}`);
      if (!u || !f) continue;
      u.updateWorldMatrix(true, false); f.updateWorldMatrix(true, false);
      const pu = u.getWorldPosition(u.position.clone()); const pf = f.getWorldPosition(f.position.clone());
      const d = pf.sub(pu).normalize();
      out.push(Math.acos(Math.max(-1, Math.min(1, -d.y))) * 180 / Math.PI);
    }
    return out;
  };
  window.__mb = { find, bodyOf, pose, delta, clips, armAngle };
};

async function zoomOn(page, x, y, h, clicks) {
  await page.evaluate(() => window.__battle.renderer.resetCamera?.());
  await settle(page, 300);
  for (let i = 0; i < clicks; i++) {
    const at = await page.evaluate(([px, py, ph]) => window.__battle.renderer.worldToScreen(px, py, ph), [x, y, h]);
    await page.mouse.move(at.clientX, at.clientY);
    await page.mouse.wheel(0, -240);
    await settle(page, 60);
  }
  await settle(page, 400);
}

async function newPage(run) {
  const profile = save.createProfile();
  for (const id of [...TOWERS, run.hero, 'aoi']) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
  profile.formation = { ...(profile.formation || {}), towers: [...TOWERS, 'aoi'], hero: run.hero };
  profile.progress.stages['1-1'] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
  profile.settings = { ...profile.settings, autoStart: false, quality: run.q, camera: 'free' };
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([key, text]) => {
    if (!sessionStorage.getItem('mb-seeded')) { localStorage.clear(); localStorage.setItem(key, text); sessionStorage.setItem('mb-seeded', '1'); }
  }, [save.SAVE_KEY, JSON.stringify(profile)]);
  await ctx.addInitScript(() => { try { sessionStorage.setItem('sakura-beta-gift-shown', '1'); sessionStorage.setItem('sakura-ui-rotate-dismissed', '1'); } catch {} });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((r) => r.test(m.text()))) errs.push('console ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) bad.push([r.status(), r.url()]); });
  page.on('requestfailed', (r) => { if (!/\/@vite\/|ws:/.test(r.url())) bad.push(['failed', r.url(), r.failure()?.errorText]); });
  return { ctx, page };
}

async function battle(run) {
  console.log(`\n== ${run.stage} ${run.q} hero ${run.hero} at ${W}x${H}`);
  const { ctx, page } = await newPage(run);
  await page.goto(`${base}?online=local&onboarding=0#/lobby`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 90000 });
  await page.evaluate(() => { window.__sakura.store.profile.battleSaves = {}; });
  await page.evaluate((s) => { location.hash = `#/battle?stage=${s}&difficulty=normal`; }, run.stage);
  const ok = await page.waitForFunction((s) => window.__battle?.ui?.act && window.__battle.sim?.stage?.id === s, run.stage, { timeout: 120000 }).then(() => true, () => false);
  if (!check(ok, `battle ${run.stage} opens (${run.q})`)) { await ctx.close(); return; }
  await page.evaluate(HELPERS);
  await page.evaluate(() => window.__battle.ui.placement?.cancel?.());
  await page.click('[data-testid=place-cancel]', { timeout: 3000 }).catch(() => null);
  await settle(page, 300);
  // place the girls by the road
  const placed = await page.evaluate((ids) => {
    const { sim, ui } = window.__battle;
    sim.cash = 1e7;
    const out = {};
    const used = [];
    for (const id of ids) {
      let best = null;
      for (let y = 0.6; y < sim.map.height; y += 0.25) for (let x = 0.6; x < sim.map.width; x += 0.25) {
        if (!sim.canPlace(id, x, y).ok) continue;
        const d = sim.placement.pathDistance(x, y);
        if (d < 0.8 || d > 1.6 || used.some(([ux, uy]) => Math.hypot(ux - x, uy - y) < 1.2)) continue;
        const c = Math.hypot(x - sim.map.width / 2, y - sim.map.height / 2);
        if (!best || c < best.c) best = { x, y, c };
      }
      if (!best) { out[id] = null; continue; }
      const t = ui.act.place(id, best.x, best.y);
      ui.placement?.cancel?.(); ui.select?.(null);
      if (t) { out[id] = { uid: t.uid, x: t.x, y: t.y }; used.push([t.x, t.y]); } else out[id] = null;
    }
    return out;
  }, [...TOWERS, run.hero]);
  for (const id of [...TOWERS, run.hero]) check(!!placed[id], `${id} placed ${JSON.stringify(placed[id])}`);
  // spawn every changed enemy along the road, slow and unkillable
  const spawned = await page.evaluate(async (foes) => {
    const { sim, ui } = window.__battle;
    ui.paused = false; ui.speed = 1;
    sim._spawnQueue = [];
    const L = sim.pathData[0].length;
    const out = {};
    foes.forEach((id, i) => {
      const e = sim.spawnEnemy(id, { pathIndex: 0, dist: 1 + (i * (L - 3)) / foes.length, hpMul: 1e7 });
      if (e) { e.baseSpeed = 0.03; out[id] = e.uid; }
    });
    return out;
  }, FOES);
  const want = (id) => `glb:tripo/${id}${run.q !== 'high' && HAS_LOD(id) ? '.lod' : ''}`;
  await page.waitForFunction(([foes, lod]) => foes.every((id) => {
    const m = window.__mb.find((o) => o.name === `enemy:${id}`);
    if (!m) return false;
    let f = false; m.traverse((c) => { if (c.name.startsWith(`glb:tripo/${id}`)) f = true; }); return f;
  }), [FOES, run.q !== 'high'], { timeout: 90000, polling: 500 }).catch(() => null);
  await page.waitForFunction((ids) => ids.every((u) => window.__battle.renderer.towerModel(u)?.userData.glb), Object.values(placed).filter(Boolean).map((p) => p.uid), { timeout: 60000 }).catch(() => null);
  await settle(page, 800);
  // animation: bone poses sampled 0.8 s apart while the battle runs
  const sample = () => page.evaluate(([foes, pl]) => {
    const { find, pose, clips, armAngle } = window.__mb;
    const r = {};
    for (const id of foes) {
      const m = find((o) => o.name === `enemy:${id}`);
      let lod = null; m?.traverse((c) => { if (c.name.startsWith('glb:tripo/')) lod = c.name; });
      r[id] = m ? { pose: pose(m), clips: clips(m), model: lod } : null;
    }
    for (const [id, p] of Object.entries(pl)) {
      if (!p) continue;
      const m = window.__battle.renderer.towerModel(p.uid);
      r[id] = m ? { pose: pose(m), clips: clips(m), model: m.userData.assetId || (m.userData.glb ? 'glb' : 'procedural'), arms: armAngle(m), glb: !!m.userData.glb } : null;
    }
    return r;
  }, [FOES, placed]);
  const frames = () => page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
  console.log(`    ~${await frames()} frames/s`);
  const a = await sample();
  await page.waitForTimeout(2000);
  const b = await sample();
  const startWave = await page.evaluate(() => { window.__battle.ui.startWave?.(); return true; });
  await page.waitForTimeout(2500);
  const c = await sample();
  const delta = (x, y) => page.evaluate(([p, q]) => window.__mb.delta(p, q), [x?.pose, y?.pose]);
  for (const id of FOES) {
    const d = await delta(a[id], b[id]);
    check(!!a[id] && a[id].model === want(id) && d > 0.05, `${id}: ${a[id]?.model}, animates (bone turn ${d.toFixed(2)} rad in 2 s; clips ${[...new Set([...(a[id]?.clips || []), ...(c[id]?.clips || [])])].join(',')})`);
  }
  for (const id of [...TOWERS, run.hero]) {
    if (!a[id]) { check(false, `${id}: no figure`); continue; }
    const d1 = await delta(a[id], b[id]); const d2 = await delta(b[id], c[id]);
    const clipsSeen = [...new Set([...a[id].clips, ...b[id].clips, ...c[id].clips])];
    const samples = [a[id].arms, b[id].arms, c[id].arms].filter((x) => x && x.length === 2);
    const arms = samples.flat();
    // a T-pose: both upper arms straight out (~90° from down) at the same time
    const tpose = samples.filter(([l, r]) => l > 75 && l < 105 && r > 75 && r < 105).length;
    const maxArm = samples.length ? Math.max(...samples.map(([l, r]) => Math.min(l, r))) : null;
    check(a[id].glb && d1 + d2 > 0.05, `${id}: GLB ${a[id].model}, animates (bone turn ${d1.toFixed(2)} / ${d2.toFixed(2)} rad; clips ${clipsSeen.join(',')}); upper arms ${arms.map((x) => x.toFixed(0)).join('/')}° from straight down`);
    if (id === 'luna') check(samples.length === 3 && tpose === 0, `luna: no T-pose (in no sample are both upper arms straight out; the lower arm is at most ${maxArm?.toFixed(0)}° from straight down; a T-pose has both at ~90°)`);
  }
  // faces: slime and goblin draw their face mesh (not outlined)
  const faces = await page.evaluate(() => {
    const r = {};
    for (const id of ['slime_green', 'goblin_runner']) {
      const m = window.__mb.find((o) => o.name === `enemy:${id}`);
      const meshes = []; m?.traverse((o) => { if (o.isMesh) meshes.push({ name: o.name, outline: !!o.userData.isOutline, visible: o.visible }); });
      r[id] = meshes;
    }
    return r;
  });
  for (const id of ['slime_green', 'goblin_runner']) check(faces[id].some((m) => m.name === 'face' && m.visible && !m.outline), `${id} (${run.tag}, ${run.q}) draws its face mesh (${faces[id].map((m) => m.name + (m.outline ? '[o]' : '')).join(', ')})`);
  // close-ups
  const shotOf = async (name, uid, h, clicks) => {
    if (!SHOTS) return;
    const pos = await page.evaluate((u) => { const e = window.__battle.sim.enemies.find((x) => x.uid === u) || window.__battle.sim.getTower(u); return e ? { x: e.x, y: e.y } : null; }, uid);
    if (!pos) return;
    await zoomOn(page, pos.x, pos.y, h, clicks);
    await page.evaluate(() => { window.__battle.ui.paused = true; });
    await settle(page, 300);
    await page.evaluate(() => document.querySelectorAll('.jn-toast, .toast').forEach((e) => e.remove()));
    await page.screenshot({ path: `${SHOTS}/${name}-${W}x${H}.jpg`, type: 'jpeg', quality: 72, timeout: 180000 });
    await page.evaluate(() => { window.__battle.ui.paused = false; });
  };
  if (run.q === 'high' && run.stage !== 'ev-halloween-1') {
    // bring the slime and the goblin side by side on the road, then zoom in
    await page.evaluate(([s, g]) => {
      const { sim } = window.__battle;
      const S = sim.enemies.find((e) => e.uid === s); const G = sim.enemies.find((e) => e.uid === g);
      if (S && G) { G.dist = S.dist + 0.7; }
    }, [spawned.slime_green, spawned.goblin_runner]);
    await settle(page, 600);
    await shotOf(`slime-goblin-faces-${run.tag}`, spawned.slime_green, 0.2, W < 600 ? 7 : 8);
  }
  if (run.hero === 'luna' && run.q === 'high' && run.stage === '1-1') await shotOf('luna-battle', placed.luna?.uid, 0.4, W < 600 ? 6 : 7);
  if (run.stage === 'ev-halloween-1') {
    // many goblin runners: each one's costume (deterministic per uid)
    const cos = await page.evaluate(async () => {
      const { sim } = window.__battle;
      for (let i = 0; i < 40; i++) { const e = sim.spawnEnemy('goblin_runner', { pathIndex: 0, dist: 0.5 + (i % 10) * 0.4, hpMul: 1e7 }); if (e) e.baseSpeed = 0.02; }
      await new Promise((r) => setTimeout(r, 4000));
      const kinds = {}; let n = 0;
      window.__battle.renderer.sceneProbe().traverse((o) => {
        if (o.name !== 'enemy:goblin_runner') return;
        n++;
        let k = 'none'; o.traverse((c) => { if (c.name.startsWith('costume:')) k = c.name.slice(8); });
        kinds[k] = (kinds[k] || 0) + 1;
      });
      return { n, kinds };
    });
    check(cos.n >= 30 && (cos.kinds.pumpkinHat || 0) > 0 && !cos.kinds.pumpkinHead && !cos.kinds.sheet, `Halloween goblin runners (${cos.n}): costumes ${JSON.stringify(cos.kinds)}: a pumpkin hat, never the pumpkin head or the sheet`);
    const others = await page.evaluate(() => { const k = {}; window.__battle.renderer.sceneProbe().traverse((o) => { if (o.name?.startsWith('costume:')) k[o.name] = (k[o.name] || 0) + 1; }); return k; });
    console.log('    all costumes on the board', JSON.stringify(others));
    if (SHOTS) {
      const hatUid = await page.evaluate(() => {
        const { sim, renderer } = window.__battle;
        let uid = null;
        renderer.sceneProbe().traverse((o) => {
          if (uid || o.name !== 'enemy:goblin_runner') return;
          let hat = false; o.traverse((c) => { if (c.name === 'costume:pumpkinHat') hat = true; });
          if (!hat) return;
          let best = null;
          for (const e of sim.enemies) if (e.defId === 'goblin_runner' || e.def?.id === 'goblin_runner' || e.id === 'goblin_runner') { const d = Math.hypot(e.x - o.position.x, e.y - o.position.z); if (!best || d < best.d) best = { d, uid: e.uid }; }
          uid = best?.uid ?? null;
        });
        // the others out of the way: only the hat goblin stays
        for (const e of sim.enemies) if (e.uid !== uid) { e.hp = 0; e.dead = true; }
        return uid;
      });
      await settle(page, 1200);
      if (hatUid != null) await shotOf('halloween-goblin-pumpkin-hat', hatUid, 0.2, W < 600 ? 8 : 9);
      else console.log('    (no hat goblin uid for a close-up)');
    }
  }
  await ctx.close();
}

try { for (const r of RUNS) await battle(r); } catch (e) { check(false, 'threw: ' + e.stack); }
check(errs.length === 0, `no page/console errors${errs.length ? ': ' + errs.slice(0, 5).join(' || ') : ''}`);
check(bad.length === 0, `no failed or non-200 requests ${JSON.stringify(bad.slice(0, 5))}`);
await browser.close();
await server.close();
console.log(`RESULT models-battle ${W}x${H}: ${fails.length ? 'FAIL ' + fails.length : 'PASS'}`);
process.exit(fails.length ? 1 : 0);
