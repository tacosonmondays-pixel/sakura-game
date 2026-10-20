// Profile creation, migration and import/export (owner: systems). See CONTRACTS.md §5.
//
// Pure functions: no DOM / localStorage here (src/core/store.js persists the profile).

import { UNIT_MAP, UNITS } from '../data/units.js';
import { ITEMS } from '../data/items.js';
import { GEAR_SLOTS, GEAR_STATS, ITEM_RARITIES, DIFFICULTY_ORDER, BATTLE } from '../data/types.js';
import { GEAR_STAT_DEFS, NEW_STAT_SLOT } from '../data/gearStats.js';
import { CLUB_IDS, CLUB_RARITIES } from '../data/clubs.js';
import { UR_MAX_LEVEL } from '../data/gearAwaken.js';
import { restoreGearMarks } from './gearMarks.js';
import { RIBBON_MODES } from '../data/modes.js';
import { LOBBY_BG_MAP, BOND_MAX } from '../data/lobbyArt.js';
import { emptyMail, MAIL_LIMIT } from './mail.js';
import { cleanBattleSaves, droppedBattleSaves } from './battleSave.js';
import { backfillDupes, restoreFromShadow, shadowPotential, BACKFILL_MARKER, V3_MARKER as POT_V3_MARKER, SHADOW_PREFIX as POT_SHADOW_PREFIX, SHADOW_AT as POT_SHADOW_AT } from './potential.js';
import { settleLevels, MAX_LEVEL } from './progression.js';
import { restoreAscension, GATES_MAX } from './ascensionSave.js';
import { rosterMark, writeRosterMarks } from './rosterSave.js';
import { migrateEssence, settleSpares, markEssenceBorn, fuseShards } from './essence.js';
import { newStory, restoreStory, markStory, STORY_NEW_MARK } from './story.js';
import { cleanPatchGifts, markPatchGifts } from './patchGifts.js';
import { newSensei, restoreSensei, markSensei } from './senseiSave.js';
import { newSocial, cleanSocial } from '../online/socialSave.js';
import { newEvents, cleanEvents } from './events.js';
import { SKIN_MAP } from '../data/skins.js';
import { ownsSkin, isStoredSkin } from './skins.js';

export const SAVE_KEY = 'sakura-sentinels-save-v1';
/**
 * v1 = pre-release stub profile, v2 = full systems profile. Outfits (units[id].skin, skins) are
 * additive v2 fields (roster merge, ROSTER_WAVE_NOTES.md): an older build simply drops them.
 */
export const SAVE_VERSION = 2;
/**
 * Where store.js keeps safety copies of stored saves it could not load as they were: a JSON
 * list of `{ at, reason, version, raw }` (ISO time, loadSaveText's reason, the save's version,
 * the untouched stored string).
 */
export const BACKUP_KEY = `${SAVE_KEY}.backup`;
/** Safety copies kept (oldest dropped first). */
export const MAX_BACKUPS = 3;

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
  musicVolume: 0.7, // [audio]
  sfxVolume: 0.8, // [audio]
  showRanges: true,
  autoStart: false,
  defaultSpeed: 1,
  lighting: { exposure: 1, warmth: 0 },
  reduceMotion: false,
  /** Battle camera: 'locked' holds the fitted map view; 'free' = drag to pan, pinch / wheel to zoom. */
  camera: 'locked',
  /** Buff icons over the girls: 'all', 'selected' (the selected girl and her links) or 'off'. */
  buffIcons: 'all',
};

const CAMERA_MODES = ['locked', 'free'];
const BUFF_ICON_MODES = ['all', 'selected', 'off'];

/**
 * Fresh per-unit state. `dupes` = duplicates received since she joined (her Essence history), `pl` =
 * her bought Potential (src/systems/essence.js).
 */
