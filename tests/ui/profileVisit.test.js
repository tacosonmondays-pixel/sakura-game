// The visited profile (#/profile/<id>, docs/specs/PROFILE.md §1.10): its back arrow returns where it was
// opened from (chat, the clan roster, Messages), the own profile's goes to the lobby; "Sensei since" shows
// the server's month and never a day. Source rules: the shared card actions bring their own stylesheet (the
// visit imports them without the player card), and no tag title is ever drawn from the cached tags.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parentRoute } from '../../src/ui/nav.js';
import { sinceText } from '../../src/ui/profile/online.js';

const src = (f) => readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8');

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

describe('source rules', () => {
  it('playerActions.js brings social.css (a reload of #/profile/<id> loads no player card)', () => {
    expect(src('ui/online/playerActions.js')).toMatch(/^import '\.\.\/styles\/social\.css';$/m);
  });
  it('the profile screen never reads the cached tags (Preview and visits wait for the server, else hide the title)', () => {
    const code = src('ui/screens/profile.js').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/\btagsOf\b/);
  });
});
