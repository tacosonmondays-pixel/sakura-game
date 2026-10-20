// Old-build safety for rainbow UR gear, ✦ stitches, clubs and the club-only substats
// (docs/specs/GEAR_AWAKEN.md §8.3, GEAR_STATS.md §E.3). An older build strips the fields it does not know
// (`ur`, `tuned`, `club`, a Pierce / Aura Power line, the new item ids) but keeps missions.counters word for
// word, so every one of them is mirrored there and restored on the next load. Additive: no SAVE_VERSION bump.
//
// Mirrors (missions.counters):
//   gur:<uid>  UR level 10–12            gtn:<uid>  ✦ bits, 2 per stat in TUNE_BITS order
//   gbx:<uid>  box-born UR (the Rainbow Gear Box, ASCENSION.md §C.8): slot × 100 + main stat + 1, 0 after salvage
//   gcl:<uid>  club index (1…)           gnx:<uid>  a Pierce / Aura Power line   gnf:<uid>  fingerprint of the other subs
//   inv:<id>   item count (0 included) for the Seed, the Needle and the Armband
//   ga:gift / gc:gift  the one-time Seed and Armband gifts
import { GEAR_SUBSTATS_BY_RARITY } from '../data/types.js';
import { NEW_STAT_SLOT } from '../data/gearStats.js';
import { CLUB_IDS, CLUB_RARITIES, clubIndex, clubAt } from '../data/clubs.js';
import { TUNE_BITS, TUNE_GOLD, TUNE_RAINBOW, MARK, MIRRORED_ITEMS, SEED_ID, NEEDLE_ID, UR_MAX_LEVEL, MILESTONE_ITEMS, MILESTONE_MARK, MILESTONE_ITEMS_MARK } from '../data/gearAwaken.js';
import { createRng } from '../core/rng.js';
import { armbandWelcome, isUrGear, urName, recomputeGear, rollFreshSub, tuneCount, boxMark, SUB_GROWTH_EVERY, MAX_GEAR_LEVEL, nextGrowthIndex } from './gear.js';

const ITEM_MAX = 9999;
const NEW_STATS = ['piercePct', 'auraPct'];
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

/** Rewrite every gear mirror from the profile; keys of pieces that no longer qualify are dropped. */
export function writeGearMarks(p) {
  const c = counters(p);
  for (const k of Object.keys(c)) if (k.startsWith(MARK.ur) || k.startsWith(MARK.tuned) || k.startsWith(MARK.club) || k.startsWith(MARK.newLine) || k.startsWith(MARK.newFp)) delete c[k];
  for (const g of Object.values(p.gear || {})) {
    // `gur:` keeps its +10 rule; a box-born piece below +10 rides on `gbx:` alone
    if (isUrGear(g) && g.level >= MAX_GEAR_LEVEL) c[MARK.ur + g.uid] = g.level;
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
  // 1. items an older build dropped (spent items have mirror 0 and never come back)
  for (const id of MIRRORED_ITEMS) {
    const v = Math.min(ITEM_MAX, whole(c[MARK.inv + id]));
    if (v > 0 && !p.items[id]) p.items[id] = v;
  }
  // 1b. box-born UR (the Rainbow Gear Box, ASCENSION.md §C.8): `ur` back at any level when that uid, slot and
  //     main stat are present. A missing piece was salvaged by an older build: its Seed (step 2 pays it
  //     instead when the piece also had a `gur:` mark), and the mark becomes 0
  for (const key of Object.keys(c).filter((k) => k.startsWith(MARK.box))) {
    const v = whole(c[key]);
    if (v <= 0) continue;
    const uid = key.slice(MARK.box.length);
    const g = p.gear[uid];
    if (g) {
      if (g.rarity === 'legendary' && boxMark(g) === v) g.ur = 1;
      continue;
    }
    if (!(MARK.ur + uid in c)) refund(SEED_ID, 1);
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
    if (room <= 0 || NEW_STAT_SLOT[line.stat] !== g.slot) {
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
    if (!isUrGear(g) && !tunedAny && !g.subs.some((s) => NEW_STATS.includes(s.stat))) continue;
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
    if (isUrGear(g)) g.name = urName(g.name);
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