export function newUnitState(now = Date.now()) {
  return { level: 1, exp: 0, breakthrough: 0, awaken: 0, gear: { charm: null, ribbon: null, shoes: null }, obtainedAt: now, favorite: false, dupes: 0, pl: 1, skin: null };
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
  const missions = emptyMissions();
  // Potential shadow copy (see creditPotential): every owned girl has one from the start
  for (const id of STARTER_UNITS) missions.counters[POT_SHADOW_PREFIX + id] = 0;
  missions.counters[POT_SHADOW_AT] = now;
  // [story] this save was created with the story: an older build that drops profile.story keeps
  // this mark (missions.counters), so the block comes back as a new player's, never as legacy
  missions.counters[STORY_NEW_MARK] = 1;
  const p = {
    version: SAVE_VERSION,
    createdAt: now,
    currencies: { coins: 20000, gems: 2400 },
    // [story] no ticket_recruit10 here any more: the welcome 10-pull is mailed at the 1-3 clear (story.welcome)
    items: {
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
    missions,
    shop: { day: null, week: null, bought: {} },
    redeemed: [],
    settings: structuredCloneSafe(DEFAULT_SETTINGS),
    secretary: 'hikari',
    lobbyBg: {},
    bond: Object.fromEntries(STARTER_UNITS.map((id) => [id, 0])),
    mail: emptyMail(),
    patchGifts: {},
    stats: { battles: 0, wins: 0, kills: 0, pulls: 0, gemsEarned: 0 },
    // born on Potential v3: no "Potential grew!" letter (src/systems/mail.js ensurePotentialLetter)
    seenIntro: [POT_V3_MARKER],
    seq: { gear: 0 },
    /** Unfinished battles kept by Save & quit, by slot (src/systems/battleSave.js). */
    battleSaves: {},
    story: newStory(), // [story] opening, tutorial, journal, episodes (src/systems/story.js)
    sensei: newSensei(), // [profile] Sensei Profile picks (src/systems/senseiSave.js)
    // [social] clan donation / collect ledgers (src/online/donateLedger.js)
    social: newSocial(),
    // [events] limited events: currency lives in items, this block keeps progress (src/systems/events.js)
    events: newEvents(),
    skins: [],
  };
  markSensei(p); // [profile] the picks' shadows in missions.counters (an older build drops the block)
  markEssenceBorn(p); // [ascension] born on Essence: no switch-over migration, no welcome pouch
  writeRosterMarks(p); // [roster] every owned girl's 'own:' mark (src/systems/rosterSave.js)
  return p;
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

/**
 * Outfits (v3). With a unitId: that girl's equipped skin id, kept only when it is one of her
 * non-default outfits (her default is stored as null). Without: the shop/event outfits owned.
 */
function cleanSkins(raw, unitId = null) {
  if (unitId) return typeof raw === 'string' && SKIN_MAP[raw]?.unitId === unitId && SKIN_MAP[raw].kind !== 'default' ? raw : null;
  return strList(raw).filter((id) => isStoredSkin(id));
}

function cleanUnit(raw, now, unitId) {
  const base = newUnitState(now);
  if (!isObj(raw)) return base;
  // gates 6–10 (ASCENSION.md §B) are kept here even before this build can break them
  const breakthrough = int(raw.breakthrough, 0, 0, GATES_MAX);
  // her duplicates may not be known yet (`dupes` null until creditPotential restores it), so a girl
  // past gate 5 keeps any level up to MAX_LEVEL here; migrateProfile re-clamps to levelCap after
  const cap = breakthrough < 5 ? 10 + 10 * breakthrough : MAX_LEVEL;
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
    // null = a save from before Potential counted (or an older build dropped it): migrateProfile credits it
    dupes: 'dupes' in raw ? int(raw.dupes, 0, 0, 1e6) : null,
    // bought Potential (ASCENSION.md §A.1); absent = not bought yet (an older build drops it: 'pl:' brings it back)
    ...(raw.pl != null ? { pl: int(raw.pl, 1, 1, 6) } : {}),
    skin: cleanSkins(raw.skin, unitId),
  };
}

/** A gear line: today's eight stats, plus Pierce / Aura Power as substats (gear-stats §E.2). */
function cleanStat(raw, { sub = false } = {}) {
  if (!isObj(raw) || !(sub ? GEAR_STAT_DEFS : GEAR_STATS)[raw.stat]) return null;
  const out = { stat: raw.stat, value: num(raw.value, 0, 0) };
  if (raw.base != null) out.base = num(raw.base, out.value, 0);
  if (raw.upgrades != null) out.upgrades = int(raw.upgrades, 0, 0, 10);
  // ✦ stitches (gear-awaken §8.1): 1 = gold, 2 = rainbow, 3 = both
  const tuned = int(raw.tuned, 0, 0, 3);
  if (sub && tuned) out.tuned = tuned;
  return out;
}

function cleanGear(raw, uid) {
  if (!isObj(raw) || !GEAR_SLOTS[raw.slot] || !ITEM_RARITIES[raw.rarity]) return null;
  const main = cleanStat(raw.main);
  if (!main) return null;
  const club = typeof raw.club === 'string' && CLUB_IDS.includes(raw.club) && CLUB_RARITIES.includes(raw.rarity) ? raw.club : null;
  const seen = new Set([main.stat]);
  const subs = [];
  for (const s of Array.isArray(raw.subs) ? raw.subs : []) {
    const c = cleanStat(s, { sub: true });
    // a Pierce / Aura Power line only on a club piece of its slot
    if (c && NEW_STAT_SLOT[c.stat] && (NEW_STAT_SLOT[c.stat] !== raw.slot || !club)) continue;
    if (c && !seen.has(c.stat)) {
      seen.add(c.stat);
      subs.push(c);
    }
  }
  const ur = raw.ur === 1 || raw.ur === true ? raw.rarity === 'legendary' : false;
  const out = {
    uid,
    slot: raw.slot,
    rarity: raw.rarity,
    level: int(raw.level, 0, 0, ur ? UR_MAX_LEVEL : 10),
    main,
    subs: subs.slice(0, 4),
    locked: bool(raw.locked),
    equippedBy: str(raw.equippedBy),
    name: str(raw.name, `${ITEM_RARITIES[raw.rarity].name} ${GEAR_SLOTS[raw.slot].name}`),
  };
  // rainbow UR gear (gear-awaken §8.1): only a Legendary at +10 or more; a box-born piece below +10 (the
  // Rainbow Gear Box, ASCENSION.md §C.8) gets `ur` back from its `gbx:` mirror (gearMarks.js restoreGearMarks)
  if (ur && out.level >= 10) out.ur = 1;
  if (club) out.club = club;
  return out;
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
    musicVolume: num(s.musicVolume, typeof s.music === 'number' ? s.music : d.musicVolume, 0, 1), // [audio] old numeric music migrates
    sfxVolume: num(s.sfxVolume, typeof s.sfx === 'number' ? s.sfx : d.sfxVolume, 0, 1), // [audio]
    showRanges: bool(s.showRanges, d.showRanges),
    autoStart: bool(s.autoStart, d.autoStart),
    defaultSpeed: [1, 2, 3].includes(s.defaultSpeed) ? s.defaultSpeed : d.defaultSpeed,
    lighting: { exposure: num(lighting.exposure, d.lighting.exposure, 0.3, 2.5), warmth: num(lighting.warmth, d.lighting.warmth, -1, 1) },
    reduceMotion: bool(s.reduceMotion, d.reduceMotion),
    // older saves have no camera setting: they get the locked camera too
    camera: CAMERA_MODES.includes(s.camera) ? s.camera : d.camera,
    // older saves have no buff icon setting: every buffed girl shows hers
    buffIcons: BUFF_ICON_MODES.includes(s.buffIcons) ? s.buffIcons : d.buffIcons,
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

/** Lobby background choices: { girlId: bgId } for known backgrounds that belong to that girl. */
function cleanLobbyBg(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [girl, id] of Object.entries(raw)) if (UNIT_MAP[girl] && typeof id === 'string' && LOBBY_BG_MAP[id]?.girl === girl) out[girl] = id;
  return out;
}

/** Bond levels 0..BOND_MAX for known girls; every owned girl has an entry. */
function cleanBond(raw, units) {
  const out = {};
  if (isObj(raw)) for (const [id, v] of Object.entries(raw)) if (UNIT_MAP[id]) out[id] = int(v, 0, 0, BOND_MAX);
  for (const id of Object.keys(units)) out[id] ??= 0;
  return out;
}

const isRewardId = (id) => id === 'coins' || id === 'gems' || (ITEMS[id] && ITEMS[id].category !== 'currency');

/** Mailbox. A save without one was made before the mailbox existed: it belongs to a beta player. */
function cleanMail(raw) {
  const m = emptyMail();
  if (!isObj(raw)) {
    m.legacy = true;
    return m;
  }
  m.legacy = bool(raw.legacy);
  m.delivered = strList(raw.delivered);
  for (const l of Array.isArray(raw.letters) ? raw.letters : []) {
    if (!isObj(l) || typeof l.id !== 'string') continue;
    m.letters.push({
      id: l.id,
      from: str(l.from, 'Sakura Academy'),
      title: str(l.title, 'Mail'),
      body: str(l.body, ''),
      rewards: (Array.isArray(l.rewards) ? l.rewards : []).filter((r) => isObj(r) && isRewardId(r.id) && int(r.count, 0, 0) > 0).map((r) => ({ id: r.id, count: int(r.count, 0, 0) })),
      sentAt: num(l.sentAt, 0, 0),
      expiresAt: l.expiresAt == null ? null : num(l.expiresAt, 0, 0),
      claimed: bool(l.claimed),
      ...(l.claimedAt != null ? { claimedAt: num(l.claimedAt, 0, 0) } : {}),
    });
    if (!m.delivered.includes(l.id)) m.delivered.push(l.id);
  }
  m.letters = m.letters.slice(0, MAIL_LIMIT);
  return m;
}

/** v0/v1 were pre-release stub saves without gacha/progress state: nothing worth keeping. */
function isStubSave(raw, version) {
  return version < 2 && !isObj(raw.gacha) && !isObj(raw.progress) && !(isObj(raw.units) && Object.keys(raw.units).length);
}

/** Valid ribbon keys only: `${difficulty}:${mode}` for the five ribbon modes, value true. */
export function cleanModeRibbons(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const [d, m] = k.split(':');
    if (v === true && DIFFICULTY_ORDER.includes(d) && RIBBON_MODES.includes(m) && k === `${d}:${m}`) out[k] = true;
  }
  return out;
}

