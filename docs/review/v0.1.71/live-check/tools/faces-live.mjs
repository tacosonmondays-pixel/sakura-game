// Slime and goblin faces (docs/art/tripo/slime-goblin-faces.md): close-ups of every clip frame, at 1280x720 and
// 390x844, by day and by night. Two modes:
//
//   Harness (default): one enemy at a time through the game's own loader and materials (e2e/fixtures/enemy-faces.html:
//   toon body, jelly look, outline hull, face mesh) under a battle light preset, from any angle, posed at exact clip
//   times. The face close-ups of the board and the hollow-eye sweep.
//     node e2e/slime-goblin-faces.mjs --out /tmp/faces [--ids slime_green,goblin_runner] [--lights day,night,halloween]
//          [--sizes 1280x720,390x844] [--frames 8] [--details high,medium,low] [--clips idle,move] [--view face|head|full]
//          [--pitch 30] [--yaw 0] [--span 0.5] [--tag after] [--before <dir>] [--family] [--girls all]
//     Writes <out>/<tag>-<id>-<detail>-<light>-<clip>-<k>-<W>x<H>.png (detail: high = the full file with its outline,
//     medium = the light file with its outline, low = the light file, no outline) and <out>/<tag>-faces.json (the
//     face bones' world scale in every frame, which the run checks stays 1). --before <dir>: serves the GLBs in <dir>
//     (<id>.glb, <id>.lod.glb) in place of the shipped ones (the earlier models). --family: each id on its family's
//     shared mesh. --girls aoi,luna|all: each girl's face with her outline (--ids none skips the enemies).
//
//   Battle (--battle): the real game, a real battle (default stages 1-1 by day, 2-1 by night, ev-halloween-1 with the
//   event hats), the Green Slime and the Goblin Runner walking toward the camera on the road, the free camera zoomed
//   in all the way, each posed by hand at every clip frame (the battle paused). 390x844 renders like a phone (device
//   pixel ratio 3, so the quality preset's own pixel ratio applies). Checks they wear their own models and the face
//   mesh, and no console errors.
//     node e2e/slime-goblin-faces.mjs --battle --out /tmp/faces-battle [--stages 1-1,2-1,ev-halloween-1]
//          [--qualities high,medium,low] [--sizes 1280x720,390x844] [--frames 6] [--clips idle,move,hit,death,special]
//     Writes <out>/<tag>-battle-<id>-<stage>-<quality>-<clip>-<k>-<W>x<H>.png and a .json beside each with the
//     enemy's screen position in image pixels (for crops).
// Starts its own Vite dev server. Exit code 1 on a page error, a failed check or a face bone that scales.
import { createServer } from '/home/user/sakura-game/node_modules/vite/dist/node/index.js';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { launchChromium } from '/home/user/sakura-game/e2e/browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const out = opt('out', '/tmp/faces');
const tag = opt('tag', 'after');
const IDS = String(opt('ids', 'slime_green,goblin_runner')).split(',').filter((s) => s && s !== 'none');
const LIGHTS = String(opt('lights', 'day,night')).split(',').filter(Boolean);
const SIZES = String(opt('sizes', '1280x720,390x844')).split(',').map((s) => s.split('x').map(Number));
const FRAMES = Number(opt('frames', args.includes('--battle') ? 6 : 8));
const DETAILS = String(opt('details', 'high,medium,low')).split(',').filter(Boolean);
const CLIPS = String(opt('clips', 'idle,move,hit,death,special')).split(',').filter(Boolean);
const VIEW = opt('view', 'face');
const YAW = Number(opt('yaw', 0));
const PITCH = Number(opt('pitch', 30));
const SPAN = opt('span', null);
const before = opt('before', null);
const FAMILY = args.includes('--family');
const BATTLE = args.includes('--battle');
const STAGES = String(opt('stages', '1-1,2-1,ev-halloween-1')).split(',').filter(Boolean);
const QUALITIES = String(opt('qualities', 'high,medium,low')).split(',').filter(Boolean);
let GIRLS = String(opt('girls', '')).split(',').filter(Boolean);
if (GIRLS[0] === 'all') GIRLS = Object.keys(JSON.parse(readFileSync('public/models/characters/manifest.json', 'utf8')));
mkdirSync(out, { recursive: true });

