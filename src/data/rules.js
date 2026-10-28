// Map rules (docs/specs/CODEX_MODES.md §3, §5.2): one per campaign stage from 1-4 on, always on in
// every mode and difficulty. Numbers and game ids only (display text: src/ui/text/rules.js).
//
// MAP_RULES[id] = { id, cycle: [period s, active s] | null, active: {…}, always: {…}, pastGoal? }
// The cycle restarts at every wave start and each wave opens resting: the rule rests for the first
// period − active seconds, then is ACTIVE for `active` seconds, and repeats. `always` effects hold
// for the whole battle; `active` effects only while ACTIVE (always, when there is no cycle).
// Effect keys (the sim reads only these; € = economy, which stops past the goal):
//   dmgMul, typeMul {type: ×}, elementMul {el: ×}, enemySpeed, familySpeed {fam: ×},
//   classSpeed {cls: ×}, rangeMul, rangeAdd, € bountyAdd, € livesPerWave,
//   € bonusEvery {n, coins, ult}, zoneDps (+ the stage's zones), padDmgMul / padRangeAdd
//   (+ the stage's pads), reverseEvenWaves, affinity [ids] / affinityMul, portals {at, jump}.
// pastGoal: 'combat' (default) keeps every non-€ effect past the goal; 'off' makes the rule neutral.

const rule = (id, cycle, { active = {}, always = {}, pastGoal = 'combat' } = {}) =>
  Object.freeze({ id, cycle: cycle ? Object.freeze(cycle) : null, active: Object.freeze(active), always: Object.freeze(always), pastGoal });

export const MAP_RULES = Object.freeze({
  petal_sanctuary: rule('petal_sanctuary', null, { always: { livesPerWave: 3 } }),
  firefly_chorus: rule('firefly_chorus', [16, 6], { active: { dmgMul: 1.25 } }),
  moonlit_blessing: rule('moonlit_blessing', [18, 9], { active: { typeMul: { holy: 1.3 } } }),
  changing_tides: rule('changing_tides', [18, 7], { active: { familySpeed: { slime: 0.65 }, elementMul: { lightning: 1.35 } } }),
  snowbell_blizzard: rule('snowbell_blizzard', [20, 7], { active: { enemySpeed: 0.7, rangeMul: 0.85 } }),
  heat_mirage: rule('heat_mirage', [18, 6], { active: { rangeAdd: -0.5 }, always: { bountyAdd: 1 } }),
  forge_vents: rule('forge_vents', [15, 5], { active: { zoneDps: 6 } }),
  alchemists_mist: rule('alchemists_mist', null, { always: { elementMul: { poison: 1.4 }, classSpeed: { heavy: 0.85 } } }),
  tailwind: rule('tailwind', [16, 6], { active: { enemySpeed: 1.25, typeMul: { pierce: 1.25, slash: 1.25, blast: 1.25 } } }),
  supply_ship: rule('supply_ship', null, { always: { bonusEvery: { n: 4, coins: 150 }, elementMul: { lightning: 1.2 } } }),
  prism_conduits: rule('prism_conduits', null, { always: { padDmgMul: 1.25, padRangeAdd: 0.7 } }),
  rear_ambush: rule('rear_ambush', null, { always: { reverseEvenWaves: true } }),
  lunar_eclipse: rule('lunar_eclipse', [20, 6], { active: { typeMul: { holy: 1.5 }, classSpeed: { spectral: 1.2 } } }),
  festival_encore: rule('festival_encore', null, { always: { bonusEvery: { n: 3, coins: 120, ult: true } } }),
  shifting_stars: rule('shifting_stars', null, {
    always: { affinity: ['fire', 'frost', 'lightning', 'holy', 'mystic'], affinityMul: 1.5, portals: { at: 0.4, jump: 0.12 } },
  }),
});

const v = (x, y, r = 1.6) => Object.freeze({ x, y, r });
const pad = (x, y, r = 0.9) => Object.freeze({ x, y, r });