/**
 * Upgrade/repair any stored profile. Never throws: missing or corrupt fields are replaced
 * with defaults, unknown units/items are dropped, references (formation, gear owners,
 * secretary) are made consistent, and the starters are always owned. It is lossy for saves
 * from other builds: check `migrationDropsData` / a version above SAVE_VERSION first and keep
 * the raw text (loadSaveText, deserializeProfile do).
 * @param {any} raw parsed JSON (or anything)
 * @returns {object} Profile
 */
export function migrateProfile(raw) {
  const fresh = createProfile();
  if (!isObj(raw)) return fresh;
  const version = int(raw.version, 0, 0);
  if (isStubSave(raw, version)) return fresh;

  const now = Date.now();
  const p = fresh;
  p.createdAt = num(raw.createdAt, fresh.createdAt, 0);

  const cur = isObj(raw.currencies) ? raw.currencies : {};
  p.currencies = { coins: int(cur.coins, 0, 0), gems: int(cur.gems, 0, 0) };
  p.items = cleanCounts(raw.items, (id) => ITEMS[id] && ITEMS[id].category !== 'currency');

  // Units (only known ids). Starters are always owned.
  p.units = {};
  if (isObj(raw.units)) for (const [id, u] of Object.entries(raw.units)) if (UNIT_MAP[id]) p.units[id] = cleanUnit(u, now, id);
  // [roster] a girl an older build left out (it did not know her) comes back from her 'own:' mark: level,
  // gates, stars and the pieces she wore (put back on below when still free); 'pot:', 'pl:', 'bt:',
  // 'lv:' / 'lvA:' then restore the rest (src/systems/rosterSave.js)
  const rawCounters = cleanNumberMap(isObj(raw.missions) ? raw.missions.counters : null);
  for (const def of UNITS) {
    if (p.units[def.id]) continue;
    const kept = rosterMark(rawCounters, def.id);
    if (kept) p.units[def.id] = cleanUnit(kept, now, def.id);
  }
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
    // battle-mode ribbons ('hard:rush': true), docs/specs/CODEX_MODES.md §5.4
    if (isObj(s.modes)) {
      const m = cleanModeRibbons(s.modes);
      if (Object.keys(m).length) entry.modes = m;
    }
    // co-op freeplay: best wave per freeplay tier ({ blossom, tempest, crimson }, src/online/coop/rewards.js)
    if (isObj(s.coopBestWave)) {
      const best = cleanCounts(s.coopBestWave, (k) => /^[a-z]{1,16}$/.test(k));
      if (Object.keys(best).length) entry.coopBestWave = best;
    }
    // solo freeplay: the same per-tier best (src/systems/freeplayRewards.js)
    if (isObj(s.freeplayBest)) {
      const best = cleanCounts(s.freeplayBest, (k) => /^[a-z]{1,16}$/.test(k));
      if (Object.keys(best).length) entry.freeplayBest = best;
    }
    p.progress.stages[id] = entry;
  }
  // co-op freeplay one-time milestones ('tier:id'), titles and profile frames earned there
  if (isObj(raw.progress) && isObj(raw.progress.freeplay)) {
    const fp = raw.progress.freeplay;
    p.progress.freeplay = { done: strList(fp.done, 200), titles: strList(fp.titles, 50), frames: strList(fp.frames, 50) };
  }
  // co-op freeplay runs the page never got to pay (reload / closed tab), by start seed: paid at
  // the next app start (src/online/coop/rewards.js payPendingFreeplayRuns)
  if (isObj(raw.progress) && isObj(raw.progress.freeplayPending)) {
    const id = (k) => /^[a-z0-9_]{1,40}$/.test(k);
    const runs = {};
    for (const [seed, r] of Object.entries(raw.progress.freeplayPending).slice(-3)) {
      if (!isObj(r) || !/^[\w-]{1,40}$/.test(seed) || typeof r.stageId !== 'string' || r.stageId.length > 16) continue;
      if (!DIFFICULTY_ORDER.includes(r.difficulty) || typeof r.freeplay !== 'string' || !/^[a-z]{1,16}$/.test(r.freeplay)) continue;
      const b = isObj(r.banked) ? r.banked : {};
      runs[seed] = {
        stageId: r.stageId, difficulty: r.difficulty, freeplay: r.freeplay, goal: int(r.goal, 0, 0), wavesCleared: int(r.wavesCleared, 0, 0),
        kills: cleanCounts(r.kills, id), encountered: strList(r.encountered, 200).filter(id),
        banked: { goal: int(b.goal, 0, 0), kills: cleanCounts(b.kills, id), encountered: strList(b.encountered, 200).filter(id) },
      };
      // a solo run (src/systems/freeplayRewards.js): its best field and capped coins per wave
      if (r.bestKey === 'freeplayBest') runs[seed].bestKey = 'freeplayBest';
      if (r.waveCoins != null) runs[seed].waveCoins = int(r.waveCoins, 0, 0, 1000);
    }
    if (Object.keys(runs).length) p.progress.freeplayPending = runs;
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
  p.lobbyBg = cleanLobbyBg(raw.lobbyBg);
  p.bond = cleanBond(raw.bond, p.units);
  p.mail = cleanMail(raw.mail);
  // claims plus their 'pg:' marks in missions.counters (an older build dropped profile.patchGifts)
  p.patchGifts = cleanPatchGifts(raw.patchGifts, p.missions.counters);
  markPatchGifts(p);
  const st = isObj(raw.stats) ? raw.stats : {};
  p.stats = { battles: int(st.battles, 0, 0), wins: int(st.wins, 0, 0), kills: int(st.kills, 0, 0), pulls: int(st.pulls, 0, 0), gemsEarned: int(st.gemsEarned, 0, 0) };
  p.seenIntro = strList(raw.seenIntro);
  // additive (no version bump): a save from before battle saves simply has none
  p.battleSaves = cleanBattleSaves(raw.battleSaves);
  creditPotential(p, now);
  // [ur-gear] rainbow UR gear, ✦ stitches, clubs and the club-only substats an older build stripped come back
  // from their missions.counters mirrors (src/systems/gearMarks.js); the mirrors are rewritten
  restoreGearMarks(p);
  // [ascension] bought Potential, gates 6–10 and the Ascension items an older build dropped, then the
  // one-time switch to Essence (counted duplicates become Potential for free + the welcome pouch)
  restoreAscension(p);
  migrateEssence(p);
  // Essence above her hold cap (an older build counted a duplicate): marked as spares, paid nothing
  settleSpares(p);
  fuseShards(p);
  // levels above 60 (Potential's cap): only now that her duplicates are known — restore what an
  // older build clamped to 60 from the 'lv:' shadow, then clamp every girl to levelCap
  settleLevels(p);
  // [story] no block = a save from before the story (legacy), unless missions.counters marks it as
  // created with the story (an older build dropped the block): claimed lessons and read scenes come
  // back from their marks too, and the block's state is marked again
  p.story = restoreStory(raw.story, p.missions.counters, p.mail.delivered);
  markStory(p);
  // [profile] additive block: none = an older build dropped it (or a save from before profiles): the
  // picks come back from their 'pfs:' shadows in missions.counters, else once from the server card
  // (`lost`, PROFILE.md §2.4). Cosmetic drops inside it never count as lossy (migrationDropsData).
  restoreSensei(raw.sensei, p);
  p.social = cleanSocial(raw.social);
  // [events] limited events (EVENT_SPEC §3.5): additive; the counters' shadows keep settles final,
  // stock limits and one-time claims, and the Mailbox's delivered list keeps the login gifts sent
  p.events = cleanEvents(raw.events, p.missions.counters, p.mail);
  p.skins = cleanSkins(raw.skins);
  for (const u of Object.values(p.units)) if (u.skin && !ownsSkin(p, u.skin)) u.skin = null;
  // [roster] every owned girl's 'own:' mark, from her settled state
  writeRosterMarks(p);
  p.version = SAVE_VERSION;
  return p;
}

