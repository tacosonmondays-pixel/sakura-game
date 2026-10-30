// The Starlight Vigil Ribbon gift (src/systems/vigilRibbonGift.js): one Mailbox letter to every save whose best
// Freeplay wave is 200+ (any tier, solo or co-op); claiming it owns the ribbon only (never the achievement, its gems
// or its title), and nothing pays twice.
import { describe, it, expect } from 'vitest';
import { createProfile, serializeProfile, deserializeProfile } from '../../src/systems/save.js';
import { mailList, claimMail, claimAllMail, unclaimedMailCount } from '../../src/systems/mail.js';
import { ownedRibbons, ownedTitles, honorCount } from '../../src/systems/honors.js';
import { earnedHonors, honorCount as profileHonorCount } from '../../src/systems/profileHonors.js';
import { itemCount } from '../../src/systems/inventory.js';
import {
  ensureVigilRibbonGift, vigilGiftEligible, VIGIL_GIFT, VIGIL_GIFT_ID, VIGIL_ACH_ID, VIGIL_GIFT_UNTIL,
} from '../../src/systems/vigilRibbonGift.js';

const NOW = Date.UTC(2026, 9, 31, 12); // Oct 31, 2026

function save({ best = null, coop = null, stage = '1-5' } = {}) {
  const p = createProfile();
  p.progress.stages[stage] = { ...(p.progress.stages[stage] || {}), stars: 3 };
  if (best) p.progress.stages[stage].freeplayBest = best;
  if (coop) p.progress.stages[stage].coopBestWave = coop;
  return p;
}

describe('Starlight Vigil Ribbon gift', () => {
  it('a save with a solo Freeplay best of 200+ on any tier gets the letter once', () => {
    for (const best of [{ blossom: 200 }, { tempest: 214 }, { crimson: 201 }]) {
      const p = save({ best });
      expect(vigilGiftEligible(p, NOW)).toBe(true);
      const l = ensureVigilRibbonGift(p, NOW);
      expect(l?.id).toBe(VIGIL_GIFT_ID);
      expect(l.rewards).toEqual([{ id: `honor:${VIGIL_ACH_ID}`, count: 1 }]);
      expect(l.expiresAt).toBe(VIGIL_GIFT_UNTIL);
      expect(VIGIL_GIFT_UNTIL - NOW).toBeGreaterThanOrEqual(29 * 86400e3); // a generous claim window
      expect(unclaimedMailCount(p, NOW)).toBe(1);
      // idempotent: a second app start sends nothing
      expect(ensureVigilRibbonGift(p, NOW + 1000)).toBe(null);
      expect(mailList(p, NOW).filter((x) => x.id === VIGIL_GIFT_ID)).toHaveLength(1);
    }
  });

  it('a co-op best counts too', () => {
    const p = save({ coop: { blossom: 205 } });
    expect(ensureVigilRibbonGift(p, NOW)?.id).toBe(VIGIL_GIFT_ID);
  });

  it('a save below wave 200, with no Freeplay, or after the window gets nothing', () => {
    expect(ensureVigilRibbonGift(save({ best: { blossom: 199, tempest: 150 }, coop: { crimson: 120 } }), NOW)).toBe(null);
    expect(ensureVigilRibbonGift(save(), NOW)).toBe(null);
    expect(ensureVigilRibbonGift(createProfile(), NOW)).toBe(null);
    expect(ensureVigilRibbonGift(save({ best: { blossom: 230 } }), VIGIL_GIFT_UNTIL)).toBe(null);
  });

  it('a save that already owns the ribbon (the achievement claimed) gets no letter', () => {
    const p = save({ best: { blossom: 260 } });
    p.missions.achievements[VIGIL_ACH_ID] = true;
    expect(ownedRibbons(p)).toContain(VIGIL_ACH_ID);
    expect(ensureVigilRibbonGift(p, NOW)).toBe(null);
    expect(mailList(p, NOW)).toHaveLength(mailList(createProfile(), NOW).length);
  });

  it('claiming gives the ribbon only: no achievement, no title, no gems, no Backpack item; never twice', () => {
    const p = save({ best: { tempest: 210 } });
    const gems = itemCount(p, 'gems');
    const titles = ownedTitles(p);
    const hc = honorCount(p);
    ensureVigilRibbonGift(p, NOW);
    expect(ownedRibbons(p)).not.toContain(VIGIL_ACH_ID); // not before the claim
    const r = claimMail(p, VIGIL_GIFT_ID, NOW + 5000);
    expect(r.ok).toBe(true);
    expect(r.rewards).toEqual([{ id: `honor:${VIGIL_ACH_ID}`, count: 1 }]);
    expect(ownedRibbons(p)).toContain(VIGIL_ACH_ID);
    expect(earnedHonors(p)).toContain(VIGIL_ACH_ID); // the profile's view agrees
    expect(honorCount(p)).toBe(hc + 1);
    expect(profileHonorCount(p)).toBe(hc + 1);
    expect(p.missions.achievements[VIGIL_ACH_ID]).toBeUndefined();
    expect(ownedTitles(p)).toEqual(titles);
    expect(itemCount(p, 'gems')).toBe(gems);
    expect(p.items[`honor:${VIGIL_ACH_ID}`]).toBeUndefined();
    // claim twice: refused, and Claim all finds nothing
    expect(claimMail(p, VIGIL_GIFT_ID, NOW + 6000)).toMatchObject({ ok: false, error: 'claimed' });
    expect(claimAllMail(p, NOW + 7000).count).toBe(0);
    // owned now, so no second letter even if its id were forgotten
    expect(vigilGiftEligible(p, NOW)).toBe(false);
  });

  it('the gifted ribbon survives a save round trip; an expired letter cannot be claimed', () => {
    const p = save({ best: { blossom: 200 } });
    ensureVigilRibbonGift(p, NOW);
    claimMail(p, VIGIL_GIFT_ID, NOW);
    const q = deserializeProfile(serializeProfile(p));
    expect(ownedRibbons(q)).toContain(VIGIL_ACH_ID);
    expect(q.missions.achievements[VIGIL_ACH_ID]).toBeUndefined();

    const late = save({ best: { blossom: 200 } });
    ensureVigilRibbonGift(late, NOW);
    expect(claimMail(late, VIGIL_GIFT_ID, VIGIL_GIFT_UNTIL)).toMatchObject({ ok: false, error: 'expired' });
    expect(ownedRibbons(late)).not.toContain(VIGIL_ACH_ID);
  });

  it('Claim all pays the ribbon beside other letters', () => {
    const p = save({ best: { crimson: 202 } });
    ensureVigilRibbonGift(p, NOW);
    const r = claimAllMail(p, NOW);
    expect(r.rewards.some((x) => x.id === `honor:${VIGIL_ACH_ID}`)).toBe(true);
    expect(ownedRibbons(p)).toContain(VIGIL_ACH_ID);
  });

  it('the letter names nobody and never another game', () => {
    expect(VIGIL_GIFT.body).toMatch(/Starlight Vigil Ribbon/);
    expect(VIGIL_GIFT.body).not.toMatch(/\b(he|she|him|her)\b/i);
  });
});
