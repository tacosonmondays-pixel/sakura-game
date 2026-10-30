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

  it('another Iroha\'s bolts never split at the first one\'s mirrors, and leaving her hand they kick no panel', () => {
    // A reflects (her Laser Web), B's bolts route through her own mirrors right beside A's
    const { sim, ts: [a, b], park } = board([['iroha', 8.5, 2.5, 3], ['iroha', 6.5, 3.5, 3]]);
    a.cooldown = 1e9;
    park(8.5);
    park(10.5);
    const h = harness(sim);
    const calls = [];
    h.fxa.ctx.mirrors = { shot: (uid) => calls.push(uid), shifting: () => false };
    const frame = framer(h, sim);
    frame(1 / 60);
    a.abil.cd = 0;
    expect(sim.castAbility(a.uid).ok).toBe(true);
    let splits = 0;
    let bounces = 0;
    for (let f = 0; f < 240; f++) {
      const { events } = frame(1 / 60);
      for (const s of events) {
        if (s.type === 'mirrorSplit') splits++;
        if (s.type === 'mirrorBounce' && s.ownerUid === b.uid) bounces++;
      }
    }
    expect(bounces).toBeGreaterThan(0);
    expect(splits).toBe(0);
    expect(calls).toEqual([]);
  });
});
