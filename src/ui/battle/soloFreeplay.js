// Solo freeplay in battle: the tier the player picked last (a per-device convenience), and "Keep
// going" — a normal solo run that just won its last wave goes on as a freeplay run on a tier.
// Solo only: the Sim keeps no network state, so turning the finished battle into a freeplay battle
// in place is safe (co-op battles are always built as freeplay from their start message).
import { freeplayTier } from '../../data/freeplay.js';
import { soloFreeplayStage } from '../../data/freeplaySolo.js';

const PREF_KEY = 'sakura-solo-freeplay-tier';

/** The solo freeplay tier picked last on this device ('blossom' by default). */
export function lastSoloTier() {
  try {
    return freeplayTier(localStorage.getItem(PREF_KEY)) || 'blossom';
  } catch {
    return 'blossom';
  }
}

export function rememberSoloTier(tier) {
  const t = freeplayTier(tier);
  if (!t) return;
  try {
    localStorage.setItem(PREF_KEY, t);
  } catch {
    /* private mode: nothing to remember */
  }
}

/**
 * Turns a solo battle that has just won its last wave into a freeplay run on `tier`, as if it had
 * been built with options.freeplay from the start (the waves up to the goal are the same either
 * way): the next wave is goal + 1 and comes from the freeplay generator.
 * @returns {boolean} false when the battle cannot continue (not won at its goal, no freeplay here)
 */
export function continueIntoFreeplay(sim, tier) {
  if (sim.freeplay || sim.state !== 'won' || sim.wavesCleared !== sim.totalWaves) return false;
  const stage = soloFreeplayStage(sim.stageId, tier);
  if (!stage) return false;
  // keep the difficulty / data overrides the battle was built with; only the table is new, and the
  // campaign-only HP of the Oct 27 power pass (stage.powerHp, PROPOSAL) stays behind with the campaign
  // waves, so the freeplay waves have the HP of a run built as freeplay
  sim.stage = { ...sim.stage, freeplay: stage.freeplay, powerHp: null };
  if (sim.data && 'stage' in sim.data) sim.data.stage = sim.stage;
  sim.options.freeplay = true;
  sim.freeplay = true;
  sim.lastWave = Math.max(sim.totalWaves, stage.freeplay.maxWave ?? Infinity);
  sim.finished = false;
  // waves past the goal were scouted as "no wave": drop them so the freeplay ones are built
  for (const k of [...sim._waveCache.keys()]) if (k > sim.totalWaves) sim._waveCache.delete(k);
  sim.state = 'between';
  sim._autoTimer = sim.options.autoStart ? stage.freeplay.clearPause ?? 1 : -1;
  return true;
}
