// Iroha's ⚡ Mirror Shift and its tier-5 Infinite Reflection (deploy 'mirror', src/sim/mirrors.js; ABILITIES_SPEC §5.2,
// UNIT_GAPS §4.1): the unlock and its gate, the aim point against the auto pick (the road spot nearest the leader in
// her mirror's reach), the 8 s window, a shot that crosses the mirror splitting once (the copy at the next target, else
// fanned at the same one; copies never split; two mirrors still one split), damage credit to the shooter (a partner's
// girl too), Infinite Reflection (the panel reflects for good, the cast adds a second mirror for 10 s), a snapshot taken
// mid-ability, and determinism. Real girls and enemies on the fixture map (a straight road along y 4.5).
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STAGE, testData } from './fixtures.js';
import { STEP, MIRROR_RADIUS, SPLIT_FAN } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { ABILITIES, abilityRuns, abilityAtTier } from '../../src/data/abilities.js';
import { abilityPathOf, abilityReach, handlerOf } from '../../src/sim/abilities.js';
import { spawnProjectile } from '../../src/sim/towers.js';
import { panelReflects, collectMirrors } from '../../src/sim/mirrors.js';
import { snapshotSim, restoreSim, snapshotDigest } from '../../src/sim/snapshot.js';
import { hashSim } from '../../src/online/coop/simHash.js';

const D = defaultData();
const QUIET = { ...STAGE, waves: 5, waveGen: { pool: [], budget: { start: 1, growth: 1 } } };
const ROAD_Y = 4.5;
const SHIFT = ABILITIES.iroha[0];
const WINDOW = Math.round(SHIFT.duration / STEP); // 480 ticks
const WINDOW5 = Math.round(SHIFT.t5.duration / STEP); // 600 ticks

const opts = (seed) => ({ stageId: QUIET.id, seed, loadout: [{ unitId: 'iroha' }, { unitId: 'aoi' }], data: testData({ stage: QUIET, units: D.units, enemies: D.enemies }) });
function mk(seed = 5) {
  const sim = new Sim(opts(seed));
  sim.cash = 1e9;
  return sim;
}
/** A girl at (x, y), her ⚡ path (Iroha: Mirror Hall) at `tier`; `owner` her player. */
function girl(sim, id, x, y, { tier = 3, owner = 0 } = {}) {
  const t = sim.placeTower(id, x, y, { owner });
  expect(t, `${id} at ${x},${y}`).toBeTruthy();
  const p = abilityPathOf(t.def);
  for (let i = 0; i < tier; i++) expect(sim.upgradeTower(t.uid, p, { restoring: true }), `${id} tier ${i + 1}`).toBe(true);
  return t;
}
/** A wave with nothing scheduled (the grid is built by one step). */
function wave(sim) {
  sim.state = 'wave';
  sim.wave = Math.max(1, sim.wave);
  sim._spawnQueue = [{ t: 1e9, enemy: 'orc_grunt' }]; // keeps the wave running
  sim._spawnIndex = 0;
}
/** A parked enemy on the road at x. */
function at(sim, x, { hpMul = 50, id = 'orc_grunt' } = {}) {
  const e = sim.spawnEnemy(id, { dist: x + 0.5, hpMul });
  e.baseSpeed = 0;
  e.speed = 0;
  return e;
}
const silence = (...ts) => ts.forEach((t) => (t.cooldown = 1e9));
const ready = (t) => {
  t.abil.cd = 0;
  t.abil.active = 0;
};
/** Steps `n` ticks, collecting the events. */
function steps(sim, n, out = []) {
  for (let i = 0; i < n; i++) {
    sim._step(STEP);
    for (const ev of sim.drainEvents()) out.push(ev);
  }
  return out;
}
const of = (evs, type) => evs.filter((e) => e.type === type);

