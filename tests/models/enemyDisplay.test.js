// Enemies v2 display rules (src/models/enemyDisplay.js): the size table per family and tier, the lighter
// darkest elites and bosses, the palette lift, the look switch, and the tint roles of the rebuilt goblin
// family file. Display only: nothing here may touch the sim (EnemyDef.size also sets the hit radius).
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENEMIES, FAMILY_ORDER } from '../../src/data/enemies.js';
import {
  FAMILY_BOOST, TIER_BOOST_SHARE, SCALE_OVERRIDE, displayScale, displayColors, DARK_LIFT, liftLinear, hexToLinear,
  linearToOklab, PALETTE_LIFT, setEnemyDisplayOptions, enemyLook,
} from '../../src/models/enemyDisplay.js';
import { simId } from '../../tools/simId.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');

/**
 * Battle-size silhouette heights in px at display scale 1: the 1280x720 default zoom on 1-1 (61.8 px per
 * tile), the 48 deg camera, standing, turned 0.35 rad, battle scales from actors.js. Measured with
 * previews/enemies-v2.html?view=heights (window.__heights, `px1`); re-measure when a family file changes.
 */
const HIKARI_PX = 93;
const MEASURED_PX = {
  slime_green: 33, slime_droplet: 28, slime_gold: 33, slime_pearl: 34, slime_prism: 46, slime_violet: 33, slime_iron: 37, slime_rose: 34,
  slime_crystal: 35, slime_ember: 34, slime_mimic: 56, slime_glimmer: 28, slime_bubble: 49, slime_courtier: 57, slime_prince: 117,
  goblin_runner: 31, goblin_dasher: 32, goblin_smoke: 36, goblin_sapper: 33, goblin_bomber: 33, goblin_glider: 33, goblin_chief: 51, goblin_machine: 141,
  orc_grunt: 42, orc_ironhide: 44, orc_shieldbearer: 46, orc_berserker: 42, orc_warlord: 57, orc_general: 101,
  ghost_wisp: 25, ghost_veilwraith: 44, ghost_phantom: 35, ghost_lanternbearer: 60, ghost_hollowknight: 53,
  ghoul_bonewalker: 30, ghoul_shambler: 39, ghoul_leech: 38, ghoul_skulker: 41, ghoul_gravepriest: 60, grave_lych: 127,
  oni_brute: 48, oni_haste: 46, oni_shield: 46, oni_bloom: 46, oni_taiko: 62, oni_champion: 110,
  lizard_skink: 32, lizard_hunter: 40, lizard_sunscale: 43, lizard_basilisk: 60,
  construct_cogling: 30, construct_shellback: 43, construct_aegis: 43, construct_sentry: 45, construct_warden: 60, iron_colossus: 144,
  beast_wolf: 63, beast_boar: 70, beast_bear: 96, beast_alpha: 96,
  fae_sprite: 23, fae_mirage: 26, fae_illusionist: 34, fae_sylph: 30, fae_queen: 47,
  plant_sprout: 17, plant_seedpod: 29, plant_thornroot: 35, plant_mossling: 25, plant_treant: 63,
  dragon_wyvern: 93, dragon_ashdrake: 102, dragon_cinder: 123, dragon_ashwing: 255,
  fp_foundry_titan: 178, fp_gloom_regent: 154, fp_hyakki_daimyo: 145, fp_eclipse_wyrm: 340,
};
const FODDER = ['slime', 'goblin', 'ghost', 'ghoul', 'fae', 'plant', 'construct'];
const BRUTES = ['orc', 'oni'];
const shown = (def) => MEASURED_PX[def.id] * displayScale(def);
const hueDeg = ([, a, b]) => (Math.atan2(b, a) * 180) / Math.PI;

