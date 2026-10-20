// Battle snapshots (src/sim/snapshot.js) — the self-test that catches a field the serializer
// misses: play to a moment, snapshot, restore into a FRESH Sim, then give both copies the same
// orders for 20 000 ticks and compare their full state (the snapshot JSON) all the way. A field
// that is not stored, stored by value where it must stay shared, or rebuilt differently makes the
// copies drift apart within a few hundred ticks.
// The bot also switches Chika's flight mode every 10 s (Hold / Patrol / Pursuit / Hover).
// Three moments: a campaign stage between waves, the middle of a crowded wave (enemies with
// statuses, projectiles in flight, traps and drones out), and a deep co-op freeplay wave (the
// Ashwing Matriarch at wave 200 with her summons, visitors with affixes, Resolve budgets), plus a
// P6 team mid-wave (Potential v3: rhythm counts, tempo, the shuriken carry, overclock timers).
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP } from '../../src/sim/constants.js';
import { autoPlan } from '../../src/sim/headless.js';
import { snapshotDigest, REBUILT } from '../../src/sim/snapshot.js';
import { coopStage } from '../../src/data/coop.js';
import { createCoopSim, quantize } from '../../src/online/coop/commands.js';
import { createRng } from '../../src/core/rng.js';

const TEAM = ['kage', 'suzu', 'raika', 'chika', 'yuki', 'momo', 'kaede', 'umeko'];

/** A player: follows autoPlan as her coins allow, then keeps upgrading; fires the ult when ready. */
function makeBot(stageId, units, data) {
  const plan = autoPlan(stageId, units, { data });
  let i = 0;
  let turn = 0;
  let calls = 0;
  return (sim) => {
    const out = [];
    if (i < plan.length) {
      const a = plan[i];
      if (a.action === 'place') {
        if (sim.canPlace(a.unitId, a.x, a.y).ok) {
          out.push(['place', a.unitId, a.x, a.y]);
          i++;
        } else if (sim.placementReason(a.unitId, a.x, a.y)) i++;
      } else if (a.action === 'upgrade') {
        const t = sim.towerAt(a.x, a.y);
        const st = t && sim.upgradeStatus(t.uid, a.path);
        if (!t || (st.locked && st.reason !== 'cash')) i++;
        else if (!st.locked) {
          out.push(['upg', t.uid, a.path]);
          i++;
        }
      } else i++;
    } else if (sim.towers.length) {
      const t = sim.towers[turn++ % sim.towers.length];
      for (const path of [0, 1, 2]) {
        if (!sim.upgradeStatus(t.uid, path).locked) {
          out.push(['upg', t.uid, path]);
          break;
        }
      }
      // now and then a different targeting mode (strong / last / first)
      if (turn % 7 === 0) out.push(['tgt', t.uid, ['strong', 'last', 'first'][turn % 3]]);
    }
    // every 10 s Chika's wing changes flight mode (Hold / Patrol points around her)
    if (++calls % 30 === 0) {
      const mode = ['patrol', 'pursuit', 'hold', 'hover'][(calls / 30) % 4];
      for (const t of sim.towers) if (sim.flightInfo(t.uid)) out.push(['fly', t.uid, mode, t.x + 2.5, t.y - 1.5, t.x - 3, t.y + 2]);
    }
    if (sim.hero && sim.heroUltStatus().ready) out.push(['ult']);
    return out;
  };
}

function apply(sim, c) {
  switch (c[0]) {
    case 'place': return !!sim.placeTower(c[1], c[2], c[3]);
    case 'upg': return sim.upgradeTower(c[1], c[2]);
    case 'tgt': return sim.setTargetMode(c[1], c[2]);
    case 'ult': return !!sim.activateUlt();
    case 'fly': return sim.setFlight(c[1], c[2], c[3], c[4], c[5], c[6]);
    case 'wave': return sim.startNextWave();
    default: throw new Error(c[0]);
  }
}

/** Plays `sim` with `bot` until `until(sim)` (or `max` ticks). */
function play(sim, bot, until, max) {
  for (let t = 0; t < max && !until(sim); t++) {
    if (t % 20 === 0) for (const c of bot(sim)) apply(sim, c);
    sim.update(STEP);
    sim.drainEvents();
  }
}

/** Over the wire and back (what a checkpoint goes through). */
const wire = (snap) => JSON.parse(JSON.stringify(snap));
const fresh = (args) => new Sim(args);

