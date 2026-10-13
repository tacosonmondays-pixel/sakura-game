// Which game a co-op client runs. Lockstep only works when both clients run the same sim on the
// same data, but the game is a PWA: after a deploy a cached older client can meet an updated
// one, and that pair would desync every time. The lobby therefore compares this in 'hello' and
// refuses to pair two different versions ("Your ally runs a different version — reload").
//   proto  bumped whenever a co-op message changes shape
//   build  the git commit the bundle was built from (vite.config.js defines __BUILD_ID__)
//   data   a hash of the battle data both sims read (girls, enemies, stages, maps, rules)
import { UNITS } from '../../data/units.js';
import { ENEMIES } from '../../data/enemies.js';
import { STAGES } from '../../data/stages.js';
import { MAPS } from '../../data/maps.js';
import { BATTLE, DIFFICULTIES, TYPE_CHART } from '../../data/types.js';
import { COOP } from '../../data/coop.js';

export const COOP_PROTOCOL = 2;
/* global __BUILD_ID__ */
export const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? String(__BUILD_ID__) : 'dev';

/** FNV-1a over a string, as 8 hex digits. */
export function fnv(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

let cached = null;

/** @returns {{ proto: number, build: string, data: string }} (computed once, ~ms) */
export function coopVersion() {
  if (!cached) {
    const data = fnv(JSON.stringify([UNITS, ENEMIES, STAGES, MAPS, BATTLE, DIFFICULTIES, TYPE_CHART, COOP]));
    cached = Object.freeze({ proto: COOP_PROTOCOL, build: BUILD_ID, data });
  }
  return cached;
}

/** Can these two clients play together? */
export function sameVersion(a, b) {
  return !!a && !!b && a.proto === b.proto && a.build === b.build && a.data === b.data;
}
