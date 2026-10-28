// Sakura Sentinels — Power's kit factor (the Oct 27 power pass, PROPOSAL; display only, nothing in the battle sim
// reads it). Power (src/systems/progression.js unitPower) is a paper number: her tier-0 damage × rate × hits, her
// level, gear and Potential. Paper misjudges kits whose damage comes from ramps, executions, curses, traps, strips,
// sentries or drones, and the power pass (src/data/balance.js) raised exactly those girls, so Power gets one factor
// per striker instead of her damage row: at full max (L85, 5 stars, 10 gates, P6) her Power ÷ Kage's Power matches
// her real DPS ÷ Kage's, measured on the round-3 fixed bench with Umeko 2-5-0 + Midori 5-0-2 (a boss for
// single-target girls; the middle of her boss and late-crowd numbers for splash girls). tests/systems/powerKit.test.js
// holds the measured table and checks every striker stays within ×1.5 (or no worse than before the pass).
export const POWER_KIT = Object.freeze({
  kinu: 1.161,
  ena: 0.921,
  hana: 3.377,
  tenka: 0.37,
  chigusa: 1.858,
  ruri: 2.072,
  marumi: 0.475,
  iroha: 1.916,
  raika: 0.835,
  fuu: 0.266,
  rei: 6.014,
  akane: 1.788,
  aoi: 2.647,
  shiro: 0.95,
  kaede: 0.927,
  sango: 0.839,
  hotaru: 1.915,
  yuzuha: 3.824,
  azami: 1.206,
  chika: 4.58,
  suzu: 0.72,
});