/**
 * The self-test: restore `snap` into a fresh Sim, then run it and the original side by side for
 * `ticks` with the same orders (decided on the original), comparing the whole state every 500 ticks.
 */
function twin(orig, args, bot, ticks = 20000) {
  const snap = wire(orig.snapshot());
  const copy = fresh(args).restore(snap);
  // restoring is exact: the copy's snapshot is the same JSON
  expect(JSON.stringify(copy.snapshot())).toBe(JSON.stringify(snap));
  let diverged = -1;
  let compared = 0;
  for (let t = 0; t < ticks; t++) {
    if (t % 20 === 0) {
      for (const c of bot(orig)) {
        const a = apply(orig, c);
        const b = apply(copy, c);
        if (a !== b && diverged < 0) diverged = t;
      }
    }
    orig.update(STEP);
    copy.update(STEP);
    orig.drainEvents();
    copy.drainEvents();
    if (t % 500 === 499 || t === ticks - 1) {
      compared++;
      if (diverged < 0 && JSON.stringify(orig.snapshot()) !== JSON.stringify(copy.snapshot())) diverged = t;
      if (diverged >= 0) break;
    }
    if (orig.state === 'won' || orig.state === 'lost') break;
  }
  expect(diverged).toBe(-1);
  expect(snapshotDigest(orig.snapshot())).toBe(snapshotDigest(copy.snapshot()));
  expect(copy.result()).toEqual(orig.result());
  return { snap, compared, bytes: JSON.stringify(snap).length };
}

describe('battle snapshots: restore into a fresh Sim, run on, nothing drifts', { timeout: 240000 }, () => {
  it('a campaign stage between waves (wave boundary, as co-op checkpoints are taken)', () => {
    const args = { stageId: '4-3', difficulty: 'normal', loadout: TEAM.map((unitId) => ({ unitId })), hero: { unitId: 'hikari' }, seed: 77, options: { autoStart: true } };
    const sim = fresh(args);
    const bot = makeBot('4-3', [...TEAM, 'hikari']);
    sim.cash += 6000;
    sim.startNextWave();
    play(sim, bot, (s) => s.wavesCleared >= 4 && s.state === 'between', 60 * 60 * 20);
    expect(sim.wavesCleared).toBeGreaterThanOrEqual(4);
    expect(sim.enemies.length).toBe(0);
    const r = twin(sim, args, bot);
    expect(r.compared).toBeGreaterThan(20);
  });

  it('the middle of a crowded wave: enemies with statuses, projectiles in flight, traps and drones out', () => {
    const args = { stageId: '7-2', difficulty: 'hard', loadout: TEAM.map((unitId) => ({ unitId, stats: { costMul: 0.4 } })), hero: { unitId: 'nami' }, seed: 123, options: { autoStart: true } };
    const sim = fresh(args);
    const bot = makeBot('7-2', [...TEAM, 'nami']);
    sim.cash += 9000;
    sim.startNextWave();
    const busy = (s) => s.wave >= 5 && s.state === 'wave' && s.enemies.length >= 12 && s.projectiles.length >= 3
      && s.enemies.some((e) => Object.keys(e.statuses).length);
    play(sim, bot, busy, 60 * 60 * 25);
    expect(busy(sim)).toBe(true);
    const r = twin(sim, args, bot);
    expect(r.snap.o.length).toBeGreaterThan(100);
  });

  it('Potential v3 at P6 mid-wave: rhythms, echoes, tempo, the shuriken carry, a kept focus, overclock, Brittle and burn leaps', () => {
    // every girl at P6 (src/sim/potential.js): Kage's tempo stacks and carry, Rei's duel echo, Akane's
    // leaping burns, Miko's Brittle aura and aura boost, Suzu's trap rhythm, Chika's overclock,
    // Kaede's kept focus, Hotaru's ×spectral, Luna's Moonfall with its Brittle; spectral ghosts on 3-4
    const team = ['kage', 'rei', 'akane', 'miko', 'suzu', 'chika', 'kaede', 'hotaru'];
    const stats = { potential: 6, costMul: 0.4 };
    const args = { stageId: '3-4', difficulty: 'normal', loadout: team.map((unitId) => ({ unitId, stats })), hero: { unitId: 'luna', stats }, seed: 3535, options: { autoStart: true } };
    const sim = fresh(args);
    const bot = makeBot('3-4', [...team, 'luna']);
    sim.cash += 9000;
    sim.startNextWave();
    const of = (s, id) => s.towers.find((t) => t.unitId === id);
    const busy = (s) => s.wave >= 6 && s.state === 'wave' && s.enemies.length >= 8 && s.projectiles.length >= 3
      && of(s, 'kage')?.tempoStacks > 0 && of(s, 'kage').projCarry > 0 && s.towers.filter((t) => t.potCount > 0).length >= 4;
    play(sim, bot, busy, 60 * 60 * 25);
    expect(busy(sim)).toBe(true);
    const r = twin(sim, args, bot, 12000);
    expect(r.compared).toBeGreaterThan(5);
    // the Potential state rode in the checkpoint (the generic serializer stores every tower field)
    const json = JSON.stringify(r.snap);
    for (const k of ['tempoStacks', 'tempoIdle', 'projCarry', 'potCount', 'potOc', 'effProc', 'effEcho', 'trapSpecProc']) expect(json, k).toContain(`"${k}"`);
  });

  it('deep co-op freeplay: wave 200, the Ashwing Matriarch and her summons mid-fight (Crimson Moon on 8-5)', () => {
    const stage = coopStage('8-5', { freeplay: 'crimson' });
    const god = { damageMul: 400, rateMul: 1.6, costMul: 0.05 };
    const args = { stageId: '8-5', difficulty: 'normal', loadout: TEAM.map((unitId) => ({ unitId, stats: god })), hero: { unitId: 'luna', stats: god }, seed: 2026, options: { freeplay: true, autoStart: false }, data: { stage } };
    const sim = fresh(args);
    const bot = makeBot('8-5', [...TEAM, 'luna'], { stage });
    // a built board, then straight to the edge of wave 200 (a test jump: no 199 waves to play)
    sim.cash = 5e6;
    play(sim, bot, () => false, 60 * 30);
    sim.lives = 1e6; // (so the fight goes on for the whole comparison, leaks or not)
    sim.wave = 199;
    sim.wavesCleared = 199;
    sim.state = 'between';
    sim.startNextWave();
    const fight = (s) => s.enemies.some((e) => e.id === 'dragon_ashwing') && s.enemies.length >= 6;
    play(sim, bot, fight, 60 * 120);
    expect(fight(sim)).toBe(true);
    expect(sim.freeplayInfo(200)).toBeTruthy();
    const r = twin(sim, args, bot, 12000);
    expect(r.compared).toBeGreaterThan(5);
  });
});

