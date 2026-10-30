// The co-op `aim` command (roster B3, GAPS P-2): owner only, whole 1/1024 tiles, [uid, null] clears,
// a girl without an aim mode is refused, and both clients end up with the same aim and state. Iroha's mirror network
// (docs/specs/IROHA_MIRRORS.md §6): aim[uid, qx, qy, k] places her mirror k; a checkpoint taken with her mirrors
// placed restores on a fresh client that then stays in lockstep.
import { describe, it, expect } from 'vitest';
import { createCoopSim, isValidCmd, KINDS, quantize } from '../../src/online/coop/commands.js';
import { hashSim } from '../../src/online/coop/simHash.js';

const start = () => ({
  seed: 17,
  stageId: '2-5',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'iroha' }, { unitId: 'aoi' }], hero: { unitId: 'seiran' } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'rei' }], hero: null },
  ],
});

let seq = 0;
const cmd = (p, k, a = [], t = 0) => ({ t, p, s: seq++, k, a });

function rich(c) {
  const snap = c.snapshot();
  snap.wallets = snap.wallets.map(() => 1e6);
  return c.restore(snap);
}

function placeOn(clients, slot, unitId) {
  const sim = clients[0].sim;
  for (let y = 0.5; y < sim.map.height; y += 0.5) {
    for (let x = 0.5; x < sim.map.width; x += 0.5) {
      if (sim.placementReason(unitId, x + 0.01, y + 0.01)) continue;
      const [qx, qy] = quantize(x + 0.01, y + 0.01);
      const rs = clients.map((c) => c.apply(cmd(slot, 'place', [unitId, qx, qy])));
      if (rs[0].ok) return rs[0].tower.uid;
    }
  }
  throw new Error(`no spot for ${unitId}`);
}

describe('the aim command', () => {
  it('is a command kind', () => {
    expect(KINDS).toContain('aim');
    expect(isValidCmd(cmd(0, 'aim', [5, 1024, 2048]))).toBe(true);
    expect(isValidCmd(cmd(0, 'aim', [5, null]))).toBe(true);
    expect(isValidCmd(cmd(0, 'aim', [5, 1024, 2048, 1]))).toBe(true);
  });

  it('aims the owner\'s mirror girl identically on both clients, refuses the partner and non-aim girls, clears', () => {
    const clients = [createCoopSim(start(), { mySlot: 0 }), createCoopSim(start(), { mySlot: 1 })];
    for (const c of clients) rich(c);
    const iroha = placeOn(clients, 0, 'iroha');
    const aoi = placeOn(clients, 0, 'aoi');
    const t = clients[0].sim.getTower(iroha);
    const q = [Math.round((t.x + 1.5) * 1024), Math.round(t.y * 1024)];
    expect(clients[1].apply(cmd(1, 'aim', [iroha, ...q])).reason).toBe('notYours');
    expect(clients.map((c) => c.apply(cmd(0, 'aim', [aoi, ...q])).ok)).toEqual([false, false]);
    expect(clients.map((c) => c.apply(cmd(0, 'aim', [iroha, 1.5, 2])).reason)).toEqual(['invalid', 'invalid']);
    expect(clients.map((c) => c.apply(cmd(0, 'aim', [iroha, ...q])).ok)).toEqual([true, true]);
    // (no slot: the mirror nearest the point moves)
    const a0 = clients[0].sim.getTower(iroha).mirrorAim;
    expect(a0.filter(Boolean)).toHaveLength(1);
    expect(a0).toEqual(clients[1].sim.getTower(iroha).mirrorAim);
    expect(clients[0].sim.getTower(iroha).mirrors).toEqual(clients[1].sim.getTower(iroha).mirrors);
    for (let i = 0; i < 120; i++) for (const c of clients) c.step?.() ?? c.sim.update(1 / 60);
    expect(hashSim(clients[0].sim)).toBe(hashSim(clients[1].sim));
    expect(clients.map((c) => c.apply(cmd(0, 'aim', [iroha, null])).ok)).toEqual([true, true]);
    expect(clients[0].sim.getTower(iroha).mirrorAim).toBe(null);
  });

  it('Iroha: aim[uid, qx, qy, k] places mirror k on both clients; a bad slot is refused; a checkpoint with her mirrors placed stays in lockstep', () => {
    const clients = [createCoopSim(start(), { mySlot: 0 }), createCoopSim(start(), { mySlot: 1 })];
    for (const c of clients) rich(c);
    const iroha = placeOn(clients, 0, 'iroha');
    placeOn(clients, 1, 'rei');
    const t = clients[0].sim.getTower(iroha);
    const at = (dx, dy) => [Math.round((t.x + dx) * 1024), Math.round((t.y + dy) * 1024)];
    expect(clients.map((c) => c.apply(cmd(0, 'aim', [iroha, ...at(1, 1), 1])).ok)).toEqual([true, true]);
    expect(clients.map((c) => c.apply(cmd(0, 'aim', [iroha, ...at(2.5, 1.5), 0])).ok)).toEqual([true, true]);
    // her third slot does not exist below Mirror Hall tier 2; a slot must be a whole number ≥ 0
    expect(clients.map((c) => c.apply(cmd(0, 'aim', [iroha, ...at(0, 1), 2])).ok)).toEqual([false, false]);
    expect(clients.map((c) => c.apply(cmd(0, 'aim', [iroha, ...at(0, 1), -1])).reason)).toEqual(['invalid', 'invalid']);
    expect(clients.map((c) => c.apply(cmd(0, 'aim', [iroha, ...at(0, 1), 0.5])).reason)).toEqual(['invalid', 'invalid']);
    const m = clients.map((c) => c.sim.getTower(iroha));
    expect(m[0].mirrorAim).toEqual([{ x: at(2.5, 1.5)[0] / 1024, y: at(2.5, 1.5)[1] / 1024 }, { x: at(1, 1)[0] / 1024, y: at(1, 1)[1] / 1024 }]);
    expect(m[1].mirrorAim).toEqual(m[0].mirrorAim);
    expect(m[1].mirrors).toEqual(m[0].mirrors);
    // the wave runs; at a checkpoint a fresh guest restores and plays on in lockstep
    for (const c of clients) c.apply(cmd(0, 'wave', []));
    const tick = (c) => c.step?.() ?? c.sim.update(1 / 60);
    for (let i = 0; i < 600; i++) for (const c of clients) tick(c);
    const snap = clients[0].snapshot();
    const fresh = createCoopSim(start(), { mySlot: 1 }).restore(JSON.parse(JSON.stringify(snap)));
    expect(fresh.sim.getTower(iroha).mirrorAim).toEqual(m[0].mirrorAim);
    expect(hashSim(fresh.sim)).toBe(hashSim(clients[0].sim));
    for (let i = 0; i < 600; i++) for (const c of [clients[0], fresh]) tick(c);
    expect(hashSim(fresh.sim)).toBe(hashSim(clients[0].sim));
  });
});
