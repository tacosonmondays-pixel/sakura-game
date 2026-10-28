// Map rules data (docs/specs/CODEX_MODES.md §3, §5.2, §10): placement, vocabulary, geometry.
import { describe, it, expect } from 'vitest';
import { MAP_RULES, STAGE_RULES, stageRule } from '../../src/data/rules.js';
import { RULE_TEXT } from '../../src/ui/text/rules.js';
import { GLYPHS } from '../../src/art/icons/glyphs.js';
import { STAGES, STAGE_MAP, CAMPAIGN_IDS, getStage } from '../../src/data/stages.js';
import { getMap } from '../../src/data/maps.js';
import { getUnit } from '../../src/data/units.js';
import { FAMILIES } from '../../src/data/enemies.js';
import { ATTACK_TYPES, ARMOR_CLASSES, ELEMENTS } from '../../src/data/types.js';
import { buildPaths, samplePath, pathElevation, pathUnderDeck, pathInTunnel } from '../../src/sim/path.js';
import { createPlacementRules } from '../../src/sim/placement.js';

const VOCAB = new Set(['dmgMul', 'typeMul', 'elementMul', 'enemySpeed', 'familySpeed', 'classSpeed', 'rangeMul', 'rangeAdd',
  'bountyAdd', 'livesPerWave', 'bonusEvery', 'zoneDps', 'padDmgMul', 'padRangeAdd', 'reverseEvenWaves', 'affinity', 'affinityMul', 'portals']);

describe('map rule placement', () => {
  it('one rule on every campaign stage from 1-4 and on every side stage (Gate Arc Step 6), none elsewhere', () => {
    const ruled = (st) => (st.kind === 'campaign' && !['1-1', '1-2', '1-3'].includes(st.id)) || st.kind === 'side';
    for (const id of Object.keys(STAGE_RULES)) expect(['campaign', 'side'], id).toContain(STAGE_MAP[id]?.kind);
    for (const s of STAGES) {
      if (!ruled(s)) expect(s.rule ?? null, s.id).toBeNull();
      else expect(s.rule?.id, s.id).toBe(STAGE_RULES[s.id].id);
    }
    const sides = STAGES.filter((s) => s.kind === 'side').length;
    expect(sides).toBe(1);
    expect(Object.keys(STAGE_RULES).length).toBe(CAMPAIGN_IDS.length - 3 + sides);
  });

  it('uses all 15 rules, each with text and a glyph', () => {
    const used = new Set(Object.values(STAGE_RULES).map((r) => r.id));
    expect(used.size).toBe(15);
    expect(Object.keys(MAP_RULES).length).toBe(15);
    for (const id of Object.keys(MAP_RULES)) {
      expect(used.has(id), id).toBe(true);
      const t = RULE_TEXT[id];
      expect(t?.name && t.desc && t.short, id).toBeTruthy();
      expect(GLYPHS[t.icon], t.icon).toBeTruthy();
    }
    expect(STAGE_RULES['7-2'].id).toBe('rear_ambush');
    expect(STAGE_RULES['7-3'].id).toBe('moonlit_blessing');
  });
});

describe('map rule vocabulary', () => {
  const ids = new Set([...Object.keys(ATTACK_TYPES), ...Object.keys(ELEMENTS)]);
  it('uses only the effect vocabulary, game ids and no display text', () => {
    for (const r of Object.values(MAP_RULES)) {
      expect(['combat', 'off']).toContain(r.pastGoal);
      for (const eff of [r.active, r.always]) {
        for (const [k, v] of Object.entries(eff)) {
          expect(VOCAB.has(k), `${r.id}.${k}`).toBe(true);
          if (k === 'typeMul') for (const t of Object.keys(v)) expect(ATTACK_TYPES[t], t).toBeTruthy();
          if (k === 'elementMul') for (const t of Object.keys(v)) expect(ELEMENTS[t], t).toBeTruthy();
          if (k === 'familySpeed') for (const t of Object.keys(v)) expect(FAMILIES[t] ?? null, t).not.toBeNull();
          if (k === 'classSpeed') for (const t of Object.keys(v)) expect(ARMOR_CLASSES[t], t).toBeTruthy();
          if (k === 'affinity') for (const t of v) expect(ids.has(t), t).toBe(true);
          if (typeof v === 'string') throw new Error(`string effect ${r.id}.${k}`);
        }
      }
      if (r.cycle) {
        const [p, a] = r.cycle;
        expect(a > 0 && a < p).toBe(true);
        expect(Number.isInteger(p * 60) && Number.isInteger(a * 60)).toBe(true);
      }
    }
  });
});

describe('vents and pads geometry', () => {
  it('vents sit on flat road (no deck, under-deck or tunnel sample inside), away from the edge', () => {
    for (const [sid, s] of Object.entries(STAGE_RULES)) {
      if (!s.zones) continue;
      const map = getMap(getStage(sid).mapId);
      const paths = buildPaths(map);
      for (const z of s.zones) {
        expect(z.x - z.r >= -0.5 && z.y - z.r >= -0.5 && z.x + z.r <= map.width + 0.5 && z.y + z.r <= map.height + 0.5, `${sid} edge`).toBe(true);
        let near = Infinity;
        for (const p of paths) {
          for (const smp of samplePath(p, 0.1)) {
            const d = Math.hypot(smp.x - z.x, smp.y - z.y);
            near = Math.min(near, d);
            if (d <= z.r) {
              expect(pathElevation(p, smp.d), `${sid} elevated at ${smp.d}`).toBeLessThan(0.05);
              expect(pathUnderDeck(p, smp.d), `${sid} under deck`).toBe(false);
              expect(pathInTunnel(p, smp.d), `${sid} tunnel`).toBe(false);
            }
          }
        }
        expect(near, `${sid} vent near road`).toBeLessThanOrEqual(0.6);
      }
    }
  });

  it('pads are placeable land at least 5 tiles apart', () => {
    const aoi = getUnit('aoi');
    for (const [sid, s] of Object.entries(STAGE_RULES)) {
      if (!s.pads) continue;
      const map = getMap(getStage(sid).mapId);
      const rules = createPlacementRules(map, buildPaths(map));
      for (const p of s.pads) expect(rules.check(aoi, p.x, p.y, []), `${sid} pad ${p.x},${p.y}`).toBeNull();
      for (let i = 0; i < s.pads.length; i++) for (let j = i + 1; j < s.pads.length; j++) {
        expect(Math.hypot(s.pads[i].x - s.pads[j].x, s.pads[i].y - s.pads[j].y)).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('stageRule merges the rule and its geometry', () => {
    expect(stageRule('6-3').zones.length).toBe(1);
    expect(stageRule('6-1').pads.length).toBe(3);
    expect(stageRule('1-1')).toBeNull();
  });
});
