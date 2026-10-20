// Sensei Profile public card, format v1 (docs/specs/PROFILE.md §5, ACHIEVEMENTS.md §6.3–6.5).
// Pure and game-aware: builds the card a save publishes (a whitelist, never a copy of the save),
// cleans a card someone else published before it is shown, and turns a showcase entry into the
// small profile the Unit Sheet's Build tab reads. No server calls here (M2: src/online/profileSync.js).
import { UNIT_MAP } from '../data/units.js';
import { STAGE_MAP } from '../data/stages.js';
import { FREEPLAY_TIERS } from '../data/freeplay.js';
import { GEAR_SLOTS, GEAR_STATS, GEAR_MAIN_STATS, GEAR_SUBSTATS_BY_RARITY, ITEM_RARITIES } from '../data/types.js';
import { BANNER_MAP, DEFAULT_BANNER, FRAME_IDS, TITLES } from '../data/profileArt.js';
import { levelCapAt, potentialLevelCap, gatesForLevel, MAX_AWAKEN, MAX_BREAKTHROUGH } from '../systems/progression.js';
import { potentialLevel, potentialState, MAX_POTENTIAL } from '../systems/potential.js';
import { MAX_GEAR_LEVEL, SUB_GROWTH_EVERY, mainStatMax, substatMax, isUrGear, gearLines, tuneCount } from '../systems/gear.js';
import { GEAR_STAT_DEFS, NEW_STAT_SLOT } from '../data/gearStats.js';
import { UR_MAX_LEVEL, TUNE_GOLD, TUNE_RAINBOW } from '../data/gearAwaken.js';
import { CLUB_IDS, CLUB_RARITIES, clubIndex, clubAt } from '../data/clubs.js';
import { autoShowcase, autoPins, medalTally, ribbonTally, freeplayByTier, collectionStats, STAGE_COUNT, UNIT_COUNT } from '../systems/profileTrophies.js';
import { setSensei, cleanShowcase } from '../systems/senseiSave.js';
import { ID_RE, PIN_RE, PINS_MAX, SHOWCASE_MAX, GEAR_MAX } from './profileRules.js';
import { tagTitleAllowed } from './tags.js';

export { cardHash, validCard } from './profileRules.js';

const SLOTS = Object.keys(GEAR_SLOTS);
/**
 * Gates a card carries: at most 5. Gates 6–10 never raise a girl's cap above her Potential's
 * (gate k needs P(k − 4)), so 5 gates + her P give a viewer her real cap (levelCapAt(5, p)).
 */
export const CARD_GATES = 5;
/** A viewer's cap for a card entry: at 5 gates her Potential's cap (the card never says more than 5). */
const cardCap = (bt, p) => (bt < CARD_GATES ? levelCapAt(bt, p) : potentialLevelCap(p));
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const r4 = (v) => Math.round(v * 10000) / 10000;
const whole = (v, lo, hi, def = lo) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : def);
const clampNum = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

/**
 * Rainbow UR gear on the card (gear-awaken §9.2): `r: 'ur'`, `l` ≤ 12 and EFFECTIVE values, which today's
 * server rules already accept. The ✦ marks (a 4th sub element) and the club (gear key `c`) need the
 * amended rules (supabase/migrations/20261020000000_profile_gear.sql): until those are pasted the card
 * leaves them out, or the server would refuse the whole card. The coordinator flips this after the paste.
 */
export const CARD_GEAR_MARKS = false;

function cardGear(p, st, { marks = CARD_GEAR_MARKS } = {}) {
  const out = [];
  for (const s of SLOTS) {
    const g = st.gear?.[s] && p.gear?.[st.gear[s]];
    if (!g || g.slot !== s || !g.main) continue;
    const L = gearLines(g);
    const piece = { s, r: isUrGear(g) ? 'ur' : g.rarity, l: g.level || 0, m: [g.main.stat, r4(L.main.value)] };
    const x = L.subs.map((sub) => {
      const t = marks ? (sub.tuned | 0) & 3 : 0;
      if (t) return [sub.stat, r4(sub.value), sub.upgrades || 0, t];
      return sub.upgrades > 0 ? [sub.stat, r4(sub.value), sub.upgrades] : [sub.stat, r4(sub.value)];
    });
    if (x.length) piece.x = x;
    if (marks && g.club && CLUB_RARITIES.includes(g.rarity)) piece.c = clubIndex(g.club);
    out.push(piece);
  }
  return out;
}

