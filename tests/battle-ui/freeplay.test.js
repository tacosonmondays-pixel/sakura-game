// Co-op freeplay battle UI helpers: big-number formatting (boss bar, results) and the scout's
// pressure chip (what the coming freeplay wave carries).
import { describe, it, expect } from 'vitest';
import { fmtBig } from '../../src/ui/battle/util.js';
import {
  freeplayPressureInfo, pressureText, fmtArmor, freeplayBossTelegraph, telegraphText, eliteName, ELITE_MOD_TEXT, BOSS_COUNTER,
} from '../../src/ui/battle/scout.js';
import { createCoopSim } from '../../src/online/coop/commands.js';

describe('fmtBig', () => {
  it('k / M / B / T with three significant digits, plain below 100,000', () => {
    expect(fmtBig(0)).toBe('0');
    expect(fmtBig(99999)).toBe('99,999');
    expect(fmtBig(100000)).toBe('100k');
    expect(fmtBig(130000)).toBe('130k');
    expect(fmtBig(568000)).toBe('568k');
    expect(fmtBig(1250000)).toBe('1.25M');
    expect(fmtBig(132300000)).toBe('132M');
    expect(fmtBig(13230000)).toBe('13.2M');
    expect(fmtBig(24.9e9)).toBe('24.9B');
    expect(fmtBig(7.6e12)).toBe('7.6T');
    expect(fmtBig(3e9)).toBe('3B');
    expect(fmtBig(NaN)).toBe('0');
  });
});

const start = (freeplay) => ({
  seed: 1, stageId: '1-3', difficulty: 'normal', freeplay,
  players: [{ slot: 0, uid: 'a', name: 'A', loadout: [{ unitId: 'aoi' }], hero: null }, { slot: 1, uid: 'b', name: 'B', loadout: [{ unitId: 'rei' }], hero: null }],
});

describe('the freeplay pressure chip', () => {

  it('is null at or before the goal and outside freeplay', () => {
    const { sim } = createCoopSim(start('blossom'));
    expect(freeplayPressureInfo(sim, 15)).toBeNull();
    expect(freeplayPressureInfo(createCoopSim(start(null)).sim, 16)).toBeNull();
  });

  it('reads the wave HP ramp, armor, speed and Resolve; orange once Resolve is short', () => {
    const { sim } = createCoopSim(start('crimson'));
    const early = freeplayPressureInfo(sim, 16);
    // armor grows a little every wave (depth / every; the chip rounds to 0.1)
    expect(early).toMatchObject({ tier: 'crimson', tierName: 'Crimson Moon', armor: 0.1, eliteArmor: 0, cc: 6, warn: false });
    expect(fmtArmor(early.armor)).toBe('0.1');
    expect(fmtArmor(20 / 15)).toBe('1.3');
    expect(early.hp).toBeGreaterThan(1);
    const late = freeplayPressureInfo(sim, 15 + 60);
    expect(late.armor).toBe(6);
    expect(late.eliteArmor).toBe(4); // Crimson Moon's elite band: (60 − 20) / 10
    expect(late.cc).toBe(1);
    expect(late.warn).toBe(true);
    expect(late.speedPct).toBe(18);
    expect(late.hp).toBeGreaterThan(early.hp);
    const text = pressureText(late);
    expect(text).toMatch(/^Freeplay pressure \(Crimson Moon\): enemies have [\d.,k]+× their base HP, \+6 armor \(elites \+4 more\), and move 18 % faster\./);
    expect(text).toMatch(/Armor never stops more than 75 % of a hit here\.$/);
    expect(text).toMatch(/stuns after 1 s in total and knockback after \d+ tiles?/);
    expect(text).not.toMatch(/undefined|NaN/);
  });
});

describe('the boss telegraph and elite names (path-cap pass)', () => {
  it('BOSS IN 2 then BOSS NEXT, with the boss HP and its counter; nothing at or before the goal', () => {
    const { sim } = createCoopSim(start('blossom'));
    // 1-3 Blossom: the Slime Prince at 30, then a boss every 5 from 50 (the Grave Lych / Iron Colossus at 100)
    expect(freeplayBossTelegraph(sim, 12)).toBeNull();
    expect(freeplayBossTelegraph(sim, 29)).toMatchObject({ inWaves: 2, wave: 30, enemyId: 'slime_prince', small: false });
    const next = freeplayBossTelegraph(sim, 30);
    expect(next).toMatchObject({ inWaves: 1, wave: 30, enemyId: 'slime_prince' });
    const info = sim.freeplayInfo(30);
    expect(next.hp).toBeCloseTo(sim.data.enemy('slime_prince').hp * sim.stage.hpScale * sim.diff.hpMul * info.bossHpMul[0], 6);
    expect(freeplayBossTelegraph(sim, 32)).toBeNull();
    const five = freeplayBossTelegraph(sim, 55);
    expect(five).toMatchObject({ inWaves: 1, wave: 55, small: true });
    const lych = [99, 100, 101].map((n) => freeplayBossTelegraph(sim, n)).find((t) => t?.enemyId === 'grave_lych' || t?.enemyId === 'iron_colossus');
    expect(lych).toBeTruthy();
    expect(lych.counter).toBe(BOSS_COUNTER[sim.data.enemy(lych.enemyId).armorClass]);
    expect(telegraphText(lych)).toMatch(/^Boss (next wave|in 2 waves): (Grave Lych|Iron Colossus), [\d.,kMB]+ HP\. \w+: /);
    // the Matriarch carries an elemental ward
    expect(freeplayBossTelegraph(sim, 199).counter).toBe(BOSS_COUNTER.ward);
  });

  it('names a modified elite by its modifier ("Ironclad Orc Warlord")', () => {
    const info = { eliteMods: [{ enemyId: 'orc_warlord', mod: 'ironclad' }] };
    expect(eliteName(info, 'orc_warlord', 'Orc Warlord')).toBe('Ironclad Orc Warlord');
    expect(eliteName(info, 'orc_grunt', 'Orc Grunt')).toBe('Orc Grunt');
    expect(eliteName(null, 'orc_warlord', 'Orc Warlord')).toBe('Orc Warlord');
    for (const id of ['ironclad', 'bulwark', 'quickened', 'vampiric', 'unyielding']) expect(ELITE_MOD_TEXT[id][1].length).toBeGreaterThan(5);
  });
});
