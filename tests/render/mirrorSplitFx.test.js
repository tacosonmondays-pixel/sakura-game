// A mirror's split copy on the board (src/render/attackFx/index.js splitCopies; src/sim/mirrors.js): the copy is drawn
// leaving the point where the shot crossed the glass, not the shooter (her hand, her panel or a drone), and it never
// kicks a panel's flip (no mirrors.shot for a copy). Real Sim (the fixture map, real girls) under the real attack-FX
// layer (tests/render/attackFxHarness.js).
import { describe, it, expect } from 'vitest';
import { harness } from './attackFxHarness.js';
import { Sim } from '../../src/sim/Sim.js';
import { STAGE, testData } from '../sim/fixtures.js';
import { defaultData } from '../../src/sim/data.js';
import { abilityPathOf } from '../../src/sim/abilities.js';
import { spawnProjectile } from '../../src/sim/towers.js';

const D = defaultData();
const QUIET = { ...STAGE, waves: 5, waveGen: { pool: [], budget: { start: 1, growth: 1 } } };

function board(girls) {
  const sim = new Sim({ stageId: QUIET.id, seed: 5, loadout: [{ unitId: 'iroha' }, { unitId: 'aoi' }], data: testData({ stage: QUIET, units: D.units, enemies: D.enemies }) });
  sim.cash = 1e9;
  const ts = girls.map(([id, x, y, tier]) => {
    const t = sim.placeTower(id, x, y);
    expect(t, `${id} at ${x},${y}`).toBeTruthy();
    for (let i = 0; i < tier; i++) expect(sim.upgradeTower(t.uid, abilityPathOf(t.def))).toBe(true);
    return t;
  });
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'orc_grunt' }];
  sim._spawnIndex = 0;
  const park = (x) => {
    const e = sim.spawnEnemy('orc_grunt', { dist: x + 0.5, hpMul: 1e5 });
    e.baseSpeed = 0;
    e.speed = 0;
    return e;
  };
  return { sim, ts, park };
}

/** The harness's frame, keeping what attackFx draws for each projectile (its drawn spot, or the sim's when untouched). */
function framer(h, sim) {
  const list = Object.values(h.batches);
  return (dt, onEvents) => {
    sim.update(dt);
    const events = sim.drainEvents();
    onEvents?.(events);
    for (const b of list) b.begin();
    for (let i = 0; i < events.length; i++) h.fxa.onEvent(events[i], i, events);
    h.actors.sync();
    const drawn = new Map();
    for (const p of sim.projectiles) {
      const pv = h.fxa.projectile(p, dt);
      drawn.set(p.uid, pv ? { x: pv.x, y: pv.y } : { x: p.x, y: p.y });
    }
    h.fxa.update(dt);
    h.fx.update(dt);
    for (const b of list) b.end();
    return { events, drawn };
  };
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

describe('a mirror split copy on the board', () => {
  it('an ally\'s arrow splits at Iroha\'s reflecting panel: the copy is drawn at the crossing on its first frame, not at the shooter', () => {
    const { sim, ts: [iroha, aoi], park } = board([['iroha', 8.5, 2.5, 3], ['aoi', 8.5, 6.5, 0]]);
    iroha.cooldown = 1e9;
    aoi.cooldown = 1e9;
    const e = park(8.5);
    park(10.5);
    const h = harness(sim);
    const calls = [];
    h.fxa.ctx.mirrors = { shot: (uid) => calls.push(uid), shifting: () => true };
    const frame = framer(h, sim);
    frame(1 / 60);
    iroha.abil.cd = 0;
    expect(sim.castAbility(iroha.uid, { aim: [8.5, 5.5] }).ok).toBe(true);
    spawnProjectile(sim, aoi, aoi.eff, e, aoi.x, aoi.y);
    let checked = 0;
    for (let f = 0; f < 30 && !checked; f++) {
      const { events, drawn } = frame(1 / 60);
      for (const s of events.filter((x) => x.type === 'mirrorSplit')) {
        const at = drawn.get(s.copyUid);
        if (!at) continue; // (a copy that landed inside its first step is never drawn)
        expect(s.ownerUid).toBe(aoi.uid);
        expect(dist(at, s)).toBeLessThan(0.5); // at the crossing (moved at most one step on)
        expect(dist(at, aoi)).toBeGreaterThan(0.6); // never at the shooter
        checked++;
      }
    }
    expect(checked).toBe(1);
    expect(calls).toEqual([]); // (Aoi has no panel; Iroha's was silent: no flip at all)
  });

  it('another Iroha\'s stand shot splits at the first one\'s panel: its copy never kicks her own panel (mirrors.shot only for her real panel bolts)', () => {
    // A reflects (Mirror Shift's window, aimed on B's line to the road); B's panel stands right by the crossing
    const { sim, ts: [a, b], park } = board([['iroha', 8.5, 2.5, 3], ['iroha', 6.5, 3.5, 3]]);
    a.cooldown = 1e9;
    park(8.5);
    park(10.5);
    const h = harness(sim);
    const calls = [];
    h.fxa.ctx.mirrors = { shot: (uid) => calls.push(uid), shifting: () => false };
    const frame = framer(h, sim);
    frame(1 / 60);
    sim.setAim(b.uid, 8.2, 3.7);
    a.abil.cd = 0;
    expect(sim.castAbility(a.uid, { aim: [8.5, 4] }).ok).toBe(true);
    calls.length = 0; // (the setup frame's bolts left her un-aimed panel)
    const copies = new Set();
    const known = new Set(sim.projectiles.map((p) => p.uid));
    let panelBolts = 0;
    let drawnCopies = 0;
    for (let f = 0; f < 240; f++) {
      const { events, drawn } = frame(1 / 60, (evs) => {
        for (const s of evs) if (s.type === 'mirrorSplit') copies.add(s.copyUid);
      });
      for (const p of sim.projectiles) {
        if (known.has(p.uid)) continue;
        known.add(p.uid);
        if (p.ownerUid !== b.uid || copies.has(p.uid)) continue;
        // a bolt of B's own: from her panel (born split) or from where she stands
        const vl = Math.hypot(p.vx, p.vy) || 1;
        const start = { x: p.x - (p.vx / vl) * p.travel, y: p.y - (p.vy / vl) * p.travel };
        if (dist(start, { x: b.ox, y: b.oy }) < dist(start, b)) panelBolts++;
      }
      for (const s of events.filter((x) => x.type === 'mirrorSplit')) {
        const at = drawn.get(s.copyUid);
        if (!at) continue;
        expect(dist(at, s)).toBeLessThan(0.5);
        drawnCopies++;
      }
    }
    const bCopies = [...copies].length;
    expect(bCopies).toBeGreaterThan(0);
    expect(drawnCopies).toBeGreaterThan(0);
    // her panel flips once per bolt that really left it: the copies (born by her panel, nearer it than her hand) add none
    expect(panelBolts).toBeGreaterThan(0);
    expect(calls.filter((u) => u === b.uid).length).toBe(panelBolts);
    expect(calls.filter((u) => u === a.uid)).toEqual([]);
  });
});
