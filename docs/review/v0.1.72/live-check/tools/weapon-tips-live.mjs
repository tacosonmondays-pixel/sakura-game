// Weapon muzzles (docs/specs/weapon-muzzles.md): an armed girl's shots leave her weapon's tip, in a real battle.
//
// For each armed girl (src/models/weaponTip.js WEAPON_TIPS, the girls' own outfits), at each size: battle 1-1 with
// her in the loadout (a hero: as the battle's hero), placed beside the road near the middle of the screen, the
// camera zoomed in on her; a wave runs until her first shot, beam, chain or tracer, and the game is frozen on the
// next frame (the battle's own pause flag: the renderer keeps drawing that frame). Checks (skipped with --before):
//   1. her figure is her GLB and carries a weapon-tip anchor (userData.anchors.muzzle) on her prop;
//   2. a projectile of hers starts at that tip (attackFx's visual muzzle within 0.15 tiles of the anchor, read on the
//      frozen frame: the clip moves the tip a little between the spawn and the freeze);
//   3. no console errors.
// --shots <dir> saves <girl>-<W>x<H>-<tag>.jpg crops around her (the board: tools/art/weaponMuzzleBoard.mjs).
//
//   node e2e/weapon-muzzles.mjs [--shots /tmp/wm] [--tag after] [--girls aoi,shiro] [--sizes 1280x720,390x844]
//   node e2e/weapon-muzzles.mjs --root /tmp/before --before --shots /tmp/wm --tag before   # the old look (a worktree)
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a check fails.
import { createServer } from '/home/user/sakura-game/node_modules/vite/dist/node/index.js';
import { mkdirSync } from 'node:fs';
import { launchChromium } from '/home/user/sakura-game/e2e/browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const root = opt('root', process.cwd());
const before = args.includes('--before');
const shotsDir = opt('shots', null);
const tag = opt('tag', before ? 'before' : 'after');
const SIZES = String(opt('sizes', '1280x720,390x844')).split(',').map((s) => s.split('x').map(Number));
// the armed girls with a ranged attack (their own outfits); heroes need a battle each
const ALL = ['aoi', 'hana', 'yuki', 'akane', 'raika', 'miko', 'momo', 'sango', 'shiro', 'tenka', 'chigusa', 'iroha', 'yuzuha', 'umeko',
  'luna', 'nami', 'seiran', 'norika'];
const HEROES = new Set(['luna', 'nami', 'seiran', 'norika']);
const GIRLS = String(opt('girls', ALL.join(','))).split(',').filter(Boolean);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
  /Failed to load resource: net::ERR_/i,
];
const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  if (before) {
    log(`  info ${msg} (${cond ? 'yes' : 'no'})`);
    return cond;
  }
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

