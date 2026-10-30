// Which of a girl's tips the menus show: her student page (Info > Tips), the lobby secretary's lines
// and the Wiki's student tables.
//
// A tower girl's ⚡ tip ("<path> tier 3 teaches <ability>: …") is about her ability. The ability bar
// has shipped (A3), so the menus show it — but only when her first ⚡ ability runs in this build
// (abilityRuns, the one rule in src/data/abilities.js): a girl whose ability waits never advertises a button that isn't
// there (owner default Q3; every tower's runs since A4–A6: the deploys, Fuu's Backdraft Fan, Iroha's Mirror Shift). Not
// part of the co-op hash.
import { abilityRuns } from './abilities.js';

/** The switch for every menu at once (false: no ⚡ tip anywhere, as before the ability bar shipped). */
export const ABILITY_TIPS_SHOWN = true;

/** Is this tip about a ⚡ ability? */
export function isAbilityTip(tip) {
  return typeof tip === 'string' && (tip.startsWith('⚡') || /\bteaches\b/.test(tip));
}

/** Her first ⚡ ability entry (a tower's first ⚡ path, a hero's skill), or null. */
export function firstAbilityEntry(unit) {
  const p = (unit?.paths || []).find((x) => x?.ability);
  return p ? p.ability : unit?.hero?.skill || null;
}

/** Does a menu show her ⚡ tips: the switch is on and her first ⚡ ability runs. */
export function abilityTipsShown(unit) {
  return ABILITY_TIPS_SHOWN && abilityRuns(firstAbilityEntry(unit));
}

/** The tips a menu shows for `unit`, in their order. */
export function shownTips(unit) {
  const tips = unit?.tips || [];
  return abilityTipsShown(unit) ? tips : tips.filter((t) => !isAbilityTip(t));
}