// Battle modes and map rules (docs/specs/CODEX_MODES.md §6.5, docs/specs/LANDING_PLAN.md §8): the
// route orientation is carried (routeReversed), both orientations are rebuilt (REBUILT), and the live
// one is put back after a restore (AFTER_RESTORE).
describe('battle snapshots with map rules and battle modes', { timeout: 240000 }, () => {
  it('4-2 co-op freeplay (Rear Ambush): a checkpoint right after an even wave, walking the other way', () => {
    const stage = coopStage('4-2', { freeplay: 'blossom' });
    const args = { stageId: '4-2', difficulty: 'normal', loadout: TEAM.map((unitId) => ({ unitId })), hero: { unitId: 'hikari' }, seed: 42, options: { autoStart: true, freeplay: true }, data: { stage } };
    const sim = fresh(args);
    expect(sim.rule?.id).toBe('rear_ambush');
    const bot = makeBot('4-2', [...TEAM, 'hikari'], { stage });
    sim.cash += 6000;
    sim.startNextWave();
    play(sim, bot, (s) => s.wavesCleared >= 4 && s.state === 'between' && s.routeReversed, 60 * 60 * 20);
    expect(sim.routeReversed).toBe(true);
    const copy = fresh(args).restore(wire(sim.snapshot()));
    expect(copy.pathData).toBe(copy._pathsRev);
    const r = twin(sim, args, bot);
    expect(r.compared).toBeGreaterThan(20);
    // the dense polylines of both orientations never travel in a checkpoint
    expect(REBUILT).toEqual(expect.arrayContaining(['_pathsFwd', '_pathsRev', 'mode']));
    expect(r.snap.root._pathsFwd).toBeUndefined();
  });

  it('6-1 (Prism Conduits): after the pad owner is sold, the next girl on the pad owns it', () => {
    const args = { stageId: '6-1', difficulty: 'hard', loadout: TEAM.map((unitId) => ({ unitId })), seed: 9, options: { autoStart: true } };
    const sim = fresh(args);
    sim.cash += 20000;
    const pad = sim.rule.pads[0];
    const a = sim.placeTower('kage', pad.x, pad.y);
    let b = null;
    for (const [dx, dy] of [[0.85, 0], [-0.85, 0], [0, 0.85], [0, -0.85]]) if (!b) b = sim.placeTower('yuki', pad.x + dx, pad.y + dy);
    expect(a?.onPad && b && !b.onPad).toBe(true);
    const bot = makeBot('6-1', TEAM);
    sim.startNextWave();
    play(sim, bot, (s) => s.wavesCleared >= 3 && s.state === 'between', 60 * 60 * 20);
    sim.sellTower(a.uid);
    expect(b.onPad).toBe(true);
    twin(sim, args, bot);
  });

  it('6-3 Ironclad with vents, mid-wave while the vents burn', () => {
    const args = { stageId: '6-3', difficulty: 'normal', loadout: TEAM.map((unitId) => ({ unitId })), seed: 5, options: { autoStart: true, mode: 'ironclad' } };
    const sim = fresh(args);
    const bot = makeBot('6-3', TEAM);
    sim.cash += 8000;
    sim.startNextWave();
    play(sim, bot, (s) => s.wave >= 5 && s.state === 'wave' && s.rule.active && s.enemies.length > 3, 60 * 60 * 20);
    expect(sim.rule.active).toBe(true);
    twin(sim, args, bot, 12000);
  });
});

