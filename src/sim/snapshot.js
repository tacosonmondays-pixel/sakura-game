// Battle snapshots (CONTRACTS.md §6): the whole state of a running Sim as plain JSON, and back.
// Co-op uses them as wave-boundary checkpoints (src/online/coop/lockstep.js): a client that has to
// rebuild a long freeplay run restores the newest checkpoint and replays only the commands since,
// instead of replaying an hour of battle from tick 0.
//
// The serializer is generic on purpose: it stores every own field of the Sim (and everything
// reachable from them: towers, enemies, projectiles, traps, statuses, the rng state…) except the
// ones its constructor rebuilds (REBUILT), so a field added to the Sim later is saved without
// anyone remembering to list it. tests/sim/snapshot.test.js restores snapshots into fresh Sims and
// runs both copies on for thousands of ticks, comparing the full state: a field this file cannot
// store throws, and one it stores wrongly shows up there.
//   - Shared objects stay shared and cycles are fine: every object is stored once and referred to
//     by its index.
//   - Game data is never copied: a unit or enemy definition (and anything inside one), the
//     difficulty and the stage are stored as a path (['u', 'aoi', 'paths', 0, …]) and resolved in
//     the restoring Sim's own data, so identity comparisons and the data hash keep working. So is
//     the battle's configuration (`config`: the players' loadout stats, the hero config): a girl's
//     unitStats points at her player's own loadout entry again after a restore.
//   - Numbers JSON cannot spell (±Infinity, NaN, -0) are tagged; everything else is a double that
//     JSON round-trips exactly in every engine, so a snapshot taken on one JS engine restores
//     bit-identical on another.
//   - The current wave's spawn list is not stored: it is regenerated (wave tables are pure).
//
// Format: { v, root, o } — `o` holds one entry per object, `root` is the Sim's fields. A value is
// a JSON primitive, [i] (the object o[i]), or a tag: ['n', 'inf' | '-inf' | 'nan' | '-0'],
// ['u'] (undefined), ['h'] (an array hole). Entries: ['o', {k: value}], ['a', [value…]],
// ['m', [key, value, …]] (Map), ['S', [value…]] (Set), ['r', seed, state] (an rng),
// ['s', path] (game data or configuration), ['c', className, {k: value}] (a class instance from CLASSES),
// ['w', wave] (that wave's spawn list).
import { SpatialGrid } from './grid.js';
import { createRng } from '../core/rng.js';

export const SNAPSHOT_VERSION = 1;

/**
 * Sim fields the constructor builds from its arguments (stage, map, loadout, options) or that
 * carry nothing from one step to the next (the event queue the renderer drains, scratch arrays,
 * caches). Everything else is battle state and goes into the snapshot.
 */
// heroConfigs: built from the start arguments; _heroConfig: the VIEWING player's hero (a host's
// checkpoint must not give the guest the host's hero in the HUD); _stepping: false between steps.
export const REBUILT = Object.freeze(['data', 'stage', 'map', 'pathData', 'paths', 'pathTiles', 'placement', '_waveCache', 'events', '_scratch', '_scratch2', 'loadout', 'heroConfigs', '_heroConfig', '_stepping', '_capSources']);
const REBUILT_SET = new Set(REBUILT);

/** Classes a snapshot may hold (restored with their own prototype, fields as stored). */
const CLASSES = { SpatialGrid };
const CLASS_NAMES = new Map(Object.entries(CLASSES).map(([name, C]) => [C.prototype, name]));

const isObj = (v) => v !== null && typeof v === 'object';
function isPlain(o) {
  const p = Object.getPrototypeOf(o);
  return p === Object.prototype || p === null;
}
const isRng = (o) => typeof o.next === 'function' && typeof o.getState === 'function' && typeof o.setState === 'function';

// ---------------------------------------------------------------------------
// Game data: which objects are definitions (stored as paths, never copied)
// ---------------------------------------------------------------------------

/** Per Sim: object → { up, key } (up = parent object, null at a root whose key is the root path). */
const INDEX = new WeakMap();

function dataIndex(sim) {
  let nodes = INDEX.get(sim);
  if (!nodes) {
    nodes = new Map();
    INDEX.set(sim, nodes);
    addTree(nodes, sim.diff, ['diff']);
    addTree(nodes, sim.stage, ['stage']);
  }
  return nodes;
}

function addTree(nodes, root, rootPath) {
  if (!isObj(root) || nodes.has(root)) return;
  nodes.set(root, { up: null, key: rootPath });
  const stack = [root];
  while (stack.length) {
    const o = stack.pop();
    const arr = Array.isArray(o);
    if (!arr && !isPlain(o)) continue;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (!isObj(v) || nodes.has(v) || (!Array.isArray(v) && !isPlain(v))) continue;
      nodes.set(v, { up: o, key: arr ? Number(k) : k });
      stack.push(v);
    }
  }
}

