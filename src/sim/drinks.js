// The buff thrower (Wakaba, Track Team Manager; docs/specs/UNIT_GAPS.md §5.6, primitive P-8): she never
// attacks enemies at base. Every few seconds she throws a sports drink at the girl in her range with
// the highest total damage dealt (ties: the lower uid); it splashes onto every girl near that one.
// A splashed girl is Hydrated: faster, longer reach (and harder with Energy Formula) for her next few
// attacks. Her paths make the drink stronger, permanent (Secret Formula), add Veil Sight (Coach's Eye),
// a cleanse (Ice Pack), towel snaps at enemies (Towel Snap), a life back after a clean wave (Recovery
// Plan) and a drink that every girl around her carries at all times (Championship Season).
//
// State: t.hydrated = { src, shots (-1: permanent), dmgMul, rateMul, rangeMul, pierce, detection } on a
// girl; one record per girl (the stronger drink wins; a weaker one only tops up the charges). It is
// folded into her effective stats (src/sim/towers.js refreshEffective, after auras and rallies, so it
// stacks with them) and one charge is used per successful attack (updateTower). Every drink ends at
// the wave clear (UNIT_GAPS §7.3); a permanent one also when its Wakaba is sold.
//
// Determinism: targets come from damageDealt, positions and uid only; the towel's timer is the step
// number staggered by uid; no rng (a towel hit can only crit through her stats, which have none).

import { isEligible } from './combat.js';
import { buffDur } from './setRules.js';
import { STEP, TOWEL_EVERY, MAX_LIVES_RESTORED } from './constants.js';
import { refreshEffective, bestTarget } from './towers.js';

const stepNo = (sim) => Math.round(sim.time / STEP);

/** The girl her drink goes to: in her range, the highest damageDealt, ties to the lower uid; never herself. */
export function drinkTarget(sim, t, range = t.eff.range) {
  const r2 = range * range;
  let best = null;
  for (const o of sim.towers) {
    if (o === t || o.removed || o.stats?.drink) continue;
    const dx = o.x - t.x;
    const dy = o.y - t.y;
    if (dx * dx + dy * dy > r2) continue;
    if (!best || o.damageDealt > best.damageDealt || (o.damageDealt === best.damageDealt && o.uid < best.uid)) best = o;
  }
  return best;
}

const strength = (h) => h.dmgMul * h.rateMul * h.rangeMul * (1 + 0.1 * h.pierce) * (h.detection ? 1.01 : 1);

/** Hydrates girl `o` with Wakaba `t`'s drink (permanent: never runs out). */
export function hydrate(sim, t, o, { permanent = false } = {}) {
  const d = t.stats.drink;
  const h = {
    src: t.uid,
    // (Buff Duration: a drink counted in shots gets floor(shots × her Buff Duration), GEAR_UPDATE.md §2.4)
    shots: permanent || d.permanent ? -1 : Math.floor(d.shots * buffDur(t.unitStats) + 1e-9),
    dmgMul: 1 + d.dmg,
    rateMul: 1 + d.rate,
    rangeMul: 1 + d.range,
    pierce: d.pierce,
    detection: d.detection,
  };
  if (d.cleanse && o.disabled > 0) o.disabled = 0; // Ice Pack
  const cur = o.hydrated;
  if (cur && strength(cur) > strength(h)) {
    // a weaker drink only tops up the charges of the stronger one
    if (cur.shots >= 0) cur.shots = h.shots < 0 ? -1 : Math.max(cur.shots, h.shots);
    return false;
  }
  o.hydrated = h;
  o.buffed = true;
  refreshEffective(o, sim.globalRateMul, sim.globalDmgMul ?? 1);
  return true;
}

/** Her drink is used up (a charge per successful attack, src/sim/towers.js updateTower) or ends. */
export function dehydrate(sim, o) {
  delete o.hydrated; // (absent, not null: a girl restored from a save has no such field)
  refreshEffective(o, sim.globalRateMul, sim.globalDmgMul ?? 1);
  sim._buffsDirty = true; // (buffed is rebuilt with the auras)
}

