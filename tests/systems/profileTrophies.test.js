// Sensei Profile trophies (docs/specs/PROFILE.md §4, ACHIEVEMENTS.md §6).
import { describe, it, expect } from 'vitest';
import {
  earnedTitles, earnedFrames, bannerUnlocked, medalTally, ribbonTally, pinEarned, pinOptions, autoPins, autoShowcase, freeplayByTier,
  collectionStats, pinInfo, titleKeepable,
} from '../../src/systems/profileTrophies.js';
import { TITLES } from '../../src/data/profileArt.js';
import { STAGES } from '../../src/data/stages.js';
import { unitPower } from '../../src/systems/progression.js';
import { freshSave, lateSave } from './profileFixtures.js';

describe('titles', () => {
  it('freeplay titles come from the fpm: marks even when progress.freeplay was dropped', () => {
    const p = freshSave();
    expect(earnedTitles(p)).toEqual([]);
    p.missions.counters['fpm:tempest:matriarch'] = 1;
    expect(earnedTitles(p)).toEqual(['fp_ashwing']);
    p.missions.counters['fpm:crimson:matriarch'] = 1;
    expect(earnedTitles(p)).toContain('fp_crimson');
  });
  it('legacy title strings map to their ids', () => {
    const p = freshSave();
    p.progress.freeplay = { done: [], titles: ['Crimson Slayer'], frames: [] };
    expect(earnedTitles(p)).toEqual(['fp_crimson']);
  });
  it('achievement titles only from rows that declare one; never recruiting', () => {
    const p = freshSave();
    p.missions.achievements = { a_gold_40: true, a_gold_10: true, a_pulls_300: true };
    expect(earnedTitles(p)).toEqual(['a_gold_40']);
    expect(Object.keys(TITLES).some((id) => id.startsWith('a_pulls_'))).toBe(false);
    for (const t of Object.values(TITLES)) expect(t.text.length).toBeLessThanOrEqual(24);
  });
  it('keeps a claimed title a newer build knows; drops unclaimed and recruit ones', () => {
    const p = freshSave();
    p.missions.achievements = { a_future_title: true, a_pulls_10: true };
    expect(titleKeepable(p, 'a_future_title')).toBe(true);
    expect(titleKeepable(p, 'a_other_future')).toBe(false);
    expect(titleKeepable(p, 'a_pulls_10')).toBe(false);
    expect(titleKeepable(p, 'Add me!')).toBe(false);
  });
});

describe('frames and banners', () => {
  it('UR from a fully awakened SSR, Eclipse from a :wyrm mark or the legacy frame', () => {
    const p = freshSave();
    expect(earnedFrames(p)).toEqual([]);
    p.units.luna = { ...p.units.hikari, awaken: 5 };
    expect(earnedFrames(p)).toEqual(['ur']);
    p.units.luna.awaken = 4;
    p.missions.counters['fpm:blossom:wyrm'] = 1;
    expect(earnedFrames(p)).toEqual(['eclipse']);
    delete p.missions.counters['fpm:blossom:wyrm'];
    p.progress.freeplay = { done: [], titles: [], frames: ['eclipse'] };
    expect(earnedFrames(p)).toEqual(['eclipse']);
  });
  it('banners: academy free, a theme after its whole chapter, a scene with her', () => {
    const p = freshSave();
    expect(bannerUnlocked(p, 'academy:night')).toBe(true);
    expect(bannerUnlocked(p, 'theme:sakura')).toBe(false);
    for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) p.progress.stages[id] = { clears: 1, easy: true };
    expect(bannerUnlocked(p, 'theme:sakura')).toBe(true);
    expect(bannerUnlocked(p, 'scene:hikari')).toBe(true);
    expect(bannerUnlocked(p, 'scene:sango')).toBe(false);
    expect(bannerUnlocked(p, 'theme:nowhere')).toBe(false);
  });
});

