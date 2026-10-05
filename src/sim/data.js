// Default data resolution for the sim. Data files are owned by other areas and may be
// missing or stubbed while the game is being assembled, so they are loaded through an
// eager glob (resolved statically by Vite/Vitest; a missing file simply yields nothing).
// Tests pass inline fixtures through `new Sim({ data })` and never need these.

const MODULES = import.meta.glob(
  ['../data/units.js', '../data/enemies.js', '../data/maps.js', '../data/stages.js'],
  { eager: true },
);

function mod(name) {
  return MODULES[`../data/${name}.js`] || {};
}

function indexById(list) {
  const out = {};
  if (Array.isArray(list)) for (const item of list) if (item && item.id != null) out[item.id] = item;
  return out;
}

let cache = null;

/** Lazily built lookup tables of the real game data ({} when a file is missing). */
export function defaultData() {
  if (cache) return cache;
  const units = mod('units');
  const enemies = mod('enemies');
  const maps = mod('maps');
  const stages = mod('stages');
  cache = {
    units: units.UNIT_MAP && Object.keys(units.UNIT_MAP).length ? units.UNIT_MAP : indexById(units.UNITS),
    enemies: enemies.ENEMY_MAP && Object.keys(enemies.ENEMY_MAP).length ? enemies.ENEMY_MAP : indexById(enemies.ENEMIES),
    maps: indexById(maps.MAPS),
    stages: stages.STAGE_MAP && Object.keys(stages.STAGE_MAP).length ? stages.STAGE_MAP : indexById(stages.STAGES),
  };
  return cache;
}

/** True when the real data files are present and populated (used by smoke tests). */
export function hasRealData() {
  const d = defaultData();
  return Object.keys(d.units).length > 0 && Object.keys(d.enemies).length > 0
    && Object.keys(d.maps).length > 0 && Object.keys(d.stages).length > 0;
}

/**
 * Builds the lookup object a Sim uses. Overrides win; anything missing falls back to the
 * real data files.
 * @param {string} stageId
 * @param {{ stage?, map?, units?, enemies?, maps?, stages? }} overrides
 */
export function createDataSource(stageId, overrides = {}) {
  const d = defaultData();
  const units = overrides.units || {};
  const enemies = overrides.enemies || {};
  const maps = overrides.maps || {};
  const stages = overrides.stages || {};
  const stage = overrides.stage || stages[stageId] || d.stages[stageId] || null;
  if (!stage) throw new Error(`[sim] unknown stage "${stageId}"`);
  const map = overrides.map || maps[stage.mapId] || d.maps[stage.mapId] || null;
  if (!map) throw new Error(`[sim] unknown map "${stage.mapId}" for stage "${stage.id}"`);
  return {
    stage,
    map,
    unit: (id) => units[id] || d.units[id] || null,
    enemy: (id) => enemies[id] || d.enemies[id] || null,
  };
}
