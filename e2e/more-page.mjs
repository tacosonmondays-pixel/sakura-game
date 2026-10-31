// MORE › Details for every girl (v0.1.68; docs/review/more-page-audit.md, src/ui/battle/kitRows.js): her measured DPS
// whenever she has a damage source, her damage by source where the sim credits it apart, and a row for every kit piece.
//   Luna (hero, Lv 25): DPS (live) / (avg), her attack grid (the hero More page had none), her aura and Moonbeam rows.
//   Chika: her own Overall / Chika / Drones panel still shows her DPS.
//   Iroha 2-0-5: DPS cells, her Mirrors row and her ⚡ ability row.
//   Midori 0-2-5: DPS cells, Spore Mist and Brew rows, and "Damage by source" (Attack · Mist).
//   Suzu 5-0-2 (a trap girl): DPS cells, Bell Toll and Traps rows, and Attack · Bells.
//   Ouka 0-4-0 (a pure support): no DPS cells, "Boost to allies" instead.
// Each at 390x844, 844x390 and 1280x720: the drawer never scrolls sideways and no cell's text spills out of it.
//
//   node e2e/more-page.mjs [--viewport 390x844] [--shots <dir>] [--root <checkout>]
//   (--root another checkout, e.g. live main, for the "before" stills only: the checks need this build's drawer)
// Stills are JPEG (quality 72). Starts its own Vite dev server. Exit code 1 on any failure.
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
const viewports = opt('viewport') ? [opt('viewport')] : ['390x844', '844x390', '1280x720'];
const SHOTS = opt('shots');
const ROOT = opt('root', process.cwd());
const BEFORE = ROOT !== process.cwd();
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const HERO = 'luna';
const SQUAD = ['chika', 'iroha', 'midori', 'suzu', 'ouka'];
const BUILDS = { chika: [3, 0, 0], iroha: [2, 0, 5], midori: [0, 2, 5], suzu: [5, 0, 2], ouka: [0, 4, 0] };

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
const num = (s) => {
  const m = /^~?([\d.,]+)\s*([kKmM]?)/.exec(String(s ?? '').trim());
  if (!m) return null;
  return Number(m[1].replace(/,/g, '')) * ({ k: 1e3, m: 1e6 }[m[2].toLowerCase()] || 1);
};

