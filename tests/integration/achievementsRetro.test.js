// Update day (docs/specs/ACHIEVEMENTS.md §3.6, owner question 2): veterans get everything they already earned,
// claimable in full on day one. This ports the veteran archetypes of docs/specs/achievements/tools/check.mjs into
// real saves and runs the GAME's Claim all on them (the shipped rows they met were claimed long ago; the new-counter
// rows start at 0). The exact figures are pinned: change them deliberately when rows change, and re-run check.mjs.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { achievementList, claimAllAchievements } from '../../src/systems/missions.js';
import { ownedRibbons, ownedTitles } from '../../src/systems/honors.js';
import { veteran, SHIPPED } from '../fixtures/veterans.js';

const sum = (rewards, id) => rewards.filter((r) => r.id === id).reduce((n, r) => n + r.count, 0);
function updateDay(key) {
  const p = veteran(key);
  const ribbonsBefore = ownedRibbons(p).length;
  const titlesBefore = ownedTitles(p).length;
  const r = claimAllAchievements(p);
  return {
    p, r, newMet: r.ids.length, gems: sum(r.rewards, 'gems'), tickets: sum(r.rewards, 'ticket_recruit') + sum(r.rewards, 'ticket_recruit10'),
    boxes: { sturdy: sum(r.rewards, 'gearbox_rare'), ornate: sum(r.rewards, 'gearbox_superRare'), radiant: sum(r.rewards, 'gearbox_mythic'), celestial: sum(r.rewards, 'gearbox_legendary') },
    ribbons: [ribbonsBefore, ownedRibbons(p).length - ribbonsBefore], titles: [titlesBefore, ownedTitles(p).length - titlesBefore],
  };
}

describe('update day: veterans claim everything already earned, in full', () => {
  it('early (day ~5): 9 new rows, 190 gems, 4 Sturdy boxes, 0 tickets', () => {
    const d = updateDay('early');
    expect(d.r.ids.every((id) => !SHIPPED.has(id))).toBe(true);
    expect([d.newMet, d.gems, d.tickets]).toEqual([9, 190, 0]);
    expect(d.boxes).toEqual({ sturdy: 4, ornate: 0, radiant: 0, celestial: 0 });
    expect(d.ribbons).toEqual([2, 0]);
    expect(d.titles).toEqual([1, 0]);
  });

  it('mid (day ~25): 31 rows, 990 gems (≤ 1,500), no Radiant or Celestial before Total Assault', () => {
    const d = updateDay('mid');
    expect([d.newMet, d.gems, d.tickets]).toEqual([31, 990, 0]);
    expect(d.gems).toBeLessThanOrEqual(1500);
    expect(d.boxes).toEqual({ sturdy: 7, ornate: 17, radiant: 0, celestial: 0 });
    expect(d.ribbons).toEqual([5, 4]);
    expect(d.titles).toEqual([3, 1]);
  });

  it('late (day ~60): 54 rows, 2,790 gems (≤ 4,000), 56 boxes, 20 ribbons and 19 titles', () => {
    const d = updateDay('late');
    expect([d.newMet, d.gems, d.tickets]).toEqual([54, 2790, 0]);
    expect(d.gems).toBeLessThanOrEqual(4000);
    expect(d.boxes).toEqual({ sturdy: 7, ornate: 42, radiant: 7, celestial: 0 });
    expect(d.ribbons).toEqual([12, 8]);
    expect(d.titles).toEqual([9, 10]);
    // Achiever counts the claims of the same tap (Claim all repeats until nothing is left)
    expect(d.r.ids).toContain('a_ach_25');
  });

  it('a second Claim all pays nothing', () => {
    const d = updateDay('late');
    const again = claimAllAchievements(d.p);
    expect(again.ok).toBe(false);
    expect(again.rewards).toEqual([]);
  });

  it('a brand-new account sees the same list with nothing claimable', () => {
    const p = createProfile();
    expect(achievementList(p).filter((a) => a.claimable)).toEqual([]);
    expect(claimAllAchievements(p).ids).toEqual([]);
  });
});
