// The scripted co-op battle that e2e/engines.mjs runs in V8, JavaScriptCore and SpiderMonkey:
// keep it healthy here (it must finish, nobody's scripted order may be refused, both clients
// must agree), so the cross-engine check keeps comparing a real, whole battle.
import { describe, it, expect } from 'vitest';
import { runScriptedBattle, runFreeplayBattle, runHeroBattle, runDronesBattle, runAbilitiesBattle, runReturningAbilBattle, RETURNING_ABIL_IDS, runRosterBattle, runTenkaBattle, tenkaCoverage, runPotentialBattle, runPotentialBossBattle, runGearGirlsBattle, runGlowBowlBattle, freeplayTables, mathProbe, bitsHash } from '../../e2e/engines/scriptedBattle.js';
import { launchAttempts } from '../../e2e/browser.mjs';

// T3 review coop-3: e2e/engines.mjs only ever tried Playwright's own browsers, so on a machine without
// them SpiderMonkey never ran even with Firefox installed. It now falls back to the installed browsers
// (no download), the system Firefox kept apart from one the user has open and, on Windows, held by its
// launcher (without -wait-for-browser Playwright loses it and a stray Firefox window can stay open).
describe('the cross-engine runner finds the browsers (e2e/browser.mjs launchAttempts)', () => {
  it('Firefox: Playwright\'s, else the system Firefox (SpiderMonkey) through WebDriver BiDi; Chrome / Edge as launchChromium; WebKit only Playwright\'s', () => {
    const ff = launchAttempts('firefox', {}, 'win32');
    expect(ff.map(([, label]) => label)).toEqual(['Playwright Firefox', 'system Firefox']);
    expect(ff[0][0]).toEqual({});
    expect(ff[1][0]).toMatchObject({ channel: 'moz-firefox', args: ['-no-remote', '-wait-for-browser'] });
    expect(launchAttempts('firefox', {}, 'linux')[1][0].args).toEqual(['-no-remote']);
    expect(launchAttempts('chromium', {}).map(([, label]) => label)).toEqual(['Playwright Chromium', 'system Chrome', 'system Edge']);
    expect(launchAttempts('chromium', { CHROME_PATH: 'C:/x/chrome.exe' })).toEqual([[{ executablePath: 'C:/x/chrome.exe' }, 'CHROME_PATH=C:/x/chrome.exe']]);
    expect(launchAttempts('chromium', { PLAYWRIGHT_CHANNEL: 'msedge' })).toEqual([[{ channel: 'msedge' }, 'channel msedge']]);
    expect(launchAttempts('webkit', {})).toEqual([[{}, 'Playwright WebKit']]);
  });
});

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
      .toEqual({ ticks: 25252, state: 'won', wallets: '1488/1358', final: 117390355, hashes: 'e35abcfc', waves: '3018:9657f4ba' });
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
      .toEqual({ ticks: 22829, state: 'won', wallets: '317/222', final: 88453414, hashes: '9ff4ee47' });
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
      .toEqual({ ticks: 33642, state: 'lost', wallets: '6704/4559', final: 976668040, hashes: '2751ccf1' });
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

  it('runs a co-op battle with abilities in sync: ≥ 30 casts of ≥ 6 kinds, every tap accepted or refused for a known reason, its checkpoint replaying', () => {
    const r = runAbilitiesBattle();
    expect(r.agree).toBe(true);
    expect(r.refused).toBe('');
    expect(r.cleared).toBeGreaterThanOrEqual(12);
    expect(r.casts).toBeGreaterThanOrEqual(30);
    expect(r.kinds.split(',')).toEqual(['boost', 'burst', 'debuff', 'econ', 'rally', 'strike']); // no deploy (A4)
    // both players cast, and some host taps met a recharging girl (the late-tap rule)
    expect(r.byOwner.split('/').every((n) => Number(n) > 0)).toBe(true);
    expect(r.taps).toMatch(/ cooldown/);
    expect(r.ckWave).toBe(8);
    expect(r.ckSame).toBe(true);
    expect(r.checkpoints).toBeGreaterThan(100);
    expect(runAbilitiesBattle().final).toBe(r.final);
    // pinned when the scenario landed (A2; V8, JSC and SpiderMonkey gave these): change only with a
    // deliberate sim / data / ability change, and say why. Re-pinned by the A2 review fixes (was 40227 /
    // '636/487' / 2145385076 / '5726405e', 46 casts): a manual cast's kill coins are pooled and split like
    // an auto-cast's (the same battle, the same 1123 coins, now 652/471: 2017100116 / '7ad61cb6'), then
    // the guest's girls and Nami carry Skill Haste 0.3 so the haste path runs on every engine.
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, final: r.final, hashes: r.hashes, casts: r.casts, byKind: r.byKind })
      .toEqual({ ticks: 37794, state: 'between', wallets: '678/487', final: 4070497048, hashes: '1a1c1c33', casts: 43, byKind: 'boost 2 · burst 18 · debuff 9 · econ 2 · rally 5 · strike 7' });
  }, 240000);

  it('runs the returning girls\' abilities (RETURNING_ABIL_START, A3 M3: Swoop, Moon Pounce, First Aid Call with a life back, Omen Card, Puppet Hex, Storm Lance at Lv 17) in sync, its checkpoint replaying', () => {
    const r = runReturningAbilBattle();
    expect(r.agree).toBe(true);
    expect(r.refused).toBe('');
    expect(r.cleared).toBe(14);
    for (const id of RETURNING_ABIL_IDS) expect(r.ids.split(','), id).toContain(id);
    expect(r.lifeRestored).toBeGreaterThanOrEqual(1); // First Aid Call's kills brought a life back
    expect(r.curseBursts).toBeGreaterThan(0);
    expect(r.hexed).toBeGreaterThan(0);
    // both heroes reached their Lv 17 rank (the merged skill: the * mark)
    expect(r.towers).toMatch(/0:seiran:Lv(1[7-9]|2\d)\+\d+\*/);
    expect(r.towers).toMatch(/1:yoriko:Lv(1[7-9]|2\d)\+\d+\*/);
    expect(r.taps).toMatch(/ cooldown/);
    expect(r.ckWave).toBe(8);
    expect(r.ckSame).toBe(true);
    expect(r.checkpoints).toBeGreaterThan(100);
    expect(runReturningAbilBattle().final).toBe(r.final);
    // pinned when the scenario landed (A3 M3; V8 and SpiderMonkey gave these, e2e/engines.mjs): change only with a
    // deliberate sim / data / ability change, and say why. Re-pinned for the Oct 27 power pass (PROPOSAL): the
    // fixture divides the damage rows back out (girls, heroes at Lv 1) against the ch2 HP pass; Noa's reach and
    // buff, Ruri's boss row and the heroes' curve past Lv 1 still move it
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, lives: r.lives, final: r.final, hashes: r.hashes, casts: r.casts, byId: r.byId, ckDigest: r.ckDigest, finalDigest: r.finalDigest })
      .toEqual({
        ticks: 46761, state: 'between', wallets: '563/782', lives: 100, final: 2532161845, hashes: 'a7143ce5', casts: 70,
        byId: 'aoi.skyfall 10 · ena.omenCard 8 · hana.swoop 19 · noa.firstAid 3 · ruri.moonPounce 4 · seiran.stormLance 13 · yoriko.puppetHex 13',
        ckDigest: '1c6fbc17', finalDigest: 'dd8fad33',
      });
  }, 240000);

  it('runs the returning girls\' battle (ROSTER_START) bit-identical to before their abilities were attached (none is cast there)', () => {
    const r = runRosterBattle();
    expect(r.agree).toBe(true);
    expect(r.ckSame).toBe(true);
    expect(r.abilityUnlocks).toBeGreaterThanOrEqual(4);
    expect(r.abilityCasts).toBe(0);
    // pinned in A3 M3 from the tree BEFORE the returning girls' rows were attached (fbdf8b3f352b): Ena, Ruri, Hana and
    // Noa reach their ⚡ tier 3 and Seiran / Yoriko Lv 7 here, so their abilities unlock and charge, but nobody casts
    // and nobody is on Auto: damage, lives, coins and every hash stay exactly what they were
    expect({ ticks: r.ticks, state: r.state, wave: r.wave, towers: r.towers, damage: r.damage, lives: r.lives, wallets: r.wallets, final: r.final, hashes: r.hashes, curseBursts: r.curseBursts, runners: r.runners })
      .toEqual({ ticks: 10541, state: 'wave', wave: 14, towers: 9, damage: 42404, lives: 150, wallets: '2703/3668', final: 2356508375, hashes: 'e0efe85c', curseBursts: 21, runners: 2 });
  }, 240000);

  it('runs a co-op battle with Tenka (TENKA_START: her lab team over two absorbs, every class, the economy weapon, wells, Last Line, a sale) in sync, its checkpoint replaying', () => {
    const r = runTenkaBattle();
    expect(r.agree).toBe(true);
    expect(r.final).toBe(r.finalB);
    expect(r.refused).toBe('');
    expect(r.cleared).toBe(14);
    // Joint Research takes the host's Aoi, Akane and Yuki in wave 1; Unified Theory, bought mid-wave after the
    // wave-7 checkpoint, takes Miko and Momo: all five classes joined. The guest's Rei stood in her range and stays.
    expect(r.absorbed).toMatch(/^0:\d+,\d+,\d+ \(w\d+ mid-wave\) 0:\d+,\d+ \(w\d+ mid-wave\)$/);
    expect(Number(r.absorbed.match(/\(w(\d+) mid-wave\)$/)[1])).toBeGreaterThan(r.ckWave);
    expect(r.joins).toBe('r1:3 r2:2');
    expect(r.joined).toBe(5);
    // (T3 review spec-1) one girl of each class, read from her lab record, not only five girls: a role moved
    // to another category would leave a class empty, and tenkaCoverage (engines.mjs's guard too) says so
    expect(r.members).toBe('dps:1 frag:1 control:1 support:1 economy:1');
    expect(tenkaCoverage(r)).toEqual([]);
    expect(tenkaCoverage({ ...r, members: 'dps:2 frag:1 control:0 support:1 economy:1' })).toEqual([expect.stringMatching(/nobody joined as control$/)]);
    expect(r.towers).toContain('1:rei:');
    // her weapons ran (grenades, the economy weapon's coins: Momo's income and interest, #146), the guest's
    // wells opened and her Last Line swallowed near the exit after the host sold her Tenka mid-wave
    expect(r.labFrags).toBeGreaterThan(0);
    expect(r.labCash).toBeGreaterThan(0);
    expect(r.wells).toBeGreaterThan(0);
    expect(r.lastLines).toBeGreaterThan(0);
    expect(r.swallowed).toBeGreaterThan(0);
    expect(r.sale).toMatch(/^\d+ \(w\d+ mid-wave\)$/);
    expect(r.ckWave).toBe(7);
    expect(r.ckSame).toBe(true);
    expect(r.checkpoints).toBeGreaterThan(100);
    expect(runTenkaBattle().final).toBe(r.final);
    // pinned when the scenario landed (T3; V8 gave these, and SpiderMonkey matched them in the T3 review
    // fixes; JavaScriptCore not run yet): change only with a deliberate sim / data change, and say why. The
    // T3 review added the class counts and the wave-7 checkpoint's digest (finalDigest is taken after the
    // sale, so only ckDigest holds a lab record)
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, final: r.final, hashes: r.hashes, absorbed: r.absorbed, members: r.members, sale: r.sale, labCash: r.labCash, wells: r.wells, swallowed: r.swallowed, ckDigest: r.ckDigest, finalDigest: r.finalDigest })
      .toEqual({ ticks: 56265, state: 'between', wallets: '1602/890', final: 823154332, hashes: 'a0c9a425', absorbed: '0:5,6,7 (w1 mid-wave) 0:9,30 (w12 mid-wave)', members: 'dps:1 frag:1 control:1 support:1 economy:1', sale: '941 (w14 mid-wave)', labCash: 145, wells: 67, swallowed: 7, ckDigest: '1c50c18f', finalDigest: '0639e165' });
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
      .toEqual({ ticks: 34231, state: 'won', wallets: '5434/5657', final: 1569870754, hashes: '0515c393', iroha: '500/436/757' });
  }, 240000);

  it('runs Marumi\'s Glow Bowl (GLOW_BOWL_START: ricochets, the finale, Bowling Thunder) in sync', () => {
    const r = runGlowBowlBattle();
    expect(r.refused).toBe('');
    expect(r.agree).toBe(true);
    expect(r.checkpoints).toBeGreaterThanOrEqual(20);
    expect(r.tiers.split(' ').slice(0, 2)).toEqual(['205', '501']); // Glow Bowl (host), Bowling Thunder (guest)
    const [pops, bounced, finales] = r.bowl.split('/').map(Number);
    expect(pops).toBeGreaterThan(bounced);
    expect(bounced).toBeGreaterThan(0);
    expect(finales).toBeGreaterThan(0);
    expect(runGlowBowlBattle().final).toBe(r.final);
    // pinned when the battle was added (v0.1.41: Marumi's rework with the lob for flyers only and the
    // Heavy Ball share tune). Change only with a deliberate sim / data change, and say why.
    expect({ ticks: r.ticks, state: r.state, wave: r.wave, wallets: r.wallets, final: r.final, hashes: r.hashes, bowl: r.bowl })
      .toEqual({ ticks: 72006, state: 'wave', wave: 27, wallets: '8250/7660', final: 191804684, hashes: '97443850', bowl: '694/402/1/0' });
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
