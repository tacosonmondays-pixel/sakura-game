// The one-time Potential letter (src/systems/mail.js ensurePotentialLetter): v3's "Potential grew!"
// (docs/specs/POTENTIAL.md v3 §12, v2 §8). v1 (v0.1.34) sent 'potential-arrived-1' to saves whose
// duplicates were counted from the recruit history; v3 writes its own letter once, to every save made
// by an older build that has a girl at P2+, with her newest step, and gives those girls the one-time
// NEW badge on their card.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile, serializeProfile, deserializeProfile } from '../../src/systems/save.js';
import { ensurePotentialLetter, potentialLetter, potentialLetterLine, POTENTIAL_LETTER_ID, POTENTIAL_V3_LETTER_ID, mailList } from '../../src/systems/mail.js';
import { V3_MARKER, NEW_PREFIX, hasPotentialNew, clearPotentialNew, BACKFILL_MARKER } from '../../src/systems/potential.js';
import { potentialLevelCap } from '../../src/systems/progression.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';

/** What an older build saved: no v3 marker. */
function olderBuild(raw) {
  raw.seenIntro = (raw.seenIntro || []).filter((s) => s !== V3_MARKER && !s.startsWith(NEW_PREFIX));
  return raw;
}

/** A save from before M0 (no dupes, no shadow, an older build) with Aoi duplicated 3 times in its history. */
function backfilledProfile() {
  const p = createProfile();
  const t0 = p.createdAt;
  for (let i = 1; i <= 3; i++) p.gacha.history.push({ unitId: 'aoi', rarity: 'R', at: t0 + i * 60000 });
  p.gacha.totalPulls = 3;
  const raw = olderBuild(JSON.parse(JSON.stringify(p)));
  for (const u of Object.values(raw.units)) delete u.dupes;
  for (const k of Object.keys(raw.missions.counters)) if (k.startsWith('pot:')) delete raw.missions.counters[k];
  return migrateProfile(raw);
}

/** A v0.1.34/35 save: Potential v1 counted (Kage P5, Kaede P3, Aoi P2), v1's letter already delivered. */
function v1Profile() {
  const p = createProfile();
  grantUnit(p, 'kage');
  for (let i = 0; i < 4; i++) grantUnit(p, 'kage');
  grantUnit(p, 'aoi');
  grantUnit(p, 'kaede');
  grantUnit(p, 'kaede');
  grantUnit(p, 'kaede');
  p.seenIntro.push(BACKFILL_MARKER);
  p.mail.delivered.push(POTENTIAL_LETTER_ID);
  return migrateProfile(olderBuild(JSON.parse(JSON.stringify(p))));
}