/** Iroha up the road (8.5, 2.5) and Aoi below it (8.5, 6.5), both silent; leader at x 8.5 and one more at 10.5. */
function lane({ tier = 3 } = {}) {
  const sim = mk();
  const iroha = girl(sim, 'iroha', 8.5, 2.5, { tier });
  const aoi = girl(sim, 'aoi', 8.5, 6.5, { tier: 0 });
  silence(iroha, aoi);
  wave(sim);
  const e = at(sim, 8.5);
  const e2 = at(sim, 10.5);
  steps(sim, 1);
  ready(iroha);
  return { sim, iroha, aoi, e, e2 };
}
/** One of Aoi's arrows from where she stands at `tgt`. */
const arrow = (sim, aoi, tgt) => spawnProjectile(sim, aoi, aoi.eff, tgt, aoi.x, aoi.y);

// ---------------------------------------------------------------------------------------------------------------
describe('Mirror Shift: the unlock, the button and the gate', () => {
  test('a deploy of type mirror that runs (no "later" teaser), base and tier 5', () => {
    expect(SHIFT).toMatchObject({ id: 'iroha.mirrorShift', kind: 'deploy', path: 'hall', unlockTier: 3, cooldown: 30, duration: 8 });
    expect(abilityRuns(SHIFT)).toBe(true);
    expect(abilityRuns(abilityAtTier(SHIFT, 5))).toBe(true);
    expect(handlerOf(SHIFT)).toBeTruthy();
    expect(abilityAtTier(SHIFT, 5)).toMatchObject({ cooldown: 25, duration: 10, effect: { count: 2, permanentReflect: true } });
  });

  test('locked below Mirror Hall tier 3; at tier 3 it unlocks with a third of its cooldown left and looks over her mirror\'s reach', () => {
    const sim = mk();
    const t = girl(sim, 'iroha', 8.5, 2.5, { tier: 2 });
    expect(t.abil).toBeUndefined();
    expect(sim.abilityStatus(t.uid)).toMatchObject({ id: 'iroha.mirrorShift', unlocked: false });
    expect(sim.upgradeTower(t.uid, abilityPathOf(t.def))).toBe(true);
    expect(t.abil).toMatchObject({ id: 'iroha.mirrorShift', kind: 'deploy', cdMax: 30 * 60 * 100, cd: 10 * 60 * 100 });
    expect(sim.abilityStatus(t.uid)).toMatchObject({ unlocked: true, later: false, duration: 8 });
    expect(abilityReach(t, SHIFT)).toBe(t.stats.relay.reach);
  });

  test('refusals spend nothing: not in a wave, on cooldown, while it runs, and with no aim and nobody in her reach', () => {
    const sim = mk();
    const t = girl(sim, 'iroha', 8.5, 2.5);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).reason).toBe('notWave');
    wave(sim);
    steps(sim, 1);
    // nobody on the road and no aim: nothing to jump to
    expect(sim.castAbility(t.uid).reason).toBe('noTarget');
    expect(t.abil.cd).toBe(0);
    at(sim, 30); // off the far end: out of her reach
    steps(sim, 1);
    expect(sim.castAbility(t.uid).reason).toBe('noTarget');
    // an aim needs no enemy (she places the mirror on purpose)
    expect(sim.castAbility(t.uid, { aim: [9, 4] }).ok).toBe(true);
    expect(sim.castAbility(t.uid).reason).toBe('active');
    t.abil.active = 0;
    expect(sim.castAbility(t.uid).reason).toBe('cooldown');
  });
});

