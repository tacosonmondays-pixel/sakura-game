// UI M5a: who hosts which screen (src/ui/hosts.js; UI_DIRECTION §5.10 E1, owner #69/#108, notes Q1/Q2/Q4): the
// default table, never an adult hero, never placeholder art, the secretary fallback, Missions keeps the secretary.
import { describe, it, expect } from 'vitest';
import { HOSTS, PLACEHOLDER_ART, FALLBACK_HOST, canHost, hostFor } from '../../src/ui/hosts.js';
import { UNIT_MAP, UNITS } from '../../src/data/units.js';
import { secretaryOf } from '../../src/ui/lobby/secretaryOf.js';
import { createProfile } from '../../src/systems/save.js';

describe('screen hosts', () => {
  const profile = { units: { aoi: {}, hikari: {} }, secretary: 'aoi', formation: { hero: 'hikari' } };

  it('the default table (Q1)', () => {
    expect(hostFor('commissions', profile)).toBe('miko');
    expect(hostFor('login', profile)).toBe('miko');
    expect(hostFor('assault', profile)).toBe('rei');
    expect(hostFor('titans', profile)).toBe('kaede');
    expect(hostFor('mall', profile)).toBe('midori');
    expect(hostFor('mail', profile)).toBe('hotaru');
    expect(hostFor('happening', profile)).toBe('suzu');
    expect(hostFor('multiplayer', profile)).toBe('momo');
  });
  it('Missions keeps the lobby secretary, whoever she is (even an adult hero)', () => {
    expect(hostFor('missions', profile)).toBe('aoi');
    expect(hostFor('missions', { units: { hikari: {} }, secretary: 'hikari' })).toBe('hikari');
  });
  it('Bounty: this week\'s double-drop guest, else the secretary (Q4)', () => {
    expect(hostFor('bounty', profile, { guest: 'hotaru' })).toBe('hotaru');
    expect(hostFor('bounty', profile, { guest: 'luna' })).toBe('aoi'); // an adult hero guest week
    expect(hostFor('bounty', profile, {})).toBe('aoi');
  });
  it('she hosts whether or not she is owned (Q2)', () => {
    expect(profile.units.miko).toBeUndefined();
    expect(hostFor('commissions', profile)).toBe('miko');
  });
  it('no host in the table is an adult hero or a girl with placeholder art', () => {
    for (const [screen, who] of Object.entries(HOSTS)) {
      if (who === 'secretary' || who === 'guest') continue;
      const u = UNIT_MAP[who];
      expect(u, screen).toBeTruthy();
      expect(u.adult, screen).toBeFalsy();
      expect(u.kind, screen).not.toBe('hero');
      expect(PLACEHOLDER_ART.has(who), screen).toBe(false);
    }
  });
  it('canHost turns away every adult hero and every placeholder girl', () => {
    for (const u of UNITS) {
      if (u.adult || u.kind === 'hero') expect(canHost(u), u.id).toBe(false);
    }
    for (const id of PLACEHOLDER_ART) expect(canHost(id), id).toBe(false);
    expect(canHost('nobody')).toBe(false);
  });
  it('the seven academy girls have their real art since v0.1.47: none is turned away as coming-soon art', () => {
    const seven = ['azami', 'kinu', 'wakaba', 'yuzuha', 'ouka', 'chigusa', 'marumi'];
    for (const id of seven) {
      expect(UNIT_MAP[id], id).toBeTruthy();
      expect(PLACEHOLDER_ART.has(id), id).toBe(false);
      expect(canHost(id), id).toBe(true);
    }
    // she may host a Bounty week as its guest, and a secretary of hers hosts a screen whose host is turned away
    expect(hostFor('bounty', profile, { guest: 'marumi' })).toBe('marumi');
    expect(hostFor('bounty', { units: { azami: {} }, secretary: 'azami' }, { guest: 'luna' })).toBe('azami');
  });
  it('no girl with drawn art is on the coming-soon list (src/art/portraits.js isPlaceholderPortrait)', async () => {
    const { isPlaceholderPortrait } = await import('../../src/art/portraits.js');
    for (const id of PLACEHOLDER_ART) expect(isPlaceholderPortrait(id), id).toBe(true);
  });
  it('an unknown screen falls back to the secretary', () => {
    expect(hostFor('nowhere', profile)).toBe('aoi');
  });
  it('the fallback is never an adult hero: a hero secretary hands over to a fixed student (the M5a review case)', () => {
    const fresh = createProfile(); // a new player: the secretary is Hikari, an adult hero
    expect(UNIT_MAP[secretaryOf(fresh)].kind === 'hero' || UNIT_MAP[secretaryOf(fresh)].adult).toBe(true);
    expect(canHost(FALLBACK_HOST)).toBe(true);
    // Luna's double-drop week (lobby/notice.js ARENA_GUEST['res-mats-a']): Luna is an adult hero, and so is the secretary
    expect(hostFor('bounty', fresh, { guest: 'luna' })).toBe(FALLBACK_HOST);
    expect(hostFor('bounty', { units: { hikari: {} }, formation: { hero: 'hikari' } }, { guest: 'luna' })).toBe(FALLBACK_HOST);
    expect(hostFor('nowhere', fresh)).toBe(FALLBACK_HOST);
    // every screen, any guest, the new player's save: always a student who may host (Missions excepted)
    for (const screen of Object.keys(HOSTS)) {
      if (screen === 'missions') continue;
      for (const guest of [null, ...UNITS.map((u) => u.id)]) expect(canHost(hostFor(screen, fresh, { guest })), `${screen} ${guest}`).toBe(true);
    }
  });
});
