// The visited profile (#/profile/<id>, docs/specs/PROFILE.md §1.10): its back arrow returns where it was
// opened from (chat, the clan roster, Messages), the own profile's goes to the lobby; "Sensei since" shows
// the server's month and never a day.
import { describe, it, expect } from 'vitest';
import { parentRoute } from '../../src/ui/nav.js';
import { sinceText } from '../../src/ui/profile/online.js';

const r = (name, params = {}) => ({ name, params });

describe('profile back arrow', () => {
  it('own profile → the lobby; a visited profile → where it was opened from', () => {
    expect(parentRoute('profile', {}, r('clan', { tab: 'members' }))).toEqual(r('lobby'));
    expect(parentRoute('profile', { id: 'u1' }, r('clan', { tab: 'members' }))).toEqual(r('clan', { tab: 'members' }));
    expect(parentRoute('profile', { id: 'u1' }, r('messages', { id: 't1' }))).toEqual(r('messages', { id: 't1' }));
    expect(parentRoute('profile', { id: 'u1' }, null)).toEqual(r('lobby'));
  });
});

describe('sinceText', () => {
  it('formats YYYY-MM, ignores anything else', () => {
    expect(sinceText('2026-10')).toBe('Sensei since Oct 2026');
    expect(sinceText('2027-01')).toBe('Sensei since Jan 2027');
    for (const bad of [null, '', '2026-10-15', 'Oct 2026']) expect(sinceText(bad)).toBe('');
  });
});
