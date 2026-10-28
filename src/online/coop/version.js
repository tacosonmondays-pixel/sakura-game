// Which game a co-op client runs. Lockstep only works when both clients run the same sim on the
// same data, but after a deploy an open (or cached) older tab can meet an updated one, and that
// pair would desync every time. The lobby therefore compares this in 'hello' and refuses to pair
// two incompatible clients ("chuu is on v0.1.16, you're on v0.1.17 — update").
//   proto  bumped whenever a co-op message changes shape
//   sim    hash of every source file the lockstep battle runs on (tools/simId.mjs via
//          vite.config.js): deploys that only touch art, audio, menus or the renderer keep it,
//          so those players can still play together
//   data   a hash of the battle data both sims read (girls, enemies, stages, maps, rules, freeplay,
//          Potential steps)
//   build  the git commit; label the player-facing version (shown in the mismatch message)
// Older clients send no `sim`: with them only the identical build is compatible.
import { UNITS } from '../../data/units.js';
import { ENEMIES } from '../../data/enemies.js';
import { STAGES } from '../../data/stages.js';
import { MAPS } from '../../data/maps.js';
import { BATTLE, DIFFICULTIES, TYPE_CHART } from '../../data/types.js';
import { COOP } from '../../data/coop.js';
import { FREEPLAY } from '../../data/freeplay.js';
import { POTENTIAL_LADDERS, POTENTIAL_SIGNATURE_DEFAULT, POTENTIAL_GIRLS } from '../../data/potential.js';
import { BATTLE_MODES } from '../../data/modes.js';
import { BUILD_ID, SIM_ID, APP_VERSION } from '../../core/buildInfo.js';

// 3: co-op freeplay (start.freeplay, the 'end' Finish vote, the freeplay goal event)
// 4: battle train C (set once for the whole train; docs/specs/LANDING_PLAN.md S9): the hero rework
//    (start.players[i].hero for both players, the 'hlv' and 'hmv' commands, a hero 'sell' refused),
//    Chika's `fly` command (a drone wing's flight mode, up to 6 arguments), the path cap (one final
//    tier per path per player — towers carry `owner` — the 'pick' command for brews / tune-ups, and
//    Freeplay smoothing / elites / bosses every 5), Potential (its tables in the data hash) and
//    battle modes (room, hello, ready and start carry `mode`; map rules ride on the StageDef).
//    Nobody bumps it twice.
// 5: Potential v3 (co-op update #2, set once for it): every step P2…P6 is a stat buff plus a kit
//    buff with new sim mechanics (rhythms, echoes, tempo, overclock, …; src/sim/potential.js), and a
//    girl's level travels up to 85; a client on 4 resolves the same loadout to different battles.
// 6: v0.1.39 (co-op update #3, set once for it): the nine returning girls (their kits, the `aim`
//    command, curses, hexes, runners, team damage buffs), UR gear in battle (Pierce, Aura Power, the
//    Academy Club tricks) and Ascension's gates 6-10; a client on 5 resolves the same loadout to
//    different battles (or does not know the girl at all).
// 7: v0.1.40 (co-op update #4, set once for it): the seven new academy girls (spike strips, pin rings,
//    sports drinks, lane sentries, the council office, vines and bowling balls: src/sim/{strips,rings,
//    drinks,sentries,hubs,vines,balls}.js) and the ability core in the sim (castAbility; auto-cast off and
//    no command casts yet); a client on 6 resolves the same loadout to different battles (or does not
//    know the girl at all).
// 8: v0.1.41 (co-op update #5, set once for it): Marumi's rework (the ricochet Spin Shot path, the lob at
//    flyers on every path, her damage band, her own lane on a shared road) and Kaede's maple blade arts
//    (cleave, crescents, storm, shockwave; Pierce on her blade arts); a client on 7 resolves the same
//    loadout to different battles.
// 9: the ultimates release (co-op update #6, set once for it): tower abilities and hero skills cast in battle
//    (the ability bar, the 'cast' commands, Auto casting, aimed abilities), Tenka (her coil bolts, lab team,
//    gravity wells and Last Line), the returning girls' abilities and Seiran's Dragonflight flying all the way back
//    to START; a client on 8 resolves the same loadout to different battles (or does not know the girl at all).
export const COOP_PROTOCOL = 9;
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
    const data = fnv(JSON.stringify([UNITS, ENEMIES, STAGES, MAPS, BATTLE, DIFFICULTIES, TYPE_CHART, COOP, FREEPLAY, POTENTIAL_LADDERS, POTENTIAL_SIGNATURE_DEFAULT, POTENTIAL_GIRLS, BATTLE_MODES]));
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
