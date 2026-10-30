// The Starlight Vigil Ribbon gift (v0.1.64; owner: "can you gift players who reached 200+ the ribbon"). The ribbon
// belongs to "Starlight Vigil" (a_fp_bosses_4: defeat all four freeplay bosses, the Eclipse Wyrm included), and the
// Wyrm's first Freeplay wave (250) sits far past where any run ends, so nobody could earn it. Every save whose best
// Freeplay wave is 200 or more (any tier, solo or co-op: achievementMetrics.freeplayBestOf) gets one Mailbox letter
// with the ribbon. Claiming it gives the ribbon only (profileHonors.ribbonGifted): the achievement stays open, with
// its gems and its title still to earn.
//
// Call on app start and on the lobby (next to the other one-time letters). Idempotent: the Mailbox never delivers an
// id twice, and a save that already owns the ribbon gets no letter. A letter an older build stripped of its ribbon
// gets it back while the gift is still owed (repairVigilLetter). Pure; nothing here touches the sim.

import { deliverMail } from './mail.js';
import { freeplayBestOf } from './achievementMetrics.js';
import { earnedHonors, HONOR_REWARD_PREFIX } from './profileHonors.js';

export const VIGIL_ACH_ID = 'a_fp_bosses_4';
export const VIGIL_GIFT_ID = 'gift-vigil-ribbon-1';
/** Best Freeplay wave that qualifies. */
export const VIGIL_GIFT_WAVE = 200;
/**
 * The letter can be sent and claimed until Nov 30, 2026, 7 PM Central (the daily reset; CST, UTC−6): 2026-12-01
 * 01:00 UTC. A save that reaches wave 200 before then still gets it.
 */
export const VIGIL_GIFT_UNTIL = Date.UTC(2026, 11, 1, 1, 0, 0);

export const VIGIL_GIFT = Object.freeze({
  id: VIGIL_GIFT_ID,
  from: 'Sakura Academy Staff',
  title: 'A ribbon for holding the line',
  body: 'You held the line past wave 200 in Freeplay, deep into the night where the Eclipse Wyrm waits. '
    + 'It turned out to be far stronger than we meant, so nobody could earn the Starlight Vigil Ribbon. '
    + 'Please accept it for your Honor Ribbon Case with our thanks. The Starlight Vigil achievement itself stays open, '
    + 'so its gems and its title are still yours to win.',
  rewards: Object.freeze([Object.freeze({ id: `${HONOR_REWARD_PREFIX}${VIGIL_ACH_ID}`, count: 1 })]),
  expiresAt: VIGIL_GIFT_UNTIL,
});

/** Does this save qualify (best Freeplay wave ≥ 200, the ribbon not owned yet, the window open)? */
export function vigilGiftEligible(profile, now = Date.now()) {
  if (!profile || +now >= VIGIL_GIFT_UNTIL) return false;
  if (freeplayBestOf(profile) < VIGIL_GIFT_WAVE) return false;
  return !earnedHonors(profile).includes(VIGIL_ACH_ID);
}

/**
 * Deliver the letter once to a qualifying save (or give a stripped letter its ribbon back).
 * @returns {object|null} the delivered or repaired letter (null when nothing changed)
 */
export function ensureVigilRibbonGift(profile, now = Date.now()) {
  if (!vigilGiftEligible(profile, now)) return null;
  const repaired = repairVigilLetter(profile);
  return deliverMail(profile, { ...VIGIL_GIFT, rewards: VIGIL_GIFT.rewards.map((r) => ({ ...r })) }, now) || repaired;
}

/**
 * A build from before v0.1.64 (an open tab, a cached copy) cleans an 'honor:' reward out of a letter when it loads
 * and saves the save, and the Mailbox never delivers the id again. While the gift is still owed (eligible: window
 * open, ribbon not owned), the unclaimed letter gets its ribbon back. A claimed letter is never touched.
 */
function repairVigilLetter(profile) {
  const l = (Array.isArray(profile.mail?.letters) ? profile.mail.letters : []).find((x) => x?.id === VIGIL_GIFT_ID);
  if (!l || l.claimed) return null;
  const want = VIGIL_GIFT.rewards[0];
  if (Array.isArray(l.rewards) && l.rewards.some((r) => r?.id === want.id && r.count > 0)) return null;
  l.rewards = VIGIL_GIFT.rewards.map((r) => ({ ...r }));
  if (l.expiresAt == null || l.expiresAt > VIGIL_GIFT_UNTIL) l.expiresAt = VIGIL_GIFT_UNTIL;
  return l;
}