describe('the co-op checkpoint (CoopSim.snapshot / restore)', { timeout: 120000 }, () => {
  it('wallets, owners, votes and the Sim come back; both copies stay hash-identical', () => {
    const STRONG = { damageMul: 30, costMul: 0.3 };
    const start = {
      seed: 99,
      stageId: '1-1',
      difficulty: 'normal',
      freeplay: 'tempest',
      players: [
        { slot: 0, uid: 'a', name: 'A', loadout: [{ unitId: 'aoi', stats: STRONG }, { unitId: 'suzu', stats: STRONG }], hero: { unitId: 'hikari', stats: STRONG } },
        { slot: 1, uid: 'b', name: 'B', loadout: [{ unitId: 'chika', stats: STRONG }, { unitId: 'yuki', stats: STRONG }], hero: null },
      ],
    };
    const A = createCoopSim(start, { mySlot: 0 });
    const plan = autoPlan('1-1', ['aoi', 'suzu', 'chika', 'yuki', 'hikari'], { data: { stage: coopStage('1-1', { freeplay: 'tempest' }) } });
    let s = 0;
    const owner = (u) => (['chika', 'yuki'].includes(u) ? 1 : 0);
    const cmds = [];
    const order = (k, p, a) => {
      const c = { t: A.tick, p, s: s++, k, a };
      cmds.push(c);
      return c;
    };
    let pi = 0;
    const drive = (c, list) => {
      for (const x of list) c.apply(x);
    };
    // play to the goal and a few waves past it (Auto on), each tick's orders logged
    const tickOrders = () => {
      const out = [];
      if (A.tick === 0) out.push(order('auto', 0, [true]), order('speed', 1, [3]), order('wave', 0, []));
      if (A.tick % 30 === 0 && pi < plan.length) {
        const a = plan[pi];
        if (a.action === 'place') {
          out.push(order('place', owner(a.unitId), [a.unitId, ...quantize(a.x, a.y)]));
          pi++;
        } else {
          const t = A.sim.towerAt(a.x, a.y);
          if (t) out.push(order('upg', A.ownerOf(t.uid), [t.uid, a.path]));
          pi++;
        }
      }
      return out;
    };
    while (!(A.sim.wavesCleared >= A.sim.totalWaves + 3 && A.sim.state === 'between') && A.tick < 60 * 60 * 30) {
      drive(A, tickOrders());
      A.step();
    }
    expect(A.sim.wavesCleared).toBeGreaterThan(A.sim.totalWaves);
    drive(A, [order('end', 1, [true])]); // the guest's Finish vote is part of the state
    A.step();
    const snap = wire(A.snapshot());
    expect(snap.endVotes).toEqual([false, true]);
    const B = createCoopSim(start, { mySlot: 1 }).restore(snap);
    expect(B.tick).toBe(A.tick);
    expect(B.wallets).toEqual(A.wallets);
    expect(B.hash()).toBe(A.hash());
    expect(B.endVotes()).toEqual([false, true]);
    expect(B.ownerOf(A.sim.towers[0].uid)).toBe(A.ownerOf(A.sim.towers[0].uid));
    // B's own view: its wallet on screen, not the host's
    expect(B.sim.cash).toBe(B.wallets[1]);
    // 10 more waves side by side, the same orders on both
    const rng = createRng(5);
    const goal = A.sim.wavesCleared + 10;
    while (A.sim.wavesCleared < goal && A.sim.state !== 'lost' && A.tick < snap.tick + 60 * 60 * 20) {
      const list = [];
      if (A.tick % 45 === 0) {
        const t = A.sim.towers[Math.floor(rng.next() * A.sim.towers.length)];
        list.push(order('upg', A.ownerOf(t.uid), [t.uid, Math.floor(rng.next() * 3)]));
      }
      drive(A, list);
      drive(B, list);
      A.step();
      B.step();
      if (A.tick % 600 === 0) expect(B.hash()).toBe(A.hash());
    }
    expect(B.hash()).toBe(A.hash());
    expect(B.wallets).toEqual(A.wallets);
    expect(snapshotDigest(B.snapshot().sim)).toBe(snapshotDigest(A.snapshot().sim));
    // and the Finish: the host votes too, both end on the same tick
    drive(A, [order('end', 0, [true])]);
    drive(B, [cmds[cmds.length - 1]]);
    expect(A.sim.finished && B.sim.finished).toBe(true);
  });
});

