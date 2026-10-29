// The drawer's honest DPS (MORE › Details; src/ui/battle/dpsView.js), for the whole roster.
//   1. Showcase on 1-3: Midori 5-0-2 against a pack and against a boss (her measured "DPS (live)" beats her per-target
//      hits; the poison share reads 0.25%, not 0.3%; her Toxic Tonic boost reads as an estimate), then Kage (crits),
//      Chika (drones), Suzu (traps), Shiro (pierce), Miko (aura) and the hero.
//      Both lines: "DPS (live)" (the last 5 s) and "DPS (avg)" (since she was placed, over her wave time): Avg is
//      non-zero during a wave, never NaN, and steadier than Live (read a few times while the pack goes and comes
//      back), each with a tooltip and an aria text, and the two cells share one row (the drawer is no taller).
//   2. Roster: every girl and the hero, 3-0-0, each with her own pack: a sensible non-zero DPS during a wave (a girl
//      who deals no damage reads "—" or 0), and no NaN / undefined anywhere in her drawer.
// Packs are plain bears of ~3000 HP (a sturdy late-wave foe), kept alive by refilling their HP each game step (max HP
// untouched, so a %-of-max-HP poison stays honest) and slowed so they stay in reach. The battle is stepped in game time between real frames
// (the meter samples per frame).
//
//   node e2e/dps-readout.mjs [--viewport 844x390] [--shots <dir>] [--root <checkout>] [--skip-roster]
//   (--root another checkout, e.g. live main, for the board's "before" stills: the checks need this build's drawer)
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 on any failure.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';
import { openApp, seedSave, openBattle } from './lib/battleKit.mjs';
import { towers, heroes } from '../src/data/units.js';

const args = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport') ? [opt('viewport')] : ['844x390', '1280x720'];
const SHOTS = opt('shots');
const ROOT = opt('root', process.cwd());
const BEFORE = ROOT !== process.cwd();
const ROSTER = !BEFORE && !args.includes('--skip-roster');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const GIRLS = towers().map((u) => u.id);
const HERO = 'hikari';
const ALL = [...GIRLS, ...heroes().map((u) => u.id)];

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
/** "1.2K" / "57.6k" / "250" / "—" -> a number (null for a dash or nothing). */
const num = (s) => {
  const m = /^~?([\d.,]+)\s*([kKmM]?)/.exec(String(s ?? '').trim());
  if (!m) return null;
  return Number(m[1].replace(/,/g, '')) * ({ k: 1e3, m: 1e6 }[m[2].toLowerCase()] || 1);
};

/** window.__dps: road and pack staging (the road point nearest a girl; enemies moved there, kept alive and slow). */
async function installStaging(page) {
  await page.evaluate(() => {
    const { sim } = window.__battle;
    const segAt = (path, d) => {
      let seg = 0;
      while (seg < path.cum.length - 2 && path.cum[seg + 1] <= d) seg++;
      return seg;
    };
    const moveTo = (e, pathIndex, d) => {
      const path = sim.pathData[pathIndex];
      const seg = segAt(path, d);
      const t = d - path.cum[seg];
      e.pathIndex = pathIndex;
      e.dist = d;
      e.seg = seg;
      e.x = path.points[seg][0] + path.dirs[seg][0] * t;
      e.y = path.points[seg][1] + path.dirs[seg][1] * t;
      e.remaining = path.length - d;
    };
    const roadNear = (m) => {
      let best = null;
      sim.pathData.forEach((path, pi) => {
        for (let d = 0.5; d <= path.length - 0.5; d += 0.1) {
          const seg = segAt(path, d);
          const t = d - path.cum[seg];
          const r = Math.hypot(path.points[seg][0] + path.dirs[seg][0] * t - m.x, path.points[seg][1] + path.dirs[seg][1] * t - m.y);
          if (!best || r < best.r) best = { r, pathIndex: pi, d };
        }
      });
      return best;
    };
    const slow = (e) => {
      e.speed = e.baseSpeed = 0.03;
    };
    const keep = (e) => {
      e.__kept = 1;
      slow(e);
    };
    window.__dps = {
      /** n plain bears (no armor, no traits, ~3000 HP: no single hit ends one) on the road point nearest girl `uid`. */
      pack(uid, n = 3, id = 'beast_bear', hp = 3000) {
        const t = sim.getTower(uid);
        if (!t) return null;
        const at = roadNear(t);
        for (let i = 0; i < n; i++) {
          const e = sim.spawnEnemy(id, { pathIndex: at.pathIndex, dist: at.d, hpMul: hp / (sim.data.enemy(id)?.hp || 1) });
          if (!e) continue;
          moveTo(e, at.pathIndex, Math.max(0.3, at.d - 0.15 * i));
          keep(e);
        }
        return Number(at.r.toFixed(2));
      },
      /** A boss alone (her own HP, kept full) on the road point nearest girl `uid` (the rest of the field cleared). */
      boss(uid, id = 'grave_lych') {
        const at = roadNear(sim.getTower(uid));
        for (const e of sim.enemies) e.dead = true;
        const b = sim.spawnEnemy(id, { pathIndex: at.pathIndex, dist: at.d });
        if (b) {
          moveTo(b, at.pathIndex, at.d);
          keep(b);
        }
        return b?.tier || null;
      },
      /** One game step with the packs kept: HP back to full (max untouched), still slow; the wave's own spawns slowed. */
      step(dt) {
        for (const e of sim.enemies) {
          if (e.dead) continue;
          if (!e.__kept) slow(e);
          else e.hp = e.maxHp;
        }
        sim.update(dt);
      },
    };
  });
}

