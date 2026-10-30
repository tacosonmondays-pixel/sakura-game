// Old-build safety for rainbow UR gear, ✦ stitches, clubs and the club-only substats
// (docs/specs/GEAR_AWAKEN.md §8.3, GEAR_STATS.md §E.3). An older build strips the fields it does not know
// (`ur`, `tuned`, `club`, a Pierce / Aura Power line, the new item ids) but keeps missions.counters word for
// word, so every one of them is mirrored there and restored on the next load. Additive: no SAVE_VERSION bump.
//
// Mirrors (missions.counters):
//   gur:<uid>  UR level 10–12            gtn:<uid>  ✦ bits, 2 per stat in TUNE_BITS order
//   gbx:<uid>  box-born UR (the Rainbow Gear Box, ASCENSION.md §C.8): slot × 100 + main stat + 1, 0 after salvage
//              (restored on uid + slot: an older build's Prism Dice changes the main stat)
//   gbl:<uid>  box-born UR: bit L = its +L → +L+1 (below +10) was paid at UR prices (salvage refunds by it)
//   gcl:<uid>  club index (1…)           gnx:<uid>  a Pierce / Aura Power line   gnf:<uid>  fingerprint of the other subs
//   inv:<id>   item count (0 included) for the Seed, the Needle, the Armband and the gear update's items
//   ga:gift / gc:gift  the one-time Seed and Armband gifts
//
// The gear update (docs/specs/GEAR_UPDATE.md §9) adds marks no older build reads, so none of them can be refunded or
// clamped by a build that cannot see what they describe:
//   gst:<uid>  a Charm / Ribbon / Shoes piece's set (set index + 1)
//   glr:<uid>  a Charm / Ribbon / Shoes LR piece: LR kind × 100 + level (an older build reads it as UR +12)
//   gtx:<uid>  its Nightglass ✦ (1 bit per stat, TUNE_BITS order)   gtp:<uid>  its pins (bit 0 main, 1 + TUNE_BITS index)
//   A piece gone with one of these marks was salvaged by an older build, which paid only the UR part: the "piece gone"
//   rows pay the rest once (the Lens, half of +13 … +18 at LR prices, a Needle per Nightglass ✦, every pin).
//   gph: / gpm: / gps:<uid>:<i> / gpc:  a Hair Clip or Necklace, whole (§9.5). An older build drops the piece (it does
//   not know the slot); this build rebuilds it. NO legacy mark (gur, gtn, gbx, gbl, gcl, gnx, gnf) ever names one, so
//   an older build that drops it finds nothing to refund.
import { GEAR_SUBSTATS_BY_RARITY, ITEM_RARITIES, ITEM_RARITY_ORDER } from '../data/types.js';
import { NEW_STAT_SLOT } from '../data/gearStats.js';
import { SLOT_IDS, SET_ONLY_SLOTS, MAIN_STATS_BY_SLOT, isNewSlot } from '../data/gearSlots.js';
import { setIndex, setAt } from '../data/gearSets.js';
import { CLUB_IDS, CLUB_RARITIES, clubIndex, clubAt } from '../data/clubs.js';
import {
  TUNE_BITS, TUNE_GOLD, TUNE_RAINBOW, MARK, MIRRORED_ITEMS, SEED_ID, NEEDLE_ID, UR_MAX_LEVEL, MILESTONE_ITEMS, MILESTONE_MARK, MILESTONE_ITEMS_MARK,
  LR_SET, LR_BLANK, LR_MAX_LEVEL, LENS_ID, TIE_PIN_ID, COLLAR_PIN_ID,
} from '../data/gearAwaken.js';
import { createRng } from '../core/rng.js';
import {
  armbandWelcome, isUrGear, isLrGear, lrKind, urName, lrName, pieceName, recomputeGear, rollFreshSub, tuneCount, boxMark, boxPaidBits, boxPaidShortfall,
  SUB_GROWTH_EVERY, MAX_GEAR_LEVEL, nextGrowthIndex, lrLevelsInvested, topMainBase, topSubBase,
} from './gear.js';

