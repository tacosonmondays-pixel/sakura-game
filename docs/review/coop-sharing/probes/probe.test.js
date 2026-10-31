// Review r1/r2 probes (not part of the suite): copy into tests/online/ to run; paths assume tests/<dir>/.
import * as require_fs from 'node:fs';
// Co-op sharing (docs/specs/COOP_SHARING.md): coin gifts, lent girls, taking them back, and a leaver's girls and
// coins handed out after the grace. Every case runs the same commands on both players' CoopSims (both views) and
// checks the two agree, as two lockstep clients would.
import { describe, it, expect } from 'vitest';
import { createCoopSim, isValidCmd, KINDS, quantize, abilArgs } from '../../src/online/coop/commands.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { withDetMath } from '../../src/online/coop/detMath.js';
import { abilityPathOf } from '../../src/sim/abilities.js';
import { finalTierOf } from '../../src/sim/finalTier.js';
import { applyCoopResult } from '../../src/online/coop/rewards.js';
import { createRng } from '../../src/core/rng.js';
import { COOP } from '../../src/data/coop.js';
import { CASH_MAX } from '../../src/sim/constants.js';
import { createProfile } from '../../src/systems/save.js';

const start = ({ p0 = {}, p1 = {}, seed = 2025, stageId = '2-5' } = {}) => ({
  seed,
  stageId,
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'aoi', stats: { damageMul: 1.4 } }, { unitId: 'momo' }, { unitId: 'tenka' }, { unitId: 'akane' }], hero: { unitId: 'luna' }, ...p0 },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'rei' }, { unitId: 'miko' }, { unitId: 'aoi' }], hero: null, ...p1 },
  ],
});

let seq = 0;
const cmd = (p, k, a = [], t = 0) => ({ t, p, s: seq++, k, a });
const marker = (p, k) => ({ t: 0, p, s: -1000000 + seq++, k, a: [] });

