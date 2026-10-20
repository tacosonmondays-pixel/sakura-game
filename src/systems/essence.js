// Essence (owner: systems). See docs/specs/ASCENSION.md §A.
//
// "Each duplicate gives her one Essence; one Essence and some coins raise her Potential."
//
// - A duplicate adds 1 to `profile.units[id].dupes` (the Essence-earned history, unchanged from
//   Potential v3) and nothing else: no Star Fragments, no Tomes.
// - Potential is BOUGHT: `units[id].pl` (1–6, mirrored in 'pl:<id>'), raised with Raise Potential
//   (1 Essence + POTENTIAL_STEP_COINS). src/systems/potential.js potentialLevel reads it.
// - Her Essence balance is DERIVED from monotone counts, so a stale tab can never corrupt it:
//     balance = dupes + essB − (pl − 1 − essU) − essX
//   dupes  her duplicates (unit field, mirrored in 'pot:<id>')
//   essB   'essB:<id>' Essence bought for her (the Moonpearl Chosen SSR Essence)
//   essU   'essU:<id>' Potential steps paid with Kindred Essence instead of her own
//   essX   'essX:<id>' Essence converted as spares (over her hold cap)
// - She holds at most 6 − P Essence. A duplicate beyond that is a SPARE and converts on arrival
//   into Mementos, Moonpearls and recruit points (SPARE_PAY; R spares give ⅕ point, kept in 'spk:r').
//   A load-time excess (an older build counted a duplicate) only raises essX and pays nothing: that
//   build already paid the duplicate its own way.
// - Kindred Essence (universal, R / SR / SSR; the SSR one comes as shards, 10 → 1) stands in for her
//   own Essence on a girl of its rarity or lower who has none of her own.
//
// Pure functions on the profile; nothing here is co-op hashed.

import { UNITS, UNIT_MAP } from '../data/units.js';
import { addItems, consumeItems, itemCount, missingItems } from './inventory.js';
import { mirrorUnit } from './ascensionSave.js';
import { gatesForLevel, BASE_GATES } from './progression.js';
import { track } from './missions.js';

export const MAX_P = 6;

/** Coins for each Raise Potential step P1→P2 … P5→P6, by her rarity (§A.2). */
export const POTENTIAL_STEP_COINS = Object.freeze({
  R: Object.freeze([2000, 4000, 6000, 10000, 15000]),
  SR: Object.freeze([5000, 10000, 15000, 25000, 40000]),
  SSR: Object.freeze([10000, 20000, 40000, 70000, 100000]),
});

/** What a spare copy (over her hold cap) converts into (§A.3). `fifths`: recruit points × 5. */
export const SPARE_PAY = Object.freeze({
  R: Object.freeze({ memento: 2, moonpearl: 0, fifths: 1 }),
  SR: Object.freeze({ memento: 6, moonpearl: 1, fifths: 5 }),
  SSR: Object.freeze({ memento: 0, moonpearl: 10, fifths: 25 }),
});

/** Kindred items by the highest rarity they work on (§A.4). */
export const KINDRED = Object.freeze({ kindred_r: 'R', kindred_sr: 'SR', kindred_ssr: 'SSR' });
const RANK = { R: 0, SR: 1, SSR: 2 };

/** Shards that fuse automatically, 10 → 1 (§A.4, §B.4). */
export const SHARD_FUSION = Object.freeze({ kindred_shard_ssr: 'kindred_ssr', crown_rainbow_shard: 'crown_rainbow' });
export const SHARDS_PER_WHOLE = 10;

/** The one-time migration (§A.7): marker counter and the welcome pouch bounds. */
export const MIGRATION_MARK = 'ess:mig';
/** What the migration paid as the welcome pouch (the letter reads it): Mementos × 1000 + Moonpearls. */
export const POUCH_MARK = 'ess:pouch';
export const POUCH_MIN = Object.freeze({ memento: 60, moonpearl: 15 });
export const POUCH_MAX = Object.freeze({ memento: 300, moonpearl: 60 });

const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const counters = (profile) => ((profile.missions ||= {}).counters ||= {});
const cnt = (profile, key) => whole(profile?.missions?.counters?.[key]);
const bump = (profile, key, n = 1) => {
  const c = counters(profile);
  c[key] = whole(c[key]) + n;
};

