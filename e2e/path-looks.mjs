// Path looks (docs/specs/path-looks.md): renders every girl with a catalog row (Phase 1: Aoi, Akane, Luna; batch 1: Rei,
// Yuki, Momo, Kage, Nami, Hikari; outfit rows as `id@skinId`) in real battles, checks them, and writes the review board.
//
//   node e2e/path-looks.mjs [--shots /tmp/pathlooks] [--only close,muzzle,phone,perf,board] [--quality high]
//                           [--girls aoi,akane@akane_sentinel,...] [--frames 0] [--frameMode all|rotate]
//                           [--phoneSet phase1|batch1] [--hero nami] [--board mixed|allT5]
//   The round-2 board: --only close --quality medium --frameMode rotate; --only phone; --only phone --phoneSet batch1
//   --hero nami and again --hero hikari (phone-board-batch1-<hero>.png); --only board.
//
//   close   1280×720, free camera zoomed on one girl: every tier set (0-0-0, 3-0-0, 0-3-0, 0-0-3, 5-2-0, 2-0-5, 0-5-2)
//           drawn through the render-only override, plus idle / attack / walk frames of the T5 looks
//   muzzle  390×844 and 1280×720: a ray from the camera to each armed girl's weapon-tip muzzle against every piece
//           triangle (skinned merges posed as drawn), 30 frames a set with two attack swings: must never be blocked
//   phone   390×844 (DPR 2, the battle camera turned for portrait): girls placed and upgraded for real
//           (sim.upgradeTower), the hero levelled to 25, a wave running; crops at the phone's own pixel size
//   perf    low quality, 12 girls (mixed tiers, or all at T5) with the layer off vs on: draw calls, triangles, frame
//           time, the layer's own CPU time; gate: ≤ 16 extra draw calls (review r1 MEDIUM-1)
//   board   docs/art/previews/path-looks-board.jpg (≤ 300 KB) from the close and phone shots
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a check fails.
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { launchChromium } from './browser.mjs';
import { openApp, seedSave, openBattle } from './lib/battleKit.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const SHOTS = opt('shots', '/tmp/pathlooks');
const ONLY = opt('only', null);
const QUALITY = opt('quality', 'high');
const STAGE = opt('stage', '1-2');
mkdirSync(SHOTS, { recursive: true });
const BOARD = 'docs/art/previews/path-looks-board.jpg';
const CONFIGS = [[0, 0, 0], [3, 0, 0], [0, 3, 0], [0, 0, 3], [5, 2, 0], [2, 0, 5], [0, 5, 2]];
const GIRLS = opt('girls', 'aoi,akane,luna,rei,yuki,momo,kage,nami,hikari,akane@akane_sentinel').split(',');
const FRAMES = opt('frames', '1') !== '0';
/** 'all': idle / attack / walk at every T5 set; 'rotate': one T5 set a girl (5-2-0, 2-0-5, 0-5-2 in turn). */
const FRAME_MODE = opt('frameMode', 'all');
const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}
const want = (k) => !ONLY || ONLY.split(',').includes(k);
const cfgName = (c) => c.join('-');

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/`;
const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const errors = [];

const HEROES = new Set(['luna', 'nami', 'hikari']);
const TOWER_GIRLS = ['aoi', 'akane', 'rei', 'yuki', 'momo', 'kage'];

async function battlePage({ width, height, dpr = 1, quality = QUALITY, camera = 'free', stage = STAGE, hero = 'luna', skins = {} }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await openApp(page, base);
  await seedSave(page, { girls: [...TOWER_GIRLS, ...HEROES], hero, towers: TOWER_GIRLS, settings: { camera, quality, defaultSpeed: 1 } });
  if (Object.keys(skins).length) {
    // outfits (Sentinel Style is owned with the girl): worn in battle through profile.units[id].skin
    await page.evaluate((skins) => {
      const { store } = window.__sakura;
      for (const [id, sk] of Object.entries(skins)) store.profile.units[id].skin = sk;
      store.commit('e2e');
      store.saveNow?.();
    }, skins);
  }
  await openBattle(page, { stage });
  await page.waitForFunction(() => window.__battle?.renderer?.pathLooksProbe, null, { timeout: 30000 });
  return { page, context };
}

/** Waits until the girl's GLB is in, she is drawn at `tiers` (when given) and her pieces (if any) are socketed. */
async function waitLook(page, uid, n = null, ms = 20000, tiers = null) {
  await page.waitForFunction(([uid, n, tiers]) => {
    const p = window.__battle.renderer.pathLooksProbe(uid);
    if (!p || !p.glb) return false;
    if (tiers && p.tiers?.join('-') !== tiers.join('-')) return false;
    return n == null || p.pieces.length === n;
  }, [uid, n, tiers], { timeout: ms }).catch(() => null);
  // two more frames drawn after the pieces went on
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  return page.evaluate((uid) => window.__battle.renderer.pathLooksProbe(uid), uid);
}

async function screenOf(page, uid, h = 0.55) {
  return page.evaluate(([uid, h]) => {
    const t = window.__battle.sim.getTower(uid);
    const s = window.__battle.renderer.worldToScreen(t.x, t.y, h);
    return { x: s.clientX, y: s.clientY };
  }, [uid, h]);
}

async function zoomOn(page, uid, steps = 8) {
  // zoom about her, re-aiming at her each notch (the view clamps to the board, so she can drift)
  for (let i = 0; i < steps; i++) {
    const p = await screenOf(page, uid);
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(500);
}

const catalog = await server.ssrLoadModule('/src/render/pathLooks/catalog.js');
const rules = await server.ssrLoadModule('/src/render/pathLooks/rules.js');
/** How many pieces she should wear at these tiers (from the catalog). */
const expected = (unit, c) => {
  const [id, skin] = unit.split('@');
  const row = catalog.pathLooksFor(id, skin || null);
  const L = rules.pathLayers(c, { multi: HEROES.has(id) });
  return L.pieces.reduce((n, p) => n + (rules.stagePieces(row?.paths[p.path], p.tier)?.length || 0), 0);
};

// ---------------------------------------------------------------------------------------------
// close-ups
// ---------------------------------------------------------------------------------------------
if (want('close')) {
  log('\n== close-ups, 1280×720 ==');
  // one page per hero (a battle has one), towers share the first; an `id@skin` entry wears that outfit
  let cur = null;
  for (const unit of GIRLS) {
    const [id, skin] = unit.split('@');
    const hero = HEROES.has(id) ? id : 'luna';
    // a hero gets a page of her own (she cannot be sold, so she would stand beside the next girl's close-ups)
    const key = HEROES.has(id) ? `hero:${id}` : `towers|${skin || ''}`;
    if (!cur || cur.key !== key) {
      if (cur) await cur.context.close();
      cur = { key, ...(await battlePage({ width: 1280, height: 720, hero, skins: skin ? { [id]: skin } : {} })) };
    }
    const { page } = cur;
    // one girl on the board at a time, zoomed in
    const uid = await page.evaluate((unit) => {
      const { sim } = window.__battle;
      for (const t of [...sim.towers]) sim.sellTower?.(t.uid);
      return window.__ab.place(unit);
    }, id);
    if (!check(uid != null, `${unit} placed`)) continue;
    await waitLook(page, uid);
    const tag = unit.replace('@', '-');
    for (const c of CONFIGS) {
      await page.evaluate(([uid, c]) => window.__battle.renderer.setPathLookOverride(uid, c), [uid, c]);
      // the camera glides back to its fit between shots: zoom on her again every time
      await page.evaluate(() => window.__battle.renderer.resetCamera());
      await page.waitForTimeout(200);
      await zoomOn(page, uid);
      const pr = await waitLook(page, uid, expected(unit, c), 20000, c);
      check(pr.pieces.length === expected(unit, c), `${unit} ${cfgName(c)}: pieces ${pr.pieces.join(' ') || '—'} (${pr.meshes} meshes, ${pr.triangles} tris)`);
      const p = await screenOf(page, uid, 0.5);
      const file = `${SHOTS}/close-${tag}-${cfgName(c)}.png`;
      await page.screenshot({ path: file, clip: { x: Math.max(0, p.x - 170), y: Math.max(0, p.y - 230), width: 340, height: 360 }, timeout: 240000 });
    }
    // T5 frames: idle / attack / walk for each capstone set
    const T5SETS = [[5, 2, 0], [2, 0, 5], [0, 5, 2]];
    const gi = GIRLS.indexOf(unit);
    for (const c of FRAMES && !skin ? (FRAME_MODE === 'rotate' ? [T5SETS[gi % 3]] : T5SETS) : []) {
      await page.evaluate(([uid, c]) => window.__battle.renderer.setPathLookOverride(uid, c), [uid, c]);
      await page.evaluate(() => window.__battle.renderer.resetCamera());
      await page.waitForTimeout(200);
      await zoomOn(page, uid);
      await waitLook(page, uid, expected(unit, c), 20000, c);
      const p = await screenOf(page, uid, 0.5);
      const clip = { x: Math.max(0, p.x - 170), y: Math.max(0, p.y - 230), width: 340, height: 360 };
      for (const pose of ['idle', 'attack', 'walk']) {
        await page.evaluate(([uid, pose]) => window.__battle.renderer.setPathLookPose(uid, pose), [uid, pose]);
        await page.waitForTimeout(pose === 'attack' ? 180 : 600);
        const file = `${SHOTS}/frame-${tag}-${cfgName(c)}-${pose}.png`;
        await page.screenshot({ path: file, clip, timeout: 240000 });
      }
      await page.evaluate((uid) => window.__battle.renderer.setPathLookPose(uid, null), uid);
    }
    await page.evaluate((uid) => window.__battle.renderer.setPathLookOverride(uid, null), uid);
  }
  if (cur) await cur.context.close();
}

// ---------------------------------------------------------------------------------------------
// muzzle: no piece stands between the camera and an armed girl's weapon tip (idle + attack swings, both viewports)
// ---------------------------------------------------------------------------------------------
if (want('muzzle')) {
  const SETS = [[5, 2, 0], [2, 0, 5], [0, 5, 2], [4, 0, 0], [0, 4, 0], [0, 0, 4]];
  const HSETS = [[3, 3, 3], [4, 4, 4], [5, 5, 5]];
  const ids = GIRLS.map((u) => u.split('@')[0]).filter((id, i, a) => a.indexOf(id) === i);
  for (const [w, h, dpr] of [[390, 844, 2], [1280, 720, 1]]) {
    log(`\n== muzzle ray test, ${w}×${h} ==`);
    let cur = null;
    for (const id of ids) {
      const hero = HEROES.has(id) ? id : 'luna';
      if (!cur || cur.hero !== hero) {
        if (cur) await cur.context.close();
        cur = { hero, ...(await battlePage({ width: w, height: h, dpr, quality: 'low', camera: 'locked', hero })) };
      }
      const { page } = cur;
      const uid = await page.evaluate((id) => {
        const { sim } = window.__battle;
        for (const t of [...sim.towers]) sim.sellTower?.(t.uid);
        return window.__ab.place(id);
      }, id);
      if (uid == null) continue;
      await waitLook(page, uid);
      const hasMuzzle = await page.evaluate((uid) => window.__battle.renderer.pathLooksMuzzleBlocked(uid) !== null, uid);
      if (!hasMuzzle) {
        log(`  (${id}: no weapon-tip muzzle, skipped)`);
        continue;
      }
      let frames = 0;
      let blocked = 0;
      const why = {};
      for (const c of HEROES.has(id) ? HSETS : SETS) {
        await page.evaluate(([uid, c]) => window.__battle.renderer.setPathLookOverride(uid, c), [uid, c]);
        await waitLook(page, uid, expected(id, c), 20000, c);
        for (let f = 0; f < 30; f++) {
          if (f === 10 || f === 20) await page.evaluate((uid) => window.__battle.renderer.setPathLookPose(uid, 'attack'), uid);
          const b = await page.evaluate((uid) => new Promise((r) => requestAnimationFrame(() => r(window.__battle.renderer.pathLooksMuzzleBlocked(uid)))), uid);
          frames++;
          if (b) {
            blocked++;
            const k = `${cfgName(c)} ${b}`;
            why[k] = (why[k] || 0) + 1;
          }
        }
      }
      const detail = Object.entries(why).map(([k, n]) => `${k} ×${n}`).join(', ');
      check(blocked === 0, `${w}×${h} ${id}: muzzle clear in ${frames - blocked}/${frames} frames${detail ? ` (blocked: ${detail})` : ''}`);
    }
    if (cur) await cur.context.close();
  }
}

// ---------------------------------------------------------------------------------------------
// phone: a real battle, real upgrades
// ---------------------------------------------------------------------------------------------

// --phoneSet phase1 (7 Aoi + 7 Akane at the tier sets, Luna Lv 25) | batch1 (Rei, Yuki, Momo, Kage at 3-0-0, 0-3-0, 0-0-3
// and one T5 set each, the hero at Lv 25: --hero nami | hikari)
const PHONE_SET = opt('phoneSet', 'phase1');
const PHONE_HERO = opt('hero', PHONE_SET === 'phase1' ? 'luna' : 'nami');
const PHONE_PLAN = PHONE_SET === 'phase1'
  ? ['aoi', 'akane'].flatMap((unit) => CONFIGS.map((c) => ({ unit, c })))
  : ['rei', 'yuki', 'momo', 'kage'].flatMap((unit, i) => [[3, 0, 0], [0, 3, 0], [0, 0, 3], [[5, 2, 0], [2, 0, 5], [0, 5, 2]][i % 3]].map((c) => ({ unit, c })));

async function realBoard(page) {
  return page.evaluate(([plan, hero]) => {
    const { sim } = window.__battle;
    const ab = window.__ab;
    const out = [];
    for (const { unit, c } of plan) {
      const uid = ab.place(unit, { skip: out.length * 3 });
      if (uid == null) continue;
      // the higher path first, so the second path stays within the crosspath cap
      const order = [0, 1, 2].sort((a, b) => c[b] - c[a]);
      for (const p of order) ab.up(uid, p, c[p]);
      out.push({ unit, uid, want: c, got: [...sim.getTower(uid).tiers] });
    }
    const h = ab.place(hero, { skip: 2 });
    if (h != null) out.push({ unit: hero, uid: h, level: ab.heroTo(25), hero: true });
    return out;
  }, [PHONE_PLAN, PHONE_HERO]);
}

if (want('phone')) {
  log(`\n== phone, 390×844 DPR 2: real battle (${PHONE_SET}, hero ${PHONE_HERO}) ==`);
  const { page, context } = await battlePage({ width: 390, height: 844, dpr: 2, camera: 'locked', hero: PHONE_HERO });
  const board = await realBoard(page);
  for (const b of board) {
    if (b.hero) check(b.level >= 25, `${b.unit} levelled to ${b.level}`);
    else check(b.got.join('-') === b.want.join('-'), `${b.unit} bought to ${b.got.join('-')} (wanted ${b.want.join('-')})`);
  }
  await page.evaluate(() => window.__ab.keepWave(60));
  await page.waitForTimeout(15000);
  for (const b of board) await waitLook(page, b.uid, null, 8000);
  await page.waitForTimeout(1500);
  // where each girl stands on the phone (CSS px), then one full shot: the board crops her from it at the phone's pixels
  const spots = [];
  for (const b of board) {
    const p = await screenOf(page, b.uid, 0.42);
    const pr = await page.evaluate((uid) => window.__battle.renderer.pathLooksProbe(uid), b.uid);
    const name = b.hero ? 'Lv25' : b.got.join('-');
    spots.push({ unit: b.unit, label: name, x: p.x, y: p.y, pieces: pr?.pieces || [] });
    check(!!pr && pr.pieces.length === expected(b.unit, b.hero ? pr.tiers : b.got), `phone ${b.unit} ${name}: ${pr?.pieces.join(' ') || '—'}`);
  }
  const tag = PHONE_SET === 'phase1' ? '' : `-${PHONE_SET}-${PHONE_HERO}`;
  await page.screenshot({ path: `${SHOTS}/phone-board${tag}.png`, timeout: 240000 });
  writeFileSync(`${SHOTS}/phone-spots${tag}.json`, JSON.stringify({ dpr: 2, spots }, null, 1));
  await context.close();
  if (PHONE_SET === 'phase1') {
    log('\n== desktop 1280×720: the same real battle ==');
    const d = await battlePage({ width: 1280, height: 720, camera: 'locked' });
    await realBoard(d.page);
    await d.page.evaluate(() => window.__ab.keepWave(60));
    await d.page.waitForTimeout(25000);
    await d.page.screenshot({ path: `${SHOTS}/desktop-board.png`, timeout: 240000 });
    await d.context.close();
  }
}

// ---------------------------------------------------------------------------------------------
// perf: low quality, 12 girls at mixed tiers, looks on vs off
// ---------------------------------------------------------------------------------------------
if (want('perf')) {
  // --board mixed (12 girls at mixed tiers) | allT5 (the review's worst case: six Aoi and six Akane, every one at a T5 set)
  const BOARDSET = opt('board', 'mixed');
  log(`\n== perf: low quality, 12 girls, ${BOARDSET} ==`);
  const { page, context } = await battlePage({ width: 1280, height: 720, quality: 'low', camera: 'locked' });
  const MIX = BOARDSET === 'allT5'
    ? [[5, 2, 0], [5, 2, 0], [2, 0, 5], [2, 0, 5], [0, 5, 2], [0, 5, 2], [5, 2, 0], [5, 2, 0], [2, 0, 5], [2, 0, 5], [0, 5, 2], [0, 5, 2]]
    : [[5, 2, 0], [2, 0, 5], [0, 5, 2], [3, 0, 0], [0, 3, 0], [0, 0, 3], [4, 2, 0], [0, 4, 2], [2, 0, 4], [2, 1, 0], [0, 0, 0], [5, 0, 2]];
  const uids = await page.evaluate((MIX) => {
    const ab = window.__ab;
    const out = [];
    for (let i = 0; i < 12; i++) {
      const uid = ab.place(i % 2 ? 'akane' : 'aoi', { skip: i * 3 });
      if (uid == null) continue;
      out.push(uid);
      // tiers through the render override: the one-final-tier rule allows one T5 per path and girl, a look test wants more
      window.__battle.renderer.setPathLookOverride(uid, MIX[i]);
    }
    return out;
  }, MIX);
  check(uids.length === 12, `12 girls placed (${uids.length})`);
  await page.evaluate(() => window.__ab.keepWave(60));
  for (const u of uids) await waitLook(page, u, null, 8000);
  await page.waitForTimeout(2500);
  // a still battle (the sim paused, the frame still draws and the girls still animate): the rounds compare like with like
  await page.evaluate(() => {
    window.__ab.hold(true);
    // time the layer's own per-frame work (update per girl + draw per girl), summed per frame
    const pl = window.__battle.renderer.pathLooks;
    window.__plMs = 0;
    for (const k of ['update', 'draw']) {
      const fn = pl[k].bind(pl);
      pl[k] = (...a) => {
        const t0 = performance.now();
        const r = fn(...a);
        window.__plMs += performance.now() - t0;
        return r;
      };
    }
  });
  const measure = (frames = 90) => page.evaluate((frames) => new Promise((res) => {
    const r = window.__battle.renderer;
    const ds = [];
    const calls = [];
    const tris = [];
    const pl = [];
    let last = performance.now();
    let n = 0;
    window.__plMs = 0;
    function f() {
      const now = performance.now();
      ds.push(now - last);
      last = now;
      pl.push(window.__plMs);
      window.__plMs = 0;
      const i = r.info;
      calls.push(i.calls);
      tris.push(i.triangles);
      if (++n < frames) requestAnimationFrame(f);
      else {
        const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
        const p95 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)];
        const skip = (a) => a.slice(5);
        res({ frameMs: +med(skip(ds)).toFixed(1), frameP95: +p95(skip(ds)).toFixed(1), calls: med(calls), triangles: med(tris), layerMs: +med(skip(pl)).toFixed(3), layerP95: +p95(skip(pl)).toFixed(3) });
      }
    }
    requestAnimationFrame(f);
  }), frames);
  const setOn = (on) => page.evaluate(([on, uids, MIX]) => {
    window.__battle.renderer.pathLooks.setEnabled(on);
    uids.forEach((u, i) => window.__battle.renderer.setPathLookOverride(u, MIX[i]));
  }, [on, uids, MIX]);
  const rounds = { on: [], off: [] };
  let probe = null;
  for (const on of [false, true, false, true, false, true]) {
    await setOn(on);
    if (on) for (const u of uids) await waitLook(page, u, null, 8000);
    await page.waitForTimeout(600);
    const m = await measure();
    rounds[on ? 'on' : 'off'].push(m);
    if (on && !probe) probe = await page.evaluate((uids) => uids.map((u) => window.__battle.renderer.pathLooksProbe(u)), uids);
    log(`  looks ${on ? 'on ' : 'off'}: ${m.calls} calls, ${m.triangles} tris, frame median ${m.frameMs} ms (p95 ${m.frameP95}), layer ${m.layerMs} ms/frame (p95 ${m.layerP95})`);
  }
  const avg = (a, k) => +(a.reduce((s, x) => s + x[k], 0) / a.length).toFixed(2);
  const on = { calls: rounds.on[0].calls, triangles: rounds.on[0].triangles, frameMs: avg(rounds.on, 'frameMs'), layerMs: avg(rounds.on, 'layerMs') };
  const off = { calls: rounds.off[0].calls, triangles: rounds.off[0].triangles, frameMs: avg(rounds.off, 'frameMs'), layerMs: avg(rounds.off, 'layerMs') };
  const pieceMeshes = probe.reduce((s, p) => s + (p?.meshes || 0), 0);
  const pieceTris = probe.reduce((s, p) => s + (p?.triangles || 0), 0);
  const res = { quality: 'low', girls: uids.length, mix: MIX.map(cfgName), on, off, rounds, pieceMeshes, pieceTris, deltaCalls: on.calls - off.calls, deltaTris: on.triangles - off.triangles };
  log(`  mean: on ${on.frameMs} ms vs off ${off.frameMs} ms a frame (SwiftShader: compare, do not read as a phone); layer ${on.layerMs} ms/frame`);
  log(`  pieces: ${pieceMeshes} meshes, ${pieceTris} triangles (12 girls); +${res.deltaCalls} calls, +${res.deltaTris} triangles`);
  writeFileSync(`${SHOTS}/perf-${BOARDSET}.json`, JSON.stringify(res, null, 2));
  check(res.deltaCalls <= 16, `low, ${BOARDSET}: path looks add ≤ 16 draw calls for 12 girls (${res.deltaCalls}; review r1 gate)`);
  check(pieceTris <= 12 * 1400, `low: path looks add ≤ 1,400 triangles a girl (${Math.round(pieceTris / 12)})`);
  check(on.layerMs < 1, `low: the layer's own CPU work stays under 1 ms a frame for 12 girls (${on.layerMs} ms)`);
  await context.close();
}

