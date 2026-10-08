// Director route mapping (src/audio/routes.js) against the real game data.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { musicForRoute, preloadFor, familyForTheme, battleTrack, waveSting, bossTrackFor, battlePreloads, THEME_FAMILY, FAMILIES } from '../../src/audio/routes.js';
import { resolveTrack } from '../../src/audio/loopMath.js';
import { MAPS } from '../../src/data/maps.js';
import { STAGES } from '../../src/data/stages.js';
import { ENEMIES } from '../../src/data/enemies.js';

const mainSrc = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const ROUTES = [...mainSrc.matchAll(/registerRoute\('([a-z]+)'/g)].map((m) => m[1]);
const man = JSON.parse(readFileSync(new URL('../../public/audio/music/manifest.json', import.meta.url), 'utf8'));

describe('route → music', () => {
  test('every registered route has a decision', () => {
    expect(ROUTES.length).toBeGreaterThan(10);
    for (const r of [...ROUTES, 'title']) {
      const m = musicForRoute(r);
      expect(m.track || m.keep || m.battle, r).toBeTruthy();
    }
  });
  test('the table from docs/AUDIO.md §3.6', () => {
    expect(musicForRoute('title')).toEqual({ track: 'title', stems: { full: 1 } });
    expect(musicForRoute('lobby')).toEqual({ track: 'homeroom', stems: { base: 1, melody: 1 } });
    for (const r of ['students', 'student', 'formation', 'backpack', 'bestiary', 'wiki', 'commissions', 'rewards']) {
      expect(musicForRoute(r)).toEqual({ track: 'homeroom', stems: { base: 1, melody: 0 } });
    }
    for (const r of ['missions', 'campaign', 'bounty', 'assault', 'challenge']) expect(musicForRoute(r)).toEqual({ track: 'march', stems: { base: 1, prep: 0 } });
    expect(musicForRoute('stage')).toEqual({ track: 'march', stems: { base: 1, prep: 1 } });
    expect(musicForRoute('recruit')).toEqual({ track: 'wishing', stems: { base: 1, riser: 0 } });
    expect(musicForRoute('mall')).toEqual({ track: 'mall', stems: { full: 1 } });
    expect(musicForRoute('battle')).toEqual({ battle: true });
    expect(musicForRoute('settings').keep).toBe(true);
    expect(musicForRoute('something-new')).toEqual({ keep: true });
  });
  test('lobby and the menus are the same track (stem change, no restart)', () => {
    expect(musicForRoute('lobby').track).toBe(musicForRoute('students').track);
  });
  test('every route track resolves in the shipped manifest (real track or stand-in)', () => {
    for (const r of [...ROUTES, 'title']) {
      const m = musicForRoute(r);
      if (m.track) expect(resolveTrack(m.track, man), r).toBeTruthy();
    }
    for (const r of ROUTES) for (const p of preloadFor(r)) expect(typeof p.track).toBe('string');
  });
});

describe('battle families', () => {
  test('every map theme maps to one of the five families', () => {
    const themes = new Set(MAPS.map((m) => m.theme));
    expect(themes.size).toBeGreaterThan(5);
    for (const t of themes) {
      expect(THEME_FAMILY[t], t).toBeTruthy();
      expect(FAMILIES).toContain(familyForTheme(t));
      expect(resolveTrack(battleTrack(t), man), t).toBeTruthy();
      expect(resolveTrack(waveSting(t), man), t).toBeTruthy();
    }
  });
  test('every stage gets a battle track; bosses get boss tracks', () => {
    const mapTheme = Object.fromEntries(MAPS.map((m) => [m.id, m.theme]));
    for (const s of STAGES) expect(battleTrack(mapTheme[s.mapId])).toMatch(/^battle_(blossom|moonlit|lantern|ironclock|matsuri)$/);
    const bosses = ENEMIES.filter((e) => e.tier === 'boss').map((e) => e.id);
    expect(bosses.length).toBeGreaterThan(0);
    expect(bossTrackFor('dragon_ashwing')).toBe('final');
    for (const b of bosses) expect(['boss', 'final']).toContain(bossTrackFor(b));
    expect(battlePreloads('sakura', { hasBoss: true, bossId: 'grave_lych' }).map((p) => p.track)).toContain('boss');
  });
});
