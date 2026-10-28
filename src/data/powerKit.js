// Sakura Sentinels — Power after balance round 5 (display only; nothing in the battle sim reads it).
//
// Power (src/systems/progression.js unitPower) is a paper number for sorting and the girl tiles: her tier-0 damage ×
// rate × hits, her level, gear and Potential. Balance round 5 (src/data/balance.js) raised what she deals in battle,
// so her Power rises with it: one factor per girl, the gain the round measured on her fully maxed honest DPS
// (tools/balance/r5Bench.mjs, Umeko 2-5-0 + Midori 5-0-2): √(boss gain × late-crowd gain), so a splash girl whose boss
// number rose gets part of it. Never below 1: no girl's Power drops (tests/systems/powerKit.test.js).
export const POWER_KIT = Object.freeze({
  // POWER_KIT_PLACEHOLDER
});

/** Her Power factor (1 when the round did not raise her). */
export const powerKitOf = (id) => Math.max(1, POWER_KIT[id] ?? 1);
