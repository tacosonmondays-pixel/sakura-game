// The scripted co-op battle that e2e/engines.mjs runs in V8, JavaScriptCore and SpiderMonkey:
// keep it healthy here (it must finish, nobody's scripted order may be refused, both clients
// must agree), so the cross-engine check keeps comparing a real, whole battle.
import { describe, it, expect } from 'vitest';
import { runScriptedBattle, runFreeplayBattle, runHeroBattle, runDronesBattle, runAbilitiesBattle, runReturningAbilBattle, RETURNING_ABIL_IDS, runRosterBattle, runTenkaBattle, tenkaCoverage, runPotentialBattle, runPotentialBossBattle, runGearGirlsBattle, runGlowBowlBattle, runShapesBattle, runHeldBattle, runGroundBattle, runLinksBattle, runS5aBattle, runS5bBattle, runDuoBattle, runTenkaLrBattle, runStaffBattle, freeplayTables, mathProbe, bitsHash } from '../../e2e/engines/scriptedBattle.js';
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

// Balance round 5 (src/data/balance.js) re-pinned every battle below that moved: a deliberate sim change. Every
// outcome is the same (won, lost, between; Marumi's Glow Bowl reaches wave 27, was 26); the abilities battle still casts
// ≥ 30 of ≥ 6 kinds; the returning girls' and the links scenarios divide the girls' rows back out (scriptedBattle.js).
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
      .toEqual({ ticks: 26831, state: 'won', wallets: '1491/1355', final: 1505992847, hashes: 'a0e96f5e', waves: '4735:a2a5a5b3' });
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
    // Re-pinned Oct 30 (Hotaru ×1.06, Momo ×1.06: the final review): was 23736 / 1305949636 / 604a609f.
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, final: r.final, hashes: r.hashes })
      .toEqual({ ticks: 23704, state: 'won', wallets: '317/222', final: 3922205631, hashes: 'a2e2b843' });
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
    // Re-pinned Oct 30 (Blade Cyclone never below her aimed volley; Umeko ×1.10, Hotaru ×1.04): was 33178 / 6532/4652 / 1833621268 / 6aef2a11 (Hotaru's row).
    // Re-pinned Oct 30 (Hotaru ×1.06, Momo ×1.06: the final review): was 33176 / 6608/4607 / 2717645599 / 5d8a6467.
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, final: r.final, hashes: r.hashes })
      .toEqual({ ticks: 33523, state: 'lost', wallets: '6452/4858', final: 1785592890, hashes: '2bf2bfce' });
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
    // Re-pinned for balance round 5 on v0.1.61 (was 54756 / '4071/2770' / 1840728084 / '571b75af', 144 casts, splits
    // 3/3): the round's rows (src/data/balance.js) move every girl's damage, so the crowds and the Auto rules' moments
    // move; every coverage rule above still holds.
    // Re-pinned Oct 30 (Blade Cyclone never below her aimed volley; Umeko ×1.10, Hotaru ×1.04): hashSim only (was ee689ad3).
    // Re-pinned Oct 30 (Hotaru ×1.06, Momo ×1.06: the final review): hashSim only (was 2029691f).
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, final: r.final, hashes: r.hashes, casts: r.casts, byKind: r.byKind, splits: r.splits, deploys: r.deploys })
      .toEqual({ ticks: 58197, state: 'between', wallets: '4138/3072', final: 2618839254, hashes: 'd0624155', casts: 153, byKind: 'boost 11 · burst 28 · debuff 17 · deploy 47 · econ 10 · move 5 · rally 13 · strike 22', splits: '1/1', deploys: 'chika.droneSurge 11×44 · iroha.mirrorShift 26×26 · kage.doubles 3×6 · suzu.bellCarpet 7×42' });
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
    // deliberate sim / data / ability change, and say why. (Attack shapes S4: the checkpoint and final digests moved, the
    // battle did not: every Sim now carries the tether fields and every enemy its `tie`, which the generic serializer
    // stores; ckDigest c653f418 → b2fe614b, finalDigest 089da6b4 → e0834a0a, same ticks, hashes and final.)
    // Re-pinned for Ena's spreading hex (feature/ena-contagion): her curse now rots and passes on while its enemy lives (was 47676 ticks / 843868789 / '0b57c250', 76 casts, digests 76e7917e / 8bc5612b): the
    // crowds thin sooner, so the Auto rules' moments move; every coverage check above still holds. Then the review r1
    // fixes (each curse records whose rot it is, `rotUid`) moved the checkpoint digest only (588f2a6d → ab003279).
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, lives: r.lives, final: r.final, hashes: r.hashes, casts: r.casts, byId: r.byId, ckDigest: r.ckDigest, finalDigest: r.finalDigest })
      .toEqual({
        ticks: 47193, state: 'between', wallets: '568/782', lives: 100, final: 2186080864, hashes: '00357611', casts: 75,
        byId: 'aoi.skyfall 12 · ena.omenCard 11 · hana.swoop 19 · noa.firstAid 4 · ruri.moonPounce 3 · seiran.stormLance 13 · yoriko.puppetHex 13',
        ckDigest: 'ab003279', finalDigest: '50bdf2cd',
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
    // Re-pinned Oct 30 (Noa's row ×1.04 damage, the final review round 2): the guest fields Noa, so her stats and the
    // state hashes move (final 3279512551 → 3763507503, hashes 8c876068 → 3224f922); ticks, damage, lives, coins and
    // the bursts are unchanged
    // Re-pinned for Ena's spreading hex (feature/ena-contagion): her curse now rots and passes on while its enemy lives (was wallets
    // 2828/3543, final 3279512551, hashes '8c876068', 10 curse bursts): Ena's curses rot and spread here even with no cast,
    // so a few kills land with the other player (the same 6371 coins in all); ticks, damage, lives and the zero casts hold
    expect({ ticks: r.ticks, state: r.state, wave: r.wave, towers: r.towers, damage: r.damage, lives: r.lives, wallets: r.wallets, final: r.final, hashes: r.hashes, curseBursts: r.curseBursts, runners: r.runners })
      .toEqual({ ticks: 9821, state: 'wave', wave: 14, towers: 9, damage: 28283, lives: 150, wallets: '2828/3543', final: 3763507503, hashes: '3224f922', curseBursts: 10, runners: 2 });
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
    // sale, so only ckDigest holds a lab record). Attack shapes S4 moved both digests and nothing else (the Sim's tether
    // fields and each enemy's `tie` are stored by the generic serializer): e864bd71 → d529f30d, 8e111df8 → a6ec7988
    // Re-pinned Oct 30 (Blade Cyclone never below her aimed volley; Umeko ×1.10, Hotaru ×1.04): digests only (was 60f651e2 / 98e117c2).
    // Re-pinned Oct 30 (Hotaru ×1.06, Momo ×1.06: the final review): hashes and digests (was 56118d0f / 908e0502 / 2e213a40).
    // Ena's spreading curse moved both digests and nothing else (the Sim's spread budget fields; no Ena here):
    // 60f651e2 → 2af38483, 98e117c2 → cddc50f8. Re-pinned Oct 30 (Blade Cyclone never below her aimed volley; Umeko ×1.10,
    // Hotaru ×1.04): digests only (on balance-r5 alone 60f651e2 → 908e0502, 98e117c2 → 2e213a40); both together 9436008b / 61d0c02a.
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, final: r.final, hashes: r.hashes, absorbed: r.absorbed, members: r.members, sale: r.sale, labCash: r.labCash, wells: r.wells, swallowed: r.swallowed, ckDigest: r.ckDigest, finalDigest: r.finalDigest })
      .toEqual({ ticks: 51073, state: 'between', wallets: '1602/890', final: 2270672136, hashes: '88532403', absorbed: '0:5,6,7 (w1 mid-wave) 0:9,30 (w12 mid-wave)', members: 'dps:1 frag:1 control:1 support:1 economy:1', sale: '941 (w14 mid-wave)', labCash: 145, wells: 56, swallowed: 7, ckDigest: 'ce8b48fe', finalDigest: '3557ee77' });
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
    // Re-pinned Oct 30 (Noa's row ×1.04 damage, the final review round 2): Noa is in this team, so her stats and the
    // state hashes move (final 32796160 → 2652086745, hashes 7cc84608 → 690a6f5b); the win, ticks, wallets and
    // Iroha's counts are unchanged
    // Re-pinned for Ena's spreading hex (was 42380 ticks / '5467/5624' / 32796160 / '7cc84608' / iroha 550/504/850): her
    // curse rots and spreads while its enemy lives, so the kills and the waves' ends move a little; the battle is still won
    expect({ ticks: r.ticks, state: r.state, wallets: r.wallets, final: r.final, hashes: r.hashes, iroha: r.iroha })
      .toEqual({ ticks: 42380, state: 'won', wallets: '5467/5624', final: 2652086745, hashes: '690a6f5b', iroha: '550/504/850' });
  }, 240000);

  it('runs the attack shapes S1 (SHAPES_START: Coin Wheel, Blade Cyclone, Firefly Halo) in sync, and a mid-wave rejoin lands on the run', () => {
    const r = runShapesBattle();
    expect(r.refused).toBe('');
    expect(r.agree).toBe(true);
    expect(r.checkpoints).toBeGreaterThanOrEqual(20);
    const [wheel, spin, halo] = r.shapes.split('/').map(Number);
    expect(wheel).toBeGreaterThan(0);
    expect(spin).toBeGreaterThan(0);
    expect(halo).toBeGreaterThan(0);
    expect(r.rejoinTick).toBeGreaterThan(0);
    expect(r.rejoinSame).toBe(true);
    expect(runShapesBattle().final).toBe(r.final);
    // pinned when the battle was added (feature/attack-shapes, S1 data fitted to the four-stage bench mean);
    // re-pinned Oct 29 for the refit on both rulers (the Coin Wheel keeps her toss coins, the Blade Cyclone at
    // tier 5 only with arms that stay on an enemy, a lighter halo); cheaper upgrades so both Kages reach tier 5.
    // Change only with a deliberate sim / data change, and say why.
    // Re-pinned Oct 30 (Blade Cyclone never below her aimed volley; Umeko ×1.10, Hotaru ×1.04): was 16314 / 3223573651 / f68f68df / 4/275/391 (every Blade Cyclone attack throws her aimed volley, the arms at a quarter).
    // Re-pinned Oct 30 (Hotaru ×1.06, Momo ×1.06: the final review): was 16307 / 1790642613 / 77aa58ea / 4/136/320.
    expect({ ticks: r.ticks, state: r.state, wave: r.wave, wallets: r.wallets, final: r.final, hashes: r.hashes, shapes: r.shapes, rejoinTick: r.rejoinTick })
      .toEqual({ ticks: 16302, state: 'won', wave: 22, wallets: '2207/1257', final: 2481460562, hashes: '5c4c2651', shapes: '4/134/318', rejoinTick: 10754 });
  }, 240000);

  it('runs the attack shapes S2 (HELD_START: Hearth Stream, Searchlight Sweep) in sync, and a mid-wave rejoin lands on the run', () => {
    const r = runHeldBattle();
    expect(r.refused).toBe('');
    expect(r.agree).toBe(true);
    expect(r.checkpoints).toBeGreaterThanOrEqual(15);
    const [stream, sweep] = r.held.split('/').map(Number);
    expect(stream).toBeGreaterThan(0);
    expect(sweep).toBeGreaterThan(0);
    expect(r.rejoinTick).toBeGreaterThan(0);
    expect(r.rejoinSame).toBe(true);
    expect(runHeldBattle().final).toBe(r.final);
    // pinned when the battle was added (feature/attack-held, S2 data fitted on both rulers); hashes 'dbbdef4d' → 'd38011ff'
    // when hashSim began folding t.ch.px (gear Pierce, review fix): the battle itself is the same (same final). Change
    // only with a deliberate sim / data change, and say why.
    // Re-pinned Oct 30 (Blade Cyclone never below her aimed volley; Umeko ×1.10, Hotaru ×1.04): was 28655 / 4139458384 / 89dbb28e / 4148/881 (Umeko's row).
    // Re-pinned Oct 30 (Akane's Inferno Queen stream half 45 → 55 steps, 67.5° → 82.5° per side, a 165° cone: from a corner
    // her 2-5-0 crowd read ×0.92 of live):
    // the same loss, wave, ticks, coins and rejoin; final 2141733565 → 844707250, hashes b8a0c27c → 322c2f61, held
    // 4147/879 → 4167/873 (her wider cone reaches a few more of the stream)
    expect({ ticks: r.ticks, state: r.state, wave: r.wave, wallets: r.wallets, final: r.final, hashes: r.hashes, held: r.held, rejoinTick: r.rejoinTick })
      .toEqual({ ticks: 28654, state: 'lost', wave: 16, wallets: '615/669', final: 844707250, hashes: '322c2f61', held: '4167/873', rejoinTick: 5568 });
  }, 240000);

  it('runs the attack shapes S3 (GROUND_START: Bramble Road, Rising Spikes, Ripple Quake) in sync, and a mid-wave rejoin lands on the run', () => {
    const r = runGroundBattle();
    expect(r.refused).toBe('');
    expect(r.agree).toBe(true);
    expect(r.checkpoints).toBeGreaterThanOrEqual(15);
    const [lash, spike, quake] = r.ground.split('/').map(Number);
    expect(lash).toBeGreaterThan(0);
    expect(spike).toBeGreaterThan(0);
    expect(quake).toBeGreaterThan(50);
    expect(r.kanna).toBeGreaterThanOrEqual(24);
    expect(r.rejoinTick).toBeGreaterThan(0);
    expect(r.rejoinSame).toBe(true);
    expect(runGroundBattle().final).toBe(r.final);
    // pinned when the battle was added (feature/attack-ground, S3 data fitted on both rulers); re-pinned at the S3 review
    // (Kanna moved beside the road near the spawn after wave 1 so her rings reach a crowd: 3 → 110 ring hits; the girls at
    // half damage; vines skip grounded flyers and walkers already held). Change only with a deliberate sim / data change,
    // and say why.
    expect({ ticks: r.ticks, state: r.state, wave: r.wave, wallets: r.wallets, final: r.final, hashes: r.hashes, ground: r.ground, rejoinTick: r.rejoinTick })
      .toEqual({ ticks: 20141, state: 'won', wave: 22, wallets: '1686/1798', final: 159571854, hashes: '5769ae44', ground: '26/681/58', rejoinTick: 9496 });
  }, 240000);

  it('runs the attack shapes S4 (LINKS_START: Homecoming Throw, Spirit Tether) in sync, and a mid-wave rejoin lands on the run', () => {
    const r = runLinksBattle();
    expect(r.refused).toBe('');
    expect(r.agree).toBe(true);
    expect(r.checkpoints).toBeGreaterThanOrEqual(15);
    const [cut, caught, tied, shared] = r.links.split('/').map(Number);
    expect(cut).toBeGreaterThan(500);
    expect(caught).toBeGreaterThan(500);
    expect(tied).toBeGreaterThan(20);
    expect(shared).toBeGreaterThan(500);
    expect(r.rejoinTick).toBeGreaterThan(0);
    expect(r.rejoinSame).toBe(true);
    expect(runLinksBattle().final).toBe(r.final);
    // pinned when the battle was added (feature/attack-links, S4 data fitted on both rulers; the host's girls at tier 5,
    // the guest's at tier 4: one girl per path at the final tier). Change only with a deliberate sim / data change, and say why.
    // Re-pinned for Ena's spreading hex (was 24568 ticks / '714/714' / 2324168228 / 'd26468f3', links 2203/1347/87/1922):
    // her curse rots and spreads, so the waves end sooner and fewer throws and tethers happen; every floor above holds
    expect({ ticks: r.ticks, state: r.state, wave: r.wave, wallets: r.wallets, final: r.final, hashes: r.hashes, links: r.links, rejoinTick: r.rejoinTick })
      .toEqual({ ticks: 23154, state: 'won', wave: 22, wallets: '716/716', final: 3583454853, hashes: '12ca779f', links: '2029/1265/86/1831', rejoinTick: 7076 });
  }, 240000);

  it('runs the attack shapes S5a (S5A_START: Charm Wheel, Crescent Return, Bell Toll) in sync, and a mid-wave rejoin lands on the run', () => {
    const r = runS5aBattle();
    expect(r.refused).toBe('');
    expect(r.agree).toBe(true);
    expect(r.checkpoints).toBeGreaterThanOrEqual(15);
    const [cres, charm, toll, rung] = r.s5a.split('/').map(Number);
    expect(cres).toBeGreaterThan(300);
    expect(charm).toBeGreaterThan(50);
    expect(toll).toBeGreaterThan(20);
    expect(rung).toBeGreaterThan(500);
    expect(r.tiers).toBe('500 400 050 400 500 040');
    expect(r.rejoinTick).toBeGreaterThan(0);
    expect(r.rejoinSame).toBe(true);
    expect(runS5aBattle().final).toBe(r.final);
    // pinned when the battle was added (feature/attack-shapes-s5, S5a; the host's girls at tier 5, the guest's at tier 4:
    // one girl per path at the final tier); re-pinned when Rei's crescent aimed at the densest line (Oct 30), and with S5b
    // (Miko's mirror beam leads her wheel from its first target, attackBeam's t._lead; hashSim folds the S5b records).
    // Change only with a deliberate sim / data change, and say why.
    expect({ ticks: r.ticks, state: r.state, wave: r.wave, wallets: r.wallets, final: r.final, hashes: r.hashes, s5a: r.s5a, rejoinTick: r.rejoinTick })
      .toEqual({ ticks: 32480, state: 'won', wave: 22, wallets: '770/2865', final: 2356239460, hashes: '1a9cae93', s5a: '1045/158/66/3121', rejoinTick: 7560 });
  }, 240000);

  it('runs the attack shapes S5b (S5B_START: Spore Mist, Static Web, Moonbeam Sweep) in sync, and a mid-wave rejoin lands on the run', () => {
    const r = runS5bBattle();
    expect(r.refused).toBe('');
    expect(r.agree).toBe(true);
    expect(r.checkpoints).toBeGreaterThanOrEqual(15);
    const [mist, zap, moon, web] = r.s5b.split('/').map(Number);
    expect(mist).toBeGreaterThan(1000);
    expect(zap).toBeGreaterThan(100);
    expect(moon).toBeGreaterThan(0);
    expect(web).toBeGreaterThan(10);
    expect(r.luna).toBeGreaterThanOrEqual(22);
    expect(r.rejoinTick).toBeGreaterThan(0);
    expect(r.rejoinSame).toBe(true);
    expect(runS5bBattle().final).toBe(r.final);
    // pinned when the battle was added (feature/attack-shapes-s5, S5b; the host's girls at tier 5 and Luna bought past
    // Lv 22, the guest's at tier 4). Change only with a deliberate sim / data change, and say why.
    expect({ ticks: r.ticks, state: r.state, wave: r.wave, wallets: r.wallets, final: r.final, hashes: r.hashes, s5b: r.s5b, rejoinTick: r.rejoinTick })
      .toEqual({ ticks: 20410, state: 'won', wave: 22, wallets: '1499/3038', final: 1874512872, hashes: '8f5eaf93', s5b: '9767/893/14/64', rejoinTick: 6054 });
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
      .toEqual({ ticks: 72006, state: 'wave', wave: 27, wallets: '8673/8083', final: 3971903258, hashes: '77c08440', bowl: '779/490/9/0' });
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
    // Re-pinned Oct 30 for the map-wide laser (the host's LR duo: a free beam locks on anywhere, her line runs edge to
    // edge, × PRISM_EDGE_MUL_LR past her short beam, her LR row × bosses): the battle ends sooner, ticks 37736 → 31940,
    // final 3211732776 → 3125619877, hashes e4374577 → 2ac47ed2, duo 244/1117/437/22/9/1 → 220/998/700/19/10/1. Then her LR
    // row ×1.05 damage (the LR floor): ticks 31940 → 32000, final 1109559171, hashes 5d0756a0, duo 218/989/653/19/10/1.
    // Then her non-LR row ×1.01 → ×1.12 (the final review round 2: Starfall at L40 beside Umeko + Midori): the same win,
    // wave, tiers and wallets; ticks 32000 → 31481, final 3811873204, hashes 34873e79, duo 216/981/640/19/10/1 (at ×1.11,
    // never shipped: ticks 32059, final 2156742882, hashes fbdae582).
    expect({ ticks: r.ticks, state: r.state, wave: r.wave, tiers: r.tiers, wallets: r.wallets, final: r.final, hashes: r.hashes, duo: r.duo })
      .toEqual({ ticks: 31481, state: 'won', wave: 22, tiers: '004 023 000 000', wallets: '3357/3772', final: 3811873204, hashes: '34873e79', duo: '216/981/640/19/10/1' });
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
    // Re-pinned Oct 30 for the LR rows (src/data/balance.js LR_POWER: the host's LR Tenka × bosses): the same waves,
    // ticks and coins; final 747075865 → 2042327016, hashes 8ab4dbef → c121be7a, horizon 3/2/2/3 → 3/2/2/2.
    // Re-pinned Oct 30 for the LR premium (Rail Arms tier 5 ×1.7 while LR): final 2042327016 → 1684999597, hashes c121be7a →
    // b70575f5, wallets 1730/6014 → 1731/6015 (the same waves and ticks).
    // Re-pinned Oct 30 for the LR bar (Rail Arms tier 5 ×1.7 → ×3.5 while LR): hashSim only, b70575f5 → 74403ee3 (the
    // same waves, ticks, coins, final and Event Horizon counts: her bolts already took what they hit).
    expect({ ticks: r.ticks, state: r.state, wave: r.wave, tiers: r.tiers, wallets: r.wallets, final: r.final, hashes: r.hashes, horizon: r.horizon })
      .toEqual({ ticks: 43031, state: 'won', wave: 26, tiers: '050 030 000 000', wallets: '1731/6015', final: 1684999597, hashes: '74403ee3', horizon: '3/2/2/2' });
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
      .toEqual({ ticks: 47056, state: 'won', wave: 20, wallets: '685/259', final: 967869385, hashes: 'c237cd0a', staff: '1066/22/29/0/0/14/24', heroLevels: '21/24' });
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
