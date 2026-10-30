// Joint Research (GAPS P-13 "offering", 5.10; BUILD_PLAN 6.1 T2): Tenka's lab team. When she buys a tier
// that raises her lab rounds (Joint Research at tier 3, Unified Theory at tier 5: a second round), her
// owner's girls in her range join her lab team for the rest of the battle. They leave the field to help
// her with her research and lend her their skills; nothing happens to them, and they are back in the
// roster after the battle (the battle only forgets them, like a sale without the coins).
//
// Who joins (absorbInto): every girl of HER player (t.owner) whose centre is within her effective range,
// never a hero, never another Tenka (or any girl with a lab of her own), in uid order. No refund. Each one
// leaves exactly like a sale (Sim._removeTower): traps, zones, shells, drones, ability effects, drinks and
// the final-tier slot go with her; projectiles in flight fizzle (owner.removed); her brews / links and
// pins fall away on the next step.
//
// The lab record (t.lab, plain data; the generic snapshot stores it as is; the battle save carries it as `lb`):
//   { rounds, members: { dps, frag, control, support, economy }, coins: { …the same keys }, income, interest, uids }
//   rounds    absorbs done (1 after Joint Research, 2 after Unified Theory)
//   members   how many girls of each class joined (class: ROLES[role].category; a tower whose role has no
//             lab class, e.g. a 'hero' category on a fixture tower, counts as dps)
//   coins     what was spent on them, per class (their `spent`: placement + tiers)
//   income    the wave income (perWave) of EVERY girl who joined, whatever her class (owner decision #146),
//             as her stats gave it (Potential's income steps included)
//   interest  the interest rate of each girl who joined with one (Momo's Merch Table / Golden Peach Bank), in
//             join order: each pays min(INCOME_INTEREST_MAX, rate × coins) at the clear, like her own did
//   uids      who joined, in order (the UI's "lab team" list later)
//
// The weapons, one per class that has a member; each one's strength k = power × √(coins / LAB_REF_COINS)
// (power: her lab.power, ×1.5 Grand Lab, ×3 Unified Theory), so the table's weapon is what LAB_REF_COINS
// coins of girls in that class give at power 1:
//   dps      +2 coil bolts × k (projectiles; at most LAB_BOLTS_MAX more)          labMods → her stats
//   support  +15% × k damage aura, radius LAB_AURA_RANGE (at most +LAB_AURA_MAX)  labMods → her stats
//   frag     a plasma grenade every LAB_FRAG_TICKS: her bolt damage × LAB_FRAG_MUL × k, blast, radius
//            LAB_FRAG_SPLASH, at her best target                                  t.labAtk, updateLab
//   control  a slow field around her, radius LAB_FIELD_RANGE: 20% × k (at most LAB_SLOW_MAX), refreshed
//            every LAB_FIELD_TICKS for ZONE_STATUS_TIME s                         t.labAtk, updateLab
//   economy  at every wave clear (not on a noIncome difficulty, not while she is sabotaged): LAB_ECON_SHARE
//            × power × (the joiners' wave income × the difficulty coin scale + their interest on the coins
//            at the clear) × the mode's income scale, owner-credited (Sim._gainCashFor(t.owner), GAPS P-16).
//            Every joiner feeds it, whatever her class (owner decision #146): a girl with income lends her
//            class's weapon AND her income, so a lab with no economy girl can still pay.   labIncome
// dps and support resolve inside towerResolvedStats (labMods), so a co-op checkpoint's rederiveStats
// agrees; the frag and control weapons run on t.labAtk { frag: k, slow, fragCd, fieldCd } (ticks), which
// syncLab rebuilds from t.lab and her stats (timers kept; both 0 at every wave clear, so a calm point's
// labAtk is exactly what syncLab builds).
//
// Selling Tenka refunds 70% of her own spent coins (t.spent never includes the lab); the lab team does not
// come back this battle. A restore (a battle save's tier replay, { restoring: true }) never absorbs: the
// saved lab record is what comes back (a co-op checkpoint restores t.lab with the rest of the state).
//
// Determinism (co-op lockstep): uid order, squared distances, integer tick timers, Math.sqrt (IEEE-exact),
// no rng; nothing reads a view. sim._labOn counts the girls with a lab (absent: the step skips it all).

import { ROLES } from '../data/types.js';
import {
  LAB_REF_COINS, LAB_BOLTS, LAB_BOLTS_MAX, LAB_AURA_RANGE, LAB_AURA_DMG, LAB_AURA_MAX, LAB_FRAG_TICKS, LAB_FRAG_MUL,
  LAB_FRAG_SPLASH, LAB_FIELD_RANGE, LAB_FIELD_TICKS, LAB_SLOW, LAB_SLOW_MAX, LAB_ECON_SHARE, ZONE_STATUS_TIME,
  INCOME_INTEREST_MAX, INCOME_INTEREST_SET_MAX,
} from './constants.js';
import { bestTarget, explode } from './towers.js';
import { statusCtxFor, setPassive } from './setRules.js';

