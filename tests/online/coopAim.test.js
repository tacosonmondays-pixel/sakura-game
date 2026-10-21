// The co-op `aim` command (roster B3, GAPS P-2): owner only, whole 1/1024 tiles, [uid, null] clears,
// a girl without an aim mode is refused, and both clients end up with the same aim and state.
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
    const a0 = clients[0].sim.getTower(iroha).aim;
    expect(a0).toEqual(clients[1].sim.getTower(iroha).aim);
    expect(clients[0].sim.getTower(iroha).ox).toBe(clients[1].sim.getTower(iroha).ox);
    for (let i = 0; i < 120; i++) for (const c of clients) c.step?.() ?? c.sim.update(1 / 60);
    expect(hashSim(clients[0].sim)).toBe(hashSim(clients[1].sim));
    expect(clients.map((c) => c.apply(cmd(0, 'aim', [iroha, null])).ok)).toEqual([true, true]);
    expect(clients[0].sim.getTower(iroha).aim).toBe(null);
  });
});
