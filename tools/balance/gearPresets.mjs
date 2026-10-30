// The five-piece gear presets (GEAR_UPDATE.md §8.4 "the bench moves to five pieces"): each girl in five real pieces,
// through the game's own unitBattleStats, as round 5's `full` profile (tools/balance/maxedProfile.mjs: L85, ★5, 10
// gates, P6, an LR unit's Limit Break), one table for the bench and the boards (tools/potentialProfiles.mjs `--gear`).
//
// | preset     | the five pieces                                                                               |
// |------------|-----------------------------------------------------------------------------------------------|
// | urLate5    | UR +12 in her best set, ✦✦ (gold + rainbow) on her first sub, the main and that sub pinned     |
// | lrSet5     | Set LR +18 in her best set (the LR Set Form), urLate5's ✦✦ and pins, the Nightglass ✦ on sub 2 |
// | lrBlank4   | four Blank LR +18 (lrSet5's lines) and one urLate5 piece (no set, no doubled caps)            |
// | lrBlank5   | five Blank LR +18 (every cap doubled; crit over 100 % becomes super crits)                    |
//
// Average rolls everywhere but the pinned lines; ▲ one each 3 levels on the least-grown sub. Clubs Taiko 3 (charm,
// ribbon, shoes) + Fencing 2 (Hair Clip, Necklace). Mains: a striker's crit damage / crit chance / attack speed /
// ATK / crit damage; a support's ATK / crit chance / attack speed / aura / Buff Duration. `--gear lrBlank5'` (the
// spec's spelling, with the prime) works too.
import { unitBattleStats } from '../../src/systems/progression.js';
import { mainStatRange, substatRange, recomputeGear } from '../../src/systems/gear.js';
import { setIdle } from '../../src/systems/gearSets.js';
import { TUNE_GOLD, TUNE_RAINBOW, LR_SET, LR_BLANK, LR_MAX_LEVEL, UR_MAX_LEVEL } from '../../src/data/gearAwaken.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { RESONANCE_ON } from './maxedProfile.mjs';

export const PRESET_IDS = Object.freeze(['urLate5', 'lrSet5', 'lrBlank4', 'lrBlank5']);
/** `lrBlank5'` → `lrBlank5`; null when it is not a five-piece preset. */
export const presetId = (name) => {
  const id = String(name || '').replace(/'$/, '');
  return PRESET_IDS.includes(id) ? id : null;
};

const SUPPORTS = new Set(['miko', 'midori', 'umeko', 'chika', 'momo', 'nami']);
/** Her best set: a support's by role, a striker's first set her kit uses all of (setIdle), Geometry first. */
const BY_ROLE = { miko: 'spirit', midori: 'spirit', umeko: 'spirit', chika: 'powerbank', momo: 'treasurer' };
const STRIKER_ORDER = ['geometry', 'popper', 'powerbank', 'freezetag', 'spirit'];
export function bestSet(unitId) {
  if (BY_ROLE[unitId]) return BY_ROLE[unitId];
  const live = STRIKER_ORDER.find((s) => { const r = setIdle(s, unitId); return !r.passive && !r.cap; });
  return live || STRIKER_ORDER.find((s) => !setIdle(s, unitId).passive) || 'geometry';
}

const SLOTS = ['charm', 'ribbon', 'shoes', 'hair', 'necklace'];
const MAINS = {
  striker: { charm: 'critDmg', ribbon: 'critChance', shoes: 'ratePct', hair: 'atkPct', necklace: 'critDmg' },
  support: { charm: 'atkPct', ribbon: 'critChance', shoes: 'ratePct', hair: 'auraPct', necklace: 'buffDurPct' },
};
const SUBS = ['atkPct', 'critChance', 'critDmg', 'ratePct', 'armorPen'];
const avg = ([a, b]) => (a + b) / 2;

/** One piece: `kind` 'ur' | 'set' | 'blank'. */
function piece(unitId, slot, kind, set) {
  const mainStat = MAINS[SUPPORTS.has(unitId) ? 'support' : 'striker'][slot];
  const subStats = SUBS.filter((s) => s !== mainStat).slice(0, 4);
  const level = kind === 'ur' ? UR_MAX_LEVEL : LR_MAX_LEVEL;
  const [, top] = mainStatRange(mainStat, 'legendary');
  const g = {
    uid: `${unitId}_${slot}`, slot, rarity: 'legendary', level, ur: 1,
    main: { stat: mainStat, base: top, top: 1 },
    subs: subStats.map((stat, i) => ({
      stat, base: i === 0 ? substatRange(stat, 'legendary')[1] : +avg(substatRange(stat, 'legendary')).toFixed(4), upgrades: 0,
      ...(i === 0 ? { tuned: TUNE_GOLD | TUNE_RAINBOW, top: 1 } : null), ...(i === 1 && kind !== 'ur' ? { night: 1 } : null),
    })),
    club: slot === 'hair' || slot === 'necklace' ? 'fencing' : 'taiko', locked: false, equippedBy: unitId, name: `${unitId} ${slot}`,
  };
  if (kind === 'set') g.lr = LR_SET;
  if (kind === 'blank') g.lr = LR_BLANK;
  if (kind !== 'blank' && set) g.set = set;
  for (let l = 1; l <= level; l++) if (l % 3 === 0) g.subs.reduce((m, x) => (x.upgrades < m.upgrades ? x : m), g.subs[0]).upgrades += 1;
  return recomputeGear(g);
}

/** Her profile in a preset (a profile object unitBattleStats reads). */
export function presetProfile(unitId, preset) {
  const id = presetId(preset);
  if (!id) throw new Error(`unknown five-piece preset ${preset} (${PRESET_IDS.join(', ')})`);
  const set = bestSet(unitId);
  const kinds = { urLate5: ['ur', 'ur', 'ur', 'ur', 'ur'], lrSet5: ['set', 'set', 'set', 'set', 'set'], lrBlank4: ['blank', 'blank', 'blank', 'blank', 'ur'], lrBlank5: ['blank', 'blank', 'blank', 'blank', 'blank'] }[id];
  const gear = {};
  const slots = {};
  SLOTS.forEach((slot, i) => {
    // (lrBlank4's UR piece wears no set: one set piece alone is no set)
    const g = piece(unitId, slot, kinds[i], id === 'lrBlank4' ? null : set);
    gear[g.uid] = g;
    slots[slot] = g.uid;
  });
  return {
    units: { [unitId]: { level: 85, awaken: 5, breakthrough: 10, pl: 6, gear: slots } },
    gear,
    missions: { counters: { [`lr:${unitId}`]: 1, [`lbt:${unitId}`]: 1 } },
  };
}

/** Her battle stats in a preset, UR Resonance on (RESONANCE_ON) unless `now` says otherwise. */
export function presetStats(unitId, preset, now = RESONANCE_ON) {
  const keep = Date.now;
  Date.now = () => now;
  try {
    return unitBattleStats(presetProfile(unitId, preset), unitId);
  } finally {
    Date.now = keep;
  }
}
