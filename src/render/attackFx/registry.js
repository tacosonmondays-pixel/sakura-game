// Style registry: which attack style draws which girl.
//   resolveStyle(t) = STYLE_BY_UNIT[unitId] → BEHAVIOR_DEFAULT[behavior] → generic
// New girls (roster B3) plug in with one line: registerStyle('newGirl', style).
import { generic } from './styles/generic.js';
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
// the returning girls (roster wave, src/data/unitsExpansion.js)
import { kanna } from './styles/kanna.js';
import { yoriko } from './styles/yoriko.js';
import { seiran } from './styles/seiran.js';
import { fuu } from './styles/fuu.js';
import { hana } from './styles/hana.js';
import { ruri } from './styles/ruri.js';
import { noa } from './styles/noa.js';
import { iroha } from './styles/iroha.js';
import { ena } from './styles/ena.js';

export const STYLE_BY_UNIT = {
  chika, hikari, luna, nami, aoi, rei, yuki, momo, akane, sango, kage, umeko, shiro, midori, suzu, raika, miko, hotaru, kaede,
  kanna, yoriko, seiran, fuu, hana, ruri, noa, iroha, ena,
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
