// One-line tips for the loading screen (bottom-left, under the destination). Adapted from the wiki
// and the Notice's handbook. At most 80 characters each so a phone shows a tip on one line; the
// loader is never up for less than 450 ms, so a tip never flashes past.

export const LOADING_TIPS = Object.freeze([
  'Read the pre-wave warning: it names the enemy role that is coming next.',
  'Lost a stage? The defeat debrief says which enemies leaked and what stops them.',
  'Burn and poison ticks skip flat armor, and poison stops enemy healing.',
  'Gold slimes run like goblins; violet ones hide like ghosts.',
  'Lanterns and fog on a map mean veiled ghosts: bring a girl with Veil Sight.',
  'Hold a girl\'s card to read her kit and her whole upgrade tree.',
  'Tier 3 is often where a girl changes job: armor breaking, detection, anti-air.',
  'Your hero deploys for free and grows from Lv 1 to 25 during the battle.',
  'Support girls\' auras never stack: spread them out to cover more of the road.',
  'Tap any item to see where it drops. Teleport takes you straight there.',
  'Tickets are always spent before gems on the recruit screen.',
  'Quit saves the battle: Continue picks it up at the same wave.',
  'Check the Tree tab before a stage to plan which path each girl takes.',
  'Commissions and the daily login keep coins and books coming every day.',
  'A cleared stage opens Freeplay: keep going past the last wave for bonus loot.',
]);

/** The tip the boot loader in index.html shows before any script runs (one of the list). */
export const BOOT_TIP = LOADING_TIPS[5];

/**
 * A tip, picked by a seed (a stage id, a time) so the same load shows the same tip and two loads
 * in a row rarely repeat one.
 * @param {string|number} [seed]
 * @returns {string}
 */
export function pickTip(seed = Date.now()) {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return LOADING_TIPS[(h >>> 0) % LOADING_TIPS.length];
}
