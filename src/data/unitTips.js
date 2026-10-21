// Which of a girl's tips the menus show: her student page (Info > Tips), the lobby secretary's lines
// and the Wiki's student tables.
//
// A tower girl's ⚡ tip ("<path> tier 3 teaches <ability>: …") is about her ability, and abilities
// are dormant in this build: the ability bar has not shipped, so nothing in a battle casts one. The
// tips stay in the data (tests/data/abilities.test.js pins one per tower) and the menus leave them
// out until the bar ships; then set ABILITY_TIPS_SHOWN to true.

export const ABILITY_TIPS_SHOWN = false;

/** Is this tip about a ⚡ ability? */
export function isAbilityTip(tip) {
  return typeof tip === 'string' && (tip.startsWith('⚡') || /\bteaches\b/.test(tip));
}

/** The tips a menu shows for `unit`, in their order. */
export function shownTips(unit) {
  const tips = unit?.tips || [];
  return ABILITY_TIPS_SHOWN ? tips : tips.filter((t) => !isAbilityTip(t));
}