/** Sets every wallet (through a checkpoint, as a rejoin would). */
function wallets(c, coins) {
  const snap = c.snapshot();
  snap.wallets = snap.wallets.map((_, i) => (Array.isArray(coins) ? coins[i] : coins));
  return c.restore(snap);
}
/** One client of each slot from the same start. */
function views(st = start(), coins = 100000) {
  return [0, 1].map((mySlot) => wallets(createCoopSim(st, { mySlot }), coins));
}
/** The same command on every client; the results, which must agree (and so must the hashes). */
function all(cs, c) {
  const rs = cs.map((x) => x.apply({ ...c }));
  const strip = ({ tower, ...r }) => ({ ...r, tower: tower?.uid ?? null });
  for (const r of rs) expect(strip(r)).toEqual(strip(rs[0]));
  expect(cs[1].hash()).toBe(cs[0].hash());
  return rs[0];
}
function step(cs, n = 1) {
  for (let i = 0; i < n; i++) for (const c of cs) c.step();
  expect(cs[1].hash()).toBe(cs[0].hash());
}
function stepUntil(cs, pred, max = 30000) {
  for (let i = 0; i < max; i++) {
    if (pred(cs[0])) return i;
    for (const c of cs) c.step();
  }
  throw new Error('stepUntil: never');
}
function candidates(c, unitId) {
  return withDetMath(() => {
    const sim = c.sim;
    const out = [];
    for (let y = 0.55; y < sim.map.height; y += 0.35) {
      for (let x = 0.55; x < sim.map.width; x += 0.35) {
        const q = quantize(x, y);
        if (sim.placementReason(unitId, q[0] / 1024, q[1] / 1024)) continue;
        out.push([sim.placement.pathDistance(q[0] / 1024, q[1] / 1024), q]);
      }
    }
    return out.sort((a, b) => a[0] - b[0] || a[1][1] - b[1][1] || a[1][0] - b[1][0]).map((r) => r[1]);
  });
}
function place(cs, slot, unitId, skip = 0) {
  let n = 0;
  for (const q of candidates(cs[0], unitId)) {
    if (n++ < skip) continue;
    const r = all(cs, cmd(slot, 'place', [unitId, ...q]));
    if (r.ok) return r.tower.uid;
  }
  throw new Error(`no spot for ${unitId}`);
}
const tower = (c, uid) => c.sim.getTower(uid);
import { castAbility } from '../../src/sim/abilities.js';
const st2 = () => start({ p0: { loadout: [{ unitId: 'shiro' }, { unitId: 'momo' }, { unitId: 'aoi' }], hero: null } });
function upTo3(cs, slot, uid) {
  const path = abilityPathOf(tower(cs[0], uid).def);
  for (let i = 0; i < 3; i++) expect(all(cs, cmd(slot, 'upg', [uid, path])).ok).toBe(true);
}
describe('review probes', () => {
  it('map-scope shared cooldown: lending a second copy lets the team cast it again at once', () => {
    const cs = views(st2(), [CASH_MAX, CASH_MAX]);
    const u1 = place(cs, 0, 'shiro'); const u2 = place(cs, 0, 'shiro', 3);
    upTo3(cs, 0, u1); upTo3(cs, 0, u2);
    all(cs, cmd(0, 'auto', [true])); all(cs, cmd(0, 'wave'));
    stepUntil(cs, (c) => c.sim.state === 'wave' && c.sim.enemies.length >= 1 && c.sim.abilityStatus(u1).ready);
    const pre = [cs[0].sim.abilityStatus(u1), cs[0].sim.abilityStatus(u2), cs[0].sim.enemies.length];const r1 = all(cs, cmd(0, 'abil', abilArgs(u1)));
    const r2 = all(cs, cmd(0, 'abil', abilArgs(u2)));
    const l = all(cs, cmd(0, 'lend', [u2, 1]));
    const r3 = all(cs, cmd(1, 'abil', abilArgs(u2)));
    const g = all(cs, cmd(1, 'give', [u2]));
    require_fs.appendFileSync("/tmp/probe2.out", 'MAPGROUP' + " " + JSON.stringify({ pre, r1, r2, l, r3, g }) + "\n");
  });
  it('econ cap per wave: lending a third Market Day lets the team cast past the cap', () => {
    const cs = views(st2(), [CASH_MAX, CASH_MAX]);
    const m = [place(cs, 0, 'momo'), place(cs, 0, 'momo', 3), place(cs, 0, 'momo', 6)];
    for (const u of m) upTo3(cs, 0, u);
    all(cs, cmd(0, 'wave'));
    stepUntil(cs, (c) => c.sim.state === 'wave' && m.every((u) => c.sim.abilityStatus(u).ready));
    for (const c of cs) c.wallets; // noop
    for (const c of cs) wallets(c, [1000, 1000]);
    const rs = m.map((u) => all(cs, cmd(0, 'abil', abilArgs(u))));
    all(cs, cmd(0, 'lend', [m[2], 1]));
    const r4 = all(cs, cmd(1, 'abil', abilArgs(m[2])));
    require_fs.appendFileSync("/tmp/probe2.out", 'ECONCAP' + " " + JSON.stringify({ rs, r4, wallets: cs[0].wallets }) + "\n");
  });
  it('edge orders in one tick agree on both views', () => {
    const cs = views(start(), [5000, 5000]);
    const aoi = place(cs, 0, 'aoi');
    const out = {};
    out.spam = [0, 1, 2, 3].map(() => all(cs, cmd(0, 'gift', [1, 10])));
    out.over = all(cs, cmd(1, 'gift', [0, 999999]));
    out.lendThenOwnerUpg = [all(cs, cmd(0, 'lend', [aoi, 1])), all(cs, cmd(0, 'upg', [aoi, 0])), all(cs, cmd(0, 'sell', [aoi]))];
    out.doubleLend = [all(cs, cmd(0, 'lend', [aoi, 1])), all(cs, cmd(1, 'lend', [aoi, 0]))];
    out.give = all(cs, cmd(1, 'give', [aoi]));
    const rei = place(cs, 1, 'rei');
    out.sellThenLend = [all(cs, cmd(1, 'sell', [rei])), all(cs, cmd(1, 'lend', [rei, 0]))];
    const hero = place(cs, 0, 'luna');
    out.hero = all(cs, cmd(0, 'lend', [hero, 1]));
    const tenka = place(cs, 0, 'tenka');
    out.tenka = all(cs, cmd(0, 'lend', [tenka, 1]));
    all(cs, cmd(0, 'wave'));
    out.lendWave = all(cs, cmd(0, 'lend', [aoi, 1]));
    out.backWave = all(cs, cmd(0, 'back', [aoi]));
    // leaver issues orders during grace
    out.goneSame = [all(cs, marker(1, 'gone')), all(cs, cmd(0, 'lend', [tenka, 1]))];
    out.leaverGift = all(cs, cmd(1, 'gift', [0, 50]));
    out.backWaveCtrlGone = all(cs, cmd(0, 'back', [aoi]));
    all(cs, cmd(0, 'lend', [aoi, 1]));
    out.giveAfterOwnerGone = (all(cs, marker(1, 'join')), all(cs, cmd(0, 'lend', [aoi, 1])));
    all(cs, marker(0, 'gone'));
    out.giveOwnerGone = all(cs, cmd(1, 'give', [aoi]));
    step(cs, COOP.graceTicks + 2);
    out.afterGrace = [all(cs, cmd(0, 'upg', [aoi, 0])), all(cs, cmd(0, 'gift', [1, 10])), cs[0].wallets];
    out.joinAfter = [all(cs, marker(0, 'join')), cs[0].ctrlOf(aoi), cs[0].lentInfo(aoi)];
    require_fs.appendFileSync("/tmp/probe2.out", 'EDGES' + " " + JSON.stringify(out) + "\n");
  });
  it('speed change during the grace', () => {
    const cs = views(start(), [5000, 5000]);
    all(cs, cmd(0, 'speed', [1]));
    all(cs, marker(1, 'gone'));
    const pd1 = cs[0].pendingDeals();
    all(cs, cmd(0, 'speed', [3]));
    require_fs.appendFileSync("/tmp/probe2.out", 'SPEED' + " " + JSON.stringify({ pd1, speed: cs[0].speed, pd2: cs[0].pendingDeals() }) + "\n");
  });
});

