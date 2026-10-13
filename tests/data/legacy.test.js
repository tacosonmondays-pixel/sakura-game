import { describe, it, expect } from 'vitest';
import { LEGACY, LEGACY_IDS, legacyKit } from '../../src/data/legacy.js';
import { UNIT_MAP } from '../../src/data/units.js';

// ROSTER_SPEC §4.4b: the 19 girls shared with the old Codex game carry their Codex kit identity.
const SHARED = [
  'hikari', 'luna', 'nami', 'aoi', 'rei', 'yuki', 'momo', 'akane', 'sango', 'kage', 'umeko', 'shiro', 'midori',
  'suzu', 'raika', 'miko', 'hotaru', 'kaede', 'chika',
];

describe('Codex (legacy) kits', () => {
  it('all 19 shared ids have one, and nobody else', () => {
    expect([...LEGACY_IDS].sort()).toEqual([...SHARED].sort());
  });

  it.each(SHARED)('%s has a title, a trait line and her old upgrades', (id) => {
    const k = legacyKit(id);
    expect(k).toBeTruthy();
    expect(Object.keys(k).sort()).toEqual(['paths', 'title', 'trait', 'upgrades']);
    expect(k.title.length).toBeGreaterThan(3);
    expect(k.trait.length).toBeGreaterThan(8);
    expect(k.trait.length).toBeLessThanOrEqual(64);
    const u = UNIT_MAP[id];
    if (u.kind === 'hero') {
      // Codex heroes levelled automatically and had no upgrades; their path names stay
      expect(k.upgrades).toEqual([]);
      expect(k.paths).toEqual({});
    } else {
      expect(k.upgrades).toHaveLength(3);
      expect(new Set(k.upgrades).size).toBe(3);
    }
  });

  it.each(SHARED.filter((id) => UNIT_MAP[id].kind === 'tower'))('%s: her three paths carry the three Codex upgrade names', (id) => {
    const u = UNIT_MAP[id];
    const k = LEGACY[id];
    expect(Object.keys(k.paths).sort()).toEqual(u.paths.map((p) => p.id).sort());
    expect(Object.values(k.paths).sort()).toEqual([...k.upgrades].sort());
    for (const p of u.paths) expect(p.name, `${id}.${p.id}`).toBe(k.paths[p.id]);
  });

  it('titles are the Codex titles (Hikari keeps "Dawnblade Captain", which contains hers)', () => {
    for (const id of SHARED) {
      if (id === 'hikari') expect(UNIT_MAP[id].title).toContain(LEGACY[id].title);
      else expect(UNIT_MAP[id].title, id).toBe(LEGACY[id].title);
    }
  });

  it('girls who were land + water in the Codex are amphibious again', () => {
    for (const id of SHARED) {
      const wasAmphibious = /land \+ water/i.test(LEGACY[id].trait);
      expect(UNIT_MAP[id].placement === 'amphibious', id).toBe(wasAmphibious);
    }
  });

  it('newcomers have no Codex kit', () => {
    expect(legacyKit('nobody')).toBeNull();
  });
});
