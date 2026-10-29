// The scripted co-op battle that e2e/engines.mjs runs in V8, JavaScriptCore and SpiderMonkey:
// keep it healthy here (it must finish, nobody's scripted order may be refused, both clients
// must agree), so the cross-engine check keeps comparing a real, whole battle.
import { describe, it, expect } from 'vitest';
import { runScriptedBattle, runFreeplayBattle, runHeroBattle, runDronesBattle, runAbilitiesBattle, runReturningAbilBattle, RETURNING_ABIL_IDS, runRosterBattle, runTenkaBattle, tenkaCoverage, runPotentialBattle, runPotentialBossBattle, runGearGirlsBattle, runGlowBowlBattle, runDuoBattle, runTenkaLrBattle, runStaffBattle, freeplayTables, mathProbe, bitsHash } from '../../e2e/engines/scriptedBattle.js';
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
    // on her track; landing plan S12) together with its stage-HP pass. The wave tables re-pinned by Gate Arc Step 1:
    // chapter 1's five Act II stages add 252 tables (102 waves + 5 × 30 endless), and Step 2's chapter-2 five add 267
    // (117 waves + 5 × 30 endless), Step 3's chapter-3 five add 276 (126 waves + 5 × 30 endless), Step 4's chapter-4
    // five add 282 (132 waves + 5 × 30 endless), Step 5's chapter-5 five add 286 (136 waves + 5 × 30 endless) and Step 6's
    // chapter-6 five and the side stage side-6-starfall add 354 (144 + 30 waves + 6 × 30 endless); the
    // tables of the stages that existed
    // before stay pinned bit for bit in tests/sim/campaignGolden.test.js
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, final: r.final, hashes: r.hashes, waves: r.waves })
      .toEqual({ ticks: 28995, state: 'won', wallets: '1499/1347', final: 93082125, hashes: '7db1eed1', waves: '4735:a2a5a5b3' });
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

  it('runs a co-op battle with abilities in sync: ≥ 30 casts of ≥ 6 kinds, every tap accepted or refused for a known reason, its checkpoint replaying', () => {
    const r = runAbilitiesBattle();
    expect(r.agree).toBe(true);
    expect(r.refused).toBe('');
    expect(r.cleared).toBeGreaterThanOrEqual(20);
    expect(r.casts).toBeGreaterThanOrEqual(30);
    // deploy: the A4 deploys and the guest's Iroha (Mirror Shift, A6; shots split at her panel); move: the host's Fuu (A5)
    expect(r.kinds.split(',')).toEqual(['boost', 'burst', 'debuff', 'deploy', 'econ', 'move', 'rally', 'strike']);
    expect(r.deploys.split(' · ').map((x) => x.split(' ')[0])).toEqual(['chika.droneSurge', 'iroha.mirrorShift', 'kage.doubles', 'suzu.bellCarpet']);
    expect(Number(r.splits.split('/')[0])).toBeGreaterThan(0);
    // each coverage girl casts at least twice (the deploys by id, Fuu's move by kind), and the bursts and strikes stay
    // well above the floor
    for (const x of r.deploys.split(' · ')) expect(Number(x.split(' ')[1].split('×')[0]), x).toBeGreaterThanOrEqual(2);
    const by = Object.fromEntries(r.byKind.split(' · ').map((x) => x.split(' ')).map(([k, n]) => [k, Number(n)]));
    expect(by.move).toBeGreaterThanOrEqual(2);
    expect(by.burst).toBeGreaterThanOrEqual(15);
    expect(by.strike).toBeGreaterThanOrEqual(10);
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
    // the guest's girls and Nami carry Skill Haste 0.3 so the haste path runs on every engine. Re-pinned for A4–A6 (was
    // 37655 / '800/520' / 4047740824 / 'c84c23e1', 51 casts): the host fields Fuu (Backdraft Fan, the move kind; it
    // ignores her own gusts' push locks) and Suzu, the guest Kage, Iroha (Mirror Shift splitting shots, the host's too) and
    // Chika, all cheap, weak shooters (ABIL_DEPLOY, so the crowds the others' Auto rules wait for still form), each player
    // taps them on their own cadence (COVER), and their abilities cast (V8 here; the cross-engine run, e2e/engines.mjs,
    // checks the other engines agree). Then (was 30346 / 2173867755 / '4d00c481', 35 casts) the A4–A6 review: a mirror never
    // splits its owner's shots, Auto keeps a placed panel, doubles hold while sabotaged and throw her full volley, Bell
    // Carpet counts a shared stretch once; and the battle runs to wave 20 so each coverage girl casts at least twice.
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, final: r.final, hashes: r.hashes, casts: r.casts, byKind: r.byKind, splits: r.splits, deploys: r.deploys })
      .toEqual({ ticks: 54756, state: 'between', wallets: '4071/2770', final: 1840728084, hashes: '571b75af', casts: 144, byKind: 'boost 11 · burst 29 · debuff 20 · deploy 44 · econ 11 · move 2 · rally 8 · strike 19', splits: '3/3', deploys: 'chika.droneSurge 13×52 · iroha.mirrorShift 18×18 · kage.doubles 5×10 · suzu.bellCarpet 8×48' });
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
    // deliberate sim / data / ability change, and say why
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, lives: r.lives, final: r.final, hashes: r.hashes, casts: r.casts, byId: r.byId, ckDigest: r.ckDigest, finalDigest: r.finalDigest })
      .toEqual({
        ticks: 47017, state: 'between', wallets: '568/782', lives: 100, final: 3293782298, hashes: '6e087590', casts: 72,
        byId: 'aoi.skyfall 11 · ena.omenCard 9 · hana.swoop 19 · noa.firstAid 2 · ruri.moonPounce 5 · seiran.stormLance 13 · yoriko.puppetHex 13',
        ckDigest: 'c653f418', finalDigest: '089da6b4',
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
    // and nobody is on Auto: damage, lives, coins and every hash stay exactly what they were.
    // Re-pinned once for fix/seiran-dragon (merged in 98a4677; the pin above still held on fea20ee, just before it):
    // Dragonflight now flies all the way back to START, so the run reaches the same wave sooner (12239 → 11492
    // ticks, 60 → 61 curse bursts, new hashes) and a few kills land with the other player (wallets 2796/3575 →
    // 2891/3480, the same 6371 coins in all); damage, lives and the zero casts are unchanged
    expect({ ticks: r.ticks, state: r.state, wave: r.wave, towers: r.towers, damage: r.damage, lives: r.lives, wallets: r.wallets, final: r.final, hashes: r.hashes, curseBursts: r.curseBursts, runners: r.runners })
      .toEqual({ ticks: 11492, state: 'wave', wave: 14, towers: 9, damage: 28283, lives: 150, wallets: '2891/3480', final: 253530618, hashes: 'a90dc673', curseBursts: 61, runners: 2 });
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
      .toEqual({ ticks: 51073, state: 'between', wallets: '1602/890', final: 2270672136, hashes: '35f90fff', absorbed: '0:5,6,7 (w1 mid-wave) 0:9,30 (w12 mid-wave)', members: 'dps:1 frag:1 control:1 support:1 economy:1', sale: '941 (w14 mid-wave)', labCash: 145, wells: 56, swallowed: 7, ckDigest: 'e864bd71', finalDigest: '8e111df8' });
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
      .toEqual({ ticks: 72006, state: 'wave', wave: 26, wallets: '7258/6667', final: 821407225, hashes: '018423c4', bowl: '659/397/7/0' });
  }, 240000);

  it('runs the duo Kohaku & Tsubaki (DUO_START: Refraction, Kohaku\'s beam, Prismfall on Auto-cast, the host\'s LR Twin Star) in sync', () => {
    const r = runDuoBattle();
    expect(r.refused).toBe('');
    expect(r.agree).toBe(true);
    expect(r.checkpoints).toBeGreaterThanOrEqual(20);
    const [refract, shards, beams, casts, twinStar, aims] = r.duo.split('/').map(Number);
    expect(refract).toBeGreaterThan(0);
    expect(shards).toBeGreaterThan(refract * 2); // 3+ shards a split
    expect(beams).toBeGreaterThan(0);
    expect(casts).toBeGreaterThan(0);
    // only the host's duo carries the LR flag: some casts end with a Twin Star, never all of them
    expect(twinStar).toBeGreaterThan(0);
    expect(twinStar).toBeLessThan(casts);
    expect(aims).toBe(1);
    expect(runDuoBattle().final).toBe(r.final);
    // pinned when the battle was added (the duo build, Oct 28). Change only with a deliberate sim / data change, and say why.
    // Re-pinned Oct 28 for Kohaku's constant beam (src/sim/duo.js: damage ticks every 6 steps instead of a flash every
    // ~1.4 s, beams that hold their enemy, `beams` now counts lock-ons and a repeat every 1.5 s held): ticks 44632 → 44656, final 3327486567 → 1485318803,
    // hashes 8b361ee7 → baad978d, duo 273/1262/388/… → 274/1266/616/… (a lock-on and every 1.5 s held: Kohaku's clip)
    // Re-pinned Oct 29 for the Oct 29 duo buff (base +25%, the LR form ×1.1 and her long beam: the host's duo is LR):
    // the battle ends sooner, ticks 44656 → 39421, final 1485318803 → 1647005069, hashes baad978d → f97c7537.
    expect({ ticks: r.ticks, state: r.state, wave: r.wave, tiers: r.tiers, wallets: r.wallets, final: r.final, hashes: r.hashes, duo: r.duo })
      .toEqual({ ticks: 39421, state: 'won', wave: 22, tiers: '004 023 000 000', wallets: '3357/3772', final: 1647005069, hashes: 'f97c7537', duo: '251/1153/498/24/9/1' });
  }, 240000);

  it('runs Tenka\'s LR form (TENKA_LR_START: Critical Mass · Event Horizon\'s pull and second detonation on the host\'s LR Tenka, the guest\'s without) in sync', () => {
    const r = runTenkaLrBattle();
    expect(r.refused).toBe('');
    expect(r.agree).toBe(true);
    expect(r.checkpoints).toBeGreaterThanOrEqual(20);
    const [casts, pulls, blasts, hit] = r.horizon.split('/').map(Number);
    expect(pulls).toBeGreaterThan(0);
    expect(pulls).toBeLessThan(casts); // only the host's Tenka is LR
    expect(blasts).toBeGreaterThan(0);
    expect(hit).toBeGreaterThan(0); // the second detonation found enemies the pull held in its area
    expect(r.tiers.split(' ')[0]).toBe('050'); // the host's LR Tenka reached Zero Point (Event Horizon on the tier-5 blast)
    expect(runTenkaLrBattle().final).toBe(r.final);
    // pinned when the battle was added (Tenka's LR form, Oct 29). Change only with a deliberate sim / data change, and say why.
    expect({ ticks: r.ticks, state: r.state, wave: r.wave, tiers: r.tiers, wallets: r.wallets, final: r.final, hashes: r.hashes, horizon: r.horizon })
      .toEqual({ ticks: 47644, state: 'won', wave: 26, tiers: '050 030 000 000', wallets: '1709/5994', final: 3127393822, hashes: 'e2b30df2', horizon: '3/2/2/3' });
  }, 240000);

  it('runs the staff heroes (STAFF_START: Norika\'s barricades and Hold the Line on a forked map, Kogane\'s plow and Moves) in sync', () => {
    const r = runStaffBattle();
    expect(r.refused).toBe('');
    expect(r.agree).toBe(true);
    expect(r.checkpoints).toBeGreaterThanOrEqual(20);
    const [held, breaks, lines, , , plows, moves] = r.staff.split('/').map(Number);
    expect(held).toBeGreaterThan(0);
    expect(breaks).toBeGreaterThan(0);
    expect(lines).toBeGreaterThan(0);
    expect(plows).toBeGreaterThan(0);
    expect(moves).toBeGreaterThan(0);
    expect(runStaffBattle().final).toBe(r.final);
    // pinned when the battle was added (banners G7, Oct 28). Change only with a deliberate sim / data change, and say why.
    // Re-pinned the same day (final review): Hold the Line now casts only during a wave (a calm point holds no lines),
    // and the host casts it in waves only (ultInWave).
    expect({ ticks: r.ticks, state: r.state, wave: r.wave, wallets: r.wallets, final: r.final, hashes: r.hashes, staff: r.staff, heroLevels: r.heroLevels })
      .toEqual({ ticks: 49465, state: 'won', wave: 20, wallets: '778/268', final: 3094781041, hashes: '8552ea5e', staff: '1082/21/32/0/0/15/28', heroLevels: '21/24' });
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
