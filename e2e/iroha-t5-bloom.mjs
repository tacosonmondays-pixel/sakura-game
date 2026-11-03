// Impact-frame bloom probe for splash girls (Iroha's Kaleidoscope Burst T5 white-lilac bloom, docs/review/iroha-t5-bloom):
//   battle 1-1 normal, quality high, default camera, 844x390. The girl is placed near the road mid-screen and upgraded
//   through ui.act.upgrade to --tiers (default Iroha 2-0-5). A target plus --extra slime_green (hpMul 50, hp held full,
//   nearly still) are spawned on the road in her reach, then moved onto the spot of her first splash burst (Iroha's
//   bolts burst on her mirrors and at the end of a chain, not always on the walker they were fired at), so every
//   volley lands on one clump. renderer.update is wrapped: the render frame that drains a girl's explode events
//   freezes (sim paused, renderer dt 0) for a screenshot, then the battle runs on. Per captured frame it counts
//   near-white pixels (all channels > 225) in a 230x160 box centred on the clump.
//
//   node e2e/iroha-t5-bloom.mjs [--girl iroha] [--tiers 2,0,5] [--extra 5] [--frames 20] [--out dir] [--label name]
//                               [--box 230x160] [--debug]   (--debug: a full-screen shot of each frame too)
// Writes <out>/<label>-NN.png (box crops), <out>/<label>.json (per-frame counts). Playwright: e2e/browser.mjs.
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const girl = opt('girl', 'iroha');
const tiers = opt('tiers', '2,0,5').split(',').map(Number);
const extra = Number(opt('extra', '5'));
const frames = Number(opt('frames', '20'));
const outDir = opt('out', 'docs/review/iroha-t5-bloom/shots');
const label = opt('label', `${girl}-${tiers.join('')}`);
const [BW, BH] = opt('box', '230x160').split('x').map(Number);
const W = 844;
const H = 390;
mkdirSync(outDir, { recursive: true });
const log = (...a) => console.log(...a);

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const save = await server.ssrLoadModule('/src/systems/save.js');
const profile = save.createProfile();
profile.units[girl] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
profile.formation = { ...(profile.formation || {}), towers: [girl] };
profile.progress.stages['1-1'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
profile.settings = { ...profile.settings, autoStart: false, quality: 'high', reduceMotion: false };
const saveText = JSON.stringify(profile);

const { browser, label: bl } = await launchChromium();
log(`browser: ${bl}`);
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await context.addInitScript(([key, text]) => {
  if (!sessionStorage.getItem('bloom-e2e-seeded')) {
    localStorage.setItem(key, text);
    sessionStorage.setItem('bloom-e2e-seeded', '1');
  }
}, [save.SAVE_KEY, saveText]);
const page = await context.newPage();
page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));
const out = { girl, tiers, extra, viewport: `${W}x${H}`, quality: 'high', box: `${BW}x${BH}`, threshold: 'min RGB > 225', frames: [] };
let code = 0;
try {
  await page.goto(`${base}#/battle?stage=1-1&difficulty=normal`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__battle?.ui?.act && window.__battle.sim, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  const setup = await page.evaluate(async ([id, tr, nExtra]) => {
    const { sim, ui, renderer } = window.__battle;
    const { pointAt } = await import('/src/sim/path.js');
    sim.cash = 1e8;
    const barTop = ui.bar?.el?.getBoundingClientRect().top ?? innerHeight;
    let best = null;
    for (let y = 0.6; y < sim.map.height; y += 0.3) {
      for (let x = 0.6; x < sim.map.width; x += 0.3) {
        if (!sim.canPlace(id, x, y).ok) continue;
        const d = sim.placement.pathDistance(x, y);
        if (d > 1.6 || d < 0.8) continue;
        const s = renderer.worldToScreen(x, y, 0);
        if (!s.visible || s.clientY > barTop - 60 || s.clientY < 90 || s.clientX < 120 || s.clientX > innerWidth * 0.6) continue;
        const c = Math.hypot(s.clientX - innerWidth * 0.4, s.clientY - innerHeight * 0.45);
        if (!best || c < best.c) best = { x, y, c };
      }
    }
    if (!best) return { err: 'no spot' };
    const t = ui.act.place(id, best.x, best.y);
    if (!t) return { err: 'place failed' };
    for (let p = 0; p < 3; p++) for (let k = 0; k < tr[p]; k++) ui.act.upgrade(t.uid, p);
    const tw = sim.getTower(t.uid);
    // the road spot nearest her (in reach), off the first metre so a spawn there is on the board
    const path = sim.pathData[0];
    const pt = {};
    let bd = null;
    // her own body and the girl's lifted glow stay out of the box: the spot is ~2 tiles off her, in reach
    const reach = tw.stats?.range ?? 3;
    const want = Math.min(2.2, reach * 0.8);
    for (let d = 1; d < path.length - 1; d += 0.1) {
      pointAt(path, d, pt);
      const dist = Math.hypot(pt.x - tw.x, pt.y - tw.y);
      if (dist > reach * 0.85) continue;
      const s = renderer.worldToScreen(pt.x, pt.y, 0);
      if (!s.visible || s.clientY < 90 || s.clientY > barTop - 90 || s.clientX < 130 || s.clientX > innerWidth - 130) continue;
      if (!bd || Math.abs(dist - want) < Math.abs(bd.dist - want)) bd = { d, dist, x: pt.x, y: pt.y };
    }
    if (!bd) return { err: 'no road spot' };
    const mine = [];
    for (let i = 0; i <= nExtra; i++) {
      const e = sim.spawnEnemy('slime_green', { pathIndex: 0, dist: bd.d + (i - nExtra / 2) * 0.02, hpMul: 50, speedMul: 0.01 });
      if (e) mine.push(e.uid);
    }
    window.__bloom = { mine, frozen: false, hit: false, count: 0, explodes: 0, armed: false };

    const B = window.__bloom;
    const held = () => {
      for (const e of sim.enemies) if (B.mine.includes(e.uid)) e.hp = e.maxHp;
    };
    const su = sim.update.bind(sim);
    sim.update = (dt) => {
      if (B.frozen) return;
      su(dt);
      held();
    };
    const de = sim.drainEvents.bind(sim);
    sim.drainEvents = () => {
      const ev = de();
      if (!B.first) {
        const x = ev.find((e) => e.type === 'explode' && !e.volatile);
        if (x) B.first = { x: x.x, y: x.y, r: x.radius };
      }
      if (!B.frozen && B.armed) {
        const n = ev.filter((e) => e.type === 'explode' && !e.volatile).length;
        if (n) {
          B.last = ev.filter((e) => e.type === 'explode').map((e) => [+e.x.toFixed(2), +e.y.toFixed(2), e.radius]);
          B.hit = true;
          B.explodes = n;
        }
      }
      return ev;
    };
    const ru = renderer.update;
    renderer.update = (dt) => {
      if (B.frozen) return ru(0);
      const r = ru(dt);
      if (B.hit) {
        B.hit = false;
        B.frozen = true;
        B.count++;
      }
      return r;
    };
    return { tower: { x: tw.x, y: tw.y, tiers: tw.tiers || tw.look?.tiers, range: reach }, spot: bd, mine: mine.length };
  }, [girl, tiers, extra]);
  log('setup', JSON.stringify(setup));
  if (setup.err) throw new Error(setup.err);
  out.setup = setup;
  // her splash lands where her bolts burst (a mirror bounce, or the end of a chain): the clump moves onto the
  // first burst's spot, so every later volley lands on it
  await page.waitForFunction(() => window.__bloom.first, null, { timeout: 120000, polling: 50 });
  out.clump = await page.evaluate(async () => {
    const { sim } = window.__battle;
    const { pointAt } = await import('/src/sim/path.js');
    const { placeOnPath } = await import('/src/sim/enemies.js');
    const B = window.__bloom;
    const path = sim.pathData[0];
    const pt = {};
    let bd = null;
    for (let d = 0.5; d < path.length - 0.5; d += 0.05) {
      pointAt(path, d, pt);
      const q = Math.hypot(pt.x - B.first.x, pt.y - B.first.y);
      if (!bd || q < bd.q) bd = { d, q };
    }
    let i = 0;
    for (const e of sim.enemies) {
      if (!B.mine.includes(e.uid)) continue;
      e.dist = bd.d + (i++ - B.mine.length / 2) * 0.02;
      placeOnPath(e, path);
    }
    setTimeout(() => {
      B.armed = true;
    }, 2500);
    return { burst: B.first, roadDist: bd.d, offRoad: +bd.q.toFixed(2) };
  });
  log('clump', JSON.stringify(out.clump));
  let seen = 0;
  for (let k = 0; k < frames; k++) {
    await page.waitForFunction((n) => window.__bloom.count > n && window.__bloom.frozen, seen, { timeout: 120000, polling: 50 });
    seen = await page.evaluate(() => window.__bloom.count);
    await page.waitForTimeout(150); // a couple of dt-0 frames: the frozen frame is on screen
    const info = await page.evaluate(() => {
      const { sim, renderer } = window.__battle;
      const e = sim.enemies.find((q) => window.__bloom.mine.includes(q.uid));
      const s = e ? renderer.worldToScreen(e.x, e.y, 0) : null;
      return { at: window.__bloom.last, explodes: window.__bloom.explodes, sx: s?.clientX, sy: s?.clientY, alive: !!e };
    });
    if (!info.alive) throw new Error('target lost');
    if (args.includes('--debug')) {
      log(JSON.stringify(info));
      await page.screenshot({ path: `${outDir}/${label}-full-${k + 1}.png` });
    }
    const clip = { x: Math.round(info.sx - BW / 2), y: Math.round(info.sy - BH / 2), width: BW, height: BH };
    const buf = await page.screenshot({ type: 'png', clip });
    const name = `${label}-${String(k + 1).padStart(2, '0')}.png`;
    writeFileSync(`${outDir}/${name}`, buf);
    const white = await countWhite(buf);
    const rec = { frame: k + 1, explodes: info.explodes, at: info.at, nearWhite: white, shot: name };
    out.frames.push(rec);
    log(`frame ${k + 1}: ${info.explodes} explode(s), near-white ${white}`);
    await page.evaluate(() => {
      window.__bloom.frozen = false;
    });
  }
} catch (e) {
  log(`FAIL ${String(e.message).split('\n')[0]}`);
  code = 1;
} finally {
  await context.close();
  await browser.close();
  await server.close();
}

/** Near-white pixels (every channel > 225) in a PNG, decoded in the page. */
async function countWhite(buf) {
  return page.evaluate(async (b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const bm = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const c = new OffscreenCanvas(bm.width, bm.height);
    const g = c.getContext('2d');
    g.drawImage(bm, 0, 0);
    const d = g.getImageData(0, 0, bm.width, bm.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) n++;
    return n;
  }, buf.toString('base64'));
}
const w = out.frames.map((f) => f.nearWhite);
if (w.length) {
  const s = [...w].sort((a, b) => a - b);
  out.summary = { n: w.length, min: s[0], median: s[s.length >> 1], max: s[s.length - 1], mean: Math.round(w.reduce((a, b) => a + b, 0) / w.length) };
  log('summary', JSON.stringify(out.summary));
}
writeFileSync(`${outDir}/${label}.json`, JSON.stringify(out, null, 2));
process.exit(code);