const LENS = { idle: 1.5, move: 1.0, hit: 0.3, death: 0.8, special: 0.6 };
// the face close-up: centre height (share of the rest height) and span (share of the height across the frame)
const FRAME = { slime_green: { faceAt: 0.5, span: 0.95 }, goblin_runner: { faceAt: 0.74, span: 0.5 } };
const IGNORE = [/favicon/i, /GPU stall|ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i,
  /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /Failed to load resource: net::ERR_/i];

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = "http://127.0.0.1:5199/?online=local&onboarding=0";
const { browser, label } = await launchChromium();
console.log(`browser: ${label}`);
const errors = [];
const failures = [];
const record = [];
const check = (cond, msg) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
};

function listen(page) {
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(`[console] ${m.text()}`);
  });
}

async function serveBefore(page) {
  if (!before) return;
  await page.route('**/models/enemies/tripo/*.glb', (route) => {
    const name = route.request().url().split('/').pop().split('?')[0];
    const file = path.join(before, name);
    if (existsSync(file)) return route.fulfill({ body: readFileSync(file), contentType: 'model/gltf-binary' });
    return route.continue();
  });
}

// ---- harness -----------------------------------------------------------------------------------------------------
async function harnessRun([VW, VH]) {
  const context = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  listen(page);
  await serveBefore(page);
  await page.goto(`${base}e2e/fixtures/enemy-faces.html`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__faces?.ready, null, { timeout: 90000 });
  for (const id of GIRLS) {
    for (const detail of DETAILS) {
      const info = await page.evaluate((o) => window.__faces.showGirl(o), { id, quality: detail, light: LIGHTS[0], pitch: PITCH, yaw: YAW });
      if (!info.ok) { errors.push(`${id}: ${info.error}`); continue; }
      const name = `${tag}-girl-${id}-${detail}-${VW}x${VH}`;
      await page.screenshot({ path: `${out}/${name}.png` });
      record.push({ name, id, detail });
    }
  }
  for (const id of IDS) {
    const fr = { ...(FRAME[id] || { faceAt: 0.6, span: 0.6 }), ...(SPAN ? { span: Number(SPAN) } : {}) };
    const fam = FAMILY ? await page.evaluate(async (i) => {
      const { ENEMY_MAP } = await import('/src/data/enemies.js');
      return ENEMY_MAP[i]?.model?.base || ENEMY_MAP[i]?.family;
    }, id) : null;
    const hasLod = await page.evaluate(async (i) => (await import('/src/models/glbEnemy.js')).TRIPO_ENEMY_LODS.includes(i), id);
    for (const detail of DETAILS) {
      const key = fam || (detail === 'high' || !hasLod ? `tripo/${id}` : `tripo/${id}.lod`);
      for (const light of LIGHTS) {
        for (const clip of CLIPS) {
          for (let k = 0; k < FRAMES; k++) {
            const t = (LENS[clip] || 1) * k / FRAMES;
            const info = await page.evaluate((o) => window.__faces.show(o), {
              id, key, quality: detail, light, view: VIEW, clip, t, yaw: YAW, pitch: PITCH, ...fr,
            });
            if (!info.ok) errors.push(`${id} ${detail} ${clip} ${t}: ${info.error || 'no clip'}`);
            const name = `${tag}-${id}-${detail}-${light}-${clip}-${k}-${VW}x${VH}`;
            await page.screenshot({ path: `${out}/${name}.png` });
            record.push({ name, id, detail, light, clip, t, size: `${VW}x${VH}`, faceScales: info.faceScales, meshes: info.meshes });
            // the face bones never scale (the slime's five; the goblin's eyes ride its head, which does not either)
            for (const [bone, s] of Object.entries(info.faceScales || {})) {
              if (!/^(eye|mouth|blush)/.test(bone)) continue;
              if (s.some((v) => Math.abs(v - 1) > 0.01)) failures.push(`${name}: face bone ${bone} scaled ${s.join(',')}`);
            }
          }
        }
      }
    }
  }
  await context.close();
}

// ---- battle ------------------------------------------------------------------------------------------------------
const settle = (page, ms = 120) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);

async function zoomOn(page, x, y, h, clicks) {
  await page.evaluate(() => window.__battle.renderer.resetCamera?.());
  await settle(page, 400);
  for (let i = 0; i < clicks; i++) {
    const at = await page.evaluate(([px, py, ph]) => window.__battle.renderer.worldToScreen(px, py, ph), [x, y, h]);
    await page.mouse.move(at.clientX, at.clientY);
    await page.mouse.wheel(0, -240);
    await settle(page, 60);
  }
  await settle(page, 500);
}

