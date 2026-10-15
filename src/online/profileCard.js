// Sensei Profile public card, format v1 (docs/specs/PROFILE.md §5, ACHIEVEMENTS.md §6.3–6.5).
// Pure and game-aware: builds the card a save publishes (a whitelist, never a copy of the save),
// cleans a card someone else published before it is shown, and turns a showcase entry into the
// small profile the Unit Sheet's Build tab reads. No server calls here (M2: src/online/profileSync.js).
import { UNIT_MAP } from '../data/units.js';
import { STAGE_MAP } from '../data/stages.js';
import { FREEPLAY_TIERS } from '../data/freeplay.js';
import { GEAR_SLOTS, GEAR_STATS, GEAR_MAIN_STATS, GEAR_SUBSTATS_BY_RARITY, ITEM_RARITIES } from '../data/types.js';
import { BANNER_MAP, DEFAULT_BANNER, FRAME_IDS, TITLES } from '../data/profileArt.js';
import { levelCap, MAX_BREAKTHROUGH, MAX_AWAKEN } from '../systems/progression.js';
import { potentialLevel, MAX_POTENTIAL } from '../systems/potential.js';
import { MAX_GEAR_LEVEL, SUB_GROWTH_EVERY, mainStatMax, substatMax } from '../systems/gear.js';
import { autoShowcase, autoPins, medalTally, ribbonTally, freeplayByTier, collectionStats, STAGE_COUNT, UNIT_COUNT } from '../systems/profileTrophies.js';
import { setSensei, cleanShowcase } from '../systems/senseiSave.js';
import { ID_RE, PIN_RE, PINS_MAX, SHOWCASE_MAX, GEAR_MAX } from './profileRules.js';
import { tagTitleAllowed } from './tags.js';

export { cardHash, validCard } from './profileRules.js';

const SLOTS = Object.keys(GEAR_SLOTS);
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const r4 = (v) => Math.round(v * 10000) / 10000;
const whole = (v, lo, hi, def = lo) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : def);
const clampNum = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

function cardGear(p, st) {
  const out = [];
  for (const s of SLOTS) {
    const g = st.gear?.[s] && p.gear?.[st.gear[s]];
    if (!g || g.slot !== s || !g.main) continue;
    const piece = { s, r: g.rarity, l: g.level || 0, m: [g.main.stat, r4(g.main.value)] };
    const x = (g.subs || []).map((sub) => (sub.upgrades > 0 ? [sub.stat, r4(sub.value), sub.upgrades] : [sub.stat, r4(sub.value)]));
    if (x.length) piece.x = x;
    out.push(piece);
  }
  return out;
}

/** One showcase entry: { id, lv, bt, aw, p, sk?, g? } (never uid, locked, name, exp, obtainedAt, bond). */
export function cardUnit(p, id) {
  const st = p.units[id];
  const u = { id, lv: st.level || 1, bt: st.breakthrough || 0, aw: st.awaken || 0, p: potentialLevel(st) };
  if (typeof st.skin === 'string' && st.skin) u.sk = st.skin;
  const g = cardGear(p, st);
  if (g.length) u.g = g;
  return u;
}

/**
 * The card this save publishes. Empty picks mean "automatic": the 8 strongest girls, the 4 best medals.
 * @param {object} p profile
 */
export function buildCard(p) {
  const s = isObj(p?.sensei) ? p.sensei : {};
  const showcase = cleanShowcase(s.showcase, p);
  const ids = showcase.length ? showcase : autoShowcase(p);
  const med = { a: medalTally(p) };
  const r = ribbonTally(p);
  if (r) med.r = r;
  med.pins = Array.isArray(s.pins) && s.pins.length ? s.pins.slice(0, PINS_MAX) : autoPins(p);
  const card = {
    v: 1,
    fav: (s.favorite && p.units?.[s.favorite] ? s.favorite : p.secretary) || null,
    ban: s.banner || DEFAULT_BANNER,
    frm: s.frame || null,
    ttl: s.title || null,
    units: ids.map((id) => cardUnit(p, id)),
    med,
  };
  const fp = freeplayByTier(p);
  if (Object.keys(fp).length) card.fp = fp;
  card.st = collectionStats(p);
  return card;
}

