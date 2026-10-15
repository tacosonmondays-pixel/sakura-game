// The scripted co-op battle that e2e/engines.mjs runs in V8, JavaScriptCore and SpiderMonkey:
// keep it healthy here (it must finish, nobody's scripted order may be refused, both clients
// must agree), so the cross-engine check keeps comparing a real, whole battle.
import { describe, it, expect } from 'vitest';
import { runScriptedBattle, runFreeplayBattle, runPotentialBattle, freeplayTables, mathProbe, bitsHash } from '../../e2e/engines/scriptedBattle.js';

describe('cross-engine scripted battle (e2e/engines.mjs fixture)', () => {
  it('runs a whole co-op battle with both players to the end, in sync, every order accepted', () => {
    const r = runScriptedBattle();
    expect(r.refused).toBe('');
    expect(r.agree).toBe(true);
    expect(['won', 'lost']).toContain(r.state);
    expect(r.checkpoints).toBeGreaterThanOrEqual(20);
    expect(r.towers).toBeGreaterThanOrEqual(5);
    expect(r.ults).toBeGreaterThan(0);
    expect(r.final).toBe(r.finalB);
    // and the run is reproducible (what the cross-engine comparison relies on)
    expect(runScriptedBattle().final).toBe(r.final);
    // co-op freeplay changed nothing outside freeplay: the same battle as before it landed
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, final: r.final, hashes: r.hashes, waves: r.waves })
      .toEqual({ ticks: 28347, state: 'won', wallets: '1239/1347', final: 411300916, hashes: '5b904cb9', waves: '3018:9657f4ba' });
  }, 120000);

  it('runs the Potential battle (POTENTIAL_START: every kind of step, Aoi at P1 for the host and P6 for the guest) in sync', () => {
    const r = runPotentialBattle();
    expect(r.refused).toBe('');
    expect(r.agree).toBe(true);
    expect(['won', 'lost']).toContain(r.state);
    expect(r.checkpoints).toBeGreaterThanOrEqual(20);
    expect((r.towers.match(/:P/g) || []).length).toBe(11);
    const [guest, host] = r.aoi.split(' | ');
    expect(guest).not.toBe(host); // the same girl, two owners, two Potentials
    expect(runPotentialBattle().final).toBe(r.final);
    // pinned when Potential M1 landed (change only with a deliberate sim / data change, and say why)
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, final: r.final, hashes: r.hashes })
      .toEqual({ ticks: 28390, state: 'won', wallets: '334/918', final: 471369358, hashes: '7d947497' });
  }, 120000);

  it('runs a co-op freeplay battle through the goal into the boss waves, in sync, ended by both Finish votes', () => {
    const r = runFreeplayBattle();
    expect(r.agree).toBe(true);
    expect(r.final).toBe(r.finalB);
    expect([r.state, r.stateB, r.finished]).toEqual(['won', 'won', true]);
    expect(r.goal).toBe(15);
    expect(r.goalTick).toBeGreaterThan(0);
    expect(r.cleared).toBeGreaterThan(r.goal + 30);
    expect(r.bosses).toBeGreaterThanOrEqual(3);
    const [a, b] = r.endTicks.split('/');
    expect(a).toBe(b); // the Finish vote ended the run on the same tick on both clients
    expect(r.checkpoints).toBeGreaterThan(200);
  }, 240000);

  it('hashes the freeplay wave tables of every stage and tier', () => {
    expect(freeplayTables()).toMatch(/^\d+:[0-9a-f]{8}:[0-9a-f]{8}$/);
  }, 120000);

  it('the math probe hashes bit patterns (and the det ports are what co-op uses)', () => {
    expect(bitsHash([0])).not.toBe(bitsHash([-0]));
    const p = mathProbe();
    expect(Object.keys(p.det)).toEqual(['sin', 'cos', 'atan2', 'hypot', 'acos']);
    for (const h of Object.values(p.det)) expect(h).toMatch(/^[0-9a-f]{8}$/);
  });
});