/** The lab classes, in this order everywhere (the battle save packs them as arrays). */
export const LAB_CLASSES = Object.freeze(['dps', 'frag', 'control', 'support', 'economy']);

/** A girl's lab class: her role's category, or dps for a role without one of the five. */
export function labClassOf(def) {
  const c = ROLES[def?.role]?.category;
  return LAB_CLASSES.includes(c) ? c : 'dps';
}

/** An empty lab record. */
export function emptyLab() {
  return {
    rounds: 0,
    members: { dps: 0, frag: 0, control: 0, support: 0, economy: 0 },
    coins: { dps: 0, frag: 0, control: 0, support: 0, economy: 0 },
    income: 0,
    interest: [],
    uids: [],
  };
}

/** A weapon's strength: power × √(coins / LAB_REF_COINS); 0 for a class nobody joined. */
export function labStrength(lab, cls, power = 1) {
  if (!lab || !(lab.members[cls] > 0)) return 0;
  const c = lab.coins[cls] > 0 ? lab.coins[cls] : 0;
  return power * Math.sqrt(c / LAB_REF_COINS);
}

/**
 * The ModSet her dps and support weapons add (towerResolvedStats, after every tier and before a running
 * ability boost), or null when neither class has a member. `power`: her resolved lab.power.
 */
export function labMods(lab, power) {
  const kd = labStrength(lab, 'dps', power);
  const ks = labStrength(lab, 'support', power);
  if (!(kd > 0) && !(ks > 0)) return null;
  const m = {};
  // (resolveStats rounds projectiles to a whole number)
  if (kd > 0) m.projectiles = Math.min(LAB_BOLTS_MAX, LAB_BOLTS * kd);
  if (ks > 0) m.aura = { range: LAB_AURA_RANGE, dmgMul: 1 + Math.min(LAB_AURA_MAX, LAB_AURA_DMG * ks) };
  return m;
}

/**
 * After a placement, an upgrade or an absorb (Sim._refreshTower): her frag and control weapons from her lab
 * record and power (timers kept), and sim._labOn = the girls with a lab. A girl without a lab returns at once
 * (a battle without one never creates _labOn).
 */
export function syncLab(sim, t) {
  if (t && t.lab) {
    const power = t.stats?.lab?.power ?? 1;
    const a = t.labAtk || (t.labAtk = { frag: 0, slow: 0, fragCd: 0, fieldCd: 0 });
    a.frag = labStrength(t.lab, 'frag', power);
    const kc = labStrength(t.lab, 'control', power);
    a.slow = kc > 0 ? Math.min(LAB_SLOW_MAX, LAB_SLOW * kc) : 0;
  } else if (!sim._labOn) return;
  let n = 0;
  for (const o of sim.towers) if (!o.removed && o.lab) n++;
  sim._labOn = n;
}

/**
 * Joint Research / Unified Theory (Sim.upgradeTower, after the tier that raised her lab rounds; never under
 * a restore): her owner's girls in her range join her lab team. Emits labJoin. The uids that joined are the
 * new tail of t.lab.uids (and labJoin's uids), which is where a caller reads them (T3: the co-op `upg`
 * handler's owner list): nothing on the Sim outlives the command, so a battle save's restore, which never
 * absorbs, rebuilds every Sim field. @returns {number[]} the uids that joined
 */
export function absorbInto(sim, t) {
  const owner = t.owner ?? 0;
  const r = t.eff ? t.eff.range : t.stats.range;
  const r2 = r * r;
  const joins = [];
  for (const o of sim.towers) {
    if (o === t || o.removed || o.isHero || (o.owner ?? 0) !== owner) continue;
    if (o.unitId === t.unitId || o.stats?.lab) continue; // never another Tenka (or any lab of her own)
    const dx = o.x - t.x;
    const dy = o.y - t.y;
    if (dx * dx + dy * dy > r2) continue;
    joins.push(o);
  }
  joins.sort((a, b) => a.uid - b.uid);
  const lab = t.lab || (t.lab = emptyLab());
  lab.rounds++;
  const uids = [];
  for (const o of joins) {
    const cls = labClassOf(o.def);
    lab.members[cls]++;
    lab.coins[cls] += o.spent > 0 ? o.spent : 0;
    // every joiner's income feeds the economy weapon, whatever her class (owner decision #146)
    const inc = o.stats?.income;
    if (inc) {
      if (inc.perWave > 0) lab.income += inc.perWave;
      if (inc.interest > 0) lab.interest.push(inc.interest);
    }
    lab.uids.push(o.uid);
    uids.push(o.uid);
    sim._removeTower(o); // like a sale, without the coins
  }
  sim.stats.labJoined = (sim.stats.labJoined || 0) + uids.length;
  sim._refreshTower(t); // her dps / support weapons (labMods) and frag / control (syncLab)
  sim._buffsDirty = true;
  sim._emit('labJoin', {
    towerUid: t.uid, owner, round: lab.rounds, uids: uids.slice(), members: { ...lab.members },
  });
  return uids;
}