const ITEM_MAX = 9999;
const NEW_STATS = Object.keys(NEW_STAT_SLOT);
const counters = (p) => ((p.missions ||= {}).counters ||= {});
const whole = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0);
const give = (p, id, n) => {
  if (n <= 0) return;
  if (id === 'coins') p.currencies.coins = (p.currencies.coins || 0) + n;
  else p.items[id] = Math.min(ITEM_MAX * 10, (p.items[id] || 0) + n);
};

/** gtn: value of a piece (✦ bits by TUNE_BITS). */
export function tunedMark(g) {
  let v = 0;
  for (const s of g.subs || []) {
    const i = TUNE_BITS.indexOf(s.stat);
    if (i >= 0 && s.tuned) v += (s.tuned & 3) * 4 ** i;
  }
  return v;
}

function decodeTuned(v) {
  const out = {};
  let n = Math.max(0, Math.min(4 ** TUNE_BITS.length - 1, whole(v)));
  for (const stat of TUNE_BITS) {
    const bits = n % 4;
    if (bits) out[stat] = bits;
    n = Math.floor(n / 4);
  }
  return out;
}

/** Fingerprint of a piece's subs other than `skipStat` (any reroll redraws the bases, so it changes). */
export function subsFingerprint(g, skipStat) {
  const sum = (g.subs || []).filter((s) => s.stat !== skipStat).reduce((n, s) => n + (s.base ?? s.value ?? 0), 0);
  return Math.floor(sum * 1e6) % 1048576;
}

/** gnx: value of a piece's Pierce / Aura Power line (null when it has none). */
export function newLineMark(g) {
  const i = (g.subs || []).findIndex((s) => NEW_STATS.includes(s.stat));
  if (i < 0) return null;
  const s = g.subs[i];
  const stat = NEW_STATS.indexOf(s.stat) + 1;
  return stat * 1e7 + i * 1e6 + Math.min(9, s.upgrades || 0) * 1e5 + ((s.tuned || 0) & 3) * 1e4 + Math.min(9999, Math.round((s.base ?? s.value) * 1e4));
}

function decodeNewLine(v) {
  let n = whole(v);
  const stat = NEW_STATS[Math.floor(n / 1e7) - 1];
  if (!stat) return null;
  n %= 1e7;
  const index = Math.floor(n / 1e6);
  n %= 1e6;
  const upgrades = Math.floor(n / 1e5);
  n %= 1e5;
  const tuned = Math.floor(n / 1e4) & 3;
  const base = (n % 1e4) / 1e4;
  return { stat, index, upgrades, tuned, base };
}

/** 1 bit per stat in TUNE_BITS order of the lines that pass `has`. */
const lineBits = (g, has) => (g.subs || []).reduce((v, s) => (has(s) && TUNE_BITS.includes(s.stat) ? v + 2 ** TUNE_BITS.indexOf(s.stat) : v), 0);
const bitStats = (v) => TUNE_BITS.filter((_, i) => Math.floor(whole(v) / 2 ** i) % 2 === 1);
/** gtp: value of a piece (bit 0 its main stat, bit 1 + TUNE_BITS index a substat), 0 without pins. */
export const topMark = (g) => (g.main?.top ? 1 : 0) + 2 * lineBits(g, (s) => s.top);

/** Mirror a Hair Clip / Necklace whole: equipped, locked, levelled or Mythic+ (a spare +0 SR piece is left out). */
const mirrorsWhole = (g) => isNewSlot(g.slot) && (g.equippedBy || g.locked || g.level > 0 || ITEM_RARITIES[g.rarity]?.order >= 3);

/** gph: / gpm: / gps: / gpc: values of a Hair Clip or Necklace (GEAR_UPDATE.md §9.5). */
export function wholePieceMarks(g) {
  const flags = (g.locked ? 1 : 0) + (isUrGear(g) ? 2 : 0) + (lrKind(g) === LR_SET ? 4 : 0) + (lrKind(g) === LR_BLANK ? 8 : 0) + (g.main.top ? 16 : 0) + (g.box ? 32 : 0);
  const head = (SET_ONLY_SLOTS.indexOf(g.slot) + 1) + 10 * ITEM_RARITIES[g.rarity].order + 100 * Math.min(99, g.level) + 1e4 * setIndex(g.set)
    + 1e6 * MAIN_STATS_BY_SLOT[g.slot].indexOf(g.main.stat) + 1e8 * flags;
  const subs = (g.subs || []).slice(0, 4).map((s) => TUNE_BITS.indexOf(s.stat) * 1e10 + Math.min(9, s.upgrades || 0) * 1e9 + (s.top ? 1e8 : 0)
    + (((s.tuned || 0) & 3) + (s.night ? 4 : 0)) * 1e7 + Math.min(999999, Math.round((s.base ?? s.value) * 1e6)));
  return { head, main: Math.round((g.main.base ?? g.main.value) * 1e6), subs, club: g.club ? clubIndex(g.club) : 0 };
}

