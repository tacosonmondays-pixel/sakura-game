// Co-op tuning (2-player real-time lockstep battles). Data only: the online layer
// (src/online/coop/**) and the co-op screens read these numbers.
import { CAMPAIGN_IDS, STAGE_MAP } from './stages.js';

export const COOP = Object.freeze({
  /** Enemy HP multiplier on top of the stage's own hpScale (two defenders). */
  hpMul: 1.6,
  /** Each player's start cash = round(stage start cash × cashShare). */
  cashShare: 0.6,
  /** Commands run this many ticks (× game speed) after they are issued. The local transport's
   *  value; Supabase rooms use 30 ticks (COOP_NET below). Stalls raise it adaptively up to 3×,
   *  a quiet spell lowers it again. */
  inputDelay: 6,
  /** "I will send nothing more up to tick N" heartbeat interval (local transport; Supabase
   *  beats at most every 250 ms and only when the ally needs it, see Lockstep.beat). */
  heartbeatMs: 50,
  /** State-hash interval in ticks (2 s of game time at 1×); hashes ride on the heartbeats. */
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
 * Lockstep net settings per room transport (src/online/adapters/*: openRoom().net). Both players
 * must use the same ones, so they live here, in the co-op compatibility id (tools/simId.mjs),
 * and not in the adapters (chat / clan / social code that changes far more often).
 *   local    tabs of one browser (BroadcastChannel): a 6-tick input delay, a beat every 50 ms
 *   supabase Realtime counts every message against the project's quota (free plan: 2M a month
 *            and 100 a second for the whole project), so rooms talk ~4× a second instead of 20:
 *            a 30-tick (0.5 s) input delay and a beat only every 250 ms or when a command is
 *            queued, a keepalive every second while nothing changes (src/online/coop/lockstep.js).
 *            Tower defense hardly notices half a second of lag.
 */
export const COOP_NET = Object.freeze({
  local: Object.freeze({ heartbeatMs: COOP.heartbeatMs, inputDelay: COOP.inputDelay, keepaliveMs: COOP.heartbeatMs }),
  supabase: Object.freeze({ heartbeatMs: 250, inputDelay: 30, keepaliveMs: 1000 }),
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
