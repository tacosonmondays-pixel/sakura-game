// World data validation: enemies, maps, stages (CONTRACTS.md §4, §5, §5b, §12).
import { describe, it, expect } from 'vitest';
import {
  FAMILIES, FAMILY_ORDER, ENEMIES, ENEMY_MAP, getEnemy, enemiesByFamily, enemyTraits, spawnedBy,
} from '../../src/data/enemies.js';
import { MAPS, getMap, pathTiles, buildableTiles } from '../../src/data/maps.js';
import { TRACK_STEP } from '../../src/core/track.js';
import {
  CHAPTERS, STAGES, STAGE_MAP, getStage, campaignStages, stagesOfKind, bountyArenas, stageEnemies, CAMPAIGN_IDS,
} from '../../src/data/stages.js';
import { UNITS, freeUnlocksByStage } from '../../src/data/units.js';
import * as itemsModule from '../../src/data/items.js';
import {
  ARMOR_CLASSES, TRAITS, ELEMENTS, CAPABILITIES, MAP_TIERS, DIFFICULTIES, ITEM_RARITY_ORDER, MATERIAL_FAMILIES,
} from '../../src/data/types.js';

// ---------------------------------------------------------------------------
// Contract vocab (CONTRACTS.md §4 / §5)
// ---------------------------------------------------------------------------

const ENEMY_KEYS = [
  'id', 'name', 'family', 'tier', 'hp', 'speed', 'armorClass', 'armor', 'bounty', 'leak', 'threat',
  'size', 'color', 'accent', 'model', 'traits', 'lore', 'counters', 'introducedIn',
];
const ENEMY_OPTIONAL = ['phases'];
const MAP_KEYS = ['id', 'name', 'theme', 'tier', 'width', 'height', 'rows', 'paths', 'tracks', 'crossings'];
const MAP_OPTIONAL = ['decor', 'desc', 'concept'];
const STAGE_KEYS = [
  'id', 'kind', 'name', 'mapId', 'desc', 'waves', 'waveGen', 'hpScale', 'startCash', 'lives',
  'introduces', 'recommended', 'unlocks', 'requires', 'drops', 'firstClear', 'scenery', 'tier',
];
const STAGE_OPTIONAL = ['chapter', 'cashScale'];
const THEMES = ['sakura', 'lake', 'shrine', 'mountain', 'marsh', 'foundry', 'festival', 'volcano', 'snow', 'night', 'arena'];
const TILE_CHARS = new Set(['.', '~', 'T', 'R', 'H', 'B', ',', 'X']);
const FAMILY_IDS = ['slime', 'goblin', 'orc', 'ghost', 'ghoul', 'oni', 'lizard', 'construct', 'beast', 'fae', 'plant', 'dragon'];
const TRAIT_SHAPES = {
  barrier: ['hp'], crystal: ['cap', 'hits'], regen: ['pct', 'delay'], hasty: ['mul', 'every', 'duration'],
  volatile: ['radius', 'stun'], brood: ['spawn', 'count'], splitter: ['spawn', 'count'], siphon: ['radius', 'rate'],
  blink: ['every', 'distance'], field: ['radius', 'amount'], phasing: ['every', 'duration'], guardian: ['radius', 'reduction'],
  sabotage: ['radius', 'duration', 'cooldown'], decoy: ['count', 'every', 'spawn'], enrage: ['mul', 'max'],
  summoner: ['spawn', 'count', 'every'],
};

/** CONTRACTS §5 fixed item ids (+ gearbox_<rarity> for gear boxes, see INTEGRATION_NOTES). */
function contractItemIds() {
  const ids = new Set(['dice_reroll', 'dice_prism', 'lock_pin', 'star_fragment', 'ticket_recruit', 'ticket_recruit10',
    'token_boss', 'token_bounty', 'coins', 'gems', 'crown_slime', 'crown_iron', 'crown_cog', 'crown_oni', 'crown_dragon']);
  for (const f of Object.keys(MATERIAL_FAMILIES)) for (const r of ITEM_RARITY_ORDER) ids.add(`mat_${f}_${r}`);
  for (const r of ITEM_RARITY_ORDER) {
    ids.add(`book_${r}`);
    ids.add(`gearbox_${r}`);
  }
  return ids;
}
const ITEM_IDS = contractItemIds();

const stageOrder = [...CAMPAIGN_IDS, ...stagesOfKind('resource').map((s) => s.id), ...stagesOfKind('boss').map((s) => s.id), 'challenge'];
/** Crossings of a map's paths (self-crossings and between paths), as resolved by defineMap. */
const isCrossing = (map) => (map.crossings || []).length;

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