describe('where the mirror goes', () => {
  test('to her aim point (quantised, clamped to her mirror\'s reach), which becomes her aim: relay, aim and ability events', () => {
    const { sim, iroha } = lane();
    expect(iroha.ox).toBe(8.5);
    expect(iroha.oy).toBeCloseTo(3.8, 9); // the un-aimed panel: 0.7 short of the road
    expect(sim.castAbility(iroha.uid, { aim: [7.25, 5.5] }).ok).toBe(true);
    expect(iroha.aim).toEqual({ x: 7.25, y: 5.5 });
    expect([iroha.ox, iroha.oy]).toEqual([7.25, 5.5]);
    const evs = sim.drainEvents();
    expect(of(evs, 'relay')).toEqual([{ type: 'relay', towerUid: iroha.uid, x: 7.25, y: 5.5, kind: 'mirror' }]);
    expect(of(evs, 'aim')).toEqual([{ type: 'aim', towerUid: iroha.uid, x: 7.25, y: 5.5 }]);
    expect(of(evs, 'ability')[0]).toMatchObject({ id: 'iroha.mirrorShift', kind: 'deploy', x: 7.25, y: 5.5, radius: iroha.stats.relay.reach, placed: 1, mirror: 'panel' });
    // far away: clamped onto her reach circle
    ready(iroha);
    expect(sim.castAbility(iroha.uid, { aim: [8.5, 8.9] }).ok).toBe(true);
    expect(Math.hypot(iroha.ox - iroha.x, iroha.oy - iroha.y)).toBeCloseTo(iroha.stats.relay.reach, 9);
    // the panel stays after the window (the cast moved it)
    steps(sim, WINDOW + 1);
    expect(iroha.abil.active).toBe(0);
    expect(iroha.oy).toBeCloseTo(iroha.y + iroha.stats.relay.reach, 9);
  });

  test('an un-aimed cast (a tap or Auto) keeps the panel her player placed and opens the window there; with no placed aim it goes to the leader', () => {
    const { sim, iroha } = lane();
    at(sim, 11.5);
    steps(sim, 1);
    expect(sim.setAim(iroha.uid, 7.5, 5.25)).toBe(true);
    const placed = { ...iroha.aim };
    sim.drainEvents();
    ready(iroha);
    expect(sim.castAbility(iroha.uid).ok).toBe(true);
    expect(iroha.aim).toEqual(placed);
    expect([iroha.ox, iroha.oy]).toEqual([placed.x, placed.y]);
    expect(iroha.abil.active).toBe(WINDOW);
    const evs = sim.drainEvents();
    expect(of(evs, 'relay')).toEqual([]); // no jump
    expect(of(evs, 'ability')[0]).toMatchObject({ x: placed.x, y: placed.y, mirror: 'panel' });
    // Auto does the same: it never moves the placed panel (its rule: 5 enemies in her mirror's reach)
    for (const x of [9, 9.5, 10]) at(sim, x);
    ready(iroha);
    sim.setAbilityAuto(iroha.uid, true);
    steps(sim, 12);
    expect(iroha.abil.n).toBe(2);
    expect(iroha.aim).toEqual(placed);
    // an aimed tap still moves it; clearing her aim lets the next un-aimed cast go to the leader's road spot
    ready(iroha);
    sim.setAbilityAuto(iroha.uid, false);
    expect(sim.castAbility(iroha.uid, { aim: [9, 5] }).ok).toBe(true);
    expect(iroha.aim).toEqual({ x: 9, y: 5 });
    sim.clearAim(iroha.uid);
    ready(iroha);
    expect(sim.castAbility(iroha.uid).ok).toBe(true);
    expect(iroha.oy).toBeCloseTo(ROAD_Y, 6);
    expect(iroha.ox).toBeCloseTo(11.5, 6); // the leader (at 11.5) stands on the road
  });

  test('without an aim: the road spot nearest the leader (Front of the line) within her mirror\'s reach', () => {
    const { sim, iroha } = lane();
    const lead = at(sim, 11.5); // further along than 8.5 and 10.5, still within 3.7 of her
    steps(sim, 1);
    ready(iroha);
    expect(sim.castAbility(iroha.uid).ok).toBe(true);
    expect(iroha.ox).toBeCloseTo(lead.x, 6);
    expect(iroha.oy).toBeCloseTo(ROAD_Y, 6);
    // an enemy past her reach is never the leader
    const far = mk();
    const t = girl(far, 'iroha', 8.5, 2.5);
    wave(far);
    at(far, 14.5);
    const near = at(far, 9.5);
    steps(far, 1);
    ready(t);
    expect(far.castAbility(t.uid).ok).toBe(true);
    expect([t.ox, t.oy]).toEqual([near.x, ROAD_Y].map((v) => expect.closeTo(v, 6)));
  });
});

