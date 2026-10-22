// The map tiers' shown names are our own (Sprout, Blossom, Storm, Oni): the old four copied a reference game's set.
// The keys, colours and saves stay in src/data/types.js MAP_TIERS, which the co-op build id hashes, so the names live
// in src/data/mapTierNames.js and every screen reads them from there.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP_TIERS } from '../../src/data/types.js';
import { MAP_TIER_NAMES, MAP_TIER_VIEW, mapTierName } from '../../src/data/mapTierNames.js';
import { MAPS } from '../../src/data/maps.js';
import { CHAPTERS, STAGES } from '../../src/data/stages.js';
import { simId } from '../../tools/simId.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

describe('map tier names', () => {
  it('Sprout, Blossom, Storm, Oni on the same keys and colours', () => {
    expect(MAP_TIER_NAMES).toEqual({ beginner: 'Sprout', intermediate: 'Blossom', advanced: 'Storm', expert: 'Oni' });
    expect(Object.keys(MAP_TIER_VIEW)).toEqual(Object.keys(MAP_TIERS));
    for (const k of Object.keys(MAP_TIERS)) {
      expect(MAP_TIER_VIEW[k], k).toEqual({ color: MAP_TIERS[k].color, name: MAP_TIER_NAMES[k] });
      expect(mapTierName(k)).toBe(MAP_TIER_NAMES[k]);
    }
    expect(mapTierName('nope')).toBe('nope');
  });

  it('maps, chapters and stages keep their tier keys (nothing in a save or a medal id changes)', () => {
    for (const m of MAPS) expect(MAP_TIER_VIEW[m.tier], m.id).toBeTruthy();
    for (const c of CHAPTERS) expect(MAP_TIER_VIEW[c.tier], String(c.id)).toBeTruthy();
    for (const s of STAGES) if (s.tier) expect(MAP_TIER_VIEW[s.tier], s.id).toBeTruthy();
  });

  it('the names file is outside the co-op build id, and no screen reads the old names', () => {
    expect(simId(ROOT).files).not.toContain('src/data/mapTierNames.js');
    const files = [];
    const walk = (d) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (f.endsWith('.js')) files.push(p);
      }
    };
    walk(join(ROOT, 'src', 'ui'));
    files.push(join(ROOT, 'src', 'data', 'wiki.js'));
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/\bMAP_TIERS\b/);
  });
});