/** One showcase entry: { id, lv, bt, aw, p, sk?, g? } (never uid, locked, name, exp, obtainedAt, bond). */
export function cardUnit(p, id) {
  const st = p.units[id];
  // the card format allows gates 0–9 only (profileRules.js validCard): past gate 5 a card says 5, and
  // the viewer's cap comes from her Potential (CARD_GATES, ASCENSION.md §F.4)
  const u = { id, lv: st.level || 1, bt: Math.min(CARD_GATES, st.breakthrough || 0), aw: st.awaken || 0, p: potentialLevel(st) };
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
    // 'ur' is card-only (a UR piece is a Legendary with the `ur` flag in a save)
    const ur = g?.r === 'ur';
    if (!isObj(g) || !GEAR_SLOTS[g.s] || seenSlots.has(g.s) || !(ITEM_RARITIES[g.r] || ur)) continue;
    if (!Array.isArray(g.m) || !GEAR_MAIN_STATS[g.s].includes(g.m[0])) continue;
    const rarity = ur ? 'legendary' : g.r;
    const scale = ur ? 'ur' : g.r;
    // a box-born UR piece (the Rainbow Gear Box, ASCENSION.md §C.8) starts at +0: any level up to +12
    const l = ur ? whole(g.l, 0, UR_MAX_LEVEL, MAX_GEAR_LEVEL) : whole(g.l, 0, MAX_GEAR_LEVEL);
    const mainStat = g.m[0];
    const piece = { s: g.s, r: g.r, l, m: [mainStat, clampNum(g.m[1], 0, mainStatMax(mainStat, scale, l))] };
    const club = whole(g.c, 0, 15, 0);
    const clubId = club && CLUB_RARITIES.includes(rarity) ? clubAt(club) : null;
    if (clubId && CLUB_IDS.includes(clubId)) piece.c = clubId;
    const used = new Set([mainStat]);
    const lines = [];
    const maxUps = Math.floor(l / SUB_GROWTH_EVERY);
    const goldOk = ur || (rarity === 'legendary' && l >= MAX_GEAR_LEVEL);
    let gold = false;
    let rainbow = false;
    for (const sub of Array.isArray(g.x) ? g.x : []) {
      if (lines.length >= GEAR_SUBSTATS_BY_RARITY[rarity]) break;
      if (!Array.isArray(sub) || !GEAR_STAT_DEFS[sub[0]] || used.has(sub[0])) continue;
      if (NEW_STAT_SLOT[sub[0]] && NEW_STAT_SLOT[sub[0]] !== g.s) continue;
      used.add(sub[0]);
      const ups = whole(sub[2], 0, maxUps, 0);
      // ✦ marks: ≤ 1 gold per piece (Legendary at +10 or UR), ≤ 1 rainbow per piece (UR only)
      let t = whole(sub[3], 0, 3, 0);
      if (t & TUNE_GOLD && (gold || !goldOk)) t &= ~TUNE_GOLD;
      if (t & TUNE_RAINBOW && (rainbow || !ur)) t &= ~TUNE_RAINBOW;
      if (t & TUNE_GOLD) gold = true;
      if (t & TUNE_RAINBOW) rainbow = true;
      lines.push({ stat: sub[0], raw: sub[1], ups, t });
    }
    // A card published without marks (CARD_GEAR_MARKS off, or an older build) still carries a ✦ line's
    // full effective value: an unmarked line over its plain ceiling may use the piece's ✦ steps the
    // marked lines left free (gold first, then rainbow; each at most once per piece). Display only.
    const x = lines.map(({ stat, raw, ups, t }) => {
      let steps = tuneCount(t);
      if (!t && typeof raw === 'number' && raw > substatMax(stat, scale, ups)) {
        if (!gold && goldOk) {
          gold = true;
          steps += 1;
        }
        if (!rainbow && ur && raw > substatMax(stat, scale, ups + steps)) {
          rainbow = true;
          steps += 1;
        }
      }
      const val = clampNum(raw, 0, substatMax(stat, scale, ups + steps));
      return t ? [stat, val, ups, t] : [stat, val, ups];
    });
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
    const bt = whole(u.bt, 0, CARD_GATES, 0);
    const p = whole(u.p, 1, MAX_POTENTIAL, 1);
    // her cap from her gates and her Potential (P6 = 85); an older viewer clamps to 60 (display only)
    const v = { id: u.id, bt, aw: whole(u.aw, 0, MAX_AWAKEN, 0), lv: whole(u.lv, 1, cardCap(bt, p), 1), p };
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
    // card values are already effective: a UR card piece is `urCard` (never `ur`, which would read ×8/7 twice)
    gear[uid] = {
      uid, slot: g.s, rarity: g.r === 'ur' ? 'legendary' : g.r, level: g.l, main: { stat: g.m[0], value: g.m[1] },
      subs: (g.x || []).map(([stat, value, ups = 0, tuned = 0]) => ({ stat, value, upgrades: ups, ...(tuned ? { tuned } : {}) })), locked: false, equippedBy: u.id, name: '',
      ...(g.r === 'ur' ? { urCard: true } : {}),
      ...(g.c ? { club: g.c } : {}),
    };
  }
  return {
    units: {
      [u.id]: {
        // a card says at most 5 gates: her real count is the fewest that allow her level at her P
        level: u.lv, exp: 0, breakthrough: u.bt >= CARD_GATES ? gatesForLevel(u.lv, u.p) : u.bt, awaken: u.aw, ...potentialState(u.p), skin: u.sk || null, gear: slots, favorite: false, obtainedAt: 0,
      },
    },
    gear,
  };
}

/** A co-op ally's loadout entry ({ level, breakthrough, awaken, … }) → the same shape, no gear. */
export function loadoutToMiniProfile(id, stats = {}) {
  const bt = whole(stats.breakthrough, 0, MAX_BREAKTHROUGH, 0);
  const p = whole(stats.potential, 1, MAX_POTENTIAL, 1);
  return snapshotToMiniProfile({ id, bt, aw: whole(stats.awaken, 0, MAX_AWAKEN, 0), lv: whole(stats.level, 1, levelCapAt(bt, p), 1), p });
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
