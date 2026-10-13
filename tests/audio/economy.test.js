// Economy / progression cues and the Node-safe cue queue.
import { describe, test, expect } from 'vitest';
import { snapshot, economyCues } from '../../src/audio/economy.js';
import { cue, pendingCues, setCueHandler } from '../../src/audio/cue.js';
import { volumesFrom } from '../../src/audio/engine.js';

const P = (coins, gems, items = {}, gear = {}) => ({ currencies: { coins, gems }, items, gear });

describe('economyCues', () => {
  test('claims: stamp, then what went up, staggered', () => {
    const a = snapshot(P(100, 10));
    const b = snapshot(P(150, 30, { book: 2 }));
    expect(economyCues(a, b, 'missions')).toEqual([
      { sfx: 'eco.claim', delay: 0 }, { sfx: 'eco.gems', delay: 160 }, { sfx: 'eco.coins', delay: 280 }, { sfx: 'eco.item', delay: 400 },
    ]);
    expect(economyCues(a, snapshot(P(150, 10)), 'login')).toEqual([{ sfx: 'eco.claim', delay: 0 }, { sfx: 'eco.coins', delay: 160 }]);
  });
  test('level-up and awaken are music jingles; shop buys; gear sounds pitch with level', () => {
    const a = snapshot(P(100, 10, {}, { g1: { level: 2 } }));
    expect(economyCues(a, a, 'level-up')).toEqual([{ music: 'levelup', delay: 0 }]);
    expect(economyCues(a, a, 'awaken')).toEqual([{ music: 'awaken', delay: 0 }]);
    expect(economyCues(a, snapshot(P(50, 10, { x: 1 }, { g1: { level: 2 } })), 'shop')).toEqual([{ sfx: 'eco.purchase', delay: 0 }, { sfx: 'eco.item', delay: 180 }]);
    const up = economyCues(a, snapshot(P(90, 10, {}, { g1: { level: 5 } })), 'gear-enhance')[0];
    expect(up.sfx).toBe('gear.enhance');
    expect(up.rate).toBeGreaterThan(1);
  });
  test('pulls, battle results and app start are silent here (other systems own them)', () => {
    const a = snapshot(P(1, 1));
    for (const r of ['pull', 'spark', 'battle-result', 'app-start', 'settings', 'change']) expect(economyCues(a, snapshot(P(9, 9, { a: 1 })), r)).toEqual([]);
  });
});

describe('cue() in Node', () => {
  test('is a no-op without window and never throws', () => {
    expect(typeof window).toBe('undefined');
    expect(() => cue('gacha.flip', { rarity: 'SSR' })).not.toThrow();
    expect(pendingCues()).toEqual([]);
    setCueHandler(null);
  });
});

describe('volumes from settings', () => {
  test('defaults, toggles off, and old numeric music/sfx saves', () => {
    expect(volumesFrom({})).toMatchObject({ master: 0.8, music: 0.7, sfx: 0.8, musicOn: true, sfxOn: true });
    expect(volumesFrom({ music: false, sfx: true, musicVolume: 0.5 })).toMatchObject({ music: 0, sfx: 0.8, musicOn: false });
    expect(volumesFrom({ music: 0.4, sfx: 0 })).toMatchObject({ music: 0.4, sfx: 0, musicOn: true, sfxOn: false });
    expect(volumesFrom({ volume: 2, musicVolume: -1 })).toMatchObject({ master: 1, music: 0 });
  });
});
