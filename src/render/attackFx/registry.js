// Style registry: which attack style draws which girl.
//   resolveStyle(t) = STYLE_BY_UNIT[unitId] → BEHAVIOR_DEFAULT[behavior] → generic
// New girls (roster B3) plug in with one line: registerStyle('newGirl', style).
import { generic } from './styles/generic.js';
import { chika } from './styles/chika.js';

export const STYLE_BY_UNIT = {
  chika,
};

/** Fallback per sim behaviour (any turret owner gets drones). */
export const BEHAVIOR_DEFAULT = {
  projectile: generic,
  pulse: generic,
  duel: generic,
  beam: generic,
  chain: generic,
  trap: generic,
  turret: chika,
};

/** Registers (or replaces) the style of a unit id. */
export function registerStyle(unitId, style) {
  if (!unitId || !style) return;
  STYLE_BY_UNIT[unitId] = style;
}

/** Style object for a sim tower. */
export function resolveStyle(t) {
  return STYLE_BY_UNIT[t?.unitId] || BEHAVIOR_DEFAULT[t?.eff?.behavior] || generic;
}

export { generic };