for (const vp of viewports) {
  const [W, H] = vp.split('x').map(Number);
  const touch = W < 1000;
  console.log(`viewport ${vp}`);
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message.split('\n')[0]}`));
  const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  /** Game seconds, a real frame between half-second steps (the drawer's meter samples per frame); packs kept alive. */
  const stepGame = async (sec) => {
    for (let i = 0; i < sec * 2; i++) {
      await page.evaluate(() => {
        const { sim } = window.__battle;
        for (let k = 0; k < 30 && sim.state === 'wave'; k++) {
          for (const e of sim.enemies) if (!e.dead) { e.hp = e.maxHp; e.speed = e.baseSpeed = 0.03; }
          sim.update(1 / 60);
        }
      });
      await frames();
    }
  };
  const shot = async (name, scrollTo = null) => {
    if (!SHOTS) return;
    await page.evaluate((sel) => {
      const sc = document.querySelector('[data-testid="tower-panel"] .bt-panel-scroll');
      const el = sel ? document.querySelector(`[data-testid="tower-panel"] ${sel}`) : null;
      if (sc) sc.scrollTop = el ? Math.max(0, el.offsetTop - 90) : 0;
    }, scrollTo);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, `${name}-${vp}.jpg`), type: 'jpeg', quality: 72, timeout: 120000 });
  };
  const details = async (uid) => {
    await page.evaluate((u) => window.__battle.ui.select(u), uid);
    await page.waitForSelector('[data-testid="tower-panel"]:not([hidden]) [data-testid="panel-more"]');
    if (!(await page.$('[data-testid="tower-panel"].bt-drawer-more'))) await page.locator('[data-testid="tower-panel"] [data-testid="panel-more"]').click({ force: true });
    await page.waitForTimeout(500);
    await page.waitForFunction(() => {
      const b = document.querySelector('[data-testid="tower-panel"] [data-testid="drawer-dps-live"]');
      return !b || b.textContent !== '—';
    }, null, { timeout: 8000 }).catch(() => {});
    return page.evaluate(() => {
      const p = document.querySelector('[data-testid="tower-panel"]');
      const q = (id) => p.querySelector(`[data-testid="${id}"]`);
      const cells = [...p.querySelectorAll('.bt-stat-cell')];
      const cell = (re) => cells.find((c) => re.test(c.firstChild?.textContent?.trim() || ''))?.lastChild?.textContent?.trim() ?? null;
      const kits = Object.fromEntries([...p.querySelectorAll('[data-testid^="kit-"]')].map((c) => [c.dataset.testid.slice(4), c.lastChild.textContent.trim()]));
      const sc = p.querySelector('.bt-panel-scroll') || p;
      // a cell whose value text runs past the cell (the grid wraps a long row instead)
      // (the drawer's own box may reach past the screen edge for its shadow; its rows must not)
      const edge = Math.min(window.innerWidth, p.getBoundingClientRect().right) + 1;
      const spill = cells.filter((c) => {
        const b = c.lastElementChild;
        return b && (b.scrollWidth > b.clientWidth + 1 || c.getBoundingClientRect().right > edge);
      }).map((c) => c.firstChild?.textContent?.trim());
      const grids = [...p.querySelectorAll('.bt-stats-grid, .bt-caps, .bt-dt-line')];
      return {
        live: q('drawer-dps-live')?.textContent ?? cell(/^DPS \((live|wave)\)$/),
        avg: q('drawer-dps-avg')?.textContent ?? null,
        boost: q('drawer-boost')?.textContent ?? null,
        split: q('drawer-split')?.textContent ?? null,
        dealt: cell(/^Damage dealt$/),
        kills: cell(/^Kills$/),
        range: cell(/^Range$/),
        aura: cell(/^Aura → allies$/),
        traps: cell(/^Traps$/),
        heroGrid: !!q('hero-grid'),
        kits,
        sideways: sc.scrollWidth > sc.clientWidth + 1 || p.scrollWidth > p.clientWidth + 1,
        offscreen: grids.some((g) => g.getBoundingClientRect().right > edge || g.getBoundingClientRect().left < -1),
        spill,
        text: p.textContent.replace(/\s+/g, ' '),
      };
    });
  };
  const place = (id, plan, near = null) =>
    page.evaluate(([id, plan, near]) => {
      const u = __ab.place(id, near != null ? { near, min: 1.3 } : {});
      if (u == null) return null;
      plan.forEach((n, p) => __ab.up(u, p, n));
      return u;
    }, [id, plan, near]);

  try {
    await openApp(page, base);
    await seedSave(page, { girls: [HERO, ...SQUAD], hero: HERO, towers: SQUAD, cleared: ['1-1', '1-2'] });
    await openBattle(page, { stage: '1-3', cash: 1e8 });
    const ids = { luna: await place(HERO, []) };
    // Luna to Lv 25 (her Moonbeam Sweep comes at Lv 22): the XP a long battle would give
    await page.evaluate((u) => {
      const { sim } = window.__battle;
      sim._credit(sim.getTower(u), 1e9);
      sim.getTower(u).damageDealt = 0;
    }, ids.luna);
    for (const id of SQUAD) ids[id] = await place(id, BUILDS[id], ids.luna);
    const tiers = await page.evaluate((ids) => Object.fromEntries(Object.entries(ids).map(([k, u]) => [k, u == null ? null : `${window.__battle.sim.getTower(u)?.tiers.join('-')} L${window.__battle.sim.getTower(u)?.level || 0}`])), ids);
    console.log(`  placed: ${JSON.stringify(tiers)}`);
    await page.evaluate(() => window.__battle.sim.startNextWave());
    await stepGame(3);
    // a crowd at each girl: plain bears kept alive (HP refilled) and slow, on the road nearest her
    await page.evaluate((uids) => {
      const { sim } = window.__battle;
      for (const uid of uids) {
        const t = sim.getTower(uid);
        if (!t) continue;
        let best = null;
        sim.pathData.forEach((path, pi) => {
          for (let d = 0.5; d <= path.length - 0.5; d += 0.1) {
            let seg = 0;
            while (seg < path.cum.length - 2 && path.cum[seg + 1] <= d) seg++;
            const k = d - path.cum[seg];
            const x = path.points[seg][0] + path.dirs[seg][0] * k;
            const y = path.points[seg][1] + path.dirs[seg][1] * k;
            const r = Math.hypot(x - t.x, y - t.y);
            if (!best || r < best.r) best = { r, pi, d };
          }
        });
        for (let i = 0; i < 6; i++) sim.spawnEnemy('beast_bear', { pathIndex: best.pi, dist: Math.max(0.3, best.d - 0.4 * i), hpMul: 3000 / (sim.data.enemy('beast_bear')?.hp || 1) });
      }
    }, Object.values(ids).filter((u) => u != null));
    await stepGame(10);

    const d = {};
    for (const k of ['luna', ...SQUAD]) {
      if (ids[k] == null) {
        check(false, `${vp} ${k} could not be placed`);
        continue;
      }
      d[k] = await details(ids[k]);
      console.log(`  ${k}: ${JSON.stringify({ ...d[k], text: undefined })}`);
      await shot(`more-${k}`);
      if (k === 'luna') {
        await shot('more-luna-grid', '[data-testid="hero-grid"]');
        await shot('more-luna-kit', '[data-testid="kit-moon"]');
      }
      if (BEFORE) continue;
      const v = d[k];
      check(!v.sideways && !v.offscreen && v.spill.length === 0, `${vp} ${k}: the drawer fits (no sideways scroll, nothing off screen, no cell spills${v.spill.length ? `: ${v.spill.join(', ')}` : ''})`);
      check(!/NaN|undefined|Infinity/.test(v.text), `${vp} ${k}: no NaN / undefined in her drawer`);
    }
    if (!BEFORE) {
      const L = d.luna;
      check(num(L.live) > 0 && num(L.avg) > 0, `Luna: DPS (live) ${L.live} and DPS (avg) ${L.avg}`);
      check(L.heroGrid && L.range != null && L.dealt != null && L.kills != null, `Luna: her attack grid (Range ${L.range}, Damage dealt ${L.dealt}, Kills ${L.kills})`);
      check(L.aura != null && /tiles/.test(L.aura), `Luna: her aura row ("${L.aura}")`);
      check(/\d+ beams? · ±\d+° sweep · \d+% of her hit/.test(L.kits.moon || ''), `Luna: her Moonbeam row with its tier numbers ("${L.kits.moon}")`);
      check(/^Attack \d+% · Moonbeam \d+%$/.test(L.split || ''), `Luna: her damage by source ("${L.split}")`);
      const C = d.chika;
      check(C && num(C.live) > 0, `Chika: her own panel still shows her measured DPS (${C?.live})`);
      const I = d.iroha;
      check(num(I.live) > 0 && num(I.avg) > 0, `Iroha: DPS (live) ${I.live} and DPS (avg) ${I.avg}`);
      check(/placed · \d+ bounces/.test(I.kits.mirrors || '') && !!I.kits.ability, `Iroha: Mirrors ("${I.kits.mirrors}") and ⚡ ability ("${I.kits.ability}") rows`);
      const M = d.midori;
      check(num(M.live) > 0 && num(M.avg) > 0, `Midori: DPS (live) ${M.live} and DPS (avg) ${M.avg}`);
      check(/cone · up to \d+/.test(M.kits.mist || '') && /girls?/.test(M.kits.brew || ''), `Midori: Spore Mist ("${M.kits.mist}") and Brew ("${M.kits.brew}") rows`);
      check(/^Attack \d+% · Mist \d+%$/.test(M.split || '') && !/Mist 0%/.test(M.split), `Midori: her damage by source ("${M.split}")`);
      const S = d.suzu;
      check(num(S.live) > 0 && num(S.avg) > 0 && S.traps != null, `Suzu (traps): DPS (live) ${S.live}, DPS (avg) ${S.avg}, Traps ${S.traps}`);
      check(/every [\d.]+s · [\d.]+ tiles ring/.test(S.kits.toll || '') && /^Attack \d+% · Bells \d+%$/.test(S.split || ''), `Suzu: Bell Toll ("${S.kits.toll}") and her damage by source ("${S.split}")`);
      const O = d.ouka;
      check(O.live == null && O.avg == null, `Ouka (pure support): no DPS cells (${O.live})`);
      check(O.boost != null, `Ouka: "Boost to allies" instead ("${O.boost}")`);
    }
  } catch (e) {
    check(false, `${vp} threw: ${e.message.split('\n')[0]} (at ${page.url()})`);
    await shot('more-fail').catch(() => {});
  }
  await page.close();
}
await browser.close();
await server.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nMore page: all checks passed');
process.exit(fails.length ? 1 : 0);
