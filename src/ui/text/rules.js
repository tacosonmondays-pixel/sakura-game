// Display text for the map rules (docs/specs/CODEX_MODES.md §3.1, §8.3). Outside the co-op id:
// the sim reads only src/data/rules.js.

export const RULE_TEXT = {
  petal_sanctuary: { name: 'Petal Sanctuary', short: 'Petals', icon: 'rulePetal', desc: 'Falling petals restore 3 hearts after every cleared wave.', toast: null, activeWord: null },
  firefly_chorus: { name: 'Firefly Chorus', short: 'Fireflies', icon: 'ruleFirefly', desc: 'For 6 s in every 16, fireflies boost every girl\'s damage by 25%.', toast: 'Firefly Chorus! Every girl +25% damage (6 s)', activeWord: 'fireflies' },
  moonlit_blessing: { name: 'Moonlit Blessing', short: 'Moonlight', icon: 'ruleMoon', desc: 'During the bright half of each 18 s moon cycle, Holy attacks deal 30% more damage.', toast: 'Moonlight! Holy +30% (9 s)', activeWord: 'moonlight' },
  changing_tides: { name: 'Changing Tides', short: 'Tides', icon: 'ruleTide', desc: 'High tide (7 s in every 18) slows slimes by 35% and boosts Lightning by 35%.', toast: 'High tide! Slimes slowed, Lightning +35% (7 s)', activeWord: 'high tide' },
  snowbell_blizzard: { name: 'Snowbell Blizzard', short: 'Blizzard', icon: 'ruleSnow', desc: 'Blizzards (7 s in every 20) slow every enemy by 30% but cut girls\' range by 15%.', toast: 'Blizzard! Enemies 30% slower, range −15% (7 s)', activeWord: 'blizzard' },
  heat_mirage: { name: 'Heat Mirage', short: 'Mirage', icon: 'ruleSun', desc: 'Heat haze (6 s in every 18) cuts girls\' range by 0.5. Every defeated enemy drops 1 extra coin.', toast: 'Heat haze! Range −0.5 (6 s)', activeWord: 'heat haze' },
  forge_vents: { name: 'Forge Vents', short: 'Vents', icon: 'ruleVent', desc: 'Every 15 s the glowing vents erupt for 5 s, burning ground enemies that cross them.', toast: 'The vents erupt! (5 s)', activeWord: 'eruption' },
  alchemists_mist: { name: 'Alchemist\'s Mist', short: 'Mist', icon: 'ruleMist', desc: 'Poison deals 40% more damage, and heavy enemies wade 15% slower through the mist.', toast: null, activeWord: null },
  tailwind: { name: 'Tailwind', short: 'Tailwind', icon: 'ruleWind', desc: 'Gusts (6 s in every 16) speed enemies up by 25%; Pierce, Slash and Blast hit 25% harder in them.', toast: 'Tailwind! Enemies faster; Pierce, Slash, Blast +25% (6 s)', activeWord: 'gust' },
  supply_ship: { name: 'Supply Ship', short: 'Supply', icon: 'ruleShip', desc: 'A supply boat brings 150 battle coins after every 4th wave. Rain boosts Lightning by 20%.', toast: null, activeWord: null },
  prism_conduits: { name: 'Prism Conduits', short: 'Prisms', icon: 'rulePrism', desc: 'A girl standing on a glowing crystal pad gets +0.7 range and +25% damage. One girl per pad.', toast: null, activeWord: null },
  rear_ambush: { name: 'Rear Ambush', short: 'Ambush', icon: 'ruleAmbush', desc: 'Every even wave comes in through the goal gate. Cover both ends.', toast: null, activeWord: null },
  lunar_eclipse: { name: 'Lunar Eclipse', short: 'Eclipse', icon: 'ruleEclipse', desc: 'During each 6 s eclipse (every 20 s) Holy deals 50% more damage and spectral enemies move 20% faster.', toast: 'Lunar Eclipse! Holy +50%, spirits faster (6 s)', activeWord: 'eclipse' },
  festival_encore: { name: 'Festival Encore', short: 'Encore', icon: 'ruleEncore', desc: 'Every 3rd cleared wave recharges your hero\'s ultimate and pays 120 battle coins.', toast: null, activeWord: null },
  shifting_stars: { name: 'Shifting Stars', short: 'Stars', icon: 'ruleStars', desc: 'Each wave one power shines (+50%): Fire, Frost, Lightning, Holy, Mystic in turn. Ordinary enemies slip through a star rift once.', toast: null, activeWord: null },
};

