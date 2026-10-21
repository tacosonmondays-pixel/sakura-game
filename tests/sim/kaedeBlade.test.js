// Kaede's blade arts (her AoE rework; src/sim/towers.js bladeArts, docs/BALANCE.md "Kaede"): the hit
// sets of the Maple Cleave, the wind crescents and the shockwave (eligible enemies only: no flyer
// unless her kit reaches flyers, nothing in a tunnel, never her target; nearest first, capped), shred
// stacking from the shockwave, her gear on every blade-art hit (ATK, Pierce), the maple splash keyed on
// her focus cap before Potential, and determinism.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { hitRadius } from '../../src/sim/towers.js';
import { segDistSq, samplePath } from '../../src/sim/path.js';
import { UNITS, ENEMIES, testData, startEmptyWave, run } from './fixtures.js';

const DUMMY = { ...ENEMIES.tank, id: 'dummy', name: 'dummy', hp: 5000 };
const STEP = 1 / 60;

/** Kaede alone on the fixture map (straight road along y = 4), at (6, 5), Strong targeting. */
function kaedeSim({ tiers = [0, 0, 0], stats = {}, seed = 7 } = {}) {
  const sim = new Sim({
    stageId: 'test-1', difficulty: 'normal', seed, loadout: [{ unitId: 'kaede', stats }, { unitId: 'duelist' }], hero: null, options: {},
    data: testData({ units: { ...UNITS, kaede: UNIT_MAP.kaede }, enemies: { ...ENEMIES, dummy: DUMMY } }),
  });
  sim.cash = 1e9;
  const t = sim.placeTower('kaede', 6, 5);
  for (let p = 0; p < 3; p++) for (let k = 0; k < tiers[p]; k++) expect(sim.upgradeTower(t.uid, p)).toBeTruthy();
  sim.setTargetMode(t.uid, 'strong');
  startEmptyWave(sim);
  return { sim, t };
}

function park(sim, id, dist) {
  const e = sim.spawnEnemy(id, { dist });
  e.baseSpeed = 0;
  e.speed = 0;
  return e;
}

/** Steps until her next blade art; returns the hits between her strike and the 'bladeArt' event. */
function nextArt(sim, kind = 'cleave', max = 600) {
  const seen = [];
  for (let i = 0; i < max; i++) {
    sim.update(STEP);
    for (const ev of sim.drainEvents()) {
      seen.push(ev);
      if (ev.type === 'bladeArt' && ev.kind === kind) {
        let a = seen.length - 1;
        while (a > 0 && seen[a].type !== 'attack') a--;
        return { art: ev, hits: seen.slice(a + 1).filter((x) => x.type === 'hit'), all: seen };
      }
    }
  }
  throw new Error('no blade art');
}

/** The documented victims of a round shape: eligible, not the target, nearest first (uid on a tie), capped. */
function roundSet(sim, x, y, r, tgt, cap, canHitAir = false) {
  const c = sim.enemies.filter((e) => e !== tgt && !e.dead && !e.hidden && (canHitAir || !e.airborne) && (e.x - x) ** 2 + (e.y - y) ** 2 <= r * r);
  c.sort((a, b) => ((a.x - x) ** 2 + (a.y - y) ** 2) - ((b.x - x) ** 2 + (b.y - y) ** 2) || a.uid - b.uid);
  return c.slice(0, cap).map((e) => e.uid);
}

/** The documented victims of a line shape from her along (ux, uy). */
function lineSet(sim, t, ux, uy, len, hw, tgt, cap, canHitAir = false) {
  const ex = t.ox + ux * len;
  const ey = t.oy + uy * len;
  const c = sim.enemies.filter((e) => e !== tgt && !e.dead && !e.hidden && (canHitAir || !e.airborne)
    && segDistSq(e.x, e.y, t.ox, t.oy, ex, ey) <= (hw + hitRadius(e)) ** 2);
  const along = (e) => (e.x - t.ox) * ux + (e.y - t.oy) * uy;
  c.sort((a, b) => along(a) - along(b) || a.uid - b.uid);
  return c.slice(0, cap).map((e) => e.uid);
}