describe('the reflection', () => {
  test('an ally shot that crosses the mirror splits once: the original flies on, the copy goes at the next target', () => {
    const { sim, iroha, aoi, e, e2 } = lane();
    sim.castAbility(iroha.uid, { aim: [8.5, 5.5] }); // between Aoi and the leader
    sim.drainEvents();
    const p = arrow(sim, aoi, e);
    const evs = steps(sim, 8);
    const splits = of(evs, 'mirrorSplit');
    expect(splits.length).toBe(1);
    const s = splits[0];
    expect(s).toMatchObject({ uid: p.uid, ownerUid: aoi.uid, mirrorUid: iroha.uid, targetUid: e2.uid });
    expect(Math.hypot(s.x - 8.5, s.y - 5.5)).toBeLessThanOrEqual(MIRROR_RADIUS + 1e-9);
    expect(p.split).toBe(true);
    const copy = [...sim.projectiles, p].find((q) => q.uid === s.copyUid) || null;
    // (the copy may already have landed: its hit is on Aoi's record either way)
    if (copy) expect(copy).toMatchObject({ split: true, owner: aoi, ownerUid: aoi.uid, target: e2 });
    steps(sim, 60);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(e2.hp).toBeLessThan(e2.maxHp);
    // her own bolts were silent: every point of damage is Aoi's (two arrows' worth)
    expect(iroha.damageDealt || 0).toBe(0);
    expect(aoi.damageDealt).toBeCloseTo((e.maxHp - e.hp) + (e2.maxHp - e2.hp), 6);
  });

  test('with no other target the copy flies at the same one, fanned to one side; with no live target nothing is copied', () => {
    const sim = mk();
    const iroha = girl(sim, 'iroha', 8.5, 2.5);
    const aoi = girl(sim, 'aoi', 8.5, 6.5, { tier: 0 });
    silence(iroha, aoi);
    wave(sim);
    const e = at(sim, 8.5);
    steps(sim, 1);
    // one arrow without a mirror on its way (the un-aimed panel stands off her line)
    let hp = e.hp;
    arrow(sim, aoi, e);
    expect(of(steps(sim, 30), 'mirrorSplit')).toEqual([]);
    const one = hp - e.hp;
    expect(one).toBeGreaterThan(0);
    ready(iroha);
    sim.castAbility(iroha.uid, { aim: [8.5, 5.5] });
    hp = e.hp;
    const p = arrow(sim, aoi, e);
    const s = of(steps(sim, 8), 'mirrorSplit');
    expect(s.length).toBe(1);
    expect(s[0].targetUid).toBe(e.uid);
    const copy = sim.projectiles.find((q) => q.uid === s[0].copyUid);
    // fanned: its first heading is off the straight line from the crossing point (SPLIT_FAN to one side)
    if (copy && copy.travel <= copy.speed * STEP + 1e-9) expect(Math.abs(copy.vx)).toBeGreaterThan(0);
    steps(sim, 60);
    expect(hp - e.hp).toBeCloseTo(2 * one, 6); // both arrows hit it
    expect(SPLIT_FAN).toBeGreaterThan(0);
    // a shot whose target is gone (a splash-less arrow keeps flying straight) crosses and copies nothing
    e.dead = true;
    const q = arrow(sim, aoi, at(sim, 8.5, { hpMul: 50 }));
    q.target.dead = true;
    expect(of(steps(sim, 8), 'mirrorSplit')).toEqual([]);
    expect(q.split).toBe(true);
    expect(p.split).toBe(true);
  });

  test('copies never split, and two mirrors on one line still split a shot once (tier 5)', () => {
    const { sim, iroha, aoi, e } = lane({ tier: 5 });
    sim.castAbility(iroha.uid, { aim: [8.5, 5.0] }); // tier 5: a second mirror there, the panel stays
    expect(iroha.mirror2).toEqual({ x: 8.5, y: 5 });
    sim.setAim(iroha.uid, 8.5, 5.75); // the panel too, on the same line
    sim.drainEvents();
    expect(collectMirrors(sim)).toBe(2);
    const p = arrow(sim, aoi, e);
    const splits = of(steps(sim, 12), 'mirrorSplit');
    expect(splits.map((s) => s.uid)).toEqual([p.uid]);
    // a full stretch of both girls firing through both mirrors: every shot splits at most once, no copy ever does (Aoi's
    // only: a mirror never splits its owner's shots; the leader alone stays, on Aoi's line through both mirrors)
    for (const x of sim.enemies) if (x !== e) x.dead = true;
    iroha.cooldown = 0;
    aoi.cooldown = 0;
    const all = of(steps(sim, 300), 'mirrorSplit');
    expect(all.length).toBeGreaterThan(5);
    const uids = all.map((s) => s.uid);
    expect(new Set(uids).size).toBe(uids.length);
    const copies = new Set(all.map((s) => s.copyUid));
    for (const u of uids) expect(copies.has(u)).toBe(false);
    for (const q of sim.projectiles) if (copies.has(q.uid)) expect(q.split).toBe(true);
  });

  test('the 8 s window: shots split while it runs, not after (below tier 5)', () => {
    const { sim, iroha, aoi, e } = lane();
    sim.castAbility(iroha.uid, { aim: [8.5, 5.5] });
    expect(iroha.abil.active).toBe(WINDOW);
    expect(panelReflects(iroha)).toBe(true);
    steps(sim, WINDOW - 10);
    expect(panelReflects(iroha)).toBe(true);
    arrow(sim, aoi, e);
    expect(of(steps(sim, 8), 'mirrorSplit').length).toBe(1);
    const evs = steps(sim, 3);
    expect(of(evs, 'abilityEnd')).toEqual([{ type: 'abilityEnd', towerUid: iroha.uid, id: 'iroha.mirrorShift' }]);
    expect(panelReflects(iroha)).toBe(false);
    expect(collectMirrors(sim)).toBe(0);
    arrow(sim, aoi, e);
    expect(of(steps(sim, 8), 'mirrorSplit')).toEqual([]);
    expect([iroha.ox, iroha.oy]).toEqual([8.5, 5.5]); // the panel stays where it jumped
  });

  test('her own bolts never split at her own mirror (panel or tier 5\'s second); a partner\'s girl\'s shots count as ally shots and stay theirs', () => {
    const sim = mk();
    const iroha = girl(sim, 'iroha', 8.5, 2.5, { tier: 5 });
    const aoi = girl(sim, 'aoi', 8.5, 6.5, { tier: 0, owner: 1 }); // the other player's girl
    silence(aoi);
    wave(sim);
    const e = at(sim, 8.5);
    at(sim, 10.5);
    steps(sim, 1);
    ready(iroha);
    // the panel reflects for good (tier 5) and the cast adds a second mirror right on her bolts' way to the road
    sim.setAim(iroha.uid, 8.5, 5.5);
    sim.castAbility(iroha.uid, { aim: [8.5, 4] });
    expect(collectMirrors(sim)).toBe(2);
    iroha.cooldown = 0; // she fires, from her panel and from where she stands, through both mirrors
    const fired = of(steps(sim, 120), 'attack').filter((x) => x.towerUid === iroha.uid).length;
    expect(fired).toBeGreaterThan(1);
    expect(of(steps(sim, 1), 'mirrorSplit')).toEqual([]);
    const own = of(steps(sim, 120), 'mirrorSplit');
    expect(own).toEqual([]);
    expect(sim.projectiles.filter((p) => p.ownerUid === iroha.uid).every((p) => !p.split)).toBe(true);
    // an ally's shot through the same glass splits, and stays hers
    silence(iroha);
    steps(sim, 60);
    const before = { iroha: iroha.damageDealt, aoi: aoi.damageDealt || 0, hp: sim.enemies.map((x) => x.hp) };
    arrow(sim, aoi, e);
    const s = of(steps(sim, 60), 'mirrorSplit');
    expect(s.map((x) => x.ownerUid)).toEqual([aoi.uid]);
    expect(iroha.damageDealt).toBe(before.iroha);
    // both arrows landed (on the leader and, the copy, on the next one) and on her record
    const lost = sim.enemies.map((x, i) => before.hp[i] - x.hp);
    expect(lost.every((v) => v > 0)).toBe(true);
    expect(aoi.damageDealt - before.aoi).toBeCloseTo(lost[0] + lost[1], 6);
  });

  test('another Iroha\'s mirror splits the shots she fires from where she stands (her own mirror never does)', () => {
    const sim = new Sim({ ...opts(5), loadout: [{ unitId: 'iroha' }, { unitId: 'aoi' }] });
    sim.cash = 1e9;
    const a = girl(sim, 'iroha', 8.5, 2.5, { tier: 5 });
    const b = girl(sim, 'iroha', 6.5, 3.5, { tier: 5 });
    silence(b);
    wave(sim);
    at(sim, 8.5);
    at(sim, 10.5);
    steps(sim, 1);
    sim.setAim(a.uid, 8.5, 5.5);
    sim.setAim(b.uid, 8.5, 4.2); // b's panel on a's line to the road
    a.cooldown = 0;
    const splits = of(steps(sim, 200), 'mirrorSplit');
    expect(splits.length).toBeGreaterThan(0);
    for (const x of splits) expect([x.ownerUid, x.mirrorUid]).toEqual([a.uid, b.uid]);
  });

  test('a shot fired from a mirror panel never splits: two Irohas with their panels stacked on one spot split nothing', () => {
    const sim = new Sim({ ...opts(5), loadout: [{ unitId: 'iroha' }, { unitId: 'aoi' }] });
    sim.cash = 1e9;
    const a = girl(sim, 'iroha', 8.5, 2.5, { tier: 5 });
    const b = girl(sim, 'iroha', 6.5, 3.5, { tier: 5 });
    wave(sim);
    // (unkillable: a stand shot whose target fell would fly on straight, through the panels, and rightly split)
    at(sim, 8.5, { hpMul: 1e6 });
    at(sim, 10.5, { hpMul: 1e6 });
    steps(sim, 1);
    // both panels on one spot below the road, both reflecting for good (tier 5); their stand shots (which pierce on) never pass it
    sim.setAim(a.uid, 7, 5.6);
    sim.setAim(b.uid, 7, 5.6);
    expect([a.ox, a.oy]).toEqual([b.ox, b.oy]);
    a.cooldown = 0;
    b.cooldown = 0;
    // (the panel volleys are born split, the stand volleys are not: both are seen in flight)
    const evs = [];
    const seen = { panel: 0, stand: 0 };
    for (let k = 0; k < 300; k++) {
      steps(sim, 1, evs);
      for (const p of sim.projectiles) if (p.ownerUid === a.uid || p.ownerUid === b.uid) seen[p.split ? 'panel' : 'stand']++;
    }
    expect(of(evs, 'attack').filter((x) => x.towerUid === a.uid || x.towerUid === b.uid).length).toBeGreaterThan(4);
    expect(of(evs, 'mirrorSplit')).toEqual([]);
    expect(seen.panel).toBeGreaterThan(0);
    expect(seen.stand).toBeGreaterThan(0);
  });
});