describe('medals and pins', () => {
  it('medalTally counts over all 59 stages', () => {
    expect(STAGES.length).toBe(59);
    expect(medalTally(freshSave())).toEqual([0, 0, 0, 0]);
    expect(medalTally(lateSave())).toEqual([59, 59, 59, 59]);
  });
  it('ribbonTally counts mode ribbons over the campaign, per mode (a Nightmare medal holds Last Petal)', () => {
    expect(ribbonTally(freshSave())).toEqual([0, 0, 0, 0, 0]);
    const p = freshSave();
    p.progress.stages['3-2'] = { clears: 4, hard: true, nightmare: true, modes: { 'hard:rush': true, 'easy:rush': true, 'normal:frugal': true } };
    p.progress.stages['8-5'] = { clears: 1, nightmare: true };
    // [reverse, rush, ironclad, frugal, laststand]
    expect(ribbonTally(p)).toEqual([0, 2, 0, 1, 2]);
    // a late save holds every medal: 40 campaign stages' Nightmare Last Petal ribbons
    expect(ribbonTally(lateSave())[4]).toBe(40);
  });
  it('pinEarned per kind', () => {
    const p = freshSave();
    p.progress.stages['8-5'] = { clears: 1, nightmare: true };
    p.missions.achievements = { a_gold_40: true, a_pulls_10: true, a_future: true };
    expect(pinEarned(p, '8-5:nightmare')).toBe(true);
    expect(pinEarned(p, '8-5:hard')).toBe(false);
    expect(pinEarned(p, 'nowhere:hard')).toBe(false);
    expect(pinEarned(p, 'ach:a_gold_40')).toBe(true);
    expect(pinEarned(p, 'ach:a_pulls_10')).toBe(false);
    expect(pinEarned(p, 'ach:a_future')).toBe(true); // forward compatible
    // battle-mode ribbons: Nightmare × Last Petal is the Nightmare medal's battle (unlocks.js modeRibbons)
    expect(pinEarned(p, '8-5:nightmare:laststand')).toBe(true);
    expect(pinEarned(p, '8-5:hard:rush')).toBe(false);
    expect(pinEarned(p, '8-5:perfect')).toBe(false);
    p.progress.stages['8-5'].modes = { 'hard:rush': true };
    expect(pinEarned(p, '8-5:hard:rush')).toBe(true);
    expect(pinEarned(p, '8-5:hard:standard')).toBe(false);
    expect(pinEarned(p, 'boss-colossus:hard:rush')).toBe(false); // ribbons are campaign-only
    const modes = {};
    for (const d of ['easy', 'normal', 'hard', 'nightmare']) for (const m of ['reverse', 'rush', 'ironclad', 'frugal', 'laststand']) modes[`${d}:${m}`] = true;
    p.progress.stages['8-5'].modes = modes;
    expect(pinEarned(p, '8-5:perfect')).toBe(true);
    const o = pinOptions(p);
    expect(o.ribbons[0]).toBe('8-5:perfect');
    expect(o.ribbons.length).toBe(1 + 20);
    expect(o.ribbons[1]).toBe('8-5:nightmare:reverse');
  });
  it('picker lists best first; recruiting never', () => {
    const p = lateSave();
    const o = pinOptions(p);
    expect(o.medals[0]).toBe('8-5:nightmare');
    expect(pinInfo('boss-colossus:hard').sub).toBe('Iron Colossus');
    expect(o.medals.slice(0, 59).every((pin) => pin.endsWith(':nightmare'))).toBe(true);
    expect(o.achievements.some((pin) => /a_pulls_|a_units_all|a_reroll_10/.test(pin))).toBe(false);
    // specials → shiny → plain Honor Ribbons → titled rows without a ribbon → the rest
    const RANK = { special: 0, shiny: 1, plain: 2 };
    const ranks = o.achievements.map((x) => RANK[pinInfo(x).honor?.cls] ?? 3);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(ranks[0]).toBe(0);
    expect(autoPins(p)).toEqual(o.medals.slice(0, 4));
    expect(autoPins(freshSave())).toEqual([]);
  });
  it('pinInfo draws from the game tables; unknown achievements read as a newer trophy', () => {
    expect(pinInfo('8-5:nightmare')).toMatchObject({ kind: 'medal', title: 'Sakura Medal', sub: 'Stage 8-5' });
    expect(pinInfo('ach:a_gold_40')).toMatchObject({ title: 'Valedictorian', sub: 'Honor Ribbon' });
    expect(pinInfo('ach:a_gold_10')).toMatchObject({ title: 'Golden Student', sub: 'Achievement' });
    expect(pinInfo('ach:a_from_the_future')).toMatchObject({ unknown: true, title: 'A newer trophy' });
  });
});

describe('showcase, freeplay, stats', () => {
  it('autoShowcase = the 8 strongest owned girls', () => {
    const p = lateSave();
    const ids = autoShowcase(p);
    expect(ids).toHaveLength(8);
    const pw = ids.map((id) => unitPower(p, id));
    expect([...pw].sort((a, b) => b - a)).toEqual(pw);
    expect(autoShowcase(freshSave()).sort()).toEqual(['aoi', 'hikari', 'rei']);
  });
  it('freeplayByTier takes the best of solo and co-op; ties go to solo', () => {
    const p = lateSave();
    expect(freeplayByTier(p)).toEqual({ blossom: { w: 212, s: '5-4' }, tempest: { w: 168, s: '8-1', c: 1 }, crimson: { w: 121, s: '7-3', c: 1 } });
    const q = freshSave();
    q.progress.stages['1-1'] = { clears: 1, easy: true, freeplayBest: { blossom: 120 }, coopBestWave: { blossom: 120 } };
    expect(freeplayByTier(q)).toEqual({ blossom: { w: 120, s: '1-1' } });
    expect(freeplayByTier(freshSave())).toEqual({});
  });
  it('collectionStats', () => {
    const s = collectionStats(lateSave());
    expect(s.s).toBe(59);
    expect(s.k).toBe(25310);
    expect(s.h).toBeGreaterThan(0);
    expect(collectionStats(freshSave())).toMatchObject({ u: 3, s: 0, k: 0, h: 0 });
  });
});
