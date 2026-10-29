// Gate Arc S3a · Brigade barks (src/ui/text/barks.js, src/ui/battle/barks.js): at most six words, no
// wound or body words, the Gnat's lines as STORY §7.3 has them, one chip per side at a time (a
// second bark on a busy side is dropped, never stacked), one spawn bark per group, ≤ 1.6 s.
import { describe, it, expect } from 'vitest';
import { ENEMIES } from '../../src/data/enemies.js';
import { BARKS, BARK_MAX_WORDS, BARK_SECONDS, BRIGADE_LORE, barkFor, barkUnit } from '../../src/ui/text/barks.js';
import { createBarkQueue, createBarkChips, BARK_FONT_PX, GROUP_GAP } from '../../src/ui/battle/barks.js';

const WOUND = /\b(blood\w*|bleed\w*|wound\w*|injur\w*|hurt\w*|dead|death|die[sd]?|dying|kill\w*|body|bodies|corpse\w*|gore)\b/i;

describe('the bark table', () => {
  it('every bark is at most six words and names no wound or body', () => {
    expect(BARK_MAX_WORDS).toBe(6);
    for (const [unit, events] of Object.entries(BARKS)) {
      for (const [event, lines] of Object.entries(events)) {
        expect(lines.length, `${unit}.${event}`).toBeGreaterThan(0);
        for (const line of lines) {
          expect(line.trim().split(/\s+/).length, line).toBeLessThanOrEqual(BARK_MAX_WORDS);
          expect(line, line).not.toMatch(WOUND);
        }
      }
    }
    for (const line of Object.values(BRIGADE_LORE)) expect(line).not.toMatch(WOUND);
  });

  it('the Gnat: "Gnats up!" / "Channel 9, moving up!" on spawn, LINK LOST when beaten', () => {
    expect(BARKS.brigade_gnat.spawn).toEqual(['Gnats up!', 'Channel 9, moving up!']);
    expect(BARKS.brigade_gnat.beaten).toEqual(['LINK LOST']);
    expect(barkFor('brigade_gnat', 'spawn', 0)).toBe('Gnats up!');
    expect(barkFor('brigade_gnat', 'spawn', 1)).toBe('Channel 9, moving up!');
    expect(barkFor('brigade_gnat', 'spawn', 2)).toBe('Gnats up!');
    expect(barkFor('brigade_gnat', 'beaten')).toBe('LINK LOST');
    expect(barkUnit('brigade_gnat_elite')).toBe('brigade_gnat');
    expect(barkFor('goblin_runner', 'spawn')).toBe(null);
    expect(barkUnit('ghost_wisp')).toBe(null);
    expect(BRIGADE_LORE.brigade_gnat).toBe('Watches everything. Understands nothing. Reports both.');
  });

  it('Step 4: the troopers, the Tortoise and the Badger say what STEP4_BUILD_PLAN decision 4 has them say', () => {
    expect(barkFor('brigade_trooper', 'spawn')).toBe('Contact front!');
    expect(barkFor('brigade_trooper', 'beaten')).toBe('Trooper down!');
    expect(barkFor('brigade_shieldline', 'spawn')).toBe('Shields! Form a line!');
    expect(barkFor('brigade_shieldline', 'beaten')).toBe('Close up! Close up!');
    expect(barkFor('brigade_tortoise', 'spawn')).toBe('Tortoise rolling!');
    expect(barkFor('brigade_tortoise', 'beaten')).toBe('Crew out! Crew out!');
    expect(barkFor('brigade_badger', 'spawn')).toBe(null);
    expect(barkFor('brigade_badger', 'beaten')).toBe('Fall back! Fall back!');
    // every Brigade def in the bestiary has its lines and its lore line
    for (const e of ENEMIES.filter((x) => x.family === 'brigade')) {
      expect(BARKS[e.id], e.id).toBeTruthy();
      expect(BRIGADE_LORE[e.id], e.id).toBeTruthy();
    }
  });
});

