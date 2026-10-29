// The girl drawer's damage numbers (MORE › Details): the honest DPS, measured live, beside the per-target sum
// she would deal to one enemy, and a support's boost to her allies as a labelled estimate.
//
// The old single "DPS" was towerStats.dps (damage × rate × targets): one hit on one enemy. It left out splash
// (every enemy in the cloud), damage over time (poison / burn ticks, credited to her through Sim._credit),
// crits, drones, traps and marks, so Midori 5-0-2 read "DPS 42.6" while she dealt ~800/s to a pack of 8.
// The live number is what the sim credits her: damageDealt grows with every hit, splash, tick, crit and drone,
// and a rate meter over the last few seconds of game time turns it into damage per second.
//
// Beside it, her average ("DPS (avg)"): everything she dealt since the drawer first saw her on the field, over her
// wave time on the field since then, so it does not swing with each pack. The sim keeps no placement time, so the
// meter notes, per girl (by uid), her damageDealt when it first sees her and adds up the wave seconds after that.
// A hero's Move keeps her uid and her damageDealt (Sim._relocate), so her average carries on; a sale ends it (a girl
// placed again gets a new uid); after a restore or a co-op rejoin she starts again from what she has then (her
// running total stays, only the part the drawer watched counts). Between waves the clock stops, so it holds still.
//
// Display only: reads sim state (damageDealt, buffTargets, stats, time, state), never writes it. Pure helpers here;
// towerPanel.js owns the meter's per-frame sampling. Not part of the co-op hash.
import { createRateMeter } from './util.js';
import { fmtNum } from '../format.js';

/** Seconds of game time the live DPS averages over (the drone panel's "DPS (last 5 s)" uses the same). */
export const DPS_LIVE_WINDOW = 5;
/** Seconds of game time between the meter's samples (a frame-rate sample per girl would keep hundreds a window). */
const SAMPLE_EVERY = 0.1;
/** Wave seconds on the field before her average shows (until then "—": one hit over a split second is no average). */
export const DPS_AVG_MIN = 1;
/** A jump in game time bigger than this between two frames (a restore, a rejoin catching up) is not counted. */
const AVG_GAP = 2;

/**
 * Her average DPS: the damage she dealt since `base` (her damageDealt when the meter first saw her) over `secs`, her
 * wave seconds on the field since then. Null (the drawer's "—") before DPS_AVG_MIN, and for anything not a number.
 * @param {number} dealt her damageDealt now
 * @param {number} base her damageDealt when first seen
 * @param {number} secs wave seconds on the field since then
 * @returns {number|null}
 */
export function avgDps(dealt, base, secs) {
  const d = Number(dealt) - Number(base);
  const t = Number(secs);
  if (!Number.isFinite(d) || !Number.isFinite(t) || t < DPS_AVG_MIN) return null;
  return Math.max(0, d / t);
}

/**
 * Damage per second, measured: a rate meter over every girl's damageDealt during a wave, and each girl's average
 * over the last whole wave for the time between waves.
 * Also each girl's average since the meter first saw her (avg; see the header).
 * @returns {{ sample(sim: object): void, live(uid: number, sim: object): { value: number|null, kind: 'live'|'lastWave'|'none' }, avg(uid: number, sim: object): number|null, clear(): void }}
 */
