// UI M5d: the Sensei Profile's empty states (src/ui/profile/zero.js; UI_DIRECTION P7 "hide zero and irrelevant states"):
// a stat at zero, a difficulty without a medal, ribbons and Honor Ribbons before the first one, freeplay tiers never
// played, and an empty bio that cannot be written yet are not shown; a new player's own profile keeps its Medals panel
// (its empty line says how to earn them); a visitor's profile drops an empty panel. On real saves too.
import { describe, it, expect } from 'vitest';
import { profileZero, visibleStats, medalDiffs, ribbonsWon, freeplayPlayed, freeplayEarned, isFreeplayTitle, isFreeplayFrame, STAT_KEYS } from '../../src/ui/profile/zero.js';
import { ownModel } from '../../src/ui/screens/profile.js';
import { createProfile } from '../../src/systems/save.js';
import { veteran } from '../fixtures/veterans.js';

describe('the profile\'s zero states', () => {
  it('a stat at zero is hidden ("0% Bestiary", "0 Enemies defeated")', () => {
    expect(STAT_KEYS).toEqual(['u', 's', 'b', 'k']);
    expect(visibleStats({ u: 19, s: 15, b: 0, k: 0 })).toEqual(['u', 's']);
    expect(visibleStats({ u: 3, s: 0, b: 12, k: 3400 })).toEqual(['u', 'b', 'k']);
    expect(visibleStats({})).toEqual([]);
  });

  it('only the difficulties with a medal; ribbons only once one is won', () => {
    expect(medalDiffs([15, 15, 0, 0])).toEqual(['easy', 'normal']);
    expect(medalDiffs([0, 0, 0, 0])).toEqual([]);
    expect(medalDiffs([59, 59, 59, 59])).toEqual(['easy', 'normal', 'hard', 'nightmare']);
    expect(ribbonsWon([0, 0, 0, 0, 0])).toBe(false);
    expect(ribbonsWon([0, 2, 0, 0, 0])).toBe(true);
    expect(ribbonsWon(undefined)).toBe(false); // a card from before the modes
  });

  it('freeplay: only the tiers played ("Not played yet" went)', () => {
    expect(freeplayPlayed({})).toEqual([]);
    expect(freeplayPlayed({ tempest: { s: '2-3', w: 40 } })).toEqual(['tempest']);
  });

  it('a new player\'s own profile: no zero stats, no medal tally, no ribbons, no Freeplay panel, no Honor Ribbons; the Medals panel stays with its empty line', () => {
    const m = ownModel(createProfile());
    const z = profileZero(m);
    expect(z.stats).not.toContain('b');
    expect(z.stats).not.toContain('k');
    expect(z.medals).toEqual([]);
    expect(z.ribbons).toBe(false);
    expect(z.freeplay).toEqual([]);
    expect(z.earned).toBe(false);
    expect(z.honors).toBe(false);
    expect(z.trophies).toBe(true); // own: "Clear stages to earn medals"
  });

  it('the bio: text when written; an empty bio is a button only online (offline it is not shown)', () => {
    expect(profileZero({ own: true, bio: 'Hi!', online: 'offline' }).bio).toBe('text');
    expect(profileZero({ own: true, bio: '', online: 'ready' }).bio).toBe('button');
    expect(profileZero({ own: true, bio: '', online: 'offline' }).bio).toBeNull();
    expect(profileZero({ own: true, bio: '', online: 'needs_update' }).bio).toBeNull();
    expect(profileZero({ own: false, bio: '' }).bio).toBeNull();
  });

  it('a visitor\'s card with nothing won drops the Medals panel; one medal brings it back', () => {
    const empty = { own: false, medals: [0, 0, 0, 0], ribbons: [0, 0, 0, 0, 0], pins: [], honors: { count: 0 }, fp: {}, st: { u: 4, s: 0, b: 0, k: 0 } };
    expect(profileZero(empty).trophies).toBe(false);
    expect(profileZero({ ...empty, medals: [1, 0, 0, 0] }).trophies).toBe(true);
    expect(profileZero({ ...empty, honors: { count: 2 } })).toMatchObject({ trophies: true, honors: true });
    expect(profileZero({ ...empty, title: 'fp_tempest' }).earned).toBe(true);
  });

  it('the Freeplay panel comes for what it lists: freeplay titles and frames, never an achievement or tag title alone (UI M5d review)', () => {
    expect(isFreeplayTitle('fp_tempest')).toBe(true);
    expect(isFreeplayTitle('team_player')).toBe(false);
    expect(isFreeplayTitle(null)).toBe(false);
    // your own: one achievement title (or the testers' tag title) and no freeplay run: no panel
    expect(profileZero({ own: true, earnedTitles: ['team_player'], earnedFrames: [], fp: {} }).earned).toBe(false);
    expect(freeplayEarned({ own: true, earnedTitles: ['alpha_tester'], earnedFrames: [] })).toBe(false);
    expect(profileZero({ own: true, earnedTitles: ['team_player', 'fp_tempest'], earnedFrames: [] }).earned).toBe(true);
    expect(profileZero({ own: true, earnedTitles: [], earnedFrames: ['eclipse'] }).earned).toBe(true);
    // someone else's card: their title only when it is a freeplay one; their frame
    expect(profileZero({ own: false, title: 'team_player' }).earned).toBe(false);
    expect(profileZero({ own: false, title: 'team_player', frame: 'eclipse' }).earned).toBe(true);
    // Cosmetics 2: only Freeplay frames count; academy, LR, secret and event frames are not Freeplay records
    expect(['eclipse', 'tide', 'endless'].every(isFreeplayFrame)).toBe(true);
    expect(['ur', 'sakura', 'limit', 'window_seat', 'lantern_night', 'pumpkin', null].some(isFreeplayFrame)).toBe(false);
    expect(profileZero({ own: true, earnedTitles: [], earnedFrames: ['sakura', 'window_seat', 'ur'] }).earned).toBe(false);
    expect(profileZero({ own: true, earnedTitles: [], earnedFrames: ['window_seat', 'tide'] }).earned).toBe(true);
    expect(profileZero({ own: false, title: 'team_player', frame: 'window_seat' }).earned).toBe(false);
  });

  it('a late save keeps everything it has won', () => {
    const z = profileZero(ownModel(veteran('late')));
    expect(z.stats.length).toBeGreaterThanOrEqual(2);
    expect(z.medals.length).toBeGreaterThanOrEqual(1);
    expect(z.trophies).toBe(true);
  });
});
