// The Pumpkin Patroller title (Halloween 2026 Candy Exchange) on its plate: in v0.1.38 every profile title plate
// (the Edit Profile picker, its live preview, the plate under the name, Preview and a visitor's view) read "✦ —" on
// the Standard plate for it, because src/ui/honorFx.js titlePlate reads the name and plate from honors' TITLE_MAP,
// which has no event titles. src/ui/profile/parts.js titlePlate now passes them from the profile's own table
// (src/data/profileArt.js TITLES). Runs on a small fake DOM (the repo has no DOM library), like honorFx.test.js.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TITLES } from '../../src/data/profileArt.js';
import { TITLE_MAP } from '../../src/data/honors.js';

class FakeNode {}
class FakeText extends FakeNode {
  constructor(t) { super(); this.textContent = t; }
}
class FakeEl extends FakeNode {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this.className = '';
    this.dataset = {};
    this.children = [];
    this.attrs = {};
    this.textContent = '';
  }
  get classList() {
    return {
      add: (...c) => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...c])].join(' '); },
      remove: (c) => { this.className = this.className.split(' ').filter((x) => x !== c).join(' '); },
      contains: (c) => this.className.split(' ').includes(c),
      toggle: () => {},
    };
  }
  appendChild(c) { this.children.push(c); return c; }
  append(...c) { this.children.push(...c); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener() {}
  get text() { return [this.textContent, ...this.children.map((c) => c.text ?? c.textContent ?? '')].join(''); }
}

const saved = {};
let parts;
beforeAll(async () => {
  for (const k of ['document', 'matchMedia', 'Node']) saved[k] = globalThis[k];
  globalThis.Node = FakeNode;
  globalThis.document = {
    createElement: (t) => new FakeEl(t),
    createTextNode: (t) => new FakeText(t),
    documentElement: { hasAttribute: () => false },
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  globalThis.matchMedia = () => ({ matches: false });
  parts = await import('../../src/ui/profile/parts.js');
});
afterAll(() => {
  for (const [k, v] of Object.entries(saved)) globalThis[k] = v;
});

describe('the event title on its plate', () => {
  it('Pumpkin Patroller reads its name on the Gold plate (it is not in honors\' TITLE_MAP, only in the profile table)', () => {
    expect(TITLE_MAP.ev_halloween_2026).toBeUndefined();
    expect(TITLES.ev_halloween_2026).toMatchObject({ text: 'Pumpkin Patroller', tier: 'gold', event: true });
    for (const opts of [{}, { still: true }, { still: true, small: true }, { still: true, locked: true }]) {
      const el = parts.titlePlate('ev_halloween_2026', opts);
      expect(el.classList.contains('tp-gold'), JSON.stringify(opts)).toBe(true);
      expect(el.classList.contains('tp-standard')).toBe(false);
      expect(el.text).toBe('★ Pumpkin Patroller');
      expect(el.attrs['aria-label']).toBe('Title: Pumpkin Patroller');
      expect(el.dataset).toMatchObject({ title: 'ev_halloween_2026', testid: 'profile-title' });
      expect(el.classList.contains('pf-title')).toBe(true);
    }
  });

  it('achievement, freeplay and tag titles look exactly as before (the name and plate of honors\' table)', () => {
    const PLATE = { std: 'standard', gold: 'gold', prism: 'prism' };
    const GLYPH = { standard: '✦', gold: '★', prism: '✦' };
    const ids = Object.keys(TITLES).filter((id) => !TITLES[id].event);
    expect(ids.length).toBeGreaterThan(30);
    for (const id of ids) {
      const el = parts.titlePlate(id, { still: true });
      const t = TITLE_MAP[id];
      expect(PLATE[TITLES[id].tier], id).toBe(t.plate);
      expect(el.classList.contains(`tp-${t.plate}`), id).toBe(true);
      expect(el.text, id).toBe(`${GLYPH[t.plate]} ${t.name}`);
    }
  });

  it('a title this build doesn\'t know still reads "—" on the Standard plate', () => {
    const el = parts.titlePlate('a_from_a_newer_build', { still: true });
    expect(el.text).toBe('✦ —');
    expect(el.classList.contains('tp-standard')).toBe(true);
    expect(parts.titlePlate(null)).toBe(null);
  });

  it('the title chip (Freeplay Records, lists) names it too', () => {
    const chip = parts.titleChip('ev_halloween_2026');
    expect(chip.text).toContain('Pumpkin Patroller');
    expect(chip.className).toContain('tier-gold');
  });
});
