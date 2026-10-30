// The Honor Ribbon Case's "Earned" line (src/ui/screens/achievements/case.js via honors.ribbonEarnedNote): a claimed
// achievement names its title; a ribbon a Mailbox letter gave reads "a gift" and never names the unearned title.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { ribbonEarnedNote } from '../../src/systems/honors.js';
import { HONOR_GIFT_MARK } from '../../src/systems/profileHonors.js';
import { VIGIL_ACH_ID } from '../../src/systems/vigilRibbonGift.js';
import { ACHIEVEMENT_MAP } from '../../src/data/achievements.js';
import { HONOR_RIBBONS } from '../../src/data/honors.js';

const gifted = (id) => { const p = createProfile(); p.missions.counters[HONOR_GIFT_MARK + id] = 1; return p; };
const claimedSave = (id) => { const p = createProfile(); p.missions.achievements[id] = true; return p; };

describe('ribbonEarnedNote', () => {
  it('the Starlight Vigil Ribbon carries a title (the case the note guards)', () => {
    expect(ACHIEVEMENT_MAP[VIGIL_ACH_ID].title).toBeTruthy();
  });

  it('a gifted ribbon reads as a gift, not as coming with its title', () => {
    expect(ribbonEarnedNote(gifted(VIGIL_ACH_ID), VIGIL_ACH_ID)).toBe('gift');
  });

  it('a claimed achievement with a title names it, even when the ribbon was also gifted', () => {
    expect(ribbonEarnedNote(claimedSave(VIGIL_ACH_ID), VIGIL_ACH_ID)).toBe('title');
    const both = gifted(VIGIL_ACH_ID);
    both.missions.achievements[VIGIL_ACH_ID] = true;
    expect(ribbonEarnedNote(both, VIGIL_ACH_ID)).toBe('title');
  });

  it('a claimed ribbon without a title adds nothing; an unowned one adds nothing', () => {
    const plain = HONOR_RIBBONS.find((h) => ACHIEVEMENT_MAP[h.id] && !ACHIEVEMENT_MAP[h.id].title);
    if (plain) expect(ribbonEarnedNote(claimedSave(plain.id), plain.id)).toBe(null);
    expect(ribbonEarnedNote(createProfile(), VIGIL_ACH_ID)).toBe(null);
  });
});