/** Her bought Potential (1–6; 1 when not set). */
export function boughtP(unitState) {
  return Math.min(MAX_P, Math.max(1, whole(unitState?.pl) || 1));
}

/** @returns {number} Essence she holds now (never negative). */
export function essenceBalance(profile, unitId) {
  const st = profile?.units?.[unitId];
  if (!st) return 0;
  const used = boughtP(st) - 1 - cnt(profile, `essU:${unitId}`);
  return Math.max(0, whole(st.dupes) + cnt(profile, `essB:${unitId}`) - Math.max(0, used) - cnt(profile, `essX:${unitId}`));
}

/** @returns {number} the most Essence she can hold (6 − P). */
export function essenceCap(unitState) {
  return MAX_P - boughtP(unitState);
}

/** Coins for her next Raise Potential (null at P6). */
export function raiseCost(def, p) {
  const row = POTENTIAL_STEP_COINS[def?.rarity] || POTENTIAL_STEP_COINS.R;
  return p >= MAX_P ? null : row[Math.max(1, p) - 1];
}

/** Spare payout of one copy at a rarity (points as fifths). */
export function sparePay(rarity) {
  return SPARE_PAY[rarity] || SPARE_PAY.R;
}

/**
 * Pay one spare copy: Mementos, Moonpearls and recruit points (R: ⅕ point, counted in 'spk:r').
 * @param {{ points?: boolean }} [o] points: false for a released Kindred (§A.4, no recruit points)
 * @returns {{ mementos: number, moonpearls: number, points: number, fifths: number }}
 */
export function paySpare(profile, rarity, { points = true } = {}) {
  const pay = sparePay(rarity);
  addItems(profile, [{ id: 'memento', count: pay.memento }, { id: 'moonpearl', count: pay.moonpearl }]);
  let gained = 0;
  if (points) {
    if (pay.fifths % 5 === 0) gained = pay.fifths / 5;
    else {
      const before = cnt(profile, 'spk:r');
      bump(profile, 'spk:r', pay.fifths);
      gained = Math.floor((before + pay.fifths) / 5) - Math.floor(before / 5);
    }
    if (gained) {
      const g = (profile.gacha ||= {});
      g.recruitPoints = whole(g.recruitPoints) + gained;
    }
  }
  return { mementos: pay.memento, moonpearls: pay.moonpearl, points: gained, fifths: points ? pay.fifths : 0 };
}

/** R spares' fifths towards the next recruit point (0–4: the recruit screen's 5-pip meter). */
export function spareFifths(profile) {
  return cnt(profile, 'spk:r') % 5;
}

/**
 * A duplicate arrived (unlocks.js grantUnit, after `dupes += 1`): her Essence, or a spare.
 * @returns {{ essence: 0|1, spare: null|{ mementos: number, moonpearls: number, points: number, fifths: number }, potential: number, essenceHeld: number, readyStep: number|null }}
 */
export function receiveDuplicate(profile, unitId) {
  const st = profile.units[unitId];
  const def = UNIT_MAP[unitId];
  let essence = 1;
  let spare = null;
  if (essenceBalance(profile, unitId) > essenceCap(st)) {
    bump(profile, `essX:${unitId}`);
    spare = paySpare(profile, def?.rarity);
    essence = 0;
  }
  const p = boughtP(st);
  const held = essenceBalance(profile, unitId);
  return { essence, spare, potential: p, essenceHeld: held, readyStep: held > 0 && p < MAX_P ? p + 1 : null };
}

/** Kindred items that work on her (rarity or higher), best-fitting first. */
export function kindredFor(def) {
  const r = RANK[def?.rarity] ?? 0;
  return Object.keys(KINDRED).filter((id) => RANK[KINDRED[id]] >= r);
}

/**
 * Can she take a Raise Potential step now, and with what?
 * `use`: 'own' (her Essence) or a Kindred item id (only when she has no Essence of her own).
 * @returns {{ ok: boolean, reason?: 'notOwned'|'max'|'noEssence'|'kindred'|'coins', from: number, to: number|null,
 *   coins: number|null, use: string|null, kindred: { id: string, have: number }[], essence: number }}
 */
