// Attack FX over a real Sim (node, no WebGL): purely visual (identical sim digest with FX on
// and off), drones 1:1 with turrets and leashed, targets follow the sim, blended projectiles
// land exactly on the sim path, flourishes only on real hits, no leaks after selling.
import { describe, it, expect } from 'vitest';
import { harness, gallerySim, streamer } from './attackFxHarness.js';
import { ORDER } from './attackFxOrder.js';
import { victimsFor } from '../../src/render/attackFx/math/victims.js';

const BUILDS = { base: [0, 0, 0], p0: [5, 2, 0], p1: [0, 5, 2], p2: [2, 0, 5] };

function digest(sim) {
  const r = (x) => Math.round(x * 1e9) / 1e9;
  return JSON.stringify({
    t: sim.time, cash: sim.cash, lives: sim.lives, wave: sim.wave,
    towers: sim.towers.map((t) => [t.uid, t.cooldown, t.targetUid, t.turrets.map((u) => [u.uid, r(u.cooldown)])]),
    enemies: sim.enemies.map((e) => [e.uid, r(e.x), r(e.y), r(e.hp)]),
    projectiles: sim.projectiles.map((p) => [p.uid, r(p.x), r(p.y)]),
  });
}

function run(ids, builds, { frames = 900, speed = 3, fx = true, strict = false, quality = 'high', check = null } = {}) {
  const sim = gallerySim(ids, builds, 3);
  const feed = streamer(sim);
  const h = fx ? harness(sim, { quality, strict }) : null;
  for (let f = 0; f < frames; f++) {
    feed((1 / 60) * speed);
    if (h) {
      const events = h.frame(1 / 60, speed);
      if (check) check(sim, h, events, f);
    } else {
      sim.update((1 / 60) * speed);
      sim.drainEvents();
    }
  }
  return { sim, h };
}