export function createDpsMeter(window = DPS_LIVE_WINDOW) {
  const meter = createRateMeter(window);
  let lastTime = null;
  let lastSample = -Infinity;
  let inWave = false;
  let curWave = null;
  const start = new Map(); // uid -> [time, damageDealt] at the wave's start (or when she was placed)
  const lastWave = new Map(); // uid -> her average over the last whole wave
  const field = new Map(); // uid -> { base: damageDealt when first seen, secs: wave seconds on the field since }
  const clear = () => {
    meter.clear();
    start.clear();
    lastWave.clear();
    field.clear();
    lastTime = null;
    lastSample = -Infinity;
    inWave = false;
    curWave = null;
  };
  return {
    /**
     * One frame: notes the wave's start and end (by its state and its number, so a frame that steps past the short
     * gap between waves still closes one and opens the next) and samples every girl's running damage every
     * SAMPLE_EVERY s of game time.
     */
    sample(sim) {
      const time = sim.time;
      if (time === lastTime) return;
      if (lastTime != null && time < lastTime) clear(); // time went back: a restore or a co-op rebuild
      const dt = lastTime == null ? 0 : time - lastTime;
      lastTime = time;
      const wave = sim.state === 'wave';
      // her time on the field (wave seconds) and the damage it is set against
      const counted = (wave || inWave) && dt > 0 && dt <= AVG_GAP;
      for (const t of sim.towers) {
        const dealt = t.damageDealt || 0;
        const f = field.get(t.uid);
        if (!f || !(dealt >= f.last)) field.set(t.uid, { base: dealt, secs: 0, last: dealt });
        else {
          if (counted) f.secs += dt;
          else if (dt > AVG_GAP) f.base += dealt - f.last; // a jump the drawer did not watch: left out
          f.last = dealt;
        }
      }
      if (field.size > sim.towers.length) {
        // sold (or gone to a lab team): her average ends with her
        const here = new Set(sim.towers.map((t) => t.uid));
        for (const u of field.keys()) if (!here.has(u)) field.delete(u);
      }
      const next = wave && (!inWave || sim.wave !== curWave);
      if (inWave && (!wave || next)) {
        for (const t of sim.towers) {
          const s0 = start.get(t.uid);
          if (s0 && time - s0[0] >= 1) lastWave.set(t.uid, Math.max(0, ((t.damageDealt || 0) - s0[1]) / (time - s0[0])));
        }
      }
      if (next) {
        start.clear();
        meter.clear();
        lastSample = -Infinity;
      }
      inWave = wave;
      curWave = sim.wave;
      if (!wave) return;
      for (const t of sim.towers) if (!start.has(t.uid)) start.set(t.uid, [time, t.damageDealt || 0]);
      if (time - lastSample < SAMPLE_EVERY) return;
      lastSample = time;
      for (const t of sim.towers) meter.sample(time, t.uid, t.damageDealt || 0);
    },
    /** Her measured DPS: live during a wave (null for its first second), else her last wave's average. */
    live(uid, sim) {
      if (sim.state === 'wave') {
        const v = meter.rate(uid);
        return v == null ? { value: null, kind: 'none' } : { value: v, kind: 'live' };
      }
      return lastWave.has(uid) ? { value: lastWave.get(uid), kind: 'lastWave' } : { value: null, kind: 'none' };
    },
    /** Her average DPS since the meter first saw her, over her wave time on the field (null before DPS_AVG_MIN). */
    avg(uid, sim) {
      const f = field.get(uid);
      if (!f) return null;
      const t = sim?.getTower?.(uid);
      return avgDps(t ? t.damageDealt || 0 : f.last, f.base, f.secs);
    },
    clear,
  };
}

/**
 * A small percentage with two significant digits ("0.25", "1.5", "12"): a status that takes 0.25% of max HP a second
 * no longer reads "0.3%".
 * @param {number} pct the percentage (0.25 for 0.25%)
 */
export function fmtSmallPct(pct) {
  const v = Math.abs(Number(pct) || 0);
  if (v === 0) return '0';
  if (v >= 10) return String(Math.round(pct));
  return String(Number(Number(pct).toPrecision(2)));
}

/**
 * Her damage over time on ONE enemy, from her statuses: { dps, pct } summed over poison and burn (pct = share of max
 * HP a second; bosses and minibosses take a tenth of it: src/sim/enemies.js DOT_PCT_BOSS_MUL).
 */
export function dotOnOne(st) {
  let dps = 0;
  let pct = 0;
  for (const s of st?.status || []) {
    if (s.type !== 'poison' && s.type !== 'burn') continue;
    const chance = s.chance != null && s.chance < 1 ? s.chance : 1;
    dps += (s.dps || 0) * chance;
    pct += (s.pct || 0) * chance;
  }
  return { dps, pct };
}

