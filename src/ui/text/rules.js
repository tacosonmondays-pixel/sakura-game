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

/** "6 s ACTIVE every 20 s" / "Always on" for a MAP_RULES entry. */
export function ruleCycleLabel(rule) {
  if (!rule?.cycle) return 'Always on';
  return `${rule.cycle[1]} s ACTIVE every ${rule.cycle[0]} s`;
}

/** Does the rule draw marks on the map (vents or pads)? */
export function ruleHasMarks(rule) {
  return !!(rule?.zones?.length || rule?.pads?.length);
}