/**
 * Potential counting (M0, docs/specs/POTENTIAL.md §6): fills `dupes` that the save lacks — first
 * from the shadow copy in missions.counters (an older build dropped it), then from the recruit
 * history (a save from before Potential) — and rewrites every shadow. Never lowers a count.
 */
function creditPotential(p, now) {
  const restored = restoreFromShadow(p.units, p.missions.counters, p.gacha.history);
  for (const [id, n] of Object.entries(restored)) p.units[id].dupes = n;
  const credited = backfillDupes(p.units, p.gacha, { createdAt: p.createdAt, now });
  for (const [id, n] of Object.entries(credited)) p.units[id].dupes = n;
  if (Object.keys(credited).length && !p.seenIntro.includes(BACKFILL_MARKER)) p.seenIntro.push(BACKFILL_MARKER);
  // 'pot:at' moves only when a count changed or a shadow is missing, so loading a save twice gives the same profile
  const c = p.missions.counters;
  const stale = !(POT_SHADOW_AT in c) || Object.entries(p.units).some(([id, u]) => c[POT_SHADOW_PREFIX + id] !== u.dupes);
  if (stale || Object.keys(restored).length || Object.keys(credited).length) for (const id of Object.keys(p.units)) shadowPotential(p, id, now);
}

/**
 * True when migrateProfile would leave stored data out: students or items this build does
 * not know, gear it cannot read, or a whole pre-release stub save. A saved battle this build
 * cannot restore does not count (it is dropped with its own notice, no whole-save backup).
 * @param {any} raw parsed profile
 * @returns {boolean}
 */
