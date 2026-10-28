// The ability bolt is drawn one way (kit.js boltText → the yellow KIT_SVG bolt), never as the ⚡ character, which is a
// colour emoji that ignores `color` and looks different on every phone: the words the battle and the girl page put
// on screen with a ⚡ marker (the path teaser, the Info chip, the hero track, the hero's unlock toast, the MVP casts)
// come out as text plus bolt icons with no ⚡ left. Small fake DOM (the repo has no DOM library).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { boltText, plainBolt, KIT_SVG } from '../../src/ui/kit.js';
import { pathAbilityTeaser } from '../../src/ui/battle/abilityRow.js';
import { unlockText } from '../../src/ui/battle/abilityBar.js';
import { abilityInfoView } from '../../src/ui/girlView.js';
import { trackDesc, trackSkillLine } from '../../src/ui/battle/heroLevels.js';
import { abilityPathOf } from '../../src/sim/abilities.js';
import { UNIT_MAP } from '../../src/data/units.js';

class FakeNode {}
class FakeEl extends FakeNode {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this.attrs = {};
    this.children = [];
    const cls = new Set();
    this.classList = { add: (c) => cls.add(c), contains: (c) => cls.has(c) };
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  appendChild(c) {
    this.children.push(c);
    return c;
  }
}
const saved = {};
beforeEach(() => {
  for (const k of ['document', 'Node']) saved[k] = globalThis[k];
  globalThis.Node = FakeNode;
  globalThis.document = { createElement: (t) => new FakeEl(t), createTextNode: (t) => ({ textContent: t }) };
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) globalThis[k] = v;
});

const icons = (parts) => parts.filter((p) => typeof p !== 'string');
const words = (parts) => parts.filter((p) => typeof p === 'string').join('');

describe('boltText', () => {
  it('every ⚡ becomes the kit bolt icon; the words stay; nothing else changes', () => {
    const parts = boltText('⚡+ T5 Hawk Eye — upgrades ⚡ Skyfall Volley');
    expect(icons(parts)).toHaveLength(2);
    for (const i of icons(parts)) {
      expect(i.classList.contains('kit-bolt')).toBe(true);
      expect(i.innerHTML).toBe(KIT_SVG.bolt);
      expect(i.attrs['aria-hidden']).toBe('true');
    }
    expect(words(parts)).toBe('+ T5 Hawk Eye — upgrades  Skyfall Volley');
    expect(boltText('no bolt here')).toEqual(['no bolt here']);
    expect(boltText('')).toEqual([]);
    expect(boltText(null)).toEqual([]);
    expect(plainBolt('⚡ T3 Hawk Eye — unlocks Skyfall Volley')).toBe('T3 Hawk Eye — unlocks Skyfall Volley');
    expect(plainBolt('⚡+ Skyfall Volley grows')).toBe('Skyfall Volley grows');
  });

  it('what the screens draw with a ⚡ marker comes out with no ⚡ character left', () => {
    const aoi = UNIT_MAP.aoi;
    const hikari = UNIT_MAP.hikari;
    const marked = [
      pathAbilityTeaser(aoi, abilityPathOf(aoi), 3),
      pathAbilityTeaser(aoi, abilityPathOf(aoi), 5),
      abilityInfoView(aoi).chip,
      abilityInfoView(hikari).chip,
      trackDesc(hikari, 7),
      trackSkillLine(hikari, 7),
      trackSkillLine(hikari, 17),
      unlockText('Hikari', 'Morning Rally', { hero: true }),
      '12.3k dmg · 41% · ⚡ 6',
    ];
    for (const m of marked) {
      expect(m, m).toMatch(/⚡/);
      const parts = boltText(m);
      expect(icons(parts).length, m).toBeGreaterThan(0);
      expect(words(parts), m).not.toMatch(/⚡/);
    }
  });
});
