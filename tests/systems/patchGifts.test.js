import { describe, it, expect } from 'vitest';
import { PATCH_NOTES } from '../../src/data/patchNotes.js';
import {
  PATCH_GIFT_GEMS, cleanPatchGifts, unclaimedPatchGifts, isPatchGiftClaimed, claimPatchGift, claimAllPatchGifts,
} from '../../src/systems/patchGifts.js';
import { createProfile, migrateProfile, serializeProfile, deserializeProfile, loadSaveText } from '../../src/systems/save.js';
import { liveTitles } from '../../src/systems/honors.js';
import { ACHIEVEMENTS, achievementLive } from '../../src/data/achievements.js';

describe('patch notes data', () => {
  it('has unique ids, valid dates and newest first', () => {
    const ids = PATCH_NOTES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of PATCH_NOTES) {
      expect(n.id).toMatch(/^v0\.1\.\d+$/);
      expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.title).toBeTruthy();
      const lists = ['added', 'changed', 'fixed'].filter((k) => k in n);
      expect(lists.length).toBeGreaterThan(0);
      for (const k of lists) expect(n[k].length).toBeGreaterThan(0);
    }
    const runs = ids.map((id) => Number(id.split('.')[2]));
    expect(runs).toEqual([...runs].sort((a, b) => b - a));
    const dates = PATCH_NOTES.map((n) => n.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('v0.1.30 counts match what players could see and earn in v0.1.30 (the launch wave; later waves add rows)', () => {
    const text = PATCH_NOTES.find((n) => n.id === 'v0.1.30').added.join('\n');
    const titles = text.match(/(\d+) titles/);
    // (titles added to launch rows later do not count: Bravest of Them All, Cosmetics 2)
    const LATER = new Set(['a_mirror_mirror']);
    if (titles) expect(Number(titles[1])).toBe(liveTitles().filter((t) => t.wave === 'launch' && !LATER.has(t.id)).length);
    const goals = text.match(/(\d+) goals/);
    if (goals) expect(Number(goals[1])).toBe(ACHIEVEMENTS.filter((a) => achievementLive(a) && (a.shipped || a.wave === 'launch')).length);
  });
});

describe('patch gifts', () => {
  const first = PATCH_NOTES[0].id;

  it('a fresh profile has every gift waiting', () => {
    const p = createProfile();
    expect(p.patchGifts).toEqual({});
    expect(unclaimedPatchGifts(p)).toEqual(PATCH_NOTES.map((n) => n.id));
  });

  it('claims once for PATCH_GIFT_GEMS gems', () => {
    const p = createProfile();
    const gems = p.currencies.gems;
    const r = claimPatchGift(p, first);
    expect(r).toEqual({ ok: true, rewards: [{ id: 'gems', count: PATCH_GIFT_GEMS }] });
    expect(p.currencies.gems).toBe(gems + PATCH_GIFT_GEMS);
    expect(p.stats.gemsEarned).toBe(PATCH_GIFT_GEMS);
    expect(isPatchGiftClaimed(p, first)).toBe(true);
    expect(unclaimedPatchGifts(p)).not.toContain(first);
  });

  it('refuses a double claim', () => {
    const p = createProfile();
    claimPatchGift(p, first);
    const gems = p.currencies.gems;
    expect(claimPatchGift(p, first)).toEqual({ ok: false, error: 'claimed', rewards: [] });
    expect(p.currencies.gems).toBe(gems);
  });

  it('refuses an unknown id', () => {
    const p = createProfile();
    const gems = p.currencies.gems;
    expect(claimPatchGift(p, 'v9.9.9')).toEqual({ ok: false, error: 'unknown', rewards: [] });
    expect(p.currencies.gems).toBe(gems);
    expect(p.patchGifts).toEqual({});
  });

  it('claim all takes every remaining gift once', () => {
    const p = createProfile();
    claimPatchGift(p, first);
    const gems = p.currencies.gems;
    const r = claimAllPatchGifts(p);
    expect(r.ok).toBe(true);
    expect(r.count).toBe(PATCH_NOTES.length - 1);
    expect(r.rewards).toEqual([{ id: 'gems', count: PATCH_GIFT_GEMS * (PATCH_NOTES.length - 1) }]);
    expect(p.currencies.gems).toBe(gems + PATCH_GIFT_GEMS * (PATCH_NOTES.length - 1));
    expect(unclaimedPatchGifts(p)).toEqual([]);
    expect(claimAllPatchGifts(p)).toEqual({ ok: false, count: 0, rewards: [] });
    expect(p.currencies.gems).toBe(gems + PATCH_GIFT_GEMS * (PATCH_NOTES.length - 1));
  });

  it('loads an old save without the field', () => {
    const raw = JSON.parse(JSON.stringify(createProfile()));
    delete raw.patchGifts;
    expect(migrateProfile(raw).patchGifts).toEqual({});
    const { profile: p, backup } = loadSaveText(JSON.stringify(raw));
    expect(backup).toBe(null);
    expect(p.patchGifts).toEqual({});
    expect(claimPatchGift(p, first).ok).toBe(true);
  });

  it('keeps claims through a save round trip and drops junk', () => {
    const p = createProfile();
    claimPatchGift(p, first);
    const back = deserializeProfile(serializeProfile(p));
    expect(back.patchGifts).toEqual({ [first]: true });
    expect(claimPatchGift(back, first).ok).toBe(false);
    expect(cleanPatchGifts({ a: true, b: 1, c: 'yes', [first]: true })).toEqual({ a: true, [first]: true });
    expect(cleanPatchGifts(null)).toEqual({});
    expect(cleanPatchGifts([1, 2])).toEqual({});
  });

  it('works on a profile object that never had the field', () => {
    const p = createProfile();
    delete p.patchGifts;
    expect(unclaimedPatchGifts(p).length).toBe(PATCH_NOTES.length);
    expect(claimPatchGift(p, first).ok).toBe(true);
    expect(p.patchGifts).toEqual({ [first]: true });
  });
});