async function battleRun(save, [VW, VH], stage, quality) {
  const dpr = VW < 600 ? 3 : 1;
  console.log(`\n== battle ${stage} at ${VW}x${VH} (dpr ${dpr}, ${quality})`);
  const profile = save.createProfile();
  for (const id of ['aoi', 'luna']) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
  profile.formation = { ...(profile.formation || {}), towers: ['aoi'], hero: 'luna' };
  profile.settings = { ...profile.settings, autoStart: false, quality, camera: 'free', attackFx: false };
  const context = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: dpr });
  await context.addInitScript(([key, text]) => {
    if (!sessionStorage.getItem('sgf-seeded')) {
      localStorage.setItem(key, text);
      sessionStorage.setItem('sgf-seeded', '1');
    }
  }, [save.SAVE_KEY, JSON.stringify(profile)]);
  const page = await context.newPage();
  listen(page);
  await serveBefore(page);
  await page.goto(base, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 90000 });
  await page.evaluate((s) => { location.hash = `#/battle?stage=${s}&difficulty=normal`; }, stage);
  const ok = await page.waitForFunction((s) => window.__battle?.ui?.act && window.__battle.sim?.stage?.id === s, stage, { timeout: 90000 }).then(() => true, () => false);
  if (!check(ok, `battle ${stage} opens (${VW}x${VH}, ${quality})`)) { await context.close(); return; }
  // no hero on the board (her range ring would cover the close-ups, and the free-deploy prompt holds the wheel zoom)
  await page.waitForSelector('[data-testid=place-cancel]', { timeout: 8000 }).catch(() => null);
  await page.evaluate(() => window.__battle.ui.placement?.cancel?.());
  await page.click('[data-testid=place-cancel]', { timeout: 3000 }).catch(() => null);
  await settle(page, 300);
  check(!(await page.isVisible('[data-testid=place-cancel]').catch(() => false)), 'the deploy prompt is closed (the wheel zooms)');
  const lod = quality !== 'high';
  for (const id of IDS) {
    const at = await page.evaluate(async (eid) => {
      const { pointAt } = await import('/src/sim/path.js');
      const { sim, renderer, ui } = window.__battle;
      ui.paused = false;
      sim._spawnQueue = [];
      sim.enemies.splice(0);
      // the road point nearest the middle of the screen where the road runs down the screen (it walks toward the camera)
      const p0 = sim.pathData[0];
      let best = null;
      for (let d = 0.5; d < p0.length - 0.8; d += 0.25) {
        const p = pointAt(p0, d);
        const q = pointAt(p0, d + 0.3);
        const s = renderer.worldToScreen(p.x, p.y, 0);
        const s2 = renderer.worldToScreen(q.x, q.y, 0);
        if (!s.visible) continue;
        const toward = s2.clientY - s.clientY > 0.7 * Math.abs(s2.clientX - s.clientX);
        const c = Math.hypot(s.clientX - innerWidth / 2, s.clientY - innerHeight * 0.55) + (toward ? 0 : 1e4);
        if (!best || c < best.c) best = { d, c };
      }
      const e = sim.spawnEnemy(eid, { pathIndex: 0, dist: best ? best.d : 3, hpMul: 1e7 });
      if (!e) return null;
      e.baseSpeed = 0.02;
      return { uid: e.uid, x: e.x, y: e.y };
    }, id);
    if (!check(!!at, `${id} on the road`)) continue;
    const want = `glb:tripo/${id}${lod ? '.lod' : ''}`;
    const loaded = await page.waitForFunction(([eid, w]) => {
      let found = false;
      window.__battle.renderer.sceneProbe().traverse((o) => {
        if (o.name === `enemy:${eid}`) o.traverse((c) => { if (c.name === w) found = true; });
      });
      return found;
    }, [id, want], { timeout: 60000, polling: 250 }).then(() => true, () => false);
    check(loaded, `${id} wears its own model (${want})`);
    if (!loaded) continue;
    await settle(page, 600);
    const info = await page.evaluate((eid) => {
      let model = null;
      window.__battle.renderer.sceneProbe().traverse((o) => { if (!model && o.name === `enemy:${eid}`) model = o; });
      const meshes = [];
      model.traverse((o) => { if (o.isMesh) meshes.push({ name: o.name, outline: !!o.userData.isOutline, visible: o.visible }); });
      return { meshes, hats: (model.userData.attachments || []).length };
    }, id);
    check(info.meshes.some((m) => m.name === 'face' && m.visible && !m.outline), `${id} draws its face mesh, not outlined (${info.meshes.map((m) => m.name).join(', ')})`);
    if (stage === 'ev-halloween-1' && id === 'slime_green') console.log(`  info: event hat on this slime: ${info.hats}`);
    const pos = await page.evaluate((u) => { const e = window.__battle.sim.enemies.find((x) => x.uid === u); return e ? { x: e.x, y: e.y } : null; }, at.uid);
    await zoomOn(page, pos.x, pos.y, 0.2, VW < 600 ? 8 : 9);
    // the battle paused and the enemy's own per-frame animation off: each frame is posed by hand, the enemy turned to
    // face the camera (the forward that points straight down the screen)
    await page.evaluate(([eid, u]) => {
      const { ui, renderer, sim } = window.__battle;
      ui.paused = true;
      const e = sim.enemies.find((x) => x.uid === u);
      const s0 = renderer.worldToScreen(e.x, e.y, 0.2);
      let theta = 0;
      let bestDown = -Infinity;
      for (let a = 0; a < 360; a += 2) {
        const r = (a * Math.PI) / 180;
        const s1 = renderer.worldToScreen(e.x + Math.sin(r) * 0.3, e.y + Math.cos(r) * 0.3, 0.2);
        const down = (s1.clientY - s0.clientY) / (Math.hypot(s1.clientX - s0.clientX, s1.clientY - s0.clientY) || 1);
        if (down > bestDown) { bestDown = down; theta = r; }
      }
      renderer.sceneProbe().traverse((o) => {
        if (o.name !== `enemy:${eid}`) return;
        o.userData.__sgfAnimate ||= o.userData.animate;
        o.userData.animate = () => { o.rotation.y = theta; };
      });
    }, [id, at.uid]);
    for (const clip of CLIPS) {
      for (let k = 0; k < FRAMES; k++) {
        const t = (LENS[clip] || 1) * k / FRAMES;
        await page.evaluate(([eid, c, tt]) => {
          window.__battle.renderer.sceneProbe().traverse((o) => {
            if (o.name !== `enemy:${eid}`) return;
            const mixer = o.userData.mixer;
            const clipObj = mixer._actions.map((a) => a.getClip()).find((x) => x.name === c);
            if (!clipObj) return;
            mixer.stopAllAction();
            const a = mixer.clipAction(clipObj);
            a.reset();
            a.setEffectiveWeight(1);
            a.play();
            mixer.setTime(Math.min(tt, clipObj.duration - 1e-4));
          });
        }, [id, clip, t]);
        await settle(page, 60);
        const name = `${tag}-battle-${id}-${stage}-${quality}-${clip}-${k}-${VW}x${VH}`;
        await page.evaluate(() => document.querySelectorAll('.jn-toast').forEach((e) => e.remove()));
        await page.screenshot({ path: `${out}/${name}.png`, timeout: 240000 }); // (a phone-sized frame in software WebGL is slow)
        const sp = await page.evaluate((u) => {
          const e = window.__battle.sim.enemies.find((x) => x.uid === u);
          const s = window.__battle.renderer.worldToScreen(e.x, e.y, 0.2);
          return { x: Math.round(s.clientX * devicePixelRatio), y: Math.round(s.clientY * devicePixelRatio), dpr: devicePixelRatio };
        }, at.uid);
        writeFileSync(`${out}/${name}.json`, JSON.stringify(sp));
        record.push({ name, id, stage, quality, clip, t, size: `${VW}x${VH}` });
      }
    }
    await page.evaluate((eid) => {
      window.__battle.renderer.sceneProbe().traverse((o) => {
        if (o.name === `enemy:${eid}` && o.userData.__sgfAnimate) o.userData.animate = o.userData.__sgfAnimate;
      });
      window.__battle.ui.paused = false;
    }, id);
  }
  await context.close();
}

if (BATTLE) {
  const save = await server.ssrLoadModule('/src/systems/save.js');
  for (const size of SIZES) for (const stage of STAGES) for (const q of QUALITIES) await battleRun(save, size, stage, q);
} else {
  for (const size of SIZES) await harnessRun(size);
}
writeFileSync(`${out}/${tag}-faces.json`, JSON.stringify(record, null, 1));
await browser.close();
await server.close();
if (errors.length) console.log(errors.join('\n'));
if (failures.length) console.log(`FAILED:\n  ${failures.join('\n  ')}`);
console.log(`${record.length} frames -> ${out}`);
process.exit(errors.length || failures.length ? 1 : 0);