/** Power names for Shifting Stars' affinity line. */
export const AFFINITY_NAMES = { fire: 'Fire', frost: 'Frost', lightning: 'Lightning', holy: 'Holy', mystic: 'Mystic', pierce: 'Pierce', slash: 'Slash', blast: 'Blast', poison: 'Poison', water: 'Water' };

export const PAST_GOAL_LINE = 'Past the goal: no hearts or coin bonuses from the map rule.';

export function ruleText(id) {
  return RULE_TEXT[id] || null;
}

/** The text fields a stage skin may replace. */
export const SKIN_FIELDS = ['name', 'short', 'desc', 'toast', 'activeWord'];

/**
 * Per-stage skins over a rule's display text (Gate Arc): a stage in another era tells a shipped rule
 * in its own words ("Tailwind" becomes the rush hour on a Noon street), keyed by stage id:
 * { rule, name?, short?, desc?, toast?, activeWord? }. A skin applies only to the rule it names.
 * Display text only: the sim reads src/data/rules.js, so skins sit outside the sim id and the co-op
 * data hash, and the numbers stay the rule's own (every number in the rule's description must appear
 * in the skin's: tests/ui/ruleSkins.test.js).
 */
export const STAGE_RULE_SKINS = {
  // Chapter 1 · Act II — Rush Hour (docs/specs/gate-arc/MAPS.md §1.2)
  '1-6': {
    rule: 'petal_sanctuary', name: 'Rush-hour Evacuation', short: 'Evacuation',
    desc: 'Commuters file out to the shelters: 3 hearts come back after every cleared wave.',
  },
  '1-7': {
    rule: 'tailwind', name: 'Crowd Surge', short: 'Surge', activeWord: 'surge',
    desc: 'The crowd surges (6 s in every 16): enemies hurry 25% faster, and Pierce, Slash and Blast hit them 25% harder in the crush.',
    toast: 'Crowd surge! Enemies faster; Pierce, Slash, Blast +25% (6 s)',
  },
  '1-8': {
    rule: 'firefly_chorus', name: 'Time Sale', short: 'Sale', activeWord: 'time sale',
    desc: 'For 6 s in every 16 the store announces a time sale: every girl deals 25% more damage.',
    toast: 'Time sale! Every girl +25% damage (6 s)',
  },
  '1-9': {
    rule: 'changing_tides', name: 'Lock Cycle', short: 'Lock', activeWord: 'lock filling',
    desc: 'The canal lock fills (7 s in every 18): slimes wade 35% slower and Lightning hits 35% harder.',
    toast: 'The lock fills! Slimes slowed, Lightning +35% (7 s)',
  },
  '1-10': {
    rule: 'supply_ship', name: 'Brigade Airdrop', short: 'Airdrop',
    desc: 'Brigade crates parachute in after every 4th wave: 150 battle coins. Rain boosts Lightning by 20%.',
  },
  // Chapter 2 · Act II — Hilltop After Dark (docs/specs/gate-arc/MAPS.md §1.3)
  '2-6': {
    rule: 'petal_sanctuary', name: 'Shelter Intake', short: 'Intake',
    desc: 'Shelter 3 takes people in through the night: 3 hearts come back after every cleared wave.',
  },
  '2-7': {
    rule: 'lunar_eclipse', name: 'Lights Out', short: 'Lights out', activeWord: 'lights out',
    desc: 'The campus lights cut out for 6 s (every 20 s): Holy deals 50% more damage and spectral enemies move 20% faster in the dark.',
    toast: 'Lights out! Holy +50%, spirits faster (6 s)',
  },
  '2-8': {
    rule: 'prism_conduits', name: 'Sensor Pads', short: 'Sensors',
    desc: 'A girl standing on a glowing Brigade sensor pad gets +0.7 range and +25% damage. One girl per pad.',
  },
  '2-9': {
    rule: 'firefly_chorus', name: 'Starting Pistol', short: 'Pistol', activeWord: 'race on',
    desc: 'For 6 s in every 16 the starting pistol fires and the stands cheer: every girl deals 25% more damage.',
    toast: 'Starting pistol! Every girl +25% damage (6 s)',
  },
  '2-10': {
    rule: 'changing_tides', name: 'Lake Swell', short: 'Swell', activeWord: 'lake swell',
    desc: 'The lake swells over the breakwater (7 s in every 18): slimes wade 35% slower and Lightning hits 35% harder.',
    toast: 'The lake swells! Slimes slowed, Lightning +35% (7 s)',
  },
  // Chapter 3 · Act II — The Bell Festival (docs/specs/gate-arc/STEP3_BUILD_PLAN.md §5)
  '3-6': {
    rule: 'moonlit_blessing', name: 'Bell Festival', short: 'Festival', activeWord: 'the bells',
    desc: 'During the bright half of each 18 s moon cycle the shrine bell rings over the festival: Holy attacks deal 30% more damage.',
    toast: 'The bells ring! Holy +30% (9 s)',
  },
  '3-7': {
    rule: 'forge_vents', name: 'Hot Griddles', short: 'Griddles', activeWord: 'griddles',
    desc: 'Every 15 s the takoyaki griddles flare for 5 s, burning ground enemies that cross them.',
    toast: 'The griddles flare! (5 s)',
  },
  '3-8': {
    rule: 'alchemists_mist', name: 'Lake Fog', short: 'Fog',
    desc: 'In the lake fog Poison deals 40% more damage, and heavy enemies wade 15% slower.',
  },
  '3-9': {
    rule: 'heat_mirage', name: "HAMMER's Smoke", short: 'Smoke', activeWord: 'smoke',
    desc: 'Smoke rolls over the lanes (6 s in every 18) and cuts girls\' range by 0.5. Every defeated enemy drops 1 extra coin.',
    toast: 'Smoke! Range −0.5 (6 s)',
  },
  '3-10': {
    rule: 'lunar_eclipse', name: 'The Tear', short: 'Tear', activeWord: 'the tear',
    desc: 'The tear over the shrine opens for 6 s (every 20 s): Holy deals 50% more damage and spectral enemies move 20% faster.',
    toast: 'The tear opens! Holy +50%, spirits faster (6 s)',
  },
};