for (const vp of viewports) {
  const [W, H] = vp.split('x').map(Number);
  const touch = W < 1000;
  console.log(`viewport ${vp}`);
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message.split('\n')[0]}`));
  const shot = async (name) => {
    if (!SHOTS) return;
    // the drawer settled: open, fully shown, its slide and cross-fade between girls finished (slow frames here)
    await page.waitForFunction(() => {
      const p = document.querySelector('[data-testid="tower-panel"]');
      if (!p || p.hidden) return false;
      const running = document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target && (p.contains(a.effect.target) || a.effect.target.contains?.(p)));
      return !running.length && Number(getComputedStyle(p).opacity) > 0.99;
    }, null, { timeout: 15000, polling: 200 }).catch(() => console.log('  (the drawer did not settle before the still)'));
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(SHOTS, `${name}-${vp}.png`), timeout: 120000 });
  };
  // two real frames: the battle's frame (it samples the drawer's meter) has run since. Without them a slow frame can
  // see several half-second steps at once, and the meter leaves a jump over 2 s out of her average (dpsView.js)
  const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // a real frame between game-time steps, so the drawer's meter samples (it reads sim.time every frame)
  const stepGame = async (sec) => {
    for (let i = 0; i < sec * 2; i++) {
      await page.evaluate(() => {
        const { sim } = window.__battle;
        for (let k = 0; k < 30 && sim.state === 'wave'; k++) window.__dps.step(1 / 60);
      });
      await frames();
    }
  };
  const details = async (uid) => {
    await page.evaluate((u) => window.__battle.ui.select(u), uid);
    await page.waitForSelector('[data-testid="tower-panel"]:not([hidden]) [data-testid="panel-more"]');
    if (!(await page.$('[data-testid="tower-panel"].bt-drawer-more'))) await page.locator('[data-testid="tower-panel"] [data-testid="panel-more"]').click({ force: true });
    await page.waitForTimeout(400);
    // (the live cell is painted on the drawer's next frame: a slow software-rendered frame can take a while)
    await page.waitForFunction(() => {
      const b = document.querySelector('[data-testid="tower-panel"] [data-testid="drawer-dps-live"]');
      return !b || b.textContent !== '—' || window.__battle.sim.state !== 'wave';
    }, null, { timeout: 8000 }).catch(() => {});
    return page.evaluate(() => {
      const p = document.querySelector('[data-testid="tower-panel"]');
      const cells = [...p.querySelectorAll('.bt-stat-cell')];
      const cell = (re) => cells.find((c) => re.test(c.firstChild?.textContent?.trim() || ''))?.lastChild?.textContent?.trim() ?? null;
      return {
        // the drawer's live cell, or Chika's own (her drone panel's "DPS (live)")
        live: p.querySelector('[data-testid="drawer-dps-live"]')?.textContent ?? cell(/^DPS \((live|wave)\)$/),
        liveLabel: p.querySelector('[data-testid="drawer-dps"] span')?.textContent ?? (cell(/^DPS \(live\)$/) != null ? 'DPS (live)' : null),
        avg: p.querySelector('[data-testid="drawer-dps-avg"]')?.textContent ?? null,
        tips: ['drawer-dps', 'drawer-dps-avg-cell'].map((id) => {
          const c = p.querySelector(`[data-testid="${id}"]`);
          return c ? !!(c.title && c.getAttribute('aria-label')) : null;
        }),
        sameRow: (() => {
          const a = p.querySelector('[data-testid="drawer-dps"]');
          const b = p.querySelector('[data-testid="drawer-dps-avg-cell"]');
          return a && b ? Math.abs(a.getBoundingClientRect().top - b.getBoundingClientRect().top) < 2 : null;
        })(),
        per: cell(/^Per target$/),
        boost: p.querySelector('[data-testid="drawer-boost"]')?.textContent ?? null,
        oldDps: cell(/^DPS$/),
        // the live cell's label on one line (the between-waves label too): its height against one line of its font
        labelLines: (() => {
          const sp = p.querySelector('[data-testid="drawer-dps"] span');
          if (!sp) return null;
          const lh = parseFloat(getComputedStyle(sp).lineHeight) || parseFloat(getComputedStyle(sp).fontSize) * 1.1;
          return Math.round(sp.getBoundingClientRect().height / lh);
        })(),
        text: p.textContent.replace(/\s+/g, ' '),
      };
    });
  };
  const battle = async (squad, stage = '1-3') => {
    await seedSave(page, { girls: ALL, hero: HERO, towers: squad, cleared: ['1-1', '1-2'] });
    await openBattle(page, { stage, cash: 1e8 });
    await installStaging(page);
  };
  const place = (id, plan, near = null) =>
    page.evaluate(([id, plan, near]) => {
      const u = __ab.place(id, near != null ? { near, min: 1.3 } : {});
      if (u == null) return null;
      plan.forEach((n, p) => __ab.up(u, p, n));
      return u;
    }, [id, plan, near]);
  const startWave = () => page.evaluate(() => window.__battle.sim.startNextWave());

  try {
    await openApp(page, base);
    // 1. showcase
    const squad = ['midori', 'kage', 'chika', 'suzu', 'shiro', 'miko'];
    await battle(squad);
    const ids = { midori: await place('midori', [5, 0, 2]) };
    ids.kage = await place('kage', [3, 0, 2], ids.midori);
    ids.chika = await place('chika', [3, 0, 0], ids.midori);
    ids.suzu = await place('suzu', [3, 0, 0], ids.midori);
    ids.shiro = await place('shiro', [3, 0, 0], ids.midori);
    ids.miko = await place('miko', [3, 0, 0], ids.midori);
    ids.hero = await place(HERO, [], ids.midori);
    const tiers = await page.evaluate((u) => window.__battle.sim.getTower(u)?.tiers.join('-'), ids.midori);
    check(ids.midori != null && tiers === '5-0-2', `${vp} Midori placed at 5-0-2 (${tiers})`);
    await startWave();
    await stepGame(3);
    const n = 8;
    await page.evaluate((u) => window.__dps.pack(u, 8), ids.midori);
    for (const k of ['kage', 'chika', 'suzu', 'shiro', 'miko', 'hero']) if (ids[k] != null) await page.evaluate((u) => window.__dps.pack(u, 2), ids[k]);
    await stepGame(7);
    const crowd = await details(ids.midori);
    console.log(`  midori vs a pack of ${n}: ${JSON.stringify({ ...crowd, text: undefined })}`);
    await shot('dps-midori-crowd');
    if (!BEFORE) {
      const live = num(crowd.live);
      const hits = num(crowd.per);
      check(crowd.liveLabel === 'DPS (live)' && live > 0, `${vp} Midori's Details show her measured DPS during the wave (${crowd.liveLabel} ${crowd.live})`);
      check(Number.isFinite(hits) && live > hits, `${vp} with a pack in her cloud her live DPS (${live}) is above her per-target hits (${hits}): "${crowd.per}"`);
      check(/poison \(\+0\.\d\d?% HP\/s\)/.test(crowd.per || ''), `${vp} the per-target line names her poison with two significant digits ("${crowd.per}")`);
      check(/^~[\d.,kKM]+ DPS · \d+ girls?$/.test(crowd.boost || ''), `${vp} her Toxic Tonic boost reads as an estimate ("${crowd.boost}")`);
      check(num(crowd.avg) > 0 && !/NaN|undefined|Infinity/.test(crowd.avg), `${vp} her Details show her average DPS too (DPS (avg) ${crowd.avg})`);
      check(crowd.tips[0] === true && crowd.tips[1] === true, `${vp} Live and Avg each carry a tooltip and an aria text`);
      check(crowd.sameRow === true, `${vp} Live and Avg share one row (the drawer is no taller)`);
    }
    for (const k of ['kage', 'chika', 'suzu', 'shiro', 'miko', 'hero']) {
      if (ids[k] == null) continue;
      const d = await details(ids[k]);
      console.log(`  ${k}: ${JSON.stringify({ ...d, text: undefined })}`);
      await shot(`dps-${k}`);
      if (!BEFORE && num(d.live) > 0) {
        check(num(d.avg) > 0 && d.tips[1] === true, `${vp} ${k}: DPS (avg) ${d.avg} beside DPS (live) ${d.live}, with its tooltip and aria text`);
      }
    }
    // a boss alone in her cloud (her poison's share of max HP is a tenth on a boss: the boss's HP stays as it is)
    const tier = await page.evaluate((u) => window.__dps.boss(u), ids.midori);
    await stepGame(7);
    const boss = await details(ids.midori);
    console.log(`  midori vs a ${tier}: ${JSON.stringify({ ...boss, text: undefined })}`);
    await shot('dps-midori-boss');
    if (!BEFORE) check(num(boss.live) > 0 && num(boss.live) < num(crowd.live), `${vp} against one boss her live DPS (${boss.live}) is below her pack's (${crowd.live})`);
    if (!BEFORE) {
      // Live swings from the pack to the lone boss; Avg (since she was placed) moves far less, and stays a number
      const lives = [num(crowd.live), num(boss.live)];
      const avgs = [num(crowd.avg), num(boss.avg)];
      const spread = (xs) => (Math.max(...xs) - Math.min(...xs)) / Math.max(1, Math.max(...xs));
      const state = await page.evaluate(() => window.__battle.sim.state);
      check(state === 'wave' && avgs.every((v) => Number.isFinite(v) && v > 0) && !/NaN/.test(`${crowd.avg} ${boss.avg}`), `${vp} Avg stays a number above 0 through the wave (${crowd.avg} → ${boss.avg}; ${state})`);
      check(num(crowd.avg) !== num(boss.avg), `${vp} Avg moved while she kept dealing damage (${crowd.avg} → ${boss.avg}: the meter counted her time)`);
      check(spread(avgs) < spread(lives) / 2, `${vp} Avg is steadier than Live from the pack to the boss (Avg ${crowd.avg} → ${boss.avg}, spread ${spread(avgs).toFixed(2)}; Live ${crowd.live} → ${boss.live}, spread ${spread(lives).toFixed(2)})`);
    }

    // between waves: the wave ends; Live reads her last wave ("DPS (wave)", one line), Avg holds still
    {
      await page.evaluate(() => {
        const { sim } = window.__battle;
        sim._spawnIndex = sim._spawnQueue.length;
        for (const e of sim.enemies) e.dead = true;
      });
      await page.waitForFunction(() => {
        const { sim } = window.__battle;
        if (sim.state === 'wave') sim.update(1 / 60);
        return sim.state !== 'wave';
      }, null, { timeout: 30000, polling: 100 });
      await frames();
      const a = await details(ids.midori);
      await frames();
      await frames();
      const b = await details(ids.midori);
      console.log(`  midori between waves: ${JSON.stringify({ ...b, text: undefined })}`);
      await shot('dps-midori-between');
      if (!BEFORE) {
        check(b.liveLabel === 'DPS (wave)' && num(b.live) > 0 && b.labelLines === 1, `${vp} between waves Live reads her last wave on one line (${b.liveLabel} ${b.live}; ${b.labelLines} line)`);
        check(num(b.avg) > 0 && a.avg === b.avg, `${vp} between waves Avg holds still (${a.avg} → ${b.avg})`);
      }
    }

    // 2. the roster: six girls a battle, 3-0-0, each with her own pack
    if (ROSTER) {
      const rows = [];
      // (Tenka on her own: her lab tier takes the girls in her range off the field, src/sim/lab.js)
      const units = [...GIRLS.filter((id) => id !== 'tenka'), HERO];
      const batches = [];
      for (let i = 0; i < units.length; i += 6) batches.push(units.slice(i, i + 6));
      if (GIRLS.includes('tenka')) batches.push(['tenka']);
      for (const batch of batches) {
        // (a real load, and no battle save left: a battle link for a stage with a save opens its prep instead)
        await page.goto('about:blank');
        await openApp(page, base);
        await page.evaluate(() => {
          const { store } = window.__sakura;
          store.profile.battleSaves = {};
          store.commit('e2e');
        });
        await battle(batch.filter((id) => id !== HERO), '1-3');
        const placed = [];
        for (const id of batch) placed.push([id, await place(id, id === HERO ? [] : [3, 0, 0], placed[0]?.[1] ?? null)]);
        await startWave();
        for (const [, uid] of placed) if (uid != null) await page.evaluate((u) => window.__dps.pack(u, 3), uid);
        await stepGame(8);
        const gone = await page.evaluate((us) => us.filter((u) => u != null && !window.__battle.sim.getTower(u)), placed.map((p) => p[1]));
        if (gone.length) console.log(`  (gone from the field: ${placed.filter((p) => gone.includes(p[1])).map((p) => p[0]).join(', ')})`);
        for (const [id, uid] of placed) {
          if (uid == null || gone.includes(uid)) {
            rows.push({ id, placed: false });
            continue;
          }
          const d = await details(uid);
          const st = await page.evaluate((u) => {
            const { sim } = window.__battle;
            const t = sim.getTower(u);
            return { dealt: Math.round(t.damageDealt || 0), statDps: sim.towerStats(u)?.dps || 0 };
          }, uid);
          rows.push({ id, placed: true, ...d, ...st });
        }
      }
      for (const r of rows) {
        if (!r.placed) {
          check(false, `${vp} ${r.id} could not be placed`);
          continue;
        }
        const v = num(r.live);
        const bad = /NaN|undefined|Infinity/.exec(r.text);
        const dealsDamage = r.dealt > 0 || r.statDps > 0;
        // a girl who deals no damage (Ouka's council, Wakaba's drinks) has no DPS cell; a damage dealer reads > 0
        const ok = !bad && (dealsDamage ? r.liveLabel != null && v > 0 : r.liveLabel == null || !(v > 0));
        // her average: a number (or "—") wherever her live cell is; never NaN
        const avgOk = r.liveLabel == null || (r.dealt > 0 && v > 0 ? num(r.avg) > 0 : r.avg == null || r.avg === '—' || Number.isFinite(num(r.avg)));
        check(ok && avgOk, `${vp} ${r.id}: ${r.liveLabel} ${r.live}${r.avg != null ? ` · avg ${r.avg}` : ''}${r.per ? ` · per target ${r.per}` : ''}${r.boost ? ` · boost ${r.boost}` : ''} (dealt ${r.dealt}${bad ? `; "${bad[0]}" in her drawer` : ''})`);
      }
    }
  } catch (e) {
    check(false, `${vp} threw: ${e.message.split('\n')[0]} (at ${page.url()})`);
    await shot('dps-fail').catch(() => {});
  }
  await page.close();
}
await browser.close();
await server.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nDPS readout: all checks passed');
process.exit(fails.length ? 1 : 0);