// ---------------------------------------------------------------------------------------------
// the board JPEG
// ---------------------------------------------------------------------------------------------
if (want('board')) {
  log('\n== board ==');
  const fromDisk = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
  const tryRead = (f) => { try { return fromDisk(f); } catch { return null; } };
  const readSpots = (tag) => { try { return JSON.parse(readFileSync(`${SHOTS}/phone-spots${tag}.json`, 'utf8')); } catch { return { dpr: 2, spots: [] }; } };
  const phones = [
    { tag: '', title: 'phase 1: 7 Aoi + 7 Akane, Luna Lv 25' },
    { tag: '-batch1-nami', title: 'batch 1: Rei, Yuki, Momo, Kage; Nami Lv 25' },
    { tag: '-batch1-hikari', title: 'batch 1: the same girls; Hikari Lv 25' },
  ].map((p) => ({ ...p, img: tryRead(`${SHOTS}/phone-board${p.tag}.png`), spots: readSpots(p.tag) })).filter((p) => p.img);
  const T5SETS = [[5, 2, 0], [2, 0, 5], [0, 5, 2]];
  const NAMES = {
    aoi: 'Aoi — 1 Piercing · 2 Volley · 3 Sky Hunter', akane: 'Akane — 1 Big Bang · 2 Wildfire · 3 Rockets (T3 enlarged)',
    'akane@akane_sentinel': 'Sentinel Akane (outfit row: no witch hat)', luna: 'Luna (hero) — 1 Lances · 2 Gravity · 3 Court',
    rei: 'Rei — 1 Whirlwind · 2 Duelist · 3 Counter', yuki: 'Yuki — 1 Deep Freeze · 2 Frostbite · 3 Permafrost',
    momo: 'Momo — 1 Fan Club · 2 Merch · 3 Encore', kage: 'Kage — 1 Steel · 2 Shadow Mark · 3 Kunai',
    nami: 'Nami (hero) — 1 Frostbrand · 2 Undertow · 3 Harbor', hikari: 'Hikari (hero) — 1 Radiant · 2 Sanctuary · 3 Lightbringer',
  };
  const rows = GIRLS.map((unit, gi) => {
    const tag = unit.replace('@', '-');
    const id = unit.split('@')[0];
    const fset = T5SETS[gi % 3];
    let crops = [];
    if (!unit.includes('@')) {
      for (const p of phones) for (const s of p.spots.spots) if (s.unit === id) crops.push({ phone: phones.indexOf(p), s });
    }
    crops = crops.slice(0, 4);
    return {
      unit, title: NAMES[unit] || unit,
      tiles: CONFIGS.map((c) => ({ label: cfgName(c), src: tryRead(`${SHOTS}/close-${tag}-${cfgName(c)}.png`) })),
      frames: ['idle', 'attack', 'walk'].map((pose) => ({ label: `${cfgName(fset)} ${pose}`, src: tryRead(`${SHOTS}/frame-${tag}-${cfgName(fset)}-${pose}.png`) })),
      crops,
    };
  });
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await context.newPage();
  await page.goto(`${base}?onboarding=0#/`, { waitUntil: 'load' });
  const jpeg = await page.evaluate(async ({ rows, phones }) => {
    const load = (src) => new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    const pad = 12;
    const tw = 170; // close-up tile: the 340×360 shot at half size
    const th = 180;
    const fw = 136; // T5 frames: the girl's middle 240×255 of the shot
    const fh = 145;
    const pw = 100; // phone crops: 80×96 CSS px of the 390×844 screen (160×192 device px) at 5/8
    const ph = 120;
    const rowH = 30 + th + 24;
    const H = 100 + rows.length * rowH;
    const imgs = [];
    for (const p of phones) imgs.push(await load(p.img));
    const phoneH = Math.floor((H - 110) / Math.max(1, phones.length)) - 26;
    const phoneW = imgs[0] ? Math.round((imgs[0].width / imgs[0].height) * phoneH) : 0;
    const leftW = pad + 7 * (tw + 6) + 10 + 3 * (fw + 6) + 10 + 4 * (pw + 6) + pad;
    const W = leftW + phoneW + pad;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#1d1a2b';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    g.font = 'bold 34px sans-serif';
    g.fillText('Path looks — round 2: Phase 1 fixes + rollout batch 1', pad, 42);
    g.font = '17px sans-serif';
    g.fillStyle = '#cfc8e8';
    g.fillText('Display only (sim id unchanged). Per girl: close-ups at each tier set (1280×720, free camera, medium, render-only override) · one T5 set idle / attack / walk · crops from real 390×844 battles (DPR 2).', pad, 68);
    g.fillText('Round 2: one merged skinned mesh a girl (≤ 2 draw calls), no gauge at 0-0-0, one shared colour set with the upgrade drawer, Akane T3 enlarged, Sentinel Akane outfit row.', pad, 90);
    const key = [['path 1', '#ff6b8b'], ['path 2', '#4cc9f0'], ['path 3', '#ffd43b']];
    let kx = leftW - 340;
    for (const [l, c] of key) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(kx, 34, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.font = '17px sans-serif';
      g.fillText(l, kx + 14, 40);
      kx += 110;
    }
    let y = 104;
    for (const r of rows) {
      g.fillStyle = '#ffe9a8';
      g.font = 'bold 21px sans-serif';
      g.fillText(r.title, pad, y + 21);
      y += 30;
      let x = pad;
      for (const t of r.tiles) {
        const im = await load(t.src);
        if (im) g.drawImage(im, x, y, tw, th);
        g.fillStyle = '#fff';
        g.font = 'bold 15px sans-serif';
        g.fillText(t.label, x + 4, y + th + 17);
        x += tw + 6;
      }
      x += 10;
      for (const t of r.frames) {
        const im = await load(t.src);
        if (im) g.drawImage(im, 50, 50, 240, 255, x, y + (th - fh) / 2, fw, fh);
        g.fillStyle = '#ddd';
        g.font = '13px sans-serif';
        if (im) g.fillText(t.label, x + 2, y + th + 17);
        x += fw + 6;
      }
      x += 10;
      for (const c of r.crops) {
        const im = imgs[c.phone];
        const dpr = phones[c.phone].spots.dpr || 2;
        if (im) g.drawImage(im, c.s.x * dpr - 80, c.s.y * dpr - 112, 160, 192, x, y + (th - ph) / 2, pw, ph);
        g.fillStyle = '#ddd';
        g.font = '13px sans-serif';
        g.fillText(`phone ${c.s.label}`, x + 2, y + th + 17);
        x += pw + 6;
      }
      y += th + 24;
    }
    let py = 104;
    phones.forEach((p, i) => {
      if (!imgs[i]) return;
      g.drawImage(imgs[i], leftW, py, phoneW, phoneH);
      g.fillStyle = '#cfc8e8';
      g.font = '15px sans-serif';
      g.fillText(`390×844 real battle — ${p.title}`, leftW, py + phoneH + 18);
      py += phoneH + 26;
    });
    // the best quality that fits 300 KB: full size first, then smaller
    for (const sc of [1, 0.85, 0.72, 0.62, 0.55, 0.48]) {
      const out = document.createElement('canvas');
      out.width = Math.round(W * sc);
      out.height = Math.round(H * sc);
      const og = out.getContext('2d');
      og.imageSmoothingQuality = 'high';
      og.drawImage(cv, 0, 0, out.width, out.height);
      for (let q = 0.86; q >= 0.62; q -= 0.04) {
        const url = out.toDataURL('image/jpeg', q);
        const bytes = Math.round((url.length - 23) * 0.75);
        if (bytes <= 295 * 1024) return { url, q, bytes, W: out.width, H: out.height };
      }
    }
    return { url: cv.toDataURL('image/jpeg', 0.5), q: 0.5, W, H };
  }, { rows, phones });
  mkdirSync('docs/art/previews', { recursive: true });
  writeFileSync(BOARD, Buffer.from(jpeg.url.split(',')[1], 'base64'));
  const size = statSync(BOARD).size;
  check(size <= 300 * 1024, `${BOARD}: ${jpeg.W}×${jpeg.H}, q ${jpeg.q.toFixed(2)}, ${Math.round(size / 1024)} KB (≤ 300 KB)`);
  await context.close();
}

check(!errors.length, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
await server.close();
log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
