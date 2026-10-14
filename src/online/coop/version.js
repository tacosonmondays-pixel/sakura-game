// Which game a co-op client runs. Lockstep only works when both clients run the same sim on the
// same data, but after a deploy an open (or cached) older tab can meet an updated one, and that
// pair would desync every time. The lobby therefore compares this in 'hello' and refuses to pair
// two incompatible clients ("chuu is on v0.1.16, you're on v0.1.17 — update").
//   proto  bumped whenever a co-op message changes shape
//   sim    hash of every source file the lockstep battle runs on (tools/simId.mjs via
//          vite.config.js): deploys that only touch art, audio, menus or the renderer keep it,
//          so those players can still play together
//   data   a hash of the battle data both sims read (girls, enemies, stages, maps, rules, freeplay)
//   build  the git commit; label the player-facing version (shown in the mismatch message)
// Older clients send no `sim`: with them only the identical build is compatible.
import { UNITS } from '../../data/units.js';
import { ENEMIES } from '../../data/enemies.js';
import { STAGES } from '../../data/stages.js';
import { MAPS } from '../../data/maps.js';
import { BATTLE, DIFFICULTIES, TYPE_CHART } from '../../data/types.js';
import { COOP } from '../../data/coop.js';
import { FREEPLAY } from '../../data/freeplay.js';
import { BATTLE_MODES } from '../../data/modes.js';
import { BUILD_ID, SIM_ID, APP_VERSION } from '../../core/buildInfo.js';

// 3: co-op freeplay (start.freeplay, the 'end' Finish vote, the freeplay goal event)
// 4: battle modes (room, hello, ready and start carry `mode`; map rules ride on the StageDef).
//    Train C shares this one bump (docs/specs/LANDING_PLAN.md S9): nobody bumps it twice.
export const COOP_PROTOCOL = 4;
export { BUILD_ID };

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

/** @returns {{ proto: number, build: string, sim: string, data: string, label: string }} (computed once, ~ms) */
export function coopVersion() {
  if (!cached) {
    const data = fnv(JSON.stringify([UNITS, ENEMIES, STAGES, MAPS, BATTLE, DIFFICULTIES, TYPE_CHART, COOP, FREEPLAY, BATTLE_MODES]));
    cached = Object.freeze({ proto: COOP_PROTOCOL, build: BUILD_ID, sim: SIM_ID, data, label: APP_VERSION });
  }
  return cached;
}

/** Can these two clients play together? */
export function sameVersion(a, b) {
  if (!a || !b || a.proto !== b.proto || a.data !== b.data) return false;
  if (a.sim && b.sim && a.sim !== 'dev' && b.sim !== 'dev') return a.sim === b.sim;
  return a.build === b.build;
}