describe('attack FX over a real sim', { timeout: 180000 }, () => {
  it('is purely visual: the sim digest is identical with FX on and off', () => {
    const ids = ['chika', 'chika', 'momo', 'miko', 'kage', 'suzu', 'hotaru', 'akane'];
    const builds = [[5, 2, 0], [0, 2, 4], [2, 0, 5], [0, 5, 2], [5, 0, 2], [0, 2, 5], [2, 0, 5], [0, 2, 5]];
    const a = run(ids, builds, { frames: 1800, fx: true, strict: false });
    const b = run(ids, builds, { frames: 1800, fx: false });
    expect(digest(a.sim)).toBe(digest(b.sim));
    expect(a.sim.towers.reduce((s, t) => s + t.turrets.length, 0)).toBeGreaterThan(4);
  });

  it('drones: 1:1 with turrets, leashed, retarget on every shot, blend residual 0', () => {
    const ids = ['chika', 'chika', 'momo', 'miko'];
    const builds = [[5, 2, 0], [0, 2, 4], [0, 0, 0], [0, 0, 0]];
    let maxLeash = 0;
    let shots = 0;
    let wrong = 0;
    run(ids, builds, {
      frames: 2400,
      check(sim, h, events) {
        const drones = h.fxa.ctx.drones;
        let turrets = 0;
        for (const t of sim.towers) turrets += t.turrets.length;
        expect(drones.count).toBe(turrets);
        for (const t of sim.towers) for (const tu of t.turrets) expect(drones.map.has(tu.uid)).toBe(true);
        const st = h.fxa.stats();
        maxLeash = Math.max(maxLeash, st.maxLeash);
        for (const v of drones.list) {
          const g = drones.groups.get(v.towerUid);
          const L = g.L;
          expect(Math.hypot(v.x - g.tower.x, v.y - g.tower.y)).toBeLessThanOrEqual(L + 1e-3);
        }
        for (const ev of events) {
          if (ev.type !== 'attack' || ev.kind !== 'bullet' || ev.turretUid == null) continue;
          shots++;
          const v = drones.map.get(ev.turretUid);
          if (!v || v.shotTarget !== ev.targetUid) wrong++;
        }
        expect(st.maxBlendResidual).toBeLessThan(1e-9);
      },
    });
    expect(shots).toBeGreaterThan(50);
    expect(wrong).toBe(0);
    expect(maxLeash).toBeLessThanOrEqual(1 + 1e-6);
  });

  it('a full wing reads as separate drones: lanes on a shared target, spread out, rarely touching', () => {
    for (const quality of ['high', 'low']) {
      let frames = 0;
      let spread = 0;
      let pairs = 0;
      let close = 0;
      let badLanes = 0;
      run(['chika'], [[5, 2, 0]], {
        frames: 2400,
        quality,
        check(sim, h, events, f) {
          const list = h.fxa.ctx.drones.list;
          if (f < 1200 || list.length < 9) return;
          frames++;
          let cx = 0;
          let cy = 0;
          for (const v of list) {
            cx += v.dx / list.length;
            cy += v.dy / list.length;
          }
          for (const v of list) spread += Math.hypot(v.dx - cx, v.dy - cy) / list.length;
          for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
              pairs++;
              if (Math.hypot(list[i].dx - list[j].dx, list[i].dy - list[j].dy, (list[i].dh - list[j].dh) * 0.7) < 0.25) close++;
            }
          }
          // drones sharing a target hold distinct lanes 0..n-1
          const byTarget = new Map();
          for (const v of list) if (v.targetUid != null) byTarget.set(v.targetUid, [...(byTarget.get(v.targetUid) || []), v]);
          for (const vs of byTarget.values()) {
            const lanes = vs.map((v) => v.lane).sort((a, b) => a - b);
            if (vs.some((v) => v.laneN !== vs.length) || lanes.some((l, k) => l !== k)) badLanes++;
          }
        },
      });
      expect(frames, quality).toBeGreaterThan(600);
      expect(badLanes, quality).toBe(0);
      // before the lanes: high 0.80 tiles / 4.2 % of pairs touching, low 0.53 / 28 %
      expect(spread / frames, quality).toBeGreaterThan(quality === 'high' ? 1.0 : 0.8);
      expect(close / pairs, quality).toBeLessThan(quality === 'high' ? 0.025 : 0.08);
    }
  });

  it('flourishes only on matched hits/explosions; pools drain after selling everything', () => {
    const ids = ['akane', 'sango', 'midori', 'nami', 'yuki', 'momo', 'miko', 'aoi'];
    const builds = ids.map(() => [0, 0, 0]);
    const { sim, h } = run(ids, builds, { frames: 1200 });
    const st = h.fxa.stats();
    expect(st.impacts).toBeGreaterThan(10);
    expect(st.impacts).toBeLessThanOrEqual(st.matched);
    for (const t of [...sim.towers]) sim.sellTower(t.uid);
    for (let f = 0; f < 240; f++) h.frame(1 / 60, 1);
    const ctx = h.fxa.ctx;
    expect(sim.projectiles.length).toBe(0);
    expect(ctx.drones.count).toBe(0);
    expect(ctx.drones.groups.size).toBe(0);
    expect(h.fxa.stats().projTracked).toBe(0);
    expect(h.fxa.stats().styled).toBe(0);
    expect(ctx.pool.count).toBe(0);
    expect(ctx.segs.count).toBe(0);
    expect(ctx.toss.live.length).toBe(0);
  });

  it('style hooks never write to sim objects (strict mode: frozen clones)', () => {
    const ids = ORDER.slice(0, 10);
    const builds = ids.map((_, i) => [BUILDS.p0, BUILDS.p1, BUILDS.p2][i % 3]);
    expect(() => run(ids, builds, { frames: 600, strict: true })).not.toThrow();
    const ids2 = ORDER.slice(10);
    const builds2 = ids2.map((_, i) => [BUILDS.p2, BUILDS.p0, BUILDS.p1][i % 3]);
    expect(() => run(ids2, builds2, { frames: 600, strict: true })).not.toThrow();
  });

  it('pulse hit attribution is precise (≥ 98%) against the real hits of each girl', () => {
    const ids = ['hotaru', 'umeko', 'rei', 'hikari', 'shiro', 'akane', 'aoi', 'yuki'];
    const builds = ids.map(() => [0, 0, 0]);
    const sim = gallerySim(ids, builds, 7);
    // test-only: tag each hit event with the tower that dealt it (events are output, not sim state)
    const orig = sim._hit;
    sim._hit = function hit(e, tower, spec, scale) {
      const n = this.events.length;
      const r = orig.call(this, e, tower, spec, scale);
      for (let k = n; k < this.events.length; k++) if (this.events[k].type === 'hit' && this.events[k].uid === e.uid) this.events[k]._tower = tower ? tower.uid : null;
      return r;
    };
    const feed = streamer(sim);
    const out = [];
    let total = 0;
    let right = 0;
    for (let f = 0; f < 3600; f++) {
      feed(1 / 20);
      sim.update(1 / 20);
      const events = sim.drainEvents();
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.type !== 'pulse') continue;
        const t = sim.getTower(ev.towerUid);
        victimsFor(events, i, ev.x, ev.y, ev.radius, ev.attackType, t.eff.maxTargets, out);
        for (const uid of out) {
          let j = i - 1;
          while (j >= 0 && !(events[j].type === 'hit' && events[j].uid === uid)) j--;
          total++;
          if (j >= 0 && events[j]._tower === ev.towerUid) right++;
        }
      }
    }
    expect(total).toBeGreaterThan(200);
    expect(right / total).toBeGreaterThanOrEqual(0.98);
  });

  for (const q of ['high', 'low']) {
    it(`every girl × every build runs without errors and within the quad budget (${q})`, () => {
      for (const [name, b] of Object.entries(BUILDS)) {
        const builds = ORDER.map(() => b);
        let maxQuads = 0;
        const { sim } = run(ORDER, builds, {
          frames: 360,
          quality: q,
          check(sim, h) {
            maxQuads = Math.max(maxQuads, h.fxa.stats().quads);
          },
        });
        expect(sim.placedIds.length, 'all 19 girls placed').toBe(ORDER.length);
        const budget = q === 'high' ? 900 : 250;
        // core cues (drones, shadows, projectiles' reticles, tracers) are never shed; the rest is
        expect(maxQuads, `${name} ${q}`).toBeLessThanOrEqual(budget + 200);
      }
    });
  }
});