describe('Kaede: the Maple Cleave (every 3rd strike)', () => {
  test('cuts the 4 nearest enemies around her target at 50 % of her plain hit; never her target, a flyer or a tunnel walker', () => {
    const { sim, t } = kaedeSim();
    sim.pathData[0].tunnels.push([6.85, 6.95]);
    const tgt = park(sim, 'tank', 7);
    const ring = [6.3, 6.6, 7.4, 7.7, 7.85, 8.2].map((d) => park(sim, 'dummy', d));
    const bat = park(sim, 'bat', 7.1);
    const hidden = park(sim, 'dummy', 6.9);
    const { art, hits, all } = nextArt(sim);
    expect(hidden.hidden).toBe(true);
    // her 3rd strike: two plain strikes on her target came first
    expect(all.filter((e) => e.type === 'attack' && e.towerUid === t.uid)).toHaveLength(3);
    expect(t.bladeN).toBe(0);
    const want = roundSet(sim, art.x, art.y, t.eff.blade.radius, tgt, 4);
    expect(want).toHaveLength(4);
    expect(hits.map((h) => h.uid)).toEqual(want);
    expect(hits.map((h) => h.uid)).not.toContain(tgt.uid);
    expect(hits.map((h) => h.uid)).not.toContain(bat.uid);
    expect(hits.map((h) => h.uid)).not.toContain(hidden.uid);
    expect(hits.map((h) => h.uid)).not.toContain(ring[5].uid); // 1.2 tiles out
    // 50 % of her plain hit (no focus; × the type chart), a crit at her crit multiplier
    for (const h of hits) expect([1, t.eff.crit.mul].some((m) => Math.abs(h.amount - t.eff.damage * 0.5 * h.effective * m) < 1e-9)).toBe(true);
    expect(art).toMatchObject({ towerUid: t.uid, kind: 'cleave', crescents: 0, storm: 0, wave: 0, hits: 4 });
  });

  test('her gear reaches the cut: ATK doubles every cleave hit, Pierce 100 % cuts 2 more', () => {
    const base = kaedeSim();
    const strong = kaedeSim({ stats: { damageMul: 2 } });
    const pierce = kaedeSim({ stats: { pierceK: 100 } });
    for (const { sim } of [base, strong, pierce]) {
      park(sim, 'tank', 7);
      for (const d of [6.3, 6.45, 6.6, 6.75, 7.25, 7.4, 7.55, 7.7]) park(sim, 'dummy', d);
    }
    const a = nextArt(base.sim).hits;
    const b = nextArt(strong.sim).hits;
    const c = nextArt(pierce.sim).hits;
    expect(a).toHaveLength(4);
    expect(b.map((h) => h.uid)).toEqual(a.map((h) => h.uid));
    b.forEach((h, i) => expect(h.amount / a[i].amount).toBeCloseTo(2, 9));
    expect(c).toHaveLength(6);
    expect(pierce.t.pierceCarry).toBe(0);
  });
});

describe('Kaede: Flowing Blade crescents and storm, Guard Breaker shockwave', () => {
  test('tier 3: one wind crescent through her target cuts the enemies on its line (flyers too: her kit reaches them now)', () => {
    const { sim, t } = kaedeSim({ tiers: [0, 3, 0] });
    const tgt = park(sim, 'tank', 9);
    for (const d of [8.4, 9.6, 10.2, 10.8, 11.4, 12.5]) park(sim, 'dummy', d);
    park(sim, 'bat', 10.5);
    const { art, hits } = nextArt(sim);
    const b = t.eff.blade;
    expect([b.crescents, b.cLen, b.cWidth, b.cShare, b.cTargets]).toEqual([1, 3.5, 0.3, 0.55, 4]);
    const want = [...roundSet(sim, art.x, art.y, b.radius, tgt, b.targets, true), ...lineSet(sim, t, art.dx, art.dy, b.cLen, b.cWidth, tgt, b.cTargets, true)];
    expect(hits.map((h) => h.uid)).toEqual(want);
    expect(art.crescents).toBe(1);
  });

  test('tier 4: three crescents fly in a fan; tier 5 adds the maple storm around her', () => {
    const four = kaedeSim({ tiers: [0, 4, 0] });
    expect(four.t.eff.blade).toMatchObject({ crescents: 3, cLen: 4, cTargets: 5, storm: 0 });
    const five = kaedeSim({ tiers: [0, 5, 0] });
    expect(five.t.eff.blade).toMatchObject({ crescents: 3, storm: 2.5, sShare: 0.55, sTargets: 8 });
    park(five.sim, 'tank', 7);
    for (let d = 4.5; d <= 9.5; d += 0.5) if (d !== 7) park(five.sim, 'dummy', d);
    const { art, hits } = nextArt(five.sim);
    expect(art).toMatchObject({ crescents: 3, storm: 2.5 });
    // every shape cut someone; no shape cut more than its cap
    expect(hits.length).toBeGreaterThan(8);
    expect(hits.length).toBeLessThanOrEqual(6 + 3 * 5 + 8);
  });

  test('tier 4 shockwave: a line through her target, its victims\' armor cracked; shred stacks to 3 and no further', () => {
    const { sim, t } = kaedeSim({ tiers: [0, 0, 4] });
    const tgt = park(sim, 'tank', 8);
    const line = [8.6, 9.2].map((d) => park(sim, 'dummy', d));
    const side = park(sim, 'dummy', 6.6); // cleave only: a clean cut, no shred
    const art = nextArt(sim);
    const b = t.eff.blade;
    expect([b.wave, b.wWidth, b.wShare, b.wTargets]).toEqual([2.5, 0.35, 0.6, 6]);
    const waved = lineSet(sim, t, art.art.dx, art.art.dy, b.wave, b.wWidth, tgt, b.wTargets);
    expect(waved.length).toBeGreaterThan(0);
    const cut = roundSet(sim, art.art.x, art.art.y, b.radius, tgt, b.targets);
    expect(art.hits.map((h) => h.uid)).toEqual([...cut, ...waved]);
    const first = sim.enemies.find((e) => e.uid === waved[0]);
    expect(first.statuses.shred).toMatchObject({ amount: 3, stacks: 1 });
    for (let i = 0; i < 3; i++) nextArt(sim);
    expect(first.statuses.shred.stacks).toBe(3);
    if (!waved.includes(side.uid)) expect(side.statuses.shred).toBeUndefined();
    expect(line.some((e) => waved.includes(e.uid))).toBe(true);
  });
});