describe('ensurePotentialLetter (Potential v3)', () => {
  it('a v1 save: "Potential grew!" once, each P2+ girl with her newest step, no rewards, then marked', () => {
    const p = v1Profile();
    expect(p.units.kage.dupes).toBe(4);
    expect(p.seenIntro).not.toContain(V3_MARKER);
    const l = ensurePotentialLetter(p);
    expect(l?.id).toBe(POTENTIAL_V3_LETTER_ID);
    expect(l.title).toBe('Potential grew!');
    expect(l.rewards).toEqual([]);
    // highest first: Kage P5, Kaede P3, Aoi P2 (a stat step: what it raises), each with her new level cap
    expect(l.body).toContain('Kage P5 ✦ Moonpiercer · level cap 78, Kaede P3 ✦ Breeze Step · level cap 67, Aoi P2 (+4% damage) · level cap 63');
    expect(l.body).toContain('Nothing got weaker: P1 is exactly the girl you know.');
    expect(l.body).toContain('Info tab');
    // v1's letter already told this save how its duplicates were counted
    expect(l.body).not.toMatch(/estimated/);
    expect(l.body).not.toMatch(/small passive/);
    expect(p.seenIntro).toContain(V3_MARKER);
    expect(ensurePotentialLetter(p)).toBeNull();
    expect(mailList(p).filter((x) => x.id === POTENTIAL_V3_LETTER_ID)).toHaveLength(1);
    expect(mailList(p).find((x) => x.id === POTENTIAL_V3_LETTER_ID).claimable).toBe(false);
  });

  it('a save from before M0 is credited from its history and its letter says how', () => {
    const p = backfilledProfile();
    expect(p.seenIntro).toContain(BACKFILL_MARKER);
    expect(p.units.aoi.dupes).toBe(3);
    const l = ensurePotentialLetter(p);
    expect(l?.id).toBe(POTENTIAL_V3_LETTER_ID);
    expect(l.body).toContain('Aoi P4 ✦ Keen Fletching');
    expect(l.body).toMatch(/We counted the duplicates in your recruit history; for recruits older than your last 100 we estimated/);
    // v1's letter is not sent any more
    expect(mailList(p).some((x) => x.id === POTENTIAL_LETTER_ID)).toBe(false);
  });

  it('never for a save created on v3, even once it has duplicates', () => {
    const fresh = createProfile();
    expect(fresh.seenIntro).toContain(V3_MARKER);
    grantUnit(fresh, 'aoi');
    grantUnit(fresh, 'aoi');
    expect(fresh.units.aoi.dupes).toBe(2);
    expect(ensurePotentialLetter(fresh)).toBeNull();
    expect(fresh.seenIntro.some((s) => s.startsWith(NEW_PREFIX))).toBe(false);
  });

  it('an older save where every girl is P1: marked without a letter, and later duplicates bring none', () => {
    const p = v1Profile();
    for (const u of Object.values(p.units)) u.dupes = 0;
    expect(ensurePotentialLetter(p)).toBeNull();
    expect(p.seenIntro).toContain(V3_MARKER);
    grantUnit(p, 'aoi');
    expect(ensurePotentialLetter(p)).toBeNull();
    expect(hasPotentialNew(p, 'aoi')).toBe(false);
  });

  it('lists girls highest first, 12 names, then "and N more"', () => {
    const p = olderBuild(createProfile());
    for (const [i, u] of UNITS.entries()) {
      p.units[u.id] ||= { level: 1, exp: 0, breakthrough: 0, awaken: 0, gear: {}, dupes: 0 };
      p.units[u.id].dupes = i % 5 + 1;
    }
    const body = potentialLetter(p).body;
    expect(body).toMatch(/right away: \w+ P6 ✦ /);
    expect(body).toContain(`and ${UNITS.length - 12} more`);
  });

  it('a girl\'s line carries her level cap only where Potential raises it (the level rule as it is)', () => {
    for (const p of [2, 3, 4, 5, 6]) {
      const line = potentialLetterLine(UNIT_MAP.kage, p);
      expect(line.startsWith(`Kage P${p}`)).toBe(true);
      expect(line.includes(`level cap ${potentialLevelCap(p)}`)).toBe(potentialLevelCap(p) > potentialLevelCap(1));
    }
  });
});

describe('the one-time NEW badge (v3 migration)', () => {
  it('each girl at P2+ when the letter came gets it; opening her Info tab clears it; it survives a save round trip', () => {
    const p = v1Profile();
    ensurePotentialLetter(p);
    expect(hasPotentialNew(p, 'kage')).toBe(true);
    expect(hasPotentialNew(p, 'kaede')).toBe(true);
    expect(hasPotentialNew(p, 'aoi')).toBe(true);
    expect(hasPotentialNew(p, 'rei')).toBe(false); // P1
    const back = deserializeProfile(serializeProfile(p));
    expect(hasPotentialNew(back, 'kage')).toBe(true);
    expect(clearPotentialNew(back, 'kage')).toBe(true);
    expect(hasPotentialNew(back, 'kage')).toBe(false);
    expect(clearPotentialNew(back, 'kage')).toBe(false);
    expect(back.seenIntro).toContain(V3_MARKER);
  });
});