export function migrationDropsData(raw) {
  if (!isObj(raw)) return false;
  if (isStubSave(raw, int(raw.version, 0, 0))) return Object.keys(raw).some((k) => k !== 'version');
  if (isObj(raw.units) && Object.keys(raw.units).some((id) => !UNIT_MAP[id])) return true;
  if (isObj(raw.items) && Object.entries(raw.items).some(([id, n]) => !ITEMS[id] && int(n, 0, 0) > 0)) return true;
  if (strList(raw.skins).some((id) => !SKIN_MAP[id]) || (isObj(raw.units) && Object.values(raw.units).some((u) => isObj(u) && typeof u.skin === 'string' && !SKIN_MAP[u.skin]))) return true;
  return isObj(raw.gear) && Object.entries(raw.gear).some(([uid, g]) => !cleanGear(g, uid));
}

/**
 * Loads the stored save string (pure; store.js does the localStorage side) and says whether
 * its raw text needs a safety copy (BACKUP_KEY) before the game writes over it. Never throws.
 * - nothing stored → fresh profile, `backup: null`
 * - unreadable (not JSON, not an object) → fresh profile, `backup: 'corrupt'`
 * - written by a newer build (version > SAVE_VERSION) → fresh profile, `backup: 'newer'`
 * - migration would leave data out (migrationDropsData) → migrated profile, `backup: 'lossy'`
 * `droppedBattles` counts saved battles this build could not keep (a notice, not a backup).
 * @param {string|null|undefined} text
 * @returns {{ profile: object, backup: null|'corrupt'|'newer'|'lossy', version: number|null, droppedBattles?: number }}
 */