/** A Hair Clip / Necklace as a raw piece from its mirrors (save.js cleanGear checks every field), or null. */
function pieceFromMarks(c, uid) {
  let v = whole(c[MARK.piece + uid]);
  const slot = SET_ONLY_SLOTS[(v % 10) - 1];
  const rarity = ITEM_RARITY_ORDER[Math.floor(v / 10) % 10];
  if (!slot || !rarity) return null;
  const level = Math.floor(v / 100) % 100;
  const set = setAt(Math.floor(v / 1e4) % 100);
  const mainStat = MAIN_STATS_BY_SLOT[slot][Math.floor(v / 1e6) % 100];
  v = Math.floor(v / 1e8);
  const flags = { locked: v & 1, ur: v & 2, lr: v & 4 ? LR_SET : v & 8 ? LR_BLANK : 0, top: v & 16, box: v & 32 };
  const base = whole(c[MARK.pieceMain + uid]) / 1e6;
  if (!mainStat || !(base > 0)) return null;
  const subs = [];
  for (let i = 0; i < 4; i++) {
    const n = whole(c[`${MARK.pieceSub}${uid}:${i}`]);
    if (!n) continue;
    const stat = TUNE_BITS[Math.floor(n / 1e10)];
    const stars = Math.floor(n / 1e7) % 10;
    const sub = { stat, base: (n % 1e7) / 1e6, upgrades: Math.floor(n / 1e9) % 10 };
    sub.value = sub.base;
    if (stars & 3) sub.tuned = stars & 3;
    if (stars & 4) sub.night = 1;
    if (Math.floor(n / 1e8) % 10) sub.top = 1;
    if (stat) subs.push(sub);
  }
  const raw = { slot, rarity, level, main: { stat: mainStat, value: base, base, ...(flags.top ? { top: 1 } : {}) }, subs, locked: !!flags.locked, equippedBy: null };
  if (set) raw.set = set;
  if (flags.ur) raw.ur = 1;
  if (flags.lr) raw.lr = flags.lr;
  if (flags.box) raw.box = 1;
  const club = clubAt(whole(c[MARK.pieceClub + uid]));
  if (club) raw.club = club;
  return raw;
}

/**
 * Runs in migrateProfile on the stored counters, after the bag is cleaned and before the equip consistency: every
 * Hair Clip / Necklace an older build dropped comes back whole (a present piece always wins over its mirror), and she
 * wears again what her 'own:<id>:<slot>' mark says she wore when the slot is empty.
 * @param {object} p the profile being migrated
 * @param {object} c the stored missions.counters
 * @param {(raw: object, uid: string) => object|null} clean save.js cleanGear
 */
export function restoreNewSlotPieces(p, c, clean) {
  for (const key of Object.keys(c)) {
    if (!key.startsWith(MARK.piece)) continue;
    const uid = key.slice(MARK.piece.length);
    const back = p.gear[uid];
    const raw = pieceFromMarks(c, uid);
    if (!raw) continue;
    if (back) {
      // a box-born UR piece below +10 keeps `ur` through its mirror (cleanGear wants +10 for a plain `ur`)
      if (raw.ur && raw.box && back.slot === raw.slot && back.rarity === 'legendary') Object.assign(back, { ur: 1, box: 1 });
      continue;
    }
    const g = clean(raw, uid);
    if (!g || !isNewSlot(g.slot)) continue;
    if (raw.ur && raw.box && g.rarity === 'legendary') Object.assign(g, { ur: 1, box: 1 });
    g.name = pieceName(g);
    p.gear[uid] = recomputeGear(g);
  }
  for (const [id, u] of Object.entries(p.units)) {
    for (const s of SET_ONLY_SLOTS) {
      const n = whole(c[`own:${id}:${s}`]);
      if (!u.gear[s] && n && p.gear[`g${n}`]?.slot === s && !p.gear[`g${n}`].equippedBy) u.gear[s] = `g${n}`;
    }
  }
}

