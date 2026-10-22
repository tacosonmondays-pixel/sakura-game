// UI M5a: one badge vocabulary (src/ui/badges.js; UI_DIRECTION P7 + §5.10): which badge for which state, n/m hidden
// at 0 unless 0 is the call to action, tabs get a red dot only, and "Open!" shows once: for a mode that opened since
// the last look, until its first visit (never on the first look ever).
import { describe, it, expect } from 'vitest';
import { badgeFor, openStickers, seenOpen, openModes, openSeen, markOpenSeen, OPEN_KEY, OPEN_MODES } from '../../src/ui/badges.js';

describe('badgeFor', () => {
  it('one badge per state, most important first', () => {
    expect(badgeFor({ open: true, claim: true })).toEqual({ kind: 'open', text: 'Open!' });
    expect(badgeFor({ claim: true, unread: 3 })).toEqual({ kind: 'dot' });
    expect(badgeFor({ unread: 3 })).toEqual({ kind: 'count', text: '3' });
    expect(badgeFor({ unread: 140 })).toEqual({ kind: 'count', text: '99+' });
    expect(badgeFor({ progress: [2, 5] })).toEqual({ kind: 'prog', text: '2/5' });
    expect(badgeFor({ inProgress: true })).toEqual({ kind: 'inprog', text: 'In Progress' });
    expect(badgeFor({ newTab: true })).toEqual({ kind: 'newtab', text: 'New' });
    expect(badgeFor({ isNew: true })).toEqual({ kind: 'new', text: 'NEW' });
    expect(badgeFor({ newInside: true })).toEqual({ kind: 'ydot' });
    expect(badgeFor({})).toBe(null);
  });
  it('n/m is hidden at 0 on Glance surfaces, unless 0 is the call to action', () => {
    expect(badgeFor({ progress: [0, 5] })).toBe(null);
    expect(badgeFor({ progress: [0, 5], cta: true })).toEqual({ kind: 'prog', text: '0/5' });
    expect(badgeFor({ progress: [3, 0] })).toBe(null);
  });
  it('tabs carry a red dot only, never a count (P7)', () => {
    expect(badgeFor({ tab: true, unread: 7 })).toEqual({ kind: 'dot' });
    expect(badgeFor({ tab: true, claim: true })).toEqual({ kind: 'dot' });
    expect(badgeFor({ tab: true, progress: [2, 5], inProgress: true })).toBe(null);
    expect(badgeFor({ tab: true })).toBe(null);
  });
});

describe('"Open!" once', () => {
  it('the first look ever only learns what is open', () => {
    const a = openStickers(['titans', 'challenge'], { known: null, pending: [] });
    expect(a.show).toEqual([]);
    expect(a.memory.known).toEqual(['titans', 'challenge']);
  });
  it('a mode that opened since the last look shows until its first visit, then never again', () => {
    let m = openStickers(['challenge'], { known: null, pending: [] }).memory;
    let r = openStickers(['challenge', 'titans'], m);
    expect(r.show).toEqual(['titans']);
    m = r.memory;
    r = openStickers(['challenge', 'titans'], m); // still not visited: still shows
    expect(r.show).toEqual(['titans']);
    m = seenOpen(r.memory, 'titans');
    r = openStickers(['challenge', 'titans'], m);
    expect(r.show).toEqual([]);
    r = openStickers(['challenge', 'titans', 'sandbox'], r.memory);
    expect(r.show).toEqual(['sandbox']);
  });
  it('through storage: openModes / openSeen / markOpenSeen (and a broken store never throws)', () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
    expect(openModes(['challenge'], storage)).toEqual([]);
    expect(openModes(['challenge', 'assault'], storage)).toEqual(['assault']);
    expect(openSeen('assault', storage)).toBe(false);
    expect(openSeen('challenge', storage)).toBe(true);
    markOpenSeen('assault', storage);
    expect(openSeen('assault', storage)).toBe(true);
    expect(openModes(['challenge', 'assault'], storage)).toEqual([]);
    expect(JSON.parse(store.get(OPEN_KEY)).known).toEqual(['challenge', 'assault']);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(openModes(['titans'], broken)).toEqual([]);
    expect(() => markOpenSeen('titans', broken)).not.toThrow();
    expect(openModes(['titans'], null)).toEqual([]);
  });
  it('the modes that can wear it', () => {
    expect([...OPEN_MODES].sort()).toEqual(['assault', 'challenge', 'sandbox', 'titans']);
  });
});