/**
 * A stage's rule text: RULE_TEXT[ruleId] with the stage's skin over it (the icon, cycle and marks
 * stay the rule's). `baseName` is the rule's own name when a skin renamed it.
 * @param {{ id?: string, rule?: { id: string } }|null} stage StageDef (or a co-op / battle copy of one)
 * @param {string|null} [ruleId] the rule in force (default: the stage's own)
 * @param {object} [skins] skin table (tests)
 * @returns {object|null} null when there is no rule text
 */
export function ruleTextFor(stage, ruleId = stage?.rule?.id ?? null, skins = STAGE_RULE_SKINS) {
  const base = ruleId ? RULE_TEXT[ruleId] : null;
  if (!base) return null;
  const skin = stage?.id ? skins[stage.id] : null;
  if (!skin || skin.rule !== ruleId) return base;
  const out = { ...base, baseName: base.name };
  for (const k of SKIN_FIELDS) if (skin[k] != null) out[k] = skin[k];
  return out;
}

/** "6 s ACTIVE every 20 s" / "Always on" for a MAP_RULES entry. */
export function ruleCycleLabel(rule) {
  if (!rule?.cycle) return 'Always on';
  return `${rule.cycle[1]} s ACTIVE every ${rule.cycle[0]} s`;
}

/** Does the rule draw marks on the map (vents or pads)? */
export function ruleHasMarks(rule) {
  return !!(rule?.zones?.length || rule?.pads?.length);
}

/** The wave banner's line on a wave a lane schedule closes a lane (Gate Arc: a level crossing's barrier). */
export const LANE_CLOSED_LINE = 'Crossing closed: long way round';

/** Per-stage wording of that line (stage id → text; e.g. a checkpoint gate instead of a crossing). */
export const STAGE_LANE_TEXT = {};

/** The banner line for `stage` when a lane is closed. */
export function laneClosedText(stage) {
  return (stage?.id && STAGE_LANE_TEXT[stage.id]) || LANE_CLOSED_LINE;
}