// ---------------------------------------------------------------------------
// Viewing (trust boundary): read field by field, never as a whole-card gate
// ---------------------------------------------------------------------------

function viewGear(list, lv) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seenSlots = new Set();
  for (const g of list.slice(0, GEAR_MAX)) {
    if (!isObj(g) || !GEAR_SLOTS[g.s] || seenSlots.has(g.s) || !ITEM_RARITIES[g.r]) continue;
    if (!Array.isArray(g.m) || !GEAR_MAIN_STATS[g.s].includes(g.m[0])) continue;
    const l = whole(g.l, 0, MAX_GEAR_LEVEL);
    const mainStat = g.m[0];
    const piece = { s: g.s, r: g.r, l, m: [mainStat, clampNum(g.m[1], 0, mainStatMax(mainStat, g.r, l))] };
    const used = new Set([mainStat]);
    const x = [];
    const maxUps = Math.floor(l / SUB_GROWTH_EVERY);
    for (const sub of Array.isArray(g.x) ? g.x : []) {
      if (x.length >= GEAR_SUBSTATS_BY_RARITY[g.r]) break;
      if (!Array.isArray(sub) || !GEAR_STATS[sub[0]] || used.has(sub[0])) continue;
      used.add(sub[0]);
      const ups = whole(sub[2], 0, maxUps, 0);
      x.push([sub[0], clampNum(sub[1], 0, substatMax(sub[0], g.r, ups)), ups]);
    }
    if (x.length) piece.x = x;
    seenSlots.add(g.s);
    out.push(piece);
  }
  return out;
}

function viewUnits(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const u of list) {
    if (out.length >= SHOWCASE_MAX) break;
    if (!isObj(u) || typeof u.id !== 'string' || !UNIT_MAP[u.id] || seen.has(u.id)) continue;
    seen.add(u.id);
    const bt = whole(u.bt, 0, MAX_BREAKTHROUGH, 0);
    const v = { id: u.id, bt, aw: whole(u.aw, 0, MAX_AWAKEN, 0), lv: whole(u.lv, 1, levelCap({ breakthrough: bt }), 1), p: whole(u.p, 1, MAX_POTENTIAL, 1) };
    // outfits: no skins table in this build yet, so an outfit id is never shown (dropped)
    const g = viewGear(u.g, v.lv);
    if (g.length) v.g = g;
    out.push(v);
  }
  return out;
}

const counts = (a, n, hi) => Array.from({ length: n }, (_, i) => whole(Array.isArray(a) ? a[i] : 0, 0, hi, 0));

/**
 * A card from the network, made safe to show: unknown ids fall back or drop, numbers are clamped,
 * unknown keys are ignored (so a newer card never blanks the profile for an older viewer). Pins keep
 * their grammar; an achievement pin this build doesn't know draws the neutral plaque (pinInfo).
 * A tag title (Developer, Alpha / Beta Tester) shows only when the card owner's SERVER tags include
 * it (`tags`, src/online/tags.js): a save's own marks are never proof for anyone else.
 * @param {object} card
 * @param {{ tags?: object|null }} [opts] tags: the card owner's player_tags (null: unknown → no tag title)
 * @returns {{ fav, ban, frm, ttl, units: object[], med: { a: number[], r: number[]|null, pins: string[] }, fp: object, st: { u, s, b, k, h: number|null } }}
 */
