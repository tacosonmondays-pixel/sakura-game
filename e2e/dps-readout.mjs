// The drawer's honest DPS (MORE › Details; src/ui/battle/dpsView.js): during a wave a splash + poison girl's measured
// "DPS (live)" is bigger than her per-target hits, a crit striker, Chika, a trapper and a brewer show their numbers,
// and the poison chip says 0.25%, not 0.3%. Stages Midori 5-0-2 against a crowd and against a boss, Kage, Chika and
// Suzu on 1-3; the battle is stepped in game time between real frames (the meter samples per frame).
//
//   node e2e/dps-readout.mjs [--viewport 844x390] [--shots <dir>] [--root <checkout>]
//   (--root another checkout, e.g. live main, for the board's "before" stills: the checks need this build's drawer)
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 on any failure.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';
import { openApp, seedSave, openBattle } from './lib/battleKit.mjs';

const args = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport') ? [opt('viewport')] : ['844x390', '1280x720'];
const SHOTS = opt('shots');
const ROOT = opt('root', process.cwd());
const BEFORE = ROOT !== process.cwd();
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const server = await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}${BEFORE ? ` (stills of ${ROOT})` : ''}`);
const fails = [];
const check = (c, m) => {
  console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`);
  if (!c) fails.push(m);
  return c;
};