describe('enemy display scale (display only)', () => {
  it('gives every family a boost; lizardfolk, dragons and beasts stay as they are', () => {
    expect(Object.keys(FAMILY_BOOST).sort()).toEqual([...FAMILY_ORDER].sort());
    for (const b of Object.values(FAMILY_BOOST)) {
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(1.4);
    }
    for (const fam of ['lizard', 'dragon', 'beast']) expect(FAMILY_BOOST[fam]).toBe(1);
    expect(FAMILY_BOOST.goblin).toBe(1.35);
  });

  it('normals get the family boost, elites half of it, minibosses and bosses none', () => {
    expect(TIER_BOOST_SHARE).toEqual({ normal: 1, elite: 0.5, miniboss: 0, boss: 0 });
    for (const def of ENEMIES) {
      const b = FAMILY_BOOST[def.model.base];
      const want = SCALE_OVERRIDE[def.id] ?? { normal: b, elite: 1 + (b - 1) / 2, miniboss: 1, boss: 1 }[def.tier];
      expect(displayScale(def), def.id).toBeCloseTo(want, 6);
    }
    expect(displayScale(ENEMIES.find((e) => e.id === 'goblin_runner'))).toBe(1.35);
    expect(displayScale(ENEMIES.find((e) => e.id === 'goblin_chief'))).toBeCloseTo(1.175, 6);
    expect(displayScale(ENEMIES.find((e) => e.id === 'goblin_machine'))).toBe(1);
  });

  it('has a measured height for every enemy (a new enemy or family file means re-measuring)', () => {
    expect(Object.keys(MEASURED_PX).sort()).toEqual(ENEMIES.map((e) => e.id).sort());
  });

  it('keeps every normal under its family elites, minibosses and bosses', () => {
    for (const fam of FAMILY_ORDER) {
      const defs = ENEMIES.filter((e) => e.model.base === fam);
      const normals = defs.filter((e) => e.tier === 'normal');
      const bigs = defs.filter((e) => e.tier !== 'normal');
      if (!normals.length || !bigs.length) continue;
      const tallest = Math.max(...normals.map(shown));
      // a family drawn bigger keeps its bosses strictly on top; an unchanged one stays as it is (the alpha
      // wolf and the moss bear are the same height today)
      for (const b of bigs) {
        if (FAMILY_BOOST[fam] > 1) expect(shown(b), `${b.id} over the ${fam} normals`).toBeGreaterThan(tallest);
        else expect(shown(b), `${b.id} with the ${fam} normals`).toBeGreaterThanOrEqual(tallest);
      }
    }
  });

  it('lets nothing that is drawn bigger outgrow Hikari', () => {
    for (const def of ENEMIES) {
      if (displayScale(def) <= 1) continue;
      expect(shown(def), def.id).toBeLessThan(HIKARI_PX);
    }
  });

  it('keeps the fodder-to-brute order (each family by its first normal enemy)', () => {
    const first = (fam) => ENEMIES.find((e) => e.model.base === fam && e.tier === 'normal');
    const fodder = Math.max(...FODDER.map((f) => shown(first(f))));
    const brutes = Math.min(...BRUTES.map((f) => shown(first(f))));
    expect(fodder).toBeLessThan(brutes);
  });

  it('leaves EnemyDef.size and the sim alone', () => {
    // the hit radius is 0.3 + 0.06 × size in the sim: sizes are data, the display scale is not
    expect(simId(root).id).toBe('92e2e22527cf');
    expect(simId(root).files.some((f) => f.includes('models/'))).toBe(false);
  });
});

describe('enemy display colours', () => {
  it('lifts exactly the 8 darkest elites and bosses, keeps their old colour as the dark line', () => {
    expect(Object.keys(DARK_LIFT).sort()).toEqual([
      'beast_alpha', 'dragon_ashwing', 'fp_eclipse_wyrm', 'fp_foundry_titan', 'fp_gloom_regent', 'fp_hyakki_daimyo', 'grave_lych', 'orc_general',
    ]);
    for (const def of ENEMIES) {
      const c = displayColors(def);
      expect(c.accent, def.id).toBe(def.accent || def.color);
      expect(c.line, def.id).toBe(def.color);
      if (!DARK_LIFT[def.id]) {
        expect(c.color, def.id).toBe(def.color);
        continue;
      }
      expect(def.tier).not.toBe('normal');
      const before = linearToOklab(hexToLinear(def.color));
      const after = linearToOklab(hexToLinear(c.color));
      expect(after[0], def.id).toBeCloseTo(0.47, 1);
      expect(after[0]).toBeGreaterThan(before[0] + 0.1);
      expect(Math.abs(hueDeg(after) - hueDeg(before)), `${def.id} keeps its hue`).toBeLessThan(6);
    }
  });

  it('leaves no elite, miniboss or boss as a near-black blob', () => {
    for (const def of ENEMIES.filter((e) => e.tier !== 'normal')) {
      expect(linearToOklab(hexToLinear(displayColors(def).color))[0], def.id).toBeGreaterThan(0.32);
    }
  });

  it('lifts the palette a little: OKLab L + 0.04 (half on accents), the hue unchanged', () => {
    for (const hex of ['#a3c43a', '#6b4226', '#7bd389', '#bc4749']) {
      const a = linearToOklab(hexToLinear(hex));
      const b = linearToOklab(liftLinear(hex));
      const c = linearToOklab(liftLinear(hex, PALETTE_LIFT.accentShare));
      expect(b[0] - a[0]).toBeCloseTo(PALETTE_LIFT.L, 2);
      expect(c[0] - a[0]).toBeCloseTo(PALETTE_LIFT.L / 2, 2);
      expect(Math.abs(hueDeg(b) - hueDeg(a))).toBeLessThan(1);
    }
  });
});

