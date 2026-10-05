// Profile creation, migration and import/export (owner: systems). See CONTRACTS.md §5.
//
// Pure functions: no DOM / localStorage here (src/core/store.js persists the profile).

import { UNIT_MAP, UNITS } from '../data/units.js';
import { ITEMS } from '../data/items.js';
import { GEAR_SLOTS, GEAR_STATS, ITEM_RARITIES, DIFFICULTY_ORDER, BATTLE } from '../data/types.js';

export const SAVE_KEY = 'sakura-sentinels-save-v1';
/** v1 = pre-release stub profile, v2 = full systems profile. */
export const SAVE_VERSION = 2;

export const STARTER_UNITS = ['hikari', 'aoi', 'rei'];
const HISTORY_LIMIT = 100;
const SLOTS = Object.keys(GEAR_SLOTS);

/** Default settings (also used to repair partial settings). */
export const DEFAULT_SETTINGS = {
  quality: 'high',
  shadows: true,
  bloom: true,
  music: true,
  sfx: true,
  volume: 0.8,
  showRanges: true,
  autoStart: false,
  defaultSpeed: 1,
  lighting: { exposure: 1, warmth: 0 },
  reduceMotion: false,
};

/** Fresh per-unit state. */
export function newUnitState(now = Date.now()) {
  return { level: 1, exp: 0, breakthrough: 0, awaken: 0, gear: { charm: null, ribbon: null, shoes: null }, obtainedAt: now, favorite: false };
}

function emptyMissions() {
  return {
    day: null,
    daily: {},
    dailyClaimed: [],
    week: null,
    weekly: {},
    weeklyClaimed: [],
    login: { lastDay: null, streak: 0, claimedDays: [] },
    achievements: {},
    counters: {},
  };
}

/**
 * Fresh profile: Hikari, Aoi and Rei owned, formation set, 2400 gems + one 10× ticket,
 * starter coins, books and the starters' common materials.
 * @returns {object} Profile
 */
export function createProfile() {
  const now = Date.now();
  const units = {};
  for (const id of STARTER_UNITS) units[id] = newUnitState(now);
  return {
    version: SAVE_VERSION,
    createdAt: now,
    currencies: { coins: 20000, gems: 2400 },
    items: {
      ticket_recruit10: 1,
      book_common: 20,
      book_rare: 5,
      mat_feather_common: 10,
      mat_blade_common: 10,
      mat_charm_common: 10,
    },
    units,
    gear: {},
    gacha: { pity: 0, totalPulls: 0, recruitPoints: 0, history: [] },
    progress: { stages: {} },
    bestiary: {},
    formation: { hero: 'hikari', towers: ['aoi', 'rei'] },
    missions: emptyMissions(),
    shop: { day: null, week: null, bought: {} },
    redeemed: [],
    settings: structuredCloneSafe(DEFAULT_SETTINGS),
    secretary: 'hikari',
    stats: { battles: 0, wins: 0, kills: 0, pulls: 0, gemsEarned: 0 },
    seenIntro: [],
    seq: { gear: 0 },
  };
}

function structuredCloneSafe(v) {
  return JSON.parse(JSON.stringify(v));
}

// ---------------------------------------------------------------------------
// Sanitizers
// ---------------------------------------------------------------------------

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const num = (v, def = 0, min = -Infinity, max = Infinity) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
};
const int = (v, def = 0, min = -Infinity, max = Infinity) => Math.floor(num(v, def, min, max));
const bool = (v, def = false) => (typeof v === 'boolean' ? v : def);
const str = (v, def = null) => (typeof v === 'string' ? v : def);
const strList = (v, limit = 1000) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string'))].slice(0, limit) : []);

