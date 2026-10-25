// UI M5a: desktop keys (src/ui/keys.js; UI_DIRECTION §5.10 E8, notes Q14): the pure shouldHandle(event, ctx). Space
// presses the screen's primary and Esc closes or goes back, only on screens that opt in; never in a battle, a story
// scene or the title, never while typing, and Space never with a window open or a button focused.
import { describe, it, expect } from 'vitest';
import { shouldHandle, OWN_KEYS } from '../../src/ui/keys.js';

const space = { key: ' ', code: 'Space' };
const esc = { key: 'Escape', code: 'Escape' };
const hub = { route: 'missions', optedIn: true };

describe('shouldHandle', () => {
  it('Space → the primary, Escape → close / back, on a screen that opts in', () => {
    expect(shouldHandle(space, hub)).toBe('primary');
    expect(shouldHandle(esc, hub)).toBe('escape');
    expect(shouldHandle({ key: 'a' }, hub)).toBe(null);
  });
  it('a screen without a primary (not opted in) keeps both keys as before', () => {
    expect(shouldHandle(space, { route: 'missions', optedIn: false })).toBe(null);
    expect(shouldHandle(esc, { route: 'students' })).toBe(null);
  });
  it('skips the battle, story scenes and the title (their own keys)', () => {
    for (const route of ['battle', 'scene', 'title']) {
      expect(OWN_KEYS.has(route)).toBe(true);
      expect(shouldHandle(space, { route, optedIn: true })).toBe(null);
      expect(shouldHandle(esc, { route, optedIn: true })).toBe(null);
    }
  });
  it('skips while typing in an input', () => {
    expect(shouldHandle(space, { ...hub, typing: true })).toBe(null);
    expect(shouldHandle(esc, { ...hub, typing: true })).toBe(null);
  });
  it('Space waits while a modal or sheet is open, or a button has focus; Escape still closes', () => {
    expect(shouldHandle(space, { ...hub, modalOpen: true })).toBe(null);
    expect(shouldHandle(esc, { ...hub, modalOpen: true })).toBe('escape');
    expect(shouldHandle(space, { ...hub, focusOnControl: true })).toBe(null);
  });
  it('ignores modifiers, repeats and keys already handled', () => {
    expect(shouldHandle({ ...space, ctrlKey: true }, hub)).toBe(null);
    expect(shouldHandle({ ...space, metaKey: true }, hub)).toBe(null);
    expect(shouldHandle({ ...esc, altKey: true }, hub)).toBe(null);
    expect(shouldHandle({ ...space, shiftKey: true }, hub)).toBe(null);
    expect(shouldHandle({ ...space, repeat: true }, hub)).toBe(null);
    expect(shouldHandle({ ...esc, repeat: true }, hub)).toBe(null);
    expect(shouldHandle({ ...esc, defaultPrevented: true }, hub)).toBe(null);
    expect(shouldHandle(null, hub)).toBe(null);
  });
});
