// Audio cues: the ONLY audio module other areas import (docs/AUDIO.md §3.1).
//   import { cue } from '../../audio/cue.js';  cue('gacha.flip', { rarity: 'SSR' });
// Safe in Node and before the engine boots: cues queue (≤ 64, dropped after 2 s so nothing plays late)
// until initAudio() installs the handler. No window access at import time.

const MAX_QUEUE = 64;
const MAX_AGE_MS = 2000;
const queue = [];
let handler = null;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Fire a named audio cue (see src/audio/cues.js for the table).
 * @param {string} name
 * @param {object} [data]
 */
export function cue(name, data = {}) {
  if (typeof window === 'undefined') return;
  if (handler) {
    try {
      handler(name, data);
    } catch (e) {
      console.warn(`[audio] cue ${name} failed`, e);
    }
    return;
  }
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push({ name, data, at: now() });
}

/** Installed by the engine; flushes queued cues that are still fresh. */
export function setCueHandler(fn) {
  handler = fn;
  if (!fn) return;
  const t = now();
  for (const q of queue.splice(0)) if (t - q.at <= MAX_AGE_MS) cue(q.name, q.data);
}

/** The running audio system (window.__sakura.audio) or null. */
export function getAudio() {
  if (typeof window === 'undefined') return null;
  return window.__sakura?.audio || null;
}

/** For tests: queued cue names. */
export function pendingCues() {
  return queue.map((q) => q.name);
}