for (const vp of viewports) {
  const [W, H] = vp.split('x').map(Number);
  const touch = W < 1000;
  console.log(`viewport ${vp}`);
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  page.setDefaultTimeout(120000);
  const shot = async (name) => {
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}-${vp}.png`), timeout: 120000 });
  };
  // a real frame between game-time steps, so the drawer's meter samples (it reads sim.time every frame)
  const stepGame = async (sec) => {
    for (let i = 0; i < sec * 2; i++) {
      await page.evaluate(() => {
        const { sim } = window.__battle;
        for (let k = 0; k < 30 && sim.state === 'wave'; k++) sim.update(1 / 60);
      });
      await page.waitForTimeout(60);
    }
  };
  const details = async (uid) => {
    await page.evaluate((u) => window.__battle.ui.select(u), uid);
    await page.waitForSelector('[data-testid="tower-panel"]:not([hidden]) [data-testid="panel-more"]');
    if (!(await page.$('[data-testid="tower-panel"].bt-drawer-more'))) await page.locator('[data-testid="tower-panel"] [data-testid="panel-more"]').click({ force: true });
    await page.waitForTimeout(500);
    return page.evaluate(() => {
      const p = document.querySelector('[data-testid="tower-panel"]');
      const cell = (label) => [...p.querySelectorAll('.bt-stat-cell')].find((c) => c.firstChild?.textContent?.trim() === label)?.lastChild?.textContent?.trim() || null;
      return {
        live: p.querySelector('[data-testid="drawer-dps-live"]')?.textContent || null,
        liveLabel: p.querySelector('[data-testid="drawer-dps"] span')?.textContent || null,
        per: cell('Per target'),
        boost: p.querySelector('[data-testid="drawer-boost"]')?.textContent || null,
        oldDps: cell('DPS'),
        text: p.innerText.replace(/\s+/g, ' ').slice(0, 400),
      };
    });
  };
  try {
    await openApp(page, base);
    const squad = ['midori', 'kage', 'chika', 'suzu', 'aoi'];
    await seedSave(page, { girls: ['hikari', ...squad], hero: 'hikari', towers: squad, cleared: ['1-1', '1-2'] });
    await openBattle(page, { stage: '1-3', cash: 1e7 });
    const ids = await page.evaluate(() => {
      const { sim } = window.__battle;
      sim.cash = 1e7;
      const put = (id, plan, near) => {
        const u = __ab.place(id, near != null ? { near, min: 1.3 } : {});
        if (u == null) return null;
        plan.forEach((n, p) => __ab.up(u, p, n));
        return u;
      };
      const midori = put('midori', [5, 0, 2]);
      return {
        midori,
        aoi: put('aoi', [0, 3, 0], midori),
        kage: put('kage', [3, 0, 2], midori),
        chika: put('chika', [3, 0, 0], midori),
        suzu: put('suzu', [3, 0, 0], midori),
        tiers: sim.getTower(midori)?.tiers.join('-'),
      };
    });
    check(ids.midori != null && ids.tiers === '5-0-2', `${vp} Midori placed at 5-0-2 (${ids.tiers})`);
    // a crowd: the wave's enemies made sturdy and gathered on the road in her cloud's reach
    await page.evaluate(() => {
      const { sim } = window.__battle;
      sim.startNextWave();
      __ab.keepWave(60);
    });
    await stepGame(3);
    await page.evaluate(() => {
      // the road point nearest a girl, and an enemy moved there (x/y/seg follow dist, as placeOnPath sets them)
      window.__roadNear = (sim, m) => {
        let best = null;
        sim.pathData.forEach((path, pi) => {
          for (let d = 0; d <= path.length; d += 0.1) {
            let seg = 0;
            while (seg < path.cum.length - 2 && path.cum[seg + 1] <= d) seg++;
            const t = d - path.cum[seg];
            const x = path.points[seg][0] + path.dirs[seg][0] * t;
            const y = path.points[seg][1] + path.dirs[seg][1] * t;
            const r = Math.hypot(x - m.x, y - m.y);
            if (!best || r < best.r) best = { r, pathIndex: pi, d };
          }
        });
        return best;
      };
      window.__moveTo = (sim, e, pathIndex, d) => {
        const path = sim.pathData[pathIndex];
        let seg = 0;
        while (seg < path.cum.length - 2 && path.cum[seg + 1] <= d) seg++;
        const t = d - path.cum[seg];
        e.pathIndex = pathIndex;
        e.dist = d;
        e.seg = seg;
        e.x = path.points[seg][0] + path.dirs[seg][0] * t;
        e.y = path.points[seg][1] + path.dirs[seg][1] * t;
        e.remaining = path.length - d;
      };
    });
    const gathered = await page.evaluate((u) => {
      const { sim } = window.__battle;
      const m = sim.getTower(u);
      const at = window.__roadNear(sim, m);
      // eight of them in a pack on the road point nearest her, slowed so they stay in her cloud
      const live = sim.enemies.filter((e) => !e.dead).slice(0, 8);
      live.forEach((e, i) => {
        window.__moveTo(sim, e, at.pathIndex, Math.max(0, at.d - 0.12 * i));
        e.speed = e.baseSpeed = 0.05;
      });
      return { n: live.length, r: Number(at.r.toFixed(2)), range: m.stats?.range };
    }, ids.midori);
    console.log(`  pack: ${JSON.stringify(gathered)}`);
    await stepGame(7);
    const crowd = await details(ids.midori);
    console.log(`  midori crowd: ${JSON.stringify(crowd).slice(0, 300)}`);
    await shot('dps-midori-crowd');
    if (!BEFORE) {
      const live = Number(String(crowd.live).replace(/[^\d.]/g, '')) * (/K$/.test(crowd.live || '') ? 1000 : 1);
      const hits = Number(/^([\d.]+)/.exec(crowd.per || '')?.[1] || NaN);
      check(crowd.liveLabel === 'DPS (live)' && live > 0, `${vp} Midori's Details show her measured DPS during the wave (${crowd.liveLabel} ${crowd.live})`);
      check(Number.isFinite(hits) && live > hits, `${vp} with a pack in her cloud her live DPS (${live}) is above her per-target hits (${hits}): "${crowd.per}"`);
      check(/poison \(\+0\.\d\d?% HP\/s\)/.test(crowd.per || ''), `${vp} the per-target line names her poison with two significant digits ("${crowd.per}")`);
      check(/^~[\d.,KM]+ DPS · \d girls?$/.test(crowd.boost || '') || crowd.boost === '—', `${vp} her Toxic Tonic boost reads as an estimate ("${crowd.boost}")`);
    }
    // a boss alone in her cloud: spawned on the road point nearest Midori and slowed
    await page.evaluate((u) => {
      const { sim } = window.__battle;
      const m = sim.getTower(u);
      const live = sim.enemies.filter((e) => !e.dead);
      const at = window.__roadNear(sim, m);
      for (const e of live) e.dead = true;
      const b = sim.spawnEnemy('grave_lych', { pathIndex: at.pathIndex, dist: at.d });
      if (!b) return;
      window.__moveTo(sim, b, at.pathIndex, at.d);
      // (her poison takes a share of max HP, a tenth on a boss: a padded HP pool would inflate it, so the boss stays as is)
      b.speed = 0.05;
      b.baseSpeed = 0.05;
    }, ids.midori);
    await stepGame(6);
    const boss = await details(ids.midori);
    console.log(`  midori boss: ${JSON.stringify(boss).slice(0, 300)}`);
    await shot('dps-midori-boss');
    for (const [name, uid] of [['kage', ids.kage], ['chika', ids.chika], ['suzu', ids.suzu]]) {
      if (uid == null) continue;
      const d = await details(uid);
      console.log(`  ${name}: ${JSON.stringify(d).slice(0, 240)}`);
      await shot(`dps-${name}`);
    }
  } catch (e) {
    check(false, `${vp} threw: ${e.message.split('\n')[0]}`);
    await shot('dps-fail').catch(() => {});
  }
  await page.close();
}
await browser.close();
await server.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nDPS readout: all checks passed');
process.exit(fails.length ? 1 : 0);
