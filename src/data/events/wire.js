// Joins the event stages and enemies to the lookup maps (EVENT_SPEC E9, §3.4), at import time.
// STAGES / ENEMIES stay unchanged (tests count them; the co-op data hash reads them) and
// src/data/stages.js / enemies.js are not edited: they are part of the lockstep battle's source
// hash (tools/simId.mjs), and event stages never run in co-op (E11). The sim reads STAGE_MAP and
// ENEMY_MAP by reference (src/sim/data.js), so an event battle finds its stage and enemies here.
// Import this module (it is idempotent) before looking up an event stage: src/systems/events.js does.
import { STAGE_MAP } from '../stages.js';
import { ENEMY_MAP } from '../enemies.js';
import { EVENT_STAGES, EVENT_ENEMIES } from './index.js';

/**
 * A registered event stage: hpScale, cashScale and startCash copied from its `tuneLike` campaign
 * stage unless the def sets them, so event difficulty follows the campaign's re-tuning.
 * @returns {object} StageDef
 */
export function resolveEventStage(def) {
  const like = STAGE_MAP[def.tuneLike];
  if (!like) throw new Error(`[events] ${def.id}: tuneLike ${def.tuneLike} is not a stage`);
  return Object.freeze({
    ...def,
    hpScale: def.hpScale ?? like.hpScale,
    cashScale: def.cashScale ?? like.cashScale,
    startCash: def.startCash ?? like.startCash,
  });
}

for (const e of EVENT_ENEMIES) if (!ENEMY_MAP[e.id]) ENEMY_MAP[e.id] = e;
for (const s of EVENT_STAGES) if (!STAGE_MAP[s.id]) STAGE_MAP[s.id] = resolveEventStage(s);

export const EVENT_WIRED = true;