const server = await createServer({ root, server: { port: 0, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = "http://127.0.0.1:5199/?online=local&onboarding=0";
const save = await server.ssrLoadModule('/src/systems/save.js');
const { browser, label } = await launchChromium();
log(`browser: ${label} (root ${root})`);
const errors = [];

const settle = (page, ms = 250) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);

async function openBattle(towers, hero, [VW, VH]) {
  const profile = save.createProfile();
  for (const id of [...towers, hero].filter(Boolean)) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
  profile.formation = { ...(profile.formation || {}), towers, hero: hero || profile.formation?.hero || null };
  profile.progress.stages['1-1'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  profile.settings = { ...profile.settings, autoStart: false, quality: 'high', camera: 'free' };
  const context = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  await context.addInitScript(([key, text]) => {
    if (!sessionStorage.getItem('wm-e2e-seeded')) {
      localStorage.setItem(key, text);
      sessionStorage.setItem('wm-e2e-seeded', '1');
    }
    try { sessionStorage.setItem('sakura-beta-gift-shown', '1'); } catch { /* no storage */ }
  }, [save.SAVE_KEY, JSON.stringify(profile)]);
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(`[console] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await page.goto(base, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 90000 });
  await page.evaluate(() => {
    window.__sakura.store.profile.battleSaves = {};
    location.hash = '#/battle?stage=1-1&difficulty=normal';
  });
  const ok = await page.waitForFunction(() => window.__battle?.ui?.act, null, { timeout: 90000 }).then(() => true, () => false);
  if (ok) {
    // the freeze: after each sim step, a shot of the watched girl pauses the battle (the next frame is drawn, frozen)
    await page.evaluate(() => {
      const { sim, ui, renderer } = window.__battle;
      const step = sim.update.bind(sim);
      // the shot's frame is drawn with no time passing (a muzzle flash lives ~0.1 s: one slow software frame)
      const draw = renderer.update;
      renderer.update = (dt) => draw(window.__wm.hit ? 0 : dt);
      window.__wm = { uid: null, hit: null };
      // (1/60 s sub-steps, so the frozen frame shows the shot just leaving her, not a slow frame's 0.1-0.3 s later)
      const watch = () => {
        const w = window.__wm;
        if (w.uid == null || w.hit) return;
        const p = sim.projectiles.find((q) => q.ownerUid === w.uid && q.turretUid == null && (q.travel || 0) < 0.9);
        const ev = sim.events.find((e) => e.towerUid === w.uid && ['attack', 'beam', 'chain', 'pulse'].includes(e.type));
        const held = sim.getTower(w.uid);
        if (p || ev || held?.ch || held?.moon || held?.prismBeams?.length) {
          const tgt = p?.target?.uid ?? sim.events.find((e) => e.towerUid === w.uid && e.targetUid != null)?.targetUid ?? null;
          w.hit = { proj: p ? p.uid : null, ev: ev ? ev.type + ':' + (ev.kind || '') : held?.ch ? 'held' : 'other', target: tgt, hp0: tgt != null ? sim.enemies.find((e) => e.uid === tgt)?.hp : null };
          ui.paused = true;
        }
      };
      sim.update = (dt) => {
        let left = dt;
        let r;
        while (left > 1e-9 && !(window.__wm.uid != null && window.__wm.hit)) {
          const h = Math.min(left, 1 / 60);
          r = step(h);
          left -= h;
          watch();
          const w2 = window.__wm;
          if (w2.hit && w2.hit.target != null) {
            for (const e of sim.events) if (e.type === 'hit' && e.uid === w2.hit.target) w2.hit.landed = (w2.hit.landed || 0) + 1;
            if (w2.hit.proj != null && !sim.projectiles.some((q) => q.uid === w2.hit.proj) && w2.hit.gone == null) w2.hit.gone = sim.time;
            if (w2.hit.proj != null && w2.hit.gone == null) {
              const pr = window.__battle.renderer.attackFxProbe?.()?.blends?.find((q) => q.uid === w2.hit.proj);
              if (pr) w2.hit.fMax = Math.max(w2.hit.fMax || 0, pr.f || 0);
            }
          }
        }
        return r;
      };
      window.__wmStep = (dt) => { let left = dt; while (left > 1e-9) { const h = Math.min(left, 1 / 60); step(h); left -= h; const w2 = window.__wm; if (w2.hit && w2.hit.target != null) { for (const e of sim.events) if (e.type === 'hit' && e.uid === w2.hit.target) w2.hit.landed = (w2.hit.landed || 0) + 1; if (w2.hit.proj != null && w2.hit.gone == null && !sim.projectiles.some((q) => q.uid === w2.hit.proj)) w2.hit.gone = sim.time; } } };
    });
  }
  return { context, page, ok };
}

/** Places a girl 0.8-1.4 tiles from the road near the middle of the screen; returns her uid and spot. */
function place(page, id) {
  return page.evaluate((u) => {
    const { sim, ui, renderer } = window.__battle;
    sim.cash = 1e7;
    const barTop = ui.bar?.el?.getBoundingClientRect().top ?? innerHeight;
    let best = null;
    for (let y = 0.6; y < sim.map.height; y += 0.25) {
      for (let x = 0.6; x < sim.map.width; x += 0.25) {
        if (!sim.canPlace(u, x, y).ok) continue;
        const d = sim.placement.pathDistance(x, y);
        if (d < 0.8 || d > 1.4) continue;
        const s = renderer.worldToScreen(x, y, 0);
        if (!s.visible || s.clientY > barTop - 80 || s.clientY < 140) continue;
        const off = Math.hypot(s.clientX - innerWidth / 2, s.clientY - innerHeight * 0.5);
        if (!best || off < best.off) best = { x, y, off };
      }
    }
    if (!best) return null;
    const t = ui.act.place(u, best.x, best.y);
    ui.placement?.cancel?.();
    ui.select?.(null);
    return t ? { uid: t.uid, x: t.x, y: t.y } : null;
  }, id);
}

async function zoomAt(page, x, z, steps) {
  await page.evaluate(() => window.__battle.renderer.resetCamera?.());
  await settle(page, 300);
  for (let i = 0; i < steps; i++) {
    const s = await page.evaluate(([wx, wz]) => window.__battle.renderer.worldToScreen(wx, wz, 0.5), [x, z]);
    await page.mouse.move(s.clientX, s.clientY);
    await page.mouse.wheel(0, -240);
    await settle(page, 60);
  }
  await settle(page, 500);
}

async function boxAround(page, x, z, w, h) {
  const s = await page.evaluate(([wx, wz]) => window.__battle.renderer.worldToScreen(wx, wz, 0.55), [x, z]);
  const vp = page.viewportSize();
  w = Math.min(w, vp.width);
  h = Math.min(h, vp.height);
  const x0 = Math.max(0, Math.min(vp.width - w, Math.round(s.clientX - w / 2)));
  const y0 = Math.max(0, Math.min(vp.height - h, Math.round(s.clientY - h / 2)));
  return { x: x0, y: y0, width: w, height: h };
}

/** Her figure's state: GLB?, anchor (world), weapon kind. */
function figure(page, uid) {
  return page.evaluate((u) => {
    const m = window.__battle.renderer.towerModel(u);
    const ud = m?.userData || {};
    const a = ud.anchors?.muzzle;
    return { glb: !!ud.glb, kind: ud.weaponKind || null, anchor: a ? [a.x, a.y, a.z] : null, asset: ud.assetId || null };
  }, uid);
}

async function run(girl, size) {
  const [VW, VH] = size;
  const hero = HEROES.has(girl) ? girl : null;
  const { context, page, ok } = await openBattle(hero ? ['aoi'] : [girl], hero, size);
  try {
    if (!check(ok, `${girl} ${VW}x${VH}: battle 1-1 opens`)) return;
    await settle(page, 600);
    const at = await place(page, girl);
    if (!check(at != null, `${girl} ${VW}x${VH}: placed (${JSON.stringify(at)})`)) return;
    await page.waitForFunction((u) => window.__battle.renderer.towerModel(u)?.userData.glb, at.uid, { timeout: 60000 }).catch(() => null);
    // a socketed prop (Tenka's coilgun) loads after her body: give it a moment
    await settle(page, 800);
    const fig = await figure(page, at.uid);
    check(fig.glb, `${girl}: her GLB figure is drawn (${fig.asset})`);
    if (!before) check(!!fig.anchor, `${girl}: her figure carries a weapon-tip anchor (${fig.kind})`);
    await zoomAt(page, at.x, at.y, VW < VH ? 5 : 6);
    // a wave until her first shot (the freeze hook pauses the battle on it)
    await page.evaluate((u) => {
      window.__wm.uid = u;
      window.__wm.hit = null;
      const { ui } = window.__battle;
      ui.paused = false;
      ui.speed = 3;
      ui.startWave?.();
    }, at.uid);
    const fired = await page.waitForFunction(() => window.__wm.hit, null, { timeout: 120000, polling: 50 }).then(() => true, () => false);
    if (!check(fired, `${girl}: she fires within the wave`)) return;
    await settle(page, 120);
    const st = await page.evaluate((u) => {
      const w = window.__wm.hit;
      const m = window.__battle.renderer.towerModel(u);
      const a = m?.userData.anchors?.muzzle;
      const pr = window.__battle.renderer.attackFxProbe?.();
      const b = pr?.blends?.find((q) => q.uid === w.proj) || null;
      return { hit: w, anchor: a ? [a.x, a.y, a.z] : null, muzzle: b?.m || null, blended: b?.blended ?? null };
    }, at.uid);
    if (st.muzzle && st.anchor) {
      // attackFx muzzle (ground x, ground y, height) vs the anchor (world x, height, z), on the frozen frame
      const d = Math.hypot(st.muzzle[0] - st.anchor[0], st.muzzle[1] - st.anchor[2], st.muzzle[2] - st.anchor[1]);
      check(d < 0.15, `${girl}: her shot leaves the weapon tip (visual muzzle ${d.toFixed(3)} tiles from the anchor; ${st.hit.ev})`);
    } else {
      log(`  info ${girl}: ${st.hit.ev}${st.hit.proj == null ? ' (no projectile: a tracer / chain / beam / flash)' : ''}`);
    }
    if (args.includes('--mark')) {
      const mk = await page.evaluate((u) => {
        const { renderer } = window.__battle;
        const m = renderer.towerModel(u);
        const a = m?.userData.anchors?.muzzle;
        if (!a) return null;
        const s = renderer.worldToScreen(a.x, a.z, a.y);
        const d = document.createElement('div');
        d.style.cssText = `position:fixed;left:${s.clientX - 5}px;top:${s.clientY - 5}px;width:8px;height:8px;border:1px solid #f00;border-radius:50%;z-index:99999;pointer-events:none`;
        document.body.append(d);
        return { x: s.clientX, y: s.clientY };
      }, at.uid);
      log(`  info ${girl}: weapon-tip anchor on screen at ${JSON.stringify(mk)} (red ring in the marked still)`);
    }
    if (shotsDir) {
      const box = await boxAround(page, at.x, at.y, VW < VH ? 380 : 520, VW < VH ? 420 : 380);
      await page.screenshot({ path: `${shotsDir}/${girl}-${VW}x${VH}-${tag}.jpg`, type: 'jpeg', quality: 85, clip: box, timeout: 120000 })
        .catch((e) => log(`    (screenshot: ${String(e.message).split('\n')[0]})`));
    }
    // the shot flies on: the sim stepped by hand (the battle stays paused), up to 3 s
    const land = await page.evaluate(() => {
      const w = window.__wm.hit;
      const { sim } = window.__battle;
      for (let i = 0; i < 180 && !(w.proj != null ? w.gone != null : w.landed); i++) window.__wmStep(1 / 60);
      const e = sim.enemies.find((x) => x.uid === w.target);
      return { target: w.target, proj: w.proj, gone: w.gone != null, landed: w.landed || 0, hp0: w.hp0, hp1: e ? e.hp : 'dead', ev: w.ev, fMax: w.fMax ?? null };
    });
    check(land.target != null && land.landed > 0, `${girl}: the shot hits its target (enemy ${land.target}: ${land.landed} hit(s), hp ${typeof land.hp0 === 'number' ? land.hp0.toFixed(0) : land.hp0} -> ${typeof land.hp1 === 'number' ? land.hp1.toFixed(0) : land.hp1}${land.proj != null ? `, projectile ${land.proj} ${land.gone ? 'ended' : 'still flying'}` : ''})`);
  } finally {
    await context.close();
  }
}

try {
  for (const size of SIZES) {
    log(`\n--- ${size[0]}x${size[1]} ---`);
    for (const g of GIRLS) await run(g, size);
  }
  check(errors.length === 0, `no console errors${errors.length ? `:\n    ${errors.slice(0, 8).join('\n    ')}` : ''}`);
} catch (e) {
  failures.push(`crashed: ${e.stack || e.message}`);
  log(`  FAIL crashed: ${e.stack || e.message}`);
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  log(`\nFAILED (${failures.length}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
log(before ? '\nBEFORE CAPTURES DONE' : '\nALL WEAPON MUZZLE CHECKS PASSED');
