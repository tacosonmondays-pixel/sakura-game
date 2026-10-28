// Tryout Day (docs/specs/TRYOUT_DAY.md §4): Pep Talk effects. Every card a player owns is folded once per
// girl into one ModSet (`t.runMods`, read by towerResolvedStats as an `extra` set), with additive families
// capped per girl (§4.4): bonuses are summed and capped first, then drawbacks are subtracted. Board cards
// change the run (coins, hearts, seats, passes). Nothing here runs per step.
import { TRYOUT, PEP_CARDS, SCALE, MAP_WIDE } from '../../data/tryout.js';
import { ROLES } from '../../data/types.js';

/** Card groups whose numbers scale with the pick's rarity (§4.2); the rest (talents, build cards, capstones) are fixed. */
const SCALING = new Set(['everyone', 'group', 'personal', 'placement']);
export const isScaling = (card) => !!card && SCALING.has(card.group);

/**
 * A card's numbers at rarity r: a scaling card × SCALE[r] (Team Huddle has its own steps; Shrine Visit's reveal grows
 * by revealStep per rarity step; Sharp Pencils adds its SSR+ pierce); a fixed card as written.
 */
export function cardMods(card, r) {
  if (card.steps) return card.steps[r] || null;
  if (!card.mods) return null;
  const k = isScaling(card) ? SCALE[r] ?? 1 : 1;
  const out = {};
  for (const [key, v] of Object.entries(card.mods)) {
    if (typeof v === 'number') out[key] = v * k;
    else if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = {};
      for (const [kk, vv] of Object.entries(v)) o[kk] = typeof vv === 'number' ? vv * k : vv;
      out[key] = o;
    } else out[key] = v;
  }
  if (card.revealStep) out.reveal = card.mods.reveal + card.revealStep * r;
  if (card.ssrPlus && r >= 2) for (const [key, v] of Object.entries(card.ssrPlus)) out[key] = (out[key] || 0) + v;
  return out;
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

/** A pair card's half a girl belongs to (an element or an attack type), or null. */
export function pairSide(def, half) {
  return def && (def.element === half || def.attackType === half);
}

/** Does a card (instance { id, unit?, r }) reach this girl of this player's at all? */
export function cardTargets(sim, inst, unitId, isHero) {
  const c = PEP_CARDS[inst.id];
  if (!c) return false;
  switch (c.group) {
    case 'everyone':
    case 'placement':
    case 'capstone':
      return true;
    case 'group':
      return inSet(sim, c.set, unitId);
    case 'personal':
    case 'talent':
      return !isHero && inst.unit === unitId;
    case 'build':
      return c.varsity ? !isHero && inst.unit === unitId : true;
    default:
      return false;
  }
}

const EMPTY = () => ({
  damageMul: 0, rateMul: 0, range: 0, critChance: 0, critMul: 0, airMul: 0, eliteMul: 0, bossMul: 0, barrierMul: 0, classMul: {},
  costCut: 0, pierce: 0, projectiles: 0, chain: 0, splash: 0, reveal: 0, dotMul: 0, auraRange: 0, auraPoints: 0,
  drawDamage: 0, raw: [], status: [],
});

/** Varsity's numbers (§5): from an UR / LR arrival or the Varsity Letter. */
function addVarsity(s) {
  s.damageMul += TRYOUT.varsity.damageMul;
  s.rateMul += TRYOUT.varsity.rateMul;
  s.costCut += TRYOUT.varsity.costCut;
}

/** Placement cards (§4.3): another girl of hers within `near` tiles, or nobody within `alone` tiles. */
function placementHolds(sim, owner, c, t) {
  if (!t || t.removed) return false;
  let nearest = Infinity;
  for (const o of sim.towers) {
    if (o === t || (o.owner ?? 0) !== owner) continue;
    const d2 = (o.x - t.x) * (o.x - t.x) + (o.y - t.y) * (o.y - t.y);
    if (d2 < nearest) nearest = d2;
  }
  if (c.near) return nearest <= c.near * c.near;
  if (c.alone) return nearest > c.alone * c.alone;
  return false;
}

/** Final Bell's wave (§4.3 X04): 1 = the last wave of a period, -1 = its first wave, 0 otherwise. */
function bellWave(sim) {
  return sim.tryout.bell || 0;
}

/**
 * Family sums of every card (and Varsity) a player holds that reaches this girl, before caps. `t`: her tower (the
 * placement cards read where she stands); raw: the Hidden Talents' and pair cards' raw ModSets.
 */
