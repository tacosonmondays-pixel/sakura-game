// The map tiers' shown names are our own (Sprout, Bud, Storm, Oni): the old four copied a reference game's set.
// The keys, colours and saves stay in src/data/types.js MAP_TIERS, which the co-op build id hashes, so the names live
// in src/data/mapTierNames.js and every screen reads them from there. "Blossom" was the first pick for the second
// tier, but it is already a Freeplay tier's name, and both show on the stage prep and the Endless list.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP_TIERS, DIFFICULTIES } from '../../src/data/types.js';
import { MAP_TIER_NAMES, MAP_TIER_TEXT, MAP_TIER_VIEW, mapTierName } from '../../src/data/mapTierNames.js';
import { FREEPLAY } from '../../src/data/freeplay.js';
import { MAPS } from '../../src/data/maps.js';
import { CHAPTERS, STAGES } from '../../src/data/stages.js';
import { simId } from '../../tools/simId.mjs';
import { contrastTable } from '../../tools/contrast.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

describe('map tier names', () => {
  it('Sprout, Bud, Storm, Oni on the same keys and fill colours, plus a text colour each', () => {
    expect(MAP_TIER_NAMES).toEqual({ beginner: 'Sprout', intermediate: 'Bud', advanced: 'Storm', expert: 'Oni' });
    expect(Object.keys(MAP_TIER_VIEW)).toEqual(Object.keys(MAP_TIERS));
    for (const k of Object.keys(MAP_TIERS)) {
      expect(MAP_TIER_VIEW[k], k).toEqual({ color: MAP_TIERS[k].color, name: MAP_TIER_NAMES[k], text: MAP_TIER_TEXT[k] });
      expect(mapTierName(k)).toBe(MAP_TIER_NAMES[k]);
    }
    expect(mapTierName('nope')).toBe('nope');
  });

  it('no shown tier name is also a Freeplay tier or a difficulty (one word, one meaning on the same screen)', () => {
    const others = [...Object.values(FREEPLAY).map((t) => t.name), ...Object.values(DIFFICULTIES).map((d) => d.name)];
    expect(others.length).toBeGreaterThanOrEqual(7);
    expect(others).toContain('Blossom');
    const lower = new Set(others.map((s) => s.toLowerCase()));
    for (const name of Object.values(MAP_TIER_NAMES)) expect(lower.has(name.toLowerCase()), name).toBe(false);
    expect(new Set(Object.values(MAP_TIER_NAMES).map((s) => s.toLowerCase())).size).toBe(4);
  });

  it('tier words pass 4.5:1 on white and the sky; badge letters (navy) pass on every tier fill', () => {
    const rows = contrastTable().filter((r) => /tier/i.test(r.where));
    // 4 tiers × (white card, sky, badge fill)
    expect(rows.length).toBeGreaterThanOrEqual(12);
    for (const k of Object.keys(MAP_TIERS)) {
      expect(rows.some((r) => r.text === MAP_TIER_TEXT[k]), k).toBe(true);
      expect(rows.some((r) => r.bg === MAP_TIERS[k].color), k).toBe(true);
    }
    expect(rows.filter((r) => !r.ok).map((r) => `${r.text} on ${r.bg}: ${r.ratio}`)).toEqual([]);
  });

  it('screens colour tier words with the text colour and keep the fill colour for fills', () => {
    const campaign = readFileSync(join(ROOT, 'src', 'ui', 'screens', 'campaign.js'), 'utf8');
    expect(campaign).toMatch(/h\('div\.ma-tier-label', \{ style: \{ color: MAP_TIER_VIEW\[tier\]\.text \} \}/);
    expect(campaign).toMatch(/h\('span\.ma-sc-tier', \{ style: \{ color: tier\.text \} \}/);
    expect(campaign).not.toMatch(/style: \{ color: (MAP_TIER_VIEW\[tier\]|tier)\.color \}/);
    const wiki = readFileSync(join(ROOT, 'src', 'data', 'wiki.js'), 'utf8');
    expect(wiki).not.toMatch(/color: MAP_TIER_VIEW\.\w+\.color/);
    const css = readFileSync(join(ROOT, 'src', 'ui', 'styles', 'meta-a.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/\.ma-tier-badge\s*\{[^}]*color:\s*var\(--plate\)/);
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
