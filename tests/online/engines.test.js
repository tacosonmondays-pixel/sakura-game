// The scripted co-op battle that e2e/engines.mjs runs in V8, JavaScriptCore and SpiderMonkey:
// keep it healthy here (it must finish, nobody's scripted order may be refused, both clients
// must agree), so the cross-engine check keeps comparing a real, whole battle.
import { describe, it, expect } from 'vitest';
import { runScriptedBattle, runFreeplayBattle, runHeroBattle, runDronesBattle, runPotentialBattle, runPotentialBossBattle, runGearGirlsBattle, freeplayTables, mathProbe, bitsHash } from '../../e2e/engines/scriptedBattle.js';

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

  it('runs the Potential battle (POTENTIAL_START: every kind of step, Aoi at P1 for the host and P6 for the guest, Kage and Rei at P6) in sync', () => {
    const r = runPotentialBattle();
    expect(r.refused).toBe('');
    expect(r.agree).toBe(true);
    expect(['won', 'lost']).toContain(r.state);
    expect(r.checkpoints).toBeGreaterThanOrEqual(20);
    expect((r.towers.match(/:P/g) || []).length).toBe(12);
    const [guest, host] = r.aoi.split(' | ');
    expect(guest).not.toBe(host); // the same girl, two owners, two Potentials
    // Kage's tempo stacks and shuriken carry and the rhythms ran (v3 §6.3: N13, N14, N3)
    expect(r.mech.tempo).toBeGreaterThan(0);
    expect(r.mech.carry).toBeGreaterThan(0);
    expect(r.mech.proc).toBeGreaterThan(0);
    expect(r.tiers.split(' ')[r.towers.split(' ').findIndex((t) => t === 'rei:P6')]).toBe('040'); // Duelist Stance
    expect(runPotentialBattle().final).toBe(r.final);
    // pinned when Potential M1 landed (change only with a deliberate sim / data change, and say why).
    // Re-pinned at the train-C Potential merge (was 28390 / '334/918' / 471369358 / '7d947497'):
    // its line-up fields hero Luna (free, levelling on her track: hero rework), Chika (roaming
    // drones: Chika rework) and the path-cap tier data. The same scenario with every girl at P1
    // computes the identical battle on the train head before the merge and after it (28506 ticks,
    // final 3253190631, hashes e88b2bb9): Potential's P1 changes nothing (landing plan §10 #9).
    // Re-pinned for Potential v3 V1 (was 27433 / '671/920' / 87067914 / '7bb1e107'), then once more
    // in V2 (was 22348 / '741/991' / 3564779976 / 'ff349307') for the v3 §6.3 line-up: Kage P6 and Rei
    // P6 in Duelist Stance join (Shiro leaves), Kaede P5 → P6, the v3 girls get the spots nearest the
    // path and every upgrade waits for its girl and her coins. START above is unchanged, so P1 still
    // changes nothing. Re-pinned for the B1 re-price (was 23827 / '317/222' / 3070688707 / '975e4e34'):
    // Kage's storm every 8th throw and her one pierce step at P5, Shiro's Silver Line rhythm, Kaede's
    // 0.1-tile Maple Gale at her plain hit, Aoi's crit, Raika's and Hotaru's trims; an upgrade also
    // waits while its player's placement is in flight (it arrived unaffordable once).
    // Re-pinned for Kaede's AoE rework (was 23752 / '317/222' / 4242036526 / '57997ea1'): her Maple
    // Cleave every 3rd strike and her new P5 (Maple Gale ×1.1 on her blade arts, not the 0.1-tile cut);
    // only Kaede's kit changed (every other girl resolves bit-identically, tests/sim/mods.test.js)
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, final: r.final, hashes: r.hashes })
      .toEqual({ ticks: 23827, state: 'won', wallets: '317/222', final: 1924477857, hashes: 'dec1d574' });
  }, 120000);

  it('runs the Potential boss battle (POTENTIAL_BOSS_START: Hotaru vs spectral, Kaede vs the Grave Lych, Rei\'s duel echo) in sync', () => {
    const r = runPotentialBossBattle();
    expect(r.refused).toBe('');
    expect(r.agree).toBe(true);
    expect(['won', 'lost']).toContain(r.state);
    expect(r.wave).toBe(15); // the Lych's wave
    expect(r.checkpoints).toBeGreaterThanOrEqual(20);
    // v3 §6.3: N16 (×spectral), N17 (×boss), N15 on a duel (an echo at a share), the rhythms
    expect(r.mech.spectral).toBeGreaterThan(0);
    expect(r.mech.boss).toBeGreaterThan(0);
    expect(r.mech.echo).toBeGreaterThan(0);
    expect(r.mech.proc).toBeGreaterThan(0);
    expect(runPotentialBossBattle().final).toBe(r.final);
    // pinned in Potential v3 V2 (change only with a deliberate sim / data change, and say why).
    // Re-pinned for the B1 re-price (was 35232 / '6768/4510' / 2047586365 / 'a01bc9ff'): see above.
    // Re-pinned for Kaede's AoE rework (was 35101 / '6568/4679' / 3492961063 / 'b2b2f34d'): her Maple
    // Cleave, her full-focus maple splash on Unbroken Rhythm, Crimson Eternity ×1.6 vs bosses (was ×1.5)
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, final: r.final, hashes: r.hashes })
      .toEqual({ ticks: 35035, state: 'lost', wallets: '6700/4594', final: 2141169952, hashes: '20c45d69' });
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

  it('runs the returning girls in gear (GEAR_GIRLS_START: Iroha\'s two firing points with Pierce, every club trick) in sync', () => {
    const r = runGearGirlsBattle();
    expect(r.refused).toBe('');
    expect(r.agree).toBe(true);
    expect(['won', 'lost']).toContain(r.state);
    expect(r.checkpoints).toBeGreaterThanOrEqual(20);
    // all nine returning girls and Aoi stood and fought
    for (const id of ['kanna', 'seiran', 'iroha', 'ena', 'noa', 'fuu', 'hana', 'ruri', 'aoi']) expect(r.dealt, id).toMatch(new RegExp(`${id}:[1-9]`));
    // Iroha shot from her mirror and from where she stands, and her shots took gear Pierce
    const [mirror, own, pierced] = r.iroha.split('/').map(Number);
    expect(mirror).toBeGreaterThan(0);
    expect(own).toBeGreaterThan(0);
    expect(pierced).toBeGreaterThan(0);
    for (const k of ['iroha:followThrough', 'ena:thrust', 'fuu:bigBeat', 'hana:finalePop', 'ruri:followThrough', 'kanna:bigBeat', 'seiran:thrust']) expect(r.tricks, k).toContain(k);
    expect(runGearGirlsBattle().final).toBe(r.final);
    // pinned when the battle was added (v0.1.40 train; the same final as the merge review's ad hoc run
    // on V8 and JavaScriptCore). Change only with a deliberate sim / data change, and say why.
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, final: r.final, hashes: r.hashes, iroha: r.iroha })
      .toEqual({ ticks: 54615, state: 'won', wallets: '5521/5179', final: 3900917007, hashes: '7ad51e89', iroha: '572/522/885' });
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
