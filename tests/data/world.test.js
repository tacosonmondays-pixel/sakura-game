// World data validation: enemies, maps, stages (CONTRACTS.md §4, §5, §5b, §12).
import { describe, it, expect } from 'vitest';
import {
  FAMILIES, FAMILY_ORDER, ENEMIES, ENEMY_MAP, getEnemy, enemiesByFamily, enemyTraits, spawnedBy,
} from '../../src/data/enemies.js';
import { MAPS, MAP_MAP, getMap, pathTiles, buildableTiles, defineMap } from '../../src/data/maps.js';
import { TRACK_STEP, BRIDGE_HEIGHT } from '../../src/core/track.js';
import {
  silhouetteIoU, turningSignature, signaturesMatch, signatureText, isMeander, lobeCount, isDeclaredEcho,
} from './trackShape.js';
import {
  CHAPTERS, STAGES, STAGE_MAP, getStage, campaignStages, stagesOfKind, bountyArenas, stageEnemies, CAMPAIGN_IDS,
  ACT2_PLAN, ACT2_PLAN_MAP, stageRequires,
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
/** Co-op freeplay's giants (src/data/freeplay.js): bosses outside the campaign, never in a stage. */
const FREEPLAY_ONLY = (e) => e.introducedIn === 'freeplay';
const CAMPAIGN_ENEMIES = ENEMIES.filter((e) => !FREEPLAY_ONLY(e));
const MAP_KEYS = ['id', 'name', 'theme', 'tier', 'width', 'height', 'rows', 'paths', 'tracks', 'crossings'];
const MAP_OPTIONAL = ['decor', 'desc', 'concept', 'bridge', 'path', 'tunnel', 'ground', 'echoOf', 'echoDiff', 'city', 'district'];
const STAGE_KEYS = [
  'id', 'kind', 'name', 'mapId', 'desc', 'waves', 'waveGen', 'hpScale', 'startCash', 'lives',
  'introduces', 'recommended', 'unlocks', 'requires', 'drops', 'firstClear', 'scenery', 'tier',
];
const STAGE_OPTIONAL = ['chapter', 'cashScale', 'hpPass', 'rule', 'act', 'finale', 'medalGemMul', 'modeChapter', 'look'];
const THEMES = ['sakura', 'lake', 'shrine', 'mountain', 'marsh', 'foundry', 'festival', 'volcano', 'snow', 'night', 'arena', 'city', 'campus'];
const TILE_CHARS = new Set(['.', '~', 'T', 'R', 'H', 'B', ',', 'X', 'U']);
/** Eras by theme (Gate Arc): the 11 shipped themes are the Morning; Noon city, campus and drowned; the Evening vesper. */
const ERA_BY_THEME = {
  sakura: 'morning', lake: 'morning', shrine: 'morning', mountain: 'morning', marsh: 'morning', foundry: 'morning',
  festival: 'morning', volcano: 'morning', snow: 'morning', night: 'morning', arena: 'morning',
  city: 'noon', campus: 'noon', drowned: 'noon', vesper: 'evening',
};
/** At most this many declared echo maps (GATE_ARC §17: 1-10, 3-10, 8-10). */
const MAX_ECHOES = 3;

/**
 * Pairs of maps whose tracks clash: a silhouette IoU ≥ 0.65, or the same bend sequence placed too
 * similarly on the board. Declared echo pairs (MapDef.echoOf) are skipped, and only they.
 * @returns {string[]} one line per clash
 */
function shapeClashes(maps) {
  const out = [];
  const sigs = maps.map((m) => turningSignature(m));
  for (let i = 0; i < maps.length; i++) {
    for (let j = i + 1; j < maps.length; j++) {
      if (isDeclaredEcho(maps[i], maps[j])) continue;
      const iou = silhouetteIoU(maps[i], maps[j]);
      if (iou >= 0.65) out.push(`silhouette ${maps[i].id} vs ${maps[j].id}: IoU ${iou.toFixed(2)}`);
      // signature = the signed curvature lobes between inflections (mirrored / reversed variants
      // count as the same); two maps with the same bend sequence must at least sit differently on
      // the board, and a sequence of three or more lobes may not repeat on an overlapping layout
      if (!signaturesMatch(sigs[i], sigs[j])) continue;
      const complex = Math.min(lobeCount(sigs[i]), lobeCount(sigs[j])) >= 3;
      if (iou >= (complex ? 0.45 : 0.5)) {
        out.push(`turning ${maps[i].id} (${signatureText(sigs[i])}) vs ${maps[j].id} (${signatureText(sigs[j])}), IoU ${iou.toFixed(2)}`);
      }
    }
  }
  return out;
}

/** Tiles an echo map's `echoDiff` lists ({ x, y, w?, h?, from?, to }) → Map "x,y" → { from, to }. */
function echoDiffTiles(echo) {
  const out = new Map();
  for (const d of echo.echoDiff || []) {
    for (let y = d.y; y < d.y + (d.h ?? 1); y++) for (let x = d.x; x < d.x + (d.w ?? 1); x++) out.set(`${x},${y}`, d);
  }
  return out;
}

/**
 * What is wrong with a declared echo (empty = a valid echo of `original`): another era, the same
 * size, the paths, crossings and tunnels literal, and the rows equal except the tiles its echoDiff
 * lists (each of those really changed, from `from` to `to`).
 * @returns {string[]}
 */
function echoProblems(echo, original) {
  const out = [];
  const id = echo.id;
  if (!original) return [`${id}: echoOf '${echo.echoOf}' names no map`];
  if (echo.echoOf !== original.id) out.push(`${id}: echoOf is not ${original.id}`);
  const ea = ERA_BY_THEME[echo.theme];
  const eb = ERA_BY_THEME[original.theme];
  if (!ea || !eb || ea === eb) out.push(`${id}: an echo must be of another era (${echo.theme}: ${ea}, ${original.theme}: ${eb})`);
  if (echo.width !== original.width || echo.height !== original.height) out.push(`${id}: size differs`);
  if (JSON.stringify(echo.paths) !== JSON.stringify(original.paths)) out.push(`${id}: paths differ`);
  if (JSON.stringify(echo.tracks.map((t) => t.points)) !== JSON.stringify(original.tracks.map((t) => t.points))) out.push(`${id}: tracks differ`);
  if (JSON.stringify(echo.tracks.map((t) => t.tunnels)) !== JSON.stringify(original.tracks.map((t) => t.tunnels))) out.push(`${id}: tunnels differ`);
  if (JSON.stringify(echo.crossings) !== JSON.stringify(original.crossings)) out.push(`${id}: crossings differ`);
  if (!Array.isArray(echo.echoDiff)) out.push(`${id}: echoDiff must be a list`);
  const diff = echoDiffTiles(echo);
  for (let y = 0; y < Math.min(echo.height, original.height); y++) {
    for (let x = 0; x < Math.min(echo.width, original.width); x++) {
      const a = echo.rows[y][x];
      const b = original.rows[y][x];
      const d = diff.get(`${x},${y}`);
      if (!d) {
        if (a !== b) out.push(`${id}: tile ${x},${y} is '${a}', the original's '${b}' (not in echoDiff)`);
      } else {
        if (a === b) out.push(`${id}: echoDiff lists ${x},${y} but it did not change`);
        if (d.from != null && b !== d.from) out.push(`${id}: echoDiff ${x},${y} expects '${d.from}' in the original, found '${b}'`);
        if (d.to != null && a !== d.to) out.push(`${id}: echoDiff ${x},${y} expects '${d.to}', found '${a}'`);
      }
    }
  }
  return out;
}
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
  it('has 12 families and 60-110 campaign enemies (+ the 4 freeplay giants) with unique ids', () => {
    expect(Object.keys(FAMILIES).sort()).toEqual([...FAMILY_IDS].sort());
    expect([...FAMILY_ORDER].sort()).toEqual([...FAMILY_IDS].sort());
    for (const [id, f] of Object.entries(FAMILIES)) {
      expect(f.id).toBe(id);
      for (const k of ['name', 'color', 'desc', 'behavior']) expect(f[k], `${id}.${k}`).toBeTruthy();
    }
    expect(CAMPAIGN_ENEMIES.length).toBeGreaterThanOrEqual(60);
    // (Gate Arc raises the cap from 75 to 110: eight Act II bosses and the new factions, GATE_ARC §18)
    expect(CAMPAIGN_ENEMIES.length).toBeLessThanOrEqual(110);
    expect(ENEMIES.filter(FREEPLAY_ONLY).map((e) => e.id).sort()).toEqual(['fp_eclipse_wyrm', 'fp_foundry_titan', 'fp_gloom_regent', 'fp_hyakki_daimyo']);
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
      expect(e.size).toBeLessThanOrEqual(FREEPLAY_ONLY(e) ? 4 : 3); // the freeplay giants dwarf the bosses they hold
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

  it('has the 7 minibosses and 3 bosses with announced phases', () => {
    const minis = ENEMIES.filter((e) => e.tier === 'miniboss').map((e) => e.id).sort();
    // (Gate Arc: the Frostbitten Heir, 1-10, on the Slime Prince's model in frost colours; Old Lamp-Hugger, 2-10, on
    // the Bog Basilisk's model at miniboss scale; the Ashen Warden, 3-10, on the Hollow Samurai's)
    expect(minis).toEqual(['ghost_ashen_warden', 'goblin_machine', 'lizard_lamp_hugger', 'oni_champion', 'orc_general', 'slime_frost_heir', 'slime_prince']);
    const bosses = CAMPAIGN_ENEMIES.filter((e) => e.tier === 'boss').map((e) => e.id).sort();
    expect(bosses).toEqual(['dragon_ashwing', 'grave_lych', 'iron_colossus']);
    const giants = ENEMIES.filter(FREEPLAY_ONLY);
    for (const e of giants) {
      expect(e.tier, e.id).toBe('boss');
      // a giant that holds giants: it breaks open into a campaign boss when it falls
      const inner = getEnemy(e.traits.splitter.spawn);
      expect(['boss', 'miniboss'], `${e.id} releases ${inner.id}`).toContain(inner.tier);
      expect(FREEPLAY_ONLY(inner)).toBe(false);
    }
    for (const id of [...minis, ...bosses, ...giants.map((e) => e.id)]) {
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
    expect(getEnemy('slime_frost_heir').traits.splitter.spawn).toBe('slime_courtier');
    expect(getEnemy('slime_frost_heir').model).toEqual(getEnemy('slime_prince').model);
    expect(getEnemy('slime_frost_heir').hp).toBeGreaterThan(getEnemy('slime_prince').hp);
    expect(getEnemy('slime_frost_heir').threat).toBeGreaterThan(getEnemy('slime_prince').threat);
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
    for (const e of CAMPAIGN_ENEMIES) {
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
        // (a lane flagged `inside` starts at a rift inside the board: 3-8's lake lane, Gate Arc Step 3)
        if (!t.fork && !t.inside) expect(offOrOnEdge(p[0]), `${m.id} path ${ti} spawn on the edge`).toBe(true);
        if (t.inside) expect(m.id, `${m.id} path ${ti}: only declared rift lanes start inside`).toBe('noon_shrine_steps');
        if (!t.join) expect(offOrOnEdge(p[p.length - 1]), `${m.id} path ${ti} exit on the edge`).toBe(true);
        // tunnels sit inside the path, in order, at least a tile long
        let prev = 0;
        for (const [a, b] of t.tunnels) {
          expect(a >= prev - 1e-6 && b > a + 1 && b <= t.length + 1e-6, `${m.id} tunnel ${a}-${b}`).toBe(true);
          prev = b;
        }
        // overpass profile only where a bridge crossing put it, never negative
        if (t.elev) for (const e of t.elev) expect(e >= 0 && e <= BRIDGE_HEIGHT + 1e-9, m.id).toBe(true);
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

  it('no hairpin pinches the road: centreline radius >= 1.4 tiles over any 1-tile window', () => {
    // radius = arc length / turned angle between the tangents 0.5 tiles before and after each
    // sample (road half-width 0.5, so the inner edge keeps a radius of at least 0.9)
    const K = Math.round(0.5 / TRACK_STEP);
    for (const m of MAPS) {
      m.tracks.forEach((t, ti) => {
        const p = t.points;
        let worst = Infinity;
        let at = null;
        for (let i = K; i < p.length - K; i++) {
          const a = Math.atan2(p[i][1] - p[i - K][1], p[i][0] - p[i - K][0]);
          const b = Math.atan2(p[i + K][1] - p[i][1], p[i + K][0] - p[i][0]);
          let d = Math.abs(b - a);
          if (d > Math.PI) d = 2 * Math.PI - d;
          const r = d > 1e-9 ? (t.cum[i + K] - t.cum[i - K]) / d : Infinity;
          if (r < worst) [worst, at] = [r, p[i]];
        }
        expect(worst, `${m.id} path ${ti} tightest bend at ${at?.map((v) => v.toFixed(1))}`).toBeGreaterThanOrEqual(1.4);
      });
    }
  });

  it('silhouettes differ: no two maps share a track shape (coarse 10x6 raster IoU < 0.65)', () => {
    // (declared echo pairs only are exempt: see 'echoes' below)
    expect(shapeClashes(MAPS).filter((c) => c.startsWith('silhouette'))).toEqual([]);
  });

  it('turning signatures differ: no two maps bend the same way in the same place', () => {
    expect(shapeClashes(MAPS).filter((c) => c.startsWith('turning'))).toEqual([]);
  });

  it('echoes: at most three, each a literal re-skin of a map of another era', () => {
    const echoes = MAPS.filter((m) => m.echoOf);
    expect(echoes.length, echoes.map((m) => m.id).join(', ')).toBeLessThanOrEqual(MAX_ECHOES);
    for (const m of echoes) expect(echoProblems(m, MAP_MAP[m.echoOf]), m.id).toEqual([]);
    // an original is echoed once at most, and an echo is never itself echoed
    const originals = echoes.map((m) => m.echoOf);
    expect(new Set(originals).size).toBe(originals.length);
    for (const m of echoes) expect(MAP_MAP[m.echoOf].echoOf, `${m.echoOf} is an echo itself`).toBeFalsy();
  });

  it('the echo exemption covers a declared pair only: an undeclared copy still fails', () => {
    // a synthetic Noon echo of Blossom Court with its fountain basin dried out (the 1-10 idea)
    const court = getMap('sakura_court');
    const basin = [{ x: 8, y: 5, w: 3, h: 1, from: '~', to: '.' }];
    const dryRows = court.rows.map((r, y) => (y === 5 ? `${r.slice(0, 8)}...${r.slice(11)}` : r));
    const echo = { ...court, id: 'noon_fixture_echo', theme: 'city', rows: dryRows, echoOf: 'sakura_court', echoDiff: basin };
    // (the real echo, 1-10's noon_dry_fountain, steps aside: the fixture plays its part here)
    const MAPS_ = MAPS.filter((m) => m.echoOf !== 'sakura_court');
    expect(isDeclaredEcho(echo, court)).toBe(true);
    expect(isDeclaredEcho(court, echo)).toBe(true);
    expect(echoProblems(echo, court)).toEqual([]);
    expect(shapeClashes([...MAPS_, echo])).toEqual([]);
    // the same copy, undeclared: both shape tests catch it
    const copy = { ...echo, id: 'noon_fixture_copy', echoOf: undefined, echoDiff: undefined };
    expect(isDeclaredEcho(copy, court)).toBe(false);
    expect(silhouetteIoU(copy, court)).toBeGreaterThanOrEqual(0.65);
    const clashes = shapeClashes([...MAPS_, copy]);
    expect(clashes.some((c) => c.startsWith('silhouette sakura_court vs noon_fixture_copy'))).toBe(true);
    // a declared echo is exempt from its original only, never from a third map
    const third = { ...echo, id: 'noon_fixture_third', echoOf: 'sakura_terrace' };
    expect(shapeClashes([...MAPS_, third]).some((c) => c.includes('sakura_court vs noon_fixture_third'))).toBe(true);
    // what the echo test refuses: the same era, a moved road, a changed tile it does not list,
    // a listed tile that did not change
    expect(echoProblems({ ...echo, theme: 'lake' }, court).join()).toMatch(/another era/);
    expect(echoProblems({ ...echo, paths: [court.paths[0].slice(1)] }, court).join()).toMatch(/paths differ/);
    expect(echoProblems({ ...echo, crossings: [] }, court).join()).toMatch(/crossings differ/);
    expect(echoProblems({ ...echo, echoDiff: [] }, court).join()).toMatch(/not in echoDiff/);
    expect(echoProblems({ ...echo, echoDiff: [...basin, { x: 1, y: 1, to: ',' }] }, court).join()).toMatch(/did not change/);
    expect(echoProblems({ ...echo, echoOf: 'nope' }, undefined).join()).toMatch(/names no map/);
  });

  it('meanders are rare: at most two maps are U-bends marching across the board', () => {
    const meanders = MAPS.filter((m) => isMeander(turningSignature(m))).map((m) => m.id);
    expect(meanders.length, meanders.join(', ')).toBeLessThanOrEqual(2);
  });

  it('the turning signature tells shapes apart', () => {
    const one = (pts) => ({ tracks: [{ points: pts, cum: pts.reduce((a, p, k) => (k ? [...a, a[k - 1] + Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1])] : [0]), []), length: 0, fork: null, join: null }] });
    const sample = (fn, n = 400) => Array.from({ length: n + 1 }, (_, k) => fn(k / n));
    // a column meander (vertical runs joined by round U-bends, alternating top / bottom, marching
    // left to right like the old maps) vs one round loop
    const columns = [];
    const R = 1.5;
    for (let k = 0, x0 = 1; k < 4; k++, x0 += 2 * R) {
      const up = k % 2 === 0;
      for (let s = 0; s < 60; s++) columns.push([x0, up ? 8 - s * 0.1 : 2 + s * 0.1]);
      for (let s = 0; s < 47; s++) {
        const a = Math.PI * (1 - s / 47);
        columns.push([x0 + R + R * Math.cos(a), up ? 2 - R * Math.sin(a) : 8 + R * Math.sin(a)]);
      }
    }
    for (let s = 1; s <= 30; s++) columns.push([13, 8 - s * 0.1]);
    const meander = one(columns);
    const loop = one(sample((t) => [10 + 3 * Math.cos(t * Math.PI * 2), 5 + 3 * Math.sin(t * Math.PI * 2)]));
    for (const m of [meander, loop]) m.tracks[0].length = m.tracks[0].cum.at(-1);
    expect(isMeander(turningSignature(meander))).toBe(true);
    expect(isMeander(turningSignature(loop))).toBe(false);
    expect(turningSignature(loop)[0]).toHaveLength(1);
    expect(Math.abs(turningSignature(loop)[0][0])).toBeGreaterThan(330);
    expect(signaturesMatch(turningSignature(meander), turningSignature(loop))).toBe(false);
  });

  it('flat junctions are readable: at least 2 tiles apart', () => {
    for (const m of MAPS) {
      const flat = m.crossings.filter((c) => c.mode === 'flat');
      for (let i = 0; i < flat.length; i++) {
        for (let j = i + 1; j < flat.length; j++) {
          expect(Math.hypot(flat[i].x - flat[j].x, flat[i].y - flat[j].y), `${m.id} junctions`).toBeGreaterThanOrEqual(2);
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

  it('rooftops (U) are a tile of their own: never cleared under a road, so a road over a roof fails', () => {
    expect(TILE_CHARS.has('U')).toBe(true);
    // a fixture: a 2×2 roof beside the road and a roof tile the road runs over
    const rows = [
      '..........',
      '..UU......',
      '..UU......',
      '..........',
      '......U...',
      '..........',
      '..........',
      '..........',
      '..........',
    ];
    const m = defineMap({ id: 'fixture_roofs', name: 'Roofs', theme: 'city', tier: 'beginner', rows, paths: [[[-1, 4.5], [11, 4.5]]], decor: [] });
    expect(m.rows[1]).toBe('..UU......');
    const onRoad = [...pathTiles(m)].filter((k) => {
      const [x, y] = k.split(',').map(Number);
      return m.rows[y]?.[x] === 'U';
    });
    expect(onRoad).toEqual(['6,4']); // kept: the path test above refuses it
    // a roof is land for the build counts
    const flat = defineMap({ id: 'fixture_flat', name: 'Flat', theme: 'city', tier: 'beginner', rows: rows.map((r) => r.replace(/U/g, '.')), paths: [[[-1, 4.5], [11, 4.5]]] });
    const roofs = defineMap({ id: 'fixture_roofs2', name: 'Roofs', theme: 'city', tier: 'beginner', rows: rows.map((r, y) => (y === 4 ? '..........' : r)), paths: [[[-1, 4.5], [11, 4.5]]] });
    expect(buildableTiles(roofs)).toEqual(buildableTiles(flat));
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

  it('composed ground features are valid and sit where they make sense', () => {
    const tiles = (m) => pathTiles(m);
    for (const m of MAPS) {
      for (const f of m.ground || []) {
        expect(['vat', 'icefall', 'runeRing'], `${m.id} ground ${f.type}`).toContain(f.type);
        if (f.type === 'vat') {
          // a machined tank: a whole rectangle of water or molten metal, off the road
          for (let y = f.y; y < f.y + f.h; y++) {
            for (let x = f.x; x < f.x + f.w; x++) {
              expect(['~', 'X'], `${m.id} vat tile ${x},${y}`).toContain(m.rows[y][x]);
              expect(tiles(m).has(`${x},${y}`), `${m.id} vat tile ${x},${y} on path`).toBe(false);
            }
          }
        } else if (f.type === 'icefall') {
          // the frozen falls hang over the head of a river
          const y = Math.floor(f.y);
          let wet = 0;
          for (let x = Math.floor(f.x0); x < f.x1; x++) if ('~B'.includes(m.rows[y]?.[x])) wet++;
          expect(wet, `${m.id} icefall over water`).toBeGreaterThanOrEqual(2);
        } else if (f.type === 'runeRing') {
          // marks a junction: some crossing lies inside the circle
          expect(m.crossings.some((c) => Math.hypot(c.x - f.x, c.y - f.y) < f.r * 0.5), `${m.id} rune ring on a crossing`).toBe(true);
        }
      }
    }
  });

  it('has map variety: multi-lane, crossings and water maps', () => {
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

/**
 * Every stage that must be cleared, directly or through its own requirements, before `id` opens (its unlock
 * ancestors). The campaign's "earlier" is this set, never an array index: an Act II stage appended after 8-5 is not
 * "after" 8-5 (docs/CAMPAIGN.md "Act II").
 */
const ancestorMemo = new Map();
function unlockAncestors(id) {
  if (ancestorMemo.has(id)) return ancestorMemo.get(id);
  const out = new Set();
  const stack = [...stageRequires(id)];
  while (stack.length) {
    const r = stack.pop();
    if (out.has(r)) continue;
    out.add(r);
    stack.push(...stageRequires(r));
  }
  ancestorMemo.set(id, out);
  return out;
}

describe('stages', () => {
  const campaign = campaignStages();
  const act1 = campaign.filter((s) => s.act === 1);
  const act2 = campaign.filter((s) => s.act === 2);

  it('has the expected stage counts and lookup helpers', () => {
    // 40 Act I + the registered Act II stages (none yet: Gate Arc S1a)
    expect(act1.length).toBe(40);
    expect(act2.length).toBe(CHAPTERS.reduce((n, c) => n + c.act2.length, 0));
    expect(campaign.length).toBe(40 + act2.length);
    expect(campaign.every((s) => s.act === 1 || s.act === 2)).toBe(true);
    expect(stagesOfKind('resource').length).toBe(15);
    expect(stagesOfKind('boss').map((s) => s.id).sort()).toEqual(['boss-ashwing', 'boss-colossus', 'boss-lych']);
    expect(stagesOfKind('challenge').map((s) => s.id)).toEqual(['challenge']);
    expect(STAGES.length).toBe(59 + act2.length);
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
      for (const sid of c.stages) expect(getStage(sid)).toMatchObject({ chapter: c.id, act: 1, finale: sid === `${c.id}-5` });
      // Act II: only registered c-6 … c-10 ids, in order; its row needs its header text once it has stages
      expect(Array.isArray(c.act2)).toBe(true);
      expect(c.act2).toEqual([6, 7, 8, 9, 10].map((n) => `${c.id}-${n}`).slice(0, c.act2.length));
      for (const sid of c.act2) expect(getStage(sid)).toMatchObject({ chapter: c.id, act: 2, finale: sid === `${c.id}-10` });
      if (c.act2.length) for (const k of ['act2Name', 'act2Theme', 'act2Desc']) expect(c[k], `chapter ${c.id} ${k}`).toBeTruthy();
    });
    // CAMPAIGN_IDS: Act I first (1-1 … 8-5, unchanged), then Act II by (chapter, n)
    expect(CAMPAIGN_IDS).toEqual([...CHAPTERS.flatMap((c) => c.stages), ...CHAPTERS.flatMap((c) => c.act2)]);
    expect(campaign.map((s) => s.id)).toEqual(CAMPAIGN_IDS);
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
      expect(Object.keys(wg).filter((k) => k !== 'laneCycle').sort()).toEqual(['budget', 'fixed', 'groups', 'pool', 'spacing']);
      // a lane schedule (Gate Arc) only on a map with at least two lanes, each entry naming real lanes
      if (wg.laneCycle) {
        const lanes = getMap(s.mapId).paths.length;
        expect(lanes, `${s.id} laneCycle on a one-lane map`).toBeGreaterThanOrEqual(2);
        for (const e of wg.laneCycle) expect(e.length > 0 && e.every((l) => Number.isInteger(l) && l >= 0 && l < lanes), `${s.id} laneCycle`).toBe(true);
      }
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
      // requires: null, one stage id or (an Act II x-6) a list of two, read through stageRequires
      expect(s.requires === null || typeof s.requires === 'string' || (Array.isArray(s.requires) && s.requires.length === 2), `${s.id} requires`).toBe(true);
      for (const r of stageRequires(s)) expect(STAGE_MAP[r], `${s.id} requires ${r}`).toBeTruthy();
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

  it('Act I requires-chain, hpScale, waves and start cash ramp (§5b)', () => {
    act1.forEach((s, i) => {
      expect(s.requires).toBe(i === 0 ? null : act1[i - 1].id);
      if (i > 0) {
        // the base ramp is monotonic; the hero-rework HP pass (hpPass, per stage) sits on top of it
        expect(s.hpScale / s.hpPass, s.id).toBeGreaterThanOrEqual(act1[i - 1].hpScale / act1[i - 1].hpPass - 0.01);
        expect(s.hpPass, s.id).toBeGreaterThanOrEqual(1);
        expect(s.waves, s.id).toBeGreaterThanOrEqual(act1[i - 1].waves - 2);
        expect(s.startCash, s.id).toBeGreaterThanOrEqual(700);
        expect(s.startCash, s.id).toBeLessThanOrEqual(900);
      }
      expect(s.medalGemMul, s.id).toBeUndefined();
      expect(s.modeChapter, s.id).toBeUndefined();
    });
    expect(act1[0].hpScale / act1[0].hpPass).toBe(1);
    expect(act1[0].startCash).toBe(650);
    expect(act1[0].waves).toBe(12);
    expect(act1[39].id).toBe('8-5');
    expect(act1[39].hpScale / act1[39].hpPass).toBeGreaterThanOrEqual(6);
    expect(act1[39].hpScale / act1[39].hpPass).toBeLessThanOrEqual(7);
    expect(act1[39].waves).toBe(30);
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

  it('Act II chain and ramp (ACT2_PLAN, and every registered Act II stage follows it)', () => {
    for (const ch of CHAPTERS) {
      const rows = ACT2_PLAN.filter((r) => r.chapter === ch.id);
      expect(rows.map((r) => r.id)).toEqual([6, 7, 8, 9, 10].map((n) => `${ch.id}-${n}`));
      // x-6: two keys (x-5 and the previous chapter's x-10; 1-6 only 1-5); x-7 … x-10: the Act II stage before
      expect(rows[0].requires).toEqual(ch.id === 1 ? '1-5' : [`${ch.id}-5`, `${ch.id - 1}-10`]);
      for (let k = 1; k < 5; k++) {
        expect(rows[k].requires).toBe(rows[k - 1].id);
        expect(rows[k].hpScale, rows[k].id).toBeGreaterThanOrEqual(rows[k - 1].hpScale);
        expect(rows[k].hpScale / rows[k].hpPass, rows[k].id).toBeGreaterThanOrEqual(rows[k - 1].hpScale / rows[k - 1].hpPass);
      }
      for (const r of rows) {
        if (ch.id < 8) expect(r.waves, r.id).toBe(getStage(`${ch.id + 1}-${r.k}`).waves);
        expect(r.startCash, r.id).toBeLessThanOrEqual(900);
      }
    }
    for (const s of act2) {
      const r = ACT2_PLAN_MAP[s.id];
      expect(r, s.id).toBeTruthy();
      expect(s).toMatchObject({ waves: r.waves, hpScale: r.hpScale, hpPass: r.hpPass, cashScale: r.cashScale, startCash: r.startCash, tier: r.tier, medalGemMul: 0.5, modeChapter: r.modeChapter });
      expect(stageRequires(s)).toEqual(Array.isArray(r.requires) ? [...r.requires] : [r.requires]);
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
    expect(fixedHas('1-10', 'slime_frost_heir')).toBe(true);
    expect(fixedHas('2-10', 'lizard_lamp_hugger')).toBe(true);
    expect(fixedHas('3-10', 'ghost_ashen_warden')).toBe(true);
    expect(fixedHas('4-5', 'orc_general')).toBe(true);
    expect(fixedHas('6-5', 'goblin_machine')).toBe(true);
    expect(fixedHas('7-5', 'oni_champion')).toBe(true);
    expect(fixedHas('8-5', 'dragon_ashwing')).toBe(true);
    const drops = (sid) => getStage(sid).drops.map((d) => d.item);
    expect(drops('1-5')).toContain('crown_slime');
    expect(drops('1-10')).toContain('crown_slime');
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
    // "earlier" = an unlock ancestor (stageRequires, transitive), never an index in CAMPAIGN_IDS: an Act II stage of
    // chapter 1 sits right after 1-5, so a chapter-3 recruit never counts for it (A15)
    const available = (s) => UNITS.filter((u) => u.acquisition.type === 'starter'
      || (u.acquisition.type === 'free' && unlockAncestors(s.id).has(u.acquisition.afterStage)));
    const provides = (u, cap) => {
      const b = u.base;
      if (cap === 'detection') return !!(b.detection || b.aura?.detection) || u.capabilities.includes('detection') || u.pathCapabilities.includes('detection');
      if (cap === 'antiAir') return b.canHitAir === true || u.capabilities.includes('antiAir') || u.pathCapabilities.includes('antiAir');
      if (cap === 'water') return u.placement === 'water' || u.placement === 'amphibious';
      return u.capabilities.includes(cap) || u.pathCapabilities.includes(cap);
    };
    campaign.forEach((s) => {
      const units = available(s);
      const traits = new Set(stageEnemies(s).flatMap((id) => enemyTraits(id)));
      if (traits.has('veiled')) expect(units.some((u) => provides(u, 'detection')), `${s.id} detection`).toBe(true);
      if (traits.has('airborne')) expect(units.some((u) => provides(u, 'antiAir')), `${s.id} antiAir`).toBe(true);
      if (s.chapter >= 2) expect(units.some((u) => provides(u, 'water')), `${s.id} water unit`).toBe(true);
      for (const cap of s.recommended) expect(units.some((u) => provides(u, cap)), `${s.id} recommends ${cap}`).toBe(true);
    });
    // Each free recruit arrives right before the mechanic it counters.
    const firstWith = (trait, tier = null) => campaign.find((s) => stageEnemies(s)
      .some((id) => enemyTraits(id).includes(trait) && (!tier || getEnemy(id).tier === tier))).id;
    const before = (a, b) => unlockAncestors(b).has(a);
    expect(before('1-2', firstWith('hasty'))).toBe(true); // Yuki
    expect(firstWith('veiled')).toBe('3-1'); // Kage after 2-5
    expect(firstWith('armored', 'normal')).toBe('4-1'); // Shiro after 3-5 (armored elites before then are light)
    expect(firstWith('siphon')).toBe('5-1'); // Midori after 4-5
    expect(firstWith('sabotage')).toBe('6-3'); // Suzu after 5-5
    expect(firstWith('airborne')).toBe('8-1');
  });

  it('every enemy appears in at least one stage', () => {
    const all = new Set(STAGES.flatMap((s) => stageEnemies(s)));
    for (const e of CAMPAIGN_ENEMIES) expect(all.has(e.id), e.id).toBe(true);
    for (const e of ENEMIES.filter(FREEPLAY_ONLY)) expect(all.has(e.id), `${e.id} is freeplay-only`).toBe(false);
  });
});