/** Rewrite every gear mirror from the profile; keys of pieces that no longer qualify are dropped. */
export function writeGearMarks(p) {
  const c = counters(p);
  const prefixes = [MARK.ur, MARK.tuned, MARK.club, MARK.newLine, MARK.newFp, MARK.set, MARK.lr, MARK.night, MARK.top, MARK.piece, MARK.pieceMain, MARK.pieceSub, MARK.pieceClub];
  for (const k of Object.keys(c)) if (prefixes.some((x) => k.startsWith(x))) delete c[k];
  for (const g of Object.values(p.gear || {})) {
    // a Hair Clip / Necklace: its whole-piece mirror only, never a legacy mark (GEAR_UPDATE.md §9.4)
    if (isNewSlot(g.slot)) {
      if (!mirrorsWhole(g)) continue;
      const m = wholePieceMarks(g);
      c[MARK.piece + g.uid] = m.head;
      c[MARK.pieceMain + g.uid] = m.main;
      m.subs.forEach((v, i) => { c[`${MARK.pieceSub}${g.uid}:${i}`] = v; });
      if (m.club) c[MARK.pieceClub + g.uid] = m.club;
      continue;
    }
    // the gear update's marks on a classic piece: its set, LR kind and level, the Nightglass ✦ and pins
    if (g.set) c[MARK.set + g.uid] = setIndex(g.set);
    if (isLrGear(g)) c[MARK.lr + g.uid] = lrKind(g) * 100 + g.level;
    const night = lineBits(g, (s) => s.night);
    if (night) c[MARK.night + g.uid] = night;
    const top = topMark(g);
    if (top) c[MARK.top + g.uid] = top;
    // `gur:` keeps its +10 rule (an LR piece's level above +12 rides on `glr:`); a box-born piece below +10 rides
    // on `gbx:` alone
    if (isUrGear(g) && g.level >= MAX_GEAR_LEVEL) c[MARK.ur + g.uid] = Math.min(UR_MAX_LEVEL, g.level);
    // a box-born piece's `gbx:` follows its main stat (a Prism Dice changes it)
    if (isUrGear(g) && c[MARK.box + g.uid] > 0) c[MARK.box + g.uid] = boxMark(g);
    const t = tunedMark(g);
    if (t) c[MARK.tuned + g.uid] = t;
    if (g.club) c[MARK.club + g.uid] = clubIndex(g.club);
    const nx = newLineMark(g);
    if (nx != null) {
      c[MARK.newLine + g.uid] = nx;
      c[MARK.newFp + g.uid] = subsFingerprint(g, decodeNewLine(nx).stat);
    }
  }
  // an item never held has no mirror; a spent one keeps 0 so it is never resurrected
  for (const id of MIRRORED_ITEMS) if (p.items?.[id] || MARK.inv + id in c) c[MARK.inv + id] = p.items?.[id] || 0;
}

/**
 * Step 0 of restoreGearMarks: `gst:` sets, `glr:` LR, `gtx:` Nightglass ✦ and `gtp:` pins on Charm / Ribbon / Shoes
 * pieces. A present piece gets back what an older build dropped (a pinned line whose stat an old reroll changed pays
 * its Collar Pin back; a Nightglass ✦ whose stat is gone its Needle). A gone piece pays, once, what an older build's
 * salvage could not: the Lens and half of +13 … +18 at LR prices (`glr:`), a Needle per Nightglass ✦ (`gtx:`) and
 * every pin (`gtp:`). Then its keys go (writeGearMarks rewrites the rest).
 */