/**
 * The per-target line: her hits on one enemy plus her damage over time on it, e.g. "42.6 hits + 56/s poison
 * (+0.25% HP/s)". A splash or a cloud reaches many enemies at once: the live DPS above it shows what she really deals.
 * @param {object} st towerStats
 * @param {number} hits her per-target hit DPS (towerStats.dps)
 * @returns {string|null}
 */
export function perTargetLine(st, hits) {
  const dot = dotOnOne(st);
  const parts = [];
  if (hits > 0) parts.push(`${fmtNum(hits, 'stat')} hits`);
  if (dot.dps > 0 || dot.pct > 0) {
    const has = (type) => (st.status || []).some((s) => s.type === type && ((s.dps || 0) > 0 || (s.pct || 0) > 0));
    const kind = has('poison') && has('burn') ? 'poison + burn' : has('poison') ? 'poison' : 'burn';
    parts.push(`${dot.dps > 0 ? `${fmtNum(dot.dps, 'stat')}/s ` : ''}${kind}${dot.pct > 0 ? ` (+${fmtSmallPct(dot.pct * 100)}% HP/s)` : ''}`);
  }
  return parts.length ? parts.join(' + ') : null;
}

/** How much a buff raises a girl's damage per second: its damage and attack-speed factors (others count as 1). */
function buffMul(src, kind, key, target) {
  const s = src.stats || {};
  if (kind === 'brew') return (s.brew?.dmgMul || 1) * (s.brew?.rateMul || 1);
  if (kind === 'link' || kind === 'overclock') {
    if (src.disabled > 0) return 1; // (a disabled linker's link pauses: src/sim/buffs.js)
    const l = s.link || {};
    return (l.dmgMul || 1) * (l.rateMul || 1) * (kind === 'overclock' ? (l.overclock?.rateMul || 1) : 1);
  }
  if (kind === 'aura') {
    // (an aura girl's own aura, or a hub's rules: Ouka's radius folds into the same buff slots, src/sim/hubs.js)
    const a = s.aura || {};
    const hub = s.hub || {};
    if (key === 'dmg') return Math.max(a.dmgMul || 1, hub.dmgMul || 1);
    if (key === 'rate') return Math.max(a.rateMul || 1, hub.rateMul || 1);
  }
  return 1;
}

/**
 * A support's boost to her allies, estimated: for every girl she buffs now (brew, link, aura, hub, drink), that girl's measured DPS × (1 − 1 / the
 * buff's factor), the share of her damage the buff adds. An estimate (factors stack with other buffs; armor and crits
 * are not split out), so the drawer labels it "~".
 * @param {object} sim the Sim (buffTargets(uid), getTower(uid))
 * @param {number} uid the support
 * @param {(uid: number) => number|null} dpsOf a girl's measured DPS (the meter's live value), or null
 * @returns {{ value: number, girls: number }|null} null when she buffs nobody's damage
 */
export function boostEstimate(sim, uid, dpsOf) {
  const src = sim.getTower(uid);
  if (!src || typeof sim.buffTargets !== 'function') return null;
  let value = 0;
  let girls = 0;
  for (const r of sim.buffTargets(uid) || []) {
    const o = sim.getTower(r.uid);
    if (!o || o.uid === uid) continue;
    let mul = 1;
    const keys = r.keys?.length ? r.keys : [null];
    for (const kind of r.kinds || []) {
      if (kind === 'aura') for (const k of keys) mul *= buffMul(src, kind, k, o);
      else mul *= buffMul(src, kind, null, o);
    }
    if (!(mul > 1)) continue;
    const d = dpsOf(o.uid);
    girls++;
    if (d > 0) value += d * (1 - 1 / mul);
  }
  // a drink thrower's Hydrated girls (Wakaba, src/sim/drinks.js: t.hydrated = { src, dmgMul, rateMul, ... })
  for (const o of sim.towers || []) {
    const hy = o.hydrated;
    if (!hy || hy.src !== uid || o.uid === uid) continue;
    const mul = (hy.dmgMul || 1) * (hy.rateMul || 1);
    if (!(mul > 1)) continue;
    const d = dpsOf(o.uid);
    girls++;
    if (d > 0) value += d * (1 - 1 / mul);
  }
  return girls ? { value, girls } : null;
}