const log2 = (k, v) => require_fs.appendFileSync('/tmp/probe2.out', k + ' ' + JSON.stringify(v) + '\n');
function twoShiro(cs) {
  const u1 = place(cs, 0, 'shiro'); const u2 = place(cs, 0, 'shiro', 3);
  upTo3(cs, 0, u1); upTo3(cs, 0, u2);
  all(cs, cmd(0, 'auto', [true])); all(cs, cmd(0, 'wave'));
  stepUntil(cs, (c) => c.sim.state === 'wave' && c.sim.enemies.length >= 1 && c.sim.abilityStatus(u1).ready && c.sim.abilityStatus(u2).ready);
  return [u1, u2];
}
describe('r2 probes', () => {
  it('lend FIRST, then cast through the lent copy, then the home copy', () => {
    const cs = views(st2(), [CASH_MAX, CASH_MAX]);
    const [u1, u2] = twoShiro(cs);
    const l = all(cs, cmd(0, 'lend', [u2, 1]));
    const a = all(cs, cmd(1, 'abil', abilArgs(u2)));
    const b = all(cs, cmd(0, 'abil', abilArgs(u1)));
    const g = all(cs, cmd(1, 'give', [u2]));
    log2('LENDFIRST', { l, a, b, g });
  });
  it('cast, lend, give, back, re-lend across a wave boundary', () => {
    const cs = views(st2(), [CASH_MAX, CASH_MAX]);
    const [u1, u2] = twoShiro(cs);
    const out = {};
    out.cast1 = all(cs, cmd(0, 'abil', abilArgs(u1)));
    out.lend = all(cs, cmd(0, 'lend', [u2, 1]));
    out.castLent = all(cs, cmd(1, 'abil', abilArgs(u2)));
    out.give = all(cs, cmd(1, 'give', [u2]));
    out.backAfterGive = all(cs, cmd(0, 'back', [u2]));
    out.castHome = all(cs, cmd(0, 'abil', abilArgs(u2)));
    all(cs, cmd(0, 'auto', [false]));
    stepUntil(cs, (c) => c.sim.state === 'between');
    out.relend = all(cs, cmd(0, 'lend', [u2, 1]));
    out.back = all(cs, cmd(0, 'back', [u2]));
    out.relend2 = all(cs, cmd(0, 'lend', [u2, 1]));
    all(cs, cmd(0, 'wave'));
    stepUntil(cs, (c) => c.sim.state === 'wave' && c.sim.enemies.length >= 1);
    out.st = [cs[0].sim.abilityStatus(u1).cooldownLeft, cs[0].sim.abilityStatus(u2).cooldownLeft];
    out.castLent2 = all(cs, cmd(1, 'abil', abilArgs(u2)));
    log2('WAVEBOUNDARY', out);
  });
  it('hand-out of a girl on cooldown', () => {
    const cs = views(st2(), [CASH_MAX, CASH_MAX]);
    const [u1, u2] = twoShiro(cs);
    const c1 = all(cs, cmd(0, 'abil', abilArgs(u1)));
    all(cs, marker(0, 'gone'));
    step(cs, COOP.graceTicks + 2);
    const ctrl = [cs[0].ctrlOf(u1), cs[0].ctrlOf(u2)];
    stepUntil(cs, (c) => c.sim.enemies.length >= 1, 5000);
    const st = [cs[0].sim.abilityStatus(u1).cooldownLeft, cs[0].sim.abilityStatus(u2).cooldownLeft];
    const a = all(cs, cmd(1, 'abil', abilArgs(u2)));
    const b = all(cs, cmd(1, 'abil', abilArgs(u1)));
    log2('HANDOUTCD', { c1, ctrl, st, a, b });
  });
  it('econ: lend first, then casts on both sides', () => {
    const cs = views(st2(), [CASH_MAX, CASH_MAX]);
    const m = [place(cs, 0, 'momo'), place(cs, 0, 'momo', 3), place(cs, 0, 'momo', 6)];
    for (const u of m) upTo3(cs, 0, u);
    all(cs, cmd(0, 'lend', [m[2], 1]));
    all(cs, cmd(0, 'wave'));
    stepUntil(cs, (c) => c.sim.state === 'wave' && m.every((u) => c.sim.abilityStatus(u).ready));
    for (const c of cs) wallets(c, [1000, 1000]);
    const r = [all(cs, cmd(1, 'abil', abilArgs(m[2]))), all(cs, cmd(0, 'abil', abilArgs(m[0]))), all(cs, cmd(0, 'abil', abilArgs(m[1])))];
    log2('ECONLENDFIRST', r);
  });
  it('L1: speed changes mid-grace and a checkpoint restore mid-grace, two views + a fresh client', () => {
    const cs = views(start(), [5000, 5000]);
    all(cs, marker(1, 'gone'));
    step(cs, 100);
    all(cs, cmd(0, 'speed', [3]));
    step(cs, 100);
    all(cs, cmd(0, 'speed', [2]));
    step(cs, 50);
    const snap = JSON.parse(JSON.stringify(cs[0].snapshot()));
    const fresh = createCoopSim(start(), { mySlot: 0 }).restore(snap);
    const trio = [cs[0], cs[1], fresh];
    expect(fresh.hash()).toBe(cs[0].hash());
    all(trio, cmd(0, 'speed', [1]));
    let handed = -1;
    for (let i = 0; i < 2000 && handed < 0; i++) {
      for (const c of trio) c.step();
      expect(trio[2].hash()).toBe(trio[0].hash()); expect(trio[1].hash()).toBe(trio[0].hash());
      if (!trio[0].pendingDeals().length) handed = trio[0].tick;
    }
    // expected: 7200 sixths = 100*6 + 100*2 + 50*3 = 950 used → 6250 left at 1× → 6250 steps; we cap at 2000 so compute
    log2('L1', { left: cs[0].pendingDeals(), handed, tick: cs[0].tick });
  });
});
