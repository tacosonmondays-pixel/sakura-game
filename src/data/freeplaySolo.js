// Solo freeplay: the same three tiers and the same wave generator as co-op freeplay
// (src/data/freeplay.js, src/sim/freeplay.js), on the stage's own HP. Co-op multiplies enemy HP by
// COOP.hpMul (1.6) because two defenders share the board; a solo run keeps the stage's hpScale, so
// every curve value stays in the one freeplay table. Calibrated with tools/freeplayBot.mjs (see
// docs/FREEPLAY.md). Not part of the co-op compatibility id: nothing in the co-op graph imports it.
import { STAGE_MAP } from './stages.js';
import { freeplayTable } from './freeplay.js';

/** Stages solo freeplay is offered on: campaign stages with a last wave (the goal). */
export function hasSoloFreeplay(stageId) {
  const s = STAGE_MAP[stageId];
  return !!s && s.kind === 'campaign' && Number.isFinite(s.waves);
}

/**
 * The stage definition a solo freeplay battle runs: the campaign stage with the tier's table as
 * `stage.freeplay` (the Sim needs `options.freeplay` too). null when the stage or tier is unknown.
 * @param {string} stageId
 * @param {string} tierId 'blossom' | 'tempest' | 'crimson'
 */
export function soloFreeplayStage(stageId, tierId) {
  const table = freeplayTable(tierId);
  if (!table || !hasSoloFreeplay(stageId)) return null;
  // (balance round 5's campaign HP, stage.powerHp, stays in the campaign: Freeplay keeps its own curve)
  return { ...STAGE_MAP[stageId], powerHp: null, freeplay: table };
}