/** Stage → rule placement (§3.2) and the stage's vents and pads (§3.3). */
export const STAGE_RULES = Object.freeze({
  '1-4': { id: 'petal_sanctuary' },
  '1-5': { id: 'firefly_chorus' },
  '2-1': { id: 'changing_tides' },
  '2-2': { id: 'firefly_chorus' },
  '2-3': { id: 'changing_tides' },
  '2-4': { id: 'supply_ship' },
  '2-5': { id: 'changing_tides' },
  '3-1': { id: 'moonlit_blessing' },
  '3-2': { id: 'moonlit_blessing' },
  '3-3': { id: 'lunar_eclipse' },
  '3-4': { id: 'moonlit_blessing' },
  '3-5': { id: 'lunar_eclipse' },
  '4-1': { id: 'snowbell_blizzard' },
  '4-2': { id: 'rear_ambush' },
  '4-3': { id: 'supply_ship' },
  '4-4': { id: 'tailwind' },
  '4-5': { id: 'snowbell_blizzard' },
  '5-1': { id: 'alchemists_mist' },
  '5-2': { id: 'changing_tides' },
  '5-3': { id: 'firefly_chorus' },
  '5-4': { id: 'alchemists_mist' },
  '5-5': { id: 'lunar_eclipse' },
  '6-1': { id: 'prism_conduits', pads: [pad(12, 7.5), pad(8.5, 3.5), pad(5.5, 7.5)] },
  '6-2': { id: 'heat_mirage' },
  '6-3': { id: 'forge_vents', zones: [v(5.5, 4.25)] },
  '6-4': { id: 'forge_vents', zones: [v(9.5, 6.25)] },
  '6-5': { id: 'prism_conduits', pads: [pad(10, 8), pad(2.5, 8), pad(16.5, 8.5)] },
  '7-1': { id: 'festival_encore' },
  '7-2': { id: 'rear_ambush' },
  '7-3': { id: 'moonlit_blessing' },
  '7-4': { id: 'lunar_eclipse' },
  '7-5': { id: 'festival_encore' },
  '8-1': { id: 'tailwind' },
  '8-2': { id: 'snowbell_blizzard' },
  '8-3': { id: 'heat_mirage' },
  '8-4': { id: 'shifting_stars' },
  '8-5': { id: 'tailwind' },
  // Chapter 1 · Act II — Rush Hour (shown under their stage skins, src/ui/text/rules.js STAGE_RULE_SKINS)
  '1-6': { id: 'petal_sanctuary' },
  '1-7': { id: 'tailwind' },
  '1-8': { id: 'firefly_chorus' },
  '1-9': { id: 'changing_tides' },
  '1-10': { id: 'supply_ship' },
  // Chapter 2 · Act II — Hilltop After Dark
  '2-6': { id: 'petal_sanctuary' },
  '2-7': { id: 'lunar_eclipse' },
  '2-8': { id: 'prism_conduits', pads: [pad(5.5, 2.5), pad(9.5, 5.5), pad(16.5, 8.5)] },
  '2-9': { id: 'firefly_chorus' },
  '2-10': { id: 'changing_tides' },
  // Chapter 3 · Act II — The Bell Festival
  '3-6': { id: 'moonlit_blessing' },
  '3-7': { id: 'forge_vents', zones: [v(3.5, 5.0), v(11.0, 5.9)] },
  '3-8': { id: 'alchemists_mist' },
  '3-9': { id: 'heat_mirage' },
  '3-10': { id: 'lunar_eclipse' },
  // Chapter 4 · Act II — The Checkpoint (4-9's pads are the village's three last warm hearths)
  '4-6': { id: 'supply_ship' },
  '4-7': { id: 'heat_mirage' },
  '4-8': { id: 'rear_ambush' },
  '4-9': { id: 'prism_conduits', pads: [pad(7.5, 4.5), pad(12.5, 4.5), pad(10, 9)] },
  '4-10': { id: 'snowbell_blizzard' },
});

/** The stage's rule (MAP_RULES entry + its zones and pads), or null. */
export function stageRule(stageId) {
  const s = STAGE_RULES[stageId];
  const def = s && MAP_RULES[s.id];
  if (!def) return null;
  return Object.freeze({ ...def, zones: Object.freeze(s.zones ?? []), pads: Object.freeze(s.pads ?? []) });
}