export function familySums(sim, owner, unitId, isHero, t = null) {
  const p = sim.tryout.players[owner];
  const s = EMPTY();
  if (!p) return s;
  const def = sim.data.unit(unitId);
  const add = (m) => {
    for (const [k, v] of Object.entries(m)) {
      if (k === 'classMul') for (const [c, x] of Object.entries(v)) s.classMul[c] = (s.classMul[c] || 0) + x;
      else if (typeof v === 'number' && k in s && k !== 'raw' && k !== 'status') s[k] += v;
    }
  };
  for (const inst of p.cards) {
    if (!cardTargets(sim, inst, unitId, isHero)) continue;
    const c = PEP_CARDS[inst.id];
    if (c.group === 'placement' && !placementHolds(sim, owner, c, t)) continue;
    if (c.group === 'talent') {
      s.raw.push(c.mods);
      if (inst.r >= 3) s.damageMul += 0.2; // a Hidden Talent taken at UR also adds +20 % damage (§4.2)
      continue;
    }
    if (c.pair) {
      // the pair cards (U02-U04): each half's bonus, and the drawback for girls in neither half
      const [a, b] = c.pair;
      const inA = pairSide(def, a);
      const inB = pairSide(def, b);
      if (!inA && !inB) s.drawDamage += -c.draw.othersDamage;
      if (inst.id === 'U02') {
        if (inA) s.status.push({ type: 'vulnerable', bonus: 0.1, duration: 3 });
        if (inB) s.damageMul += 0.3;
      } else if (inst.id === 'U03') {
        if (inA) s.status.push({ type: 'soak', duration: 3 });
        if (inB) {
          s.chain += 1;
          s.damageMul += 0.3;
        }
      } else if (inst.id === 'U04') {
        if (inA) s.reveal += 3;
        if (inB) s.critChance += 0.12;
      }
      continue;
    }
    if (c.varsity) {
      addVarsity(s);
      continue;
    }
    if (inst.id === 'X04') {
      const w = bellWave(sim);
      if (w > 0) add(c.lastWave);
      else if (w < 0) s.drawDamage += -c.firstWave.damageMul;
      continue;
    }
    const m = cardMods(c, inst.r);
    if (m) add(m);
  }
  if (!isHero && p.varsity?.[unitId]) addVarsity(s);
  return s;
}

const CAP_OF = {
  damageMul: 'damageMul', rateMul: 'rateMul', range: 'range', critChance: 'critChance', critMul: 'critMul',
  airMul: 'vs', eliteMul: 'vs', bossMul: 'vs', barrierMul: 'vs', costCut: 'costCut', pierce: 'pierce',
  projectiles: 'projectiles', chain: 'chain', splash: 'splash', dotMul: 'vs', reveal: 'reveal', auraRange: 'range', auraPoints: 'auraPoints',
};

/** Family sums capped per girl, drawbacks subtracted after the cap (§4.4). */
export function cappedSums(sim, owner, unitId, isHero, t = null) {
  const s = familySums(sim, owner, unitId, isHero, t);
  const c = TRYOUT.caps;
  const out = { classMul: {}, raw: s.raw, status: s.status };
  for (const k of Object.keys(CAP_OF)) out[k] = Math.min(c[CAP_OF[k]] ?? Infinity, s[k]);
  for (const [k, v] of Object.entries(s.classMul)) out.classMul[k] = Math.min(c.vs, v);
  out.damageMul -= s.drawDamage;
  if (MAP_WIDE.includes(unitId)) out.range = 0;
  return out;
}

/**
 * One girl's run ModSets (`t.runMods`): the capped fold first, then any raw talent / pair-card sets; null when no card
 * reaches her (a battle without cards resolves exactly as without the run).
 */
export function runModsFor(sim, owner, unitId, isHero, t = null) {
  const s = cappedSums(sim, owner, unitId, isHero, t);
  const m = {};
  // the "vs" bonuses count inside the run-damage cap (M0 review): the largest one (elite and boss together
  // against a boss) times the damage family never passes ×2.5; the vs bonus gives way (a vs card never costs damage
  // against ordinary foes, M2 bench)
  // card crit counts too, as its expected gain (M2 bench): the room left for vs after damage and crit
  const dmg = 1 + s.damageMul;
  const room = Math.max(1, TRYOUT.caps.runDamage / Math.max(1, dmg * critFactor(s.critChance, s.critMul)));
  for (const k of ['airMul', 'barrierMul', 'eliteMul']) s[k] = Math.min(s[k], room - 1);
  s.bossMul = Math.min(s.bossMul, room / (1 + s.eliteMul) - 1);
  for (const k of Object.keys(s.classMul)) s.classMul[k] = Math.min(s.classMul[k], room - 1);
  if (dmg !== 1) m.damageMul = dmg;
  if (s.rateMul) m.rateMul = 1 + s.rateMul;
  if (s.range) m.range = s.range;
  for (const k of ['pierce', 'projectiles', 'chain', 'splash', 'reveal']) if (s[k]) m[k] = s[k];
  if (s.critChance || s.critMul) m.crit = { chance: s.critChance, mulAdd: s.critMul };
  for (const k of ['airMul', 'eliteMul', 'bossMul', 'barrierMul']) if (s[k]) m[k] = 1 + s[k];
  const cls = Object.entries(s.classMul).filter(([, v]) => v);
  if (cls.length) m.classMul = Object.fromEntries(cls.map(([k, v]) => [k, 1 + v]));
  if (s.dotMul) m.dotMul = 1 + s.dotMul;
  if (s.auraRange || s.auraPoints) m.auraBoost = { range: s.auraRange, points: s.auraPoints };
  if (s.status.length) m.status = s.status;
  const base = Object.keys(m).length ? m : null;
  if (!s.raw.length) return base;
  return [base || {}, ...s.raw];
}