function restoreUpdateMarks(p, c, refund) {
  const keys = (prefix) => Object.keys(c).filter((k) => k.startsWith(prefix));
  for (const key of keys(MARK.set)) {
    const g = p.gear[key.slice(MARK.set.length)];
    const set = setAt(whole(c[key]));
    if (g && !g.set && set && !isNewSlot(g.slot) && ['superRare', 'mythic', 'legendary'].includes(g.rarity) && lrKind(g) !== LR_BLANK) g.set = set;
  }
  for (const key of keys(MARK.lr)) {
    const uid = key.slice(MARK.lr.length);
    const g = p.gear[uid];
    const v = whole(c[key]);
    const kind = Math.floor(v / 100);
    const lv = Math.max(UR_MAX_LEVEL, Math.min(LR_MAX_LEVEL, v % 100));
    if (g) {
      if (isUrGear(g) && !isNewSlot(g.slot) && (kind === LR_BLANK || (kind === LR_SET && g.set))) {
        g.lr = kind;
        if (kind === LR_BLANK) delete g.set;
        g.level = Math.max(g.level, lv);
      }
      continue;
    }
    if (kind !== LR_SET && kind !== LR_BLANK) { delete c[key]; continue; }
    refund(LENS_ID, 1);
    refund('coins', Math.floor(lrLevelsInvested(lv) * 0.5));
  }
  for (const key of keys(MARK.night)) {
    const uid = key.slice(MARK.night.length);
    const g = p.gear[uid];
    const stats = bitStats(c[key]);
    let open = isLrGear(g) && !g.subs.some((s) => s.night);
    for (const stat of stats) {
      const sub = open ? g.subs.find((s) => s.stat === stat) : null;
      if (sub) { sub.night = 1; open = false; } else if (!(g && g.subs.some((s) => s.stat === stat && s.night))) refund(NEEDLE_ID, 1);
    }
  }
  for (const key of keys(MARK.top)) {
    const uid = key.slice(MARK.top.length);
    const g = p.gear[uid];
    const v = whole(c[key]);
    if (!g) {
      if (v % 2) refund(TIE_PIN_ID, 1);
      refund(COLLAR_PIN_ID, bitStats(Math.floor(v / 2)).length);
      continue;
    }
    if (v % 2 && !g.main.top) Object.assign(g.main, { base: topMainBase(g), top: 1 });
    for (const stat of bitStats(Math.floor(v / 2))) {
      const sub = g.subs.find((s) => s.stat === stat);
      if (!sub) refund(COLLAR_PIN_ID, 1);
      else if (!sub.top) Object.assign(sub, { base: topSubBase(g, stat), top: 1 });
    }
  }
  for (const prefix of [MARK.lr, MARK.night, MARK.top]) for (const key of keys(prefix)) if (!p.gear[key.slice(prefix.length)]) delete c[key];
}

/** The +11 / +12 coins an old salvage could not see (half of the UR levels' tier-6 price). */
const urLevelRefund = (level) => (level >= 12 ? 30000 : level >= 11 ? 14400 : 0);

/**
 * Repair a loaded profile from the mirrors (runs in migrateProfile after gear and missions are cleaned).
 * Idempotent: a second run changes nothing and no refund pays twice.
 * @returns {{ refunds: {id,count}[] }}
 */