describe('enemies', () => {
  it('has 12 families and 60-75 enemies with unique ids', () => {
    expect(Object.keys(FAMILIES).sort()).toEqual([...FAMILY_IDS].sort());
    expect([...FAMILY_ORDER].sort()).toEqual([...FAMILY_IDS].sort());
    for (const [id, f] of Object.entries(FAMILIES)) {
      expect(f.id).toBe(id);
      for (const k of ['name', 'color', 'desc', 'behavior']) expect(f[k], `${id}.${k}`).toBeTruthy();
    }
    expect(ENEMIES.length).toBeGreaterThanOrEqual(60);
    expect(ENEMIES.length).toBeLessThanOrEqual(75);
    expect(new Set(ENEMIES.map((e) => e.id)).size).toBe(ENEMIES.length);
    expect(Object.keys(ENEMY_MAP).length).toBe(ENEMIES.length);
    for (const fam of FAMILY_IDS) expect(enemiesByFamily(fam).length, fam).toBeGreaterThanOrEqual(4);
  });

  it('every EnemyDef matches the contract schema', () => {
    for (const e of ENEMIES) {
      const keys = Object.keys(e);
      for (const k of ENEMY_KEYS) expect(keys, `${e.id} missing ${k}`).toContain(k);
      for (const k of keys) expect([...ENEMY_KEYS, ...ENEMY_OPTIONAL], `${e.id} extra ${k}`).toContain(k);
      expect(FAMILIES[e.family], e.id).toBeTruthy();
      expect(['normal', 'elite', 'miniboss', 'boss']).toContain(e.tier);
      expect(ARMOR_CLASSES[e.armorClass], `${e.id} armorClass`).toBeTruthy();
      for (const k of ['hp', 'speed', 'armor', 'bounty', 'threat', 'size']) {
        expect(Number.isFinite(e[k]), `${e.id}.${k}`).toBe(true);
        expect(e[k], `${e.id}.${k}`).toBeGreaterThanOrEqual(0);
      }
      expect(e.hp).toBeGreaterThan(0);
      expect(e.speed).toBeGreaterThan(0.2);
      expect(e.speed).toBeLessThanOrEqual(2);
      expect(e.size).toBeGreaterThanOrEqual(0.6);
      expect(e.size).toBeLessThanOrEqual(3);
      if (e.tier === 'boss') expect(e.leak).toBe(Infinity);
      else expect(Number.isInteger(e.leak) && e.leak >= 0, `${e.id}.leak`).toBe(true);
      expect(e.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(e.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(e.model.base).toBe(e.family);
      expect(typeof e.model.variant).toBe('string');
      expect(Array.isArray(e.model.props)).toBe(true);
      expect(e.lore.length, `${e.id} lore`).toBeGreaterThan(20);
      expect(e.counters.length, `${e.id} counters`).toBeGreaterThan(20);
      expect(getEnemy(e.id)).toBe(e);
    }
    expect(() => getEnemy('nope')).toThrow();
  });

  it('traits use TRAITS keys with complete shapes and valid references', () => {
    const check = (id, traits) => {
      for (const [k, v] of Object.entries(traits || {})) {
        expect(TRAITS[k], `${id} unknown trait ${k}`).toBeTruthy();
        if (v === null || v === false) continue;
        if (k === 'ward') expect(ELEMENTS[v], `${id} ward`).toBeTruthy();
        else if (k === 'veiled' || k === 'airborne') expect(v).toBe(true);
        else {
          for (const f of TRAIT_SHAPES[k] || []) {
            if (k === 'field' && f === 'radius') expect(v.radius).toBeGreaterThan(0);
            expect(v[f], `${id}.${k}.${f}`).not.toBeUndefined();
          }
          if (k === 'field') expect(v.kind || v.kinds, `${id} field kind`).toBeTruthy();
          if (v.spawn) expect(ENEMY_MAP[v.spawn], `${id}.${k}.spawn`).toBeTruthy();
        }
      }
    };
    for (const e of ENEMIES) {
      check(e.id, e.traits);
      for (const ph of e.phases || []) check(`${e.id} phase`, ph.set?.traits);
    }
  });

  it('readability: one rule per ordinary enemy, at most two for elites (§12)', () => {
    for (const e of ENEMIES) {
      const own = Object.keys(e.traits).filter((k) => e.traits[k]).length + (e.armor > 0 ? 1 : 0);
      if (e.tier === 'normal') expect(own, `${e.id} rules`).toBeLessThanOrEqual(1);
      if (e.tier === 'elite') expect(own, `${e.id} rules`).toBeLessThanOrEqual(2);
    }
  });

  it('slimes are fragile mimics that each borrow a different rule', () => {
    const slimes = enemiesByFamily('slime').filter((e) => e.tier === 'normal');
    const borrowed = new Map();
    for (const s of slimes) {
      expect(s.hp, s.id).toBeLessThanOrEqual(40);
      expect(s.armorClass).toBe('light');
      const rules = enemyTraits(s);
      if (rules.length === 1 && !(s.traits.decoy && s.bounty === 0)) {
        expect(borrowed.has(rules[0]), `${s.id} duplicates ${rules[0]}`).toBe(false);
        borrowed.set(rules[0], s.id);
      }
    }
    const required = {
      veiled: 'slime_violet', armored: 'slime_iron', siphon: 'slime_rose', hasty: 'slime_gold',
      volatile: 'slime_ember', crystal: 'slime_crystal', splitter: 'slime_prism',
    };
    for (const [trait, id] of Object.entries(required)) expect(borrowed.get(trait), trait).toBe(id);
  });

  it('family signature mechanics exist (§4)', () => {
    const has = (id, trait) => enemyTraits(id).includes(trait);
    expect(getEnemy('goblin_runner').speed).toBeCloseTo(1.7);
    expect(has('goblin_sapper', 'sabotage')).toBe(true);
    expect(has('goblin_smoke', 'veiled')).toBe(true);
    expect(has('orc_ironhide', 'armored')).toBe(true);
    expect(has('orc_shieldbearer', 'guardian')).toBe(true);
    expect(has('ghost_veilwraith', 'veiled')).toBe(true);
    expect(getEnemy('ghost_veilwraith').armorClass).toBe('spectral');
    expect(has('ghost_phantom', 'phasing')).toBe(true);
    expect(has('ghoul_leech', 'siphon')).toBe(true);
    expect(has('ghoul_skulker', 'blink')).toBe(true);
    for (const k of ['haste', 'shield', 'regen']) expect(ENEMIES.some((e) => e.family === 'oni' && e.traits.field?.kind === k), k).toBe(true);
    expect(has('lizard_hunter', 'regen')).toBe(true);
    expect(getEnemy('lizard_sunscale').traits.ward).toBe('fire');
    expect(has('construct_shellback', 'crystal')).toBe(true);
    expect(has('construct_aegis', 'barrier')).toBe(true);
    expect(has('beast_wolf', 'enrage')).toBe(true);
    expect(has('beast_boar', 'hasty')).toBe(true);
    expect(has('fae_illusionist', 'decoy')).toBe(true);
    expect(getEnemy('fae_illusionist').armorClass).toBe('warded');
    expect(has('plant_seedpod', 'brood')).toBe(true);
    expect(has('plant_thornroot', 'armored')).toBe(true);
    expect(has('dragon_wyvern', 'airborne')).toBe(true);
  });

  it('balance anchors (§5b)', () => {
    const g = getEnemy('slime_green');
    expect([g.hp, g.speed, g.bounty, g.threat]).toEqual([14, 1, 1, 1]);
    expect(getEnemy('goblin_runner').hp).toBe(10);
    const o = getEnemy('orc_ironhide');
    expect([o.hp, o.armor, o.speed, o.threat]).toEqual([60, 3, 0.7, 5]);
    for (const e of ENEMIES) {
      if (e.tier === 'elite') {
        expect(e.hp, e.id).toBeGreaterThanOrEqual(150);
        expect(e.hp, e.id).toBeLessThanOrEqual(400);
      }
      if (e.tier === 'miniboss') {
        expect(e.hp, e.id).toBeGreaterThanOrEqual(2500);
        expect(e.hp, e.id).toBeLessThanOrEqual(4000);
      }
      if (e.tier === 'boss') {
        expect(e.hp, e.id).toBeGreaterThanOrEqual(9000);
        expect(e.hp, e.id).toBeLessThanOrEqual(20000);
      }
    }
  });

  it('has the 4 minibosses and 3 bosses with announced phases', () => {
    const minis = ENEMIES.filter((e) => e.tier === 'miniboss').map((e) => e.id).sort();
    expect(minis).toEqual(['goblin_machine', 'oni_champion', 'orc_general', 'slime_prince']);
    const bosses = ENEMIES.filter((e) => e.tier === 'boss').map((e) => e.id).sort();
    expect(bosses).toEqual(['dragon_ashwing', 'grave_lych', 'iron_colossus']);
    for (const id of [...minis, ...bosses]) {
      const e = getEnemy(id);
      expect(e.phases?.length, `${id} phases`).toBeGreaterThanOrEqual(2);
      let last = 1;
      for (const ph of e.phases) {
        expect(ph.atHp).toBeGreaterThan(0);
        expect(ph.atHp).toBeLessThan(last);
        last = ph.atHp;
        expect(ph.announce.length, `${id} announce`).toBeGreaterThan(10);
        expect(typeof ph.set).toBe('object');
      }
    }
    // Specific phase mechanics from the design.
    expect(getEnemy('slime_prince').traits.splitter).toBeTruthy();
    expect(getEnemy('orc_general').phases.some((p) => p.set.armor >= 10)).toBe(true);
    expect(getEnemy('orc_general').phases.some((p) => p.set.traits?.guardian === null)).toBe(true);
    expect(enemyTraits('goblin_machine')).toEqual(expect.arrayContaining(['barrier', 'summoner']));
    const champKinds = new Set(getEnemy('oni_champion').phases.flatMap((p) => [p.set.traits?.field?.kind, ...(p.set.traits?.field?.kinds || [])]).filter(Boolean));
    expect(champKinds.size).toBe(3);
    expect(enemyTraits('grave_lych')).toEqual(expect.arrayContaining(['regen', 'summoner', 'phasing']));
    expect(getEnemy('iron_colossus').phases.filter((p) => p.set.traits?.crystal).length).toBeGreaterThanOrEqual(2);
    expect(enemyTraits('dragon_ashwing')).toEqual(expect.arrayContaining(['airborne', 'ward', 'summoner']));
    expect(getEnemy('dragon_ashwing').traits.ward).toBe('fire');
    expect(spawnedBy('dragon_ashwing')).toContain('dragon_wyvern');
  });

  it('introducedIn is the first stage that can field the enemy', () => {
    const first = new Map();
    for (const sid of stageOrder) {
      for (const eid of stageEnemies(sid)) if (!first.has(eid)) first.set(eid, sid);
    }
    for (const e of ENEMIES) {
      expect(STAGE_MAP[e.introducedIn], `${e.id} introducedIn ${e.introducedIn}`).toBeTruthy();
      expect(first.get(e.id), `${e.id} first appears`).toBe(e.introducedIn);
    }
  });
});

// ---------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------

describe('maps', () => {
  it('has at least 24 maps with unique ids and the contract shape', () => {
    expect(MAPS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(MAPS.map((m) => m.id)).size).toBe(MAPS.length);
    for (const m of MAPS) {
      for (const k of MAP_KEYS) expect(Object.keys(m), `${m.id} ${k}`).toContain(k);
      for (const k of Object.keys(m)) expect([...MAP_KEYS, ...MAP_OPTIONAL], `${m.id} extra ${k}`).toContain(k);
      expect(THEMES, m.id).toContain(m.theme);
      expect(MAP_TIERS[m.tier], m.id).toBeTruthy();
      expect(getMap(m.id)).toBe(m);
    }
    expect(() => getMap('nope')).toThrow();
    for (const t of Object.keys(MAP_TIERS)) expect(MAPS.some((m) => m.tier === t), t).toBe(true);
  });

  it('maps are rectangular and within size limits', () => {
    for (const m of MAPS) {
      expect(m.width, m.id).toBeGreaterThanOrEqual(14);
      expect(m.width, m.id).toBeLessThanOrEqual(22);
      expect(m.height, m.id).toBeGreaterThanOrEqual(9);
      expect(m.height, m.id).toBeLessThanOrEqual(13);
      expect(m.rows.length, m.id).toBe(m.height);
      m.rows.forEach((r, y) => {
        expect(r.length, `${m.id} row ${y}`).toBe(m.width);
        for (const ch of r) expect(TILE_CHARS.has(ch), `${m.id} char ${ch}`).toBe(true);
      });
    }
  });

  it('tracks are smooth dense curves, in bounds (±1.5), entering and leaving across the board edge', () => {
    for (const m of MAPS) {
      expect(m.tracks.length, m.id).toBeGreaterThanOrEqual(1);
      expect(m.paths.length, m.id).toBe(m.tracks.length);
      const offOrOnEdge = ([x, y]) => x <= 0 || y <= 0 || x >= m.width || y >= m.height;
      m.tracks.forEach((t, ti) => {
        const p = t.points;
        expect(p.length, m.id).toBeGreaterThan(20);
        expect(t.cum.length, m.id).toBe(p.length);
        expect(t.length, m.id).toBeCloseTo(t.cum[t.cum.length - 1], 3);
        for (const [x, y] of p) {
          expect(Number.isFinite(x) && Number.isFinite(y), m.id).toBe(true);
          expect(x >= -1.5 && x <= m.width + 1.5 && y >= -1.5 && y <= m.height + 1.5, `${m.id} point ${x},${y}`).toBe(true);
        }
        // densely sampled, and smooth: no corner sharper than a gentle bend between samples
        let worst = 0;
        for (let i = 1; i < p.length; i++) {
          const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
          expect(seg, `${m.id} sample spacing`).toBeLessThanOrEqual(TRACK_STEP * 1.25);
          expect(seg, `${m.id} repeated point`).toBeGreaterThan(1e-4);
          if (i < p.length - 1) {
            const a = Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0]);
            const b = Math.atan2(p[i + 1][1] - p[i][1], p[i + 1][0] - p[i][0]);
            let d = Math.abs(b - a);
            if (d > Math.PI) d = 2 * Math.PI - d;
            worst = Math.max(worst, d);
          }
        }
        expect(worst * 180 / Math.PI, `${m.id} path ${ti} sharpest bend`).toBeLessThan(14);
        // spawn / exit off the board (or on its edge) unless the path forks off / joins another one
        if (!t.fork) expect(offOrOnEdge(p[0]), `${m.id} path ${ti} spawn on the edge`).toBe(true);
        if (!t.join) expect(offOrOnEdge(p[p.length - 1]), `${m.id} path ${ti} exit on the edge`).toBe(true);
        // tunnels sit inside the path, in order, at least a tile long
        let prev = 0;
        for (const [a, b] of t.tunnels) {
          expect(a >= prev - 1e-6 && b > a + 1 && b <= t.length + 1e-6, `${m.id} tunnel ${a}-${b}`).toBe(true);
          prev = b;
        }
        // overpass profile only where a bridge crossing put it, never negative
        if (t.elev) for (const e of t.elev) expect(e >= 0 && e <= 0.5, m.id).toBe(true);
        // the legacy tile-coordinate view is the same curve
        expect(m.paths[ti].length, m.id).toBe(p.length);
        expect(m.paths[ti][5][0] + 0.5).toBeCloseTo(p[5][0], 3);
      });
    }
  });

  it('crossings are resolved: bridges keep the lower pass on the ground, tunnels pass underneath', () => {
    for (const m of MAPS) {
      for (const c of m.crossings) {
        expect(['flat', 'bridge', 'tunnel'], m.id).toContain(c.mode);
        if (c.mode === 'bridge') {
          const over = m.tracks[c[c.over].path];
          const under = m.tracks[c[c.over === 'a' ? 'b' : 'a'].path];
          const elevAt = (t, d) => (t.elev ? t.elev[t.cum.findIndex((v) => v >= d - 1e-9)] || 0 : 0);
          expect(elevAt(over, c[c.over].d), `${m.id} overpass height`).toBeGreaterThan(0.3);
          expect(elevAt(under, c[c.over === 'a' ? 'b' : 'a'].d), `${m.id} lower pass`).toBeLessThan(0.05);
        }
      }
    }
  });

  it('every map has its own silhouette concept', () => {
    const concepts = MAPS.map((m) => m.concept);
    for (const [i, c] of concepts.entries()) expect(c.length, MAPS[i].id).toBeGreaterThan(8);
    expect(new Set(concepts).size).toBe(MAPS.length);
  });

  it('paths never run through water (only bridges), blocked tiles or void', () => {
    for (const m of MAPS) {
      const tiles = pathTiles(m);
      for (const key of tiles) {
        const [x, y] = key.split(',').map(Number);
        if (x < 0 || y < 0 || x >= m.width || y >= m.height) continue;
        const ch = m.rows[y][x];
        expect(['.', 'B'], `${m.id} path on '${ch}' at ${key}`).toContain(ch);
      }
      // Bridges only exist under paths.
      m.rows.forEach((r, y) => [...r].forEach((ch, x) => {
        if (ch === 'B') expect(tiles.has(`${x},${y}`), `${m.id} stray bridge ${x},${y}`).toBe(true);
      }));
    }
  });

  it('paths are long enough and every map has room to build', () => {
    for (const m of MAPS) {
      const inside = [...pathTiles(m)].filter((k) => {
        const [x, y] = k.split(',').map(Number);
        return x >= 0 && y >= 0 && x < m.width && y < m.height;
      });
      expect(inside.length, `${m.id} path length`).toBeGreaterThanOrEqual(24);
      const { land } = buildableTiles(m);
      expect(land, `${m.id} land tiles`).toBeGreaterThanOrEqual(30);
    }
  });

  it('decor sits inside the map and off the path', () => {
    for (const m of MAPS) {
      const tiles = pathTiles(m);
      for (const d of m.decor) {
        expect(typeof d.type).toBe('string');
        expect(d.x >= 0 && d.y >= 0 && d.x < m.width && d.y < m.height, `${m.id} decor ${d.type}`).toBe(true);
        expect(tiles.has(`${d.x},${d.y}`), `${m.id} decor ${d.type} on path`).toBe(false);
      }
    }
  });

  it('has Bloons-style variety: multi-lane, crossings and water maps', () => {
    expect(MAPS.filter((m) => m.paths.length >= 2).length).toBeGreaterThanOrEqual(6);
    expect(MAPS.filter((m) => m.paths.length >= 3).length).toBeGreaterThanOrEqual(1);
    expect(MAPS.filter((m) => isCrossing(m) > 0).length).toBeGreaterThanOrEqual(8);
    expect(MAPS.filter((m) => buildableTiles(m).water >= 60).length).toBeGreaterThanOrEqual(6);
    expect(new Set(MAPS.map((m) => m.theme)).size).toBeGreaterThanOrEqual(9);
  });
});

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

