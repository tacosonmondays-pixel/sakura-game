// The five gear slots (docs/specs/GEAR_UPDATE.md §2): the classic three keep rolling exactly as before, the Hair Clip
// and the Necklace exist only as set pieces, the support stats are main stats only, and every reader outside the sim
// takes its slots from src/data/gearSlots.js.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { GEAR_SLOTS, GEAR_MAIN_STATS } from '../../src/data/types.js';
import { SLOT_IDS, ROLL_SLOTS, SET_ONLY_SLOTS, MAIN_STATS_BY_SLOT, GEAR_SLOT_DEFS } from '../../src/data/gearSlots.js';
import { GEAR_STAT_DEFS, MAIN_ONLY_STATS, SUB_STAT_KEYS, subPool } from '../../src/data/gearStats.js';
import { TUNE_BITS } from '../../src/data/gearAwaken.js';
import { CLUB_IDS } from '../../src/data/clubs.js';
import { createRng } from '../../src/core/rng.js';
import { rollGear } from '../../src/systems/gear.js';

describe('gear slots', () => {
  it('five slots, append-only, the classic three first and unchanged', () => {
    expect(SLOT_IDS).toEqual(['charm', 'ribbon', 'shoes', 'hair', 'necklace']);
    expect(ROLL_SLOTS).toEqual(Object.keys(GEAR_SLOTS));
    expect(SET_ONLY_SLOTS).toEqual(['hair', 'necklace']);
    for (const s of ROLL_SLOTS) {
      expect(MAIN_STATS_BY_SLOT[s]).toEqual(GEAR_MAIN_STATS[s]);
      expect(GEAR_SLOT_DEFS[s]).toEqual(GEAR_SLOTS[s]);
    }
    expect(GEAR_SLOT_DEFS.hair.name).toBe('Hair Clip');
    expect(GEAR_SLOT_DEFS.necklace.name).toBe('Necklace');
    expect(MAIN_STATS_BY_SLOT.hair).toEqual(['atkPct', 'critChance', 'auraPct', 'auraRangePct']);
    expect(MAIN_STATS_BY_SLOT.necklace).toEqual(['critDmg', 'ratePct', 'buffDurPct', 'controlPct']);
    for (const s of SLOT_IDS) for (const k of MAIN_STATS_BY_SLOT[s]) expect(GEAR_STAT_DEFS[k], k).toBeTruthy();
  });

  it('rollGear with no slot draws today\'s sequence (only the classic three)', () => {
    // pinned on origin/main at 60ce9cad, before the gear update: the same seed gives the very same pieces
    const a = createRng('gear-slots-pin');
    const got = [];
    for (const r of ['common', 'rare', 'superRare', 'mythic', 'legendary']) for (let i = 0; i < 20; i++) got.push(rollGear(a, { rarity: r, level: i % 11, club: i % 3 ? null : 'taiko' }));
    for (const g of got) expect(ROLL_SLOTS).toContain(g.slot);
    expect(createHash('sha1').update(JSON.stringify(got)).digest('hex').slice(0, 12)).toBe('7b620f9b2671');
  });

  it('new mains only on the new slots; the support stats are never substats', () => {
    const rng = createRng('mains');
    for (let i = 0; i < 200; i++) {
      const slot = SET_ONLY_SLOTS[i % 2];
      const g = rollGear(rng, { slot, rarity: 'legendary', club: CLUB_IDS[i % CLUB_IDS.length] });
      expect(MAIN_STATS_BY_SLOT[slot]).toContain(g.main.stat);
      for (const s of g.subs) expect(MAIN_ONLY_STATS).not.toContain(s.stat);
    }
    for (const s of SLOT_IDS) for (const c of [null, ...CLUB_IDS]) for (const k of subPool(s, c)) expect(SUB_STAT_KEYS).toContain(k);
    expect(subPool('hair', 'archery')).toContain('piercePct');
    expect(subPool('necklace', 'archery')).toContain('auraPct');
    expect(subPool('hair', 'archery')).not.toContain('auraPct');
  });

  it('TUNE_BITS is append-only and covers every stat', () => {
    expect(TUNE_BITS.slice(0, 10)).toEqual(['atkPct', 'ratePct', 'rangePct', 'critChance', 'critDmg', 'armorPen', 'costCut', 'ultHaste', 'piercePct', 'auraPct']);
    expect([...TUNE_BITS].sort()).toEqual(Object.keys(GEAR_STAT_DEFS).sort());
  });

  it('no reader outside gearSlots.js and the sim names GEAR_SLOTS or GEAR_MAIN_STATS', () => {
    const root = path.resolve(__dirname, '..', '..');
    const files = [];
    const walk = (d) => {
      for (const f of readdirSync(d)) {
        const p = path.join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(m?js)$/.test(f)) files.push(p);
      }
    };
    walk(path.join(root, 'src'));
    walk(path.join(root, 'tools'));
    const allowed = (rel) => rel.startsWith('src/sim/') || rel === 'src/data/types.js' || rel === 'src/data/gearSlots.js' || rel.startsWith('tools/blender/');
    const bad = files
      .map((p) => path.relative(root, p).split(path.sep).join('/'))
      .filter((rel) => !allowed(rel) && /\bGEAR_(SLOTS|MAIN_STATS)\b/.test(readFileSync(path.join(root, rel), 'utf8')));
    expect(bad).toEqual([]);
  });
});