export function restoreGearMarks(p) {
  const c = counters(p);
  const refunds = {};
  const refund = (id, n) => {
    if (n > 0) {
      give(p, id, n);
      refunds[id] = (refunds[id] || 0) + n;
    }
  };
  // 0. the gear update's marks on classic pieces (GEAR_UPDATE.md §9.2, §9.3): sets, LR, the Nightglass ✦ and pins an
  //    older build dropped come back; a piece gone with them was salvaged there, which paid only its UR part
  restoreUpdateMarks(p, c, refund);
  // 1. items an older build dropped (spent items have mirror 0 and never come back)
  for (const id of MIRRORED_ITEMS) {
    const v = Math.min(ITEM_MAX, whole(c[MARK.inv + id]));
    if (v > 0 && !p.items[id]) p.items[id] = v;
  }
  // 1b. box-born UR (the Rainbow Gear Box, ASCENSION.md §C.8): `ur` back at any level when a Legendary with that
  //     uid and slot is present. Its main stat need not match: an older build's Prism Dice (rerollMainStat, no
  //     lock check there) changes it on what that build sees as a plain Legendary and leaves `gbx:` as it was;
  //     uids are never reused (p.seq.gear only grows) and a slot never changes, and writeGearMarks then moves
  //     the mark to the new main stat. A missing piece was salvaged by an older build: its Seed (step 2 pays it
  //     instead when the piece also had a `gur:` mark), the coins that build's Legendary-priced refund missed
  //     on its UR-priced levels (`gbl:`), and the mark becomes 0
  for (const key of Object.keys(c).filter((k) => k.startsWith(MARK.box))) {
    const v = whole(c[key]);
    if (v <= 0) continue;
    const uid = key.slice(MARK.box.length);
    const g = p.gear[uid];
    if (g) {
      if (g.rarity === 'legendary' && Math.floor((v - 1) / 100) === SLOT_IDS.indexOf(g.slot)) g.ur = 1;
      continue;
    }
    if (!(MARK.ur + uid in c)) refund(SEED_ID, 1);
    refund('coins', boxPaidShortfall(boxPaidBits(p, uid)));
    delete c[MARK.boxPaid + uid];
    c[key] = 0;
  }
  // 2. UR flags and levels; a missing piece was salvaged by an older build: pay what it could not
  const ok = (g) => g && g.rarity === 'legendary' && (g.level >= MAX_GEAR_LEVEL || isUrGear(g));
  for (const key of Object.keys(c).filter((k) => k.startsWith(MARK.ur))) {
    const uid = key.slice(MARK.ur.length);
    const lv = Math.max(MAX_GEAR_LEVEL, Math.min(UR_MAX_LEVEL, whole(c[key])));
    const g = p.gear[uid];
    if (ok(g)) {
      g.ur = 1;
      g.level = Math.max(g.level, lv);
      continue;
    }
    refund(SEED_ID, 1);
    refund('coins', urLevelRefund(lv));
    refund(NEEDLE_ID, Object.values(decodeTuned(c[MARK.tuned + uid])).reduce((n, b) => n + tuneCount(b), 0));
    delete c[key];
    delete c[MARK.tuned + uid];
  }
  // 3. ✦ marks on lines whose stat is present; a mark whose stat is gone (an old reroll) refunds its Needle
  const held = {}; // uid → ✦ bits of a Pierce / Aura Power line held over for step 5
  for (const key of Object.keys(c).filter((k) => k.startsWith(MARK.tuned))) {
    const uid = key.slice(MARK.tuned.length);
    const g = p.gear[uid];
    const marks = decodeTuned(c[key]);
    for (const [stat, bits] of Object.entries(marks)) {
      const sub = ok(g) ? g.subs.find((s) => s.stat === stat) : null;
      // a Pierce / Aura Power line may come back in step 5: keep its marks for that (step 5 refunds them
      // when the line does not come back in place)
      if (!sub && ok(g) && NEW_STATS.includes(stat) && c[MARK.newLine + uid]) {
        held[uid] = { stat, bits };
        continue;
      }
      if (sub) sub.tuned = (sub.tuned | 0) | bits;
      else refund(NEEDLE_ID, tuneCount(bits));
    }
  }
  // 4. clubs an older build dropped
  for (const key of Object.keys(c).filter((k) => k.startsWith(MARK.club))) {
    const g = p.gear[key.slice(MARK.club.length)];
    const club = clubAt(whole(c[key]));
    if (g && !g.club && club && CLUB_IDS.includes(club) && CLUB_RARITIES.includes(g.rarity)) g.club = club;
  }
  // 5. a Pierce / Aura Power line an older build deleted: back in place when the other subs are untouched,
  //    else (the piece was rerolled meanwhile) one fresh line refills the piece's count. A ✦ on a line that
  //    does not come back in place pays its Needles back (nothing earned is ever lost). Its ✦ bits are the
  //    ones step 3 held over; on a piece step 3 could not hold them for (not a Legendary +10 / UR), step 3
  //    already refunded them, so they are neither put back nor paid twice.
  for (const key of Object.keys(c).filter((k) => k.startsWith(MARK.newLine))) {
    const uid = key.slice(MARK.newLine.length);
    const g = p.gear[uid];
    const line = decodeNewLine(c[key]);
    if (!g || !line || g.subs.some((s) => s.stat === line.stat)) continue;
    const stars = ok(g) ? (line.tuned | (held[uid]?.stat === line.stat ? held[uid].bits : 0)) & 3 : 0;
    const room = (GEAR_SUBSTATS_BY_RARITY[g.rarity] || 0) - g.subs.length;
    if (room <= 0 || !NEW_STAT_SLOT[line.stat]?.includes(g.slot)) {
      refund(NEEDLE_ID, tuneCount(stars));
      continue;
    }
    if (subsFingerprint(g, line.stat) === whole(c[MARK.newFp + uid])) {
      const sub = { stat: line.stat, value: line.base, base: line.base, upgrades: line.upgrades };
      if (stars) sub.tuned = stars;
      g.subs.splice(Math.min(line.index, g.subs.length), 0, sub);
    } else {
      refund(NEEDLE_ID, tuneCount(stars));
      const sub = rollFreshSub(createRng(`gnx|${p.createdAt || 0}|${uid}`), g);
      if (sub) g.subs.push(sub);
    }
  }
  // 6. canonical pieces: values from base / level / ▲ / ✦, the ▲ count of the level, ✦ slot limits, UR name
  for (const g of Object.values(p.gear)) {
    const tunedAny = g.subs.some((s) => s.tuned);
    if (!isUrGear(g) && !tunedAny && !g.main.top && !g.subs.some((s) => NEW_STATS.includes(s.stat) || s.top)) continue;
    let gold = false;
    let rainbow = false;
    const goldOk = g.rarity === 'legendary' && (isUrGear(g) || g.level >= MAX_GEAR_LEVEL);
    for (const s of g.subs) {
      if (!s.tuned) continue;
      let t = s.tuned & 3;
      if (t & TUNE_GOLD && (gold || !goldOk)) { t &= ~TUNE_GOLD; refund(NEEDLE_ID, 1); }
      if (t & TUNE_RAINBOW && (rainbow || !isUrGear(g))) { t &= ~TUNE_RAINBOW; refund(NEEDLE_ID, 1); }
      if (t & TUNE_GOLD) gold = true;
      if (t & TUNE_RAINBOW) rainbow = true;
      if (t) s.tuned = t;
      else delete s.tuned;
    }
    const want = Math.floor(g.level / SUB_GROWTH_EVERY);
    let have = g.subs.reduce((n, s) => n + (s.upgrades || 0), 0);
    while (have < want && g.subs.length) {
      const i = nextGrowthIndex(g);
      g.subs[i].upgrades = (g.subs[i].upgrades || 0) + 1;
      have += 1;
    }
    while (have > want) {
      const i = g.subs.reduce((b, s, k) => ((s.upgrades || 0) > (g.subs[b].upgrades || 0) ? k : b), g.subs.length - 1);
      g.subs[i].upgrades -= 1;
      have -= 1;
    }
    if (isLrGear(g)) g.name = lrName(g.name);
    else if (isUrGear(g)) g.name = urName(g.name);
    recomputeGear(g);
  }
  // 7. one-time gifts: the first-bloom Seed (a Legendary +10 in the save) and the Armband welcome (any Mythic+ piece)
  const pieces = Object.values(p.gear);
  if (!c[MARK.seedGift] && pieces.some((g) => g.rarity === 'legendary' && g.level >= MAX_GEAR_LEVEL)) {
    c[MARK.seedGift] = 1;
    give(p, SEED_ID, 1);
  }
  armbandWelcome(p);
  // freeplay milestones paid before they carried items: their Seed / Needles once
  for (const k of Object.keys(c)) {
    if (!k.startsWith(MILESTONE_MARK) || !c[k]) continue;
    const key = k.slice(MILESTONE_MARK.length);
    const items = MILESTONE_ITEMS[key.split(':').pop()];
    if (!items || c[MILESTONE_ITEMS_MARK + key]) continue;
    c[MILESTONE_ITEMS_MARK + key] = 1;
    for (const r of items) give(p, r.id, r.count);
  }
  writeGearMarks(p);
  return { refunds: Object.entries(refunds).map(([id, count]) => ({ id, count })) };
}
