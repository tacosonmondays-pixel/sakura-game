// The Journal pill steps aside for every layer over the page (src/ui/story/pillHold.js, toast.js, journal.css): the
// hold list names the real root class of each overlay the game makes, a closing modal or sheet stops counting, the
// clock only runs while the pill shows, and a held pill keeps no room in the other toasts' offsets.
// (e2e/journal-pill.mjs drives the same in the browser at 844x390, 390x844 and 1280x720.)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PILL_HOLD_LAYERS, PILL_HOLD_SELECTOR, RESUME_MIN_MS, pillClock } from '../../src/ui/story/pillHold.js';
import { TOAST_MS } from '../../src/ui/story/toast.js';

const read = (f) => readFileSync(f, 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('the pill hold list', () => {
  it('names the root of every layer the game puts over the page', () => {
    // [the file that makes the layer, the root it makes, the hold entry]
    const roots = [
      ['src/ui/components.js', "h('div.modal-overlay'", '.modal-overlay:not(.closing)'],
      ['src/ui/unitSheet.js', "h('div.modal-overlay.us-overlay", '.modal-overlay:not(.closing)'],
      ['src/ui/sheet.js', "h('div.ui-layer'", '.ui-layer:not(.closing)'],
      ['src/ui/screens/profile.js', "h('div.pf-preview.ui-layer'", '.ui-layer:not(.closing)'],
      ['src/ui/lobby/menuSheet.js', "h('div.home-menu-layer'", '.home-menu-layer:not(.closing)'],
      ['src/ui/screens/recruit.js', 'h(`div.ma-gacha', '.ma-gacha'],
      ['src/ui/screens/bestiary.js', "h('div.mb-sheet-overlay'", '.mb-sheet-overlay'],
      ['src/ui/online/chatPanel.js', "h('div.ol-drawer-overlay'", '.ol-drawer-overlay'],
      ['src/ui/online/stickers.js', 'h(`div.stk-pick-overlay', '.stk-pick-overlay'],
      ['src/ui/story/player.js', 'h(`div.sp${', '.sp'],
      ['src/ui/orientation.js', "'div.rotate-overlay'", '.rotate-overlay:not([hidden])'],
    ];
    for (const [file, made, entry] of roots) {
      expect(read(file), `${file} still makes ${made}`).toContain(made);
      expect(PILL_HOLD_LAYERS, `the hold list has ${entry}`).toContain(entry);
    }
    expect(read('src/ui/screens/achievements/fanfare.js')).toContain("h('div.ach-fanfare'");
    expect(PILL_HOLD_LAYERS).toContain('.ach-fanfare');
    // the Notice, the mailbox / gift letters, the beta gift and the SSR Select Ticket picker are modals
    expect(read('src/ui/lobby/notice.js')).toMatch(/m = modal\(\{ title: 'Notice'/);
    expect(read('src/ui/lobby/mailbox.js')).toMatch(/modal\(\{/);
  });

  it('a modal, a sheet or the Menu that is closing (taps already go through) no longer holds it', () => {
    for (const cls of ['modal-overlay', 'ui-layer', 'home-menu-layer']) {
      expect(PILL_HOLD_SELECTOR).toContain(`.${cls}:not(.closing)`);
    }
    expect(stripComments(read('src/ui/styles/base.css'))).toMatch(/\.modal-overlay\.closing \{[^}]*pointer-events: none/);
    expect(stripComments(read('src/ui/styles/components.css'))).toMatch(/\.ui-layer\.closing \{[^}]*pointer-events: none/);
    expect(stripComments(read('src/ui/styles/home.css'))).toMatch(/\.home-menu-layer\.closing \{[^}]*pointer-events: none/);
  });

  it('is one valid selector list', () => {
    expect(PILL_HOLD_SELECTOR.split(', ')).toEqual(PILL_HOLD_LAYERS);
    expect(new Set(PILL_HOLD_LAYERS).size).toBe(PILL_HOLD_LAYERS.length);
  });
});

describe('the pill clock', () => {
  it('runs only while the pill shows', () => {
    const c = pillClock(TOAST_MS, 0);
    expect(c.left(1000)).toBe(TOAST_MS - 1000);
    c.hold(1000);
    expect(c.held).toBe(true);
    expect(c.left(60000)).toBe(TOAST_MS - 1000); // a minute under a modal costs nothing
    expect(c.release(60000)).toBe(TOAST_MS - 1000);
    expect(c.held).toBe(false);
  });

  it('held from the start, it gets its whole time once the layer closes', () => {
    const c = pillClock(TOAST_MS, 0);
    c.hold(0);
    expect(c.release(9000)).toBe(TOAST_MS);
  });

  it('a pill that was nearly done comes back for at least RESUME_MIN_MS, never a blink', () => {
    const c = pillClock(TOAST_MS, 0);
    c.hold(TOAST_MS - 100);
    expect(c.release(TOAST_MS + 5000)).toBe(RESUME_MIN_MS);
  });

  it('a second hold or release changes nothing', () => {
    const c = pillClock(TOAST_MS, 0);
    c.hold(500);
    c.hold(2000);
    expect(c.left(9000)).toBe(TOAST_MS - 500);
    expect(c.release(9000)).toBe(TOAST_MS - 500);
    expect(c.release(9500)).toBe(TOAST_MS - 500);
  });
});

describe('the held pill in toast.js and journal.css', () => {
  const css = stripComments(read('src/ui/styles/journal.css'));
  const js = read('src/ui/story/toast.js');

  it('held: not visible and no pointer events', () => {
    expect(css).toMatch(/\.jn-toast\.held \{ visibility: hidden; pointer-events: none; \}/);
  });

  it('the other toasts move down only for a pill that shows (no gap under a held one)', () => {
    const offsets = css.match(/[^}]*\.toast-host \{[^}]*\}/g) || [];
    expect(offsets.length).toBe(3);
    for (const rule of offsets) expect(rule).toContain('.jn-toast:not(.out):not(.held)');
  });

  it('toast.js holds the pill on the shared list, watches <body> for layers and drops a held pill on battle, title, scene or the Journal', () => {
    expect(js).toContain("import { PILL_HOLD_SELECTOR, pillClock } from './pillHold.js'");
    expect(js).toMatch(/document\.querySelector\(PILL_HOLD_SELECTOR\)/);
    expect(js).toMatch(/observe\(document\.body, \{ childList: true, subtree: true, attributes: true, attributeFilter: \['class', 'hidden'\] \}\)/);
    expect(js).toMatch(/new Set\(\['battle', 'title', 'scene', 'journal'\]\)/);
  });

  it('a held pill waits out a modal\'s fade before it comes back, so close-then-open never flashes it', async () => {
    const { RELEASE_GRACE_MS } = await import('../../src/ui/story/toast.js');
    const fade = Number(read('src/ui/components.js').match(/setTimeout\(\(\) => overlay\.remove\(\), (\d+)\)/)?.[1]);
    expect(fade).toBeGreaterThan(0);
    expect(RELEASE_GRACE_MS).toBeGreaterThanOrEqual(fade);
    expect(RELEASE_GRACE_MS).toBeLessThan(RESUME_MIN_MS / 4); // still back as the modal leaves
    expect(js).toMatch(/setTimeout\(release, RELEASE_GRACE_MS\)/);
  });

  it('a showing pill never follows the player into battle, the title, a scene or the Journal', () => {
    expect(js).toMatch(/if \(DROP_ON\.has\(currentRoute\(\)\.name\)\) return drop\(\);/);
  });
});