describe('Kaede: the full-focus maple splash (Unbroken Rhythm 3+)', () => {
  test('only at her focus cap (read before Potential), 30 % of the focused strike on 3 enemies by her target', () => {
    const { sim, t } = kaedeSim({ tiers: [3, 0, 0], stats: { potential: 6 } });
    const tgt = park(sim, 'tank', 7);
    for (const d of [6.4, 6.6, 7.4, 7.6]) park(sim, 'dummy', d);
    const b = t.eff.blade;
    expect(b.capMax).toBeCloseTo(0.2 + 0.5 + 0.8, 9); // her kit's cap: base 0.8, Steady Footwork, Maple Cascade
    expect(t.eff.ramp.max).toBeCloseTo(b.capMax + 0.3, 9); // Scarlet Focus raises the cap, not the key
    const { art, hits, all } = nextArt(sim, 'maple', 6000);
    const strikes = all.filter((e) => e.type === 'attack' && e.towerUid === t.uid);
    expect((strikes.length - 1) * t.eff.ramp.per).toBeGreaterThanOrEqual(b.capMax - 1e-9);
    expect((strikes.length - 2) * t.eff.ramp.per).toBeLessThan(b.capMax);
    expect(hits.map((h) => h.uid)).toEqual(roundSet(sim, tgt.x, tgt.y, b.maple, tgt, b.mTargets));
    expect(art.radius).toBe(0.9);
  });
});

describe('Kaede: determinism', () => {
  test('the same battle twice plays out bit for bit (two Kaedes, crowd and boss builds, real waves)', () => {
    const play = () => {
      const sim = new Sim({ stageId: '4-5', difficulty: 'hard', seed: 31, loadout: [{ unitId: 'kaede', stats: { damageMul: 2, critChance: 0.2, pierceK: 70, potential: 6 } }], hero: null, options: { autoStart: false } });
      sim.cash = 1e7;
      sim.lives = 1e6;
      // the two best-covered spots (road samples within 2 tiles), 3 tiles apart
      const road = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((x) => !x.hidden);
      const cands = [];
      for (let y = 0.55; y < sim.map.height; y += 0.35) {
        for (let x = 0.55; x < sim.map.width; x += 0.35) {
          if (sim.canPlace('kaede', x, y).ok) cands.push([x, y, road.filter((q) => (q.x - x) ** 2 + (q.y - y) ** 2 <= 4).length]);
        }
      }
      cands.sort((p, q) => q[2] - p[2] || p[1] - q[1] || p[0] - q[0]);
      const spots = [];
      for (const [x, y] of cands) if (spots.length < 2 && spots.every(([u, v]) => (u - x) ** 2 + (v - y) ** 2 > 9)) spots.push([x, y]);
      const [a, b] = spots.map(([x, y]) => sim.placeTower('kaede', x, y));
      for (const [t, tiers] of [[a, [2, 5, 0]], [b, [5, 0, 2]]]) for (let p = 0; p < 3; p++) for (let k = 0; k < tiers[p]; k++) sim.upgradeTower(t.uid, p);
      let arts = 0;
      let h = 0x811c9dc5;
      for (let w = 0; w < 10; w++) {
        sim.startNextWave();
        for (let i = 0; i < 60 * 120 && sim.state === 'wave'; i++) {
          sim.update(STEP);
          for (const ev of sim.drainEvents()) {
            if (ev.type === 'bladeArt') arts++;
            if (ev.type === 'hit') h = Math.imul(h ^ (ev.uid * 31 + Math.round(ev.amount * 1000)), 0x01000193) >>> 0;
          }
        }
      }
      return { arts, h, dmg: sim.towers.map((t) => t.damageDealt), bladeN: sim.towers.map((t) => t.bladeN) };
    };
    const one = play();
    expect(one.arts).toBeGreaterThan(5);
    expect(play()).toEqual(one);
  });

  test('her blade arts never change any other girl: a girl without `blade` carries no blade field or count', () => {
    const { sim } = kaedeSim();
    const d = sim.placeTower('duelist', 9, 5);
    park(sim, 'tank', 10);
    run(sim, 3);
    expect('blade' in d.stats).toBe(false);
    expect(d.bladeN).toBeUndefined();
  });
});