export function canRaisePotential(profile, unitId, use = null) {
  const st = profile?.units?.[unitId];
  const def = UNIT_MAP[unitId];
  const p = boughtP(st);
  const essence = essenceBalance(profile, unitId);
  const kindred = kindredFor(def).map((id) => ({ id, have: itemCount(profile, id) })).filter((k) => k.have > 0);
  const base = { from: p, to: p < MAX_P ? p + 1 : null, coins: raiseCost(def, p), essence, kindred };
  if (!st || !def) return { ok: false, reason: 'notOwned', use: null, ...base };
  if (p >= MAX_P) return { ok: false, reason: 'max', use: null, ...base };
  let how = use;
  if (!how) how = essence > 0 ? 'own' : kindred[0]?.id || null;
  if (how === 'own' && essence < 1) return { ok: false, reason: 'noEssence', use: null, ...base };
  if (how && how !== 'own') {
    // Kindred stands in only for a girl with none of her own, of its rarity or lower
    if (essence > 0 || !KINDRED[how] || !kindredFor(def).includes(how) || itemCount(profile, how) < 1) return { ok: false, reason: 'kindred', use: how, ...base };
  }
  if (!how) return { ok: false, reason: 'noEssence', use: null, ...base };
  if (itemCount(profile, 'coins') < base.coins) return { ok: false, reason: 'coins', use: how, ...base };
  return { ok: true, use: how, ...base };
}

/**
 * Raise Potential: 1 Essence (her own, or a Kindred) + coins → P + 1. Never automatic.
 * @returns {{ ok: boolean, error?: string, from?: number, to?: number, coins?: number, use?: string, missing?: object[] }}
 */
export function raisePotential(profile, unitId, use = null) {
  const c = canRaisePotential(profile, unitId, use);
  if (!c.ok) return { ok: false, error: c.reason, missing: c.reason === 'coins' ? missingItems(profile, [{ id: 'coins', count: c.coins }]) : [] };
  const costs = [{ id: 'coins', count: c.coins }, ...(c.use !== 'own' ? [{ id: c.use, count: 1 }] : [])];
  if (!consumeItems(profile, costs)) return { ok: false, error: 'coins', missing: missingItems(profile, costs) };
  const st = profile.units[unitId];
  if (c.use !== 'own') bump(profile, `essU:${unitId}`);
  st.pl = c.to;
  mirrorUnit(profile, unitId);
  track(profile, 'spendCoins', c.coins);
  track(profile, 'potentialUp', 1);
  return { ok: true, from: c.from, to: c.to, coins: c.coins, use: c.use };
}

/** Owned girls a Kindred item could raise now (her rarity or lower, below P6). */
export function kindredTargets(profile, itemId) {
  const r = KINDRED[itemId];
  if (!r) return [];
  return UNITS.filter((u) => profile.units?.[u.id] && RANK[u.rarity] <= RANK[r] && boughtP(profile.units[u.id]) < MAX_P).map((u) => u.id);
}

/** @returns {boolean} a shop row or Backpack item of this Kindred has someone to use it on */
export function kindredUseful(profile, itemId) {
  return kindredTargets(profile, itemId).length > 0;
}

/**
 * Release a Kindred item nobody can use for exactly a spare of its rarity, without recruit points (§A.4).
 * @returns {{ ok: boolean, error?: 'unknown'|'useful'|'missing', pay?: object }}
 */
export function releaseKindred(profile, itemId) {
  const r = KINDRED[itemId];
  if (!r) return { ok: false, error: 'unknown' };
  if (kindredUseful(profile, itemId)) return { ok: false, error: 'useful' };
  if (!consumeItems(profile, [{ id: itemId, count: 1 }])) return { ok: false, error: 'missing' };
  bump(profile, `kinX:${r}`);
  return { ok: true, pay: paySpare(profile, r, { points: false }) };
}

/** A Chosen Essence (Memento Exchange): +1 of HER Essence; refused at her hold cap. */
export function canAddChosenEssence(profile, unitId) {
  const st = profile?.units?.[unitId];
  return !!st && essenceBalance(profile, unitId) < essenceCap(st);
}
export function addChosenEssence(profile, unitId) {
  if (!canAddChosenEssence(profile, unitId)) return false;
  bump(profile, `essB:${unitId}`);
  return true;
}

