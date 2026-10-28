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

// ---------------------------------------------------------------------------------------------------------------
// The battle panel's DPS cell under Option C of the owner's band (src/data/balance.js KIT_PANEL; display only,
// src/ui/battle/drawerView.js kitDps): her paper damage per second (drawerView.js kitPaper: the panel's hits a second,
// a trapper's trap hits a second, a drone owner's bolt plus her full wing) × her crit as she hits × this factor. Each
// factor is measured on the round-4 fixed bench at full max (L85, 5 stars, 10 gates, P6, 3 UR +12 Taiko pieces at
// average rolls) with Umeko 2-5-0 + Midori 5-0-2 placed and covering her: her real damage per second on her ruler ÷
// (paper × crit), so in that frame the cell reads her real DPS (tests/systems/panelKit.test.js holds the measured
// table). It covers what her kit does that the paper number leaves out (multi-hits, ramps, executions, the boss bonus,
// traps, strips, sentries, drones); the Brittle and marks other girls put on enemies are not in it.
// ---------------------------------------------------------------------------------------------------------------

/** Her ruler: the late crowd for splash girls, a boss for everyone else. */
export const PANEL_RULER = Object.freeze({
  akane: 'crowd', sango: 'crowd', hotaru: 'crowd', marumi: 'crowd', suzu: 'crowd',
  raika: 'crowd', kinu: 'crowd', iroha: 'crowd', ruri: 'crowd', azami: 'crowd',
});

/**
 * Her kit factor for the DPS cell (1 when a girl has none measured: heroes show no DPS cell). Measured on the round-4
 * bench (the owner's notes): strikers, Fuu and Chika with Umeko + Midori on her ruler; the supports alone on a
 * boss. Suzu's traps never crit, so her cell has no crit term (drawerView.js critExpect).
 */
export const PANEL_KIT = Object.freeze({
  // single-target strikers and Chika, Fuu (a boss)
  kage: 1.409, shiro: 7.166, aoi: 4.254, kaede: 11.49, tenka: 2.031, rei: 5.324, chigusa: 2.974, ena: 1.543,
  hana: 1.675, yuzuha: 343.3, chika: 1.831, fuu: 1.147,
  // splash strikers (the late crowd)
  akane: 19.79, sango: 22.76, hotaru: 24.13, marumi: 2.321, suzu: 20.81, raika: 11.65, kinu: 1.307, iroha: 15.9,
  ruri: 5.737, azami: 37.36,
  // supports' own hits (alone, a boss)
  umeko: 0.9444, miko: 0.9554, midori: 30.84, yuki: 1.542, momo: 1.503, noa: 0.9577,
});