describe('Infinite Reflection (Mirror Hall tier 5)', () => {
  test('the panel reflects for good; the cast adds a second mirror for 10 s and leaves the panel where it stands', () => {
    const { sim, iroha, aoi, e } = lane({ tier: 5 });
    expect(iroha.abil.t5).toBe(true);
    expect(panelReflects(iroha)).toBe(true); // no cast needed
    expect(collectMirrors(sim)).toBe(1);
    const panel = [iroha.ox, iroha.oy];
    expect(sim.castAbility(iroha.uid, { aim: [8.5, 5.5] }).ok).toBe(true);
    const ev = of(sim.drainEvents(), 'ability')[0];
    expect(ev).toMatchObject({ x: 8.5, y: 5.5, placed: 1, mirror: 'second' });
    expect([iroha.ox, iroha.oy]).toEqual(panel);
    expect(iroha.mirror2).toEqual({ x: 8.5, y: 5.5 });
    expect(iroha.abil.active).toBe(WINDOW5);
    expect(collectMirrors(sim)).toBe(2);
    arrow(sim, aoi, e);
    expect(of(steps(sim, 8), 'mirrorSplit')).toHaveLength(1);
    steps(sim, WINDOW5);
    expect(iroha.mirror2).toBeNull();
    expect(collectMirrors(sim)).toBe(1);
    expect(panelReflects(iroha)).toBe(true);
    // the wave clear ends a running second mirror too
    ready(iroha);
    sim.castAbility(iroha.uid, { aim: [9, 5] });
    expect(iroha.mirror2).toBeTruthy();
    for (const x of sim.enemies) x.dead = true;
    sim._spawnIndex = sim._spawnQueue.length;
    steps(sim, 3);
    expect(sim.state).toBe('between');
    expect(iroha.mirror2).toBeNull();
    expect(iroha.abil.active).toBe(0);
  });
});