function pathOf(nodes, o) {
  const keys = [];
  let n = nodes.get(o);
  while (n.up) {
    keys.push(n.key);
    n = nodes.get(n.up);
  }
  return [...n.key, ...keys.reverse()];
}

/** The definition `o` is, as a root path, or null. */
function defPath(sim, o) {
  if (typeof o.id !== 'string') return null;
  if (sim.data.unit(o.id) === o) return ['u', o.id];
  if (sim.data.enemy(o.id) === o) return ['e', o.id];
  return null;
}

function resolveData(sim, config, path) {
  let o;
  let i;
  if (path[0] === 'cfg') {
    o = config;
    i = 1;
  } else if (path[0] === 'u' || path[0] === 'e') {
    o = path[0] === 'u' ? sim.data.unit(path[1]) : sim.data.enemy(path[1]);
    i = 2;
  } else if (path[0] === 'diff' || path[0] === 'stage') {
    o = sim[path[0]];
    i = 1;
  }
  for (; o != null && i < path.length; i++) o = o[path[i]];
  if (!isObj(o)) throw new Error(`[snapshot] no game data at ${JSON.stringify(path)}`);
  return o;
}

/** Children of a state object (for the pass that finds the definitions it uses). */
function eachChild(o, fn) {
  if (o instanceof Map) {
    for (const [k, v] of o) {
      fn(k);
      fn(v);
    }
  } else if (o instanceof Set) {
    for (const v of o) fn(v);
  } else if (Array.isArray(o)) {
    for (let i = 0; i < o.length; i++) fn(o[i]);
  } else {
    for (const k of Object.keys(o)) fn(o[k]);
  }
}

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

/**
 * A solo Sim's configuration: its loadout's stats and the hero config (co-op passes every player's,
 * src/online/coop/commands.js). The restoring side passes the same shape built from the same
 * start, so references into it survive a restore.
 */
export function simConfig(sim) {
  return { loadout: Object.fromEntries(sim.loadout || []), heroes: sim.heroConfigs || [] };
}

/** Every own field of the Sim but the rebuilt ones, in their own order. */
function stateKeys(sim) {
  return Object.keys(sim).filter((k) => !REBUILT_SET.has(k));
}

/**
 * The Sim's whole battle state as plain JSON (no reference into the live battle: it can be kept,
 * sent and restored later). Taken between steps (after update(), before the next commands).
 * @param {import('./Sim.js').Sim} sim
 * @param {object} [config] the battle's configuration objects (default simConfig(sim))
 * @returns {{ v: number, root: any, o: any[] }}
 */