/** The largest "vs" multiplier a girl's capped cards give (elite and boss multiply against a boss). */
export function vsFactor(s) {
  let top = Math.max(1 + s.airMul, 1 + s.barrierMul, (1 + s.eliteMul) * (1 + s.bossMul));
  for (const v of Object.values(s.classMul)) top = Math.max(top, 1 + v);
  return top;
}

/** A girl's whole card damage factor (damage × the largest vs bonus × crit): the seat clamp divides by it. */
export function cardFactor(t) {
  const m = Array.isArray(t.runMods) ? t.runMods[0] : t.runMods;
  if (!m) return 1;
  let vs = Math.max(m.airMul ?? 1, m.barrierMul ?? 1, (m.eliteMul ?? 1) * (m.bossMul ?? 1));
  for (const v of Object.values(m.classMul || {})) vs = Math.max(vs, v);
  return (m.damageMul ?? 1) * vs * critFactor(m.crit?.chance || 0, m.crit?.mulAdd || 0);
}

/** The expected hit gain of card crit (chance on a ×1.5 crit, extra crit damage on the band's 15 % chance). */
export function critFactor(chance, mulAdd) {
  return 1 + chance * (0.5 + mulAdd) + TRYOUT.bandCap.critChance * mulAdd;
}

/** A player's cost cut on one girl (Scholarship, Varsity; placing and upgrading), capped. */
export function costCutFor(sim, owner, unitId) {
  if (!sim.tryout?.players[owner]) return 0;
  return cappedSums(sim, owner, unitId, false).costCut;
}

/** Re-folds every girl of one player (or of everyone: owner -1) and refreshes the ones that changed. */
export function refreshRunMods(sim, owner = -1) {
  for (const t of sim.towers) {
    const o = t.owner ?? 0;
    if (owner >= 0 && o !== owner) continue;
    const m = runModsFor(sim, o, t.unitId, t.isHero, t);
    if (JSON.stringify(m) === JSON.stringify(t.runMods ?? null)) continue;
    t.runMods = m;
    sim._refreshTower(t);
  }
  sim._buffsDirty = true;
}

/** Does any player hold a card whose numbers depend on where girls stand (placement) or on the wave (Final Bell)? */
export function hasCards(sim, test) {
  return sim.tryout.players.some((p) => p.cards.some((x) => test(PEP_CARDS[x.id], x)));
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
        reach = Math.max(reach, c.seatReach?.[inst.r] ?? reach);
        add += c.seatAdd[inst.r] || 0;
      }
      if (inst.id === 'X03') {
        // Golden Chalk: one more seat and the bonus at its cap
        dmg = s.dmgCap;
        reach = s.reachCap;
        add += c.seatAdd;
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
      // team-wide: every player gets +1 at every break from now on (§11). Passes are spent only in a break, so the
      // "+1 now" is the next break's bonus (giving both counted it twice when a break followed this pick)
      for (const q of ty.players) q.passBonus += c.passes;
      return false;
    case 'B06':
      return false;
    case 'B07':
      // Multiple Choice: a second Wild card on every later pick and one more Eraser
      p.extraCards = (p.extraCards || 0) + c.cards;
      p.erasers = Math.min(TRYOUT.erasers.max + 1, p.erasers + c.erasers);
      return false;
    case 'B08': {
      // Extra Desk: one more squad spot, the next pick is a Tryout pick; max hearts −10
      p.squadAdd += c.squad;
      p.tryoutNext = true;
      sim.maxLives = Math.max(1, sim.maxLives + c.draw.maxHearts);
      sim.lives = Math.min(sim.lives, sim.maxLives);
      return false;
    }
    case 'X03':
      return true;
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