describe('the bark queue', () => {
  it('one chip per side at a time: a bark for a busy side is dropped; the other side is free', () => {
    const q = createBarkQueue();
    expect(q.push({ side: 'left', text: 'Gnats up!' })).toBe(true);
    expect(q.push({ side: 'left', text: 'LINK LOST' })).toBe(false);
    expect(q.sides.left.text).toBe('Gnats up!');
    expect(q.push({ side: 'right', text: 'LINK LOST' })).toBe(true);
    expect(q.push({ side: 'middle', text: 'x' })).toBe(false);
    // ≤ 1.6 s up, then the side is free again
    expect(BARK_SECONDS).toBeLessThanOrEqual(1.6);
    q.update(BARK_SECONDS - 0.05);
    expect(q.sides.left).not.toBe(null);
    q.update(0.1);
    expect(q.sides.left).toBe(null);
    expect(q.sides.right).toBe(null);
    expect(q.push({ side: 'left', text: 'LINK LOST' })).toBe(true);
  });

  it('a group barks once as it comes on; a beaten unit barks LINK LOST; other enemies never bark', () => {
    const q = createBarkQueue();
    const spawn = (uid) => ({ type: 'spawn', uid, id: 'brigade_gnat', x: 1, y: 2 });
    expect(q.onEvent(spawn(1), 'left')).toBe('Gnats up!');
    q.update(BARK_SECONDS + 0.1);
    // the rest of the group (moments later) stays quiet
    for (let uid = 2; uid <= 5; uid++) {
      q.update(0.1);
      expect(q.onEvent(spawn(uid), 'left')).toBe(null);
    }
    // the next group, later on, gets the next line
    q.update(GROUP_GAP + 0.1);
    expect(q.onEvent(spawn(6), 'right')).toBe('Channel 9, moving up!');
    expect(q.onEvent({ type: 'death', uid: 2, id: 'brigade_gnat', x: 3, y: 2 }, 'left')).toBe('LINK LOST');
    expect(q.sides.left.uid).toBe(null);
    expect(q.onEvent({ type: 'spawn', uid: 9, id: 'goblin_runner', x: 0, y: 0 }, 'left')).toBe(null);
    expect(q.onEvent({ type: 'hit', uid: 9, id: 'brigade_gnat' }, 'left')).toBe(null);
  });

  it('the chips: two reusable elements, readable on a phone (≥ 12 px), shown and hidden as the queue says', () => {
    expect(BARK_FONT_PX).toBeGreaterThanOrEqual(12);
    const made = [];
    const el = () => {
      const e = { style: {}, dataset: {}, textContent: '', setAttribute() {}, remove() { e.removed = true; } };
      made.push(e);
      return e;
    };
    const layer = { children: [], appendChild(c) { this.children.push(c); } };
    const chips = createBarkChips(layer, { document: { createElement: el } });
    expect(layer.children).toHaveLength(2);
    const fontPx = Number(/(\d+)px/.exec(chips.els.left.style.cssText)[1]);
    expect(fontPx).toBeGreaterThanOrEqual(BARK_FONT_PX);
    const q = createBarkQueue();
    q.push({ side: 'right', text: 'LINK LOST', x: 2, z: 3 });
    chips.draw(q, () => ({ x: 120, y: 80 }));
    expect(chips.els.right.textContent).toBe('LINK LOST');
    expect(chips.els.right.style.display).toBe('block');
    expect(chips.els.right.style.left).toBe('120px');
    q.update(BARK_SECONDS + 0.01);
    chips.draw(q, () => ({ x: 120, y: 80 }));
    expect(chips.els.right.style.display).toBe('none');
    chips.draw(q, () => ({ x: 1, y: 1 }));
    expect(made).toHaveLength(2);
    chips.dispose();
    expect(made.every((m) => m.removed)).toBe(true);
  });
});