describe('snapshots and determinism', () => {
  const STEPS = 720; // past the second mirror's 10 s (cast at step 20)
  /** A scripted battle: Iroha T5 and Aoi firing, a cast, shots splitting at two mirrors. */
  function script(seed, { snapAt = -1 } = {}) {
    const sim = mk(seed);
    const iroha = girl(sim, 'iroha', 8.5, 2.5, { tier: 5 });
    girl(sim, 'aoi', 8.5, 6.5, { tier: 2 });
    wave(sim);
    for (let i = 0; i < 6; i++) at(sim, 6 + i, { hpMul: 200 });
    steps(sim, 1);
    ready(iroha);
    let snap = null;
    let snapK = -1;
    let splits = 0;
    for (let k = 0; k < STEPS; k++) {
      if (k === 20) expect(sim.castAbility(iroha.uid, { aim: [8.5, 5.25] }).ok).toBe(true);
      // the first step from `snapAt` on with a split shot in flight
      if (snapAt >= 0 && !snap && k >= snapAt && sim.projectiles.some((p) => p.split)) {
        snap = JSON.parse(JSON.stringify(snapshotSim(sim)));
        snapK = k;
      }
      splits += of(steps(sim, 1), 'mirrorSplit').length;
    }
    return { sim, snap, snapK, splits };
  }

  test('a snapshot taken mid-ability (second mirror up, split shots in flight) restores and runs on identically', () => {
    const live = script(11, { snapAt: 100 });
    expect(live.snapK).toBeGreaterThanOrEqual(100);
    expect(live.snapK).toBeLessThan(20 + WINDOW5);
    // taking the snapshot changes nothing in the battle
    expect(snapshotDigest(snapshotSim(script(11).sim))).toBe(snapshotDigest(snapshotSim(live.sim)));
    // restore the mid-ability snapshot into a fresh Sim and play the same remaining steps
    const copy = restoreSim(new Sim(opts(11)), live.snap);
    const t = copy.towers.find((x) => x.unitId === 'iroha');
    expect(t.mirror2).toEqual({ x: 8.5, y: 5.25 });
    expect(t.abil.active).toBeGreaterThan(0);
    expect(copy.projectiles.some((p) => p.split)).toBe(true);
    for (let k = live.snapK; k < STEPS; k++) steps(copy, 1);
    expect(copy.towers.find((x) => x.unitId === 'iroha').mirror2).toBeNull(); // its 10 s ran out on both
    expect(snapshotDigest(snapshotSim(copy))).toBe(snapshotDigest(snapshotSim(live.sim)));
    expect(hashSim(copy)).toBe(hashSim(live.sim));
  });

  test('the same seed and commands twice give the same battle hash; the splits did happen', () => {
    const a = script(7);
    const b = script(7);
    expect(a.splits).toBeGreaterThan(10);
    expect(b.splits).toBe(a.splits);
    expect(hashSim(b.sim)).toBe(hashSim(a.sim));
    expect(snapshotDigest(snapshotSim(b.sim))).toBe(snapshotDigest(snapshotSim(a.sim)));
  });

  test('a cast draws no rng', () => {
    const { sim, iroha } = lane();
    const next = sim.rng.next.bind(sim.rng);
    let n = 0;
    sim.rng.next = () => {
      n++;
      return next();
    };
    expect(sim.castAbility(iroha.uid).ok).toBe(true);
    sim.rng.next = next;
    expect(n).toBe(0);
  });
});
