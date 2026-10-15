// missions.counters holds more than mission event counts: Potential M0 mirrors every girl's
// duplicate count there ('pot:<unitId>', 'pot:at'), and co-op freeplay marks every paid
// once-per-account milestone there ('fpm:<tier>:<id>'), because older builds keep that map word for
// word when they rewrite a save. The two namespaces must never read each other's keys, and both
// must survive an older build dropping their main copies (units[id].dupes, progress.freeplay).
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { createRng } from '../../src/core/rng.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { SHADOW_PREFIX, SHADOW_AT, restoreFromShadow } from '../../src/systems/potential.js';
import { MILESTONE_MARK, applyCoopFreeplayEnd, freeplayRecords } from '../../src/online/coop/rewards.js';

const fpResult = (o = {}) => ({
  stageId: '1-3', difficulty: 'normal', won: false, wave: 160, wavesCleared: 152, livesLeft: 0, maxLives: 100,
  encountered: ['slime_green'], kills: { slime_green: 10, dragon_ashwing: 1 }, stats: {},
  freeplay: 'blossom', goal: 15, goalReached: true, finished: false, ...o,
});

describe('missions.counters namespaces: Potential shadows vs freeplay milestone marks', () => {
  it('the prefixes are disjoint and no girl id can spell the Potential timestamp key', () => {
    expect(SHADOW_PREFIX).not.toBe(MILESTONE_MARK);
    expect(SHADOW_PREFIX.startsWith(MILESTONE_MARK) || MILESTONE_MARK.startsWith(SHADOW_PREFIX)).toBe(false);
    expect(SHADOW_AT.startsWith(SHADOW_PREFIX)).toBe(true);
    expect(SHADOW_AT.startsWith(MILESTONE_MARK)).toBe(false);
    expect(UNIT_MAP[SHADOW_AT.slice(SHADOW_PREFIX.length)]).toBeUndefined(); // no girl called 'at'
  });

  it('both survive an older build dropping dupes and progress.freeplay, and neither reads the other', () => {
    const p = createProfile();
    grantUnit(p, 'kaede', 1000);
    grantUnit(p, 'kaede', 2000); // a duplicate: dupes 1
    applyCoopFreeplayEnd(p, fpResult(), createRng(1), { banked: null });
    const c = p.missions.counters;
    const pot = Object.keys(c).filter((k) => k.startsWith(SHADOW_PREFIX));
    const fpm = Object.keys(c).filter((k) => k.startsWith(MILESTONE_MARK));
    expect(c[`${SHADOW_PREFIX}kaede`]).toBe(1);
    expect(fpm).toEqual(expect.arrayContaining(['fpm:blossom:w100', 'fpm:blossom:w150', 'fpm:blossom:matriarch']));
    expect(pot.filter((k) => fpm.includes(k))).toEqual([]);

    // an older cached build rewrites the save: no dupes on the girls, no progress.freeplay
    const old = JSON.parse(JSON.stringify(p));
    for (const u of Object.values(old.units)) delete u.dupes;
    delete old.progress.freeplay;
    const back = migrateProfile(old);
    expect(back.units.kaede.dupes).toBe(1);
    expect(back.units.aoi.dupes).toBe(0);
    // the freeplay records come back from the 'fpm:' marks only (no 'pot:' key turns into a milestone)
    const rec = freeplayRecords(back);
    expect(rec.done.sort()).toEqual(['blossom:matriarch', 'blossom:w100', 'blossom:w150']);
    // and the Potential restore reads only its own keys (milestone marks are not girls)
    expect(Object.keys(restoreFromShadow(back.units, back.missions.counters, []))).not.toContain('blossom:w100');
    // nothing pays twice
    const gems = back.currencies.gems;
    const again = applyCoopFreeplayEnd(back, fpResult({ wavesCleared: 160 }), createRng(1), { banked: null });
    expect(again.freeplay.milestones).toEqual([]);
    expect(back.currencies.gems).toBe(gems);
  });
});
