// THROWAWAY: frame strips of Yoriko's marionette (removed before commit).
//   node e2e/_yoriko-strips.mjs --out <dir> --w 844 --h 390 --mode normal|fast|dies|calm|low
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const out = opt('out', '/tmp/ystrips');
const W = +opt('w', 844);
const H = +opt('h', 390);
const mode = opt('mode', 'normal');
const zoomSteps = +opt('zoom', 6);
mkdirSync(out, { recursive: true });
const log = (...a) => console.log(...a);

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/`;
const save = await server.ssrLoadModule('/src/systems/save.js');
const profile = save.createProfile();
profile.units.yoriko = { ...save.newUnitState(), level: 40, breakthrough: 3 };
profile.formation = { ...(profile.formation || {}), towers: [], hero: 'yoriko' };
profile.progress.stages['1-1'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
profile.settings = { ...profile.settings, autoStart: false, quality: mode === 'low' ? 'low' : 'high', camera: 'free', reduceMotion: mode === 'calm' };
const saveText = JSON.stringify(profile);

const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await context.addInitScript(([key, text]) => {
  if (!sessionStorage.getItem('ys-seeded')) {
    localStorage.setItem(key, text);
    sessionStorage.setItem('ys-seeded', '1');
  }
}, [save.SAVE_KEY, saveText]);
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || /\[companions\] disabled/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const settle = (ms = 250) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);
const doll = () => page.evaluate(() => window.__battle.renderer.companionsProbe().actors.find((a) => a.cid === 'doll') || null);
/** one frame: sim and renderer together (the battle is paused, so the rAF loop draws with dt 0 in between) */
const frame = (dt = 1 / 60) => page.evaluate((d) => { const b = window.__battle; b.sim.update(d); const ev = b.renderer.update(d); const r = b.renderer.companionsProbe().actors.find((a) => a.cid === 'doll') || null; if (r) { r.needles = b.sim.projectiles.filter((p) => p.ownerUid === 1).length; r.hit = (ev || []).some((e) => e.type === 'hit'); } return r; }, dt);
/** the canvas right after a frame (same task: no preserveDrawingBuffer needed) */
const snapNow = () => page.evaluate(() => { const b = window.__battle; b.renderer.update(0); const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return { url: c.toDataURL('image/png'), x: r.left, y: r.top, w: c.width, cw: r.width }; });

try {
  for (let tries = 0; ; tries++) {
    try {
      await page.goto(base, { waitUntil: 'load', timeout: 180000 });
      await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 180000 });
      await settle(1500);
      await page.evaluate(() => { const { store } = window.__sakura; store.profile.battleSaves = {}; store.commit('formation'); });
      await page.evaluate(() => { location.hash = '#/battle?stage=1-1&difficulty=normal'; });
      await page.waitForFunction(() => window.__battle?.ui?.act && window.__battle.sim.heroConfig?.unitId === 'yoriko', null, { timeout: 180000 });
      break;
    } catch (e) {
      if (tries >= 2) throw e;
      log('retry after', String(e.message).split('\n')[0]);
    }
  }
  await settle(800);
  const yori = await page.evaluate(() => {
    const { sim, ui, renderer } = window.__battle;
    sim.cash = 1e7;
    const barTop = ui.bar?.el?.getBoundingClientRect().top ?? innerHeight;
    for (let y = 1; y < sim.map.height - 1; y += 0.25) {
      for (let x = 2; x < sim.map.width - 2; x += 0.25) {
        if (!sim.canPlace('yoriko', x, y).ok) continue;
        const d = sim.placement.pathDistance(x, y);
        if (d < 1.4 || d > 1.9) continue;
        const s = renderer.worldToScreen(x, y, 0);
        if (!s.visible || s.clientY > barTop - 80 || s.clientY < 120 || s.clientX < 150 || s.clientX > innerWidth - 150) continue;
        const t = ui.act.place('yoriko', x, y);
        ui.placement?.cancel?.();
        if (t) return { uid: t.uid, x: t.x, y: t.y };
      }
    }
    return null;
  });
  log('yoriko', yori);
  await page.waitForFunction(() => window.__battle.renderer.companionsProbe().actors.some((a) => a.cid === 'doll'), null, { timeout: 60000 });
  await page.evaluate(() => { window.__battle.ui.paused = true; window.__battle.ui.select?.(null); });
  // one sturdy enemy on the road, frozen, about 2 tiles from her (in her range, past the doll's reach)
  const foe = await page.evaluate(([u, m]) => {
    const { sim } = window.__battle;
    const t = sim.getTower(u);
    let best = null;
    sim.pathData.forEach((p, pi) => p.points.forEach((pt, i) => {
      const d = Math.hypot(pt[0] - t.x, pt[1] - t.y);
      if (!best || d < best.d) best = { d, pi, dist: p.cum[i] };
    }));
    const e = sim.spawnEnemy('slime_green', { pathIndex: best.pi, dist: Math.max(0, best.dist - 1.1), hpMul: 400 });
    e.baseSpeed = 0;
    if (m === 'fast') t.eff.rate = 3.5;
    return { uid: e.uid, x: e.x, y: e.y, d: +Math.hypot(e.x - t.x, e.y - t.y).toFixed(2), range: t.eff.range, rate: t.eff.rate };
  }, [yori.uid, mode]);
  log('foe', foe);
  // zoom on the pair
  const mid = [(yori.x + foe.x) / 2, (yori.y + foe.y) / 2];
  const sc = await page.evaluate(([x, z]) => window.__battle.renderer.worldToScreen(x, z, 0), mid);
  await page.mouse.move(sc.clientX, sc.clientY);
  for (let i = 0; i < zoomSteps; i++) { await page.mouse.wheel(0, -240); await settle(60); }
  await settle(500);
  await frame(1 / 60);
  // a box around her, the doll and the enemy
  const pts = await page.evaluate(([y, f]) => [[y.x, y.y, 0], [y.x, y.y, 1.3], [f.x, f.y, 0], [f.x, f.y, 0.7]].map(([x, z, h]) => window.__battle.renderer.worldToScreen(x, z, h)), [yori, foe]);
  const pad = Math.round(W * 0.06);
  let x0 = Math.min(...pts.map((p) => p.clientX)) - pad;
  let x1 = Math.max(...pts.map((p) => p.clientX)) + pad;
  let y0 = Math.min(...pts.map((p) => p.clientY)) - pad;
  let y1 = Math.max(...pts.map((p) => p.clientY)) + pad;
  const minW = Math.round(W * 0.34);
  const minH = Math.round(H * 0.5);
  if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
  if (y1 - y0 < minH) { const c = (y0 + y1) / 2; y0 = c - minH / 2; y1 = c + minH / 2; }
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
  const clip = { x: Math.round(x0), y: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) };
  log('clip', clip);
  const shoot = async (name) => {
    const r = await snapNow();
    writeFileSync(`${out}/${name}.png`, Buffer.from(r.url.split(',')[1], 'base64'));
    writeFileSync(`${out}/${name}.json`, JSON.stringify({ clip, canvas: r }));
  };

  // wait until the doll is home, then until her next attack starts a sequence
  for (let i = 0; i < 600; i++) { const d = await frame(); if (d?.marionette?.stage === 'idle') break; }
  let d = null;
  for (let i = 0; i < 600; i++) { d = await frame(); if (d?.marionette?.stage === 'command') break; }
  log('start', JSON.stringify(d?.marionette));
  const want = ['command', 'extend', 'strike', 'reel', 'settle', 'rest'];
  const got = new Set();
  const rows = [];
  let killed = false;
  for (let i = 0; i < 400 && got.size < want.length; i++) {
    const m = d?.marionette;
    const st = m?.stage === 'idle' ? 'rest' : m?.stage;
    rows.push(`${i} ${st} u=${m?.u} off=${m?.offset} taut=${m?.taut} tilt=${m?.tilt} landed=${m?.landed} uid=${m?.uid}`);
    const mark = { command: 0.4, extend: 0.5, strike: 0, reel: 0.45, settle: 0.25, rest: 0 }[st];
    rows[rows.length - 1] += ` needles=${d?.needles} hit=${d?.hit}`;
    // the strike frame: the frame of the sim's hit (its slash flash), else the strike's first frame
    const strikeOk = st !== 'strike' || d?.hit || m.u > 0.6 || mode === 'dies';
    if (st && !got.has(st) && want.includes(st) && m.u >= mark && strikeOk) {
      got.add(st);
      await shoot(`${String(want.indexOf(st))}-${st}`);
    }
    if (mode === 'dies' && !killed && st === 'extend') {
      killed = true;
      await page.evaluate((u) => { const { sim } = window.__battle; const e = sim.enemies.find((x) => x.uid === u); if (e) sim._killEnemy(e, null); }, foe.uid);
      rows.push('  (target killed)');
    }
    d = await frame(1 / 120);
  }
  writeFileSync(`${out}/log.txt`, `${JSON.stringify({ yori, foe, clip, mode, W, H })}\n${rows.join('\n')}\nerrors: ${errors.join(' | ')}\n`);
  log(rows.join('\n'));
  log('captured', [...got].join(','), 'errors', errors.length, errors.slice(0, 3));
} catch (e) {
  log('crash', e);
} finally {
  await browser.close();
  await server.close();
}
