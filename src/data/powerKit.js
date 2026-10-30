// Sakura Sentinels — Power after balance round 5 (display only; nothing in the battle sim reads it).
//
// Power (src/systems/progression.js unitPower) is a paper number for sorting and the girl tiles: her tier-0 damage ×
// rate × hits, her level, gear and Potential. Balance round 5 (src/data/balance.js) raised what she deals in battle,
// so a raised girl's Power rises toward what she now deals: fully maxed, her Power ÷ Kage's matches her measured
// honest DPS ÷ Kage's (tools/balance/r5Bench.mjs with Umeko 2-5-0 + Midori 5-0-2, √(boss ratio × late-crowd ratio)).
// A girl whose paper Power already sits at or above that keeps her Power (Kaede, Ena, Raika, Marumi, the duo, Suzu,
// Azami), so no girl's Power drops (the round-4 critic's finding 2; tests/systems/powerKit.test.js).
export const POWER_KIT = Object.freeze({
  akane: 3.75,
  rei: 3.06,
  yuzuha: 2.9,
  hotaru: 2.79,
  hana: 2.48,
  iroha: 2.48,
  aoi: 2.32,
  ruri: 2.08,
  chigusa: 2.02,
  sango: 1.53,
  kinu: 1.24,
  fuu: 1.81,
  yuki: 1.14,
});

/** Her Power factor (1 when the round leaves her Power as it was). */
export const powerKitOf = (id) => Math.max(1, POWER_KIT[id] ?? 1);
