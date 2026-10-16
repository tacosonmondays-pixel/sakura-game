// The scripted co-op battle that e2e/engines.mjs runs in V8, JavaScriptCore and SpiderMonkey:
// keep it healthy here (it must finish, nobody's scripted order may be refused, both clients
// must agree), so the cross-engine check keeps comparing a real, whole battle.
import { describe, it, expect } from 'vitest';
import { runScriptedBattle, runFreeplayBattle, runHeroBattle, runDronesBattle, freeplayTables, mathProbe, bitsHash } from '../../e2e/engines/scriptedBattle.js';

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
    // pinned: re-pinned by the hero rework (START fields Hikari, who now deploys for free and levels
    // on her track; landing plan S12) together with its stage-HP pass
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, final: r.final, hashes: r.hashes, waves: r.waves })
      .toEqual({ ticks: 28995, state: 'won', wallets: '1499/1347', final: 93082125, hashes: '7db1eed1', waves: '3018:9657f4ba' });
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

  it('runs a two-hero co-op battle in sync: delayed level buys (some stale), moves in prep and waves, ults, a refused hero sell', () => {
    const r = runHeroBattle();
    expect(r.agree).toBe(true);
    expect(r.checkpoints).toBeGreaterThanOrEqual(20);
    expect(r.bought).toBeGreaterThan(0);
    expect(r.stale).toBeGreaterThan(0);
    expect(r.moved).toBeGreaterThan(1);
    expect(r.ults).toBeGreaterThan(0);
    expect(r.sell).toBe('hero');
    expect(r.levels.split('/').every((l) => Number(l) >= 10)).toBe(true);
    expect(runHeroBattle().final).toBe(r.final);
  }, 120000);

  it('runs a co-op battle with two Chikas through every flight mode on a sapper stage, in sync, its checkpoint replaying to the run', () => {
    const r = runDronesBattle();
    expect(r.agree).toBe(true);
    expect(r.final).toBe(r.finalB);
    expect(r.refused).toBe('');
    expect(r.state).toBe('won');
    expect(r.drones).toBeGreaterThanOrEqual(3);
    expect(r.flies).toBeGreaterThanOrEqual(4);
    expect(r.jams).toBeGreaterThan(0); // sappers jammed drones
    expect(r.ckSame).toBe(true);
    expect(r.checkpoints).toBeGreaterThan(100);
    expect(runDronesBattle().final).toBe(r.final);
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