// ---------------------------------------------------------------------------
// The step: frag grenades and the control field
// ---------------------------------------------------------------------------

// the control field's pass over the enemies around her (module scratch: grid.each takes no closure)
const F = { sim: null };
const SLOW = { type: 'slow', amount: 0, duration: ZONE_STATUS_TIME };
function inField(e) {
  if (e.hidden || e.dead) return false;
  F.sim._applyStatusEvent(e, SLOW, F.sim._statusCtx);
  return false;
}

function fragSpec(t, k) {
  return {
    ...t.eff, damage: t.eff.damage * LAB_FRAG_MUL * k, attackType: 'blast', element: null, critChance: 0, splash: 0, pierce: 1,
    status: [], mark: null, silence: 0, reveal: 0, knockback: 0, gather: 0, hpPct: null, proc: null,
  };
}

// Her grenade's aim: the only fields of a spec that targeting reads (bestTarget → gatherTargets → combat.js
// isEligible: canHitAir, detection, attackType), as fragSpec would give them. Module scratch refreshed in
// place, so a ready grenade with nobody in range (every tick until someone walks in) allocates nothing; the
// full spec is built only for a throw. (If isEligible ever reads another spec field, copy it here too.)
const AIM = { canHitAir: true, detection: false, attackType: 'blast' };

function labTick(sim, t) {
  const a = t.labAtk;
  if (!a || t.disabled > 0) return;
  if (a.frag > 0) {
    if (a.fragCd > 0) a.fragCd--;
    if (a.fragCd <= 0) {
      AIM.canHitAir = t.eff.canHitAir;
      AIM.detection = t.eff.detection;
      const e = bestTarget(sim, t.ox, t.oy, t.eff.range, AIM, t.targetMode);
      if (e) {
        a.fragCd = LAB_FRAG_TICKS;
        sim._emit('labFrag', { towerUid: t.uid, x: e.x, y: e.y, radius: LAB_FRAG_SPLASH });
        explode(sim, t, fragSpec(t, a.frag), e.x, e.y, LAB_FRAG_SPLASH);
      }
    }
  }
  if (a.slow > 0) {
    if (a.fieldCd > 0) a.fieldCd--;
    else {
      a.fieldCd = LAB_FIELD_TICKS - 1;
      const ctx = sim._statusCtx;
      ctx.element = null;
      ctx.attackType = 'mystic';
      statusCtxFor(ctx, t);
      SLOW.amount = a.slow;
      F.sim = sim;
      sim.grid.each(t.x, t.y, LAB_FIELD_RANGE, inField);
      F.sim = null;
    }
  }
}

/** One fixed step (Sim._step1, after the girls attack; only while sim._labOn): every lab's weapons. */
export function updateLab(sim) {
  if (sim.state !== 'wave') return;
  const towers = sim.towers;
  for (let i = 0; i < towers.length; i++) if (towers[i].labAtk) labTick(sim, towers[i]);
}

/**
 * The economy weapon at the wave clear (Sim._checkWaveEnd, inside its income block, after the girls' own
 * income: never on a noIncome difficulty): LAB_ECON_SHARE × power × (the joiners' wave income × cashMul + each
 * joiner's interest, min(INCOME_INTEREST_MAX, rate × sim.cash)) × the mode's income scale, to her owner. The
 * interest reads the coins exactly as a girl's own interest does at that clear (solo: the wallet; co-op: the
 * step's pooled coins, the same number on every client; the clear only ever runs inside the step).
 */
export function labIncome(sim, cashMul) {
  for (const t of sim.towers) {
    const lab = t.lab;
    if (!lab || t.disabled > 0) continue;
    const rates = lab.interest;
    const n = rates ? rates.length : 0;
    if (!(lab.income > 0) && n === 0) continue;
    let interest = 0;
    // (her Treasurer 5-piece set cap lifts each joiner's interest cap like her own, GEAR_UPDATE.md §3.2)
    const cap = setPassive(t.unitStats, 'treasurer') && t.unitStats.setN >= 5 ? INCOME_INTEREST_SET_MAX : INCOME_INTEREST_MAX;
    for (let i = 0; i < n; i++) interest += Math.min(cap, rates[i] * sim.cash);
    const power = t.stats?.lab?.power ?? 1;
    const perWave = lab.income > 0 ? lab.income : 0;
    const amount = sim._gainCashFor(t.owner ?? 0, LAB_ECON_SHARE * power * (perWave * cashMul + interest) * sim.incomeMul);
    if (amount > 0) sim._emit('cash', { amount, reason: 'lab', towerUid: t.uid });
    sim._bakeOn(t, amount);
  }
}

/** The wave clear: the frag and field timers start over (a calm point's labAtk is syncLab's). */
export function endLabWave(sim) {
  for (const t of sim.towers) {
    const a = t.labAtk;
    if (a) {
      a.fragCd = 0;
      a.fieldCd = 0;
    }
  }
}