export function cleanViewedCard(card, { tags = null } = {}) {
  const c = isObj(card) ? card : {};
  const med = isObj(c.med) ? c.med : {};
  const pins = Array.isArray(med.pins) ? [...new Set(med.pins.filter((pin) => typeof pin === 'string' && PIN_RE.test(pin)))].filter((pin) => {
    if (pin.startsWith('ach:')) return true;
    return !!STAGE_MAP[pin.split(':')[0]];
  }).slice(0, PINS_MAX) : [];
  const fp = {};
  if (isObj(c.fp)) {
    for (const tier of FREEPLAY_TIERS) {
      const r = c.fp[tier];
      if (isObj(r) && typeof r.s === 'string' && STAGE_MAP[r.s] && whole(r.w, 0, 999999, 0) > 0) fp[tier] = { w: whole(r.w, 0, 999999), s: r.s, ...(r.c === 1 ? { c: 1 } : {}) };
    }
  }
  const st = isObj(c.st) ? c.st : {};
  return {
    fav: typeof c.fav === 'string' && UNIT_MAP[c.fav] ? c.fav : 'hikari',
    ban: typeof c.ban === 'string' && BANNER_MAP[c.ban] ? c.ban : DEFAULT_BANNER,
    frm: typeof c.frm === 'string' && FRAME_IDS.includes(c.frm) ? c.frm : null,
    ttl: typeof c.ttl === 'string' && TITLES[c.ttl] && tagTitleAllowed(c.ttl, tags) ? c.ttl : null,
    units: viewUnits(c.units),
    med: { a: counts(med.a, 4, STAGE_COUNT), r: Array.isArray(med.r) ? counts(med.r, Math.min(8, med.r.length), 160) : null, pins },
    fp,
    st: { u: whole(st.u, 0, UNIT_COUNT, 0), s: whole(st.s, 0, STAGE_COUNT, 0), b: whole(st.b, 0, 100, 0), k: whole(st.k, 0, 2e9, 0), h: st.h == null ? null : whole(st.h, 0, 999, 0) },
  };
}

// ---------------------------------------------------------------------------
// Snapshots → the small profile the Unit Sheet reads ({ units, gear })
// ---------------------------------------------------------------------------

/** One cleaned card.units entry → { units: { [id]: state }, gear } (unitBattleStats, unitPower, gearStatTotals accept it). */
export function snapshotToMiniProfile(u) {
  const gear = {};
  const slots = { charm: null, ribbon: null, shoes: null };
  for (const g of u.g || []) {
    const uid = `snap:${u.id}:${g.s}`;
    slots[g.s] = uid;
    gear[uid] = {
      uid, slot: g.s, rarity: g.r, level: g.l, main: { stat: g.m[0], value: g.m[1] },
      subs: (g.x || []).map(([stat, value, ups = 0]) => ({ stat, value, upgrades: ups })), locked: false, equippedBy: u.id, name: '',
    };
  }
  return {
    units: {
      [u.id]: {
        level: u.lv, exp: 0, breakthrough: u.bt, awaken: u.aw, dupes: (u.p || 1) - 1, skin: u.sk || null, gear: slots, favorite: false, obtainedAt: 0,
      },
    },
    gear,
  };
}

/** A co-op ally's loadout entry ({ level, breakthrough, awaken, … }) → the same shape, no gear. */
export function loadoutToMiniProfile(id, stats = {}) {
  const bt = whole(stats.breakthrough, 0, MAX_BREAKTHROUGH, 0);
  return snapshotToMiniProfile({ id, bt, aw: whole(stats.awaken, 0, MAX_AWAKEN, 0), lv: whole(stats.level, 1, levelCap({ breakthrough: bt }), 1), p: whole(stats.potential, 1, MAX_POTENTIAL, 1) });
}

/**
 * Picks back from this account's server card after an older build dropped the block (`lost`):
 * each one re-cleaned against this save (owned, earned), the bio left to the mirror. Clears `lost`.
 * @returns {object} the new sensei block
 */
export function restorePicks(p, card, avatar = null) {
  const c = isObj(card) ? card : {};
  const cur = isObj(p.sensei) ? p.sensei : {};
  return setSensei(p, {
    avatar: typeof avatar === 'string' && ID_RE.test(avatar) ? avatar : cur.avatar,
    favorite: typeof c.fav === 'string' ? c.fav : cur.favorite,
    banner: typeof c.ban === 'string' ? c.ban : cur.banner,
    frame: typeof c.frm === 'string' ? c.frm : cur.frame,
    title: typeof c.ttl === 'string' ? c.ttl : cur.title,
    showcase: Array.isArray(c.units) ? c.units.map((u) => u?.id) : cur.showcase,
    pins: Array.isArray(c.med?.pins) ? c.med.pins : cur.pins,
    lost: false,
  });
}