/**
 * Fuse every 10 shards into a whole (Kindred Shard (SSR) → Kindred Essence (SSR), Rainbow Crown
 * Shard → Rainbow Crown). Automatic; call after any grant that can add shards.
 * @returns {{ id: string, count: number }[]} wholes made (the fanfare reads it)
 */
export function fuseShards(profile) {
  const made = [];
  for (const [shard, wholeId] of Object.entries(SHARD_FUSION)) {
    const n = Math.floor(itemCount(profile, shard) / SHARDS_PER_WHOLE);
    if (n > 0 && consumeItems(profile, [{ id: shard, count: n * SHARDS_PER_WHOLE }])) {
      addItems(profile, [{ id: wholeId, count: n }]);
      made.push({ id: wholeId, count: n });
    }
  }
  return made;
}

/**
 * The one-time switch to Essence (§A.7; marker 'ess:mig'). Every owned girl gets the Potential her
 * counted duplicates had earned (P = min(6, 1 + dupes), free; P never drops) and, past gate 5, the
 * gates her level already needs (free: no level ever drops), duplicates past P6
 * are marked converted, and the save gets the welcome pouch (60 Mementos + 15 Moonpearls at least,
 * sized by those past-P6 copies at the spare rates, at most 300 + 60), paid into the items (never
 * by mail: an older build drops unknown reward ids from letters). Idempotent.
 * @returns {{ ran: boolean, pouch?: { memento: number, moonpearl: number } }}
 */
export function migrateEssence(profile) {
  const c = counters(profile);
  if (whole(c[MIGRATION_MARK])) return { ran: false };
  let memento = 0;
  let moonpearl = 0;
  for (const [id, st] of Object.entries(profile.units || {})) {
    const def = UNIT_MAP[id];
    if (!def || !st) continue;
    const dupes = whole(st.dupes);
    st.pl = Math.max(boughtP(st), Math.min(MAX_P, 1 + dupes));
    // no level ever drops (§I): with gate 5 open, Potential v3 set her cap; count the gates past 5
    // up to her level as broken, free (her level, or the 'lv:' shadow of one an older build clamped)
    if (whole(st.breakthrough) >= BASE_GATES) {
      const level = Math.max(whole(st.level), whole(c[`lv:${id}`]));
      st.breakthrough = Math.max(whole(st.breakthrough), gatesForLevel(level, st.pl));
    }
    const past = Math.max(0, dupes - (MAX_P - 1));
    if (past > whole(c[`essX:${id}`])) c[`essX:${id}`] = past;
    const pay = sparePay(def.rarity);
    memento += past * pay.memento;
    moonpearl += past * pay.moonpearl;
    mirrorUnit(profile, id);
  }
  const pouch = {
    memento: Math.min(POUCH_MAX.memento, Math.max(POUCH_MIN.memento, memento)),
    moonpearl: Math.min(POUCH_MAX.moonpearl, Math.max(POUCH_MIN.moonpearl, moonpearl)),
  };
  addItems(profile, [{ id: 'memento', count: pouch.memento }, { id: 'moonpearl', count: pouch.moonpearl }]);
  c[POUCH_MARK] = pouch.memento * 1000 + pouch.moonpearl;
  c[MIGRATION_MARK] = 1;
  return { ran: true, pouch };
}

/**
 * After a load: Essence above her hold cap (an older build counted a duplicate) is marked as
 * converted spares. Raises essX only and PAYS NOTHING (that build already paid the copy). Idempotent.
 * @returns {string[]} ids whose essX rose
 */
export function settleSpares(profile) {
  const out = [];
  for (const [id, st] of Object.entries(profile?.units || {})) {
    if (!UNIT_MAP[id] || !st) continue;
    const over = essenceBalance(profile, id) - essenceCap(st);
    if (over > 0) {
      bump(profile, `essX:${id}`, over);
      out.push(id);
    }
  }
  return out;
}

/** Fresh-save marks: a profile born with Essence never runs the migration (no pouch). */
export function markEssenceBorn(profile) {
  counters(profile)[MIGRATION_MARK] = 1;
}
