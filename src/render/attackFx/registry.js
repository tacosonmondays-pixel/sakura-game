// Style registry: which attack style draws which girl.
//   resolveStyle(t) = STYLE_BY_UNIT[unitId] → BEHAVIOR_DEFAULT[behavior] → generic
// New girls (roster B3) plug in with one line: registerStyle('newGirl', style).
import { generic } from './styles/generic.js';
import { tenka } from './styles/tenka.js'; // the new girls (stand-in until Tenka's FX milestone)
import { chika } from './styles/chika.js';
import { hikari } from './styles/hikari.js';
import { luna } from './styles/luna.js';
import { nami } from './styles/nami.js';
import { aoi } from './styles/aoi.js';
import { rei } from './styles/rei.js';
import { yuki } from './styles/yuki.js';
import { momo } from './styles/momo.js';
import { akane } from './styles/akane.js';
import { sango } from './styles/sango.js';
import { kage } from './styles/kage.js';
import { umeko } from './styles/umeko.js';
import { shiro } from './styles/shiro.js';
import { midori } from './styles/midori.js';
import { suzu } from './styles/suzu.js';
import { raika } from './styles/raika.js';
import { miko } from './styles/miko.js';
import { hotaru } from './styles/hotaru.js';
import { kaede } from './styles/kaede.js';

export const STYLE_BY_UNIT = {
  tenka,
  chika, hikari, luna, nami, aoi, rei, yuki, momo, akane, sango, kage, umeko, shiro, midori, suzu, raika, miko, hotaru, kaede,
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