describe('stages', () => {
  const campaign = campaignStages();

  it('has the expected stage counts and lookup helpers', () => {
    expect(campaign.length).toBe(40);
    expect(stagesOfKind('resource').length).toBe(15);
    expect(stagesOfKind('boss').map((s) => s.id).sort()).toEqual(['boss-ashwing', 'boss-colossus', 'boss-lych']);
    expect(stagesOfKind('challenge').map((s) => s.id)).toEqual(['challenge']);
    expect(STAGES.length).toBe(59);
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(STAGES.length);
    expect(getStage('1-1')).toBe(STAGE_MAP['1-1']);
    expect(() => getStage('nope')).toThrow();
    for (const a of ['res-books', 'res-coins', 'res-gear', 'res-mats-a', 'res-mats-b']) {
      for (const t of [1, 2, 3]) expect(STAGE_MAP[`${a}-${t}`], `${a}-${t}`).toBeTruthy();
    }
    expect(bountyArenas().map((a) => a.id)).toEqual(['res-books', 'res-coins', 'res-gear', 'res-mats-a', 'res-mats-b']);
  });

  it('chapters are 8 × 5 in order', () => {
    expect(CHAPTERS.length).toBe(8);
    CHAPTERS.forEach((c, i) => {
      expect(c.id).toBe(i + 1);
      expect(c.stages).toEqual([1, 2, 3, 4, 5].map((n) => `${i + 1}-${n}`));
      for (const k of ['name', 'theme', 'tier', 'desc', 'mechanic']) expect(c[k], `chapter ${c.id} ${k}`).toBeTruthy();
      expect(MAP_TIERS[c.tier]).toBeTruthy();
      for (const sid of c.stages) expect(getStage(sid).chapter).toBe(c.id);
    });
    expect(campaign.map((s) => s.id)).toEqual(CHAPTERS.flatMap((c) => c.stages));
  });

  it('every StageDef matches the contract schema', () => {
    for (const s of STAGES) {
      for (const k of STAGE_KEYS) expect(Object.keys(s), `${s.id} missing ${k}`).toContain(k);
      for (const k of Object.keys(s)) expect([...STAGE_KEYS, ...STAGE_OPTIONAL], `${s.id} extra ${k}`).toContain(k);
      expect(['campaign', 'resource', 'boss', 'challenge']).toContain(s.kind);
      expect(MAP_TIERS[s.tier], s.id).toBeTruthy();
      expect(getMap(s.mapId), s.id).toBeTruthy();
      expect(s.name && s.desc, s.id).toBeTruthy();
      expect(s.lives).toBe(100);
      expect(s.hpScale).toBeGreaterThan(0);
      if (s.kind === 'challenge') expect(s.waves).toBe(Infinity);
      else expect(Number.isInteger(s.waves) && s.waves >= 12 && s.waves <= 30, s.id).toBe(true);
      const wg = s.waveGen;
      expect(Object.keys(wg).sort()).toEqual(['budget', 'fixed', 'groups', 'pool', 'spacing']);
      expect(wg.budget.start).toBeGreaterThan(0);
      expect(wg.budget.growth).toBeGreaterThan(1);
      expect(wg.spacing).toBeGreaterThan(0);
      expect(wg.groups).toBeGreaterThanOrEqual(1);
      expect(wg.pool.length).toBeGreaterThan(0);
      for (const p of wg.pool) {
        expect(ENEMY_MAP[p.enemy], `${s.id} pool ${p.enemy}`).toBeTruthy();
        expect(p.weight).toBeGreaterThan(0);
        expect(p.from).toBeGreaterThanOrEqual(1);
        if (Number.isFinite(s.waves)) expect(p.from, `${s.id} ${p.enemy} from`).toBeLessThanOrEqual(s.waves);
        if (p.to != null) expect(p.to).toBeGreaterThanOrEqual(p.from);
        expect(['miniboss', 'boss'], `${s.id} pool ${p.enemy} must be fixed`).not.toContain(ENEMY_MAP[p.enemy].tier);
      }
      // Something cheap is available from wave 1 so the opening wave is not empty.
      expect(wg.pool.some((p) => p.from === 1 && ENEMY_MAP[p.enemy].threat <= wg.budget.start * 0.6), `${s.id} cheap opener`).toBe(true);
      for (const f of wg.fixed) {
        expect(ENEMY_MAP[f.enemy], `${s.id} fixed ${f.enemy}`).toBeTruthy();
        expect(f.count).toBeGreaterThanOrEqual(1);
        expect(f.wave).toBeGreaterThanOrEqual(1);
        if (Number.isFinite(s.waves)) expect(f.wave).toBeLessThanOrEqual(s.waves);
      }
      for (const i of s.introduces) expect(!!ENEMY_MAP[i] || !!TRAITS[i], `${s.id} introduces ${i}`).toBe(true);
      for (const c of s.recommended) expect(CAPABILITIES[c], `${s.id} recommends ${c}`).toBeTruthy();
      expect(Array.isArray(s.scenery.props) && s.scenery.props.length > 0, `${s.id} scenery`).toBe(true);
      if (s.scenery.weather != null) expect(['rain', 'snow', 'petals', 'embers']).toContain(s.scenery.weather);
      if (s.requires !== null) expect(STAGE_MAP[s.requires], `${s.id} requires`).toBeTruthy();
      expect(typeof s.unlocks).toBe('object');
    }
  });

  it('drops and first-clear rewards only use contract item ids', () => {
    const real = itemsModule.ITEMS || {};
    const realIds = Object.keys(real);
    const realHasGearboxes = Object.values(real).some((it) => it?.category === 'gearbox');
    for (const s of STAGES) {
      for (const d of s.drops) {
        expect(ITEM_IDS.has(d.item), `${s.id} drop ${d.item}`).toBe(true);
        expect(d.chance).toBeGreaterThan(0);
        expect(d.chance).toBeLessThanOrEqual(1);
        expect(Number.isInteger(d.min) && Number.isInteger(d.max) && d.min >= 1 && d.max >= d.min, `${s.id} ${d.item} min/max`).toBe(true);
        if (d.difficulty !== undefined) expect(DIFFICULTIES[d.difficulty], `${s.id} difficulty`).toBeTruthy();
        // Once systems ships the item table, every id must resolve there too.
        if (realIds.length && (!d.item.startsWith('gearbox_') || realHasGearboxes)) {
          expect(real[d.item], `${s.id} drop ${d.item} missing from ITEMS`).toBeTruthy();
        }
      }
      for (const r of s.firstClear) {
        expect(ITEM_IDS.has(r.id), `${s.id} firstClear ${r.id}`).toBe(true);
        expect(r.count).toBeGreaterThan(0);
      }
    }
  });

  it('campaign requires-chain, hpScale, waves and start cash ramp (§5b)', () => {
    campaign.forEach((s, i) => {
      expect(s.requires).toBe(i === 0 ? null : campaign[i - 1].id);
      if (i > 0) {
        expect(s.hpScale, s.id).toBeGreaterThanOrEqual(campaign[i - 1].hpScale);
        expect(s.waves, s.id).toBeGreaterThanOrEqual(campaign[i - 1].waves - 2);
        expect(s.startCash, s.id).toBeGreaterThanOrEqual(700);
        expect(s.startCash, s.id).toBeLessThanOrEqual(900);
      }
    });
    expect(campaign[0].hpScale).toBe(1);
    expect(campaign[0].startCash).toBe(650);
    expect(campaign[0].waves).toBe(12);
    expect(campaign[39].hpScale).toBeGreaterThanOrEqual(6);
    expect(campaign[39].hpScale).toBeLessThanOrEqual(7);
    expect(campaign[39].waves).toBe(30);
    const res = stagesOfKind('resource');
    for (const s of res) {
      const t = Number(s.id.slice(-1));
      expect(s.hpScale).toBe([1.5, 3, 5][t - 1]);
    }
    for (const s of stagesOfKind('boss')) {
      expect(s.hpScale).toBeGreaterThanOrEqual(5);
      expect(s.hpScale).toBeLessThanOrEqual(7);
    }
  });

  it('free recruits match units.js and are granted before their mechanic', () => {
    const expected = freeUnlocksByStage();
    const actual = {};
    for (const s of STAGES) if (s.unlocks.units?.length) actual[s.id] = [...s.unlocks.units].sort();
    const exp = Object.fromEntries(Object.entries(expected).map(([k, v]) => [k, [...v].sort()]));
    expect(actual).toEqual(exp);
    for (const s of STAGES) if (s.kind !== 'campaign') expect(s.unlocks.units).toBeUndefined();
  });

  it('minibosses and bosses are scripted where the campaign says, with crown drops', () => {
    const fixedHas = (sid, eid) => getStage(sid).waveGen.fixed.some((f) => f.enemy === eid && f.wave === getStage(sid).waves);
    expect(fixedHas('1-5', 'slime_prince')).toBe(true);
    expect(fixedHas('4-5', 'orc_general')).toBe(true);
    expect(fixedHas('6-5', 'goblin_machine')).toBe(true);
    expect(fixedHas('7-5', 'oni_champion')).toBe(true);
    expect(fixedHas('8-5', 'dragon_ashwing')).toBe(true);
    const drops = (sid) => getStage(sid).drops.map((d) => d.item);
    expect(drops('1-5')).toContain('crown_slime');
    expect(drops('4-5')).toContain('crown_iron');
    expect(drops('6-5')).toContain('crown_cog');
    expect(drops('7-5')).toContain('crown_oni');
    expect(drops('8-5')).toContain('crown_dragon');
    expect(fixedHas('boss-lych', 'grave_lych')).toBe(true);
    expect(fixedHas('boss-colossus', 'iron_colossus')).toBe(true);
    expect(fixedHas('boss-ashwing', 'dragon_ashwing')).toBe(true);
    const crownOf = { 'boss-lych': 'crown_oni', 'boss-colossus': 'crown_iron', 'boss-ashwing': 'crown_dragon' };
    for (const s of stagesOfKind('boss')) {
      const items = s.drops.map((d) => d.item);
      expect(items).toContain(crownOf[s.id]);
      expect(items).toContain('token_boss');
      expect(items.some((i) => /^mat_\w+_(mythic|legendary)$/.test(i)), `${s.id} rare mats`).toBe(true);
      expect(items.some((i) => i.startsWith('gearbox_')), `${s.id} gear`).toBe(true);
    }
  });

  it('every material family is farmable in the campaign and dice drop occasionally', () => {
    const items = new Set(campaign.flatMap((s) => s.drops.map((d) => d.item)));
    for (const f of Object.keys(MATERIAL_FAMILIES)) {
      expect(items.has(`mat_${f}_common`), f).toBe(true);
      expect(items.has(`mat_${f}_rare`), f).toBe(true);
    }
    expect(items.has('dice_reroll')).toBe(true);
    for (const s of campaign) {
      const ids = s.drops.map((d) => d.item);
      expect(ids).toContain('coins');
      expect(ids.some((i) => i.startsWith('book_')), s.id).toBe(true);
      expect(ids.some((i) => i.startsWith('mat_')), s.id).toBe(true);
    }
  });

  it('bounty arenas improve rarity by tier and drop their own resource line', () => {
    const rank = (id) => {
      const r = ITEM_RARITY_ORDER.find((x) => id.endsWith(`_${x}`));
      return r ? ITEM_RARITY_ORDER.indexOf(r) : -1;
    };
    const lines = {
      'res-books': /^book_/, 'res-coins': /^coins$/, 'res-gear': /^gearbox_/, 'res-mats-a': /^mat_(feather|blade|ember|rime)_/, 'res-mats-b': /^mat_(charm|rune|cog)_/,
    };
    for (const [arena, re] of Object.entries(lines)) {
      const best = [1, 2, 3].map((t) => Math.max(...getStage(`${arena}-${t}`).drops.filter((d) => re.test(d.item)).map((d) => rank(d.item))));
      if (arena !== 'res-coins') {
        expect(best[1], arena).toBeGreaterThan(best[0]);
        expect(best[2], arena).toBeGreaterThan(best[1]);
      } else {
        const amount = [1, 2, 3].map((t) => getStage(`${arena}-${t}`).drops.find((d) => d.item === 'coins').max);
        expect(amount[1]).toBeGreaterThan(amount[0]);
        expect(amount[2]).toBeGreaterThan(amount[1]);
      }
      for (const t of [1, 2, 3]) expect(getStage(`${arena}-${t}`).drops.some((d) => re.test(d.item))).toBe(true);
    }
    for (const fam of ['feather', 'blade', 'ember', 'rime']) expect(getStage('res-mats-a-1').drops.some((d) => d.item.startsWith(`mat_${fam}_`))).toBe(true);
    for (const fam of ['charm', 'rune', 'cog']) expect(getStage('res-mats-b-1').drops.some((d) => d.item.startsWith(`mat_${fam}_`))).toBe(true);
  });

  it('introduces lists exactly the new enemies of each campaign stage; scenery reflects them', () => {
    for (const s of campaign) {
      const newEnemies = ENEMIES.filter((e) => e.introducedIn === s.id).map((e) => e.id).sort();
      expect(s.introduces.filter((i) => ENEMY_MAP[i]).sort(), s.id).toEqual(newEnemies);
      if (s.introduces.includes('veiled')) expect(s.scenery.fog, `${s.id} fog for veils`).toBe(true);
    }
    // Chapter 3 (veils) is foggy throughout.
    for (const sid of CHAPTERS[2].stages) expect(getStage(sid).scenery.fog).toBe(true);
  });

  it('chapter 2+ maps have useful water; chapter 2 is mostly water', () => {
    for (const s of campaign) {
      if (s.chapter < 2) continue;
      const m = getMap(s.mapId);
      const path = [...pathTiles(m)].map((k) => k.split(',').map(Number));
      let near = 0;
      m.rows.forEach((r, y) => [...r].forEach((ch, x) => {
        if (ch !== '~') return;
        if (path.some(([px, py]) => Math.hypot(px - x, py - y) <= 3)) near++;
      }));
      expect(near, `${s.id} water near path`).toBeGreaterThanOrEqual(8);
      if (s.chapter === 2) expect(buildableTiles(m).water, `${s.id} lots of water`).toBeGreaterThanOrEqual(60);
    }
  });

  it('FREE-COUNTER RULE: essential counters come from starters and earlier free recruits', () => {
    const order = new Map(campaign.map((s, i) => [s.id, i]));
    const available = (idx) => UNITS.filter((u) => u.acquisition.type === 'starter'
      || (u.acquisition.type === 'free' && order.has(u.acquisition.afterStage) && order.get(u.acquisition.afterStage) < idx));
    const provides = (u, cap) => {
      const b = u.base;
      if (cap === 'detection') return !!(b.detection || b.aura?.detection) || u.capabilities.includes('detection') || u.pathCapabilities.includes('detection');
      if (cap === 'antiAir') return b.canHitAir === true || u.capabilities.includes('antiAir') || u.pathCapabilities.includes('antiAir');
      if (cap === 'water') return u.placement === 'water' || u.placement === 'amphibious';
      return u.capabilities.includes(cap) || u.pathCapabilities.includes(cap);
    };
    campaign.forEach((s, idx) => {
      const units = available(idx);
      const traits = new Set(stageEnemies(s).flatMap((id) => enemyTraits(id)));
      if (traits.has('veiled')) expect(units.some((u) => provides(u, 'detection')), `${s.id} detection`).toBe(true);
      if (traits.has('airborne')) expect(units.some((u) => provides(u, 'antiAir')), `${s.id} antiAir`).toBe(true);
      if (s.chapter >= 2) expect(units.some((u) => provides(u, 'water')), `${s.id} water unit`).toBe(true);
      for (const cap of s.recommended) expect(units.some((u) => provides(u, cap)), `${s.id} recommends ${cap}`).toBe(true);
    });
    // Each free recruit arrives right before the mechanic it counters.
    const firstWith = (trait, tier = null) => campaign.find((s) => stageEnemies(s)
      .some((id) => enemyTraits(id).includes(trait) && (!tier || getEnemy(id).tier === tier))).id;
    const before = (a, b) => order.get(a) < order.get(b);
    expect(before('1-2', firstWith('hasty'))).toBe(true); // Yuki
    expect(firstWith('veiled')).toBe('3-1'); // Kage after 2-5
    expect(firstWith('armored', 'normal')).toBe('4-1'); // Shiro after 3-5 (armored elites before then are light)
    expect(firstWith('siphon')).toBe('5-1'); // Midori after 4-5
    expect(firstWith('sabotage')).toBe('6-3'); // Suzu after 5-5
    expect(firstWith('airborne')).toBe('8-1');
  });

  it('every enemy appears in at least one stage', () => {
    const all = new Set(STAGES.flatMap((s) => stageEnemies(s)));
    for (const e of ENEMIES) expect(all.has(e.id), e.id).toBe(true);
  });
});