describe('enemy look switch', () => {
  afterEach(() => setEnemyDisplayOptions({ look: 'cel', reduceMotion: false }));

  it('follows the girls\' Figure look: clean cel unless the setting says glossy', () => {
    expect(enemyLook()).toBe('cel');
    setEnemyDisplayOptions({ figureLook: 'glossy' });
    expect(enemyLook()).toBe('glossy');
    setEnemyDisplayOptions({ figureLook: 'something else' });
    expect(enemyLook()).toBe('glossy');
    setEnemyDisplayOptions({ figureLook: 'cel' });
    expect(enemyLook()).toBe('cel');
    setEnemyDisplayOptions({});
    expect(enemyLook()).toBe('cel');
  });
});

/** A GLB's JSON and binary chunk. */
function readGlb(file) {
  const buf = readFileSync(file);
  let off = 12;
  let json = null;
  let bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    if (type === 0x4e4f534a) json = JSON.parse(buf.subarray(off + 8, off + 8 + len).toString('utf8'));
    else if (type === 0x004e4942) bin = buf.subarray(off + 8, off + 8 + len);
    off += 8 + len;
  }
  return { json, bin };
}

/** Tint roles used by a mesh node's primitives: 'main' (alpha 0), 'accent' (0.5), 'fixed' (1). */
function roles({ json, bin }, nodeName) {
  const node = json.nodes.find((n) => n.name === nodeName && n.mesh !== undefined);
  if (!node) return null;
  const out = new Set();
  for (const p of json.meshes[node.mesh].primitives) {
    const acc = json.accessors[p.attributes.COLOR_0];
    const bv = json.bufferViews[acc.bufferView];
    const size = acc.componentType === 5121 ? 1 : 2;
    const stride = bv.byteStride || size * 4;
    const max = size === 1 ? 255 : 65535;
    for (let i = 0; i < acc.count; i++) {
      const o = (bv.byteOffset || 0) + (acc.byteOffset || 0) + i * stride + 3 * size;
      const a = (size === 1 ? bin.readUInt8(o) : bin.readUInt16LE(o)) / max;
      out.add(a < 0.25 ? 'main' : a > 0.75 ? 'fixed' : 'accent');
    }
  }
  return out;
}

describe('the rebuilt goblin family (route (c))', () => {
  const glb = readGlb(path.join(root, 'public', 'models', 'enemies', 'goblin.glb'));
  const x = glb.json.asset.extras;

  it('paints the 60/30/10 plan into the tint roles', () => {
    // skin (main), the tunic and loincloth (accent), the rope belt (fixed)
    expect([...roles(glb, 'base|torso|body')].sort()).toEqual(['accent', 'fixed', 'main']);
    // the hair cap on the back of the head (accent) over the skin; the pink inner ears (fixed)
    expect([...roles(glb, 'base|head|body')].sort()).toEqual(['accent', 'fixed', 'main']);
    // the crest is all hair colour
    expect([...roles(glb, 'base|hair|body')]).toEqual(['accent']);
  });

  it('hides the hair under a hood or a crown and inside the Machine', () => {
    expect(x.propHide).toEqual({ crown: ['hair'], hood: ['hair'] });
    expect(x.variants.machine.hide).toContain('hair');
  });

  it('gives the ears their own bones and the face its v2 clips', () => {
    const joints = glb.json.skins[0].joints.map((j) => glb.json.nodes[j].name);
    expect(joints).toEqual(expect.arrayContaining(['ear_L', 'ear_R', 'head', 'root']));
    expect(joints).toHaveLength(10);
    expect(x.clips).toMatchObject({ move: 'run_lag', idle: 'glance' });
    expect(x.displayScale).toBeUndefined(); // the size lives in enemyDisplay.js, for every family at once
  });
});
