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

const BATTLE_STAGES = new Map();

/**
 * The stage an event battle on `difficulty` runs, when that difficulty has its own waves (the def's
 * `variants[difficulty]`, src/data/events/build.js eventVariant): the registered stage with the
 * variant's waves, wave generator, HP and economy (hpScale / cashScale / startCash from the variant's
 * `tuneLike` unless it sets them). Same id, so rewards, medals, drops and saves stay the stage's own.
 * Frozen and cached (one object per stage + difficulty). null when the difficulty has no variant:
 * the battle runs STAGE_MAP's stage. Passed to the Sim as `data.stage` (src/ui/battle/setup.js
 * createBattleSim, src/ui/battle/snapshot.js restoreSim), like solo freeplay's stage: nothing in
 * the sim's source changes, so the co-op id doesn't either (event stages never run in co-op, E11).
 * @returns {object|null} StageDef
 */
export function eventBattleStage(stageId, difficulty) {
  const base = STAGE_MAP[stageId];
  const v = base?.kind === 'event' ? base.variants?.[difficulty] : null;
  if (!v) return null;
  const key = `${stageId}:${difficulty}`;
  if (!BATTLE_STAGES.has(key)) {
    const like = STAGE_MAP[v.tuneLike || base.tuneLike];
    if (!like) throw new Error(`[events] ${stageId} ${difficulty}: tuneLike ${v.tuneLike} is not a stage`);
    const { variants, ...rest } = base;
    BATTLE_STAGES.set(key, Object.freeze({
      ...rest,
      waves: v.waves,
      waveGen: v.waveGen,
      hpScale: v.hpScale ?? like.hpScale,
      cashScale: v.cashScale ?? like.cashScale,
      startCash: v.startCash ?? like.startCash,
      tier: v.tier || base.tier,
      variant: Object.freeze({ difficulty, name: v.name, desc: v.desc, sub: v.sub || null, tuneLike: v.tuneLike || base.tuneLike }),
    }));
  }
  return BATTLE_STAGES.get(key);
}

/** The stage a battle on this stage + difficulty runs (the variant, else the registered stage), or null. */
export function battleStageOf(stageId, difficulty) {
  return eventBattleStage(stageId, difficulty) || STAGE_MAP[stageId] || null;
}

for (const e of EVENT_ENEMIES) if (!ENEMY_MAP[e.id]) ENEMY_MAP[e.id] = e;
for (const s of EVENT_STAGES) if (!STAGE_MAP[s.id]) STAGE_MAP[s.id] = resolveEventStage(s);

export const EVENT_WIRED = true;
