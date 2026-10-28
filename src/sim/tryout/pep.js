// Tryout Day (docs/specs/TRYOUT_DAY.md §4): Pep Talk effects. Every card a player owns is folded once per
// girl into one ModSet (`t.runMods`, read by towerResolvedStats as an `extra` set), with additive families
// capped per girl (§4.4): bonuses are summed and capped first, then drawbacks are subtracted. Board cards
// change the run (coins, hearts, seats, passes). Nothing here runs per step.
import { TRYOUT, PEP_CARDS, SCALE, MAP_WIDE } from '../../data/tryout.js';
import { ROLES } from '../../data/types.js';

/** A card's numbers at rarity r (a scaling card × SCALE[r]; Team Huddle has its own steps). */
export function cardMods(card, r) {
  if (card.steps) return card.steps[r] || null;
  if (!card.mods) return null;
  const k = SCALE[r] ?? 1;
  const out = {};
  for (const [key, v] of Object.entries(card.mods)) {
    if (typeof v === 'number') out[key] = v * k;
    else if (v && typeof v === 'object') {
      const o = {};
      for (const [kk, vv] of Object.entries(v)) o[kk] = typeof vv === 'number' ? vv * k : vv;
      out[key] = o;
    } else out[key] = v;
  }
  return out;
}

/** Does a card (instance { id, unit?, r }) reach this girl of this player's? */
export function cardTargets(sim, inst, unitId, isHero) {
  const c = PEP_CARDS[inst.id];
  if (!c) return false;
  if (c.group === 'everyone') return true;
  if (c.group === 'personal' || c.group === 'talent') return !isHero && inst.unit === unitId;
  if (c.group === 'group') return inSet(sim, c.set, unitId);
  return false;
}

/** Is a girl in a Group card's set (attack type, element or role category)? */
export function inSet(sim, set, unitId) {
  const def = sim.data.unit(unitId);
  if (!def || !set) return false;
  if (set.attackType) return def.attackType === set.attackType;
  if (set.element) return set.element.includes(def.element);
  if (set.category) return ROLES[def.role]?.category === set.category;
  return false;
}

/** Family sums of every card a player holds that reaches this girl (before caps). */
export function familySums(sim, owner, unitId, isHero) {
  const p = sim.tryout.players[owner];
  const s = { damageMul: 0, rateMul: 0, range: 0, critChance: 0, critMul: 0, airMul: 0, eliteMul: 0, bossMul: 0, barrierMul: 0, classMul: {}, costCut: 0, drawDamage: 0 };
  if (!p) return s;
  for (const inst of p.cards) {
    if (!cardTargets(sim, inst, unitId, isHero)) continue;
    const m = cardMods(PEP_CARDS[inst.id], inst.r);
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) {
      if (k === 'classMul') for (const [c, x] of Object.entries(v)) s.classMul[c] = (s.classMul[c] || 0) + x;
      else if (typeof v === 'number' && k in s) s[k] += v;
    }
  }
  return s;
}

const CAP_OF = {
  damageMul: 'damageMul', rateMul: 'rateMul', range: 'range', critChance: 'critChance', critMul: 'critMul',
  airMul: 'vs', eliteMul: 'vs', bossMul: 'vs', barrierMul: 'vs', costCut: 'costCut',
};

/** Family sums capped per girl, drawbacks subtracted after the cap (§4.4). */
export function cappedSums(sim, owner, unitId, isHero) {
  const s = familySums(sim, owner, unitId, isHero);
  const c = TRYOUT.caps;
  const out = { classMul: {} };
  for (const k of Object.keys(CAP_OF)) out[k] = Math.min(c[CAP_OF[k]], s[k]);
  for (const [k, v] of Object.entries(s.classMul)) out.classMul[k] = Math.min(c.vs, v);
  out.damageMul -= s.drawDamage;
  if (MAP_WIDE.includes(unitId)) out.range = 0;
  return out;
}

/**
 * One girl's run ModSet, or null when no card reaches her (a battle without cards resolves exactly
 * as without the run).
 */
export function runModsFor(sim, owner, unitId, isHero) {
  const s = cappedSums(sim, owner, unitId, isHero);
  const m = {};
  // the "vs" bonuses count inside the run-damage cap (M0 review): the largest one (elite and boss together
  // against a boss) times the damage family never passes ×2.5; damage gives way first
  const vsTop = vsFactor(s);
  let dmg = 1 + s.damageMul;
  if (dmg * vsTop > TRYOUT.caps.runDamage) dmg = Math.max(Math.min(1, dmg), TRYOUT.caps.runDamage / vsTop);
  if (dmg !== 1) m.damageMul = dmg;
  if (s.rateMul) m.rateMul = 1 + s.rateMul;
  if (s.range) m.range = s.range;
  if (s.critChance || s.critMul) m.crit = { chance: s.critChance, mulAdd: s.critMul };
  for (const k of ['airMul', 'eliteMul', 'bossMul', 'barrierMul']) if (s[k]) m[k] = 1 + s[k];
  const cls = Object.entries(s.classMul).filter(([, v]) => v);
  if (cls.length) m.classMul = Object.fromEntries(cls.map(([k, v]) => [k, 1 + v]));
  return Object.keys(m).length ? m : null;
}