function cleanCounts(obj, allow = () => true) {
  const out = {};
  if (!isObj(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    const n = int(v, 0, 0);
    if (n > 0 && allow(k)) out[k] = n;
  }
  return out;
}

function cleanNumberMap(obj) {
  const out = {};
  if (!isObj(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    const n = num(v, NaN);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function cleanUnit(raw, now) {
  const base = newUnitState(now);
  if (!isObj(raw)) return base;
  const breakthrough = int(raw.breakthrough, 0, 0, 5);
  const cap = Math.min(60, 10 + 10 * breakthrough);
  const gear = { charm: null, ribbon: null, shoes: null };
  if (isObj(raw.gear)) for (const s of SLOTS) gear[s] = str(raw.gear[s]);
  return {
    level: int(raw.level, 1, 1, cap),
    exp: int(raw.exp, 0, 0),
    breakthrough,
    awaken: int(raw.awaken, 0, 0, 5),
    gear,
    obtainedAt: num(raw.obtainedAt, now, 0),
    favorite: bool(raw.favorite),
  };
}

function cleanStat(raw) {
  if (!isObj(raw) || !GEAR_STATS[raw.stat]) return null;
  const out = { stat: raw.stat, value: num(raw.value, 0, 0) };
  if (raw.base != null) out.base = num(raw.base, out.value, 0);
  if (raw.upgrades != null) out.upgrades = int(raw.upgrades, 0, 0, 10);
  return out;
}

function cleanGear(raw, uid) {
  if (!isObj(raw) || !GEAR_SLOTS[raw.slot] || !ITEM_RARITIES[raw.rarity]) return null;
  const main = cleanStat(raw.main);
  if (!main) return null;
  const seen = new Set([main.stat]);
  const subs = [];
  for (const s of Array.isArray(raw.subs) ? raw.subs : []) {
    const c = cleanStat(s);
    if (c && !seen.has(c.stat)) {
      seen.add(c.stat);
      subs.push(c);
    }
  }
  return {
    uid,
    slot: raw.slot,
    rarity: raw.rarity,
    level: int(raw.level, 0, 0, 10),
    main,
    subs: subs.slice(0, 4),
    locked: bool(raw.locked),
    equippedBy: str(raw.equippedBy),
    name: str(raw.name, `${ITEM_RARITIES[raw.rarity].name} ${GEAR_SLOTS[raw.slot].name}`),
  };
}

function cleanSettings(raw) {
  const d = DEFAULT_SETTINGS;
  const s = isObj(raw) ? raw : {};
  const lighting = isObj(s.lighting) ? s.lighting : {};
  return {
    quality: ['high', 'medium', 'low'].includes(s.quality) ? s.quality : d.quality,
    shadows: bool(s.shadows, d.shadows),
    bloom: bool(s.bloom, d.bloom),
    music: typeof s.music === 'number' ? num(s.music, 0.6, 0, 1) : bool(s.music, d.music),
    sfx: typeof s.sfx === 'number' ? num(s.sfx, 0.8, 0, 1) : bool(s.sfx, d.sfx),
    volume: num(s.volume, d.volume, 0, 1),
    showRanges: bool(s.showRanges, d.showRanges),
    autoStart: bool(s.autoStart, d.autoStart),
    defaultSpeed: [1, 2, 3].includes(s.defaultSpeed) ? s.defaultSpeed : d.defaultSpeed,
    lighting: { exposure: num(lighting.exposure, d.lighting.exposure, 0.3, 2.5), warmth: num(lighting.warmth, d.lighting.warmth, -1, 1) },
    reduceMotion: bool(s.reduceMotion, d.reduceMotion),
  };
}

function cleanMissions(raw) {
  const m = emptyMissions();
  if (!isObj(raw)) return m;
  m.day = str(raw.day);
  m.week = str(raw.week);
  m.daily = cleanNumberMap(raw.daily);
  m.weekly = cleanNumberMap(raw.weekly);
  m.dailyClaimed = strList(raw.dailyClaimed);
  m.weeklyClaimed = strList(raw.weeklyClaimed);
  const login = isObj(raw.login) ? raw.login : {};
  m.login = {
    lastDay: str(login.lastDay),
    streak: int(login.streak, 0, 0),
    claimedDays: Array.isArray(login.claimedDays) ? [...new Set(login.claimedDays.map((d) => int(d, 0, 0, 7)).filter((d) => d >= 1))].sort((a, b) => a - b) : [],
  };
  if (isObj(raw.achievements)) for (const [k, v] of Object.entries(raw.achievements)) if (v) m.achievements[k] = true;
  m.counters = cleanNumberMap(raw.counters);
  return m;
}

/**
 * Upgrade/repair any stored profile. Never throws: missing or corrupt fields are replaced
 * with defaults, unknown units/items are dropped, references (formation, gear owners,
 * secretary) are made consistent, and the starters are always owned.
 * @param {any} raw parsed JSON (or anything)
 * @returns {object} Profile
 */
export function migrateProfile(raw) {
  const fresh = createProfile();
  if (!isObj(raw)) return fresh;
  const version = int(raw.version, 0, 0);
  // v0/v1 were pre-release stub saves without gacha/progress state: nothing worth keeping.
  if (version < 2 && !isObj(raw.gacha) && !isObj(raw.progress) && !(isObj(raw.units) && Object.keys(raw.units).length)) return fresh;

  const now = Date.now();
  const p = fresh;
  p.createdAt = num(raw.createdAt, fresh.createdAt, 0);

  const cur = isObj(raw.currencies) ? raw.currencies : {};
  p.currencies = { coins: int(cur.coins, 0, 0), gems: int(cur.gems, 0, 0) };
  p.items = cleanCounts(raw.items, (id) => ITEMS[id] && ITEMS[id].category !== 'currency');

  // Units (only known ids). Starters are always owned.
  p.units = {};
  if (isObj(raw.units)) for (const [id, u] of Object.entries(raw.units)) if (UNIT_MAP[id]) p.units[id] = cleanUnit(u, now);
  for (const id of STARTER_UNITS) if (!p.units[id]) p.units[id] = newUnitState(now);

  // Gear + equip consistency.
  p.gear = {};
  if (isObj(raw.gear)) {
    for (const [uid, g] of Object.entries(raw.gear)) {
      const c = cleanGear(g, uid);
      if (c) p.gear[uid] = c;
    }
  }
  for (const g of Object.values(p.gear)) {
    const owner = g.equippedBy && p.units[g.equippedBy];
    if (!owner || owner.gear[g.slot] !== g.uid) g.equippedBy = null;
  }
  for (const [unitId, u] of Object.entries(p.units)) {
    for (const s of SLOTS) {
      const g = u.gear[s] && p.gear[u.gear[s]];
      if (!g || g.slot !== s) u.gear[s] = null;
      else if (!g.equippedBy) g.equippedBy = unitId;
      else if (g.equippedBy !== unitId) u.gear[s] = null;
    }
  }
  const seq = isObj(raw.seq) ? int(raw.seq.gear, 0, 0) : 0;
  const maxUid = Object.keys(p.gear).reduce((m, uid) => Math.max(m, int(uid.replace(/^\D+/, ''), 0, 0)), 0);
  p.seq = { gear: Math.max(seq, maxUid) };

  // Gacha.
  const g = isObj(raw.gacha) ? raw.gacha : {};
  p.gacha = {
    pity: int(g.pity, 0, 0, 89),
    totalPulls: int(g.totalPulls, 0, 0),
    recruitPoints: int(g.recruitPoints, 0, 0),
    history: (Array.isArray(g.history) ? g.history : [])
      .filter((h) => isObj(h) && UNIT_MAP[h.unitId])
      .map((h) => ({ unitId: h.unitId, rarity: UNIT_MAP[h.unitId].rarity, at: num(h.at, 0, 0) }))
      .slice(-HISTORY_LIMIT),
  };

  // Progress.
  p.progress = { stages: {} };
  const stages = isObj(raw.progress) && isObj(raw.progress.stages) ? raw.progress.stages : {};
  for (const [id, s] of Object.entries(stages)) {
    if (!isObj(s)) continue;
    const entry = { clears: int(s.clears, 0, 0) };
    for (const d of DIFFICULTY_ORDER) entry[d] = bool(s[d]);
    if (s.bestWave != null) entry.bestWave = int(s.bestWave, 0, 0);
    p.progress.stages[id] = entry;
  }

  // Bestiary.
  p.bestiary = {};
  if (isObj(raw.bestiary)) {
    for (const [id, b] of Object.entries(raw.bestiary)) {
      if (!isObj(b)) continue;
      const discovered = bool(b.discovered);
      p.bestiary[id] = { seen: bool(b.seen) || discovered, discovered, kills: int(b.kills, 0, 0) };
    }
  }

  // Formation: owned units only, hero must be a hero, towers unique and ≤ 8.
  const f = isObj(raw.formation) ? raw.formation : {};
  const heroId = str(f.hero);
  p.formation = {
    hero: heroId && p.units[heroId] && UNIT_MAP[heroId].kind === 'hero' ? heroId : heroId === null && 'hero' in f ? null : 'hikari',
    towers: strList(f.towers).filter((id) => p.units[id] && UNIT_MAP[id].kind === 'tower').slice(0, BATTLE.maxTowers),
  };
  if (!Array.isArray(f.towers)) p.formation.towers = ['aoi', 'rei'];

  p.missions = cleanMissions(raw.missions);
  const shop = isObj(raw.shop) ? raw.shop : {};
  p.shop = { day: str(shop.day), week: str(shop.week), bought: cleanCounts(shop.bought) };
  p.redeemed = strList(raw.redeemed);
  p.settings = cleanSettings(raw.settings);
  p.secretary = str(raw.secretary) && p.units[raw.secretary] ? raw.secretary : 'hikari';
  const st = isObj(raw.stats) ? raw.stats : {};
  p.stats = { battles: int(st.battles, 0, 0), wins: int(st.wins, 0, 0), kills: int(st.kills, 0, 0), pulls: int(st.pulls, 0, 0), gemsEarned: int(st.gemsEarned, 0, 0) };
  p.seenIntro = strList(raw.seenIntro);
  p.version = SAVE_VERSION;
  return p;
}

// ---------------------------------------------------------------------------
// Import / export (base64 of UTF-8 JSON)
// ---------------------------------------------------------------------------

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/**
 * Compact export string (base64 JSON) for copy/paste backups.
 * @param {object} p Profile
 * @returns {string}
 */
export function serializeProfile(p) {
  return toBase64(JSON.stringify(p));
}

/**
 * Parse an exported save. Accepts the base64 string (whitespace ignored) or raw JSON.
 * @param {string} text
 * @returns {object} migrated Profile
 * @throws {Error} 'Invalid save' on anything that is not a Sakura Sentinels profile
 */
export function deserializeProfile(text) {
  if (typeof text !== 'string') throw new Error('Invalid save');
  const trimmed = text.replace(/\s+/g, '');
  if (!trimmed) throw new Error('Invalid save');
  let json;
  try {
    json = trimmed.startsWith('{') ? text.trim() : fromBase64(trimmed);
  } catch {
    throw new Error('Invalid save');
  }
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid save');
  }
  const looksLikeProfile = isObj(parsed) && typeof parsed.version === 'number' && isObj(parsed.units) && isObj(parsed.currencies);
  if (!looksLikeProfile) throw new Error('Invalid save');
  return migrateProfile(parsed);
}

/** All unit ids the roster knows about (used by tests/UI). */
export const ALL_UNIT_IDS = UNITS.map((u) => u.id);