describe('the format', () => {
  it('stores what JSON cannot spell, keeps shared objects shared, Maps and Sets in order', () => {
    const sim = new Sim({ stageId: '1-1', seed: 5 });
    const shared = { n: 1 };
    sim.extra = { inf: Infinity, ninf: -Infinity, nz: -0, nan: NaN, u: undefined, a: [1, , 3], m: new Map([[2, shared], ['x', 1]]), s: new Set(['b', 'a']), shared, again: shared, cyc: null };
    sim.extra.cyc = sim.extra;
    sim.rng.next();
    const snap = wire(sim.snapshot());
    const copy = new Sim({ stageId: '1-1', seed: 5 }).restore(snap);
    const x = copy.extra;
    expect(x.inf).toBe(Infinity);
    expect(x.ninf).toBe(-Infinity);
    expect(Object.is(x.nz, -0)).toBe(true);
    expect(Number.isNaN(x.nan)).toBe(true);
    expect('u' in x && x.u === undefined).toBe(true);
    expect(1 in x.a).toBe(false);
    expect(x.a.length).toBe(3);
    expect([...x.m.keys()]).toEqual([2, 'x']);
    expect([...x.s]).toEqual(['b', 'a']);
    expect(x.m.get(2)).toBe(x.shared);
    expect(x.again).toBe(x.shared);
    expect(x.cyc).toBe(x);
    // the rng continues where it was, and the status context shares it
    expect(copy.rng.next()).toBe(sim.rng.next());
    expect(copy._statusCtx.rng).toBe(copy.rng);
  });

  it('game data is referred to, never copied (a restored girl points at the real definition)', () => {
    const args = { stageId: '1-1', loadout: [{ unitId: 'aoi' }], seed: 5 };
    const sim = new Sim(args);
    sim.cash = 5000;
    const t = sim.placeTower('aoi', ...firstSpot(sim, 'aoi'));
    expect(t).toBeTruthy();
    const snap = sim.snapshot();
    expect(JSON.stringify(snap)).not.toContain('"Aoi"'); // (the definition's name is not in it)
    const copy = new Sim(args).restore(wire(snap));
    expect(copy.towers[0].def).toBe(sim.data.unit('aoi'));
    expect(copy.getTower(t.uid)).toBe(copy.towers[0]);
    expect(copy.diff).toBe(sim.diff);
    for (const k of REBUILT) expect(snap.root).not.toHaveProperty(k);
  });

  it('refuses what it cannot store (a function in the state) and foreign data', () => {
    const sim = new Sim({ stageId: '1-1', seed: 5 });
    sim.extra = { fn: () => 1 };
    expect(() => sim.snapshot()).toThrow(/cannot store a function at extra\.fn/);
    delete sim.extra;
    expect(() => new Sim({ stageId: '1-1' }).restore({ v: 99 })).toThrow(/not a battle snapshot/);
  });
});

function firstSpot(sim, unitId) {
  for (let y = 0.6; y < sim.map.height; y += 0.3) {
    for (let x = 0.6; x < sim.map.width; x += 0.3) if (sim.canPlace(unitId, x, y).ok) return [x, y];
  }
  return [0, 0];
}
