// Chika's flight modes in co-op: the owner-only `fly` command, both clients flying the same wing,
// and the hash folding drones only for girls that have some (docs/specs/CHIKA_REWORK.md §16).
import { describe, it, expect } from 'vitest';
import { createCoopSim, isValidCmd, KINDS, flyArgs, quantize } from '../../src/online/coop/commands.js';
import { hashSim, createHasher } from '../../src/online/coop/simHash.js';

const start = () => ({
  seed: 91,
  stageId: '2-5',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'chika' }, { unitId: 'aoi' }], hero: null },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'rei' }], hero: null },
  ],
});

let seq = 0;
const cmd = (p, k, a = [], t = 0) => ({ t, p, s: seq++, k, a });

/** The hash before drones were folded (towers only), for battles without drones. */
function oldHash(sim, { tick = 0, wallets = [] } = {}) {
  const h = createHasher();
  h.int(tick).int(sim.wave).int(sim.lives).str(sim.state).int(sim._uid);
  for (const w of wallets) h.int(w);
  h.int(sim.enemies.length);
  for (const e of sim.enemies) {
    h.int(e.uid).int(e.x * 256).int(e.y * 256).int(e.hp * 16);
    if (e.hp >= 134217728) h.int(Math.floor(e.hp / 268435456));
  }
  h.int(sim.towers.length);
  for (const t of sim.towers) h.int(t.uid).int(t.tiers[0]).int(t.tiers[1]).int(t.tiers[2]).int(t.x * 1024).int(t.y * 1024).str(t.targetMode);
  return h.value;
}

/** Gives both players plenty of coins (through a checkpoint, as a rejoin would). */
function rich(c) {
  const snap = c.snapshot();
  snap.wallets = snap.wallets.map(() => 1e6);
  return c.restore(snap);
}

/** Places Chika (host) at a free spot near the lane and returns her uid on both clients. */
function placeChika(clients) {
  const sim = clients[0].sim;
  for (let y = 0.5; y < sim.map.height; y += 0.5) {
    for (let x = 0.5; x < sim.map.width; x += 0.5) {
      if (sim.placementReason('chika', x + 0.01, y + 0.01)) continue;
      const [qx, qy] = quantize(x + 0.01, y + 0.01);
      const rs = clients.map((c) => c.apply(cmd(0, 'place', ['chika', qx, qy])));
      if (rs[0].ok) return rs[0].tower.uid;
    }
  }
  throw new Error('no spot');
}

describe('the fly command', () => {
  it('is a command kind of up to six arguments', () => {
    expect(KINDS).toContain('fly');
    expect(isValidCmd(cmd(0, 'fly', [5, 'patrol', 1, 2, 3, 4]))).toBe(true);
    expect(isValidCmd(cmd(0, 'fly', [5, 'patrol', 1, 2, 3, 4, 5]))).toBe(false);
    expect(isValidCmd(cmd(0, 'tgt', [5, 'first', 1, 2, 3]))).toBe(false);
    expect(flyArgs(5, 'hover')).toEqual([5, 'hover']);
    expect(flyArgs(5, 'hold', [1.5, 2.25])).toEqual([5, 'hold', 1536, 2304]);
    expect(flyArgs(5, 'patrol', [1, 2], [3, 4])).toEqual([5, 'patrol', 1024, 2048, 3072, 4096]);
  });

  it('only the owner flies her wing; bad modes and points are refused', () => {
    const c = rich(createCoopSim(start(), { mySlot: 0 }));
    const uid = placeChika([c]);
    expect(c.apply(cmd(1, 'fly', [uid, 'pursuit']))).toEqual({ ok: false, reason: 'notYours' });
    for (const bad of [[uid, 'toString'], [uid, 'zoom'], [uid, 'hold'], [uid, 'hold', 1.5, 2], [uid, 'patrol', 10, 20], [uid, 7]]) {
      expect(c.apply(cmd(0, 'fly', bad)), JSON.stringify(bad)).toEqual({ ok: false, reason: 'invalid' });
    }
    expect(c.apply(cmd(0, 'fly', [uid, 'pursuit']))).toEqual({ ok: true });
    expect(c.sim.flightInfo(uid).mode).toBe('pursuit');
  });

  it('both clients fly the same wing through every mode, and their hashes agree', () => {
    const a = rich(createCoopSim(start(), { mySlot: 0 }));
    const b = rich(createCoopSim(start(), { mySlot: 1 }));
    const uid = placeChika([a, b]);
    for (const c of [a, b]) c.apply(cmd(0, 'wave', []));
    const t = a.sim.getTower(uid);
    const script = [
      [120, flyArgs(uid, 'hold', [t.x + 3.3, t.y - 2.1])],
      [600, flyArgs(uid, 'patrol', [t.x - 4, t.y], [t.x + 4, t.y + 1])],
      [1200, flyArgs(uid, 'pursuit')],
      [1800, flyArgs(uid, 'hover')],
    ];
    for (let tick = 0; tick < 2400; tick++) {
      for (const [at, args] of script) if (at === tick) for (const c of [a, b]) expect(c.apply(cmd(0, 'fly', args, tick)).ok).toBe(true);
      a.step();
      b.step();
      if (tick % 300 === 0) expect(a.hash()).toBe(b.hash());
    }
    expect(a.hash()).toBe(b.hash());
    const da = a.sim.droneStats(uid);
    expect(da.length).toBeGreaterThan(0);
    expect(b.sim.droneStats(uid)).toEqual(da);
  });
});

describe('hashSim and drones', () => {
  it('battles without drones keep the old digest; a drone moving changes it', () => {
    const c = rich(createCoopSim(start(), { mySlot: 0 }));
    const [qx, qy] = quantize(3.21, 1.13);
    c.apply(cmd(0, 'place', ['aoi', qx, qy]));
    c.apply(cmd(0, 'wave', []));
    for (let i = 0; i < 300; i++) c.step();
    const extra = { tick: c.tick, wallets: c.wallets };
    expect(hashSim(c.sim, extra)).toBe(oldHash(c.sim, extra));
    const uid = placeChika([c]);
    for (let i = 0; i < 120; i++) c.step();
    const t = c.sim.getTower(uid);
    expect(t.turrets.length).toBeGreaterThan(0);
    const before = hashSim(c.sim, extra);
    t.turrets[0].x += 0.5;
    expect(hashSim(c.sim, extra)).not.toBe(before);
  });
});
