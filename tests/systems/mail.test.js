// The one-time Potential letter (src/systems/mail.js ensurePotentialLetter, spec §4.6 / §7.8).
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { ensurePotentialLetter, potentialLetter, POTENTIAL_LETTER_ID, mailList } from '../../src/systems/mail.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { UNITS } from '../../src/data/units.js';

/** A save from before M0 (no dupes, no shadow) with Aoi duplicated 3 times in its history. */
function backfilledProfile() {
  const p = createProfile();
  const t0 = p.createdAt;
  for (let i = 1; i <= 3; i++) p.gacha.history.push({ unitId: 'aoi', rarity: 'R', at: t0 + i * 60000 });
  p.gacha.totalPulls = 3;
  const raw = JSON.parse(JSON.stringify(p));
  for (const u of Object.values(raw.units)) delete u.dupes;
  for (const k of Object.keys(raw.missions.counters)) if (k.startsWith('pot:')) delete raw.missions.counters[k];
  return migrateProfile(raw);
}

describe('ensurePotentialLetter', () => {
  it('is delivered once, only with the backfill marker and a P2+ girl, with no rewards', () => {
    const p = backfilledProfile();
    expect(p.seenIntro).toContain('potential-backfilled');
    expect(p.units.aoi.dupes).toBe(3);
    const l = ensurePotentialLetter(p);
    expect(l?.id).toBe(POTENTIAL_LETTER_ID);
    expect(l.rewards).toEqual([]);
    expect(l.title).toBe('New: Potential!');
    expect(l.body).toContain('Aoi P4');
    expect(l.body).toContain('Info tab');
    expect(ensurePotentialLetter(p)).toBeNull();
    expect(mailList(p).filter((x) => x.id === POTENTIAL_LETTER_ID)).toHaveLength(1);
    expect(mailList(p)[0].claimable).toBe(false);
  });

  it('never for a new profile, nor for a backfilled save where every girl is P1', () => {
    const fresh = createProfile();
    grantUnit(fresh, 'aoi');
    grantUnit(fresh, 'aoi');
    expect(fresh.units.aoi.dupes).toBe(2);
    expect(ensurePotentialLetter(fresh)).toBeNull();
    const p = backfilledProfile();
    for (const u of Object.values(p.units)) u.dupes = 0;
    expect(ensurePotentialLetter(p)).toBeNull();
  });

  it('lists girls highest first, 12 names, then "and N more"', () => {
    const p = createProfile();
    for (const [i, u] of UNITS.entries()) {
      p.units[u.id] ||= { level: 1, exp: 0, breakthrough: 0, awaken: 0, gear: {}, dupes: 0 };
      p.units[u.id].dupes = i % 5 + 1;
    }
    const body = potentialLetter(p).body;
    expect(body).toMatch(/: \w+ P6, /);
    expect(body).toContain(`and ${UNITS.length - 12} more`);
  });
});