export function loadSaveText(text) {
  if (typeof text !== 'string' || !text.trim()) return { profile: createProfile(), backup: null, version: null };
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { profile: createProfile(), backup: 'corrupt', version: null };
  }
  if (!isObj(raw)) return { profile: createProfile(), backup: 'corrupt', version: null };
  const version = int(raw.version, 0, 0);
  if (version > SAVE_VERSION) return { profile: createProfile(), backup: 'newer', version };
  try {
    return { profile: migrateProfile(raw), backup: migrationDropsData(raw) ? 'lossy' : null, version, droppedBattles: droppedBattleSaves(raw) };
  } catch {
    return { profile: createProfile(), backup: 'corrupt', version };
  }
}

/**
 * Player-facing notice after loadSaveText asked for a backup.
 * @param {'corrupt'|'newer'|'lossy'} reason
 * @param {boolean} [kept] false when the copy could not be written (storage full)
 * @returns {string}
 */
export function backupNotice(reason, kept = true) {
  const what = {
    corrupt: 'Your saved progress could not be read, so a new profile was started.',
    newer: 'Your save comes from a newer version of Sakura Sentinels, so this version started a new profile instead of changing it.',
    lossy: 'Your save has students or items this version does not know, so they were left out.',
  }[reason] || 'Your save could not be loaded as it was.';
  return kept
    ? `${what} The original save was kept as a backup on this device.`
    : `${what} The browser storage is full, so no backup could be made: this session will not be saved over the old data.`;
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
 * @throws {Error} 'Invalid save' on anything that is not a Sakura Sentinels profile;
 *   'Newer save' when a newer build exported it (importing would drop its newer data)
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
  if (parsed.version > SAVE_VERSION) throw new Error('Newer save');
  return migrateProfile(parsed);
}

/** All unit ids the roster knows about (used by tests/UI). */
export const ALL_UNIT_IDS = UNITS.map((u) => u.id);