/** One charge of a girl's drink after a successful attack. */
export function useDrink(sim, o) {
  const h = o.hydrated;
  if (h.shots < 0) return;
  if (--h.shots <= 0) dehydrate(sim, o);
}

/**
 * The 'drink' behaviour: a drink at the girl her range picks, splashing onto every girl within
 * drink.splash of that girl (her own girls and a partner's). Only while a wave runs.
 */
export function throwDrink(sim, t) {
  if (sim.state !== 'wave') return false;
  const d = t.stats.drink;
  const target = drinkTarget(sim, t);
  if (!target) return false;
  const s2 = d.splash * d.splash;
  let n = 0;
  for (const o of sim.towers) {
    if (o === t || o.removed || o.stats?.drink) continue;
    const dx = o.x - target.x;
    const dy = o.y - target.y;
    if (dx * dx + dy * dy > s2) continue;
    hydrate(sim, t, o);
    n++;
  }
  // Championship Season: every girl within drink.season tiles of her carries the drink at all times
  if (d.season > 0) {
    const r2 = d.season * d.season;
    for (const o of sim.towers) {
      if (o === t || o.removed || o.stats?.drink) continue;
      const dx = o.x - t.x;
      const dy = o.y - t.y;
      if (dx * dx + dy * dy <= r2) hydrate(sim, t, o, { permanent: true });
    }
  }
  t.facing = Math.atan2(target.x - t.x, target.y - t.y);
  sim._emit('drink', { towerUid: t.uid, targetUid: target.uid, x: target.x, y: target.y, splash: d.splash, n });
  sim._emit('attack', { towerUid: t.uid, targetUid: null, kind: 'drink', x: target.x, y: target.y });
  return true;
}

/** Towel Snap (First Aid tier 3): one towel flick at an enemy every TOWEL_EVERY s, staggered by uid. */
export function drinkTick(sim, t) {
  const d = t.stats.drink;
  if (!d.towel || sim.state !== 'wave' || !t.towelSpec) return;
  const every = Math.round(TOWEL_EVERY / STEP);
  if ((stepNo(sim) + t.uid) % every !== 0) return;
  const e = bestTarget(sim, t.x, t.y, t.eff.range, t.towelSpec, t.targetMode);
  if (!e || !isEligible(e, t.towelSpec)) return;
  t.facing = Math.atan2(e.x - t.x, e.y - t.y);
  sim._hit(e, t, t.towelSpec, 1);
  sim._emit('attack', { towerUid: t.uid, targetUid: e.uid, kind: 'towel' });
}

/**
 * Wave clear (Sim._checkWaveEnd): every drink ends; Recovery Plan gives a life back after a wave
 * without a leak (once per wave however many Wakabas, MAX_LIVES_RESTORED per battle, never above the
 * starting lives, never where hearts cannot come back).
 */
export function endDrinkWave(sim) {
  let healer = null;
  for (const t of sim.towers) {
    if (t.hydrated) dehydrate(sim, t);
    if (!healer && t.stats?.drink?.life && !t.removed) healer = t;
  }
  if (!healer || !sim.canHeal() || sim.mode?.oneLife) return;
  if ((sim.stats.leaksByWave[sim.wave] || 0) > 0) return;
  const given = sim.stats.livesRestored || 0;
  if (given >= MAX_LIVES_RESTORED || sim.lives >= sim.maxLives) return;
  sim.lives++;
  sim.stats.livesRestored = given + 1;
  sim._emit('lifeRestored', { towerUid: healer.uid, lives: sim.lives });
}

/** A Wakaba leaves (sold): the permanent drinks she gave end with her. */
export function clearDrinksFrom(sim, t) {
  if (!t.stats?.drink) return;
  for (const o of sim.towers) if (o.hydrated && o.hydrated.src === t.uid && o.hydrated.shots < 0) dehydrate(sim, o);
}