/** The largest "vs" multiplier a girl's capped cards give (elite and boss multiply against a boss). */
export function vsFactor(s) {
  let top = Math.max(1 + s.airMul, 1 + s.barrierMul, (1 + s.eliteMul) * (1 + s.bossMul));
  for (const v of Object.values(s.classMul)) top = Math.max(top, 1 + v);
  return top;
}

/** A girl's whole card damage factor (damage × the largest vs bonus): the seat clamp divides by it. */
export function cardFactor(t) {
  const m = t.runMods;
  if (!m) return 1;
  let vs = Math.max(m.airMul ?? 1, m.barrierMul ?? 1, (m.eliteMul ?? 1) * (m.bossMul ?? 1));
  for (const v of Object.values(m.classMul || {})) vs = Math.max(vs, v);
  return (m.damageMul ?? 1) * vs;
}

/** A player's cost cut on one girl (Scholarship; placing and upgrading), capped. */
export function costCutFor(sim, owner, unitId) {
  if (!sim.tryout?.players[owner]) return 0;
  return cappedSums(sim, owner, unitId, false).costCut;
}

/** Re-folds every girl of one player (or of everyone: owner -1) and refreshes her. */
export function refreshRunMods(sim, owner = -1) {
  for (const t of sim.towers) {
    const o = t.owner ?? 0;
    if (owner >= 0 && o !== owner) continue;
    const m = runModsFor(sim, o, t.unitId, t.isHero);
    if (JSON.stringify(m) === JSON.stringify(t.runMods ?? null)) continue;
    t.runMods = m;
    sim._refreshTower(t);
  }
  sim._buffsDirty = true;
}

/** The team-wide seat bonus (§4.4): +25 % base raised by Sunny Window, never above the cap. */
export function seatBonus(sim) {
  const ty = sim.tryout;
  const s = TRYOUT.seats;
  let dmg = s.dmg;
  let reach = s.reach;
  let add = 0;
  for (const p of ty.players) {
    for (const inst of p.cards) {
      const c = PEP_CARDS[inst.id];
      if (inst.id === 'B04') {
        dmg = Math.max(dmg, c.seatDmg[inst.r] ?? dmg);
        reach = Math.max(reach, c.seatReach[inst.r] ?? reach);
        add += c.seatAdd[inst.r] || 0;
      }
    }
  }
  return { dmg: Math.min(s.dmgCap, dmg), reach: Math.min(s.reachCap, reach), add };
}

/** Spare Change: the team's coins added per foe (before the cash scale). */
export function spareChange(sim) {
  let n = 0;
  for (const p of sim.tryout.players) for (const inst of p.cards) if (inst.id === 'B02') n += PEP_CARDS.B02.bounty[inst.r] || 0;
  return n;
}

/**
 * A Board card's immediate effect for player `owner` (coins to their wallet, hearts, passes).
 * Returns true when the run rule must be rebuilt (seats, bounty).
 */
export function applyBoardCard(sim, owner, inst) {
  const ty = sim.tryout;
  const p = ty.players[owner];
  const c = PEP_CARDS[inst.id];
  const scale = sim.cashScale;
  switch (inst.id) {
    case 'B01':
      sim._gainCashFor(owner, c.now[inst.r] * scale);
      p.fund.push({ left: c.waves, amount: c.perWave[inst.r] });
      return false;
    case 'B02':
      return true;
    case 'B03': {
      const add = c.maxHearts[inst.r];
      const room = Math.max(0, TRYOUT.heartsMaxRise - ty.heartsAdded);
      const rise = Math.min(add, room);
      ty.heartsAdded += rise;
      sim.maxLives += rise;
      if (sim.canHeal()) sim.lives = Math.min(sim.maxLives, sim.lives + c.heal[inst.r] + rise);
      return false;
    }
    case 'B04':
      return true;
    case 'B05':
      p.passBonus += c.passes;
      p.passes = Math.min(TRYOUT.passes.max, p.passes + c.passes);
      return false;
    case 'B06':
      return false;
    default:
      return false;
  }
}

/** Per wave clear: Snack Fund's coins (each player's own). */
export function boardWaveClear(sim) {
  const ty = sim.tryout;
  ty.players.forEach((p, i) => {
    for (const f of p.fund) {
      if (f.left <= 0) continue;
      f.left--;
      sim._gainCashFor(i, f.amount * sim.cashScale);
    }
    p.fund = p.fund.filter((f) => f.left > 0);
  });
}

/** Per period end: Rainy-Day Fund (solo only: it reads the wallet). */
export function boardPeriodEnd(sim) {
  const ty = sim.tryout;
  if (ty.coop) return;
  const p = ty.players[0];
  if (!p.cards.some((x) => x.id === 'B06')) return;
  const c = PEP_CARDS.B06;
  const amount = Math.min(c.max * sim.cashScale, Math.floor((sim.cash * c.share) / 100));
  if (amount > 0) sim._gainCashFor(0, amount);
}