export function snapshotSim(sim, config = simConfig(sim)) {
  const nodes = dataIndex(sim);
  const cfg = new Map();
  addTree(cfg, config, ['cfg']);
  const spawns = sim.wave > 0 ? sim._waveCache?.get(sim.wave)?.spawns : undefined;
  // 1. the definitions this state points at (their insides are game data too)
  const seen = new Set();
  const stack = stateKeys(sim).map((k) => sim[k]);
  while (stack.length) {
    const v = stack.pop();
    if (!isObj(v) || seen.has(v) || nodes.has(v) || cfg.has(v) || v === spawns) continue;
    seen.add(v);
    const path = !Array.isArray(v) && defPath(sim, v);
    if (path) {
      addTree(nodes, v, path);
      continue;
    }
    if (isRng(v)) continue;
    eachChild(v, (c) => stack.push(c));
  }
  // 2. the state, every object once
  const ids = new Map();
  const out = [];
  const where = (path, k) => `${path}.${k}`;

  function value(v, path) {
    switch (typeof v) {
      case 'number':
        if (Number.isFinite(v)) return Object.is(v, -0) ? ['n', '-0'] : v;
        return ['n', Number.isNaN(v) ? 'nan' : v > 0 ? 'inf' : '-inf'];
      case 'string':
      case 'boolean':
        return v;
      case 'undefined':
        return ['u'];
      case 'object':
        return v === null ? null : [ref(v, path)];
      default:
        throw new Error(`[snapshot] cannot store a ${typeof v} at ${path}`);
    }
  }

  function ref(o, path) {
    let i = ids.get(o);
    if (i !== undefined) return i;
    i = out.length;
    ids.set(o, i);
    out.push(null);
    out[i] = entry(o, path);
    return i;
  }

  function fields(o, path) {
    const rec = {};
    for (const k of Object.keys(o)) {
      if (k === '__proto__') throw new Error(`[snapshot] a "__proto__" key at ${path}`);
      rec[k] = value(o[k], where(path, k));
    }
    return rec;
  }

  function entry(o, path) {
    if (nodes.has(o)) return ['s', pathOf(nodes, o)];
    if (cfg.has(o)) return ['s', pathOf(cfg, o)];
    if (o === spawns) return ['w', sim.wave];
    if (Array.isArray(o)) {
      const a = new Array(o.length);
      for (let j = 0; j < o.length; j++) a[j] = j in o ? value(o[j], `${path}[${j}]`) : ['h'];
      return ['a', a];
    }
    if (o instanceof Map) {
      const a = [];
      for (const [k, v] of o) a.push(value(k, `${path}<key>`), value(v, `${path}<${String(k)}>`));
      return ['m', a];
    }
    if (o instanceof Set) {
      const a = [];
      for (const v of o) a.push(value(v, `${path}<item>`));
      return ['S', a];
    }
    if (isRng(o)) return ['r', o.seed, o.getState()];
    if (isPlain(o)) return ['o', fields(o, path)];
    const cls = CLASS_NAMES.get(Object.getPrototypeOf(o));
    if (cls) return ['c', cls, fields(o, path)];
    throw new Error(`[snapshot] cannot store a ${o.constructor?.name || 'object'} at ${path}`);
  }

  const root = {};
  for (const k of stateKeys(sim)) root[k] = value(sim[k], k);
  return { v: SNAPSHOT_VERSION, root, o: out };
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

/**
 * Puts a snapshot's state into a Sim built with the same arguments as the one it was taken from
 * (stage, difficulty, loadout, hero, seed, options): every stored field is replaced; the event
 * queue and the scratch arrays start empty.
 * @param {import('./Sim.js').Sim} sim
 * @param {{ v: number, root: any, o: any[] }} snap
 * @param {object} [config] this side's configuration, the same shape snapshotSim got
 * @returns {import('./Sim.js').Sim}
 */
export function restoreSim(sim, snap, config = simConfig(sim)) {
  if (!snap || snap.v !== SNAPSHOT_VERSION || !Array.isArray(snap.o) || !isObj(snap.root)) throw new Error('[snapshot] not a battle snapshot (or another version)');
  const src = snap.o;
  // shells first (refs may point forward and round in circles), then their contents
  const objs = src.map((e) => {
    switch (e[0]) {
      case 'o': return {};
      case 'a': return [];
      case 'm': return new Map();
      case 'S': return new Set();
      case 'r': {
        const r = createRng(e[1]);
        r.setState(e[2]);
        return r;
      }
      case 's': return resolveData(sim, config, e[1]);
      case 'w': return sim._getWave(e[1]).spawns;
      case 'c': {
        const C = CLASSES[e[1]];
        if (!C) throw new Error(`[snapshot] unknown class ${e[1]}`);
        return Object.create(C.prototype);
      }
      default: throw new Error(`[snapshot] unknown entry ${JSON.stringify(e[0])}`);
    }
  });
  const HOLE = {};
  const value = (v) => {
    if (!Array.isArray(v)) return v;
    if (typeof v[0] === 'number') return objs[v[0]];
    switch (v[0]) {
      case 'n': return v[1] === 'inf' ? Infinity : v[1] === '-inf' ? -Infinity : v[1] === '-0' ? -0 : NaN;
      case 'u': return undefined;
      case 'h': return HOLE;
      default: throw new Error(`[snapshot] unknown value tag ${JSON.stringify(v[0])}`);
    }
  };
  const fill = (target, rec) => {
    for (const k of Object.keys(rec)) target[k] = value(rec[k]);
  };
  src.forEach((e, i) => {
    const o = objs[i];
    switch (e[0]) {
      case 'o':
        fill(o, e[1]);
        break;
      case 'c':
        fill(o, e[2]);
        break;
      case 'a':
        o.length = e[1].length;
        e[1].forEach((v, j) => {
          const x = value(v);
          if (x !== HOLE) o[j] = x;
        });
        break;
      case 'm':
        for (let j = 0; j < e[1].length; j += 2) o.set(value(e[1][j]), value(e[1][j + 1]));
        break;
      case 'S':
        for (const v of e[1]) o.add(value(v));
        break;
      default:
        break;
    }
  });
  for (const k of Object.keys(snap.root)) {
    if (REBUILT_SET.has(k)) continue;
    sim[k] = value(snap.root[k]);
  }
  sim.events = [];
  sim._scratch = [];
  sim._scratch2 = [];
  delete sim._capSources;
  return sim;
}

/** FNV-1a over a snapshot's JSON, as 8 hex digits (equal snapshots ⇔ equal battle states). */
export function snapshotDigest(snap) {
  const text = typeof snap === 'string' ? snap : JSON.stringify(snap);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
