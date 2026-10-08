// Co-op tuning (2-player real-time lockstep battles). Data only: the online layer
// (src/online/coop/**) and the co-op screens read these numbers.
import { CAMPAIGN_IDS, STAGE_MAP } from './stages.js';

export const COOP = Object.freeze({
  /** Enemy HP multiplier on top of the stage's own hpScale (two defenders). */
  hpMul: 1.6,
  /** Each player's start cash = round(stage start cash × cashShare). */
  cashShare: 0.6,
  /** Commands run this many ticks (× game speed) after they are issued. */
  inputDelay: 6,
  /** Upper bound for the adaptive input delay after stalls. */
  maxInputDelay: 18,
  /** "I will send nothing more up to tick N" heartbeat interval. */
  heartbeatMs: 50,
  /** State-hash exchange interval in ticks (2 s of game time at 1×). */
  hashEvery: 120,
  /** A peer silent for this long counts as disconnected (grows to 3× the worst recent gap
   *  between its packets on a laggy device, up to maxTimeoutMs). Leaving and closing the tab
   *  say goodbye explicitly, so this only catches crashes and lost connections; it is longer
   *  than the 5 s first planned because a phone compiling a new girl's shaders can freeze its
   *  page for several seconds (measured up to ~8 s under software WebGL). */
  timeoutMs: 12000,
  maxTimeoutMs: 20000,
  /** …except while the ally's battle screen is still loading (no lockstep packet yet). */
  loadTimeoutMs: 30000,
  /** Towers per player (the host also brings the hero; the guest gets one more tower). */
  towersPerPlayer: 5,
  /** Player colours: slot 0 (host) and slot 1 (guest). */
  colors: ['#4cc9f0', '#ff8fab'],
  /** Room codes: 5 characters without look-alikes (0/O, 1/I/L). */
  codeAlphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  codeLength: 5,
});

/**
 * The stage definition a co-op battle runs: the campaign stage with enemy HP ×hpMul.
 * @param {string} stageId
 * @returns {object|null}
 */
export function coopStage(stageId) {
  const s = STAGE_MAP[stageId];
  if (!s) return null;
  return { ...s, hpScale: (s.hpScale ?? 1) * COOP.hpMul, coop: true };
}

/**
 * Stages offered for co-op: every campaign stage (the host picks among the ones unlocked on
 * their own map).
 * @param {(id: string) => boolean} [isUnlocked]
 * @returns {object[]}
 */
export function coopStages(isUnlocked = () => true) {
  return CAMPAIGN_IDS.map((id) => STAGE_MAP[id]).filter((s) => s && isUnlocked(s.id));
}

/** Player start cash for a stage in co-op. */
export function coopStartCash(stage) {
  return Math.round((stage?.startCash ?? 650) * COOP.cashShare);
}
