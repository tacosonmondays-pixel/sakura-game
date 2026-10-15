// Attack-FX registry, atlas sprites and the co-op hash boundary.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { UNITS } from '../../src/data/units.js';
import { STYLE_BY_UNIT, BEHAVIOR_DEFAULT, resolveStyle, registerStyle, generic } from '../../src/render/attackFx/registry.js';
import { tierLook } from '../../src/render/attackFx/flair.js';
import { ATTACK_SPRITES } from '../../src/render/attackFx/sprites.js';
import { crosspathBlock } from '../../src/sim/mods.js';
import { simId } from '../../tools/simId.mjs';

describe('style registry', () => {
  it('every unit resolves to its own style; style ids are unique', () => {
    for (const u of UNITS) {
      const st = resolveStyle({ unitId: u.id, eff: { behavior: u.base.behavior } });
      expect(st, u.id).toBe(STYLE_BY_UNIT[u.id]);
      expect(st.id).toBe(u.id);
    }
    const ids = Object.values(STYLE_BY_UNIT).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('unknown girls fall back to their behaviour, then to generic; registerStyle plugs in', () => {
    expect(resolveStyle({ unitId: 'newgirl', eff: { behavior: 'turret' } })).toBe(BEHAVIOR_DEFAULT.turret);
    expect(resolveStyle({ unitId: 'newgirl', eff: { behavior: 'mortar' } })).toBe(generic);
    const st = { id: 'newgirl' };
    registerStyle('newgirl', st);
    expect(resolveStyle({ unitId: 'newgirl', eff: { behavior: 'pulse' } })).toBe(st);
    delete STYLE_BY_UNIT.newgirl;
  });

  it('tier looks: every crosspath-legal build has at most one committed path', () => {
    for (let a = 0; a <= 5; a++) {
      for (let b = 0; b <= 5; b++) {
        for (let c = 0; c <= 5; c++) {
          const tiers = [a, b, c];
          // legal if every step toward it is allowed by the sim's crosspath rule
          let legal = true;
          const cur = [0, 0, 0];
          for (const p of [0, 1, 2].sort((x, y) => tiers[y] - tiers[x])) {
            while (cur[p] < tiers[p]) {
              if (crosspathBlock(cur, p, 5)) {
                legal = false;
                break;
              }
              cur[p]++;
            }
          }
          if (!legal) continue;
          const lk = tierLook(tiers);
          expect([-1, 0, 1, 2]).toContain(lk.look);
          expect(tiers.filter((t) => t >= 3).length).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('style files never hard-code upgrade path names (they key on path index + tier)', () => {
    const names = new Set();
    for (const u of UNITS) for (const p of u.paths || []) names.add(p.name);
    const dir = join(process.cwd(), 'src/render/attackFx/styles');
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
      for (const n of names) expect(src.includes(`'${n}'`) || src.includes(`"${n}"`), `${f}: ${n}`).toBe(false);
    }
  });
});

describe('attack sprites', () => {
  it('are [name, w, h, draw] entries that fit in 128 px', () => {
    expect(ATTACK_SPRITES.length).toBeGreaterThan(10);
    const seen = new Set();
    for (const s of ATTACK_SPRITES) {
      const [name, w, h, draw] = s;
      expect(typeof name).toBe('string');
      expect(seen.has(name)).toBe(false);
      seen.add(name);
      expect(Number.isInteger(w) && w > 0 && w <= 128).toBe(true);
      expect(Number.isInteger(h) && h > 0 && h <= 128).toBe(true);
      expect(typeof draw).toBe('function');
    }
  });
});

describe('co-op hash boundary', () => {
  it('no renderer / preview file is part of the sim id graph', () => {
    const { files } = simId();
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      expect(f.startsWith('src/render/'), f).toBe(false);
      expect(f.startsWith('previews/'), f).toBe(false);
    }
  });
});
