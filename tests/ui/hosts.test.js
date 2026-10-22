// UI M5a: who hosts which screen (src/ui/hosts.js; UI_DIRECTION §5.10 E1, owner #69/#108, notes Q1/Q2/Q4): the
// default table, never an adult hero, never placeholder art, the secretary fallback, Missions keeps the secretary.
import { describe, it, expect } from 'vitest';
import { HOSTS, PLACEHOLDER_ART, canHost, hostFor } from '../../src/ui/hosts.js';
import { UNIT_MAP, UNITS } from '../../src/data/units.js';

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
  it('an unknown screen falls back to the secretary', () => {
    expect(hostFor('nowhere', profile)).toBe('aoi');
  });
});
