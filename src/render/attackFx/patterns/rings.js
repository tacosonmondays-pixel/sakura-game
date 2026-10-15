// Staggered ground rings: rain ripples, taiko drum beats, double shell rings. Every ring ends at
// or inside the sim radius it illustrates.
import { ripple } from './bursts.js';
import { CORE } from '../context.js';

/**
 * `count` rings from (x, y) out to `radius`, each starting `stagger` game seconds after the
 * previous one.
 */
export function rippleSet(ctx, x, y, radius, count, stagger, life, c, uv = 'ring', additive = true, a0 = 0.85, r0 = 0.15) {
  for (let i = 0; i < count; i++) {
    ripple(ctx, x, y, radius * r0, radius * (1 - i * 0.08), life, c, i * stagger, uv, additive, a0 * (1 - i * 0.15), CORE);
  }
}

/** Taiko drum beat: a thick ring popping out at her feet (0.25 → 0.7 tiles). */
export function drumBeat(ctx, x, y, c, delay = 0, scale = 1) {
  ripple(ctx, x, y, 0.25 * scale, 0.7 * scale, 0.2, c, delay, 'ringThick', true, 0.95, CORE);
}

/** Double shell ring: bright inner ring fast + thin outer ring to the full radius. */
export function doubleRing(ctx, x, y, radius, inner, outer) {
  ripple(ctx, x, y, radius * 0.1, radius * 0.5, 0.22, inner, 0, 'ringThick', true, 1, CORE);
  ripple(ctx, x, y, radius * 0.3, radius, 0.4, outer, 0.04, 'ring', true, 0.9, CORE);
}
